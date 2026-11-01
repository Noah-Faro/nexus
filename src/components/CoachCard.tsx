import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp } from 'lucide-react-native';
import { theme } from '../theme';
import { WorkoutSession } from '../trainingTypes';
import {
  suggestNextTarget,
  buildCoachHistory,
  CoachResult,
  DEFAULT_REP_RANGE,
  WEIGHT_STEP_KG,
} from '../overloadCoach';

interface CoachCardProps {
  /** Exercise ID to compute coach suggestion for. */
  exerciseId: string;
  /** Full workout history (all sessions). */
  history: WorkoutSession[];
  /** Equipment increment from gym profile (kg). Falls back to WEIGHT_STEP_KG. */
  incrementKg?: number;
  /** Exclude session IDs (e.g. current active session). */
  excludeSessionId?: string;
  targetReps?: number;
  rpeEnabled?: boolean;
  primaryGoal?: 'hypertrophy' | 'strength';
  isCardio?: boolean;
  trackingType?: 'weight_reps' | 'time' | 'time_distance';
}

/**
 * Always-visible progressive-overload suggestion card.
 * Renders inside expanded exercise cards (active session and history detail).
 */
export default function CoachCard({
  exerciseId,
  history,
  incrementKg,
  excludeSessionId,
  targetReps,
  rpeEnabled,
  primaryGoal,
  isCardio,
  trackingType,
}: CoachCardProps) {
  const isCardioEffective = Boolean(
    isCardio || trackingType === 'time' || trackingType === 'time_distance'
  );

  const result: CoachResult = useMemo(() => {
    const filteredHistory = excludeSessionId
      ? history.filter((s) => s.id !== excludeSessionId)
      : history;
    const coachHistory = buildCoachHistory(exerciseId, filteredHistory);
    return suggestNextTarget(coachHistory, {
      targetReps,
      rpeEnabled,
      primaryGoal,
      incrementKg: incrementKg ?? WEIGHT_STEP_KG,
      isCardio: isCardioEffective,
      trackingType,
    });
  }, [
    exerciseId,
    history,
    incrementKg,
    excludeSessionId,
    targetReps,
    rpeEnabled,
    primaryGoal,
    isCardioEffective,
    trackingType,
  ]);

  const target = result.suggestion;
  const targets = result.targets;
  const arch = result.architecture;

  const formatWeight = (w: number) => (w === 0 ? 'bodyweight' : `${w}kg`);

  const renderTargets = () => {
    if (isCardioEffective || result.cardioTarget) {
      if (!result.cardioTarget) return null;
      if (result.cardioTarget.targetDistance !== undefined) {
        return (
          <Text style={styles.target}>
            Target: {result.cardioTarget.targetDistance}km in {result.cardioTarget.targetMinutes} min
          </Text>
        );
      }
      return (
        <Text style={styles.target}>
          Target: {result.cardioTarget.targetMinutes} min
        </Text>
      );
    }

    if (!targets || targets.length === 0) {
      if (target) {
        return (
          <Text style={styles.target}>
            Target: {formatWeight(target.weightKg)} × {target.targetReps} reps
          </Text>
        );
      }
      return null;
    }

    if (arch === 'STRAIGHT') {
      const t = targets[0];
      return (
        <Text style={styles.target}>
          Target: {targets.length} × {formatWeight(t.weightKg)} @ {t.reps} reps
        </Text>
      );
    } else if (arch === 'RAMP_UP') {
      const steps = targets.map((t) => `${formatWeight(t.weightKg)}×${t.reps}`).join(' → ');
      return <Text style={styles.target}>Ramp up: {steps}</Text>;
    } else if (arch === 'TOP_SET_BACK_OFF') {
      const topSet = targets[0];
      const backOffs = targets.slice(1);
      const backOffStr = backOffs.map((t) => `${formatWeight(t.weightKg)}×${t.reps}`).join(', ');
      return (
        <Text style={styles.target}>
          Top Set: {formatWeight(topSet.weightKg)}×{topSet.reps}, Back-offs: {backOffStr}
        </Text>
      );
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TrendingUp size={14} color={theme.colors.accentCyan} />
        <Text style={styles.label}>OVERLOAD COACH</Text>
      </View>
      {renderTargets()}
      <Text style={styles.reasoning}>{result.reasoning}</Text>
      {result.positionNote ? (
        <Text style={styles.positionNote}>{result.positionNote}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.accentCyanFade,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(100, 210, 255, 0.25)',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontFamily: theme.typography.semibold,
    fontSize: 11,
    color: theme.colors.accentCyan,
    letterSpacing: 1,
  },
  target: {
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  reasoning: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  positionNote: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
    opacity: 0.8,
  },
});
