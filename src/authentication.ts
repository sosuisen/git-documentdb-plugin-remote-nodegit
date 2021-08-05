/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import fs from 'fs';
// @ts-ignore
import nodegit from '@sosuisen/nodegit';
import {
  InvalidAuthenticationTypeError,
  InvalidRepositoryURLError,
  InvalidSSHKeyPathError,
  InvalidURLFormatError,
} from 'git-documentdb-remote-errors';
import {
  ConnectionSettingsGitHub,
  ConnectionSettingsSSH,
  RemoteOptions,
} from './types';

/**
 * Insert credential options for GitHub
 *
 * @throws {@link InvalidURLFormatError}
 * @throws {@link InvalidRepositoryURLError}
 *
 * @internal
 */
function createCredentialForGitHub(options: RemoteOptions) {
  if (!options.remoteUrl!.match(/^https?:\/\//)) {
    throw new InvalidURLFormatError(
      'http protocol required in createCredentialForGitHub'
    );
  }
  const connection = options.connection as ConnectionSettingsGitHub;
  if (!connection.personalAccessToken) {
    return undefined;
  }
  const urlArray = options.remoteUrl!.replace(/^https?:\/\//, '').split('/');
  // github.com/account_name/repository_name
  if (urlArray.length !== 3) {
    throw new InvalidRepositoryURLError(options.remoteUrl!);
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
 * @throws InvalidSSHKeyPathError
 *
 * @internal
 */
function createCredentialForSSH(options: RemoteOptions) {
  const connection = options.connection as ConnectionSettingsSSH;
  if (
    connection.privateKeyPath === undefined ||
    !fs.existsSync(connection.privateKeyPath)
  ) {
    throw new InvalidSSHKeyPathError();
  }
  if (
    connection.publicKeyPath === undefined ||
    !fs.existsSync(connection.publicKeyPath)
  ) {
    throw new InvalidSSHKeyPathError();
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
 * @throws {@link InvalidAuthenticationTypeError}
 *
 * @throws # Error from createCredentialForGitHub
 * @throws - {@link InvalidURLFormatError}
 * @throws - {@link InvalidRepositoryURLError}
 *
 * @throws # Error from createCredentialForSSH
 * @throws - {@link InvalidSSHKeyPathError}
 *
 * @internal
 */
export function createCredentialCallback(options: RemoteOptions) {
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
    throw new InvalidAuthenticationTypeError(options.connection.type);
  }

  let callbacks;
  if (cred !== undefined) {
    callbacks = {
      credentials: cred,
    };
  }
  else {
    callbacks = new nodegit.RemoteCallbacks();
  }

  if (process.platform === 'darwin') {
    // @ts-ignore
    callbacks.certificateCheck = () => 0;
  }
  return callbacks;
}
