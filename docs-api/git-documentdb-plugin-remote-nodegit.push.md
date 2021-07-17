---
sidebar_label: push() function
title: push() function
hide_title: true
---

[Home](./index.md) &gt; [git-documentdb-plugin-remote-nodegit](./git-documentdb-plugin-remote-nodegit.md) &gt; [push](./git-documentdb-plugin-remote-nodegit.push.md)

## push() function

git push

<b>Signature:</b>

```typescript
export declare function push(workingDir: string, remoteOptions: RemoteOptions): Promise<void>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  workingDir | string |  |
|  remoteOptions | RemoteOptions |  |

<b>Returns:</b>

Promise&lt;void&gt;

## Exceptions

[Err.UnfetchedCommitExistsError](./git-documentdb-plugin-remote-nodegit.err.unfetchedcommitexistserror.md) (from this and validatePushResult())

[Err.GitFetchError](./git-documentdb-plugin-remote-nodegit.err.gitfetcherror.md) (from validatePushResult())

[Err.GitPushError](./git-documentdb-plugin-remote-nodegit.err.gitpusherror.md) (from NodeGit.Remote.push())

