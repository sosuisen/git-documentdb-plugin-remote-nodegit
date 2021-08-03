/* eslint-disable @typescript-eslint/naming-convention */
/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import nodegit from 'nodegit';
import fs from 'fs-extra';
import expect from 'expect';
import {
  HTTPError401AuthorizationRequired,
  HTTPError404NotFound,
  InvalidAuthenticationTypeError,
  InvalidRepositoryURLError,
  InvalidSSHKeyPathError,
  InvalidURLFormatError,
  NetworkError,
} from 'git-documentdb-remote-errors';
import { GitDocumentDB } from 'git-documentdb';
import sinon from 'sinon';
import { checkFetch } from '../src/remote-nodegit';
import {
  createGitRemote,
  destroyDBs,
  removeRemoteRepositories,
} from './remote_utils';

const reposPrefix = 'test_remote_nodegit_check_fetch___';
const localDir = `./test/database_check_fetch`;

let idCounter = 0;
const serialId = () => {
  return `${reposPrefix}${idCounter++}`;
};

// Use sandbox to restore stub and spy in parallel mocha tests
let sandbox: sinon.SinonSandbox;
beforeEach(function () {
  sandbox = sinon.createSandbox();
  // @ts-ignore
  console.log(`... ${this.currentTest.fullTitle()}`);
});

afterEach(function () {
  sandbox.restore();
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
 * SSH keys
 *   userHome/.ssh/invalid-test.pub: invalid public key
 *   userHome/.ssh/invalid-test: invalid private key
 */
const userHome =
  process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'] ?? '';

const maybe =
  process.env.GITDDB_GITHUB_USER_URL && process.env.GITDDB_PERSONAL_ACCESS_TOKEN
    ? describe
    : describe.skip;

maybe('<remote-nodegit> checkFetch', () => {
  const remoteURLBase = process.env.GITDDB_GITHUB_USER_URL?.endsWith('/')
    ? process.env.GITDDB_GITHUB_USER_URL
    : process.env.GITDDB_GITHUB_USER_URL + '/';
  const token = process.env.GITDDB_PERSONAL_ACCESS_TOKEN!;

  before(async () => {
    // Remove remote
    await removeRemoteRepositories(reposPrefix);
  });

  describe('returns true', () => {
    it('when connect to public repository with no personal access token', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-public.git';
      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const res = await checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: { type: 'github' },
      }).catch((error) => error);
      expect(res).not.toBeInstanceOf(Error);

      await destroyDBs([dbA]);
    });

    it('when connect to public repository with valid personal access token', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-public.git';
      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const res = await checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: { type: 'github', personalAccessToken: token },
      }).catch((error) => error);
      expect(res).not.toBeInstanceOf(Error);

      await destroyDBs([dbA]);
    });

    it('when connect to private repository with valid personal access token', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-private.git';
      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const res = await checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: { type: 'github', personalAccessToken: token },
      }).catch((error) => error);
      expect(res).not.toBeInstanceOf(Error);

      await destroyDBs([dbA]);
    });

    it('after retries', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-private.git';
      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');

      let counter = 0;
      const stubOpen = sandbox.stub(nodegit.Repository, 'open');
      // Create fake Repository.open() that returns fake Remote by calling getRemote()
      stubOpen.callsFake(async function (dir) {
        const repos = await stubOpen.wrappedMethod(dir); // Call original nodegit.Repository.open();
        // @ts-ignore
        repos.getRemote = () => {
          return Promise.resolve({
            connect: () => {
              if (counter < 3) {
                counter++;
                return Promise.reject(new Error('failed to send request'));
              }
              counter++;
              return Promise.resolve(undefined);
            },
            disconnect: () => {},
          });
        };
        return repos;
      });

      const res = await checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: { type: 'github', personalAccessToken: token },
      }).catch((error) => error);
      expect(res).not.toBeInstanceOf(Error);

      expect(counter).toBe(4);

      await destroyDBs([dbA]);
    });
  });

  it('throws NetworkError after retries', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = remoteURLBase + 'test-private.git';
    await createGitRemote(dbA.workingDir, remoteUrl, 'origin');

    let counter = 0;
    const stubOpen = sandbox.stub(nodegit.Repository, 'open');
    // Create fake Repository.open() that returns fake Remote by calling getRemote()
    stubOpen.callsFake(async function (dir) {
      const repos = await stubOpen.wrappedMethod(dir); // Call original nodegit.Repository.open();
      // @ts-ignore
      repos.getRemote = () => {
        return Promise.resolve({
          connect: () => {
            counter++;
            return Promise.reject(new Error('failed to send request'));
          },
          disconnect: () => {},
        });
      };
      return repos;
    });

    const res = await checkFetch(dbA.workingDir, {
      remoteUrl,
      connection: { type: 'github', personalAccessToken: token },
    }).catch((error) => error);
    expect(res).toBeInstanceOf(NetworkError);

    expect(counter).toBe(4);

    await destroyDBs([dbA]);
  });

  it('throws InvalidURLFormat by checkFetch when http protocol is missing', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();
    const remoteUrl = 'foo-bar';
    await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
    const err = await checkFetch(dbA.workingDir, { remoteUrl }).catch(
      (error) => error
    );
    expect(err).toBeInstanceOf(InvalidURLFormatError);
    expect(err.message).toMatch(
      /^URL format is invalid: Error: unsupported URL protocol/
    );

    await destroyDBs([dbA]);
  });

  it('throws InvalidURLFormatError by checkFetch when URL is malformed', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();
    const remoteUrl = 'https://foo.example.com:xxxx';
    await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
    const err = await checkFetch(dbA.workingDir, { remoteUrl }).catch(
      (error) => error
    );
    expect(err).toBeInstanceOf(InvalidURLFormatError);
    expect(err.message).toMatch(/^URL format is invalid: Error: malformed URL/);

    await destroyDBs([dbA]);
  });

  describe('throws NetworkError', () => {
    it('when HTTP host is invalid', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl =
        'https://foo.bar.example.com/gitddb-plugin/sync-test-invalid.git';
      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const err = await checkFetch(dbA.workingDir, { remoteUrl }).catch(
        (error) => error
      );
      expect(err).toBeInstanceOf(NetworkError);
      expect(err.message).toMatch(
        /^Network error: Error: failed to send request/
      );

      await destroyDBs([dbA]);
    });

    it('when IP address is invalid', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = 'https://127.0.0.1/gitddb-plugin/sync-test-invalid.git';
      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const err = await checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: {
          type: 'github',
        },
      }).catch((error) => error);
      expect(err).toBeInstanceOf(NetworkError);
      expect(err.message).toMatch(
        /^Network error: Error: failed to send request/
      );

      await destroyDBs([dbA]);
    });

    it('when SSH host is invalid', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = 'git@foo.example.com:bar/sync-test.git';
      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const err = await checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: {
          type: 'ssh',
          publicKeyPath: path.resolve(userHome, '.ssh/invalid-test.pub'),
          privateKeyPath: path.resolve(userHome, '.ssh/invalid-test'),
          passPhrase: '',
        },
      }).catch((error) => error);

      expect(err).toBeInstanceOf(NetworkError);
      expect(err.message).toMatch(
        /^Network error: Error: failed to resolve address/
      );

      await destroyDBs([dbA]);
    });
  });

  describe('throws HttpError401AuthorizationRequired', () => {
    it('when personal access token does not exist', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-private.git';
      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const err = await checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: { type: 'github' },
      }).catch((error) => error);

      expect(err).toBeInstanceOf(HTTPError401AuthorizationRequired);
      expect(err.message).toMatch(
        /^HTTP Error: 401 Authorization required: Error: request failed with status code: 401/
      );

      await destroyDBs([dbA]);
    });

    it('when connection setting not found', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-private.git';

      let err;
      for (let i = 0; i < 3; i++) {
        // eslint-disable-next-line no-await-in-loop
        await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
        // eslint-disable-next-line no-await-in-loop
        err = await checkFetch(dbA.workingDir, { remoteUrl }).catch(
          (error) => error
        );
        if (
          !err.message.startsWith(
            'HTTP Error: 401 Authorization required: Error: too many redirects or authentication replays'
          )
        ) {
          break;
        }
      }
      expect(err).toBeInstanceOf(HTTPError401AuthorizationRequired);
      if (process.platform === 'win32') {
        expect(err.message).toMatch(
          /^HTTP Error: 401 Authorization required: Error: request failed with status code: 401/
        );
      }
      else {
        expect(err.message).toMatch(
          /^HTTP Error: 401 Authorization required: Error: unexpected HTTP status code: 401/
        );
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
      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const err = await checkFetch(dbA.workingDir, { remoteUrl }).catch(
        (error) => error
      );
      expect(err).toBeInstanceOf(HTTPError401AuthorizationRequired);
      expect(err.message).toMatch(
        /^HTTP Error: 401 Authorization required: Error: remote credential provider returned an invalid cred type/
      );

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

      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const err = await checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: {
          type: 'ssh',
          publicKeyPath: path.resolve(userHome, '.ssh/invalid-test.pub'),
          privateKeyPath: path.resolve(userHome, '.ssh/invalid-test'),
          passPhrase: '',
        },
      }).catch((error) => error);

      expect(err).toBeInstanceOf(HTTPError401AuthorizationRequired);
      // TODO: How to invoke this error
      expect(err.message).toMatch(
        /^HTTP Error: 401 Authorization required: Failed to retrieve list of SSH authentication methods/
      );

      await destroyDBs([dbA]);
    });

    it('when invalid personal access token', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-private.git';
      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const err = await checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: { type: 'github', personalAccessToken: 'foo-bar' },
      }).catch((error) => error);

      expect(err).toBeInstanceOf(HTTPError401AuthorizationRequired);
      expect(err.message).toMatch(
        /^HTTP Error: 401 Authorization required: Error: too many redirects or authentication replays/
      );

      await destroyDBs([dbA]);
    });

    it('when invalid pair of url and SSH auth', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      const remoteUrl = remoteURLBase + 'test-private.git';

      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const err = await checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: {
          type: 'ssh',
          publicKeyPath: path.resolve(userHome, '.ssh/invalid-test.pub'),
          privateKeyPath: path.resolve(userHome, '.ssh/invalid-test'),
          passPhrase: '',
        },
      }).catch((error) => error);

      expect(err).toBeInstanceOf(HTTPError401AuthorizationRequired);
      expect(err.message).toMatch(
        /^HTTP Error: 401 Authorization required: Error: too many redirects or authentication replays/
      );

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
      await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
      const err = await checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: { type: 'github', personalAccessToken: token },
      }).catch((error) => error);
      expect(err).toBeInstanceOf(HTTPError404NotFound);
      if (process.platform === 'win32') {
        expect(err.message).toMatch(
          /^HTTP Error: 404 Not Found: Error: request failed with status code: 404/
        );
      }
      else {
        expect(err.message).toMatch(
          /^HTTP Error: 404 Not Found: unexpected HTTP status code: 404/
        );
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
    await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
    const err = await checkFetch(dbA.workingDir, {
      remoteUrl,
      connection: { type: 'github', personalAccessToken: token },
    }).catch((error) => error);
    expect(err).toBeInstanceOf(InvalidURLFormatError);
    expect(err.message).toMatch(
      /^URL format is invalid: http protocol required in createCredentialForGitHub/
    );

    await destroyDBs([dbA]);
  });

  it('throws InvalidRepositoryURLError', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = remoteURLBase + 'foo/bar/test.git';
    await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
    await expect(
      checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: { type: 'github', personalAccessToken: token },
      })
    ).rejects.toThrowError(InvalidRepositoryURLError);

    await destroyDBs([dbA]);
  });

  it('throws InvalidSSHKeyPathError', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = 'git@github.com:xxxxxxxxxxxxxxxxxx/sync-test.git';
    await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
    await expect(
      checkFetch(dbA.workingDir, {
        remoteUrl,
        connection: {
          type: 'ssh',
          publicKeyPath: path.resolve(userHome, 'foo'),
          privateKeyPath: path.resolve(userHome, 'bar'),
          passPhrase: '',
        },
      })
    ).rejects.toThrowError(InvalidSSHKeyPathError);

    await destroyDBs([dbA]);
  });

  it('throws InvalidAuthenticationTypeError', async () => {
    const dbA: GitDocumentDB = new GitDocumentDB({
      dbName: serialId(),
      localDir,
    });
    await dbA.open();

    const remoteUrl = remoteURLBase + 'test-private.git';
    await createGitRemote(dbA.workingDir, remoteUrl, 'origin');
    await expect(
      // @ts-ignore
      checkFetch(dbA.workingDir, { remoteUrl, connection: { type: 'foo' } })
    ).rejects.toThrowError(InvalidAuthenticationTypeError);

    await destroyDBs([dbA]);
  });

  describe('throws CannotConnectError', () => {
    // NetworkError is thrown when network is not connected.
    // CannotConnectError will be thrown when other unexpected cases.
  });
});
