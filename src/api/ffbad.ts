import { callFFBaD, setCredentials } from './client';
import {
  AccountPoonaSchema,
  LicenceInfoSchema,
  LicenceSearchSchema,
  ResultByLicenceSchema,
  RankingEvolutionSchema,
} from './schemas';
import type {
  AccountPoonaResponse,
  LicenceInfoResponse,
  LicenceSearchResponse,
  ResultByLicenceResponse,
  RankingEvolutionResponse,
} from './schemas';
import { AuthError } from './errors';

// ============================================================
// Authentication
// ============================================================

/**
 * Validate FFBaD credentials by calling ws_getaccountpoona.
 *
 * This is the "login" operation — if the API returns data (array),
 * credentials are valid. If it returns a string, credentials are invalid.
 *
 * @throws AuthError if credentials are invalid
 * @throws NetworkError, ServerError if API unreachable
 */
export async function validateCredentials(
  licence: string,
  password: string
): Promise<{ licence: string; nom: string; prenom: string }> {
  const credentials = { licence, password };

  // Temporarily set credentials for this call
  setCredentials(credentials);

  const response: AccountPoonaResponse = await callFFBaD(
    {
      fonction: 'ws_getaccountpoona',
      params: [licence, password],
    },
    AccountPoonaSchema,
    credentials
  );

  // If Retour is a string, it's an error message (invalid credentials)
  if (typeof response.Retour === 'string') {
    setCredentials(null);
    throw new AuthError(response.Retour || 'Invalid credentials');
  }

  // If Retour is an empty array, also treat as auth failure
  if (response.Retour.length === 0) {
    setCredentials(null);
    throw new AuthError('No account found for this licence');
  }

  const account = response.Retour[0];
  return {
    licence: account.Licence,
    nom: account.Nom,
    prenom: account.Prenom,
  };
}

// ============================================================
// Player Info
// ============================================================

/**
 * Get licence info for a specific player by licence number.
 */
export async function getLicenceInfo(
  licence: string
): Promise<LicenceInfoResponse> {
  return callFFBaD(
    {
      fonction: 'ws_getlicenceinfobylicence',
      params: [licence, false],
    },
    LicenceInfoSchema
  );
}

/**
 * Search for players by keywords (name, licence number, etc.).
 */
export async function searchPlayersByKeywords(
  keywords: string
): Promise<LicenceSearchResponse> {
  return callFFBaD(
    {
      fonction: 'ws_getlicenceinfobykeywords',
      params: [keywords, false],
    },
    LicenceSearchSchema
  );
}

/**
 * Search for players by name prefix.
 */
export async function searchPlayersByName(
  name: string
): Promise<LicenceSearchResponse> {
  return callFFBaD(
    {
      fonction: 'ws_getlicenceinfobystartnom',
      params: [name, false],
    },
    LicenceSearchSchema
  );
}

// ============================================================
// Match History (Phase 4)
// ============================================================

/**
 * Get match results for a player by licence number.
 */
export async function getResultsByLicence(
  licence: string
): Promise<ResultByLicenceResponse> {
  return callFFBaD(
    {
      fonction: 'ws_getresultbylicence',
      params: [licence],
    },
    ResultByLicenceSchema
  );
}

// ============================================================
// Rankings (Phase 5)
// ============================================================

/**
 * Get ranking evolution over time for a player.
 */
export async function getRankingEvolution(
  licence: string
): Promise<RankingEvolutionResponse> {
  return callFFBaD(
    {
      fonction: 'ws_getrankingevolutionbylicence',
      params: [licence],
    },
    RankingEvolutionSchema
  );
}
