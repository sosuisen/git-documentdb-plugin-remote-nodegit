/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import fs from 'fs';
import nodegit, { RemoteCallbacks } from 'nodegit';
import git from 'isomorphic-git';
import { Logger } from 'tslog';
import {
  CannotConnectError,
  HTTPError401AuthorizationRequired,
  HTTPError403Forbidden,
  HTTPError404NotFound,
  InvalidGitRemoteError,
  InvalidURLFormatError,
  NetworkError,
  UnfetchedCommitExistsError,
} from 'git-documentdb-remote-errors';
import { RemoteOptions } from './types';
import { createCredentialCallback } from './authentication';

const NETWORK_RETRY = 3;
const NETWORK_RETRY_INTERVAL = 1000;

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
 * @throws {@link InvalidURLFormatError}
 * @throws {@link NetworkError}
 * @throws {@link HTTPError401AuthorizationRequired}
 * @throws {@link HTTPError404NotFound}
 * @throws {@link CannotConnectError}
 *
 * @throws {@link HttpProtocolRequiredError} (from createCredentialForGitHub)
 * @throws {@link InvalidRepositoryURLError} (from createCredentialForGitHub)
 * @throws {@link InvalidSSHKeyPathError} (from createCredentialForSSH)
 *
 * @throws {@link InvalidAuthenticationTypeError} (from createCredential)
 */
// eslint-disable-next-line complexity
export async function clone(
  workingDir: string,
  remoteOptions: RemoteOptions,
  remoteName = 'origin',
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

  remoteOptions.retry ??= NETWORK_RETRY;
  remoteOptions.retryInterval ??= NETWORK_RETRY_INTERVAL;

  for (let i = 0; i < remoteOptions.retry! + 1; i++) {
    // eslint-disable-next-line no-await-in-loop
    const res = await nodegit.Clone.clone(
      remoteOptions.remoteUrl!,
      workingDir,
      {
        fetchOpts: {
          callbacks: createCredentialCallback(remoteOptions),
        },
      }
    ).catch((err) => err);

    let error = '';
    if (res instanceof Error) {
      error = res.message;
    }
    else {
      break;
    }

    // if (error !== 'undefined') console.warn('connect fetch error: ' + error);
    switch (true) {
      case error.startsWith('unsupported URL protocol'):
      case error.startsWith('malformed URL'):
        throw new InvalidURLFormatError(error);

      // NodeGit throws them when network is limited.
      case error.startsWith('failed to send request'):
      case error.startsWith('failed to resolve address'):
        if (i >= remoteOptions.retry!) {
          throw new NetworkError(error);
        }
        break;

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
        throw new HTTPError401AuthorizationRequired(error);

      case error.startsWith('unexpected HTTP status code: 404'): // 404 on Ubuntu
      case error.startsWith('request failed with status code: 404'): // 404 on Windows
        throw new HTTPError404NotFound(error);

      default:
        if (i >= remoteOptions.retry!) {
          throw new CannotConnectError(error);
        }
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(remoteOptions.retryInterval!);
  }

  // Add remote
  // (default is 'origin')
  if (remoteName !== 'origin') {
    await git.addRemote({
      fs,
      dir: workingDir,
      remote: 'origin',
      url: remoteOptions.remoteUrl!,
    });
  }
  await git.addRemote({
    fs,
    dir: workingDir,
    remote: remoteName,
    url: remoteOptions.remoteUrl!,
  });
}

/**
 * Check connection by FETCH
 *
 * @throws {@link InvalidGitRemoteError}
 * @throws {@link InvalidURLFormatError}
 * @throws {@link NetworkError}
 * @throws {@link HTTPError401AuthorizationRequired}
 * @throws {@link HTTPError404NotFound}
 * @throws {@link CannotConnectError}
 *
 * @throws {@link HttpProtocolRequiredError} (from createCredentialForGitHub)
 * @throws {@link InvalidRepositoryURLError} (from createCredentialForGitHub)
 * @throws {@link InvalidSSHKeyPathError} (from createCredentialForSSH)
 *
 * @throws {@link InvalidAuthenticationTypeError} (from createCredential)
 *
 * @public
 */
// eslint-disable-next-line complexity
export async function checkFetch(
  workingDir: string,
  remoteOptions: RemoteOptions,
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
  const callbacks = createCredentialCallback(remoteOptions);
  const repos = await nodegit.Repository.open(workingDir);

  const remote: nodegit.Remote = await repos
    .getRemote(remoteName)
    .catch((err) => {
      if (/^remote '.+?' does not exist/.test(err.message)) {
        throw new InvalidGitRemoteError(err.message);
      }
      throw err;
    });

  remoteOptions.retry ??= NETWORK_RETRY;
  remoteOptions.retryInterval ??= NETWORK_RETRY_INTERVAL;

  for (let i = 0; i < remoteOptions.retry! + 1; i++) {
    const error = String(
      // eslint-disable-next-line no-await-in-loop
      await remote
        .connect(nodegit.Enums.DIRECTION.FETCH, callbacks)
        .catch((err) => err)
    );
    // eslint-disable-next-line no-await-in-loop
    await remote.disconnect();

    if (error === 'undefined') {
      break;
    }

    // if (error !== 'undefined') console.warn('connect fetch error: ' + error);
    switch (true) {
      case error.startsWith('Error: unsupported URL protocol'):
      case error.startsWith('Error: malformed URL'):
        throw new InvalidURLFormatError(error);

      // NodeGit throws them when network is limited.
      case error.startsWith('Error: failed to send request'):
      case error.startsWith('Error: failed to resolve address'):
        if (i >= remoteOptions.retry!) {
          throw new NetworkError(error);
        }
        break;

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
        throw new HTTPError401AuthorizationRequired(error);

      case error.startsWith('Error: unexpected HTTP status code: 404'): // 404 on Ubuntu
      case error.startsWith('Error: request failed with status code: 404'): // 404 on Windows
        throw new HTTPError404NotFound(error);

      default:
        if (i >= remoteOptions.retry!) {
          throw new CannotConnectError(error);
        }
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(remoteOptions.retryInterval!);
  }

  return true;
}

/**
 * git fetch
 *
 * @throws {@link InvalidGitRemoteError}
 * @throws {@link InvalidURLFormatError}
 * @throws {@link NetworkError}
 * @throws {@link HTTPError401AuthorizationRequired}
 * @throws {@link HTTPError404NotFound}
 * @throws {@link CannotConnectError}
 *
 * @throws {@link HttpProtocolRequiredError} (from createCredentialForGitHub)
 * @throws {@link InvalidRepositoryURLError} (from createCredentialForGitHub)
 * @throws {@link InvalidSSHKeyPathError} (from createCredentialForSSH)
 *
 * @throws {@link InvalidAuthenticationTypeError} (from createCredential)
 *
 * @public
 */
// eslint-disable-next-line complexity
export async function fetch(
  workingDir: string,
  remoteOptions: RemoteOptions,
  remoteName = 'origin',
  logger?: Logger
): Promise<void> {
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

  remoteOptions.retry ??= NETWORK_RETRY;
  remoteOptions.retryInterval ??= NETWORK_RETRY_INTERVAL;

  for (let i = 0; i < remoteOptions.retry! + 1; i++) {
    // eslint-disable-next-line no-await-in-loop
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
    else {
      break;
    }

    // if (error !== 'undefined') console.warn('connect fetch error: ' + error);
    switch (true) {
      case /^remote '.+?' does not exist/.test(error):
        throw new InvalidGitRemoteError(error);

      case error.startsWith('unsupported URL protocol'):
      case error.startsWith('malformed URL'):
        throw new InvalidURLFormatError(error);

      // NodeGit throws them when network is limited.
      case error.startsWith('failed to send request'):
      case error.startsWith('failed to resolve address'):
        if (i >= remoteOptions.retry!) {
          throw new NetworkError(error);
        }
        break;

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
        throw new HTTPError401AuthorizationRequired(error);

      case error.startsWith('unexpected HTTP status code: 404'): // 404 on Ubuntu
      case error.startsWith('request failed with status code: 404'): // 404 on Windows
        throw new HTTPError404NotFound(error);

      default:
        if (i >= remoteOptions.retry!) {
          throw new CannotConnectError(error);
        }
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(remoteOptions.retryInterval!);
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
 * @throws {@link InvalidGitRemoteError}
 * @throws {@link UnfetchedCommitExistsError}
 * @throws {@link InvalidURLFormatError}
 * @throws {@link NetworkError}
 * @throws {@link HTTPError401AuthorizationRequired}
 * @throws {@link HTTPError404NotFound}
 * @throws {@link HTTPError403Forbidden}
 * @throws {@link CannotConnectError}
 *
 * @throws {@link UnfetchedCommitExistsError} (from validatePushResult())
 * @throws {@link CannotConnectError} (from validatePushResult())
 *
 * @throws {@link HttpProtocolRequiredError} (from createCredentialForGitHub)
 * @throws {@link InvalidRepositoryURLError} (from createCredentialForGitHub)
 * @throws {@link InvalidSSHKeyPathError} (from createCredentialForSSH)
 *
 * @throws {@link InvalidAuthenticationTypeError} (from createCredential)
 *
 * @public
 */
// eslint-disable-next-line complexity
export async function push(
  workingDir: string,
  remoteOptions: RemoteOptions,
  remoteName = 'origin',
  localBranchName = 'main',
  remoteBranchName = 'main',
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
        throw new InvalidGitRemoteError(err.message);
      }
      throw err;
    });
  const callbacks = createCredentialCallback(remoteOptions);

  const localBranch = 'refs/heads/' + localBranchName;
  const remoteBranch = 'refs/heads/' + remoteBranchName;

  remoteOptions.retry ??= NETWORK_RETRY;
  remoteOptions.retryInterval ??= NETWORK_RETRY_INTERVAL;

  for (let i = 0; i < remoteOptions.retry! + 1; i++) {
    // eslint-disable-next-line no-await-in-loop
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
          throw new UnfetchedCommitExistsError();
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
    else {
      break;
    }

    // console.warn('connect push error: ' + error);
    switch (true) {
      case error.startsWith('unsupported URL protocol'):
      case error.startsWith('malformed URL'):
        throw new InvalidURLFormatError(error);

      // NodeGit throws them when network is limited.
      case error.startsWith('failed to send request'):
      case error.startsWith('failed to resolve address'):
        if (i >= remoteOptions.retry!) {
          throw new NetworkError(error);
        }
        break;

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
        throw new HTTPError401AuthorizationRequired(error);

      case error.startsWith('unexpected HTTP status code: 404'): // 404 on Ubuntu
      case error.startsWith('request failed with status code: 404'): // 404 on Windows
        throw new HTTPError404NotFound(error);

      case error.startsWith('unexpected HTTP status code: 403'): // 403 on Ubuntu
      case error.startsWith('request failed with status code: 403'): // 403 on Windows
      case error.startsWith('Error: ERROR: Permission to'): {
        throw new HTTPError403Forbidden(error);
      }

      default:
        if (i >= remoteOptions.retry!) {
          throw new CannotConnectError(error);
        }
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(remoteOptions.retryInterval!);
  }

  await validatePushResult(
    repos,
    remoteOptions,
    workingDir,
    remoteName,
    remoteBranchName,
    callbacks
  );
}

/**
 * NodeGit.Remote.push does not throw following error in race condition:
 * 'cannot push because a reference that you are trying to update on the remote contains commits that are not present locally'
 * So check remote changes again.
 *
 * @throws {@link CannotConnectError}
 * @throws {@link UnfetchedCommitExistsError}
 *
 * @internal
 */
async function validatePushResult(
  repos: nodegit.Repository,
  remoteOptions: RemoteOptions,
  workingDir: string,
  remoteName: string,
  remoteBranchName: string,
  callbacks: RemoteCallbacks
): Promise<void> {
  for (let i = 0; i < remoteOptions.retry! + 1; i++) {
    // eslint-disable-next-line no-await-in-loop
    const error = await repos
      .fetch(remoteName, {
        callbacks,
      })
      .catch((err) => {
        // push() already check errors except network errors.
        // So throw only network errors here.
        if (i >= remoteOptions.retry!) {
          throw new CannotConnectError(err.message);
        }
        else return err;
      })
      .finally(() => {
        repos.cleanup();
      });
    if (!(error instanceof Error)) {
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(remoteOptions.retryInterval!);
  }

  // Use isomorphic-git to avoid memory leak
  const localCommitOid = await git.resolveRef({
    fs,
    dir: workingDir,
    ref: 'HEAD',
  });
  const remoteCommitOid = await git.resolveRef({
    fs,
    dir: workingDir,
    ref: `refs/remotes/${remoteName}/${remoteBranchName}`,
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
    throw new UnfetchedCommitExistsError();
  }
}
