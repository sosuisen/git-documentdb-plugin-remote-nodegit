# GitDocumentDB plugin for remote connection using NodeGit

**NOTE:**<br>
This plugin uses native addon (libgit2).<br>
If you receive errors about installation, you probably miss building tools and libraries.<br>
**In Ubuntu 18:**<br>
```
sudo apt update
sudo apt install build-essential libssl-dev libkrb5-dev libc++-dev 
```
**In Windows 10:**<br>
The list below shows typical environments.
- Node.js 12, Python 2.7.x, and Visual Studio 2017 Community (with Desktop development with C++).
- npm config set msvs_version 2017

If you are still encountering install problems, documents about [NodeGit](https://github.com/nodegit/nodegit#getting-started) and [Building NodeGit from source](https://www.nodegit.org/guides/install/from-source/) may also help you.
