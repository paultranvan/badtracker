import type { MatchItem } from './matchHistory';
import { RANK_BOUNDARIES, getRankProgress } from './rankings';
import type { OpponentListItem, PlayerProfile, RankingLevel } from '../api/ffbad';

export interface InsightsData {
  winStreak: { count: number } | null;
  recentForm: { results: boolean[] } | null;
  biggestUpset: {
    opponentRank: string;
    playerRank: string;
    opponentName: string;
    tournament: string;
    date: string;
  } | null;
  cpphMomentum: { total: number; matchCount: number } | null;
  bestTournament: {
    name: string;
    wins: number;
    losses: number;
    winRate: number;
  } | null;
  bestPartner: {
    name: string;
    licence: string;
    matchCount: number;
    winRate: number;
  } | null;
  mostPlayedPartner: {
    name: string;
    licence: string;
    matchCount: number;
    winRate: number;
  } | null;
  nemesis: {
    name: string;
    licence: string;
    wins: number;
    losses: number;
  } | null;
  mostDefeated: {
    name: string;
    licence: string;
    wins: number;
    losses: number;
  } | null;
  mostPlayed: {
    name: string;
    licence: string;
    matchCount: number;
    lastDate: string;
  } | null;
  rankingProjection: {
    discipline: 'simple' | 'double' | 'mixte';
    currentRank: string;
    currentCpph: number;
    nextRank: string;
    gap: number;           // CPPH to next rank, rounded 1 decimal
    avgPointsPerWin: number; // average pointsImpact across recent wins in this discipline
    estimatedWins: number;   // ceil(gap / avgPointsPerWin)
  } | null;
}

/** Rank index derived from RANK_BOUNDARIES: lower = stronger. N1=0, NC=12. */
const RANK_ORDER: Record<string, number> = Object.fromEntries(
  RANK_BOUNDARIES.map((b, i) => [b.rank, i])
);

function rankIndex(rank: string | undefined): number | null {
  if (!rank) return null;
  return RANK_ORDER[rank] ?? null;
}

/**
 * All compute* functions expect matches sorted date-descending
 * (as returned by useDashboardData.allDetailMatches).
 */

export function computeWinStreak(matches: MatchItem[]): { count: number } | null {
  // Input is desc-sorted; walk in reverse for ascending order
  let maxStreak = 0;
  let currentStreak = 0;

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.isWin === true) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else if (m.isWin === false) {
      currentStreak = 0;
    }
  }

  return maxStreak >= 2 ? { count: maxStreak } : null;
}

export function computeRecentForm(matches: MatchItem[]): { results: boolean[] } | null {
  // Input is desc-sorted; take first 5 with known results
  const last5: boolean[] = [];
  for (const m of matches) {
    if (m.isWin !== undefined) {
      last5.push(m.isWin);
      if (last5.length === 5) break;
    }
  }

  if (last5.length < 3) return null;

  // Reverse so oldest is first (left to right = chronological)
  return { results: last5.reverse() };
}

export function computeBiggestUpset(matches: MatchItem[]): InsightsData['biggestUpset'] {
  let bestGap = 0;
  let bestMatch: MatchItem | null = null;

  for (const m of matches) {
    if (m.isWin !== true) continue;
    const oppIdx = rankIndex(m.opponentRank);
    const playerIdx = rankIndex(m.playerRank);
    if (oppIdx === null || playerIdx === null) continue;

    // Gap > 0 means player was ranked lower (weaker) than opponent
    const gap = playerIdx - oppIdx;
    if (gap > bestGap) {
      bestGap = gap;
      bestMatch = m;
    }
  }

  if (!bestMatch || bestGap < 2) return null;

  return {
    opponentRank: bestMatch.opponentRank!,
    playerRank: bestMatch.playerRank!,
    opponentName: bestMatch.opponent ?? '',
    tournament: bestMatch.tournament ?? '',
    date: bestMatch.date ?? '',
  };
}

export function computeCpphMomentum(matches: MatchItem[]): { total: number; matchCount: number } | null {
  // Input is desc-sorted; filter and take first 10
  const last10: MatchItem[] = [];
  for (const m of matches) {
    if (m.pointsImpact != null && m.pointsImpact !== 0) {
      last10.push(m);
      if (last10.length === 10) break;
    }
  }

  if (last10.length < 3) return null;

  const total = last10.reduce((sum, m) => sum + (m.pointsImpact ?? 0), 0);
  return { total: Math.round(total * 10) / 10, matchCount: last10.length };
}

export function computeBestTournament(matches: MatchItem[]): InsightsData['bestTournament'] {
  const byTournament = new Map<string, { wins: number; losses: number }>();

  for (const m of matches) {
    if (!m.tournament || m.isWin === undefined) continue;
    const stats = byTournament.get(m.tournament) ?? { wins: 0, losses: 0 };
    if (m.isWin) stats.wins++;
    else stats.losses++;
    byTournament.set(m.tournament, stats);
  }

  let best: InsightsData['bestTournament'] = null;
  let bestRate = 0;

  for (const [name, stats] of byTournament) {
    const total = stats.wins + stats.losses;
    if (total < 3) continue;
    const winRate = Math.round((stats.wins / total) * 100);
    if (winRate > bestRate || (winRate === bestRate && best && total > best.wins + best.losses)) {
      bestRate = winRate;
      best = { name, wins: stats.wins, losses: stats.losses, winRate };
    }
  }

  return best;
}

export function computeBestPartner(matches: MatchItem[]): InsightsData['bestPartner'] {
  const byPartner = new Map<string, { name: string; licence: string; wins: number; total: number }>();

  for (const m of matches) {
    if (!m.partnerLicence || !m.partner || m.isWin === undefined) continue;
    const stats = byPartner.get(m.partnerLicence) ?? { name: m.partner, licence: m.partnerLicence, wins: 0, total: 0 };
    stats.total++;
    if (m.isWin) stats.wins++;
    byPartner.set(m.partnerLicence, stats);
  }

  let best: InsightsData['bestPartner'] = null;
  let bestRate = 0;

  for (const [, stats] of byPartner) {
    if (stats.total < 3) continue;
    const winRate = Math.round((stats.wins / stats.total) * 100);
    if (winRate > bestRate || (winRate === bestRate && best && stats.total > best.matchCount)) {
      bestRate = winRate;
      best = { name: stats.name, licence: stats.licence, matchCount: stats.total, winRate };
    }
  }

  return best;
}

export function computeMostPlayedPartner(matches: MatchItem[]): InsightsData['mostPlayedPartner'] {
  const byPartner = new Map<string, { name: string; licence: string; wins: number; total: number }>();

  for (const m of matches) {
    if (!m.partnerLicence || !m.partner || m.isWin === undefined) continue;
    const stats = byPartner.get(m.partnerLicence) ?? { name: m.partner, licence: m.partnerLicence, wins: 0, total: 0 };
    stats.total++;
    if (m.isWin) stats.wins++;
    byPartner.set(m.partnerLicence, stats);
  }

  let top: InsightsData['mostPlayedPartner'] = null;
  let mostMatches = 0;

  for (const [, stats] of byPartner) {
    if (stats.total < 2) continue;
    if (stats.total > mostMatches) {
      mostMatches = stats.total;
      const winRate = Math.round((stats.wins / stats.total) * 100);
      top = { name: stats.name, licence: stats.licence, matchCount: stats.total, winRate };
    }
  }

  return top;
}

export function computeMostDefeated(matches: MatchItem[]): InsightsData['mostDefeated'] {
  const byOpponent = new Map<string, { name: string; licence: string; wins: number; losses: number }>();

  // Count both opponent positions for doubles, same as computeNemesis.
  const addResult = (
    name: string | undefined,
    licence: string | undefined,
    isWin: boolean
  ) => {
    if (!licence || !name) return;
    const stats = byOpponent.get(licence) ?? { name, licence, wins: 0, losses: 0 };
    if (isWin) stats.wins++;
    else stats.losses++;
    byOpponent.set(licence, stats);
  };

  for (const m of matches) {
    if (m.isWin === undefined) continue;
    addResult(m.opponent, m.opponentLicence, m.isWin);
    addResult(m.opponent2, m.opponent2Licence, m.isWin);
  }

  let best: InsightsData['mostDefeated'] = null;
  let mostWins = 0;

  for (const [, stats] of byOpponent) {
    if (stats.wins < 2) continue;
    if (stats.wins > mostWins) {
      mostWins = stats.wins;
      best = { name: stats.name, licence: stats.licence, wins: stats.wins, losses: stats.losses };
    }
  }

  return best;
}

export function computeNemesis(matches: MatchItem[]): InsightsData['nemesis'] {
  const byOpponent = new Map<string, { name: string; licence: string; wins: number; losses: number }>();

  // For doubles, count both opponents on the opposing side. A single loss
  // contributes 1 loss to each of the two adversaries — they both beat us.
  const addResult = (
    name: string | undefined,
    licence: string | undefined,
    isWin: boolean
  ) => {
    if (!licence || !name) return;
    const stats = byOpponent.get(licence) ?? { name, licence, wins: 0, losses: 0 };
    if (isWin) stats.wins++;
    else stats.losses++;
    byOpponent.set(licence, stats);
  };

  for (const m of matches) {
    if (m.isWin === undefined) continue;
    addResult(m.opponent, m.opponentLicence, m.isWin);
    addResult(m.opponent2, m.opponent2Licence, m.isWin);
  }

  let worst: InsightsData['nemesis'] = null;
  let mostLosses = 0;

  for (const [, stats] of byOpponent) {
    if (stats.losses < 2) continue;
    if (stats.losses > mostLosses) {
      mostLosses = stats.losses;
      worst = { name: stats.name, licence: stats.licence, wins: stats.wins, losses: stats.losses };
    }
  }

  return worst;
}

export function computeMostPlayed(opponents: OpponentListItem[]): InsightsData['mostPlayed'] {
  if (opponents.length === 0) return null;

  let top: OpponentListItem | null = null;
  for (const opp of opponents) {
    if (!top || opp.MatchCount > top.MatchCount) {
      top = opp;
    }
  }

  if (!top || top.MatchCount < 2) return null;

  return {
    name: top.PersonName,
    licence: top.PersonLicence,
    matchCount: top.MatchCount,
    lastDate: top.LastDate,
  };
}

export function computeRankingProjection(
  matches: MatchItem[],
  rankings: PlayerProfile['rankings'] | null | undefined,
  levels: RankingLevel[] | null
): InsightsData['rankingProjection'] {
  if (!rankings || !levels || levels.length === 0) return null;

  const disciplines: Array<'simple' | 'double' | 'mixte'> = ['simple', 'double', 'mixte'];
  let best: InsightsData['rankingProjection'] = null;
  let smallestGap = Infinity;

  for (const disc of disciplines) {
    const r = rankings[disc];
    if (!r || r.cpph == null) continue;

    const progress = getRankProgress(r.cpph, r.classement, disc, levels);
    if (!progress || progress.nextRank == null || progress.pointsToNext == null) continue;
    if (progress.pointsToNext <= 0) continue;

    // Average points per win in this discipline, from detail matches
    const wins = matches.filter(
      (m) => m.discipline === disc && m.isWin === true && m.pointsImpact != null && m.pointsImpact > 0
    );
    if (wins.length < 3) continue;

    const avgPoints = wins.reduce((sum, m) => sum + (m.pointsImpact ?? 0), 0) / wins.length;
    if (avgPoints <= 0) continue;

    const estimatedWins = Math.ceil(progress.pointsToNext / avgPoints);

    if (progress.pointsToNext < smallestGap) {
      smallestGap = progress.pointsToNext;
      best = {
        discipline: disc,
        currentRank: r.classement,
        currentCpph: r.cpph,
        nextRank: progress.nextRank,
        gap: Math.round(progress.pointsToNext * 10) / 10,
        avgPointsPerWin: Math.round(avgPoints * 10) / 10,
        estimatedWins,
      };
    }
  }

  return best;
}

export function computeAllInsights(
  matches: MatchItem[],
  opponents: OpponentListItem[],
  rankings: PlayerProfile['rankings'] | null | undefined,
  levels: RankingLevel[] | null
): InsightsData {
  return {
    winStreak: computeWinStreak(matches),
    recentForm: computeRecentForm(matches),
    biggestUpset: computeBiggestUpset(matches),
    cpphMomentum: computeCpphMomentum(matches),
    bestTournament: computeBestTournament(matches),
    bestPartner: computeBestPartner(matches),
    mostPlayedPartner: computeMostPlayedPartner(matches),
    nemesis: computeNemesis(matches),
    mostDefeated: computeMostDefeated(matches),
    mostPlayed: computeMostPlayed(opponents),
    rankingProjection: computeRankingProjection(matches, rankings, levels),
  };
}

// ============================================================
// Filter: matches backing a given insight
// ============================================================

export type InsightType =
  | 'winStreak'
  | 'recentForm'
  | 'biggestUpset'
  | 'cpphMomentum'
  | 'bestTournament'
  | 'bestPartner'
  | 'mostPlayedPartner'
  | 'nemesis'
  | 'mostDefeated'
  | 'mostPlayed'
  | 'rankingProjection';

export const INSIGHT_TYPES: readonly InsightType[] = [
  'winStreak',
  'recentForm',
  'biggestUpset',
  'cpphMomentum',
  'bestTournament',
  'bestPartner',
  'mostPlayedPartner',
  'nemesis',
  'mostDefeated',
  'mostPlayed',
  'rankingProjection',
];

/**
 * Returns the subset of matches that back a given insight.
 * Input matches must be desc-sorted by date (same invariant as compute* functions).
 * Output preserves desc order (newest first).
 * Returns [] if the insight has no data.
 */
export function getMatchesForInsight(
  type: InsightType,
  matches: MatchItem[],
  insights: InsightsData
): MatchItem[] {
  switch (type) {
    case 'winStreak':
      return getWinStreakMatches(matches);
    case 'recentForm':
      return getRecentFormMatches(matches);
    case 'biggestUpset':
      return getBiggestUpsetMatches(matches);
    case 'cpphMomentum':
      return getCpphMomentumMatches(matches);
    case 'bestTournament': {
      const t = insights.bestTournament;
      return t ? matches.filter((m) => m.tournament === t.name) : [];
    }
    case 'bestPartner': {
      const p = insights.bestPartner;
      return p ? matches.filter((m) => m.partnerLicence === p.licence) : [];
    }
    case 'mostPlayedPartner': {
      const mpp = insights.mostPlayedPartner;
      return mpp ? matches.filter((m) => m.partnerLicence === mpp.licence) : [];
    }
    case 'nemesis': {
      const n = insights.nemesis;
      return n
        ? matches.filter(
            (m) => m.opponentLicence === n.licence || m.opponent2Licence === n.licence,
          )
        : [];
    }
    case 'mostDefeated': {
      const md = insights.mostDefeated;
      return md
        ? matches.filter(
            (m) => m.opponentLicence === md.licence || m.opponent2Licence === md.licence,
          )
        : [];
    }
    case 'mostPlayed': {
      const mp = insights.mostPlayed;
      return mp
        ? matches.filter(
            (m) => m.opponentLicence === mp.licence || m.opponent2Licence === mp.licence,
          )
        : [];
    }
    case 'rankingProjection': {
      const rp = insights.rankingProjection;
      if (!rp) return [];
      return matches.filter(
        (m) =>
          m.discipline === rp.discipline &&
          m.isWin === true &&
          m.pointsImpact != null &&
          m.pointsImpact > 0
      );
    }
  }
}

function getWinStreakMatches(matches: MatchItem[]): MatchItem[] {
  // matches is desc-sorted. Walk oldest→newest (reverse index); track longest streak
  // as [newestIdx, oldestIdx] indices. `undefined` neither extends nor resets,
  // mirroring computeWinStreak.
  let bestNewest = -1;
  let bestOldest = -1;
  let bestLen = 0;
  let curOldest = -1;
  let curLen = 0;

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.isWin === true) {
      if (curLen === 0) curOldest = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestOldest = curOldest;
        bestNewest = i;
      }
    } else if (m.isWin === false) {
      curLen = 0;
    }
  }

  if (bestLen < 2) return [];
  // bestNewest ≤ bestOldest in desc-sorted index space; slice is already desc order
  return matches.slice(bestNewest, bestOldest + 1);
}

function getRecentFormMatches(matches: MatchItem[]): MatchItem[] {
  const last5: MatchItem[] = [];
  for (const m of matches) {
    if (m.isWin !== undefined) {
      last5.push(m);
      if (last5.length === 5) break;
    }
  }
  if (last5.length < 3) return [];
  return last5;
}

function getBiggestUpsetMatches(matches: MatchItem[]): MatchItem[] {
  let bestGap = 0;
  let bestMatch: MatchItem | null = null;

  for (const m of matches) {
    if (m.isWin !== true) continue;
    const oppIdx = rankIndex(m.opponentRank);
    const playerIdx = rankIndex(m.playerRank);
    if (oppIdx === null || playerIdx === null) continue;

    const gap = playerIdx - oppIdx;
    if (gap > bestGap) {
      bestGap = gap;
      bestMatch = m;
    }
  }

  if (!bestMatch || bestGap < 2) return [];
  return [bestMatch];
}

function getCpphMomentumMatches(matches: MatchItem[]): MatchItem[] {
  const last10: MatchItem[] = [];
  for (const m of matches) {
    if (m.pointsImpact != null && m.pointsImpact !== 0) {
      last10.push(m);
      if (last10.length === 10) break;
    }
  }
  if (last10.length < 3) return [];
  return last10;
}
