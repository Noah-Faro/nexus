/**
 * Progressive-overload coach — pure logic, no React, no storage.
 *
 * Implements a "double progression" scheme: for a given rep range (default
 * 8-12), the lifter first works reps up to the top of the range at a fixed
 * weight, then bumps the weight and drops back to the bottom of the range.
 *
 * Adapted from dashboard_ideas/overloadCoach.ts to work with our existing
 * LoggedSet and WorkoutSession types.
 */

import { LoggedSet, WorkoutSession } from './trainingTypes';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RepRange {
  bottom: number;
  top: number;
}

export interface SetTarget {
  weightKg: number;
  reps: number;
}

export interface CoachSuggestion {
  weightKg: number;
  targetReps: number;
}

export interface CoachResult {
  architecture?: 'STRAIGHT' | 'RAMP_UP' | 'TOP_SET_BACK_OFF';
  targets?: SetTarget[];
  /** Undefined only when there is no usable history. */
  suggestion: CoachSuggestion | undefined;
  reasoning: string;
  /**
   * Set ONLY when the order-aware softening rule actually changed the outcome
   * (a deload was suppressed because the last dip was logged much later than
   * usual). Undefined in every other case.
   */
  positionNote?: string;
}

/** A completed session's sets for a single exercise, most-recent first. */
export interface CoachSession {
  dateKey: string;
  sets: { weightKg: number; reps: number; rpe?: number }[];
  /** 0-based exercise position within its session. Optional for backwards compat. */
  position?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Default double-progression rep range. */
export const DEFAULT_REP_RANGE: RepRange = { bottom: 8, top: 12 };

/** Weight increment when graduating to the next weight (kg). */
export const WEIGHT_STEP_KG = 2.5;

/** Deload percentage suggested when stuck below the range. */
export const DELOAD_PERCENT = 5;

/**
 * Order-aware softening threshold. When the most recent session's position is
 * at least this many slots LATER than usual, under-performance does not count
 * as a deload strike.
 */
export const ORDER_SLOT_THRESHOLD = 2;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function detectArchitecture(weights: number[]): 'STRAIGHT' | 'RAMP_UP' | 'TOP_SET_BACK_OFF' {
  if (weights.length <= 1) return 'STRAIGHT';
  
  const maxWeight = Math.max(...weights);
  const minWeight = Math.min(...weights);
  
  if (maxWeight - minWeight <= maxWeight * 0.05) {
    return 'STRAIGHT';
  }
  
  const lastMaxIndex = weights.lastIndexOf(maxWeight);
  
  if (lastMaxIndex === weights.length - 1) {
    return 'RAMP_UP';
  }
  
  return 'TOP_SET_BACK_OFF';
}

/** Round to the nearest 0.1kg to avoid float noise like 42.49999. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The working weight of a session = the max weight across its sets. */
export function sessionWeight(session: CoachSession): number {
  return session.sets.reduce((max, set) => Math.max(max, set.weightKg), 0);
}

/** Lowest rep count in a session (its weakest set). */
export function minReps(session: CoachSession): number {
  return session.sets.reduce((min, set) => Math.min(min, set.reps), Infinity);
}

/** Compact "3×12 @ 40kg" / "3 sets @ 40kg (12, 10, 8)" style summary. */
export function describeSession(session: CoachSession): string {
  if (session.sets.length === 0) return 'Empty session';

  const weights = session.sets.map(s => s.weightKg);
  const arch = detectArchitecture(weights);
  const weight = sessionWeight(session);
  const weightLabel = weight === 0 ? 'bodyweight' : `${round1(weight)}kg`;

  if (arch === 'STRAIGHT') {
    const reps = session.sets.map((set) => set.reps);
    const allSame = reps.every((r) => r === reps[0]);
    if (allSame && reps.length > 0) {
      return `${reps.length}×${reps[0]} @ ${weightLabel}`;
    }
    return `${reps.length} sets @ ${weightLabel} (${reps.join(', ')})`;
  }

  const topSets = session.sets.filter(s => s.weightKg === weight);
  const nTopSets = topSets.length;
  const topSetsReps = topSets.map(s => s.reps).join(', ');

  if (arch === 'RAMP_UP') {
    if (nTopSets > 1) {
      return `Ramped up to ${nTopSets} top sets @ ${weightLabel} (${topSetsReps})`;
    }
    return `Ramped up to top set of ${topSets[0].reps} @ ${weightLabel}`;
  }

  // TOP_SET_BACK_OFF
  if (nTopSets > 1) {
    return `${nTopSets} top sets @ ${weightLabel} (${topSetsReps}), plus back-offs`;
  }
  return `Top set of ${topSets[0].reps} @ ${weightLabel}, plus back-offs`;
}

/** Human ordinal for a 0-based position: 0 → "1st", 1 → "2nd", etc. */
function ordinal(zeroBased: number): string {
  const n = zeroBased + 1;
  const mod100 = n % 100;
  const mod10 = n % 10;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : mod10 === 1
        ? 'st'
        : mod10 === 2
          ? 'nd'
          : mod10 === 3
            ? 'rd'
            : 'th';
  return `${n}${suffix}`;
}

function weightForTarget(weight: number): string {
  return weight === 0 ? 'bodyweight' : `${round1(weight)}kg`;
}

/**
 * The exercise's "usual" position across its history = the statistical mode.
 * Ties are broken toward the most-recent session's position (index 0 = latest).
 */
export function usualPosition(history: CoachSession[]): number | undefined {
  const counts = new Map<number, number>();
  const firstSeenAt = new Map<number, number>();
  history.forEach((session, index) => {
    if (session.position === undefined) return;
    const pos = session.position;
    counts.set(pos, (counts.get(pos) ?? 0) + 1);
    if (!firstSeenAt.has(pos)) firstSeenAt.set(pos, index);
  });
  if (counts.size === 0) return undefined;

  let best: number | undefined;
  let bestCount = -1;
  let bestRecency = Infinity;
  for (const [pos, count] of counts) {
    const recency = firstSeenAt.get(pos)!;
    if (count > bestCount || (count === bestCount && recency < bestRecency)) {
      best = pos;
      bestCount = count;
      bestRecency = recency;
    }
  }
  return best;
}

// ── Adapter: WorkoutSession[] → CoachSession[] ──────────────────────────────

/**
 * Convert our WorkoutSession history into CoachSession[] for a specific
 * exercise, sorted most-recent-first. Derives the 0-based exercise position
 * within each session.
 */
export function buildCoachHistory(
  exerciseId: string,
  history: WorkoutSession[],
): CoachSession[] {
  // Sort sessions most-recent-first
  const sorted = [...history].sort((a, b) => b.startTime - a.startTime);

  const coachSessions: CoachSession[] = [];

  for (const session of sorted) {
    const exSets = session.sets.filter((s) => s.exerciseId === exerciseId);
    if (exSets.length === 0) continue;

    // Derive exercise position: index within the session's exercise order
    let position: number | undefined;
    if (session.exercises && session.exercises.length > 0) {
      position = session.exercises.findIndex((e) => e.exerciseId === exerciseId);
      if (position === -1) position = undefined;
    } else {
      // Fallback: derive order from first logged set timestamps
      const exerciseIds: string[] = [];
      for (const s of session.sets) {
        if (!exerciseIds.includes(s.exerciseId)) {
          exerciseIds.push(s.exerciseId);
        }
      }
      const idx = exerciseIds.indexOf(exerciseId);
      position = idx >= 0 ? idx : undefined;
    }

    const dateKey = new Date(session.startTime).toISOString().slice(0, 10);

    coachSessions.push({
      dateKey,
      sets: exSets.map((s) => ({
        weightKg: s.weight,
        reps: s.reps,
        rpe: s.rpe,
      })),
      position,
    });
  }

  return coachSessions;
}

// ── Main Coach Logic ─────────────────────────────────────────────────────────

export interface CoachOptions {
  range?: RepRange;
  incrementKg?: number;
  primaryGoal?: 'hypertrophy' | 'strength';
  volumeSnapshot?: import('./trainingTypes').VolumeStateSnapshot;
}

/**
 * Suggest the next target for an exercise given its completed-session history.
 *
 * @param history CoachSession[], most-recent-first.
 * @param options Rep range and gym increment.
 */
export function suggestNextTarget(
  history: CoachSession[],
  options: CoachOptions = {},
): CoachResult {
  let range = options.range ?? DEFAULT_REP_RANGE;
  let incrementKg = options.incrementKg ?? WEIGHT_STEP_KG;

  if (options.primaryGoal === 'strength' && !options.range) {
    range = { bottom: 4, top: 6 };
  } else if (options.primaryGoal === 'hypertrophy' && !options.range) {
    range = { bottom: 8, top: 12 };
  }

  // Use VolumeStateSnapshot if available for suggestions instead of fully scanning raw session history.
  if (options.volumeSnapshot && options.volumeSnapshot.best1RMAnchor !== null && history.length === 0) {
    const anchor = options.volumeSnapshot.best1RMAnchor;
    // Assume anchor is 1RM, calculate starting weight for the rep range
    // If it's bodyweight, anchor is reps, but we can't easily distinguish. 
    // We'll provide a generic baseline using the Epley inversion:
    const suggestedWeight = round1(anchor / (1 + range.bottom / 30));
    return {
      suggestion: { weightKg: suggestedWeight, targetReps: range.bottom },
      reasoning: `Baseline inferred from muscle group volume snapshot. Aim for ${range.bottom}-${range.top} reps at ~${weightForTarget(suggestedWeight)}.`,
    };
  }

  const sessions = history.filter((session) => session.sets.length > 0);

  if (sessions.length === 0) {
    return {
      suggestion: undefined,
      reasoning: `First session — find a weight you can do for ${range.bottom}-${range.top} clean reps.`,
    };
  }

  const last = sessions[0]!;
  const lastWeight = sessionWeight(last);
  const weights = last.sets.map(s => s.weightKg);
  const arch = detectArchitecture(weights);

  // Filter session.sets to only look at Working Sets
  const workingSets = last.sets.filter((s, i) => {
    if (arch === 'STRAIGHT') return true;
    if (arch === 'RAMP_UP') return s.weightKg === lastWeight;
    if (arch === 'TOP_SET_BACK_OFF') return s.weightKg === lastWeight;
    return true;
  });

  const lastMinWorkingReps = workingSets.reduce((min, set) => Math.min(min, set.reps), Infinity);

  // Helper to generate targets based on whether the working sets progress
  const buildTargets = (topSetIncreaseWeight: boolean, topSetBaseReps: number): SetTarget[] => {
    return last.sets.map(s => {
      if (arch === 'STRAIGHT') {
        return {
          weightKg: topSetIncreaseWeight ? round1(lastWeight + incrementKg) : lastWeight,
          reps: topSetIncreaseWeight ? range.bottom : topSetBaseReps
        };
      }
      
      const isTopSet = s.weightKg === lastWeight;
      if (isTopSet) {
        return {
          weightKg: topSetIncreaseWeight ? round1(s.weightKg + incrementKg) : s.weightKg,
          reps: topSetIncreaseWeight ? range.bottom : topSetBaseReps
        };
      } else {
        // Evaluate ramp/back-off sets independently
        const hitTop = s.reps >= range.top;
        return {
          weightKg: hitTop ? round1(s.weightKg + incrementKg) : s.weightKg,
          reps: hitTop ? range.bottom : Math.min(s.reps + 1, range.top)
        };
      }
    });
  };

  // Rule (a): every working set hit the top of the range.
  const allAtTop = workingSets.every((set) => set.reps >= range.top);
  if (allAtTop) {
    const newWeight = round1(lastWeight + incrementKg);
    return {
      architecture: arch,
      targets: buildTargets(true, range.bottom),
      suggestion: { weightKg: newWeight, targetReps: range.bottom },
      reasoning:
        `Last time: ${describeSession(last)} — working sets at top of range. ` +
        `Time to go up.`,
    };
  }

  // Rule (b): stalled — below bottom of range two sessions running at same weight.
  if (sessions.length >= 2) {
    const prev = sessions[1]!;
    const prevWeight = sessionWeight(prev);
    const prevArch = detectArchitecture(prev.sets.map(s => s.weightKg));
    const prevWorkingSets = prev.sets.filter((s) => {
      if (prevArch === 'STRAIGHT') return true;
      return s.weightKg === prevWeight;
    });

    const belowLast = workingSets.some((set) => set.reps < range.bottom);
    const belowPrev = prevWorkingSets.some((set) => set.reps < range.bottom);

    let softenedLast = false;
    let positionNote: string | undefined;
    if (belowLast && belowPrev) {
      const usual = usualPosition(sessions.slice(1));
      if (last.position !== undefined && usual !== undefined) {
        const slotsLater = last.position - usual;
        if (slotsLater >= ORDER_SLOT_THRESHOLD) {
          softenedLast = true;
          positionNote =
            `Logged ${ordinal(last.position)} vs usually ${ordinal(usual)} — ` +
            `expected drop, not counted toward deload.`;
        }
      }
    }

    if (belowLast && belowPrev && !softenedLast) {
      const deloadWeight = round1(lastWeight * (1 - DELOAD_PERCENT / 100));
      const deloadNote =
        lastWeight === 0
          ? ''
          : ` Deload option: -${DELOAD_PERCENT}% to ${weightForTarget(deloadWeight)}.`;
      return {
        architecture: arch,
        targets: buildTargets(false, range.bottom),
        suggestion: { weightKg: lastWeight, targetReps: range.bottom },
        reasoning:
          `Last time: ${describeSession(last)} — dropped below ${range.bottom} reps ` +
          `two sessions running. Hold weight and aim for ` +
          `${range.bottom} solid reps.${deloadNote}`,
      };
    }

    if (softenedLast && positionNote !== undefined) {
      return {
        architecture: arch,
        targets: buildTargets(false, range.bottom),
        suggestion: { weightKg: lastWeight, targetReps: range.bottom },
        reasoning:
          `Last time: ${describeSession(last)}. ` +
          `Hold ${weightForTarget(lastWeight)} and aim for ${range.bottom} solid reps.`,
        positionNote,
      };
    }
  }

  // Rule (c): add one rep to last session's minimum working reps
  const targetReps = Math.min(lastMinWorkingReps + 1, range.top);
  return {
    architecture: arch,
    targets: buildTargets(false, targetReps),
    suggestion: { weightKg: lastWeight, targetReps },
    reasoning:
      `Last time: ${describeSession(last)}. ` +
      `Keep weight, aim for ${targetReps} reps on working sets this time.`,
  };
}

// ── Legacy compat: keep old export so nothing else breaks ────────────────────

/** @deprecated Use suggestNextTarget + buildCoachHistory instead. */
export function getOverloadSuggestion(
  currentWeight: number,
  currentReps: number,
  previousSets?: LoggedSet[],
): string {
  if (!previousSets || previousSets.length === 0) {
    return `Est 1RM: ${Math.round(currentWeight * (1 + currentReps / 30))}`;
  }

  const bestSet = previousSets.reduce(
    (a, b) => (a.weight * a.reps > b.weight * b.reps ? a : b),
    previousSets[0],
  );

  if (currentWeight > bestSet.weight) {
    return 'New weight PR!';
  } else if (currentWeight === bestSet.weight && currentReps > bestSet.reps) {
    return 'New reps PR!';
  } else if (currentWeight === bestSet.weight && currentReps === bestSet.reps) {
    return 'Matching best set';
  } else {
    if (currentWeight === bestSet.weight && currentReps < bestSet.reps) {
      return `Aim for ${bestSet.reps + 1} reps`;
    }
    return `Est 1RM: ${Math.round(currentWeight * (1 + currentReps / 30))}`;
  }
}
