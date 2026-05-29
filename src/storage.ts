import { DrinkLog, UserSettings, DayProgress } from './types';
import { loadFromStorage, saveToStorage } from './utils';

const SETTINGS_KEY = '@obsidian_water_tracker_settings';
const LOGS_KEY = '@obsidian_water_tracker_logs';

export const DEFAULT_SETTINGS: UserSettings = {
  userName: '',
  weight: 70,
  weightUnit: 'kg',
  activityLevel: 'moderate',
  customGoal: null,
  useAutoGoal: true,
  moduleOrder: ['hydration', 'training', 'capital', 'knowledge'],
  customLiquids: {},
  wakeTime: '07:00',
  sleepTime: '22:00',
  hapticRemindersEnabled: true,
};

export const ACTIVITY_HYDRATION_MULTIPLIERS = {
  sedentary: 1.0,
  moderate: 1.15,
  active: 1.3,
} as const;

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
  const multiplier = ACTIVITY_HYDRATION_MULTIPLIERS[settings.activityLevel] || 1.0;
  baseHydration *= multiplier;

  // Round to nearest 50ml for neatness
  return Math.round(baseHydration / 50) * 50;
}

export async function loadSettings(): Promise<UserSettings> {
  return loadFromStorage<UserSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  return saveToStorage<UserSettings>(SETTINGS_KEY, settings);
}

export async function loadLogs(): Promise<DrinkLog[]> {
  return loadFromStorage<DrinkLog[]>(LOGS_KEY, []);
}

export async function saveLogs(logs: DrinkLog[]): Promise<void> {
  return saveToStorage<DrinkLog[]>(LOGS_KEY, logs);
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

export interface CurvePoint {
  hour: number;
  timeLabel: string;
  target: number;
  actual: number;
  caffeine: number;
}

export function calculateActiveCaffeine(logs: DrinkLog[]): { activeMg: number; hoursToClear: number } {
  const now = Date.now();
  let activeMg = 0;

  for (const log of logs) {
    if (log.caffeineMg && log.caffeineMg > 0) {
      const elapsedHours = (now - log.timestamp) / (3600 * 1000);
      if (elapsedHours >= 0 && elapsedHours < 24) {
        // C_t = C_0 * (0.5)^(t/5)
        activeMg += log.caffeineMg * Math.pow(0.5, elapsedHours / 5);
      }
    }
  }

  // Calculate hours until it drops below 40mg (sleep-safe Physiological Limit)
  let hoursToClear = 0;
  const SAFE_LIMIT = 40;
  if (activeMg > SAFE_LIMIT) {
    // 20 = activeMg * (0.5)^(t/5) => (0.5)^(t/5) = 20/activeMg => t/5 = log_0.5(20/activeMg) => t = 5 * ln(activeMg/20) / ln(2)
    hoursToClear = 5 * Math.log(activeMg / SAFE_LIMIT) / Math.log(2);
  }

  return {
    activeMg: Math.round(activeMg * 10) / 10,
    hoursToClear: Math.round(hoursToClear * 10) / 10
  };
}

export function getHydrationCurveData(logs: DrinkLog[], settings: UserSettings): CurvePoint[] {
  const goal = calculateGoal(settings);
  
  // Parse Wake & Sleep times (e.g. "07:30" => 7.5)
  const parseTimeToDecimal = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h + (m / 60);
  };
  
  const wakeHour = parseTimeToDecimal(settings.wakeTime || '07:00');
  const sleepHour = parseTimeToDecimal(settings.sleepTime || '22:00');
  
  // Calculate active awake duration with overnight wrap support
  let activeDuration = sleepHour - wakeHour;
  if (sleepHour < wakeHour) {
    activeDuration = (sleepHour + 24) - wakeHour;
  }
  activeDuration = Math.max(1, activeDuration);
  
  // Get start of today in local time
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const midnightMs = todayStart.getTime();
  
  const now = new Date();
  const exactCurrentHour = now.getHours() + (now.getMinutes() / 60);
  
  const curvePoints: CurvePoint[] = [];
  
  for (let hour = 0; hour < 24; hour++) {
    const isCurrentHour = hour === now.getHours();
    
    // Boundary time check:
    // If it's the current hour, check logs up to exactly Date.now().
    // If it's a past hour, check logs up to the end of that hour (e.g. hour + 1) so it shows full hour results.
    // If it's a future hour, check logs up to the start of that hour.
    let refTime = midnightMs + hour * 3600 * 1000;
    if (isCurrentHour) {
      refTime = Date.now();
    } else if (hour < now.getHours()) {
      refTime = midnightMs + (hour + 1) * 3600 * 1000 - 1; // End of the past hour
    }

    // 1. Calculate Target at this hour
    let target = 0;
    const timeDecimal = isCurrentHour ? exactCurrentHour : hour;
    
    if (sleepHour < wakeHour) {
      if (timeDecimal >= wakeHour) {
        target = goal * ((timeDecimal - wakeHour) / activeDuration);
      } else if (timeDecimal < sleepHour) {
        target = goal * ((timeDecimal + 24 - wakeHour) / activeDuration);
      } else {
        target = goal; // Sleeping hours (e.g. 1 AM to 8 AM)
      }
    } else {
      if (timeDecimal >= wakeHour) {
        if (timeDecimal >= sleepHour) {
          target = goal;
        } else {
          target = goal * ((timeDecimal - wakeHour) / activeDuration);
        }
      }
    }
    target = Math.max(0, Math.min(goal, Math.round(target)));
    
    // 2. Calculate Actual fluid net (adds from today's logs up to this hour, cumulative effective logged amount)
    let effectiveLoggedToday = 0;
    
    const todayLogsUpToHour = logs.filter(log => {
      return log.timestamp >= midnightMs && log.timestamp <= refTime;
    });
    
    for (const log of todayLogsUpToHour) {
      effectiveLoggedToday += log.effectiveAmount;
    }
    
    const actual = Math.max(0, Math.round(effectiveLoggedToday));
    
    // 3. Calculate active caffeine at this hour (including yesterday's caffeine decaying)
    let caffeine = 0;
    for (const log of logs) {
      if (log.caffeineMg && log.caffeineMg > 0 && log.timestamp <= refTime) {
        const elapsedHours = (refTime - log.timestamp) / (3600 * 1000);
        if (elapsedHours >= 0 && elapsedHours < 24) {
          caffeine += log.caffeineMg * Math.pow(0.5, elapsedHours / 5);
        }
      }
    }
    caffeine = Math.round(caffeine * 10) / 10;
    
    // Formatting time label
    const displayHour = hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
    
    curvePoints.push({
      hour,
      timeLabel: displayHour,
      target,
      actual,
      caffeine
    });
  }
  
  return curvePoints;
}
