/* eslint-disable unicorn/custom-error-definition */
/**
 * GitDocumentDB plugin for remote connection using NodeGit
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Namespace for errors
 *
 * @public
 */
export namespace Err {
  /**
   * BaseError
   *
   * @privateRemarks
   * Use 'unknown' type assertion for constructor arguments in subclass of BaseError
   * to use 'expect' in test. See https://github.com/facebook/jest/issues/8279
   */
  class BaseError extends Error {
    constructor(e: string) {
      super(e);
      this.name = new.target.name;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  }

  /**
   * @public
   */
  export class CannotConnectError extends BaseError {
    constructor(mes: unknown) {
      super(`Cannot connect: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class HTTPError401AuthorizationRequired extends BaseError {
    constructor(mes: unknown) {
      super(`HTTP Error: 401 Authorization required: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class HTTPError403Forbidden extends BaseError {
    constructor(mes: unknown) {
      super(`HTTP Error: 403 Forbidden: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class HTTPError404NotFound extends BaseError {
    constructor(mes: unknown) {
      super(`HTTP Error: 404 Not Found: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class InvalidRepositoryURLError extends BaseError {
    constructor(url: unknown) {
      super(`Repository URL is invalid: ${url}`);
    }
  }

  /**
   * @public
   */
  export class InvalidSSHKeyPathError extends BaseError {
    constructor() {
      const e = `Invalid SSH key path`;
      super(e);
    }
  }

  /**
   * @public
   */
  export class InvalidAuthenticationTypeError extends BaseError {
    constructor(type: unknown) {
      const e = `Invalid authentication type: ${type}`;
      super(e);
    }
  }

  /**
   * @public
   */
  export class InvalidURLFormatError extends BaseError {
    constructor(mes: unknown) {
      super(`URL format is invalid: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class UnfetchedCommitExistsError extends BaseError {
    constructor() {
      super(
        'Cannot push because a reference that you are trying to update on the remote contains commits that are not present locally.'
      );
    }
  }

  /**
   * @public
   */
  export class NetworkError extends BaseError {
    constructor(mes: unknown) {
      super(`Network error: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class InvalidGitRemoteError extends BaseError {
    constructor(mes: unknown) {
      super(`Invalid Git remote: ${mes}`);
    }
  }
}
