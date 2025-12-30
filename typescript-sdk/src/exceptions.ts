/**
 * Exception hierarchy for Anchor SDK
 */

export class AnchorError extends Error {
  code: string;

  constructor(message: string, code = 'anchor_error') {
    super(message);
    this.name = 'AnchorError';
    this.code = code;
  }
}

export class AnchorAPIError extends AnchorError {
  statusCode: number;
  response: Record<string, any>;

  constructor(message: string, statusCode: number, response?: Record<string, any>) {
    super(`${statusCode}: ${message}`, 'api_error');
    this.name = 'AnchorAPIError';
    this.statusCode = statusCode;
    this.response = response || {};
  }
}

export class AuthenticationError extends AnchorAPIError {
  constructor(message = 'Invalid API key', statusCode = 401, response?: Record<string, any>) {
    super(message, statusCode, response);
    this.name = 'AuthenticationError';
    this.code = 'authentication_error';
  }
}

export class AuthorizationError extends AnchorAPIError {
  requiredPermission?: string;

  constructor(
    message: string,
    statusCode = 403,
    response?: Record<string, any>,
    requiredPermission?: string
  ) {
    super(message, statusCode, response);
    this.name = 'AuthorizationError';
    this.code = 'authorization_error';
    this.requiredPermission = requiredPermission;
  }
}

export class NotFoundError extends AnchorAPIError {
  constructor(message: string, statusCode = 404, response?: Record<string, any>) {
    super(message, statusCode, response);
    this.name = 'NotFoundError';
    this.code = 'not_found';
  }
}

export class ValidationError extends AnchorAPIError {
  field?: string;

  constructor(
    message: string,
    statusCode = 400,
    response?: Record<string, any>,
    field?: string
  ) {
    super(message, statusCode, response);
    this.name = 'ValidationError';
    this.code = 'validation_error';
    this.field = field;
  }
}

export class PolicyViolationError extends AnchorAPIError {
  policyName: string;

  constructor(
    message: string,
    policyName: string,
    statusCode = 403,
    response?: Record<string, any>
  ) {
    super(message, statusCode, response);
    this.name = 'PolicyViolationError';
    this.code = 'policy_violation';
    this.policyName = policyName;
  }
}

export class RateLimitError extends AnchorAPIError {
  retryAfter?: number;

  constructor(
    message: string,
    statusCode = 429,
    response?: Record<string, any>,
    retryAfter?: number
  ) {
    super(message, statusCode, response);
    this.name = 'RateLimitError';
    this.code = 'rate_limit';
    this.retryAfter = retryAfter;
  }
}

export class ServerError extends AnchorAPIError {
  constructor(message: string, statusCode = 500, response?: Record<string, any>) {
    super(message, statusCode, response);
    this.name = 'ServerError';
    this.code = 'server_error';
  }
}

export class NetworkError extends AnchorError {
  constructor(message: string) {
    super(message, 'network_error');
    this.name = 'NetworkError';
  }
}

export class ChainIntegrityError extends AnchorError {
  entryId?: string;
  expectedHash?: string;
  actualHash?: string;

  constructor(
    message: string,
    entryId?: string,
    expectedHash?: string,
    actualHash?: string
  ) {
    super(message, 'chain_integrity_error');
    this.name = 'ChainIntegrityError';
    this.entryId = entryId;
    this.expectedHash = expectedHash;
    this.actualHash = actualHash;
  }
}

export class ConfigurationError extends AnchorError {
  constructor(message: string) {
    super(message, 'configuration_error');
    this.name = 'ConfigurationError';
  }
}

// Backwards compatibility aliases
export const AnchorAuthenticationError = AuthenticationError;
export const AnchorNotFoundError = NotFoundError;
export const AnchorRateLimitError = RateLimitError;
export const AnchorServerError = ServerError;
export const AnchorNetworkError = NetworkError;
