# GitDocumentDB plugin for remote connection using NodeGit

This is a plugin module for [GitDocumentDB](https://github.com/sosuisen/git-documentdb).

The following authentications are available with this plugin: 
- SSH keys
- GitHub's PATs (Personal Access Tokens)

# Prerequisite

- Windows 10
- Linux
- macOS

Building this plugin with Electron in a Windows 32bit environment is limited due to [a NodeGit issue](https://github.com/nodegit/nodegit/issues/1850).

# Tested environment
- Windows 10 (64bit)
- Ubuntu 18
- macOS Catalina


# Install

```
npm i git-documentdb-plugin-remote-nodegit
```

This plugin contains a native module (libgit2) derived from NodeGit.
If you receive errors about installation, you probably miss building tools and libraries.

**In Ubuntu 18:**
```
sudo apt update
sudo apt install build-essential libssl-dev libkrb5-dev libc++-dev 
```

**In Windows 10:**

The list below shows typical environments.
- Node.js 12, Python 2.7.x, and Visual Studio 2017 Community (with Desktop development with C++).
- npm config set msvs_version 2017

If you are still encountering install problems, documents about [NodeGit](https://github.com/nodegit/nodegit#getting-started) and [Building NodeGit from source](https://www.nodegit.org/guides/install/from-source/) may also help you.

# See also

[Tutorial of plugin (in GitDocumentDB website)](https://gitddb.com/docs/tutorial/plugin)