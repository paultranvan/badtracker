import type {
  AccountPoonaResponse,
  LicenceInfoResponse,
  LicenceSearchResponse,
  ResultByLicenceResponse,
  RankingEvolutionResponse,
} from '../api/schemas';
import type { PlayerProfile } from '../api/ffbad';

// Re-export Zod-inferred types for use across the app
export type { AccountPoonaResponse };
export type { LicenceInfoResponse };
export type { LicenceSearchResponse };
export type { ResultByLicenceResponse };
export type { RankingEvolutionResponse };
export type { PlayerProfile };

/**
 * FFBaD API credentials.
 * licence: FFBaD licence number (e.g., "12345678")
 * password: User's FFBaD account password
 */
export interface FFBaDCredentials {
  licence: string;
  password: string;
}

/**
 * Parameters for an FFBaD API function call.
 * The API uses RPC-over-REST: single endpoint, function name as parameter.
 */
export interface FFBaDCallParams {
  fonction: string;
  params: (string | number | boolean)[];
}

/**
 * Authenticated user session data.
 * Extracted from ws_getaccountpoona or ws_getlicenceinfobylicence response.
 */
export interface UserSession {
  licence: string;
  nom: string;
  prenom: string;
}
