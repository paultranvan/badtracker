import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';
import type { FFBaDCredentials, FFBaDCallParams } from '../types/ffbad';
import {
  NetworkError,
  ServerError,
  RateLimitError,
  AuthError,
  SchemaValidationError,
} from './errors';

// ============================================================
// Configuration
// ============================================================

const FFBAD_BASE_URL = 'https://api.ffbad.org/rest/';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

// ============================================================
// Module-level credential state
// Injected by auth layer, read by request interceptor.
// ============================================================

let currentCredentials: FFBaDCredentials | null = null;

/**
 * Set or clear the credentials used for FFBaD API calls.
 * Called by auth/context.tsx on sign-in and sign-out.
 */
export function setCredentials(credentials: FFBaDCredentials | null): void {
  currentCredentials = credentials;
}

/**
 * Get current credentials (used internally by auth layer for validation).
 */
export function getCredentials(): FFBaDCredentials | null {
  return currentCredentials;
}

// ============================================================
// Axios Instance
// ============================================================

export const apiClient = axios.create({
  baseURL: FFBAD_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
  responseType: 'json',
});

// ============================================================
// Request Interceptor: HTTPS enforcement + credential injection
// ============================================================

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // HTTPS enforcement — reject any non-HTTPS URL
  const url = config.baseURL ?? config.url ?? '';
  if (url && !url.startsWith('https://')) {
    throw new Error('HTTPS required: insecure requests are blocked');
  }

  return config;
});

// ============================================================
// Response Interceptor: error classification
// ============================================================

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Network error (no response received)
    if (!error.response) {
      // Timeout errors
      if (error.code === 'ECONNABORTED') {
        return Promise.reject(new NetworkError('Request timed out'));
      }
      return Promise.reject(new NetworkError());
    }

    const status = error.response.status;

    // Rate limiting (hidden from user — exponential backoff handles this)
    if (status === 429) {
      return Promise.reject(new RateLimitError());
    }

    // Server errors
    if (status >= 500) {
      return Promise.reject(new ServerError(status));
    }

    // Auth errors
    if (status === 401 || status === 403) {
      return Promise.reject(new AuthError());
    }

    // Other errors — pass through
    return Promise.reject(error);
  }
);

// ============================================================
// Retry with exponential backoff
// ============================================================

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Only retry retryable FFBaD errors
      const isRetryable =
        error instanceof NetworkError ||
        error instanceof RateLimitError ||
        error instanceof ServerError;

      if (!isRetryable) {
        throw error;
      }

      // Don't delay on last attempt (we'll throw anyway)
      if (attempt < MAX_RETRIES - 1) {
        // Exponential backoff with jitter: 500ms, 1000ms, 2000ms (approx)
        const jitter = 0.5 + Math.random() * 0.5;
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) * jitter;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ============================================================
// Main API call function
// ============================================================

/**
 * Call an FFBaD API function with Zod validation.
 *
 * Builds the RPC-style QueryJson parameter, calls the API,
 * validates the response with the provided Zod schema.
 *
 * @param call - Function name and parameters
 * @param schema - Zod schema to validate the response
 * @param credentials - Optional credentials override (default: use module state)
 * @returns Parsed and validated response data
 */
export async function callFFBaD<T extends z.ZodType>(
  call: FFBaDCallParams,
  schema: T,
  credentials?: FFBaDCredentials
): Promise<z.infer<T>> {
  const creds = credentials ?? currentCredentials;

  return withRetry(async () => {
    const params: Record<string, string> = {
      QueryJson: JSON.stringify({
        Function: call.fonction,
        Param: call.params,
      }),
    };

    // Add auth if credentials available
    if (creds) {
      params.AuthJson = JSON.stringify({
        Login: creds.licence,
        Password: creds.password,
      });
    }

    const response = await apiClient.get('', { params });

    // Handle empty responses
    if (response.data == null || response.data === '') {
      throw new SchemaValidationError(
        new z.ZodError([
          {
            code: 'custom',
            path: [],
            message: 'Empty response from FFBaD API',
          },
        ])
      );
    }

    // Handle non-JSON responses (e.g., "No Function ?" plain text)
    if (typeof response.data === 'string') {
      const text = response.data.trim();
      if (text === 'No Function ?' || text.startsWith('No Function')) {
        throw new ServerError(
          200,
          `FFBaD API returned error: ${text}`
        );
      }
      // Try parsing as JSON in case axios didn't auto-parse
      try {
        response.data = JSON.parse(text);
      } catch {
        throw new SchemaValidationError(
          new z.ZodError([
            {
              code: 'custom',
              path: [],
              message: `Non-JSON response: ${text.substring(0, 100)}`,
            },
          ])
        );
      }
    }

    // Validate response against schema
    const result = schema.safeParse(response.data);
    if (!result.success) {
      throw new SchemaValidationError(result.error);
    }

    return result.data;
  });
}
