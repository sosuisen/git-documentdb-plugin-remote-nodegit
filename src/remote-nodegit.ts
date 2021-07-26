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
 *
 * @throws {@link Err.HttpProtocolRequiredError} (from createCredentialForGitHub)
 * @throws {@link Err.InvalidRepositoryURLError} (from createCredentialForGitHub)
 * @throws {@link Err.InvalidSSHKeyPathError} (from createCredentialForSSH)
 *
 * @throws {@link Err.InvalidAuthenticationTypeError} (from createCredential)
 */
// eslint-disable-next-line complexity
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
  logger.debug(`remote-nodegit: clone: ${remoteOptions.remoteUrl}`);

  const res = await nodegit.Clone.clone(remoteOptions.remoteUrl!, workingDir, {
    fetchOpts: {
      callbacks: createCredentialCallback(remoteOptions),
    },
  }).catch((err) => err);

  let error = '';
  if (res instanceof Error) {
    error = res.message;
  }

  // if (error !== 'undefined') console.warn('connect fetch error: ' + error);
  switch (true) {
    case error === '':
      break;

    case error.startsWith('unsupported URL protocol'):
    case error.startsWith('malformed URL'):
      throw new Err.InvalidURLFormatError(error);

    // NodeGit throws them when network is limited.
    case error.startsWith('failed to send request'):
    case error.startsWith('failed to resolve address'):
      throw new Err.NetworkError(error);

    case error.startsWith('unexpected HTTP status code: 401'): // 401 on Ubuntu
    case error.startsWith('request failed with status code: 401'): // 401 on Windows
    case error.startsWith('Method connect has thrown an error'):
    case error.startsWith(
      'remote credential provider returned an invalid cred type'
    ): // on Ubuntu
    case error.startsWith(
      'Failed to retrieve list of SSH authentication methods'
    ):
    case error.startsWith('too many redirects or authentication replays'):
      throw new Err.HTTPError401AuthorizationRequired(error);

    case error.startsWith('unexpected HTTP status code: 404'): // 404 on Ubuntu
    case error.startsWith('request failed with status code: 404'): // 404 on Windows
      throw new Err.HTTPError404NotFound(error);

    default:
      throw new Err.CannotConnectError(error);
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
  remoteURL: string,
  remoteName: string
): Promise<[GitRemoteAction, nodegit.Remote]> {
  let result: GitRemoteAction;
  // Check if remote repository already exists
  let remote = await nodegit.Remote.lookup(repos, remoteName).catch(() => {});
  if (remote === undefined) {
    // Add remote repository
    remote = await nodegit.Remote.create(repos, remoteName, remoteURL);
    result = 'add';
  }
  else if (remote.url() !== remoteURL) {
    nodegit.Remote.setUrl(repos, remoteName, remoteURL);
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
 * @throws {@link Err.NetworkError}
 * @throws {@link Err.HTTPError401AuthorizationRequired}
 * @throws {@link Err.HTTPError404NotFound}
 * @throws {@link Err.CannotConnectError}
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
  remoteName = 'origin',
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
    options.remoteUrl!,
    remoteName
  );
  logger.debug('Git remote: ' + gitResult);

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

    // NodeGit throws them when network is limited.
    case error.startsWith('Error: failed to send request'):
    case error.startsWith('Error: failed to resolve address'):
      throw new Err.NetworkError(error);

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
      throw new Err.HTTPError404NotFound(error);

    default:
      throw new Err.CannotConnectError(error);
  }

  return true;
}

/**
 * git fetch
 *
 * @throws {@link Err.InvalidGitRemoteError}
 * @throws {@link Err.InvalidURLFormatError}
 * @throws {@link Err.NetworkError}
 * @throws {@link Err.HTTPError401AuthorizationRequired}
 * @throws {@link Err.HTTPError404NotFound}
 * @throws {@link Err.CannotConnectError}
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
  remoteName = 'origin',
  logger?: Logger
) {
  logger ??= new Logger({
    name: 'plugin-nodegit',
    minLevel: 'trace',
    displayDateTime: false,
    displayFunctionName: false,
    displayFilePath: 'hidden',
  });

  logger.debug(`remote-nodegit: fetch: ${remoteOptions.remoteUrl}`);

  const repos = await nodegit.Repository.open(workingDir);
  const callbacks = createCredentialCallback(remoteOptions);
  const res = await repos
    .fetch(remoteName, {
      callbacks,
    })
    .catch((err) => err);
  // It leaks memory if not cleanup
  repos.cleanup();

  let error;
  if (res !== undefined && res !== null) {
    error = res.message;
  }

  // if (error !== 'undefined') console.warn('connect fetch error: ' + error);
  switch (true) {
    case error === undefined || error === null:
      break;
    case /^remote '.+?' does not exist/.test(error):
      throw new Err.InvalidGitRemoteError(error);

    case error.startsWith('unsupported URL protocol'):
    case error.startsWith('malformed URL'):
      throw new Err.InvalidURLFormatError(error);

    // NodeGit throws them when network is limited.
    case error.startsWith('failed to send request'):
    case error.startsWith('failed to resolve address'):
      throw new Err.NetworkError(error);

    case error.startsWith('unexpected HTTP status code: 401'): // 401 on Ubuntu
    case error.startsWith('request failed with status code: 401'): // 401 on Windows
    case error.startsWith('Method connect has thrown an error'):
    case error.startsWith(
      'remote credential provider returned an invalid cred type'
    ): // on Ubuntu
    case error.startsWith(
      'Failed to retrieve list of SSH authentication methods'
    ):
    case error.startsWith('too many redirects or authentication replays'):
      throw new Err.HTTPError401AuthorizationRequired(error);

    case error.startsWith('unexpected HTTP status code: 404'): // 404 on Ubuntu
    case error.startsWith('request failed with status code: 404'): // 404 on Windows
      throw new Err.HTTPError404NotFound(error);

    default:
      throw new Err.CannotConnectError(error);
  }
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
 * @throws {@link Err.InvalidGitRemoteError}
 * @throws {@link Err.UnfetchedCommitExistsError}
 * @throws {@link Err.InvalidURLFormatError}
 * @throws {@link Err.NetworkError}
 * @throws {@link Err.HTTPError401AuthorizationRequired}
 * @throws {@link Err.HTTPError404NotFound}
 * @throws {@link Err.HTTPError403Forbidden}
 * @throws {@link Err.CannotConnectError}
 *
 * @throws {@link Err.UnfetchedCommitExistsError} (from validatePushResult())
 * @throws {@link Err.CannotConnectError} (from validatePushResult())
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
export async function push(
  workingDir: string,
  remoteOptions: RemoteOptions,
  remoteName = 'origin',
  localBranch = 'refs/heads/main',
  remoteBranch = 'refs/heads/main',
  logger?: Logger
): Promise<void> {
  logger ??= new Logger({
    name: 'plugin-nodegit',
    minLevel: 'trace',
    displayDateTime: false,
    displayFunctionName: false,
    displayFilePath: 'hidden',
  });

  logger.debug(`remote-nodegit: push: ${remoteOptions.remoteUrl}`);

  const repos = await nodegit.Repository.open(workingDir);
  const remote: nodegit.Remote = await repos
    .getRemote(remoteName)
    .catch((err) => {
      if (/^remote '.+?' does not exist/.test(err.message)) {
        throw new Err.InvalidGitRemoteError(err.message);
      }
      throw err;
    });
  const callbacks = createCredentialCallback(remoteOptions);

  const res = await remote
    .push([`${localBranch}:${remoteBranch}`], {
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
      return err;
    })
    .finally(() => {
      // It leaks memory if not cleanup
      repos.cleanup();
    });

  let error = '';
  if (typeof res !== 'number' && typeof res !== 'undefined') {
    error = res.message;
  }

  // console.warn('connect push error: ' + error);
  switch (true) {
    case typeof res === 'number' || typeof res === 'undefined':
      break;

    case error.startsWith('unsupported URL protocol'):
    case error.startsWith('malformed URL'):
      throw new Err.InvalidURLFormatError(error);

    // NodeGit throws them when network is limited.
    case error.startsWith('failed to send request'):
    case error.startsWith('failed to resolve address'):
      throw new Err.NetworkError(error);

    case error.startsWith('unexpected HTTP status code: 401'): // 401 on Ubuntu
    case error.startsWith('request failed with status code: 401'): // 401 on Windows
    case error.startsWith('Method connect has thrown an error'):
    case error.startsWith(
      'remote credential provider returned an invalid cred type'
    ): // on Ubuntu
    case error.startsWith(
      'Failed to retrieve list of SSH authentication methods'
    ):
    case error.startsWith('too many redirects or authentication replays'):
      throw new Err.HTTPError401AuthorizationRequired(error);

    case error.startsWith('unexpected HTTP status code: 404'): // 404 on Ubuntu
    case error.startsWith('request failed with status code: 404'): // 404 on Windows
      throw new Err.HTTPError404NotFound(error);

    case error.startsWith('unexpected HTTP status code: 403'): // 403 on Ubuntu
    case error.startsWith('request failed with status code: 403'): // 403 on Windows
    case error.startsWith('Error: ERROR: Permission to'): {
      throw new Err.HTTPError403Forbidden(error);
    }

    default:
      throw new Err.CannotConnectError(error);
  }

  await validatePushResult(repos, workingDir, callbacks);
}

/**
 * NodeGit.Remote.push does not throw following error in race condition:
 * 'cannot push because a reference that you are trying to update on the remote contains commits that are not present locally'
 * So check remote changes again.
 *
 * @throws {@link Err.CannotConnectError}
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
      // push() already check errors except network errors.
      // So throw only network errors here.
      throw new Err.CannotConnectError(err.message);
    })
    .finally(() => {
      repos.cleanup();
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

  if (distance.behind && distance.behind > 0) {
    throw new Err.UnfetchedCommitExistsError();
  }
}
