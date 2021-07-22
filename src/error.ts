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
    constructor(public retry: number, url: string, mes: string) {
      super(`Cannot connect to ${url}: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class CannotFetchError extends BaseError {
    constructor(url: string, mes: string) {
      super(`Cannot fetch from ${url}: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class HTTPError401AuthorizationRequired extends BaseError {
    constructor(url: unknown) {
      super(`HTTP Error: 401 Authorization required: ${url}`);
    }
  }

  /**
   * @public
   */
  export class HTTPError403Forbidden extends BaseError {
    constructor(url: unknown) {
      super(`HTTP Error: 403 Forbidden: ${url}`);
    }
  }

  /**
   * @public
   */
  export class HTTPError404NotFound extends BaseError {
    constructor(url: unknown) {
      super(`HTTP Error: 404 Not Found: ${url}`);
    }
  }

  /**
   * @public
   */
  export class CannotCloneRepositoryError extends BaseError {
    constructor(url: unknown) {
      super(`Cannot clone repository: ${url}`);
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
  export class UndefinedPersonalAccessTokenError extends BaseError {
    constructor() {
      super(`Personal Access Token of your GitHub account is needed.`);
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
  export class HttpProtocolRequiredError extends BaseError {
    constructor(url: unknown) {
      super(`HTTP protocol is required: ${url}`);
    }
  }

  /**
   * @public
   */
  export class RequestTimeoutError extends BaseError {
    constructor(url: unknown) {
      super(`Request timeout: ${url}`);
    }
  }

  /**
   * @public
   */
  export class SocketTimeoutError extends BaseError {
    constructor(url: unknown) {
      super(`Socket timeout: ${url}`);
    }
  }

  /**
   * @public
   */
  export class HTTPNetworkError extends BaseError {
    constructor(mes: unknown) {
      super(`HTTPNetworkError: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class InvalidURLError extends BaseError {
    constructor(url: unknown) {
      super(`Invalid url: ${url}'`);
    }
  }

  /**
   * @public
   */
  export class PushPermissionDeniedError extends BaseError {
    constructor(mes: unknown) {
      super(`Permission denied to push to the repository: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class FetchPermissionDeniedError extends BaseError {
    constructor(mes: unknown) {
      super(`Permission denied to fetch to the repository: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class FetchConnectionFailedError extends BaseError {
    constructor(mes: unknown) {
      super(`Fetch connection failed: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class PushConnectionFailedError extends BaseError {
    constructor(mes: unknown) {
      super(`Push connection failed: ${mes}`);
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
  export class GitPushError extends BaseError {
    constructor(mes: unknown) {
      super(`Push error in Git : ${mes}`);
    }
  }

  /**
   * @public
   */
  export class GitFetchError extends BaseError {
    constructor(mes: unknown) {
      super(`Fetch error in sync worker: ${mes}`);
    }
  }

  /**
   * @public
   */
  export class NoMergeBaseFoundError extends BaseError {
    constructor() {
      super(`No merge base found`);
    }
  }

  /**
   * @public
   */
  export class ResolvingAddressError extends BaseError {
    constructor() {
      super(`Cannot resolve address`);
    }
  }
}
