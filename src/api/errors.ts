import { ZodError } from 'zod';

/**
 * Base error class for all FFBaD API errors.
 * Provides classification, i18n message keys, and retry semantics.
 */
export class FFBaDError extends Error {
  readonly code: string;
  readonly userMessageKey: string;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    code: string,
    userMessageKey: string,
    isRetryable: boolean
  ) {
    super(message);
    this.name = 'FFBaDError';
    this.code = code;
    this.userMessageKey = userMessageKey;
    this.isRetryable = isRetryable;
  }
}

/**
 * Network error — device has no connectivity or request timed out.
 * User sees: "Pas de connexion internet" / "No internet connection"
 */
export class NetworkError extends FFBaDError {
  constructor(message = 'Network request failed') {
    super(message, 'NETWORK_ERROR', 'auth.networkError', true);
    this.name = 'NetworkError';
  }
}

/**
 * FFBaD server error — 5xx responses.
 * User sees: "Le serveur FFBaD est indisponible" / "FFBaD server unavailable"
 */
export class ServerError extends FFBaDError {
  readonly statusCode: number;

  constructor(statusCode: number, message = 'FFBaD server error') {
    super(message, 'SERVER_ERROR', 'auth.serverError', true);
    this.name = 'ServerError';
    this.statusCode = statusCode;
  }
}

/**
 * Rate limit error — 429 responses.
 * Hidden from user (per decision): silent exponential backoff.
 */
export class RateLimitError extends FFBaDError {
  constructor(message = 'Rate limited by FFBaD') {
    super(message, 'RATE_LIMIT', 'auth.serverError', true);
    this.name = 'RateLimitError';
  }
}

/**
 * Authentication error — invalid credentials or expired session.
 * User sees: "Identifiants incorrects" / "Invalid credentials"
 */
export class AuthError extends FFBaDError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 'auth.loginError', false);
    this.name = 'AuthError';
  }
}

/**
 * Schema validation error — API returned unexpected response shape.
 * Wraps ZodError for debugging. User sees generic server error.
 */
export class SchemaValidationError extends FFBaDError {
  readonly zodError: ZodError;

  constructor(zodError: ZodError) {
    super(
      `Schema validation failed: ${zodError.message}`,
      'SCHEMA_ERROR',
      'auth.serverError',
      false
    );
    this.name = 'SchemaValidationError';
    this.zodError = zodError;
  }
}
