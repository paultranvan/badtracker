import type { MatchItem } from './matchHistory';
import { RANK_BOUNDARIES } from './rankings';
import type { OpponentListItem } from '../api/ffbad';

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
  nemesis: {
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

export function computeNemesis(matches: MatchItem[]): InsightsData['nemesis'] {
  const byOpponent = new Map<string, { name: string; licence: string; wins: number; losses: number }>();

  for (const m of matches) {
    if (!m.opponentLicence || !m.opponent || m.isWin === undefined) continue;
    const stats = byOpponent.get(m.opponentLicence) ?? { name: m.opponent, licence: m.opponentLicence, wins: 0, losses: 0 };
    if (m.isWin) stats.wins++;
    else stats.losses++;
    byOpponent.set(m.opponentLicence, stats);
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

export function computeAllInsights(
  matches: MatchItem[],
  opponents: OpponentListItem[]
): InsightsData {
  return {
    winStreak: computeWinStreak(matches),
    recentForm: computeRecentForm(matches),
    biggestUpset: computeBiggestUpset(matches),
    cpphMomentum: computeCpphMomentum(matches),
    bestTournament: computeBestTournament(matches),
    bestPartner: computeBestPartner(matches),
    nemesis: computeNemesis(matches),
    mostPlayed: computeMostPlayed(opponents),
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
  | 'nemesis'
  | 'mostPlayed';

export const INSIGHT_TYPES: readonly InsightType[] = [
  'winStreak',
  'recentForm',
  'biggestUpset',
  'cpphMomentum',
  'bestTournament',
  'bestPartner',
  'nemesis',
  'mostPlayed',
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
    case 'bestTournament':
      return insights.bestTournament
        ? matches.filter((m) => m.tournament === insights.bestTournament!.name)
        : [];
    case 'bestPartner':
      return insights.bestPartner
        ? matches.filter((m) => m.partnerLicence === insights.bestPartner!.licence)
        : [];
    case 'nemesis':
      return insights.nemesis
        ? matches.filter((m) => m.opponentLicence === insights.nemesis!.licence)
        : [];
    case 'mostPlayed':
      return insights.mostPlayed
        ? matches.filter((m) => m.opponentLicence === insights.mostPlayed!.licence)
        : [];
  }
}

function getWinStreakMatches(matches: MatchItem[]): MatchItem[] {
  // matches is desc-sorted. Walk oldest→newest; collect matches in longest streak.
  // Mirrors computeWinStreak: `undefined` neither extends nor resets.
  let maxStreakMatches: MatchItem[] = [];
  let curStreak: MatchItem[] = [];

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.isWin === true) {
      curStreak.push(m);
      if (curStreak.length > maxStreakMatches.length) {
        maxStreakMatches = curStreak.slice();
      }
    } else if (m.isWin === false) {
      curStreak = [];
    }
  }

  if (maxStreakMatches.length < 2) return [];
  // Collected oldest→newest; caller expects desc order (newest first)
  return maxStreakMatches.reverse();
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
