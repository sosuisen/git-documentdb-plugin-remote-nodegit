/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import nodegit from '@sosuisen/nodegit';
import fs from 'fs-extra';
import { Err } from './error';
import {
  ConnectionSettingsGitHub,
  ConnectionSettingsSSH,
  RemoteOptions,
} from './types';

/**
 * Insert credential options for GitHub
 *
 * @throws {@link Err.HttpProtocolRequiredError}
 * @throws {@link Err.UndefinedPersonalAccessTokenError}
 * @throws {@link Err.InvalidRepositoryURLError}
 *
 * @internal
 */
function createCredentialForGitHub(options: RemoteOptions) {
  if (!options.remoteUrl!.match(/^https?:\/\//)) {
    throw new Err.InvalidURLFormatError(
      'http protocol required in createCredentialForGitHub'
    );
  }
  const connection = options.connection as ConnectionSettingsGitHub;
  if (options.syncDirection !== 'pull' && !connection.personalAccessToken) {
    throw new Err.UndefinedPersonalAccessTokenError();
  }
  const urlArray = options.remoteUrl!.replace(/^https?:\/\//, '').split('/');
  // github.com/account_name/repository_name
  if (urlArray.length !== 3) {
    throw new Err.InvalidRepositoryURLError(options.remoteUrl!);
  }
  const owner = urlArray[urlArray.length - 2];
  const credentials = () => {
    return nodegit.Cred.userpassPlaintextNew(
      owner,
      connection.personalAccessToken!
    );
  };
  return credentials;
}

/**
 * Create credential options for SSH
 *
 * @throws Err.InvalidSSHKeyPathError
 *
 * @internal
 */
function createCredentialForSSH(options: RemoteOptions) {
  const connection = options.connection as ConnectionSettingsSSH;
  if (
    connection.privateKeyPath === undefined ||
    !fs.existsSync(connection.privateKeyPath)
  ) {
    throw new Err.InvalidSSHKeyPathError();
  }
  if (
    connection.publicKeyPath === undefined ||
    !fs.existsSync(connection.publicKeyPath)
  ) {
    throw new Err.InvalidSSHKeyPathError();
  }
  connection.passPhrase ??= '';

  const credentials = (url: string, userName: string) => {
    return nodegit.Cred.sshKeyNew(
      userName,
      connection.publicKeyPath,
      connection.privateKeyPath,
      connection.passPhrase!
    );
  };
  return credentials;
}

/**
 * Create credential options
 *
 * @throws {@link Err.HttpProtocolRequiredError} (from createCredentialForGitHub)
 * @throws {@link Err.UndefinedPersonalAccessTokenError} (from createCredentialForGitHub)
 * @throws {@link Err.InvalidRepositoryURLError} (from createCredentialForGitHub)
 * @throws {@link Err.InvalidSSHKeyPathError} (from createCredentialForSSH)
 *
 * @throws {@link Err.InvalidAuthenticationTypeError}
 *
 * @internal
 */
export function createCredential(options: RemoteOptions) {
  options.connection ??= { type: 'none' };
  let cred: any;
  if (options.connection.type === 'github') {
    cred = createCredentialForGitHub(options);
  }
  else if (options.connection.type === 'ssh') {
    cred = createCredentialForSSH(options);
  }
  else if (options.connection.type === 'none') {
    // nop
  }
  else {
    // @ts-ignore
    throw new Err.InvalidAuthenticationTypeError(options.connection.type);
  }

  const callbacks = {
    credentials: cred,
  };

  if (process.platform === 'darwin') {
    // @ts-ignore
    callbacks.certificateCheck = () => 0;
  }
  return callbacks;
}
