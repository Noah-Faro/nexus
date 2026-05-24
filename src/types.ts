export interface DrinkLog {
  id: string;
  timestamp: number; // Unix timestamp in ms
  amount: number;    // Raw amount in ml
  type: string;      // e.g., 'water', 'coffee', 'tea', 'soda'
  tag: string;       // e.g., '#water', '#coffee', '#tea', '#soda'
  effectiveAmount: number; // amount * multiplier
}

export interface UserSettings {
  weight: number;             // e.g., 75
  weightUnit: 'kg' | 'lbs';   // 'kg' or 'lbs'
  activityLevel: 'sedentary' | 'moderate' | 'active'; // modifier for weight calculation
  customGoal: number | null;  // manual target in ml (overrides automatic weight-based goal if set)
  useAutoGoal: boolean;       // whether to calculate goals automatically based on weight
}

export type LiquidType = 'water' | 'coffee' | 'tea' | 'soda' | 'juice' | 'sports-drink' | 'beer' | 'wine';

export interface LiquidConfig {
  tag: string;
  label: string;
  multiplier: number;
  color: string;
  standardPreset: number;
  presets: number[];
}

export const LIQUID_CONFIGS: Record<LiquidType, LiquidConfig> = {
  'water': {
    tag: '#water',
    label: 'Water',
    multiplier: 1.0,
    color: '#3490dc', // Royal Blue
    standardPreset: 250,
    presets: [250, 330, 500, 650]
  },
  'coffee': {
    tag: '#coffee',
    label: 'Coffee',
    multiplier: 0.7,
    color: '#855845', // Espresso Brown
    standardPreset: 250,
    presets: [40, 150, 250, 330] // Supports 40ml Espresso
  },
  'tea': {
    tag: '#tea',
    label: 'Tea',
    multiplier: 0.8,
    color: '#4ea64e', // Sage Green
    standardPreset: 250,
    presets: [150, 250, 330, 500]
  },
  'soda': {
    tag: '#soda',
    label: 'Soda',
    multiplier: 0.4,
    color: '#e95656', // Cola/Crimson Red
    standardPreset: 330,
    presets: [250, 330, 500, 650]
  },
  'juice': {
    tag: '#juice',
    label: 'Juice',
    multiplier: 0.5,
    color: '#d46b32', // Orange Rust
    standardPreset: 250,
    presets: [250, 330, 500, 650]
  },
  'sports-drink': {
    tag: '#sports-drink',
    label: 'Isotonic',
    multiplier: 0.8,
    color: '#754ec3', // Obsidian Purple
    standardPreset: 500,
    presets: [250, 330, 500, 650]
  },
  'beer': {
    tag: '#beer',
    label: 'Beer',
    multiplier: 0.1,
    color: '#e5b567', // Golden Yellow
    standardPreset: 500,
    presets: [330, 500, 650, 1000]
  },
  'wine': {
    tag: '#wine',
    label: 'Wine',
    multiplier: -0.4, // Dehydrating
    color: '#800020', // Burgundy
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
