/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import nodegit from '@sosuisen/nodegit';
import { Logger } from 'tslog';
import { Err } from './error';
import { NETWORK_RETRY, NETWORK_RETRY_INTERVAL, NETWORK_TIMEOUT } from './const';
import { RemoteOptions } from './types';
import { createCredential } from './authentication';
import { checkHTTP } from './net';

export function sleep(msec: number) {
  return new Promise(resolve => setTimeout(resolve, msec));
}

const type = 'remote';

/**
 * Clone
 *
 * @throws {@link Err.CannotConnectError}
 * @throws {@link Err.CannotCloneRepositoryError}
 */
async function clone(
  workingDir: string,
  remoteOptions: RemoteOptions,
  logger?: Logger
): Promise<void> {
  logger ??= new Logger({
    name: 'clone',
    minLevel: 'trace',
    displayDateTime: false,
    displayFunctionName: false,
    displayFilePath: 'hidden',
  });
  if (
    remoteOptions !== undefined &&
    remoteOptions.remoteUrl !== undefined &&
    remoteOptions.remoteUrl !== ''
  ) {
    /**
     * Retry if network errors.
     */
    let result: {
      ok: boolean;
      code?: number;
      error?: Error;
    } = {
      ok: false,
    };
    let retry = 0;
    for (; retry < NETWORK_RETRY; retry++) {
      // eslint-disable-next-line no-await-in-loop
      result = await checkHTTP(remoteOptions.remoteUrl!, NETWORK_TIMEOUT).catch(err => err);
      if (result.ok) {
        break;
      }
      else {
        logger.debug(`NetworkError in cloning: ${remoteOptions.remoteUrl}, ` + result);
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(NETWORK_RETRY_INTERVAL);
    }
    if (!result.ok) {
      // Set retry number for code test
      throw new Err.CannotConnectError(retry, remoteOptions.remoteUrl, result.toString());
    }

    await nodegit.Clone.clone(remoteOptions.remoteUrl, workingDir, {
      fetchOpts: {
        callbacks: createCredential(remoteOptions),
      },
    }).catch(err => {
      // Errors except CannotConnectError are handled in combine functions.

      logger!.debug(`Error in cloning: ${remoteOptions.remoteUrl}, ` + err);
      throw new Err.CannotCloneRepositoryError(remoteOptions.remoteUrl!);
    });
  }
}

/**
 * GitOrigin
 */
 type GitRemoteAction = 'add' | 'change' | 'exist';

/**
 * Get or create Git remote named 'origin'
 *
 * (git remote add)
 *
 * @internal
 */
// eslint-disable-next-line complexity
async function _getOrCreateGitRemote(
  repos: nodegit.Repository,
  remoteURL: string
): Promise<[GitRemoteAction, nodegit.Remote]> {
  let result: GitRemoteAction;
  // Check if remote repository already exists
  let remote = await nodegit.Remote.lookup(repos, 'origin').catch(() => { });
  if (remote === undefined) {
    // Add remote repository
    remote = await nodegit.Remote.create(repos, 'origin', remoteURL);
    result = 'add';
  }
  else if (remote.url() !== remoteURL) {
    nodegit.Remote.setUrl(repos, 'origin', remoteURL);
    result = 'change';
  }
  else {
    result = 'exist';
  }
  return [result, remote];
}

/**
 * Check connection by FETCH
 *
 * @throws {@link Err.InvalidURLError}
 * @throws {@link Err.RemoteRepositoryNotFoundError}
 * @throws Error (Other errors from NodeGit.Remote#connect())
 *
 * @internal
 */
// eslint-disable-next-line complexity
async function checkFetch(
  workingDir: string,
  options: RemoteOptions,
  credentialCallbacks: { [key: string]: any },
  logger?: Logger  
): Promise<'exist' | 'not_exist'> {
  logger ??= new Logger({
    name: 'clone',
    minLevel: 'trace',
    displayDateTime: false,
    displayFunctionName: false,
    displayFilePath: 'hidden',
  });

  const repos = await nodegit.Repository.open(workingDir);
  // Get NodeGit.Remote
  const [gitResult, remote] = await _getOrCreateGitRemote(
    repos,
    options.remoteUrl!
  );
  logger.debug('Git remote: ' + gitResult);
  
  const remoteURL = remote.url();
  const error = String(
    await remote
      .connect(nodegit.Enums.DIRECTION.FETCH, credentialCallbacks)
      .catch(err => err)
  );
  await remote.disconnect();

  repos.cleanup();

  // if (error !== 'undefined') console.warn('connect fetch error: ' + error);
  switch (true) {
    case error === 'undefined':
      break;
    case error.startsWith('Error: unsupported URL protocol'):
    case error.startsWith('Error: failed to resolve address'):
    case error.startsWith('Error: failed to send request'):
      throw new Err.InvalidURLError(remoteURL + ':' + error);
    case error.startsWith('Error: unexpected HTTP status code: 4'): // 401, 404 on Ubuntu
    case error.startsWith('Error: request failed with status code: 4'): // 401, 404 on Windows
    case error.startsWith('Error: Method connect has thrown an error'):
    case error.startsWith('Error: ERROR: Repository not found'):
      // Remote repository does not exist, or you do not have permission to the private repository
      if (options.connection?.type === 'github') {
        return 'not_exist';
      }
      throw new Err.RemoteRepositoryNotFoundError(remoteURL + ':' + error);
      
    case error.startsWith(
      'Error: remote credential provider returned an invalid cred type'
    ): // on Ubuntu
    case error.startsWith('Failed to retrieve list of SSH authentication methods'):
    case error.startsWith('Error: too many redirects or authentication replays'):
      throw new Err.FetchPermissionDeniedError(error);
    default:
      throw new Error(error);
  };

  return 'exist';
}

/**
 * Check connection by PUSH
 *
 * @throws {@link Err.InvalidURLError}
 * @throws {@link Err.RemoteRepositoryNotFoundError}
 * @throws {@link Err.PushPermissionDeniedError}
 * @throws Error (Other errors from NodeGit.Remote#connect())
 *
 * @internal
 */
// eslint-disable-next-line complexity
async function checkPush(
  workingDir: string,
  options: RemoteOptions,
  credentialCallbacks: { [key: string]: any },
  logger?: Logger
) {
  logger ??= new Logger({
    name: 'clone',
    minLevel: 'trace',
    displayDateTime: false,
    displayFunctionName: false,
    displayFilePath: 'hidden',
  });

  const repos = await nodegit.Repository.open(workingDir);
  // Get NodeGit.Remote
  const [gitResult, remote] = await _getOrCreateGitRemote(
    repos,
    options.remoteUrl!
  );
  logger.debug('Git remote: ' + gitResult);

  const error = String(
    await remote
      .connect(nodegit.Enums.DIRECTION.PUSH, credentialCallbacks)
      .catch(err => err)
  );
  await remote.disconnect();

  repos.cleanup();

  // if (error !== 'undefined') console.warn('connect push error: ' + error);
  switch (true) {
    case error === 'undefined':
      break;
    case error.startsWith('Error: unsupported URL protocol'):
    case error.startsWith('Error: failed to resolve address'):
    case error.startsWith('Error: failed to send request'):
      throw new Err.InvalidURLError(options.remoteUrl!);
    case error.startsWith('Error: unexpected HTTP status code: 4'): // 401, 404 on Ubuntu
    case error.startsWith('Error: request failed with status code: 4'): // 401, 404 on Windows
    case error.startsWith('Error: Method connect has thrown an error'):
    case error.startsWith('Error: ERROR: Repository not found'): {
      // Remote repository does not exist, or you do not have permission to the private repository
      throw new Err.RemoteRepositoryNotFoundError(options.remoteUrl);
    }
    // Invalid personal access token
    // Personal access token is read only
    case error.startsWith(
      'Error: remote credential provider returned an invalid cred type'
    ): // on Ubuntu
    case error.startsWith('Error: too many redirects or authentication replays'):
    case error.startsWith('Error: ERROR: Permission to'): {
      throw new Err.PushPermissionDeniedError(error);
    }
    default:
      throw new Error(error);
  }
  return 'ok';
}

export { checkFetch, checkPush, clone, type };
