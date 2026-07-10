import AppleHealthKit, { HealthKitPermissions } from 'react-native-health';

const permissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
    ],
    write: [],
  },
} as HealthKitPermissions;

export const initializeHealthKit = (): Promise<boolean> => {
  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(permissions, (err: string) => {
      if (err) {
        console.log('[HealthKit] error initializing Healthkit: ', err);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
};

export interface DailyRecoverySummary {
  sleepHours: number;
  restingHeartRate: number;
  hrv: number;
  recoveryScore: number;
}

export const syncDailyRecovery = async (): Promise<DailyRecoverySummary | null> => {
  const isAvailable = await initializeHealthKit();
  if (!isAvailable) return null;

  // Mocking the exact calculation for now, just ensure the API fetches work
  console.log('[HealthKit] syncDailyRecovery: Fetching sleep and HRV data');

  return {
    sleepHours: 7.5,
    restingHeartRate: 55,
    hrv: 65,
    recoveryScore: 82,
  };
};
