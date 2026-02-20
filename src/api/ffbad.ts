import { callFFBaD, setCredentials } from './client';
import {
  AccountPoonaSchema,
  LicenceInfoSchema,
  LicenceSearchSchema,
  ResultByLicenceSchema,
  RankingEvolutionSchema,
  ClubRankingSchema,
  ClubListSchema,
} from './schemas';
import type {
  AccountPoonaResponse,
  LicenceInfoResponse,
  LicenceSearchResponse,
  ResultByLicenceResponse,
  RankingEvolutionResponse,
  ClubRankingResponse,
  ClubListResponse,
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
// Player Profile
// ============================================================

/**
 * Normalized player profile with ranking data by discipline.
 */
export interface PlayerProfile {
  licence: string;
  nom: string;
  prenom: string;
  club?: string;
  nomClub?: string;
  isActive?: boolean;
  rankings: {
    simple?: { classement: string; cpph?: number };
    double?: { classement: string; cpph?: number };
    mixte?: { classement: string; cpph?: number };
  };
}

/**
 * Parse a CPPH value from the API response (may be string or number).
 * Returns undefined if not a valid number.
 */
function parseCpph(value: string | number | undefined): number | undefined {
  if (value == null) return undefined;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Build a ranking entry from a classement + CPPH pair.
 * Returns undefined if no classement is available.
 */
function buildRanking(
  classement: string | undefined,
  cpph: string | number | undefined
): { classement: string; cpph?: number } | undefined {
  if (!classement) return undefined;
  return { classement, cpph: parseCpph(cpph) };
}

/**
 * Get a player's full profile including rankings by discipline.
 *
 * Calls ws_getlicenceinfobylicence and normalizes the response
 * into a PlayerProfile with ranking data extracted from the API fields.
 *
 * @throws NetworkError, ServerError, SchemaValidationError
 * @returns null if player not found
 */
export async function getPlayerProfile(
  licence: string
): Promise<PlayerProfile | null> {
  const response = await getLicenceInfo(licence);

  // FFBaD returns string Retour when player not found
  if (typeof response.Retour === 'string') {
    return null;
  }

  if (response.Retour.length === 0) {
    return null;
  }

  const data = response.Retour[0];

  // Normalize IS_ACTIF to boolean
  let isActive: boolean | undefined;
  if (data.IS_ACTIF != null) {
    if (typeof data.IS_ACTIF === 'boolean') {
      isActive = data.IS_ACTIF;
    } else if (typeof data.IS_ACTIF === 'number') {
      isActive = data.IS_ACTIF === 1;
    } else {
      isActive = data.IS_ACTIF === '1' || data.IS_ACTIF.toLowerCase() === 'true';
    }
  }

  // Extract ranking fields (may be undefined if API doesn't return them)
  // The .passthrough() on the schema captures any extra fields from the API
  const raw = data as Record<string, unknown>;

  return {
    licence: data.Licence,
    nom: data.Nom,
    prenom: data.Prenom,
    club: data.Club,
    nomClub: data.NomClub,
    isActive,
    rankings: {
      simple: buildRanking(
        (raw.ClassementSimple as string) ?? data.ClassementSimple,
        (raw.CPPHSimple as string | number) ?? data.CPPHSimple
      ),
      double: buildRanking(
        (raw.ClassementDouble as string) ?? data.ClassementDouble,
        (raw.CPPHDouble as string | number) ?? data.CPPHDouble
      ),
      mixte: buildRanking(
        (raw.ClassementMixte as string) ?? data.ClassementMixte,
        (raw.CPPHMixte as string | number) ?? data.CPPHMixte
      ),
    },
  };
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

// ============================================================
// Club Features (Phase 6)
// ============================================================

/**
 * Get rankings for all disciplines for all members of a club.
 *
 * Uses ws_getrankingallbyclub with the club's ID_Club value.
 * The club ID corresponds to the `Club` field returned by ws_getlicenceinfobylicence.
 *
 * NOTE: Response schema is inferred from changelog and analogy with LicenceInfoItem.
 * .passthrough() on the schema ensures real API fields are captured even if names differ.
 *
 * @throws NetworkError, ServerError, SchemaValidationError
 */
export async function getClubLeaderboard(
  clubId: string
): Promise<ClubRankingResponse> {
  return callFFBaD(
    {
      fonction: 'ws_getrankingallbyclub',
      params: [clubId],
    },
    ClubRankingSchema
  );
}

/**
 * Get the full list of FFBaD-registered clubs for club search.
 *
 * Returns all clubs (~3500 entries). Intended to be cached client-side —
 * the full list is fetched once and filtered locally.
 *
 * @throws NetworkError, ServerError, SchemaValidationError
 */
export async function getClubList(): Promise<ClubListResponse> {
  return callFFBaD(
    {
      fonction: 'ws_getclublist',
      params: [],
    },
    ClubListSchema
  );
}
