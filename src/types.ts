export interface DrinkLog {
  id: string;
  timestamp: number; // Unix timestamp in ms
  amount: number;    // Raw amount in ml
  type: string;      // e.g., 'water', 'coffee', 'tea', 'soda'
  tag: string;       // e.g., '#water', '#coffee', '#tea', '#soda'
  effectiveAmount: number; // amount * multiplier
  caffeineMg?: number; // Caffeine content in mg
  isDecaf?: boolean;   // Optional decaf flag
}

export interface UserSettings {
  userName?: string;          // user's name for greetings
  weight: number;             // e.g., 75
  weightUnit: 'kg' | 'lbs';   // 'kg' or 'lbs'
  activityLevel: 'sedentary' | 'moderate' | 'active'; // modifier for weight calculation
  customGoal: number | null;  // manual target in ml (overrides automatic weight-based goal if set)
  useAutoGoal: boolean;       // whether to calculate goals automatically based on weight
  moduleOrder: string[];      // order of modules in the Vault
  customLiquids?: Record<string, LiquidConfig>; // user-defined drinks
  wakeTime?: string;          // Wakeup time in "HH:MM", default "07:00"
  sleepTime?: string;         // Sleep time in "HH:MM", default "22:00"
  hapticRemindersEnabled?: boolean; // toggle smart reminders
  decafPrefs?: Record<string, boolean>; // decaf preferences dictionary
}

export type LiquidType = 'water' | 'coffee' | 'tea' | 'soda' | 'juice' | 'sports-drink' | 'beer' | 'wine' | string;

export interface LiquidConfig {
  tag: string;
  label: string;
  multiplier: number;
  color: string;
  standardPreset: number;
  presets: number[];
  caffeineMg?: number;        // Optional caffeine content per standardPreset volume (mg)
}

export const LIQUID_CONFIGS: Record<LiquidType, LiquidConfig> = {
  'water': {
    tag: '#water',
    label: 'Water',
    multiplier: 1.0,
    color: '#0a84ff', // iOS Blue
    standardPreset: 250,
    presets: [250, 330, 500, 650]
  },
  'coffee': {
    tag: '#coffee',
    label: 'Coffee',
    multiplier: 0.7,
    color: '#855845', // Espresso Brown
    standardPreset: 250,
    presets: [30, 150, 250, 330], // Supports 30ml Espresso
    caffeineMg: 80
  },
  'tea': {
    tag: '#tea',
    label: 'Tea',
    multiplier: 0.8,
    color: '#32d74b', // iOS Green
    standardPreset: 250,
    presets: [150, 250, 330, 500],
    caffeineMg: 30
  },
  'soda': {
    tag: '#soda',
    label: 'Soda',
    multiplier: 0.4,
    color: '#ff453a', // iOS Red
    standardPreset: 330,
    presets: [250, 330, 500, 650]
  },
  'juice': {
    tag: '#juice',
    label: 'Juice',
    multiplier: 0.5,
    color: '#ff9f0a', // iOS Orange
    standardPreset: 250,
    presets: [250, 330, 500, 650]
  },
  'sports-drink': {
    tag: '#sports-drink',
    label: 'Isotonic',
    multiplier: 0.8,
    color: '#bf5af2', // iOS Purple
    standardPreset: 500,
    presets: [250, 330, 500, 650]
  },
  'beer': {
    tag: '#beer',
    label: 'Beer',
    multiplier: 0.1,
    color: '#ffd60a', // iOS Yellow
    standardPreset: 500,
    presets: [330, 500, 650, 1000]
  },
  'wine': {
    tag: '#wine',
    label: 'Wine',
    multiplier: -0.4, // Dehydrating
    color: '#ff375f', // iOS Pink/Rose
    standardPreset: 150,
    presets: [150, 250, 330, 500]
  }
};

export interface DayProgress {
  date: string;          // YYYY-MM-DD
  totalAmount: number;   // Raw accumulated ml
  totalEffective: number; // Effective accumulated ml
  goal: number;          // Target ml for that day
  logs: DrinkLog[];
}
