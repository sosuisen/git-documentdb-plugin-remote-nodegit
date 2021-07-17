/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import fs from 'fs';
import nodegit from '@sosuisen/nodegit';
import git from 'isomorphic-git';
import { Logger } from 'tslog';
import { Err } from './error';
import {
  NETWORK_RETRY,
  NETWORK_RETRY_INTERVAL,
  NETWORK_TIMEOUT,
} from './const';
import { RemoteOptions } from './types';
import { createCredential } from './authentication';
import { checkHTTP } from './net';

export function sleep(msec: number) {
  return new Promise((resolve) => setTimeout(resolve, msec));
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const type = 'remote';

// eslint-disable-next-line @typescript-eslint/naming-convention
const name = 'nodegit';

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
    name: 'plugin-nodegit',
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
    let result: { ok: boolean; code?: number } = {
      ok: false,
    };
    let retry = 0;
    for (; retry < NETWORK_RETRY; retry++) {
      // eslint-disable-next-line no-await-in-loop
      result = await checkHTTP(remoteOptions.remoteUrl!, NETWORK_TIMEOUT).catch(
        (err) => err
      );
      if (result.ok) {
        break;
      }
      else {
        logger.debug(
          `NetworkError in cloning: ${remoteOptions.remoteUrl}, ` + result
        );
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(NETWORK_RETRY_INTERVAL);
    }
    if (!result.ok) {
      // Set retry number for code test
      throw new Err.CannotConnectError(
        retry,
        remoteOptions.remoteUrl,
        result.toString()
      );
    }

    await nodegit.Clone.clone(remoteOptions.remoteUrl, workingDir, {
      fetchOpts: {
        callbacks: createCredential(remoteOptions),
      },
    }).catch((err) => {
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
async function getOrCreateGitRemote(
  repos: nodegit.Repository,
  remoteURL: string
): Promise<[GitRemoteAction, nodegit.Remote]> {
  let result: GitRemoteAction;
  // Check if remote repository already exists
  let remote = await nodegit.Remote.lookup(repos, 'origin').catch(() => {});
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
  logger?: Logger
): Promise<'exist' | 'not_exist'> {
  logger ??= new Logger({
    name: 'plugin-nodegit',
    minLevel: 'trace',
    displayDateTime: false,
    displayFunctionName: false,
    displayFilePath: 'hidden',
  });
  const credential = createCredential(options);
  const repos = await nodegit.Repository.open(workingDir);
  // Get NodeGit.Remote
  const [gitResult, remote] = await getOrCreateGitRemote(
    repos,
    options.remoteUrl!
  );
  logger.debug('Git remote: ' + gitResult);

  const remoteURL = remote.url();
  const error = String(
    await remote
      .connect(nodegit.Enums.DIRECTION.FETCH, credential)
      .catch((err) => err)
  );
  await remote.disconnect();

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
    case error.startsWith(
      'Failed to retrieve list of SSH authentication methods'
    ):
    case error.startsWith(
      'Error: too many redirects or authentication replays'
    ):
      throw new Err.FetchPermissionDeniedError(error);
    default:
      throw new Error(error);
  }

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
  logger?: Logger
) {
  logger ??= new Logger({
    name: 'plugin-nodegit',
    minLevel: 'trace',
    displayDateTime: false,
    displayFunctionName: false,
    displayFilePath: 'hidden',
  });
  const credential = createCredential(options);
  const repos = await nodegit.Repository.open(workingDir);
  // Get NodeGit.Remote
  const [gitResult, remote] = await getOrCreateGitRemote(
    repos,
    options.remoteUrl!
  );
  logger.debug('Git remote: ' + gitResult);

  const error = String(
    await remote
      .connect(nodegit.Enums.DIRECTION.PUSH, credential)
      .catch((err) => err)
  );
  await remote.disconnect();

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
    case error.startsWith(
      'Error: too many redirects or authentication replays'
    ):
    case error.startsWith('Error: ERROR: Permission to'): {
      throw new Err.PushPermissionDeniedError(error);
    }
    default:
      throw new Error(error);
  }
  return 'ok';
}

/**
 * Calc distance
 */
export function calcDistance(
  baseCommitOid: string,
  localCommitOid: string,
  remoteCommitOid: string
) {
  if (baseCommitOid === undefined) {
    return {
      ahead: undefined,
      behind: undefined,
    };
  }
  return {
    ahead: localCommitOid !== baseCommitOid ? 1 : 0,
    behind: remoteCommitOid !== baseCommitOid ? 1 : 0,
  };
}

/**
 * git push
 *
 * @throws {@link Err.UnfetchedCommitExistsError} (from this and validatePushResult())
 * @throws {@link Err.GitFetchError} (from validatePushResult())
 * @throws {@link Err.GitPushError} (from NodeGit.Remote.push())
 */
async function push(
  workingDir: string,
  remoteOptions: RemoteOptions
): Promise<void> {
  const repos = await nodegit.Repository.open(workingDir);
  const remote: nodegit.Remote = await repos.getRemote('origin');
  const credential = createCredential(remoteOptions);
  await remote
    .push(['refs/heads/main:refs/heads/main'], {
      callbacks: credential,
    })
    .catch((err: Error) => {
      if (
        err.message.startsWith(
          'cannot push because a reference that you are trying to update on the remote contains commits that are not present locally'
        )
      ) {
        throw new Err.UnfetchedCommitExistsError();
      }
      throw new Err.GitPushError(err.message);
    });

  await validatePushResult(repos, workingDir, credential);

  // It leaks memory if not cleanup
  repos.cleanup();
}

/**
 * NodeGit.Remote.push does not return valid error in race condition,
 * so check is needed.
 *
 * @throws {@link Err.GitFetchError}
 * @throws {@link Err.UnfetchedCommitExistsError}
 */
async function validatePushResult(
  repos: nodegit.Repository,
  workingDir: string,
  credential: { credentials: any }
): Promise<void> {
  await repos
    .fetch('origin', {
      callbacks: credential,
    })
    .catch((err) => {
      throw new Err.GitFetchError(err.message);
    });

  // Use isomorphic-git to avoid memory leak
  const localCommitOid = await git.resolveRef({
    fs,
    dir: workingDir,
    ref: 'HEAD',
  });
  const remoteCommitOid = await git.resolveRef({
    fs,
    dir: workingDir,
    ref: 'refs/remotes/origin/main',
  });

  const [baseCommitOid] = await git.findMergeBase({
    fs,
    dir: workingDir,
    oids: [localCommitOid, remoteCommitOid],
  });

  const distance = await calcDistance(
    baseCommitOid,
    localCommitOid,
    remoteCommitOid
  );

  if (distance.behind === undefined) {
    // This will not be occurred.
    throw new Err.NoMergeBaseFoundError();
  }
  else if (distance.behind > 0) {
    throw new Err.UnfetchedCommitExistsError();
  }
}

/**
 * git fetch
 *
 * @throws {@link Err.GitFetchError}
 */
async function fetch(
  workingDir: string,
  remoteOptions: RemoteOptions,
  logger?: Logger
) {
  logger ??= new Logger({
    name: 'plugin-nodegit',
    minLevel: 'trace',
    displayDateTime: false,
    displayFunctionName: false,
    displayFilePath: 'hidden',
  });

  logger.debug(`sync_worker: fetch: ${remoteOptions.remoteUrl}`);

  const repos = await nodegit.Repository.open(workingDir);
  const credential = createCredential(remoteOptions);
  await repos
    .fetch('origin', {
      callbacks: credential,
    })
    .catch((err) => {
      throw new Err.GitFetchError(err.message);
    });
  // It leaks memory if not cleanup
  repos.cleanup();
}

export { checkFetch, checkPush, clone, fetch, push, name, type };
