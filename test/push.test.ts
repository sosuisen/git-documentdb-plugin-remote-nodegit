/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import path from 'path';
import fs from 'fs-extra';
import { destroyDBs, removeRemoteRepositories } from './remote_utils';
import { checkFetch } from '../src/remote-nodegit';
import expect from 'expect';
import { Err } from '../src/error';
import { GitDocumentDB } from 'git-documentdb';

const reposPrefix = 'test_remote_nodegit_check_fetch___';
const localDir = `./test/database_check_fetch`;

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

maybe('<remote-nodegit>', () => {
  const remoteURLBase = process.env.GITDDB_GITHUB_USER_URL?.endsWith('/')
    ? process.env.GITDDB_GITHUB_USER_URL
    : process.env.GITDDB_GITHUB_USER_URL + '/';
  const token = process.env.GITDDB_PERSONAL_ACCESS_TOKEN!;

  before(async () => {
    // Remove remote
    await removeRemoteRepositories(reposPrefix);
  });

  describe('throws HttpError403Forbidden', () => {
    it.only('when access repository of another account with your account', async () => {
      const dbA: GitDocumentDB = new GitDocumentDB({
        dbName: serialId(),
        localDir,
      });
      await dbA.open();

      //const remoteUrl = privateRepositoryOfAnotherUser;
      const remoteUrl = 'https://github.com/sosuisen/git-documentdb.git';
      console.log(remoteUrl);
      const err = await checkFetch(dbA.workingDir, { remoteUrl, connection: { type: 'github', personalAccessToken: token } }, dbA.logger).catch(err => err);
      console.log(err);
      //        expect(err).toBeInstanceOf(Err.HTTPError403Forbidden);
      expect(err.message).toMatch(/^HTTP Error: 401 Authorization required: Error: request failed with status code: 401/);

      await destroyDBs([dbA]);
    });
  });
});

/*
describe(': _checkPush()', () => {
  it('returns ok', async () => {
    const remoteURL = remoteURLBase + serialId();
    const dbName = monoId();
    const gitDDB = new GitDocumentDB({
      dbName,
      localDir,
    });
    await gitDDB.open();
    const remoteRepos = new RemoteRepository({
      remoteUrl: remoteURL,
    });
    // You can test private members by array access.
    // eslint-disable-next-line dot-notation
    const [result, remote] = await remoteRepos['_getOrCreateGitRemote'](
      gitDDB.repository()!,
      remoteURL
    );
    await createRemoteRepository(remoteURL);
    const cred = createCredential({
      remoteUrl: remoteURL,
      connection: {
        type: 'github',
        personalAccessToken: token,
      },
    });
    // eslint-disable-next-line dot-notation
    await expect(remoteRepos['_checkPush'](remote, cred)).resolves.toBe('ok');

    destroyDBs([gitDDB]);
  });

  it('throws PushPermissionDeniedError when personalAccessToken is invalid', async () => {
    const remoteURL = remoteURLBase + serialId();
    const dbName = monoId();
    const gitDDB = new GitDocumentDB({
      dbName,
      localDir,
    });
    await gitDDB.open();
    const remoteRepos = new RemoteRepository({
      remoteUrl: remoteURL,
    });
    // You can test private members by array access.
    // eslint-disable-next-line dot-notation
    const [result, remote] = await remoteRepos['_getOrCreateGitRemote'](
      gitDDB.repository()!,
      remoteURL
    );
    await new RemoteRepository({
      remoteUrl: remoteURL,
      connection: {
        type: 'github',
        personalAccessToken: token,
      },
    }).create();

    const cred = createCredential({
      remoteUrl: remoteURL,
      connection: {
        type: 'github',
        personalAccessToken: token + '_invalid',
      },
    });
    // eslint-disable-next-line dot-notation
    const error = await remoteRepos['_checkPush'](remote, cred).catch(err => err);
    if (error instanceof Err.PushPermissionDeniedError) {
      // Notice that it sometimes throw Err.RemoteRepositoryNotFoundError
    }
    else {
      expect(error).toBeInstanceOf(Err.RemoteRepositoryNotFoundError);
    }

    destroyDBs([gitDDB]);
  });

  it("throws RemoteRepositoryNotFoundError when try to push to others' repository", async () => {
    const remoteURL = 'https://github.com/sosuisen/git-documentdb';
    const dbName = monoId();
    const gitDDB = new GitDocumentDB({
      dbName,
      localDir,
    });
    await gitDDB.open();
    const remoteRepos = new RemoteRepository({
      remoteUrl: remoteURL,
    });
    // You can test private members by array access.
    // eslint-disable-next-line dot-notation
    const [result, remote] = await remoteRepos['_getOrCreateGitRemote'](
      gitDDB.repository()!,
      remoteURL
    );
    const cred = createCredential({
      remoteUrl: remoteURL,
      connection: {
        type: 'github',
        personalAccessToken: token,
      },
    });
    // eslint-disable-next-line dot-notation
    await expect(remoteRepos['_checkPush'](remote, cred)).rejects.toThrowError(
      Err.RemoteRepositoryNotFoundError
    );

    destroyDBs([gitDDB]);
  });

      it(`to a read only repository throws PushConnectionFailedError when onlyFetch is false`, async () => {
      const readonlyURL = 'https://github.com/sosuisen/git-documentdb';
      const dbName = monoId();
      const gitDDB = new GitDocumentDB({
        dbName,
        localDir,
      });
      await gitDDB.open();

      const remoteOptions: RemoteOptions = {
        remoteUrl: readonlyURL,
        connection: {
          type: 'github',
          personalAccessToken: token,
        },
      };
      // @ts-ignore
      const remoteRepos = new RemoteRepository(remoteOptions);
      const cred = createCredential(remoteOptions);
      const onlyFetch = false;
      await expect(
        remoteRepos.connect(gitDDB.repository()!, cred, onlyFetch)
      ).rejects.toThrowError(Err.PushConnectionFailedError);

      destroyDBs([gitDDB]);
    });
});
*/