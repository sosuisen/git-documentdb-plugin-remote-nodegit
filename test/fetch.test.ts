/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import nodegit from '@sosuisen/nodegit';
import path from 'path';
import fs from 'fs-extra';
import { destroyDBs, removeRemoteRepositories } from './remote_utils';
import { fetch, getOrCreateGitRemote } from '../src/remote-nodegit';
import expect from 'expect';
import { Err } from '../src/error';
import { GitDocumentDB } from 'git-documentdb';

const reposPrefix = 'test_remote_nodegit_fetch___';
const localDir = `./test/database_fetch`;

let idCounter = 0;
const serialId = () => {
  return `${reposPrefix}${idCounter++}`;
};

beforeEach(function () {
  // @ts-ignore
  console.log(`... ${this.currentTest.fullTitle()}`);
});

before(() => {
  fs.removeSync(path.resolve(localDir));
});

after(() => {
  fs.removeSync(path.resolve(localDir));
});

/**
 * Prerequisites
 * 
 * Environment variables:
 *   GITDDB_GITHUB_USER_URL: URL of your GitHub account
 *     e.g.) https://github.com/foo/
 *   GITDDB_PERSONAL_ACCESS_TOKEN: The personal access token of your GitHub account
 * GitHub repositories:
 *   remoteURLBase + 'test-private.git' must be a private repository.
 */
const userHome = process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"] ?? '';

const maybe =
  process.env.GITDDB_GITHUB_USER_URL && process.env.GITDDB_PERSONAL_ACCESS_TOKEN
    ? describe
    : describe.skip;

maybe('<remote-nodegit> fetch', () => {
  const remoteURLBase = process.env.GITDDB_GITHUB_USER_URL?.endsWith('/')
    ? process.env.GITDDB_GITHUB_USER_URL
    : process.env.GITDDB_GITHUB_USER_URL + '/';
  const token = process.env.GITDDB_PERSONAL_ACCESS_TOKEN!;

  before(async () => {
    // Remove remote
    await removeRemoteRepositories(reposPrefix);
  });

 
  it('throws InvalidGitRemoteError', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = 'foo-bar';
    const repos = await nodegit.Repository.open(dbA.workingDir);
    // await getOrCreateGitRemote(repos, remoteUrl, 'origin');

    const err = await fetch(dbA.workingDir, { remoteUrl }, undefined, dbA.logger).catch(err => err);

//    expect(err).toBeInstanceOf(Err.InvalidGitRemoteError);
    expect(err.message).toMatch(/^Invalid Git remote: remote 'origin' does not exist/);

    await destroyDBs([dbA]);
  });

  describe('succeeds', () => {
    it('when connect to public repository with no personal access token', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-public.git';
      const repos = await nodegit.Repository.open(dbA.workingDir);
      await getOrCreateGitRemote(repos, remoteUrl, 'origin');
      
      const res = await fetch(dbA.workingDir, { remoteUrl, connection: { type: 'github' } }, undefined, dbA.logger).catch(err => err);
      expect(res).toBeUndefined();
  
      await destroyDBs([dbA]);
    });

    it('when connect to public repository with valid personal access token', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-public.git';
      const repos = await nodegit.Repository.open(dbA.workingDir);
      await getOrCreateGitRemote(repos, remoteUrl, 'origin');

      const res = await fetch(dbA.workingDir, { remoteUrl, connection: { type: 'github', personalAccessToken: token } }, undefined, dbA.logger).catch(err => err);
      expect(res).toBeUndefined();
  
      await destroyDBs([dbA]);
    });

    it('when connect to private repository with valid personal access token', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-private.git';
      const repos = await nodegit.Repository.open(dbA.workingDir);
      await getOrCreateGitRemote(repos, remoteUrl, 'origin');

      const res = await fetch(dbA.workingDir, { remoteUrl, connection: { type: 'github', personalAccessToken: token } }, undefined, dbA.logger).catch(err => err);
      expect(res).toBeUndefined();
  
      await destroyDBs([dbA]);
    });
  });

  it('throws InvalidURLFormat by fetch when http protocol is missing', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = 'foo-bar';
    const repos = await nodegit.Repository.open(dbA.workingDir);
    await getOrCreateGitRemote(repos, remoteUrl, 'origin');

    const err = await fetch(dbA.workingDir, { remoteUrl }, undefined, dbA.logger).catch(err => err);

    expect(err).toBeInstanceOf(Err.InvalidURLFormatError);
    expect(err.message).toMatch(/^URL format is invalid: unsupported URL protocol/);

    await destroyDBs([dbA]);
  });

  it('throws InvalidURLFormatError by fetch when URL is malformed', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = 'https://foo.example.com:xxxx';
    const repos = await nodegit.Repository.open(dbA.workingDir);
    await getOrCreateGitRemote(repos, remoteUrl, 'origin');

    const err = await fetch(dbA.workingDir, { remoteUrl }, undefined, dbA.logger).catch(err => err);
    expect(err).toBeInstanceOf(Err.InvalidURLFormatError);
    expect(err.message).toMatch(/^URL format is invalid: malformed URL/);

    await destroyDBs([dbA]);
  });

  it('throws ResolvingAddressError when HTTP host is invalid', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = 'https://foo.bar.example.com/gitddb-plugin/sync-test-invalid.git';

    const repos = await nodegit.Repository.open(dbA.workingDir);
    await getOrCreateGitRemote(repos, remoteUrl, 'origin');

    const err = await fetch(dbA.workingDir, { remoteUrl }, undefined, dbA.logger).catch(err => err);
    expect(err).toBeInstanceOf(Err.ResolvingAddressError);
    expect(err.message).toMatch(/^Cannot resolve address: failed to send request/);

    await destroyDBs([dbA]);
  });

  it('throws ResolvingAddressError when SSH host is invalid', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = 'git@foo.example.com:bar/sync-test.git';
    const repos = await nodegit.Repository.open(dbA.workingDir);
    await getOrCreateGitRemote(repos, remoteUrl, 'origin');

    const err = await fetch(dbA.workingDir, {
      remoteUrl,
      connection: {
        type: 'ssh',
        publicKeyPath: path.resolve(userHome, '.ssh/invalid-test.pub'),
        privateKeyPath: path.resolve(userHome, '.ssh/invalid-test'),
        passPhrase: ''
      }
    }, undefined, dbA.logger).catch(err => err);

    expect(err).toBeInstanceOf(Err.ResolvingAddressError);
    expect(err.message).toMatch(/^Cannot resolve address: failed to resolve address/);

    await destroyDBs([dbA]);
  });


  describe('throws HttpError401AuthorizationRequired', () => {
    it('when personal access token does not exist', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();
  
      const remoteUrl = remoteURLBase + 'test-private.git';
      const repos = await nodegit.Repository.open(dbA.workingDir);
      await getOrCreateGitRemote(repos, remoteUrl, 'origin');

      const err = await fetch(dbA.workingDir, { remoteUrl, connection: { type: 'github' } }, undefined, dbA.logger).catch(err => err);
  
      expect(err).toBeInstanceOf(Err.HTTPError401AuthorizationRequired);
      expect(err.message).toMatch(/^HTTP Error: 401 Authorization required: request failed with status code: 401/);

      await destroyDBs([dbA]);
    });

    it('when connection setting not found', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-private.git';
      const repos = await nodegit.Repository.open(dbA.workingDir);
      await getOrCreateGitRemote(repos, remoteUrl, 'origin');

      let err;
      for (let i = 0; i < 3; i++) {
        err = await fetch(dbA.workingDir, { remoteUrl }, undefined, dbA.logger).catch(err => err);
        if (!err.message.startsWith('HTTP Error: 401 Authorization required: too many redirects or authentication replays')) {
          break;
        }
      }
      expect(err).toBeInstanceOf(Err.HTTPError401AuthorizationRequired);
      if (process.platform === 'win32') {
        expect(err.message).toMatch(/^HTTP Error: 401 Authorization required: request failed with status code: 401/);
      }
      else {
        expect(err.message).toMatch(/^HTTP Error: 401 Authorization required: unexpected HTTP status code: 401/);
      }

      await destroyDBs([dbA]);
    });


    it.skip('when XXXX?', async () => {
      // TODO: This will invoke on ubuntu
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-private.git';
      const repos = await nodegit.Repository.open(dbA.workingDir);
      await getOrCreateGitRemote(repos, remoteUrl, 'origin');

      const err = await fetch(dbA.workingDir, { remoteUrl }, undefined, dbA.logger).catch(err => err);
      expect(err).toBeInstanceOf(Err.HTTPError401AuthorizationRequired);
      expect(err.message).toMatch(/^HTTP Error: 401 Authorization required: remote credential provider returned an invalid cred type/);

      await destroyDBs([dbA]);
    });

    it.skip('when invalid SSH key format', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      // TODO: set SSH url for test
      const remoteUrl = 'git@github.com:xxxxxxxxxxxxxxxxxx/sync-test.git';
      const repos = await nodegit.Repository.open(dbA.workingDir);
      await getOrCreateGitRemote(repos, remoteUrl, 'origin');

      const err = await fetch(dbA.workingDir, {
        remoteUrl,
        connection: {
          type: 'ssh',
          publicKeyPath: path.resolve(userHome, '.ssh/invalid-test.pub'),
          privateKeyPath: path.resolve(userHome, '.ssh/invalid-test'),
          passPhrase: ''
        }
      }, undefined, dbA.logger).catch(err => err);

      expect(err).toBeInstanceOf(Err.HTTPError401AuthorizationRequired);
      // TODO: How to invoke this error      
      expect(err.message).toMatch(/^HTTP Error: 401 Authorization required: Failed to retrieve list of SSH authentication methods/);

      await destroyDBs([dbA]);
    });

    it('when invalid personal access token', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();
  
      const remoteUrl = remoteURLBase + 'test-private.git';
      const repos = await nodegit.Repository.open(dbA.workingDir);
      await getOrCreateGitRemote(repos, remoteUrl, 'origin');

      const err = await fetch(dbA.workingDir, { remoteUrl, connection: { type: 'github', personalAccessToken: 'foo-bar' } }, undefined, dbA.logger).catch(err => err);

      expect(err).toBeInstanceOf(Err.HTTPError401AuthorizationRequired);
      expect(err.message).toMatch(/^HTTP Error: 401 Authorization required: too many redirects or authentication replays/);

      await destroyDBs([dbA]);
    });
  
  

    it('when invalid pair of url and SSH auth', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-private.git';
      const repos = await nodegit.Repository.open(dbA.workingDir);
      await getOrCreateGitRemote(repos, remoteUrl, 'origin');

      const err = await fetch(dbA.workingDir, {
        remoteUrl,
        connection: {
          type: 'ssh',
          publicKeyPath: path.resolve(userHome, '.ssh/invalid-test.pub'),
          privateKeyPath: path.resolve(userHome, '.ssh/invalid-test'),
          passPhrase: ''
        }
      }, undefined, dbA.logger).catch(err => err);

      expect(err).toBeInstanceOf(Err.HTTPError401AuthorizationRequired);
      expect(err.message).toMatch(/^HTTP Error: 401 Authorization required: too many redirects or authentication replays/);

      await destroyDBs([dbA]);
    });
  });

  describe('throws HttpError404NotFound', () => {
    it('when valid auth and repository does not exist', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'sync-test-invalid.git';
      const repos = await nodegit.Repository.open(dbA.workingDir);
      await getOrCreateGitRemote(repos, remoteUrl, 'origin');

      const err = await fetch(dbA.workingDir, { remoteUrl, connection: { type: 'github', personalAccessToken: token } }, undefined, dbA.logger).catch(err => err);
      expect(err).toBeInstanceOf(Err.HTTPError404NotFound);
      if (process.platform === 'win32') {
        expect(err.message).toMatch(/^HTTP Error: 404 Not Found: request failed with status code: 404/);
      }
      else {
        expect(err.message).toMatch(/^HTTP Error: 404 Not Found: unexpected HTTP status code: 404/);
      }
  
      await destroyDBs([dbA]);

    });
  });

  describe.skip('throws CannotFetchError', () => {
    // Other cases
  });

  it('throws InvalidURLFormatError by createCredentialForGitHub', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = 'foo-bar';
    const repos = await nodegit.Repository.open(dbA.workingDir);
    await getOrCreateGitRemote(repos, remoteUrl, 'origin');

    const err = await fetch(dbA.workingDir, { remoteUrl, connection: { type: 'github', personalAccessToken: token } }, undefined, dbA.logger).catch(err => err);
    expect(err).toBeInstanceOf(Err.InvalidURLFormatError);
    expect(err.message).toMatch(/^URL format is invalid: http protocol required in createCredentialForGitHub/);

    await destroyDBs([dbA]);
  });

  it('throws InvalidRepositoryURLError', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = remoteURLBase + 'foo/bar/test.git';
    const repos = await nodegit.Repository.open(dbA.workingDir);
    await getOrCreateGitRemote(repos, remoteUrl, 'origin');

    await expect(fetch(dbA.workingDir, { remoteUrl, connection: { type: 'github', personalAccessToken: token } }, undefined, dbA.logger)).rejects.toThrowError(Err.InvalidRepositoryURLError);

    await destroyDBs([dbA]);
  });

  it('throws InvalidSSHKeyPathError', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = 'git@github.com:xxxxxxxxxxxxxxxxxx/sync-test.git';
    const repos = await nodegit.Repository.open(dbA.workingDir);
    await getOrCreateGitRemote(repos, remoteUrl, 'origin');

    await expect(fetch(dbA.workingDir, {
      remoteUrl,
      connection: {
        type: 'ssh',
        publicKeyPath: path.resolve(userHome, 'foo'),
        privateKeyPath: path.resolve(userHome, 'bar'),
        passPhrase: ''
      }
    }, undefined, dbA.logger)).rejects.toThrowError(Err.InvalidSSHKeyPathError);

    await destroyDBs([dbA]);
  });

  it('throws InvalidAuthenticationTypeError', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = remoteURLBase + 'test-private.git';
    const repos = await nodegit.Repository.open(dbA.workingDir);
    await getOrCreateGitRemote(repos, remoteUrl, 'origin');

    // @ts-ignore
    await expect(fetch(dbA.workingDir, { remoteUrl, connection: { type: 'foo' } }, undefined, dbA.logger)).rejects.toThrowError(Err.InvalidAuthenticationTypeError);

    await destroyDBs([dbA]);
  });
});
