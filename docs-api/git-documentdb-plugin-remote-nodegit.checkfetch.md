---
sidebar_label: checkFetch() function
title: checkFetch() function
hide_title: true
---

[Home](./index.md) &gt; [git-documentdb-plugin-remote-nodegit](./git-documentdb-plugin-remote-nodegit.md) &gt; [checkFetch](./git-documentdb-plugin-remote-nodegit.checkfetch.md)

## checkFetch() function

Check connection by FETCH

<b>Signature:</b>

```typescript
export declare function checkFetch(workingDir: string, options: RemoteOptions, logger?: Logger): Promise<'exist' | 'not_exist'>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  workingDir | string |  |
|  options | RemoteOptions |  |
|  logger | Logger |  |

<b>Returns:</b>

Promise&lt;'exist' \| 'not\_exist'&gt;

## Exceptions

[Err.InvalidURLError](./git-documentdb-plugin-remote-nodegit.err.invalidurlerror.md)

[Err.RemoteRepositoryNotFoundError](./git-documentdb-plugin-remote-nodegit.err.remoterepositorynotfounderror.md)

[Err.FetchPermissionDeniedError](./git-documentdb-plugin-remote-nodegit.err.fetchpermissiondeniederror.md)


[Err.HttpProtocolRequiredError](./git-documentdb-plugin-remote-nodegit.err.httpprotocolrequirederror.md) (from createCredentialForGitHub)

[Err.RemoteUndefinedPersonalAccessTokenError](./git-documentdb-plugin-remote-nodegit.err.remoteundefinedpersonalaccesstokenerror.md) (from createCredentialForGitHub)

[Err.InvalidRepositoryURLError](./git-documentdb-plugin-remote-nodegit.err.invalidrepositoryurlerror.md) (from createCredentialForGitHub)

[Err.InvalidSSHKeyPathError](./git-documentdb-plugin-remote-nodegit.err.invalidsshkeypatherror.md) (from createCredentialForSSH)

[Err.InvalidAuthenticationTypeError](./git-documentdb-plugin-remote-nodegit.err.invalidauthenticationtypeerror.md) (from createCredential)

