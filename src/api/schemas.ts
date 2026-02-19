import { z } from 'zod';

/**
 * Zod schemas for FFBaD API responses.
 *
 * The FFBaD API returns JSON with a `Retour` field containing results.
 * On error, `Retour` may be a string message instead of data.
 * All object schemas use `.passthrough()` to avoid breaking on unknown fields.
 */

// ============================================================
// Account / Authentication
// ============================================================

/**
 * Response from ws_getaccountpoona (credential validation).
 * Success: Retour contains an array with account info.
 * Failure: Retour is a string error message.
 */
const AccountInfoItem = z
  .object({
    Licence: z.string(),
    Nom: z.string(),
    Prenom: z.string(),
  })
  .passthrough();

export const AccountPoonaSchema = z.object({
  Retour: z.union([z.array(AccountInfoItem), z.string()]),
});

export type AccountPoonaResponse = z.infer<typeof AccountPoonaSchema>;

// ============================================================
// Licence Info
// ============================================================

/**
 * Response from ws_getlicenceinfobylicence.
 * Returns player info including name, club, active status, and ranking data.
 *
 * Ranking fields per discipline (Simple, Double, Mixte):
 * - ClassementX: ranking category (e.g., "P12", "D8", "NC")
 * - CPPHX: CPPH points value (may be string or number)
 *
 * .passthrough() ensures unknown fields from API don't break validation.
 */
const LicenceInfoItem = z
  .object({
    Licence: z.string(),
    Nom: z.string(),
    Prenom: z.string(),
    Club: z.string().optional(),
    NomClub: z.string().optional(),
    IS_ACTIF: z.union([z.boolean(), z.number(), z.string()]).optional(),
    // Ranking fields per discipline
    ClassementSimple: z.string().optional(),
    ClassementDouble: z.string().optional(),
    ClassementMixte: z.string().optional(),
    CPPHSimple: z.union([z.string(), z.number()]).optional(),
    CPPHDouble: z.union([z.string(), z.number()]).optional(),
    CPPHMixte: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export const LicenceInfoSchema = z.object({
  Retour: z.union([z.array(LicenceInfoItem), z.string()]),
});

export type LicenceInfoResponse = z.infer<typeof LicenceInfoSchema>;

// ============================================================
// Search by Keywords
// ============================================================

/**
 * Response from ws_getlicenceinfobykeywords.
 * Returns array of matching players.
 */
export const LicenceSearchSchema = z.object({
  Retour: z.union([z.array(LicenceInfoItem), z.string()]),
});

export type LicenceSearchResponse = z.infer<typeof LicenceSearchSchema>;

// ============================================================
// Results / Match History
// ============================================================

/**
 * Response item from ws_getresultbylicence.
 * Contains match result data with opponent, score, discipline, and tournament info.
 *
 * Core fields (Date, Adversaire, Score, Epreuve, Tour) are the base set.
 * Extended fields (Discipline, Partenaire, Points, Sets, etc.) capture
 * additional data when available from the API.
 * .passthrough() ensures unknown fields don't break validation.
 */
const ResultItem = z
  .object({
    // Core fields
    Date: z.string().optional(),
    Adversaire: z.string().optional(),
    Score: z.string().optional(),
    Epreuve: z.string().optional(),
    Tour: z.string().optional(),
    // Extended fields — match detail
    Discipline: z.string().optional(),
    Resultat: z.string().optional(),
    Points: z.union([z.string(), z.number()]).optional(),
    Sets: z.string().optional(),
    Duree: z.string().optional(),
    // Opponent and partner details
    AdversaireLicence: z.string().optional(),
    Adversaire2: z.string().optional(),
    Adversaire2Licence: z.string().optional(),
    Partenaire: z.string().optional(),
    PartenaireLicence: z.string().optional(),
    // Tournament/competition details
    Competition: z.string().optional(),
    DateCompetition: z.string().optional(),
  })
  .passthrough();

export const ResultByLicenceSchema = z.object({
  Retour: z.union([z.array(ResultItem), z.string()]),
});

export type ResultByLicenceResponse = z.infer<typeof ResultByLicenceSchema>;

// ============================================================
// Ranking Evolution (stub for future phases)
// ============================================================

const RankingEvolutionItem = z
  .object({
    Date: z.string().optional(),
    Classement: z.string().optional(),
    Points: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export const RankingEvolutionSchema = z.object({
  Retour: z.union([z.array(RankingEvolutionItem), z.string()]),
});

export type RankingEvolutionResponse = z.infer<typeof RankingEvolutionSchema>;

// ============================================================
// Generic FFBaD Response
// ============================================================

/**
 * Generic wrapper — use when schema isn't known.
 * Accepts any shape for Retour.
 */
export const GenericFFBaDSchema = z.object({
  Retour: z.unknown(),
});

export type GenericFFBaDResponse = z.infer<typeof GenericFFBaDSchema>;
