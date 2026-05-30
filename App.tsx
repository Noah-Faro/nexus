import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, Platform, StatusBar, KeyboardAvoidingView, Keyboard, Image } from 'react-native';
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
import ConsoleHelpModal from './src/components/ConsoleHelpModal';
import * as Notifications from 'expo-notifications';
import AppAlertModal, { AppAlertButton } from './src/components/AppAlertModal';
import PasswordPromptModal from './src/components/PasswordPromptModal';
import NexusVault from './src/components/NexusVault';
import BrewLabSheet from './src/components/BrewLabSheet';
import TrainingApp from './src/components/TrainingApp';
import SyncIndicator from './src/components/SyncIndicator';
import { useGoogleDriveAuth } from './src/googleAuth';
import { performDriveSync, performDrivePush } from './src/sync';
import { findStateFileId } from './src/googleDrive';
import { replayPendingMerge } from './src/backup';
import { recordDeletion } from './src/tombstones';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [activeApp, setActiveApp] = useState<'vault' | 'hydration' | 'training'>('vault');
  const [activeView, setActiveView] = useState<'tracker' | 'stats' | 'calendar'>('tracker');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [selectedType, setSelectedType] = useState<string>('water');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [ironCommand, setIronCommand] = useState<string | undefined>(undefined);
  const [isLoggingExpanded, setIsLoggingExpanded] = useState(false); // Collapsed by default for easy log viewing
  const [goalModalVisible, setGoalModalVisible] = useState(false); // Custom celebration modal
  const [helpModalVisible, setHelpModalVisible] = useState(false); // Custom console help modal
  const [brewLabVisible, setBrewLabVisible] = useState(false); // Custom liquid synthesis bottom sheet

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

  useEffect(() => {
    // Only run this check once when app mounts, accessToken is available, settings are loaded,
    // and auto-sync is explicitly enabled. Guard against null settings (Fix A: settings starts
    // as null on mount; null?.googleDriveAutoSyncEnabled !== false evaluates to true, causing
    // the sync to fire before settings have loaded from AsyncStorage).
    if (accessToken && !hasCheckedSync.current && settings && settings.googleDriveAutoSyncEnabled !== false) {
      hasCheckedSync.current = true;
      
      const checkAndSync = async () => {
        try {
          setIsSyncing(true);
          
          // Finding #2: Replay any interrupted merge before syncing
          await replayPendingMerge();
          
          const savedPassword = await SecureStore.getItemAsync('nexus_vault_password');
          
          // Fix E: Check dirty flag — if offline edits exist, do a full pull-merge-push instead
          // of push-only. This prevents Device A's pushed changes from being overwritten by
          // Device B blindly pushing its own stale state on reconnect.
          const isDirty = await AsyncStorage.getItem('nexus_sync_dirty');
          if (isDirty === 'true' && savedPassword) {
            console.log('Detected unsynced offline changes (dirty flag). Running full sync to merge...');
            try {
              const success = await performDriveSync(accessToken, savedPassword, (msg) => console.log('Dirty sync:', msg));
              if (success) {
                const storedSettings = await loadSettings();
                const storedLogs = await loadLogs();
                setSettings(storedSettings);
                setLogs(storedLogs);
                console.log('Dirty-flag full sync completed successfully.');
                return;
              }
            } catch (dirtyErr) {
              console.log('Dirty-flag full sync failed. Will proceed with normal pull/merge.', dirtyErr);
            }
          }
          
          // 2. Check if a remote backup exists
          const remoteFile = await findStateFileId(accessToken);
          if (remoteFile) {
            if (savedPassword) {
              const success = await performDriveSync(accessToken, savedPassword, (msg) => {
                console.log('Silent sync:', msg);
              });
              if (success) {
                // Reload data into state
                const storedSettings = await loadSettings();
                const storedLogs = await loadLogs();
                setSettings(storedSettings);
                setLogs(storedLogs);
                console.log('Silent auto-sync completed successfully');
                return;
              }
            }
            
            // Found a remote file on startup, but no saved password or silent sync failed, prompt for password
            setPasswordPromptVisible(true);
          }
        } catch (err: any) {
          console.log('Error doing silent sync:', err);
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

  const handleExecuteStartupSync = async (password: string) => {
    if (!accessToken) return;
    setPasswordPromptVisible(false);
    setIsSyncing(true);
    
    try {
      const success = await performDriveSync(accessToken, password, (msg) => {
        console.log(msg); // Silent progress
      });
      if (success) {
        // Save the successful password securely for future silent syncs
        await SecureStore.setItemAsync('nexus_vault_password', password).catch(console.error);
        // Reload data into state
        const storedSettings = await loadSettings();
        const storedLogs = await loadLogs();
        setSettings(storedSettings);
        setLogs(storedLogs);
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
    // Finding #3: Skip if a push is already in flight to prevent race conditions
    if (pushInFlight.current) return;
    if (accessToken && settings?.googleDriveAutoSyncEnabled !== false) {
      try {
        const savedPassword = await SecureStore.getItemAsync('nexus_vault_password');
        if (savedPassword) {
          pushInFlight.current = true;
          setIsSyncing(true);
          console.log('Starting silent background cloud push...');
          await performDrivePush(accessToken, savedPassword);
          console.log('Silent background cloud push completed.');
        }
      } catch (err) {
        console.log('Silent background cloud push failed:', err);
      } finally {
        pushInFlight.current = false;
        setIsSyncing(false);
      }
    }
  };

  // Fix B: Triggered when user toggles Auto-Sync ON in settings.
  // Performs an immediate full pull-merge-push sync so the device is up to date right away.
  const handleAutoSyncEnabled = async () => {
    if (!accessToken) return;
    setIsSyncing(true);
    try {
      const savedPassword = await SecureStore.getItemAsync('nexus_vault_password');
      if (savedPassword) {
        const success = await performDriveSync(accessToken, savedPassword, (msg) => console.log('Auto-sync toggle sync:', msg));
        if (success) {
          const storedSettings = await loadSettings();
          const storedLogs = await loadLogs();
          setSettings(storedSettings);
          setLogs(storedLogs);
          console.log('Auto-sync enabled: immediate sync completed.');
        }
      }
    } catch (err) {
      console.log('Auto-sync enable sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Fix D1: Called by SettingsModal after a successful manual import.
  // Reloads settings and logs from AsyncStorage into React state so the imported
  // data is immediately visible without requiring a restart, then pushes to Drive.
  const handleImportComplete = async () => {
    const storedSettings = await loadSettings();
    const storedLogs = await loadLogs();
    setSettings(storedSettings);
    setLogs(storedLogs);
    console.log('Import complete: React state reloaded from AsyncStorage.');
    // Push the freshly merged state to cloud so startup sync won't overwrite it
    handleCloudAutoPush();
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
      setSettings(updated);
      await saveSettings(updated);
    }
  };

  const handleVaultLogDrink = (amount: number, type: string, isDecafOverride?: boolean) => {
    setSelectedType(type);
    const isDecaf = isDecafOverride !== undefined ? isDecafOverride : (decafPrefs[type] || false);
    
    // Check if settings exist, compute whether this drink achieves the daily goal
    const config = LIQUID_CONFIGS[type as LiquidType] || settings?.customLiquids?.[type] || LIQUID_CONFIGS['water'];
    const effectiveAmount = amount * config.multiplier;
    const currentProgress = getTodayProgress(logs, settings || DEFAULT_SETTINGS);
    const newEffective = currentProgress.totalEffective + effectiveAmount;
    
    // Goal is completed if it crosses the goal threshold and wasn't already completed
    const isGoalAchieved = newEffective >= currentProgress.goal && currentProgress.totalEffective < currentProgress.goal;

    handleLogDrink(amount, isDecaf, type);

    // Only trigger the standard success alert modal if we aren't displaying the Goal Completion Celebration modal,
    // which prevents two React Native modals from opening simultaneously and freezing the view hierarchy.
    if (!isGoalAchieved) {
      const label = isDecaf ? `Decaf ${config.label}` : config.label;
      triggerAlert(
        'Drink Logged',
        `Registered ${amount}ml of ${label} successfully from Vault Console.`,
        [{ text: 'OK' }]
      );
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
      const storedSettings = await loadSettings();
      const storedLogs = await loadLogs();
      
      // Artificially hold the launch screen for 500ms to appreciate the NEXUS logo
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSettings(storedSettings);
      setLogs(storedLogs);
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
    const ratePerHour = goal / activeDuration;
    const deficitAtTrigger = Math.round(ratePerHour * 0.5);

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
      </View>
    );
  }

  // Handle logging a drink
  const handleLogDrink = async (amount: number, isDecaf?: boolean, drinkType?: string) => {
    // Tactile haptic tap when logging a drink
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const typeToLog = drinkType || selectedType;
    const config = LIQUID_CONFIGS[typeToLog as LiquidType] || settings?.customLiquids?.[typeToLog] || LIQUID_CONFIGS['water'];
    
    // Coffee flat caffeine math: Coffee logged below 250ml records 80mg, otherwise scales linearly
    let caffeineMg = undefined;
    if (config.caffeineMg && !isDecaf) {
      if (typeToLog === 'coffee') {
        if (amount < 250) {
          caffeineMg = 80;
        } else {
          caffeineMg = Math.round((amount / 250) * 80);
        }
      } else {
        caffeineMg = Math.round((amount / config.standardPreset) * config.caffeineMg);
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
    setSettings(updatedSettings);
    await saveSettings(updatedSettings);
    handleCloudAutoPush();
  };

  // Process slash commands from Obsidian command console
  const handleCommand = async (cmdString: string) => {
    const parts = cmdString.trim().split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
      case '/help':
        setHelpModalVisible(true);
        break;

      case '/goal': {
        const amt = parseInt(parts[1], 10);
        if (isNaN(amt) || amt <= 0) {
          triggerAlert('Invalid Parameter', 'Please provide a valid volume in ml (e.g. /goal 3000)');
          return;
        }
        const updated = {
          ...settings,
          useAutoGoal: false,
          customGoal: amt
        };
        setSettings(updated);
        await saveSettings(updated);
        triggerAlert('Goal Locked', `Intake target locked to: ${amt}ml`);
        break;
      }

      case '/weight': {
        const wt = parseFloat(parts[1]);
        if (isNaN(wt) || wt <= 0) {
          triggerAlert('Invalid Parameter', 'Please provide a valid numeric weight (e.g. /weight 75)');
          return;
        }
        const updated: UserSettings = {
          ...settings,
          weight: wt,
          useAutoGoal: true // return to auto computation
        };
        setSettings(updated);
        await saveSettings(updated);
        const computed = calculateGoal(updated);
        triggerAlert('Weight Updated', `Weight set to ${wt}${settings.weightUnit}. Auto-calculated target: ${computed}ml`);
        break;
      }

      case '/clear':
        triggerAlert(
          "Reset Today's Logs?",
          "This will delete all logged liquid entries for today. Are you sure?",
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Clear', 
              style: 'destructive',
              onPress: async () => {
                // Keep history, wipe only today's dates
                const todayKey = todayProgress.date;
                
                // Let's filter correctly by ensuring standard key comparison
                const filtered = logs.filter(log => {
                  const date = new Date(log.timestamp);
                  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                  return key !== todayKey;
                });

                setLogs(filtered);
                await saveLogs(filtered);
                handleCloudAutoPush();
                triggerAlert('Cleared', "Today's logs have been cleared.");
              }
            }
          ]
        );
        break;

      case '/reset':
        triggerAlert(
          'Wipe Entire Database?',
          'This will permanently delete ALL historical hydration logs and restore profile settings to defaults. This action is irreversible!',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Wipe Database',
              style: 'destructive',
              onPress: async () => {
                setLogs([]);
                setSettings(DEFAULT_SETTINGS);
                await saveLogs([]);
                await saveSettings(DEFAULT_SETTINGS);
                handleCloudAutoPush();
                triggerAlert('Database Wiped', 'Application restored to clean state.');
              }
            }
          ]
        );
        break;

      default:
        triggerAlert('Command Unknown', `Shortcut "${command}" was not recognized. Type /help to see shortcuts.`);
        break;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="light" />
      <SyncIndicator isSyncing={isSyncing} />
      <View style={styles.container}>
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
            onLogDrinkDirect={handleVaultLogDrink}
          />
        ) : activeApp === 'training' ? (
          <TrainingApp 
            onReturn={() => {
              setActiveApp('vault');
              setIronCommand(undefined);
            }} 
            initialCommand={ironCommand}
            onCloudAutoPush={handleCloudAutoPush}
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
                    onCommand={handleCommand}
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
        />

        {/* Custom Obsidian Celebration Modal */}
        <GoalModal 
          visible={goalModalVisible}
          onClose={() => setGoalModalVisible(false)}
          effectiveIntake={todayProgress.totalEffective}
        />

        {/* Custom Obsidian Console Help Modal */}
        <ConsoleHelpModal 
          visible={helpModalVisible}
          onClose={() => setHelpModalVisible(false)}
          settings={settings}
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
    width: 140,
    height: 140,
  },
  viewContainer: {
    flex: 1,
  },
  trackerContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
});
