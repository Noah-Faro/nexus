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

export type LiquidType = 'water' | 'coffee' | 'tea' | 'soda' | 'juice' | 'sports-drink';

export interface LiquidConfig {
  tag: string;
  label: string;
  multiplier: number;
  color: string;
}

export const LIQUID_CONFIGS: Record<LiquidType, LiquidConfig> = {
  'water': {
    tag: '#water',
    label: 'Water',
    multiplier: 1.0,
    color: '#754ec3', // Obsidian Purple
  },
  'coffee': {
    tag: '#coffee',
    label: 'Coffee',
    multiplier: 0.8,
    color: '#e5b567', // Warm Amber
  },
  'tea': {
    tag: '#tea',
    label: 'Tea',
    multiplier: 0.9,
    color: '#4ea64e', // Muted Sage Green
  },
  'soda': {
    tag: '#soda',
    label: 'Soda',
    multiplier: 0.7,
    color: '#e95656', // Crimson Red
  },
  'juice': {
    tag: '#juice',
    label: 'Juice',
    multiplier: 0.8,
    color: '#d46b32', // Orange Rust
  },
  'sports-drink': {
    tag: '#sports-drink',
    label: 'Isotonic',
    multiplier: 1.1,
    color: '#3490dc', // Technical Blue
  }
};

export interface DayProgress {
  date: string;          // YYYY-MM-DD
  totalAmount: number;   // Raw accumulated ml
  totalEffective: number; // Effective accumulated ml
  goal: number;          // Target ml for that day
  logs: DrinkLog[];
}
