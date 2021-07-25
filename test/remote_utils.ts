/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */
 import { Octokit } from '@octokit/rest';
 import { GitDocumentDB, RemoteOptions, Schema, SyncInterface, FILE_REMOVE_TIMEOUT, RemoteRepository } from 'git-documentdb';
 import sinon from 'sinon';

 const token = process.env.GITDDB_PERSONAL_ACCESS_TOKEN!;

export async function createDatabase (
  remoteURLBase: string,
  localDir: string,
  serialId: () => string,
  options?: RemoteOptions,
  schema?: Schema
): Promise<[GitDocumentDB, SyncInterface]> {
  const remoteURL = remoteURLBase + serialId();

  const dbNameA = serialId();

  const dbA: GitDocumentDB = new GitDocumentDB({
    dbName: dbNameA,
    localDir,
    schema,
  });
  options ??= {
    remoteUrl: remoteURL,
    connection: { type: 'github', personalAccessToken: token },
    includeCommits: true,
  };
  options.remoteUrl ??= remoteURL;
  options.includeCommits ??= true;

  await dbA.open();
  await dbA.sync(options);
  const remoteA = dbA.getSync(remoteURL);

  return [dbA, remoteA];
}

export async function createClonedDatabases (
  remoteURLBase: string,
  localDir: string,
  serialId: () => string,
  options?: RemoteOptions,
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
): Promise<[GitDocumentDB, GitDocumentDB, SyncInterface, SyncInterface]> {
  const remoteURL = remoteURLBase + serialId();

  const dbNameA = serialId();

  const dbA: GitDocumentDB = new GitDocumentDB({
    dbName: dbNameA,
    localDir,
    logLevel: logLevel ?? 'info',
  });
  options ??= {
    remoteUrl: remoteURL,
    connection: { type: 'github', personalAccessToken: token },
    includeCommits: true,
  };
  options.remoteUrl ??= remoteURL;
  options.connection ??= { type: 'github', personalAccessToken: token };
  options.includeCommits ??= true;

  await dbA.open();
  await dbA.sync(options);

  const dbNameB = serialId();
  const dbB: GitDocumentDB = new GitDocumentDB({
    dbName: dbNameB,
    localDir,
    logLevel: logLevel ?? 'info',
  });
  // Clone dbA
  await dbB.open();
  await dbB.sync(options);

  const syncA = dbA.getSync(remoteURL);
  const syncB = dbB.getSync(remoteURL);

  return [dbA, dbB, syncA, syncB];
}

export const createRemoteRepository = async (remoteURL: string) => {
  await new RemoteRepository({
    remoteUrl: remoteURL,
    connection: {
      type: 'github',
      personalAccessToken: token,
    },
  })
    .create()
    .catch(err => {
      console.debug('Cannot create: ' + remoteURL);
      console.debug(err);
    });
};
/*
export const destroyRemoteRepository = async (remoteURL: string) => {
  await new RemoteRepository({
    remoteUrl: remoteURL,
    connection: {
      type: 'github',
      personalAccessToken: token,
    },
  })
    .destroy()
    .catch(err => {
      console.debug('Cannot delete: ' + remoteURL);
      console.debug(err);
    });
};
*/

export async function removeRemoteRepositories (reposPrefix: string) {
  // Remove test repositories on remote
  // console.log(' Removing remote repositories..');
  const octokit = new Octokit({
    auth: token,
  });

  const len = 0;
  const promises: Promise<any>[] = [];

  // eslint-disable-next-line no-await-in-loop
  const reposArray = await octokit.paginate(
    octokit.repos.listForAuthenticatedUser,
    { per_page: 100 },
    response =>
      response.data.filter(repos => {
        if (repos) {
          const urlArray = repos.full_name.split('/');
          const repo = urlArray[1];
          return repo.startsWith(reposPrefix);
        }
        return false;
      })
  );
  // console.log(` - Got ${reposArray.length} repositories`);
  reposArray.forEach(repos => {
    const urlArray = repos.full_name.split('/');
    const owner = urlArray[0];
    const repo = urlArray[1];
    promises.push(
      octokit.repos.delete({ owner, repo }).catch(err => {
        if (err.status !== 404) {
          console.debug(err);
        }
      })
    );
  });
  // console.log(` - Start to remove repositories..`);
  // eslint-disable-next-line no-await-in-loop
  await Promise.all(promises);
  // console.log(` - Completed`);
}

export const destroyDBs = async (DBs: GitDocumentDB[]) => {
  // ! NOTICE: sinon.useFakeTimers() is used in each test to skip FileRemoveTimeoutError.
  const clock = sinon.useFakeTimers();
  Promise.all(
    DBs.map(db =>
      db.destroy().catch(() => {
        // throws FileRemoveTimeoutError
      })
    )
  ).catch(() => {});
  await clock.tickAsync(FILE_REMOVE_TIMEOUT);
  clock.restore();
};
