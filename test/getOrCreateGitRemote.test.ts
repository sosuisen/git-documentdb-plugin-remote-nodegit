import path from 'path';
import fs from 'fs-extra';
import nodegit from '@sosuisen/nodegit';
import { getOrCreateGitRemote } from '../src/remote-nodegit';
import expect from 'expect';
import { GitDocumentDB } from 'git-documentdb';
import { destroyDBs } from './remote_utils';

const reposPrefix = 'test_remote_nodegit_git_remote___';
const localDir = `./test/database_git_remote`;

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

const maybe =
  process.env.GITDDB_GITHUB_USER_URL && process.env.GITDDB_PERSONAL_ACCESS_TOKEN
    ? describe
    : describe.skip;

maybe('<remote-nodegit> getOrCreateGitRemote()', () => {
  const remoteURLBase = process.env.GITDDB_GITHUB_USER_URL?.endsWith('/')
    ? process.env.GITDDB_GITHUB_USER_URL
    : process.env.GITDDB_GITHUB_USER_URL + '/';
  const token = process.env.GITDDB_PERSONAL_ACCESS_TOKEN!;

  it('returns "add" when origin is undefined', async () => {
    const remoteURL = remoteURLBase + serialId();
    const dbName = serialId();
    const gitDDB = new GitDocumentDB({
      dbName,
      localDir,
    });
    await gitDDB.open();

    const repos = await nodegit.Repository.open(gitDDB.workingDir);
    const [result, remote] = await getOrCreateGitRemote(
      repos,
      remoteURL
    );
    expect(result).toBe('add');

    destroyDBs([gitDDB]);
  });

  it('returns "change" when another origin exists', async () => {
    const remoteURL = remoteURLBase + serialId();
    const dbName = serialId();
    const gitDDB = new GitDocumentDB({
      dbName,
      localDir,
    });
    await gitDDB.open();

    const repos = await nodegit.Repository.open(gitDDB.workingDir);
    await getOrCreateGitRemote(repos, remoteURL);

    const remoteURL2 = remoteURLBase + serialId();
    // eslint-disable-next-line dot-notation
    const [result, remote] = await getOrCreateGitRemote(
      repos,
      remoteURL2
    );
    expect(result).toBe('change');

    destroyDBs([gitDDB]);
  });

  it('returns "exist" when the same origin exists', async () => {
    const remoteURL = remoteURLBase + serialId();
    const dbName = serialId();
    const gitDDB = new GitDocumentDB({
      dbName,
      localDir,
    });
    await gitDDB.open();

    const repos = await nodegit.Repository.open(gitDDB.workingDir);
    await getOrCreateGitRemote(repos, remoteURL);

    const remoteURL2 = remoteURLBase + serialId();
    // eslint-disable-next-line dot-notation
    const [result, remote] = await getOrCreateGitRemote(
      repos,
      remoteURL
    );
    expect(result).toBe('exist');

    destroyDBs([gitDDB]);
  });
});
