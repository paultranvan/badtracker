import { bridgeLogin, bridgeGet, bridgePost } from './webview-bridge';
import type {
  LicenceInfoResponse,
  LicenceSearchResponse,
  ResultByLicenceResponse,
  RankingEvolutionResponse,
  ClubRankingResponse,
  ClubListResponse,
} from './schemas';
import { AuthError, NetworkError } from './errors';

// ============================================================
// Module-level session state (set by auth context)
// ============================================================

let currentPersonId: string | null = null;
let currentAccessToken: string | null = null;
let currentLicence: string | null = null;

/**
 * Set the current user session info for API calls.
 * Called by auth/context.tsx on sign-in and sign-out.
 */
export function setSessionInfo(info: {
  personId: string;
  accessToken: string;
  licence: string;
} | null): void {
  if (info) {
    currentPersonId = info.personId;
    currentAccessToken = info.accessToken;
    currentLicence = info.licence;
  } else {
    currentPersonId = null;
    currentAccessToken = null;
    currentLicence = null;
  }
}

function requireSession(): { personId: string; accessToken: string; licence: string } {
  if (!currentPersonId || !currentAccessToken || !currentLicence) {
    throw new AuthError('Not authenticated');
  }
  return { personId: currentPersonId, accessToken: currentAccessToken, licence: currentLicence };
}

// ============================================================
// Authentication
// ============================================================

/**
 * Validate FFBaD credentials via myffbad.fr login.
 *
 * @throws AuthError if credentials are invalid
 * @throws NetworkError if bridge unavailable
 */
export async function validateCredentials(
  licence: string,
  password: string
): Promise<{
  licence: string;
  nom: string;
  prenom: string;
  personId: string;
  accessToken: string;
}> {
  const result = await bridgeLogin(licence, password);

  return {
    licence: result.licence,
    nom: result.nom,
    prenom: result.prenom,
    personId: String(result.personId),
    accessToken: result.accessToken,
  };
}

// ============================================================
// Player Info
// ============================================================

/**
 * Get licence info for a specific player by licence number.
 * Routes through myffbad.fr /api/person/{personId}/rankings.
 *
 * For the current user, uses stored personId.
 * For other players, uses the search API to find them first.
 */
export async function getLicenceInfo(
  licence: string
): Promise<LicenceInfoResponse> {
  const session = requireSession();

  // For current user, use their personId directly
  if (licence === session.licence) {
    return fetchPlayerRankings(session.personId, session.accessToken, licence);
  }

  // For other players, search by licence to get their info
  const searchResponse = await searchPlayersByKeywords(licence);
  return searchResponse as LicenceInfoResponse;
}

/**
 * Fetch player rankings and transform to LicenceInfoResponse format.
 */
async function fetchPlayerRankings(
  personId: string,
  accessToken: string,
  licence: string
): Promise<LicenceInfoResponse> {
  try {
    const data = (await bridgeGet(
      `/api/person/${personId}/rankings`,
      accessToken,
      personId
    )) as Record<string, unknown>;

    if (!data) {
      return { Retour: 'No data' };
    }

    // myffbad.fr rankings response — transform to our expected format
    const rankings = data as Record<string, unknown>;
    const item = transformRankingsToLicenceInfo(rankings, licence, personId);

    return { Retour: [item] } as LicenceInfoResponse;
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return { Retour: 'Error fetching player info' };
  }
}

/**
 * Transform myffbad.fr rankings response to LicenceInfoItem format.
 *
 * myffbad.fr returns a flat object with fields like:
 *   simpleSubLevel: "P10", simpleRate: 909,
 *   doubleSubLevel: "D8", doubleRate: 1283,
 *   mixteSubLevel: "D9", mixteRate: 1100,
 *   clubId: 1162, etc.
 */
function transformRankingsToLicenceInfo(
  data: Record<string, unknown>,
  licence: string,
  personId: string
): Record<string, unknown> {
  return {
    Licence: licence,
    Nom: '',
    Prenom: '',
    Club: String(data.clubId ?? ''),
    NomClub: '',
    IS_ACTIF: true,
    personId,
    ClassementSimple: data.simpleSubLevel ?? '',
    CPPHSimple: data.simpleRate,
    ClassementDouble: data.doubleSubLevel ?? '',
    CPPHDouble: data.doubleRate,
    ClassementMixte: data.mixteSubLevel ?? '',
    CPPHMixte: data.mixteRate,
    // Extra ranking data for potential future use
    bestSimpleSubLevel: data.bestSimpleSubLevel,
    bestDoubleSubLevel: data.bestDoubleSubLevel,
    bestMixteSubLevel: data.bestMixteSubLevel,
  };
}

/**
 * Search for players by keywords (name, licence number, etc.).
 * Uses myffbad.fr /api/search/autocomplete endpoint.
 */
export async function searchPlayersByKeywords(
  keywords: string
): Promise<LicenceSearchResponse> {
  const session = requireSession();

  try {
    const data = await bridgeGet(
      `/api/search/autocomplete?value=${encodeURIComponent(keywords)}`,
      session.accessToken,
      session.personId
    );

    if (!data) {
      return { Retour: 'No results' };
    }

    const results = Array.isArray(data) ? data : ((data as Record<string, unknown>).results ?? []);

    if (!Array.isArray(results) || results.length === 0) {
      return { Retour: 'No results' };
    }

    // Transform each result to LicenceInfoItem format
    const items = (results as Array<Record<string, unknown>>)
      .filter((r) => r.type === 'player' || r.type === 'joueur' || !r.type)
      .map((r) => ({
        Licence: String(r.licence ?? r.licenceNumber ?? r.id ?? ''),
        Nom: String(r.lastName ?? r.nom ?? r.name ?? ''),
        Prenom: String(r.firstName ?? r.prenom ?? ''),
        Club: String(r.clubId ?? r.club ?? ''),
        NomClub: String(r.clubName ?? r.nomClub ?? ''),
        personId: String(r.personId ?? r.id ?? ''),
      }));

    return { Retour: items.length > 0 ? items : 'No results' };
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return { Retour: 'Search error' };
  }
}

/**
 * Search for players by name prefix.
 */
export async function searchPlayersByName(
  name: string
): Promise<LicenceSearchResponse> {
  // myffbad.fr uses the same autocomplete endpoint for names
  return searchPlayersByKeywords(name);
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

function parseCpph(value: string | number | undefined): number | undefined {
  if (value == null) return undefined;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? undefined : num;
}

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
 * @throws NetworkError, AuthError
 * @returns null if player not found
 */
export async function getPlayerProfile(
  licence: string
): Promise<PlayerProfile | null> {
  const response = await getLicenceInfo(licence);

  if (typeof response.Retour === 'string') {
    return null;
  }

  if (response.Retour.length === 0) {
    return null;
  }

  const data = response.Retour[0];
  const raw = data as Record<string, unknown>;

  let isActive: boolean | undefined;
  if (data.IS_ACTIF != null) {
    if (typeof data.IS_ACTIF === 'boolean') {
      isActive = data.IS_ACTIF;
    } else if (typeof data.IS_ACTIF === 'number') {
      isActive = data.IS_ACTIF === 1;
    } else {
      isActive = data.IS_ACTIF === '1' || String(data.IS_ACTIF).toLowerCase() === 'true';
    }
  }

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
// Match History
// ============================================================

/**
 * Get match results for a player by licence number.
 * Uses myffbad.fr /api/person/{personId}/result endpoint.
 */
export async function getResultsByLicence(
  licence: string
): Promise<ResultByLicenceResponse> {
  const session = requireSession();

  // For current user, use their personId
  const personId = licence === session.licence ? session.personId : null;

  if (!personId) {
    // For other players, we'd need their personId — return empty for now
    return { Retour: [] };
  }

  try {
    const data = await bridgeGet(
      `/api/person/${personId}/result`,
      session.accessToken,
      personId
    );

    if (!data) {
      return { Retour: 'No results' };
    }

    const results = Array.isArray(data) ? data : ((data as Record<string, unknown>).results ?? data);

    if (!Array.isArray(results)) {
      return { Retour: 'No results' };
    }

    // Transform to ResultItem format expected by consumers
    const items = (results as Array<Record<string, unknown>>).map(transformResultItem);

    return { Retour: items };
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return { Retour: 'Error fetching results' };
  }
}

/**
 * Transform a myffbad.fr result item to the existing ResultItem format.
 *
 * myffbad.fr result items have:
 *   date, name, subName, winPoint, discipline, brackets, eventId, resultId, etc.
 */
function transformResultItem(raw: Record<string, unknown>): Record<string, unknown> {
  // Determine win/loss from winPoint (positive = win, negative = loss)
  const winPoint = raw.winPoint as number | null | undefined;
  let resultat: string | undefined;
  if (winPoint != null && winPoint > 0) {
    resultat = 'V';
  } else if (winPoint != null && winPoint < 0) {
    resultat = 'D';
  }

  return {
    Date: raw.date,
    Epreuve: raw.name,
    Competition: raw.name,
    Discipline: raw.discipline,
    Points: winPoint,
    Resultat: resultat,
    // subName often contains the matchup (e.g. "94-CALB-2 contre 94-VSSM-6")
    Adversaire: raw.subName,
    // Pass through all original fields
    ...raw,
  };
}

// ============================================================
// Rankings
// ============================================================

/**
 * Get ranking evolution over time for a player.
 * Uses myffbad.fr /api/person/{personId}/rankingSemester/evolution endpoint.
 */
export async function getRankingEvolution(
  licence: string
): Promise<RankingEvolutionResponse> {
  const session = requireSession();

  const personId = licence === session.licence ? session.personId : null;

  if (!personId) {
    return { Retour: 'No data' };
  }

  try {
    const data = await bridgePost(
      `/api/person/${personId}/rankingSemester/evolution`,
      {},
      session.accessToken,
      personId
    );

    if (!data) {
      return { Retour: 'No data' };
    }

    const results = Array.isArray(data) ? data : ((data as Record<string, unknown>).results ?? data);

    if (!Array.isArray(results)) {
      return { Retour: 'No data' };
    }

    // Transform to RankingEvolutionItem format
    const items = (results as Array<Record<string, unknown>>).map((raw) => ({
      Date: String(raw.date ?? raw.Date ?? raw.period ?? ''),
      Classement: String(raw.ranking ?? raw.classement ?? raw.Classement ?? raw.level ?? ''),
      Points: raw.points ?? raw.Points ?? raw.cpph ?? raw.CPPH,
      Discipline: String(raw.discipline ?? raw.Discipline ?? raw.type ?? ''),
      CPPH: raw.cpph ?? raw.CPPH ?? raw.points,
      Saison: String(raw.season ?? raw.Saison ?? raw.saison ?? ''),
      Semaine: raw.week ?? raw.Semaine ?? raw.semaine,
      ...raw,
    }));

    return { Retour: items } as RankingEvolutionResponse;
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return { Retour: 'Error fetching ranking evolution' };
  }
}

// ============================================================
// Club Features
// ============================================================

/**
 * Get rankings for all members of a club.
 * Uses myffbad.fr /api/club/{clubId}/informations/ endpoint.
 */
export async function getClubLeaderboard(
  clubId: string
): Promise<ClubRankingResponse> {
  const session = requireSession();

  try {
    const data = (await bridgeGet(
      `/api/club/${clubId}/informations/`,
      session.accessToken,
      session.personId
    )) as Record<string, unknown>;

    if (!data) {
      return { Retour: 'No data' };
    }

    // Club info endpoint may return members in various shapes
    const members = (data.members ?? data.players ?? data.joueurs ?? data) as unknown;

    if (!Array.isArray(members)) {
      // If it returns club info without member list, try alternative
      return { Retour: [] };
    }

    const items = (members as Array<Record<string, unknown>>).map((raw) => ({
      Licence: String(raw.licence ?? raw.licenceNumber ?? raw.id ?? ''),
      Nom: String(raw.lastName ?? raw.nom ?? raw.name ?? ''),
      Prenom: String(raw.firstName ?? raw.prenom ?? ''),
      Club: clubId,
      NomClub: String(data.clubName ?? data.name ?? ''),
      ClassementSimple: String(raw.rankingSimple ?? raw.classementSimple ?? raw.ClassementSimple ?? ''),
      ClassementDouble: String(raw.rankingDouble ?? raw.classementDouble ?? raw.ClassementDouble ?? ''),
      ClassementMixte: String(raw.rankingMixte ?? raw.classementMixte ?? raw.ClassementMixte ?? ''),
      CPPHSimple: raw.cpphSimple ?? raw.CPPHSimple,
      CPPHDouble: raw.cpphDouble ?? raw.CPPHDouble,
      CPPHMixte: raw.cpphMixte ?? raw.CPPHMixte,
      ...raw,
    }));

    return { Retour: items } as ClubRankingResponse;
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return { Retour: 'Error fetching club data' };
  }
}

/**
 * Get the list of clubs for search.
 * Uses myffbad.fr /api/search/clubs endpoint.
 */
export async function getClubList(): Promise<ClubListResponse> {
  const session = requireSession();

  try {
    const data = await bridgeGet(
      '/api/search/clubs',
      session.accessToken,
      session.personId
    );

    if (!data) {
      return { Retour: 'No data' };
    }

    const results = Array.isArray(data) ? data : ((data as Record<string, unknown>).results ?? data);

    if (!Array.isArray(results)) {
      return { Retour: 'No data' };
    }

    const items = (results as Array<Record<string, unknown>>).map((raw) => ({
      ID_Club: String(raw.id ?? raw.clubId ?? raw.ID_Club ?? ''),
      Club: String(raw.id ?? raw.clubId ?? raw.Club ?? ''),
      NomClub: String(raw.name ?? raw.clubName ?? raw.NomClub ?? ''),
      Nom: String(raw.name ?? raw.clubName ?? raw.Nom ?? ''),
      ...raw,
    }));

    return { Retour: items };
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return { Retour: 'Error fetching club list' };
  }
}
