/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import expect from 'expect';
import { Err, GitDocumentDB, RemoteOptions, RemoteRepository, Sync } from 'git-documentdb';
import fs from 'fs-extra';
import path from 'path';
import { createRemoteRepository, destroyDBs, removeRemoteRepositories } from './remote_utils';

const reposPrefix = 'test_3way_merge___';
const localDir = `./test/database_3way_merge`;

let idCounter = 0;
const serialId = () => {
  return `${reposPrefix}${idCounter++}`;
};

beforeEach(function () {
  // @ts-ignore
  console.log(`... ${this.currentTest.fullTitle()}`);
});

before(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  GitDocumentDB.plugin(require('git-documentdb-plugin-remote-nodegit'));

  fs.removeSync(path.resolve(localDir));
});

after(() => {
  // It may throw error due to memory leak of getCommitLogs()
  // fs.removeSync(path.resolve(localDir));
});

// This test needs environment variables:
//  - GITDDB_GITHUB_USER_URL: URL of your GitHub account
// e.g.) https://github.com/foo/
//  - GITDDB_PERSONAL_ACCESS_TOKEN: A personal access token of your GitHub account
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
    await removeRemoteRepositories(reposPrefix);
  });


  describe(': _getOrCreateGitRemote()', () => {
    it('returns "add" when origin is undefined', async () => {
      const remoteURL = remoteURLBase + serialId();
      const dbName = serialId();
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
      expect(result).toBe('add');

      destroyDBs([gitDDB]);
    });

    it('returns "change" when another origin exists', async () => {
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
      await remoteRepos['_getOrCreateGitRemote'](gitDDB.repository()!, remoteURL);

      const remoteURL2 = remoteURLBase + serialId();
      // eslint-disable-next-line dot-notation
      const [result, remote] = await remoteRepos['_getOrCreateGitRemote'](
        gitDDB.repository()!,
        remoteURL2
      );
      expect(result).toBe('change');

      destroyDBs([gitDDB]);
    });

    it('returns "exist" when the same origin exists', async () => {
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
      await remoteRepos['_getOrCreateGitRemote'](gitDDB.repository()!, remoteURL);

      const remoteURL2 = remoteURLBase + serialId();
      // eslint-disable-next-line dot-notation
      const [result, remote] = await remoteRepos['_getOrCreateGitRemote'](
        gitDDB.repository()!,
        remoteURL
      );
      expect(result).toBe('exist');

      destroyDBs([gitDDB]);
    });
  });

  describe(': _checkFetch()', () => {
    it('returns exist', async () => {
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
      await expect(remoteRepos['_checkFetch'](remote, cred)).resolves.toBe('exist');

      destroyDBs([gitDDB]);
    });

    it('throws InvalidURLError when a url starts with git@', async () => {
      const remoteURL = 'git@github.com/xyz/' + serialId();
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
        remoteUrl: remoteURLBase + serialId(),
        connection: {
          type: 'github',
          personalAccessToken: token,
        },
      });

      // eslint-disable-next-line dot-notation
      await expect(remoteRepos['_checkFetch'](remote, cred)).rejects.toThrowError(
        Err.InvalidURLError
      );

      destroyDBs([gitDDB]);
    });

    it('throws InvalidURLError when a url starts invalid scheme', async () => {
      const remoteURL = 'xttp://github.com/xyz/' + serialId();
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
        remoteUrl: remoteURLBase + serialId(),
        connection: {
          type: 'github',
          personalAccessToken: token,
        },
      });

      // eslint-disable-next-line dot-notation
      await expect(remoteRepos['_checkFetch'](remote, cred)).rejects.toThrowError(
        Err.InvalidURLError
      );

      destroyDBs([gitDDB]);
    });

    it('throws InvalidURLError when a host name is invalid', async () => {
      const remoteURL = 'http://github.test/xyz/' + serialId();
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
        remoteUrl: remoteURLBase + serialId(),
        connection: {
          type: 'github',
          personalAccessToken: token,
        },
      });

      // eslint-disable-next-line dot-notation
      await expect(remoteRepos['_checkFetch'](remote, cred)).rejects.toThrowError(
        Err.InvalidURLError
      );

      destroyDBs([gitDDB]);
    });

    it('throws RepositoryNotFoundError when a remote repository does not exist', async () => {
      const remoteURL = 'http://github.com/xyz/' + monoId();
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
      await expect(remoteRepos['_checkFetch'](remote, cred)).rejects.toThrowError(
        Err.RemoteRepositoryNotFoundError
      );

      destroyDBs([gitDDB]);
    });

    it('throws FetchPermissionDeniedError when ssh key pair does not exist', async () => {
      const remoteURL = 'http://github.com/xyz/' + monoId();
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
          type: 'ssh',
          privateKeyPath: '/not/exist',
          publicKeyPath: '/not/exist',
        },
      });

      // eslint-disable-next-line dot-notation
      await expect(remoteRepos['_checkFetch'](remote, cred)).rejects.toThrowError(
        Err.FetchPermissionDeniedError
      );

      destroyDBs([gitDDB]);
    });

    it.skip('throws Error when private repository');

    it.skip('throws FetchPermissionError when invalid ssh key pair exists');
  });

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
  });

  describe(': connect()', () => {
    it(`returns ['add', 'create'] when both local and GitHub repository do not exist`, async () => {
      const remoteURL = remoteURLBase + serialId();
      const dbName = monoId();
      const gitDDB = new GitDocumentDB({
        dbName,
        localDir,
      });
      await gitDDB.open();

      const remoteOptions: RemoteOptions = {
        remoteUrl: remoteURL,
        connection: {
          type: 'github',
          personalAccessToken: token,
        },
      };
      // @ts-ignore
      const remoteRepos = new RemoteRepository(remoteOptions);
      const cred = createCredential(remoteOptions);
      const onlyFetch = true;
      await expect(
        remoteRepos.connect(gitDDB.repository()!, cred, onlyFetch)
      ).resolves.toEqual(['add', 'create']);

      destroyDBs([gitDDB]);
    });

    it(`returns ['add', 'exist'] when a local repository does not exist and a GitHub repository exists`, async () => {
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
      const onlyFetch = true;
      await expect(
        remoteRepos.connect(gitDDB.repository()!, cred, onlyFetch)
      ).resolves.toEqual(['add', 'exist']);

      destroyDBs([gitDDB]);
    });

    it(`throws FetchConnectionFailedError when remote url is invalid`, async () => {
      const readonlyURL = 'https://github.test/invalid/host';
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
      const onlyFetch = true;
      await expect(
        remoteRepos.connect(gitDDB.repository()!, cred, onlyFetch)
      ).rejects.toThrowError(Err.FetchConnectionFailedError);

      destroyDBs([gitDDB]);
    });

    it(`throws CannotCreateRemoteRepositoryError when a personal access token is for another account`, async () => {
      const readonlyURL = 'https://github.com/sosuisen/' + serialId();
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
          personalAccessToken: token, // It is valid but for another account
        },
      };
      // @ts-ignore
      const remoteRepos = new RemoteRepository(remoteOptions);
      const cred = createCredential(remoteOptions);
      const onlyFetch = true;
      await expect(
        remoteRepos.connect(gitDDB.repository()!, cred, onlyFetch)
      ).rejects.toThrowError(Err.CannotCreateRemoteRepositoryError);

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

    it('throws HttpProtocolRequiredError when remoteURL starts with ssh://', async () => {
      const dbName = serialId();
      const remoteURL = 'ssh://github.com/';
      const gitDDB: GitDocumentDB = new GitDocumentDB({
        dbName,
        localDir,
      });
      await gitDDB.open();
      const options: RemoteOptions = {
        remoteUrl: remoteURL,
        connection: {
          type: 'github',
          personalAccessToken: 'foobar',
        },
      };
      const sync = new Sync(gitDDB, options);
      await expect(sync.init()).rejects.toThrowError(Err.HttpProtocolRequiredError);
      await gitDDB.destroy();
    });
  
    it('throws UndefinedPersonalAccessTokenError', async () => {
      const dbName = serialId();
      const remoteURL = remoteURLBase + serialId();
      const gitDDB: GitDocumentDB = new GitDocumentDB({
        dbName,
        localDir,
      });
      await gitDDB.open();
      const options: RemoteOptions = {
        remoteUrl: remoteURL,
        connection: {
          type: 'github',
          personalAccessToken: '',
        },
      };
      expect(() => new Sync(gitDDB, options)).toThrowError(
        Err.UndefinedPersonalAccessTokenError
      );
      await gitDDB.destroy();
    });
  
    it('does not throw UndefinedPersonalAccessTokenError when syncDirections is "pull" ', async () => {
      const dbName = serialId();
      const remoteURL = remoteURLBase + serialId();
      const gitDDB: GitDocumentDB = new GitDocumentDB({
        dbName,
        localDir,
      });
      await gitDDB.open();
      const options: RemoteOptions = {
        remoteUrl: remoteURL,
        syncDirection: 'pull',
        connection: {
          type: 'github',
          personalAccessToken: '',
        },
      };
      expect(() => new Sync(gitDDB, options)).not.toThrowError(
        Err.UndefinedPersonalAccessTokenError
      );
      await gitDDB.destroy();
    });

    
  it('throws InvalidRepositoryURLError when url does not show a repository.', async () => {
    const dbName = serialId();
    const remoteURL = 'https://github.com/';
    const gitDDB: GitDocumentDB = new GitDocumentDB({
      dbName,
      localDir,
    });
    await gitDDB.open();
    const options: RemoteOptions = {
      remoteUrl: remoteURL,
      connection: {
        type: 'github',
        personalAccessToken: 'foobar',
      },
    };
    expect(() => new Sync(gitDDB, options)).toThrowError(Err.InvalidRepositoryURLError);
    await gitDDB.destroy();
  });
  });