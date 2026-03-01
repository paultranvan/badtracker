import { bridgeLogin, bridgeGet, bridgePost } from './webview-bridge';
import type {
  LicenceInfoResponse,
  LicenceSearchResponse,
  ResultByLicenceResponse,
  RankingEvolutionResponse,
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
  personId?: string;
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
    personId: (raw.personId as string) ?? knownPersonId,
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
 * Enrich result items with detailed match data (opponent names, set scores, etc.)
 * by calling /result/detail for each item in parallel.
 *
 * Each detail call requires: date (YYYY-MM-DD), discipline (number), bracketId.
 * Items missing these IDs are returned unchanged.
 * Detail failures are silently ignored (the item keeps its original data).
 */
async function enrichWithDetails(
  items: Array<Record<string, unknown>>,
  personId: string
): Promise<Array<Record<string, unknown>>> {
  const session = requireSession();

  // Fetch details in parallel, with a concurrency limit to avoid flooding
  const detailPromises = items.map(async (item) => {
    const date = item.date as string | null;
    const disciplineId = item.disciplineId as number | null;
    const bracketId = item.bracketId as number | null;

    // Skip items without required IDs
    if (!date || disciplineId == null || bracketId == null) return item;

    try {
      const dateOnly = date.includes('T') ? date.split('T')[0] : date;
      const detail = await bridgePost(
        `/api/person/${personId}/result/detail`,
        { date: dateOnly, discipline: disciplineId, bracketId },
        session.accessToken,
        session.personId
      );

      if (!detail || typeof detail !== 'object') return item;
      const d = detail as Record<string, unknown>;

      return { ...item, _detail: d };
    } catch {
      return item;
    }
  });

  return Promise.all(detailPromises);
}

/**
 * Fetches match results for a player.
 *
 * Uses myffbad.fr /api/person/{personId}/result/Decade endpoint which returns
 * 10 years of results with all IDs populated (eventId, disciplineId, bracketId, roundId)
 * and discipline names like "SIMPLE HOMMES", "DOUBLE HOMMES", "MIXTE".
 *
 * Returns raw result items WITHOUT detail enrichment — details are fetched lazily.
 * Also returns _rawItems for lazy detail loading later.
 *
 * @param licence - Player's licence number
 * @param knownPersonId - If provided, used directly for the API call.
 *   Otherwise falls back to session personId when licence matches the current user.
 */
export async function getResultsByLicence(
  licence: string,
  knownPersonId?: string
): Promise<ResultByLicenceResponse & { _rawItems?: Array<Record<string, unknown>> }> {
  const session = requireSession();

  // Use provided personId, or fall back to current user's personId if licence matches
  const personId = knownPersonId ?? (licence === session.licence ? session.personId : null);

  if (!personId) {
    // For other players without a known personId, we can't fetch results
    return { Retour: [] };
  }

  try {
    const data = await bridgeGet(
      `/api/person/${personId}/result/Decade`,
      session.accessToken,
      session.personId  // Always the logged-in user's personId
    );

    if (!data) {
      return { Retour: 'No results' };
    }

    const results = Array.isArray(data) ? data : ((data as Record<string, unknown>).results ?? data);

    if (!Array.isArray(results)) {
      return { Retour: 'No results' };
    }

    const rawItems = results as Array<Record<string, unknown>>;

    // Transform to the ResultItem format expected by consumers (no detail enrichment)
    const items = rawItems.map(transformResultItem);

    return { Retour: items, _rawItems: rawItems };
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return { Retour: 'Error fetching results' };
  }
}

/**
 * Fetch detail data for a set of result items (on-demand, when a discipline group is expanded).
 * Calls /result/detail for each item in parallel, then expands into individual matches.
 *
 * Items missing required IDs (date, disciplineId, bracketId) are returned as-is.
 */
export async function getMatchDetailsForBrackets(
  items: Array<Record<string, unknown>>,
  personId: string
): Promise<Array<Record<string, unknown>>> {
  const enriched = await enrichWithDetails(items, personId);
  const expanded = enriched.flatMap((item) => expandWithDetail(item, personId));
  return expanded.map(transformResultItem);
}

/**
 * Fetch detailed match data for a single result item.
 * Uses POST /api/person/{personId}/result/detail with:
 *   - date: YYYY-MM-DD format (not full ISO)
 *   - discipline: disciplineId number (field name is "discipline", not "disciplineId")
 *   - bracketId: bracket identifier from /result/actual
 *
 * Returns enriched data: opponent names/licences, set scores, round info, partner.
 * Returns null if the detail endpoint fails (Hypercube limitation for some matches).
 */
export async function getMatchDetail(
  personId: string,
  date: string,
  discipline: number,
  bracketId: number
): Promise<Record<string, unknown> | null> {
  const session = requireSession();

  try {
    // Format date as YYYY-MM-DD (truncate time portion from ISO string)
    const dateOnly = date.includes('T') ? date.split('T')[0] : date;

    const data = await bridgePost(
      `/api/person/${personId}/result/detail`,
      { date: dateOnly, discipline, bracketId },
      session.accessToken,
      session.personId
    );

    if (!data || typeof data !== 'object') return null;
    return data as Record<string, unknown>;
  } catch {
    // Hypercube service may fail for some matches — this is expected
    return null;
  }
}

/**
 * Expand a single /result/actual item with its _detail array into individual match items.
 *
 * The detail response is an array of matches for that bracket (pool play, knockout rounds, etc.).
 * Each detail match has top/bottom sides with player info. We find the logged-in user's side
 * and extract opponent names, partner, set scores, and round info.
 *
 * If no detail data exists, returns the original item unchanged (as a single-element array).
 */
function expandWithDetail(
  item: Record<string, unknown>,
  loggedInPersonId: string
): Array<Record<string, unknown>> {
  const detail = item._detail;
  if (!detail || !Array.isArray(detail) || detail.length === 0) {
    // No detail data — return item as-is
    return [item];
  }

  return (detail as Array<Record<string, unknown>>).map((match) => {
    const top = match.top as Record<string, unknown> | undefined;
    const bottom = match.bottom as Record<string, unknown> | undefined;

    if (!top || !bottom) return { ...item };

    const topPersons = top.Persons as Record<string, Record<string, unknown>> | undefined;
    const bottomPersons = bottom.Persons as Record<string, Record<string, unknown>> | undefined;

    if (!topPersons || !bottomPersons) return { ...item };

    // Determine which side the logged-in user is on
    const userInTop = loggedInPersonId in topPersons;
    const userSide = userInTop ? topPersons : bottomPersons;
    const opponentSide = userInTop ? bottomPersons : topPersons;

    // Extract opponent name(s) and licence(s)
    const opponentEntries = Object.entries(opponentSide);
    const opp1 = opponentEntries[0]?.[1];
    const opp2 = opponentEntries.length > 1 ? opponentEntries[1]?.[1] : undefined;

    // Extract partner (same side, other person — for doubles/mixed)
    const partnerEntries = Object.entries(userSide).filter(([id]) => id !== loggedInPersonId);
    const partner = partnerEntries[0]?.[1];

    // Extract set scores — detail gives scoreWinner/scoreLoser arrays
    const scoreWinner = match.scoreWinner as string[] | undefined;
    const scoreLoser = match.scoreLoser as string[] | undefined;
    const userIsWinner = userInTop ? top.IsWinner === '1' : bottom.IsWinner === '1';

    let setScoresStr: string | undefined;
    if (scoreWinner && scoreLoser && scoreWinner.length > 0) {
      // Build set scores from the user's perspective
      const userScores = userIsWinner ? scoreWinner : scoreLoser;
      const oppScores = userIsWinner ? scoreLoser : scoreWinner;
      const sets = userScores.map((s, i) => `${s}-${oppScores[i] ?? '?'}`);
      setScoresStr = sets.join(' / ');
    }

    // Combine roundName + roundPositionName for pool-stage matches
    // e.g. roundName="Poule", roundPositionName="1" → "Poule 1"
    const baseRoundName = match.roundName as string | undefined;
    const roundPosition = match.roundPositionName as string | undefined;
    let roundName: string | undefined;
    if (baseRoundName && roundPosition) {
      roundName = `${baseRoundName} ${roundPosition}`;
    } else {
      roundName = roundPosition ?? baseRoundName;
    }

    // WinPoints from the user's entry in the detail
    const userEntry = userSide[loggedInPersonId];
    const detailWinPoints = userEntry?.WinPoints as number | undefined;

    // Detect actual discipline from detail data
    // If user has a partner, check if API discipline string hints at mixed
    let detailDiscipline: string | undefined;
    const parentDisc = (item.discipline as string) ?? '';
    if (partner) {
      // Has partner = doubles or mixed
      if (parentDisc.toUpperCase().includes('MIXTE') || parentDisc.toUpperCase().includes('MX')) {
        detailDiscipline = 'M';
      }
      // Also check match-level discipline info from detail API
      const discName = (match.disciplineName as string) ?? (match.discipline as string) ?? '';
      if (discName.toUpperCase().includes('MIXTE') || discName.toUpperCase().includes('MX')) {
        detailDiscipline = 'M';
      }
    }

    return {
      ...item,
      // Clear parent-level winPoint — it's the aggregate for the whole bracket,
      // not per-match. Use detail-level WinPoints instead (if available).
      winPoint: detailWinPoints ?? undefined,
      // Override discipline from detail if detected
      ...(detailDiscipline ? { _detailDiscipline: detailDiscipline } : {}),
      // Override with detail data
      _detailOpponent: opp1?.PersonName as string | undefined,
      _detailOpponentLicence: opp1?.PersonLicence as string | undefined,
      _detailOpponent2: opp2?.PersonName as string | undefined,
      _detailOpponent2Licence: opp2?.PersonLicence as string | undefined,
      _detailPartner: partner?.PersonName as string | undefined,
      _detailPartnerLicence: partner?.PersonLicence as string | undefined,
      _detailSetScores: setScoresStr,
      _detailScore: match.score as string | undefined,
      _detailRound: roundName,
      _detailIsWinner: userIsWinner,
      // Remove _detail to avoid passing raw data downstream
      _detail: undefined,
    };
  });
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
/**
 * Map a full discipline string from myffbad.fr to a short code.
 * E.g. "SIMPLE HOMMES" -> "S", "DOUBLE HOMMES" -> "D", "MIXTE" -> "M"
 *
 * IMPORTANT: MIXTE must be checked before DOUBLE because the API sometimes
 * classifies mixed doubles as "DOUBLE HOMMES". Checking MIXTE first prevents
 * misclassification.
 */
function mapDisciplineCode(disc: string): string | undefined {
  const upper = disc.toUpperCase();
  if (upper.includes('SIMPLE')) return 'S';
  if (upper.includes('MIXTE')) return 'M';  // Must come before DOUBLE
  if (upper.includes('DOUBLE')) return 'D';
  return undefined;
}

function inferDisciplineFromName(name: string | undefined, subName: string | undefined): string | undefined {
  const text = `${name ?? ''} ${subName ?? ''}`.toUpperCase();
  // Check for common discipline indicators in tournament/matchup names
  // Includes Interclub patterns: SH1, SD2, DH1, DD2, MX1, DMX1, etc.
  if (/\bSIMPLE\b|\bSH\d?\b|\bSD\d?\b/.test(text)) return 'S';
  if (/\bDOUBLE\b|\bDH\d?\b|\bDD\d?\b/.test(text)) return 'D';
  if (/\bMIXTE\b|\bMX\d?\b|\bDMX\d?\b/.test(text)) return 'M';
  return undefined;
}

/**
 * Parse interclub subName patterns like "94-CALB-2 contre 94-VBC-3"
 * into a cleaner "CALB-2 vs VBC-3" format.
 */
function parseInterclubSubName(subName: string): { team1: string; team2: string } | null {
  // Pattern: "XX-ABCD-N contre XX-EFGH-N" where XX=department, ABCD=club code, N=team number
  const match = subName.match(/^\d{2,3}-([A-Z]+)-(\d+)\s+contre\s+\d{2,3}-([A-Z]+)-(\d+)$/i);
  if (!match) return null;
  return { team1: `${match[1]}-${match[2]}`, team2: `${match[3]}-${match[4]}` };
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
  } else if (winPoint != null && winPoint <= 0) {
    resultat = 'D';
  }

  // Format the date for display (ISO -> DD/MM/YYYY)
  const formattedDate = formatDateFR(raw.date as string | null | undefined);

  // Map discipline from API (e.g. "SIMPLE HOMMES" -> "S", "DOUBLE HOMMES" -> "D", "MIXTE" -> "M")
  // Prefer detail-level discipline override if available (fixes mixed-as-double misclassification)
  const detailDisc = raw._detailDiscipline as string | undefined;
  const rawDisc = raw.discipline as string | null;
  const discipline = detailDisc
    ?? (rawDisc ? mapDisciplineCode(rawDisc) : undefined)
    ?? inferDisciplineFromName(raw.name as string | undefined, raw.subName as string | undefined);

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

  // Use detail data for opponent, partner, scores, round if available
  const detailOpponent = raw._detailOpponent as string | undefined;
  const detailOpponentLicence = raw._detailOpponentLicence as string | undefined;
  const detailOpponent2 = raw._detailOpponent2 as string | undefined;
  const detailOpponent2Licence = raw._detailOpponent2Licence as string | undefined;
  const detailPartner = raw._detailPartner as string | undefined;
  const detailPartnerLicence = raw._detailPartnerLicence as string | undefined;
  const detailSetScores = raw._detailSetScores as string | undefined;
  const detailScore = raw._detailScore as string | undefined;
  const detailRound = raw._detailRound as string | undefined;
  const detailIsWinner = raw._detailIsWinner as boolean | undefined;

  // Override win/loss from detail if available (more reliable than winPoint sign)
  if (detailIsWinner != null) {
    resultat = detailIsWinner ? 'V' : 'D';
  }

  // Use detail score (e.g. "21-17 / 21-18") over winPoint-derived score
  if (detailScore) {
    score = detailScore;
  }

  // Clean up interclub opponent names (e.g. "94-CALB-2 contre 94-VSSM-6" -> "CALB-2 vs VSSM-6")
  const interclub = parseInterclubSubName(raw.subName as string ?? '');
  const fallbackAdversaire = interclub
    ? `${interclub.team1} vs ${interclub.team2}`
    : raw.subName;

  return {
    // Spread raw first so explicit fields below take precedence
    ...raw,
    Date: formattedDate,
    DateCompetition: formattedDate,
    Epreuve: raw.name,
    Competition: raw.name,
    Discipline: discipline,
    Points: winPoint,
    Resultat: resultat,
    Score: score,
    Adversaire: detailOpponent ?? fallbackAdversaire,
    AdversaireLicence: detailOpponentLicence,
    Adversaire2: detailOpponent2,
    Adversaire2Licence: detailOpponent2Licence,
    Partenaire: detailPartner,
    PartenaireLicence: detailPartnerLicence,
    Sets: detailSetScores,
    Tour: detailRound,
    // Keep original date for season computation
    _rawDate: raw.date,
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
 * Discipline numbers for /api/search/tops endpoint.
 * 1=Simple Hommes, 2=Simple Dames, 3=Double Hommes,
 * 4=Double Dames, 5=Mixte Hommes, 6=Mixte Dames.
 */
const TOPS_DISCIPLINES = [1, 2, 3, 4, 5, 6] as const;

/**
 * Fetch a player's last (current) club.
 * GET /api/person/{personId}/lastCLub/
 * Returns club initials and id, or null on failure.
 */
export async function getLastClub(
  personId: string
): Promise<{ id: string; initials: string } | null> {
  const session = requireSession();

  try {
    const data = (await bridgeGet(
      `/api/person/${personId}/lastCLub/`,
      session.accessToken,
      session.personId
    )) as Record<string, unknown>;

    if (!data || typeof data === 'string') return null;

    const id = String(data.id ?? data.clubId ?? '');
    const initials = String(data.initials ?? data.acronym ?? '');
    if (!initials) return null;

    return { id, initials };
  } catch {
    return null;
  }
}

/**
 * Fetch club leaderboard using /api/search/tops for all 6 disciplines.
 * Returns raw arrays per discipline for merging by the caller.
 *
 * Partial failures are tolerated — successful disciplines are returned.
 * Throws only if ALL 6 calls fail.
 */
export async function getClubTops(
  clubId: string
): Promise<Array<[number, Array<Record<string, unknown>>]>> {
  const session = requireSession();
  const instanceId = parseInt(clubId, 10);
  const dateFrom = new Date().toISOString();

  const results = await Promise.allSettled(
    TOPS_DISCIPLINES.map(async (discipline) => {
      const data = await bridgePost(
        '/api/search/tops',
        {
          discipline,
          dateFrom,
          top: 500,
          instanceId,
          isFirstLoad: false,
          sort: 'nom-ASC',
        },
        session.accessToken,
        session.personId
      );

      if (!data || !Array.isArray(data)) {
        return [discipline, []] as [number, Array<Record<string, unknown>>];
      }

      return [discipline, data as Array<Record<string, unknown>>] as [number, Array<Record<string, unknown>>];
    })
  );

  const successful = results
    .filter((r): r is PromiseFulfilledResult<[number, Array<Record<string, unknown>>]> => r.status === 'fulfilled')
    .map((r) => r.value);

  if (successful.length === 0) {
    throw new NetworkError('All discipline fetches failed');
  }

  return successful;
}

/**
 * Opponent list item from /api/person/{personId}/opponentList.
 */
export interface OpponentListItem {
  PersonId: string;
  PersonName: string;
  PersonLicence: string;
  MatchCount: number;
  LastDate: string;
}

/**
 * Fetch the logged-in user's full opponent list with match counts.
 *
 * GET /api/person/{personId}/opponentList
 *
 * Returns all opponents across the full match history, each with MatchCount.
 */
export async function getOpponentList(): Promise<OpponentListItem[]> {
  const session = requireSession();

  try {
    const data = await bridgeGet(
      `/api/person/${session.personId}/opponentList`,
      session.accessToken,
      session.personId
    );

    // Response may be a direct array or wrapped in { Retour: [...] }
    if (Array.isArray(data)) return data as OpponentListItem[];
    const response = data as Record<string, unknown>;
    const retour = response.Retour;
    if (!retour || typeof retour === 'string' || !Array.isArray(retour)) return [];
    return retour as OpponentListItem[];
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return [];
  }
}

/**
 * Fetch head-to-head data between the logged-in user and another player.
 *
 * GET /api/person/{myPersonId}/playerOpposition/{theirPersonId}
 *
 * Response shape is discovered at runtime — returned as raw data.
 */
export async function getPlayerOpposition(
  theirPersonId: string
): Promise<unknown> {
  const session = requireSession();

  try {
    const data = await bridgeGet(
      `/api/person/${session.personId}/playerOpposition/${theirPersonId}`,
      session.accessToken,
      session.personId
    );

    return data;
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return null;
  }
}

// ============================================================
// Ranking Levels
// ============================================================

/**
 * A single ranking level with its minimum CPPH thresholds per discipline.
 * Extracted from the FFBaD /api/common/rankingLevel endpoint.
 */
export interface RankingLevel {
  rank: string; // "N1", "N2", ..., "P12", "NC"
  minRates: {
    simple: number;
    double: number;
    mixte: number;
  };
}

/**
 * Fetch official ranking level thresholds from FFBaD.
 *
 * GET /api/common/rankingLevel returns a JSON **string** (not object).
 * The parsed structure contains ValuesLow with per-rank minimum CPPH rates
 * broken down by gender and discipline. We use Men's rates for now.
 *
 * Returns levels sorted descending by simple rate (N1 first, P12 last).
 * NC is excluded (null rates).
 */
export async function getRankingLevels(): Promise<RankingLevel[]> {
  const session = requireSession();

  try {
    const data = await bridgeGet(
      '/api/common/rankingLevel',
      session.accessToken,
      session.personId
    );

    if (!data) return [];

    // Response is a JSON string — parse it
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const valuesLow = parsed?.ValuesLow;

    if (!valuesLow || typeof valuesLow !== 'object') return [];

    const levels: RankingLevel[] = [];

    for (const key of Object.keys(valuesLow)) {
      const entry = valuesLow[key] as Record<string, unknown>;
      const subLevel = entry.SubLevel as string | undefined;
      const menSingleRate = entry.MenSingleRate as string | null | undefined;
      const menDoubleRate = entry.MenDoubleRate as string | null | undefined;
      const menMixteRate = entry.MenMixteRate as string | null | undefined;

      // Skip NC (null rates)
      if (!subLevel || menSingleRate == null) continue;

      const simple = parseFloat(menSingleRate);
      const double_ = parseFloat(menDoubleRate ?? '0');
      const mixte = parseFloat(menMixteRate ?? '0');

      if (isNaN(simple)) continue;

      levels.push({
        rank: subLevel,
        minRates: {
          simple,
          double: isNaN(double_) ? 0 : double_,
          mixte: isNaN(mixte) ? 0 : mixte,
        },
      });
    }

    // Sort descending by simple rate (highest rank first)
    levels.sort((a, b) => b.minRates.simple - a.minRates.simple);

    return levels;
  } catch (err) {
    if (err instanceof AuthError || err instanceof NetworkError) throw err;
    return [];
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
