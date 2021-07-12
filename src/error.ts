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
  export class HttpProtocolRequiredError extends BaseError {
    constructor(url: unknown) {
      super(`HTTP protocol is required: ${url}`);
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
    constructor () {
      const e = `Invalid SSH key path`;
      super(e);
    }
  }

  /**
   * @public
   */
   export class RequestTimeoutError extends BaseError {
    constructor (url: unknown) {
      super(`Request timeout: ${url}`);
    }
  }

  /**
   * @public
   */
   export class SocketTimeoutError extends BaseError {
    constructor (url: unknown) {
      super(`Socket timeout: ${url}`);
    }
  }

  /**
   * @public
   */
  export class HTTPNetworkError extends BaseError {
    constructor (mes: unknown) {
      super(`HTTPNetworkError: ${mes}`);
    }
  }

}