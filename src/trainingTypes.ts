export interface WorkoutTemplate {
  id: string;
  name: string;            // "Push A", "Pull B", etc.
  exercises: TemplateExercise[];
  color?: string;          // Accent color for the template card
}

export interface TemplateExercise {
  exerciseId: string;      // References exercise library
  targetSets: number;
  targetReps: number;
  notes?: string;          // "Pause at bottom", "Slow eccentric"
}

export type MuscleGroup = 'push' | 'pull' | 'legs' | 'core' | 'cardio';
export type EquipmentType = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;            // "Bench Press", "Lateral Raise"
  muscleGroup: MuscleGroup;
  equipment: EquipmentType;
  incrementStep: number;   // 2.5 for barbell, 1 for dumbbell/cable
  isCustom: boolean;       // true if created via Exercise Synthesizer
  weightUnit: 'kg' | 'lbs';// Per-exercise toggle, defaults to kg
}

export interface LoggedSet {
  id: string;
  exerciseId: string;
  exerciseName: string;    // Snapshot for history display
  setNumber: number;
  weight: number;          // in the exercise's configured unit
  weightUnit: 'kg' | 'lbs';
  reps: number;
  timestamp: number;
  estimated1RM: number;    // Auto-calculated: weight * (1 + reps/30)
}

export interface WorkoutSession {
  id: string;
  templateId: string;
  templateName: string;    // Snapshot of template name at time of session
  startTime: number;       // Unix timestamp
  endTime?: number;        // Unix timestamp - set when session is finished
  durationMinutes?: number;
  sets: LoggedSet[];
  totalVolume: number;     // Sum of (weight * reps) across all sets
  sessionNumber: number;   // Sequential session count
  exercises?: TemplateExercise[];
}

export interface ExerciseDefaults {
  defaultWeight: number;
  defaultReps: number;
}
