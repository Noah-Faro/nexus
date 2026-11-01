import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, Platform, StatusBar, KeyboardAvoidingView, Keyboard, Image, Text } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useFonts, Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';

// Core imports
import { theme } from './src/theme';
import { DrinkLog, UserSettings, LiquidType, LIQUID_CONFIGS, LiquidConfig } from './src/types';
import { generateId, parseTimeToDecimal } from './src/utils';
import { 
  loadSettings, 
  saveSettings, 
  saveSettingsStrict,
  loadLogs, 
  saveLogs, 
  calculateGoal, 
  getTodayProgress,
  getAggregatedProgress,
  DEFAULT_SETTINGS
} from './src/storage';

// Component imports
import Header from './src/components/Header';
import DailyNoteView from './src/components/DailyNoteView';
import PresetButtons from './src/components/PresetButtons';
import CommandPalette from './src/components/CommandPalette';
import GraphView from './src/components/GraphView';
import CalendarHeatmap from './src/components/CalendarHeatmap';
import SettingsModal from './src/components/SettingsModal';
import GoalModal from './src/components/GoalModal';
import * as Notifications from 'expo-notifications';
import AppAlertModal, { AppAlertButton } from './src/components/AppAlertModal';
import PasswordPromptModal from './src/components/PasswordPromptModal';
import NexusVault from './src/components/NexusVault';
import BrewLabSheet from './src/components/BrewLabSheet';
import TrainingApp from './src/components/TrainingApp';
import SyncIndicator from './src/components/SyncIndicator';
import ActiveWorkoutBanner from './src/components/ActiveWorkoutBanner';
import { WorkoutSession } from './src/trainingTypes';
import { loadActiveSessionResult } from './src/trainingStorage';
import { SyncPreviewModal } from './src/components/SyncPreviewModal';
import { useGoogleDriveAuth } from './src/googleAuth';
import { computeSyncDiff, performDriveSync, performDrivePush } from './src/sync';
import { findStateFileId } from './src/googleDrive';
import { replayPendingMerge } from './src/backup';
import { recordDeletion } from './src/tombstones';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SessionDeletionRecoveryBlockedError,
} from './src/sessionDeletionSyncGate';
import { runWithSessionDeletionRecovery } from './src/sessionDeletionSyncGateRuntime';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  const [activeApp, setActiveApp] = useState<'vault' | 'hydration' | 'training'>('vault');
  const [activeView, setActiveView] = useState<'tracker' | 'stats' | 'calendar'>('tracker');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const settingsRef = useRef<UserSettings | null>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [trainingDataRevision, setTrainingDataRevision] = useState(0);
  const [activeWorkoutSession, setActiveWorkoutSession] = useState<WorkoutSession | null>(null);
  const [selectedType, setSelectedType] = useState<string>('water');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [ironCommand, setIronCommand] = useState<string | undefined>(undefined);
  const [isLoggingExpanded, setIsLoggingExpanded] = useState(false); // Collapsed by default for easy log viewing
  const [goalModalVisible, setGoalModalVisible] = useState(false); // Custom celebration modal
  const [brewLabVisible, setBrewLabVisible] = useState(false); // Custom liquid synthesis bottom sheet
  const [isWaitingForUnlock, setIsWaitingForUnlock] = useState(false); // Loading screen status

  const [decafPrefs, setDecafPrefs] = useState<Record<string, boolean>>({
    'tea': true,      // Tea defaults to decaf ON
    'coffee': false,  // Coffee defaults to decaf OFF
  });

  // Google Drive Auto-Sync
  const { accessToken } = useGoogleDriveAuth();
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const hasCheckedSync = useRef(false);
  const pushInFlight = useRef(false); // Finding #3: push debounce lock
  const pushPending = useRef(false);
  const pushPromise = useRef<Promise<void> | null>(null);
  const deletionRecoveryAlertShownRef = useRef(false);

  const runTrainingDataOperation = async <T,>(operation: () => Promise<T>): Promise<T> => {
    try {
      const result = await runWithSessionDeletionRecovery(operation);
      deletionRecoveryAlertShownRef.current = false;
      return result;
    } catch (error) {
      if (error instanceof SessionDeletionRecoveryBlockedError) {
        console.error('Training backup operation blocked by deletion recovery', error.recovery.error);
        if (!deletionRecoveryAlertShownRef.current) {
          deletionRecoveryAlertShownRef.current = true;
          triggerAlert(
            'Workout History Needs Attention',
            'An interrupted workout deletion must be recovered before backup or cloud sync. Training remains available, but Recovery history may be incomplete.',
          );
        }
      }
      throw error;
    }
  };

  const guardedDriveSync = (
    token: string,
    password: string,
    onProgress?: (message: string) => void,
  ) => runTrainingDataOperation(() => performDriveSync(token, password, onProgress));

  const guardedDrivePush = (
    token: string,
    password: string,
  ) => runTrainingDataOperation(() => performDrivePush(token, password));

  const reloadMergedAppData = async (): Promise<{ settings: UserSettings; logs: DrinkLog[] }> => {
    const [storedSettings, storedLogs, activeSessionRes] = await Promise.all([
      loadSettings(),
      loadLogs(),
      loadActiveSessionResult(),
    ]);
    settingsRef.current = storedSettings;
    setSettings(storedSettings);
    setLogs(storedLogs);
    if (activeSessionRes.status === 'valid' && activeSessionRes.value && !activeSessionRes.value.endTime) {
      setActiveWorkoutSession(activeSessionRes.value);
    } else if (activeSessionRes.status === 'valid') {
      setActiveWorkoutSession(null);
    }
    setTrainingDataRevision(revision => revision + 1);
    return { settings: storedSettings, logs: storedLogs };
  };

  // Task 5c: Merge Preview Modal State
  const [syncDiffData, setSyncDiffData] = useState<any>(null);
  const [syncDiffModalVisible, setSyncDiffModalVisible] = useState(false);

  useEffect(() => {
    // Only run this check once when app mounts
    if (accessToken && !hasCheckedSync.current && settings) {
      if (settings.googleDriveAutoSyncEnabled === false) {
        hasCheckedSync.current = true;
        return;
      }
      hasCheckedSync.current = true;
      
      const checkAndSync = async () => {
        try {
          setIsSyncing(true);
          
          // Finding #2: Replay any interrupted merge before syncing
          await runTrainingDataOperation(() => replayPendingMerge());
          
          const savedPassword = await SecureStore.getItemAsync('nexus_vault_password');
          
          // Fix E: Check dirty flag
          const isDirty = await AsyncStorage.getItem('nexus_sync_dirty');
          if (isDirty === 'true' && savedPassword) {
            console.log('Detected unsynced offline changes (dirty flag). Running full sync to merge...');
            try {
              const success = await guardedDriveSync(accessToken, savedPassword, (msg) => console.log('Dirty sync:', msg));
              if (success) {
                await reloadMergedAppData();
                await AsyncStorage.setItem('nexus_last_sync', Date.now().toString());
                console.log('Dirty-flag full sync completed successfully.');
                return;
              }
            } catch (dirtyErr) {
              console.log('Dirty-flag full sync failed. Will proceed with normal pull/merge.', dirtyErr);
            }
          }
          
          // 2. Check if a remote backup exists and compute diff silently
          const remoteFile = await findStateFileId(accessToken);
          if (remoteFile) {
            if (savedPassword) {
              try {
                // Task 5e: computeSyncDiff instead of blind sync
                const diff = await runTrainingDataOperation(() => computeSyncDiff(accessToken));
                
                if (diff && (diff.newSessionsCount > 0 || diff.newLogsCount > 0 || diff.settingsChanged || diff.tombstonesApplied > 0)) {
                   setSyncDiffData(diff);
                   setSyncDiffModalVisible(true);
                } else if (diff) {
                   // Diff is exactly 0, meaning we are perfectly in sync. Just update timestamp.
                   await AsyncStorage.setItem('nexus_last_sync', Date.now().toString());
                }
              } catch (diffErr: any) {
                console.log('Diff computation failed. Proceeding with standard silent sync if password is ok.', diffErr);
                // Fallback to normal if password wasn't cached or something else failed
                const success = await guardedDriveSync(accessToken, savedPassword, (msg) => console.log('Fallback sync:', msg));
                if (success) {
                  await reloadMergedAppData();
                  await AsyncStorage.setItem('nexus_last_sync', Date.now().toString());
                }
              }
              return;
            }
            
            // Found a remote file on startup, but no saved password, prompt for password
            setPasswordPromptVisible(true);
          }
        } catch (err: any) {
          console.log('Error doing silent sync:', err);
          if (err.message === 'SECURE_STORE_LOCKED') {
            console.log('SecureStore locked during background sync, aborting cleanly.');
            return;
          }
          // If it failed because of wrong password, clear it so the user can re-enter
          const errMsg = err?.message || '';
          if (errMsg.includes('Wrong password') || errMsg.includes('password') || errMsg.includes('payload')) {
            await SecureStore.deleteItemAsync('nexus_vault_password').catch(console.error);
          }
        } finally {
          setIsSyncing(false);
        }
      };

      checkAndSync();
    }
  }, [accessToken, settings]);

  const handleMergeConfirm = async () => {
    if (!accessToken || settings?.googleDriveAutoSyncEnabled === false) return;
    setSyncDiffModalVisible(false);
    setIsSyncing(true);
    try {
      const savedPassword = await SecureStore.getItemAsync('nexus_vault_password');
      if (savedPassword) {
        const success = await guardedDriveSync(accessToken, savedPassword, (msg) => console.log('Merge preview sync:', msg));
        if (success) {
          await reloadMergedAppData();
          await AsyncStorage.setItem('nexus_last_sync', Date.now().toString());
          triggerAlert('Merge Complete', 'Successfully merged cloud changes.');
        }
      }
    } catch (err: any) {
      triggerAlert('Sync Failed', err.message || 'An error occurred during sync.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExecuteStartupSync = async (password: string) => {
    if (!accessToken || settings?.googleDriveAutoSyncEnabled === false) return;
    setPasswordPromptVisible(false);
    setIsSyncing(true);
    
    try {
      const success = await guardedDriveSync(accessToken, password, (msg) => {
        console.log(msg); // Silent progress
      });
      if (success) {
        // Save the successful password securely for future silent syncs
        await SecureStore.setItemAsync('nexus_vault_password', password).catch(console.error);
        // Reload data into state and notify mounted feature modules.
        await reloadMergedAppData();
        triggerAlert('Cloud Sync Complete', 'Successfully restored your vault from Google Drive.');
      } else {
        await SecureStore.deleteItemAsync('nexus_vault_password').catch(console.error);
        triggerAlert('Sync Failed', 'Could not sync from Google Drive.');
      }
    } catch (err: any) {
      await SecureStore.deleteItemAsync('nexus_vault_password').catch(console.error);
      triggerAlert('Sync Failed', err.message || 'An error occurred during sync.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloudAutoPush = async () => {
    // If auto-sync is disabled or user not logged in, mark dirty so changes sync when enabled, and exit immediately.
    const currentSettings = settingsRef.current ?? settings;
    if (!accessToken || currentSettings?.googleDriveAutoSyncEnabled === false) {
      pushPending.current = false;
      await AsyncStorage.setItem('nexus_sync_dirty', 'true').catch(console.error);
      return;
    }

    // Queue every local mutation. A call arriving during an upload is replayed after
    // the active upload so the latest encrypted storage snapshot is not dropped.
    pushPending.current = true;

    if (pushInFlight.current) {
      if (pushPromise.current) {
        await pushPromise.current;
      }
      return;
    }

    // Acquire the lock before the first await to close the SecureStore race window.
    pushInFlight.current = true;
    const pushTask = (async () => {
      try {
        while (pushPending.current) {
          pushPending.current = false;

          const latestSettings = settingsRef.current ?? settings;
          if (!accessToken || latestSettings?.googleDriveAutoSyncEnabled === false) {
            await AsyncStorage.setItem('nexus_sync_dirty', 'true').catch(console.error);
            break;
          }

          setIsSyncing(true);
          try {
            const savedPassword = await SecureStore.getItemAsync('nexus_vault_password');
            if (!savedPassword) {
              await AsyncStorage.setItem('nexus_sync_dirty', 'true').catch(console.error);
              continue;
            }

            const isDirty = await AsyncStorage.getItem('nexus_sync_dirty');
            if (isDirty === 'true') {
              console.log('Pending offline changes detected. Running full cloud sync...');
              const success = await guardedDriveSync(
                accessToken,
                savedPassword,
                (msg) => console.log('Queued dirty sync:', msg)
              );
              if (success) {
                await reloadMergedAppData();
              }
            } else {
              console.log('Starting silent background cloud push...');
              await guardedDrivePush(accessToken, savedPassword);
              console.log('Silent background cloud push completed.');
            }
          } catch (err: any) {
            await AsyncStorage.setItem('nexus_sync_dirty', 'true').catch(console.error);
            if (err.message === 'SECURE_STORE_LOCKED') {
              console.log('SecureStore locked during background push, aborting cleanly.');
            } else {
              console.log('Silent background cloud push failed:', err);
            }
          } finally {
            setIsSyncing(false);
          }
        }
      } finally {
        pushInFlight.current = false;
        setIsSyncing(false);
      }
    })();

    pushPromise.current = pushTask;
    try {
      await pushTask;
    } finally {
      if (pushPromise.current === pushTask) {
        pushPromise.current = null;
      }
    }
  };

  const handleExternalDataApplied = async (): Promise<void> => {
    await reloadMergedAppData();
  };

  const handleTrainingTemplateOrderChange = async (orderedIds: string[]): Promise<void> => {
    if (!settings) {
      throw new Error('Settings unavailable while saving training template order.');
    }

    const updatedSettings: UserSettings = {
      ...settings,
      trainingTemplateOrder: orderedIds,
    };
    await saveSettingsStrict(updatedSettings);
    settingsRef.current = updatedSettings;
    setSettings(updatedSettings);
    await handleCloudAutoPush();
  };

  // Fix B: Triggered when user toggles Auto-Sync ON in settings.
  // Performs an immediate full pull-merge-push sync so the device is up to date right away.
  const handleAutoSyncEnabled = async () => {
    if (!accessToken) return;
    if (pushPromise.current) {
      await pushPromise.current;
    }
    const currentSettings = settingsRef.current ?? settings;
    if (currentSettings?.googleDriveAutoSyncEnabled === false) return;

    setIsSyncing(true);
    try {
      const savedPassword = await SecureStore.getItemAsync('nexus_vault_password');
      if (savedPassword) {
        const success = await guardedDriveSync(accessToken, savedPassword, (msg) => console.log('Auto-sync toggle sync:', msg));
        if (success) {
          await reloadMergedAppData();
          console.log('Auto-sync enabled: immediate sync completed.');
        }
      }
    } catch (err) {
      console.log('Auto-sync enable sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Fix D1/Issue 3: Called by SettingsModal after a successful manual import.
  // Reloads settings and logs from AsyncStorage into React state so the imported
  // data is immediately visible without requiring a restart. Then, if auto-sync
  // is enabled, pushes the cleaned data (with cleared tombstones) to the cloud
  // FIRST, followed by a full pull-merge-push sync to safely integrate other devices.
  const handleImportComplete = async () => {
    const { settings: storedSettings } = await reloadMergedAppData();
    console.log('Import complete: React state reloaded from AsyncStorage.');

    if (accessToken && storedSettings?.googleDriveAutoSyncEnabled !== false) {
      const savedPwd = await SecureStore.getItemAsync('nexus_vault_password');
      if (savedPwd) {
        try {
          setIsSyncing(true); // Show sync indicator if visible
          // Push FIRST to upload cleaned tombstone set to cloud,
          // preventing re-introduction of cleared tombstones during full sync
          await guardedDrivePush(accessToken, savedPwd);
          // Then do a full sync to pull any newer data from other devices
          await guardedDriveSync(accessToken, savedPwd);
          
          // Reload to pick up any merged data from the pull
          await reloadMergedAppData();
          await AsyncStorage.removeItem('nexus_sync_dirty');
        } catch (err) {
          console.log('Post-import sync failed (will retry on next startup):', err);
        } finally {
          setIsSyncing(false);
        }
      }
    }
  };

  useEffect(() => {
    if (settings?.decafPrefs) {
      setDecafPrefs(settings.decafPrefs);
    }
  }, [settings]);

  const handleUpdateDecafPrefs = async (newPrefs: Record<string, boolean>) => {
    setDecafPrefs(newPrefs);
    if (settings) {
      const updated = { ...settings, decafPrefs: newPrefs };
      settingsRef.current = updated;
      setSettings(updated);
      await saveSettings(updated);
    }
  };

  // Ref to track last lag notification timestamp
  const lastLagNotificationTimeRef = useRef<number>(0);
  // Ref to track last catchup timestamp (actual >= target)
  const lastCatchupTimeRef = useRef<number>(0);

  // State for reusable custom app alerts
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: AppAlertButton[];
  }>({
    visible: false,
    title: '',
    message: '',
    buttons: []
  });

  const triggerAlert = (title: string, message: string, buttons?: AppAlertButton[]) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: 'OK', style: 'default' }]
    });
  };

  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  // Load configuration and data from local storage on launch
  useEffect(() => {
    async function initApp() {
      while (true) {
        try {
          try {
            await runTrainingDataOperation(async () => undefined);
          } catch (recoveryError) {
            if (!(recoveryError instanceof SessionDeletionRecoveryBlockedError)) {
              console.error('Unexpected workout deletion recovery failure', recoveryError);
            }
            // App initialization continues so Training remains available with
            // explicit unknown Recovery history and sync blocked by the gate.
          }
          const storedSettings = await loadSettings();
          const storedLogs = await loadLogs();
          const activeSessionRes = await loadActiveSessionResult();
          
          // Artificially hold the launch screen for 500ms to appreciate the NEXUS logo
          await new Promise(resolve => setTimeout(resolve, 500));
          
          settingsRef.current = storedSettings;
          setSettings(storedSettings);
          setLogs(storedLogs);
          if (activeSessionRes.status === 'valid' && activeSessionRes.value && !activeSessionRes.value.endTime) {
            setActiveWorkoutSession(activeSessionRes.value);
          } else if (activeSessionRes.status === 'valid') {
            setActiveWorkoutSession(null);
          }
          setIsWaitingForUnlock(false);
          break; // Initialization successful
        } catch (err: any) {
          if (err.message === 'SECURE_STORE_LOCKED') {
            console.log('SecureStore is locked. Waiting 1 second to retry loading data...');
            setIsWaitingForUnlock(true);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            console.error('Failed to initialize app data:', err);
            break; // Stop loop on unknown error
          }
        }
      }
    }
    initApp();
  }, []);

  // Request notification permissions on app launch if notifications are enabled
  useEffect(() => {
    async function requestPermissions() {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    }
    if (settings?.lagNotificationsEnabled !== false) {
      requestPermissions();
    }
  }, [settings?.lagNotificationsEnabled]);
  // Auto-collapse drink selection console when soft keyboard is opened to protect spacing (Instant slide)
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardWillShow', () => {
      setIsLoggingExpanded(false); // Collapses selector instantly as the keyboard starts sliding up
    });
    return () => {
      showSubscription.remove();
    };
  }, []);

  // Check dynamic hydration curve lagging duration in real time and schedule native notifications
  useEffect(() => {
    if (!settings || !logs) return;

    // 1. Cancel any previously scheduled lag notifications to avoid multiple triggers
    Notifications.cancelAllScheduledNotificationsAsync().catch(err => {
      console.log('Failed to cancel notifications:', err);
    });

    if (settings.lagNotificationsEnabled === false) {
      return;
    }

    const progress = getTodayProgress(logs, settings);
    const actual = progress.totalEffective;
    const goal = progress.goal;

    // If goal is already achieved, no notifications needed
    if (actual >= goal) {
      return;
    }

    const wakeHour = parseTimeToDecimal(settings.wakeTime || '07:00');
    const sleepHour = parseTimeToDecimal(settings.sleepTime || '22:00');

    let activeDuration = sleepHour - wakeHour;
    if (sleepHour < wakeHour) {
      activeDuration = (sleepHour + 24) - wakeHour;
    }
    activeDuration = Math.max(1, activeDuration);

    const now = new Date();
    const currDecHour = now.getHours() + (now.getMinutes() / 60);

    // Check if user is currently inside sleep hours
    let isSleeping = false;
    if (sleepHour < wakeHour) {
      if (currDecHour >= sleepHour && currDecHour < wakeHour) isSleeping = true;
    } else {
      if (currDecHour < wakeHour || currDecHour >= sleepHour) isSleeping = true;
    }

    // Math Crossing point: t = wakeHour + (actual / goal) * activeDuration
    const t = wakeHour + (actual / goal) * activeDuration;
    
    // The exact decimal hour of the day when the user will be exactly 30 minutes (0.5 hours) behind:
    const T_trigger_dec = t + 0.5;

    // Calculate trigger timestamp
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const T_trigger_timestamp = startOfToday.getTime() + T_trigger_dec * 60 * 60 * 1000;

    // Schedule notification for the future:
    // If they are already > 30 minutes behind, we schedule for 30 minutes in the future to allow an idle grace period.
    // If they are ahead or < 30 minutes behind, we schedule for the exact millisecond they hit 30 minutes of lag.
    const triggerTimeMs = Math.max(Date.now() + 30 * 60 * 1000, T_trigger_timestamp);

    // Calculate water deficit at the trigger time
    const targetAtTrigger = goal * Math.min(1, (T_trigger_dec - wakeHour) / activeDuration);
    const deficitAtTrigger = Math.max(0, Math.round(targetAtTrigger - actual));

    // Check if sleep hours would intersect trigger time
    const triggerDate = new Date(triggerTimeMs);
    const triggerDecHour = triggerDate.getHours() + (triggerDate.getMinutes() / 60);
    let triggerInsideSleep = false;
    if (sleepHour < wakeHour) {
      if (triggerDecHour >= sleepHour && triggerDecHour < wakeHour) triggerInsideSleep = true;
    } else {
      if (triggerDecHour < wakeHour || triggerDecHour >= sleepHour) triggerInsideSleep = true;
    }

    // Only schedule if the trigger time is outside sleeping hours and today
    if (!triggerInsideSleep) {
      const body = T_trigger_timestamp > Date.now()
        ? `You are 30min behind schedule. Drink ${deficitAtTrigger}ml to catch up!`
        : `You are still behind schedule. Drink some water to catch up!`;

      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Hydration Deficit Warning 💧',
          body,
          sound: true,
        },
        trigger: { date: triggerTimeMs, type: 'date' as any },
      }).catch(err => {
        console.log('Failed to schedule local notification:', err);
      });
    }
  }, [logs, settings]);

  // Calculate today's current aggregates (unconditional hook execution order)
  const todayProgress = getTodayProgress(logs, settings || DEFAULT_SETTINGS);

  // Memoize aggregated progress for performance
  const aggregatedProgress = useMemo(() => {
    return getAggregatedProgress(logs, settings || DEFAULT_SETTINGS);
  }, [logs, settings]);

  if (!settings || !fontsLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <Image 
          source={require('./assets/splash-icon.png')} 
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        {isWaitingForUnlock && (
          <Text style={styles.unlockWaitingText}>Waiting for Device Unlock...</Text>
        )}
      </View>
    );
  }

  // Handle logging a drink
  const handleLogDrink = async (amount: number, isDecaf?: boolean, drinkType?: string) => {
    // Tactile haptic tap when logging a drink
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const typeToLog = drinkType || selectedType;
    const config = LIQUID_CONFIGS[typeToLog as LiquidType] || settings?.customLiquids?.[typeToLog] || LIQUID_CONFIGS['water'];
    
    let caffeineMg = undefined;
    if (!isDecaf) {
      if (config.caffeineLookup) {
        const exactMatch = config.caffeineLookup.find(l => l.ml === amount);
        if (exactMatch) {
          caffeineMg = exactMatch.mg;
        } else {
          const sortedLookup = [...config.caffeineLookup].sort((a, b) => a.ml - b.ml);
          let lower = sortedLookup[0];
          let upper = sortedLookup[sortedLookup.length - 1];
          for (let i = 0; i < sortedLookup.length - 1; i++) {
            if (amount > sortedLookup[i].ml && amount <= sortedLookup[i+1].ml) {
              lower = sortedLookup[i];
              upper = sortedLookup[i+1];
              break;
            }
          }
          if (amount < lower.ml) {
            caffeineMg = Math.round((amount / lower.ml) * lower.mg);
          } else if (amount > upper.ml) {
            caffeineMg = Math.round((amount / upper.ml) * upper.mg);
          } else {
            const ratio = (amount - lower.ml) / (upper.ml - lower.ml);
            caffeineMg = Math.round(lower.mg + ratio * (upper.mg - lower.mg));
          }
        }
        } else if (config.caffeineMg) {
          caffeineMg = config.caffeineIsFixed 
            ? config.caffeineMg 
            : Math.round((amount / config.standardPreset) * config.caffeineMg);
        }
    }

    const newLog: DrinkLog = {
      id: generateId(),
      timestamp: Date.now(),
      amount,
      type: typeToLog,
      tag: config.tag,
      effectiveAmount: amount * config.multiplier,
      caffeineMg,
      isDecaf: !!isDecaf,
      goalAtTimeOfLog: calculateGoal(settings)
    };

    setLogs(prevLogs => {
      const updatedLogs = [newLog, ...prevLogs];
      saveLogs(updatedLogs);
      handleCloudAutoPush();

      // Subtle compliance check alert using non-stale prevLogs
      const newProgress = getTodayProgress(updatedLogs, settings);
      const newPercent = Math.round((newProgress.totalEffective / newProgress.goal) * 100);
      
      const oldProgress = getTodayProgress(prevLogs, settings);
      const oldPercent = Math.round((oldProgress.totalEffective / oldProgress.goal) * 100);
            if (newPercent >= 100 && oldPercent < 100) {
        // Trigger exactly three distinct haptic touches when goal is completed
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 120);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 240);

        // Open custom Obsidian-themed celebration modal
        setGoalModalVisible(true);
      }
      return updatedLogs;
    });
  };

  // Handle deleting a logged drink
  const handleDeleteLog = async (id: string) => {
    // Instant deletion without alert confirmation prompts
    await recordDeletion(id); // Finding #1: Track deletion for sync
    const updatedLogs = logs.filter((log) => log.id !== id);
    setLogs(updatedLogs);
    await saveLogs(updatedLogs);
    handleCloudAutoPush();
  };

  // Save profile metrics settings
  const handleSaveSettings = async (updatedSettings: UserSettings) => {
    settingsRef.current = updatedSettings;
    setSettings(updatedSettings);
    await saveSettings(updatedSettings);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleCloudAutoPush();
  };

  // Custom liquid formulas synthesized in the Brew Lab
  const handleAddCustomLiquid = async (newConfig: LiquidConfig) => {
    if (!settings) return;
    const updatedLiquids = {
      ...(settings.customLiquids || {}),
      [newConfig.tag]: newConfig
    };
    const updatedSettings = {
      ...settings,
      customLiquids: updatedLiquids
    };
    settingsRef.current = updatedSettings;
    setSettings(updatedSettings);
    await saveSettings(updatedSettings);
    handleCloudAutoPush();
  };

  const handleDeleteCustomLiquid = async (tag: string) => {
    if (!settings) return;
    const customLiquids = { ...(settings.customLiquids || {}) };
    delete customLiquids[tag];
    const updatedSettings = {
      ...settings,
      customLiquids
    };
    settingsRef.current = updatedSettings;
    setSettings(updatedSettings);
    await saveSettings(updatedSettings);
    handleCloudAutoPush();
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="light" />
      <SyncIndicator isSyncing={isSyncing && settings?.googleDriveAutoSyncEnabled !== false} />
      <View style={styles.container}>
        {activeApp !== 'training' && activeWorkoutSession && !activeWorkoutSession.endTime && (
          <ActiveWorkoutBanner
            session={activeWorkoutSession}
            onResume={() => {
              setActiveApp('training');
              setIronCommand('resume');
            }}
            onQuickWater={async () => {
              await handleLogDrink(250, false, 'water');
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          />
        )}
        {activeApp === 'vault' ? (
          <NexusVault 
            settings={settings}
            onOpenSettings={() => setSettingsVisible(true)}
            onSelectApp={(app, initialCommand) => {
              if (app === 'hydration' || app === 'training') {
                setActiveApp(app);
                if (app === 'training') {
                  setIronCommand(initialCommand);
                }
              }
            }}
            onShowLockedAlert={(moduleName) => {
              triggerAlert(
                'Module Locked',
                `This life-engineering module (${moduleName}) is currently locked in your local vault. Create a new markdown blueprint to deploy.`,
                [{ text: 'Dismiss', style: 'cancel' }]
              );
            }}
            onUpdateSettings={handleSaveSettings}
            activeDaysCount={Object.keys(aggregatedProgress).filter(k => aggregatedProgress[k].logs.length > 0).length}
          />
        ) : activeApp === 'training' ? (
          <TrainingApp 
            onReturn={() => {
              setActiveApp('vault');
              setIronCommand(undefined);
            }} 
            initialCommand={ironCommand}
            onCloudAutoPush={handleCloudAutoPush}
            templateOrder={settings.trainingTemplateOrder}
            onTemplateOrderChange={handleTrainingTemplateOrderChange}
            dataRevision={trainingDataRevision}
            onActiveSessionChange={setActiveWorkoutSession}
            onLogDrink={async (amount, type) => {
              await handleLogDrink(amount, false, type || 'water');
            }}
          />
        ) : (
          <>
            {/* Obsidian-Style Tab and Title Header */}
            <Header 
              activeView={activeView} 
              onViewChange={setActiveView} 
              onOpenSettings={() => setSettingsVisible(true)} 
              onGoBackToHub={() => setActiveApp('vault')}
            />

            {/* Dynamic view manager */}
            <View style={styles.viewContainer}>
              {activeView === 'tracker' && (
                <KeyboardAvoidingView 
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={styles.trackerContainer}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 135 : 0}
                >
                  {/* Daily log scroll checklist */}
                  <DailyNoteView 
                    progress={todayProgress} 
                    onDeleteLog={handleDeleteLog} 
                    settings={settings}
                    logs={logs}
                  />
                  
                  {/* Preset tags selection grid */}
                  <PresetButtons 
                    selectedType={selectedType}
                    onSelectType={setSelectedType}
                    onQuickLog={handleLogDrink}
                    isExpanded={isLoggingExpanded}
                    onSetExpanded={(expanded) => setIsLoggingExpanded(expanded)}
                    settings={settings}
                    onOpenBrewLab={() => setBrewLabVisible(true)}
                    onDeleteCustomLiquid={handleDeleteCustomLiquid}
                    decafPrefs={decafPrefs}
                    onUpdateDecafPrefs={handleUpdateDecafPrefs}
                  />

                  {/* Console command palette */}
                  <CommandPalette 
                    selectedType={selectedType}
                    onLog={handleLogDrink}
                    settings={settings}
                  />
                </KeyboardAvoidingView>
              )}

              {activeView === 'stats' && (
                <GraphView progress={todayProgress} logs={logs} settings={settings} />
              )}

              {activeView === 'calendar' && (
                <CalendarHeatmap logs={logs} settings={settings} />
              )}
            </View>
          </>
        )}

        {/* Profile/Goal Frontmatter Editor */}
        <SettingsModal 
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          settings={settings}
          onSave={handleSaveSettings}
          onAutoSyncEnabled={handleAutoSyncEnabled}
          onImportComplete={handleImportComplete}
          onExternalDataApplied={handleExternalDataApplied}
          runTrainingDataOperation={runTrainingDataOperation}
        />

        {/* Custom Obsidian Celebration Modal */}
        <GoalModal 
          visible={goalModalVisible}
          onClose={() => setGoalModalVisible(false)}
          effectiveIntake={todayProgress.totalEffective}
        />

        {/* Custom Obsidian Reusable Alert Modal */}
        <AppAlertModal 
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        />


        <BrewLabSheet 
          visible={brewLabVisible}
          onClose={() => setBrewLabVisible(false)}
          onSave={handleAddCustomLiquid}
        />

        <PasswordPromptModal
          visible={passwordPromptVisible}
          title="Cloud Backup Found"
          message="A backup was found in Google Drive. Enter your vault password to decrypt and merge it."
          onSubmit={handleExecuteStartupSync}
          onCancel={() => setPasswordPromptVisible(false)}
        />

        <SyncPreviewModal
          visible={syncDiffModalVisible}
          diff={syncDiffData}
          onConfirm={handleMergeConfirm}
          onCancel={() => setSyncDiffModalVisible(false)}
          isMerging={isSyncing}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  unlockWaitingText: {
    fontFamily: theme.typography.semibold,
    fontSize: 16,
    color: theme.colors.textMuted,
    marginTop: 20,
  },
  viewContainer: {
    flex: 1,
  },
  trackerContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
});
