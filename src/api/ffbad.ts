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
  licence: string,
  knownPersonId?: string
): Promise<LicenceInfoResponse> {
  const session = requireSession();

  // For current user, use their personId directly
  if (licence === session.licence) {
    return fetchPlayerRankings(session.personId, session.accessToken, licence);
  }

  // If we have a personId (e.g. from search results), use it directly
  if (knownPersonId) {
    return fetchPlayerRankings(knownPersonId, session.accessToken, licence);
  }

  // For other players without personId, search to find them
  const searchResponse = await searchPlayersByKeywords(licence);
  if (typeof searchResponse.Retour !== 'string' && searchResponse.Retour.length > 0) {
    const found = searchResponse.Retour[0] as Record<string, unknown>;
    const foundPersonId = found.personId as string | undefined;
    if (foundPersonId) {
      return fetchPlayerRankings(foundPersonId, session.accessToken, licence);
    }
  }

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
  const session = requireSession();
  try {
    const data = (await bridgeGet(
      `/api/person/${personId}/rankings`,
      accessToken,
      session.personId
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
 * Uses myffbad.fr /api/search/ endpoint (POST with filter body).
 *
 * The myffbad.fr site sends: POST /api/search/ with body:
 *   { type: "PERSON", text: "...", page: 0 }
 *
 * Response contains: { persons: [...], currentPage, totalPage }
 * Each person: { personId, personName, clubName, clubId, personLicence }.
 */
export async function searchPlayersByKeywords(
  keywords: string
): Promise<LicenceSearchResponse> {
  const session = requireSession();

  try {
    const data = await bridgePost(
      '/api/search/',
      { type: 'PERSON', text: keywords },
      session.accessToken,
      session.personId
    );

    if (!data || typeof data === 'string') {
      return { Retour: 'No results' };
    }

    const obj = data as Record<string, unknown>;

    // Response shape: { persons: [...], currentPage, totalPage }
    const results = Array.isArray(data)
      ? data
      : (obj.persons ?? obj.results ?? obj.data ?? []);

    if (!Array.isArray(results) || results.length === 0) {
      return { Retour: 'No results' };
    }

    // Transform myffbad.fr response to LicenceInfoItem format
    // Response fields: personId, personName, clubName, clubId, personLicence
    const items = (results as Array<Record<string, unknown>>).map((r) => {
      // personName is "LastName FirstName" — split it
      const fullName = String(r.personName ?? r.name ?? '');
      const parts = fullName.split(' ');
      const nom = parts[0] ?? '';
      const prenom = parts.slice(1).join(' ') ?? '';

      return {
        Licence: String(r.personLicence ?? r.licence ?? r.licenceNumber ?? ''),
        Nom: r.lastName ? String(r.lastName) : nom,
        Prenom: r.firstName ? String(r.firstName) : prenom,
        Club: String(r.clubId ?? r.club ?? ''),
        NomClub: String(r.clubName ?? r.nomClub ?? ''),
        personId: String(r.personId ?? r.id ?? ''),
      };
    });

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
  licence: string,
  knownPersonId?: string
): Promise<PlayerProfile | null> {
  const response = await getLicenceInfo(licence, knownPersonId);

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
 * Format an ISO date string to a readable French format: "DD/MM/YYYY".
 */
function formatDateFR(dateStr: string | null | undefined): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr as string);
  if (isNaN(d.getTime())) return dateStr as string;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Infer discipline from the event name when the API returns discipline: null.
 *
 * myffbad.fr event names often contain discipline keywords or use naming patterns
 * like "SH" (Simple Homme), "DD" (Double Dame), "MX" (Mixte), etc.
 */
function inferDisciplineFromName(name: string | undefined, subName: string | undefined): string | undefined {
  const text = `${name ?? ''} ${subName ?? ''}`.toUpperCase();
  // Check for common discipline indicators in tournament/matchup names
  if (/\bSIMPLE\b|\bSH\b|\bSD\b/.test(text)) return 'S';
  if (/\bDOUBLE\b|\bDH\b|\bDD\b/.test(text)) return 'D';
  if (/\bMIXTE\b|\bMX\b|\bDMX\b/.test(text)) return 'M';
  return undefined;
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

  // Format the date for display (ISO → DD/MM/YYYY)
  const formattedDate = formatDateFR(raw.date as string | null | undefined);

  // Try to get discipline from API field, or infer from event name
  const discipline = (raw.discipline as string | null) ??
    inferDisciplineFromName(raw.name as string | undefined, raw.subName as string | undefined);

  // Show winPoint as score indicator (e.g. "+43 pts" or "-7 pts")
  let score: string | undefined;
  if (winPoint != null && winPoint !== 0) {
    const sign = winPoint > 0 ? '+' : '';
    score = `${sign}${winPoint} pts`;
  }

  // Extract score from brackets if available (detailed match data)
  const brackets = raw.brackets as Array<Record<string, unknown>> | undefined;
  if (brackets && brackets.length > 0) {
    const setScores = brackets.map((b) => {
      const s1 = b.score1 ?? b.playerScore ?? b.scoreA;
      const s2 = b.score2 ?? b.opponentScore ?? b.scoreB;
      if (s1 != null && s2 != null) return `${s1}-${s2}`;
      return null;
    }).filter(Boolean);
    if (setScores.length > 0) {
      score = setScores.join(' ');
    }
  }

  return {
    Date: formattedDate,
    Epreuve: raw.name,
    Competition: raw.name,
    Discipline: discipline,
    Points: winPoint,
    Resultat: resultat,
    Score: score,
    // subName often contains the matchup (e.g. "94-CALB-2 contre 94-VSSM-6")
    Adversaire: raw.subName,
    // Keep original date for season computation
    _rawDate: raw.date,
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

    // myffbad.fr returns an object keyed by index: {"0": {...}, "1": {...}, ...}
    // Convert to array if needed
    let results: Array<Record<string, unknown>>;
    if (Array.isArray(data)) {
      results = data as Array<Record<string, unknown>>;
    } else if (data && typeof data === 'object') {
      // Object with numeric keys — convert to array
      const obj = data as Record<string, unknown>;
      if (obj.results && Array.isArray(obj.results)) {
        results = obj.results as Array<Record<string, unknown>>;
      } else {
        // Try converting numeric-keyed object to array
        const keys = Object.keys(obj).filter((k) => /^\d+$/.test(k));
        if (keys.length > 0) {
          results = keys
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map((k) => obj[k] as Record<string, unknown>);
        } else {
          return { Retour: 'No data' };
        }
      }
    } else {
      return { Retour: 'No data' };
    }

    if (results.length === 0) {
      return { Retour: 'No data' };
    }

    // myffbad.fr evolution items have PascalCase fields:
    //   RankingDate, SimpleSubLevel, SimpleRate, DoubleSubLevel, DoubleRate,
    //   MixteSubLevel, MixteRate, SimpleRank, DoubleRank, MixteRank
    // We need to expand each item into 3 discipline-specific entries
    const items: Array<Record<string, unknown>> = [];
    for (const raw of results) {
      const date = String(raw.RankingDate ?? raw.rankingDate ?? raw.Date ?? raw.date ?? '');

      // Simple
      const simpleRate = raw.SimpleRate ?? raw.simpleRate;
      const simpleLevel = raw.SimpleSubLevel ?? raw.simpleSubLevel;
      if (simpleRate != null || simpleLevel) {
        items.push({
          Date: date,
          Classement: String(simpleLevel ?? 'NC'),
          Points: simpleRate,
          CPPH: simpleRate,
          Discipline: 'S',
        });
      }

      // Double
      const doubleRate = raw.DoubleRate ?? raw.doubleRate;
      const doubleLevel = raw.DoubleSubLevel ?? raw.doubleSubLevel;
      if (doubleRate != null || doubleLevel) {
        items.push({
          Date: date,
          Classement: String(doubleLevel ?? 'NC'),
          Points: doubleRate,
          CPPH: doubleRate,
          Discipline: 'D',
        });
      }

      // Mixte
      const mixteRate = raw.MixteRate ?? raw.mixteRate;
      const mixteLevel = raw.MixteSubLevel ?? raw.mixteSubLevel;
      if (mixteRate != null || mixteLevel) {
        items.push({
          Date: date,
          Classement: String(mixteLevel ?? 'NC'),
          Points: mixteRate,
          CPPH: mixteRate,
          Discipline: 'M',
        });
      }
    }

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
 * Club information returned by the API.
 */
export interface ClubInfo {
  id: string;
  name: string;
  initials: string;
  city: string;
  department: number;
  address: string;
  mail: string;
  phone: string;
  website: string;
  logo: string;
}

/**
 * Get club information.
 * Uses myffbad.fr /api/club/{clubId}/informations/ endpoint.
 */
export async function getClubInfo(
  clubId: string
): Promise<ClubInfo | null> {
  const session = requireSession();

  try {
    const data = (await bridgeGet(
      `/api/club/${clubId}/informations/`,
      session.accessToken,
      session.personId
    )) as Record<string, unknown>;

    if (!data || typeof data === 'string') {
      return null;
    }

    const addr = data.address as Record<string, unknown> | undefined;

    return {
      id: clubId,
      name: String(data.name ?? ''),
      initials: String(data.initials ?? ''),
      city: String(data.city ?? ''),
      department: (data.department as number) ?? 0,
      address: addr ? String(addr.address ?? '') : '',
      mail: String(data.mail ?? ''),
      phone: String(data.contact ?? data.mobile ?? ''),
      website: String(data.website ?? ''),
      logo: String(data.logo ?? ''),
    };
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return null;
  }
}

/**
 * Get rankings for all members of a club.
 * Uses myffbad.fr /api/club/{clubId} endpoints.
 *
 * Note: The myffbad.fr API may not expose a club members endpoint.
 * Returns empty array if no members endpoint is found.
 */
export async function getClubLeaderboard(
  clubId: string,
  clubInitials?: string
): Promise<ClubRankingResponse> {
  const session = requireSession();

  try {
    // Get club initials if not provided (needed for player search)
    let initials = clubInitials;
    if (!initials) {
      const info = await getClubInfo(clubId);
      initials = info?.initials || '';
    }

    if (!initials) {
      return { Retour: [] };
    }

    // Search for players by club initials using the same search endpoint
    // that searchPlayersByKeywords uses (POST /api/search/). The club's
    // initials (e.g., "CALB94") match only players from that club.
    const result = await bridgePost(
      '/api/search/',
      { type: 'PERSON', text: initials },
      session.accessToken,
      session.personId
    );

    if (!result || typeof result === 'string') {
      return { Retour: [] };
    }

    const data = result as Record<string, unknown>;
    const persons = (data.persons ?? data.results ?? data.data ?? []) as Array<Record<string, unknown>>;

    if (!Array.isArray(persons) || persons.length === 0) {
      return { Retour: [] };
    }

    // The search by club initials already returns only members of this club,
    // so no additional filtering by clubId is needed.
    const allPersons = persons;

    if (allPersons.length === 0) {
      return { Retour: [] };
    }

    // Map player search results to the expected leaderboard format.
    // The search API returns nested objects:
    //   { name, licence, rank: { simpleSubLevel, doubleSubLevel, mixteSubLevel },
    //     club: { id, name, acronym }, ... }
    const items = allPersons.map((raw) => {
      const rank = (raw.rank as Record<string, unknown>) ?? {};
      const club = (raw.club as Record<string, unknown>) ?? {};
      const fullName = String(raw.name ?? '');
      // Name format is "Firstname LASTNAME" or "LASTNAME Firstname"
      const nameParts = fullName.split(' ');
      const prenom = nameParts[0] || '';
      const nom = nameParts.slice(1).join(' ') || fullName;

      return {
        Licence: String(raw.licence ?? ''),
        Nom: nom,
        Prenom: prenom,
        Club: String(club.id ?? clubId),
        NomClub: String(club.name ?? ''),
        ClassementSimple: String(rank.simpleSubLevel ?? ''),
        ClassementDouble: String(rank.doubleSubLevel ?? ''),
        ClassementMixte: String(rank.mixteSubLevel ?? ''),
        // CPPH not available from search endpoint
        ...raw,
      };
    });

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
