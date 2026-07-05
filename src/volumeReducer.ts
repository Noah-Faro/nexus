import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutSession, Exercise, VolumeStateSnapshot, LoggedSet } from './trainingTypes';
import { detectArchitecture } from './overloadCoach';

const VOLUME_SNAPSHOTS_KEY = 'nexus_volume_snapshots';

export function getISOWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

export async function reduceVolumeSnapshots(
  sessions: WorkoutSession[],
  exercises: Exercise[]
): Promise<void> {
  const exerciseMap = new Map<string, Exercise>();
  exercises.forEach((ex) => exerciseMap.set(ex.id, ex));

  // Snapshot map: weekId -> muscleGroup -> snapshot
  const snapshots = new Map<string, Map<string, VolumeStateSnapshot>>();

  for (const session of sessions) {
    const weekId = getISOWeekId(new Date(session.startTime));

    if (!snapshots.has(weekId)) {
      snapshots.set(weekId, new Map());
    }
    const weekSnapshots = snapshots.get(weekId)!;

    // Group sets by exerciseId in this session
    const setsByExercise = new Map<string, LoggedSet[]>();
    for (const set of session.sets) {
      if (!setsByExercise.has(set.exerciseId)) {
        setsByExercise.set(set.exerciseId, []);
      }
      setsByExercise.get(set.exerciseId)!.push(set);
    }

    for (const [exerciseId, sets] of setsByExercise.entries()) {
      const exercise = exerciseMap.get(exerciseId);
      if (!exercise) continue;

      const weights = sets.map((s) => s.weight);
      const arch = detectArchitecture(weights);
      const maxWeight = Math.max(...weights, 0);

      const workingSets = sets.filter((s) => {
        if (arch === 'STRAIGHT') return true;
        if (arch === 'RAMP_UP') return s.weight === maxWeight;
        if (arch === 'TOP_SET_BACK_OFF') return s.weight === maxWeight;
        return true;
      });

      const muscleGroup = exercise.muscleGroup;

      if (!weekSnapshots.has(muscleGroup)) {
        weekSnapshots.set(muscleGroup, {
          weekId,
          muscleGroup,
          totalSets: 0,
          best1RMAnchor: null,
        });
      }

      const snap = weekSnapshots.get(muscleGroup)!;
      snap.totalSets += workingSets.length;

      // Calculate best1RMAnchor
      for (const set of workingSets) {
        let anchorValue: number;
        if (set.weight === 0) {
          // CRITICAL RULE: For bodyweight exercises (weight === 0), track highest reps
          anchorValue = set.reps;
        } else {
          // Epley 1RM
          anchorValue = set.weight * (1 + set.reps / 30);
        }

        if (snap.best1RMAnchor === null || anchorValue > snap.best1RMAnchor) {
          snap.best1RMAnchor = anchorValue;
        }
      }
    }
  }

  // Flatten and save
  const result: VolumeStateSnapshot[] = [];
  for (const weekMap of snapshots.values()) {
    for (const snap of weekMap.values()) {
      result.push(snap);
    }
  }

  await AsyncStorage.setItem(VOLUME_SNAPSHOTS_KEY, JSON.stringify(result));
}

export async function getVolumeSnapshots(): Promise<VolumeStateSnapshot[]> {
  const data = await AsyncStorage.getItem(VOLUME_SNAPSHOTS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}
