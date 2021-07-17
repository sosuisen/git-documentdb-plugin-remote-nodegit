---
sidebar_label: clone() function
title: clone() function
hide_title: true
---

[Home](./index.md) &gt; [git-documentdb-plugin-remote-nodegit](./git-documentdb-plugin-remote-nodegit.md) &gt; [clone](./git-documentdb-plugin-remote-nodegit.clone.md)

## clone() function

Clone

<b>Signature:</b>

```typescript
export declare function clone(workingDir: string, remoteOptions: RemoteOptions, logger?: Logger): Promise<void>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  workingDir | string |  |
|  remoteOptions | RemoteOptions |  |
|  logger | Logger |  |

<b>Returns:</b>

Promise&lt;void&gt;

## Exceptions

[Err.CannotConnectError](./git-documentdb-plugin-remote-nodegit.err.cannotconnecterror.md)

[Err.CannotCloneRepositoryError](./git-documentdb-plugin-remote-nodegit.err.cannotclonerepositoryerror.md)

[Err.HttpProtocolRequiredError](./git-documentdb-plugin-remote-nodegit.err.httpprotocolrequirederror.md) (from checkHTTP)

[Err.HTTPNetworkError](./git-documentdb-plugin-remote-nodegit.err.httpnetworkerror.md) (from checkHTTP)

[Err.RequestTimeoutError](./git-documentdb-plugin-remote-nodegit.err.requesttimeouterror.md) (from checkHTTP)

[Err.SocketTimeoutError](./git-documentdb-plugin-remote-nodegit.err.sockettimeouterror.md) (from checkHTTP)

