/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import fs from 'fs';
import nodegit, { RemoteCallbacks } from '@sosuisen/nodegit';
import git from 'isomorphic-git';
import { Logger } from 'tslog';
import { Err } from './error';
import { RemoteOptions } from './types';
import { createCredentialCallback } from './authentication';

/**
 * @internal
 */
export function sleep(msec: number) {
  return new Promise((resolve) => setTimeout(resolve, msec));
}

/**
 * @public
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const type = 'remote';

/**
 * @public
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const name = 'nodegit';

/**
 * Clone
 *
 * @throws {@link Err.CannotCloneRepositoryError}
 */
export async function clone(
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
    await nodegit.Clone.clone(remoteOptions.remoteUrl, workingDir, {
      fetchOpts: {
        callbacks: createCredentialCallback(remoteOptions),
      },
    }).catch((err) => {
      // Errors except CannotConnectError are handled in combine functions.
      logger!.debug(`Error in cloning: ${remoteOptions.remoteUrl}, ` + err);
      throw new Err.CannotCloneRepositoryError(err.message);
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
 */
// eslint-disable-next-line complexity
export async function getOrCreateGitRemote(
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
 * @throws {@link Err.InvalidURLFormatError}
 * @throws {@link Err.ResolvingAddressError}
 * @throws {@link Err.HTTPError401AuthorizationRequired}
 * @throws {@link Err.HTTPError404NotFound}
 * @throws {@link Err.CannotFetchError}
 *
 * @throws {@link Err.HttpProtocolRequiredError} (from createCredentialForGitHub)
 * @throws {@link Err.InvalidRepositoryURLError} (from createCredentialForGitHub)
 * @throws {@link Err.InvalidSSHKeyPathError} (from createCredentialForSSH)
 *
 * @throws {@link Err.InvalidAuthenticationTypeError} (from createCredential)
 *
 * @public
 */
// eslint-disable-next-line complexity
export async function checkFetch(
  workingDir: string,
  options: RemoteOptions,
  logger?: Logger
): Promise<boolean> {
  logger ??= new Logger({
    name: 'plugin-nodegit',
    minLevel: 'trace',
    displayDateTime: false,
    displayFunctionName: false,
    displayFilePath: 'hidden',
  });
  const callbacks = createCredentialCallback(options);
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
      .connect(nodegit.Enums.DIRECTION.FETCH, callbacks)
      .catch((err) => err)
  );
  await remote.disconnect();

  // if (error !== 'undefined') console.warn('connect fetch error: ' + error);
  switch (true) {
    case error === 'undefined':
      break;
    case error.startsWith('Error: unsupported URL protocol'):
    case error.startsWith('Error: malformed URL'):
      throw new Err.InvalidURLFormatError(error);

    case error.startsWith('Error: failed to send request'):
    case error.startsWith('Error: failed to resolve address'):
      throw new Err.ResolvingAddressError(error);

    case error.startsWith('Error: unexpected HTTP status code: 401'): // 401 on Ubuntu
    case error.startsWith('Error: request failed with status code: 401'): // 401 on Windows
    case error.startsWith('Error: Method connect has thrown an error'):
    case error.startsWith(
      'Error: remote credential provider returned an invalid cred type'
    ): // on Ubuntu
    case error.startsWith(
      'Failed to retrieve list of SSH authentication methods'
    ):
    case error.startsWith(
      'Error: too many redirects or authentication replays'
    ):
      throw new Err.HTTPError401AuthorizationRequired(error);

    case error.startsWith('Error: unexpected HTTP status code: 404'): // 404 on Ubuntu
    case error.startsWith('Error: request failed with status code: 404'): // 404 on Windows
    case error.startsWith('Error: ERROR: Repository not found'):
      throw new Err.HTTPError404NotFound(error);

    default:
      throw new Err.CannotFetchError(error);
  }

  return true;
}

/**
 * git fetch
 *
 *
 * @throws {@link Err.InvalidURLFormatError}
 * @throws {@link Err.ResolvingAddressError}
 * @throws {@link Err.HTTPError401AuthorizationRequired}
 * @throws {@link Err.HTTPError404NotFound}
 * @throws {@link Err.CannotFetchError}
 *
 * @throws {@link Err.HttpProtocolRequiredError} (from createCredentialForGitHub)
 * @throws {@link Err.InvalidRepositoryURLError} (from createCredentialForGitHub)
 * @throws {@link Err.InvalidSSHKeyPathError} (from createCredentialForSSH)
 *
 * @throws {@link Err.InvalidAuthenticationTypeError} (from createCredential)
 *
 * @public
 */
// eslint-disable-next-line complexity
export async function fetch(
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
  const callbacks = createCredentialCallback(remoteOptions);
  const error = await repos
    .fetch('origin', {
      callbacks,
    })
    .catch((err) => err);
  // It leaks memory if not cleanup
  repos.cleanup();

  // if (error !== 'undefined') console.warn('connect fetch error: ' + error);
  switch (true) {
    case error === 'undefined':
      break;
    case error.startsWith('Error: unsupported URL protocol'):
    case error.startsWith('Error: malformed URL'):
      throw new Err.InvalidURLFormatError(error);

    case error.startsWith('Error: failed to send request'):
    case error.startsWith('Error: failed to resolve address'):
      throw new Err.ResolvingAddressError(error);

    case error.startsWith('Error: unexpected HTTP status code: 401'): // 401 on Ubuntu
    case error.startsWith('Error: request failed with status code: 401'): // 401 on Windows
    case error.startsWith(
      'Error: remote credential provider returned an invalid cred type'
    ): // on Ubuntu
    case error.startsWith(
      'Failed to retrieve list of SSH authentication methods'
    ):
    case error.startsWith(
      'Error: too many redirects or authentication replays'
    ):
      throw new Err.HTTPError401AuthorizationRequired(error);

    case error.startsWith('Error: unexpected HTTP status code: 404'): // 404 on Ubuntu
    case error.startsWith('Error: request failed with status code: 404'): // 404 on Windows
    case error.startsWith('Error: ERROR: Repository not found'):
      throw new Err.HTTPError404NotFound(error);

    case error.startsWith('Error: Method connect has thrown an error'):
    default:
      throw new Err.CannotFetchError(error);
  }
}

/**
 * Check connection by PUSH
 *
 * @throws {@link Err.InvalidURLFormatError}
 * @throws {@link Err.RemoteRepositoryNotFoundError}
 * @throws {@link Err.PushPermissionDeniedError}
 * @throws {@link Error}
 *
 * @throws {@link Err.HttpProtocolRequiredError} (from createCredentialForGitHub)
 * @throws {@link Err.InvalidRepositoryURLError} (from createCredentialForGitHub)
 * @throws {@link Err.InvalidSSHKeyPathError} (from createCredentialForSSH)
 *
 * @throws {@link Err.InvalidAuthenticationTypeError} (from createCredential)
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
  const callbacks = createCredentialCallback(options);
  const repos = await nodegit.Repository.open(workingDir);
  // Get NodeGit.Remote
  const [gitResult, remote] = await getOrCreateGitRemote(
    repos,
    options.remoteUrl!
  );
  logger.debug('Git remote: ' + gitResult);

  const error = String(
    await remote
      .connect(nodegit.Enums.DIRECTION.PUSH, callbacks)
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
      throw new Err.InvalidURLFormatError(options.remoteUrl!);
    case error.startsWith('Error: unexpected HTTP status code: 4'): // 401, 404 on Ubuntu
    case error.startsWith('Error: request failed with status code: 4'): // 401, 404 on Windows
    case error.startsWith('Error: Method connect has thrown an error'):
    case error.startsWith('Error: ERROR: Repository not found'): {
      // Remote repository does not exist, or you do not have permission to the private repository
      throw new Err.HTTPError404NotFound(options.remoteUrl!);
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
 *
 * @internal
 */
function calcDistance(
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
 *
 * @public
 */
export async function push(
  workingDir: string,
  remoteOptions: RemoteOptions
): Promise<void> {
  const repos = await nodegit.Repository.open(workingDir);
  const remote: nodegit.Remote = await repos.getRemote('origin');
  const callbacks = createCredentialCallback(remoteOptions);
  await remote
    .push(['refs/heads/main:refs/heads/main'], {
      callbacks,
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

  await validatePushResult(repos, workingDir, callbacks);

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
  callbacks: RemoteCallbacks
): Promise<void> {
  await repos
    .fetch('origin', {
      callbacks,
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
