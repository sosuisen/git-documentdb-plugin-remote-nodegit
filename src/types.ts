/**
 * Synchronization direction
 *
 * @remarks
 *
 * - pull: Only download from remote to local (currently not implemented)
 *
 * - push: Only upload from local to remote
 *
 * - both: Both download and upload between remote and local
 *
 * @public
 */
export type SyncDirection = 'pull' | 'push' | 'both';

/**
 * Connection settings for GitHub
 *
 * @remarks
 * - personalAccessToken: See https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token
 *
 * - private: Whether the automatically created repository is private or not. Default is true.
 *
 * @public
 */
export type ConnectionSettingsGitHub = {
  type: 'github';
  personalAccessToken?: string;
  private?: boolean;
};

/**
 * Connection settings for SSH
 *
 * @public
 */
export type ConnectionSettingsSSH = {
  type: 'ssh';
  privateKeyPath: string;
  publicKeyPath: string;
  passPhrase?: string;
};

/**
 * Connection settings do not exist.
 *
 * @public
 */
export type ConnectionSettingsNone = {
  type: 'none';
};

/**
 * Connection settings for RemoteOptions
 *
 * @public
 */
export type ConnectionSettings =
  | ConnectionSettingsNone
  | ConnectionSettingsGitHub
  | ConnectionSettingsSSH;

export type RemoteOptions = {
  /* network */
  remoteUrl?: string;
  syncDirection?: SyncDirection;
  connection?: ConnectionSettings;
};
