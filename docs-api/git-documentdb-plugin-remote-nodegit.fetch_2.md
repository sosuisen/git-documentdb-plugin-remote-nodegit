---
sidebar_label: fetch_2() function
title: fetch_2() function
hide_title: true
---

[Home](./index.md) &gt; [git-documentdb-plugin-remote-nodegit](./git-documentdb-plugin-remote-nodegit.md) &gt; [fetch\_2](./git-documentdb-plugin-remote-nodegit.fetch_2.md)

## fetch\_2() function

git fetch

<b>Signature:</b>

```typescript
export declare function fetch(workingDir: string, remoteOptions: RemoteOptions, logger?: Logger): Promise<void>;
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

[Err.GitFetchError](./git-documentdb-plugin-remote-nodegit.err.gitfetcherror.md)

[Err.HttpProtocolRequiredError](./git-documentdb-plugin-remote-nodegit.err.httpprotocolrequirederror.md) (from createCredentialForGitHub)

[Err.RemoteUndefinedPersonalAccessTokenError](./git-documentdb-plugin-remote-nodegit.err.remoteundefinedpersonalaccesstokenerror.md) (from createCredentialForGitHub)

[Err.InvalidRepositoryURLError](./git-documentdb-plugin-remote-nodegit.err.invalidrepositoryurlerror.md) (from createCredentialForGitHub)

[Err.InvalidSSHKeyPathError](./git-documentdb-plugin-remote-nodegit.err.invalidsshkeypatherror.md) (from createCredentialForSSH)

[Err.InvalidAuthenticationTypeError](./git-documentdb-plugin-remote-nodegit.err.invalidauthenticationtypeerror.md) (from createCredential)

