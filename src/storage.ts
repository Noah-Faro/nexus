import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrinkLog, UserSettings, DayProgress, LiquidType, LIQUID_CONFIGS } from './types';

const SETTINGS_KEY = '@obsidian_water_tracker_settings';
const LOGS_KEY = '@obsidian_water_tracker_logs';

export const DEFAULT_SETTINGS: UserSettings = {
  weight: 70,
  weightUnit: 'kg',
  activityLevel: 'moderate',
  customGoal: null,
  useAutoGoal: true,
};

// Calculate goal dynamically based on weight and activity level
export function calculateGoal(settings: UserSettings): number {
  if (!settings.useAutoGoal && settings.customGoal !== null) {
    return settings.customGoal;
  }

  // Convert lbs to kg if needed
  const weightInKg = settings.weightUnit === 'lbs' 
    ? settings.weight * 0.45359237 
    : settings.weight;

  // Base hydration: 35ml per kg of body weight
  let baseHydration = weightInKg * 35;

  // Adjust for activity level
  if (settings.activityLevel === 'sedentary') {
    baseHydration *= 1.0;
  } else if (settings.activityLevel === 'moderate') {
    baseHydration *= 1.15;
  } else if (settings.activityLevel === 'active') {
    baseHydration *= 1.3;
  }

  // Round to nearest 50ml for neatness
  return Math.round(baseHydration / 50) * 50;
}

export async function loadSettings(): Promise<UserSettings> {
  try {
    const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
    if (jsonValue !== null) {
      return JSON.parse(jsonValue);
    }
  } catch (e) {
    console.error('Failed to load settings from storage', e);
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  try {
    const jsonValue = JSON.stringify(settings);
    await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save settings to storage', e);
  }
}

export async function loadLogs(): Promise<DrinkLog[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(LOGS_KEY);
    if (jsonValue !== null) {
      return JSON.parse(jsonValue);
    }
  } catch (e) {
    console.error('Failed to load logs from storage', e);
  }
  return [];
}

export async function saveLogs(logs: DrinkLog[]): Promise<void> {
  try {
    const jsonValue = JSON.stringify(logs);
    await AsyncStorage.setItem(LOGS_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save logs to storage', e);
  }
}

// Utility to get Date string YYYY-MM-DD from timestamp
export function formatDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get aggregate progress indexed by date
export function getAggregatedProgress(logs: DrinkLog[], settings: UserSettings): Record<string, DayProgress> {
  const aggregates: Record<string, DayProgress> = {};
  
  // Sort logs by time ascending
  const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);

  // Initialize with today's date so it always exists in some form
  const todayKey = formatDateKey(Date.now());
  const todayGoal = calculateGoal(settings);
  
  aggregates[todayKey] = {
    date: todayKey,
    totalAmount: 0,
    totalEffective: 0,
    goal: todayGoal,
    logs: []
  };

  for (const log of sortedLogs) {
    const dateKey = formatDateKey(log.timestamp);
    if (!aggregates[dateKey]) {
      aggregates[dateKey] = {
        date: dateKey,
        totalAmount: 0,
        totalEffective: 0,
        // In a real app, day goals could be historical, 
        // but for simplicity we calculate based on active settings
        goal: todayGoal, 
        logs: []
      };
    }
    
    aggregates[dateKey].totalAmount += log.amount;
    aggregates[dateKey].totalEffective += log.effectiveAmount;
    aggregates[dateKey].logs.push(log);
  }

  return aggregates;
}

export function getTodayProgress(logs: DrinkLog[], settings: UserSettings): DayProgress {
  const progressMap = getAggregatedProgress(logs, settings);
  const todayKey = formatDateKey(Date.now());
  return progressMap[todayKey];
}
