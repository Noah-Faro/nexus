import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, Alert, Platform, StatusBar, KeyboardAvoidingView, Keyboard, Image } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useFonts, Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';

// Core imports
import { theme } from './src/theme';
import { DrinkLog, UserSettings, LiquidType, LIQUID_CONFIGS, LiquidConfig } from './src/types';
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
import SilentLagBanner from './src/components/SilentLagBanner';
import AppAlertModal, { AppAlertButton } from './src/components/AppAlertModal';
import NexusVault from './src/components/NexusVault';
import BrewLabSheet from './src/components/BrewLabSheet';

export default function App() {
  const [activeApp, setActiveApp] = useState<'vault' | 'hydration'>('vault');
  const [activeView, setActiveView] = useState<'tracker' | 'stats' | 'calendar'>('tracker');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [selectedType, setSelectedType] = useState<LiquidType>('water');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isLoggingExpanded, setIsLoggingExpanded] = useState(false); // Collapsed by default for easy log viewing
  const [goalModalVisible, setGoalModalVisible] = useState(false); // Custom celebration modal
  const [helpModalVisible, setHelpModalVisible] = useState(false); // Custom console help modal
  const [brewLabVisible, setBrewLabVisible] = useState(false); // Custom liquid synthesis bottom sheet
  const [silentLagVisible, setSilentLagVisible] = useState(false);
  const [lagMinutes, setLagMinutes] = useState(0);
  const [deficitMl, setDeficitMl] = useState(0);

  const [decafPrefs, setDecafPrefs] = useState<Record<string, boolean>>({
    'tea': true,      // Tea defaults to decaf ON
    'coffee': false,  // Coffee defaults to decaf OFF
  });

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
    const config = LIQUID_CONFIGS[type] || settings?.customLiquids?.[type] || LIQUID_CONFIGS['water'];
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

  // Auto-collapse drink selection console when soft keyboard is opened to protect spacing (Instant slide)
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardWillShow', () => {
      setIsLoggingExpanded(false); // Collapses selector instantly as the keyboard starts sliding up
    });
    return () => {
      showSubscription.remove();
    };
  }, []);

  // Check dynamic hydration curve lagging duration in real time
  useEffect(() => {
    if (!settings || !logs) return;

    const parseTimeToDecimal = (timeStr: string): number => {
      const [h, m] = timeStr.split(':').map(Number);
      return h + (m / 60);
    };

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

    if (isSleeping) {
      setSilentLagVisible(false);
      return;
    }

    // Compute target vs actual
    const progress = getTodayProgress(logs, settings);
    const actual = progress.totalEffective;
    const goal = progress.goal;

    let target = 0;
    if (sleepHour < wakeHour) {
      if (currDecHour >= wakeHour) {
        target = goal * ((currDecHour - wakeHour) / activeDuration);
      } else if (currDecHour < sleepHour) {
        target = goal * ((currDecHour + 24 - wakeHour) / activeDuration);
      }
    } else {
      target = goal * ((currDecHour - wakeHour) / activeDuration);
    }

    if (actual >= target) {
      setSilentLagVisible(false);
      return;
    }

    // Math Crossing point: t = wakeHour + (actual / goal) * activeDuration
    const t = wakeHour + (actual / goal) * activeDuration;
    
    let elapsedHours = 0;
    if (sleepHour < wakeHour) {
      const relCurr = currDecHour >= wakeHour ? currDecHour : currDecHour + 24;
      const relT = Math.max(wakeHour, t);
      elapsedHours = relCurr - relT;
    } else {
      elapsedHours = currDecHour - Math.max(wakeHour, t);
    }

    const elapsedMinutes = Math.max(0, elapsedHours * 60);
    const deficit = Math.max(0, target - actual);

    // If lagging for more than 30 minutes, trigger the silent banner!
    if (elapsedMinutes >= 30) {
      setLagMinutes(elapsedMinutes);
      setDeficitMl(deficit);
      
      const timer = setTimeout(() => {
        setSilentLagVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setSilentLagVisible(false);
    }
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

  // Calculate today's current aggregates
  const todayProgress = getTodayProgress(logs, settings);

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
      id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      timestamp: Date.now(),
      amount,
      type: typeToLog,
      tag: config.tag,
      effectiveAmount: amount * config.multiplier,
      caffeineMg,
      isDecaf: !!isDecaf
    };

    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    await saveLogs(updatedLogs);

    // Subtle compliance check alert
    const newProgress = getTodayProgress(updatedLogs, settings);
    const newPercent = Math.round((newProgress.totalEffective / newProgress.goal) * 100);
    const oldPercent = Math.round((todayProgress.totalEffective / todayProgress.goal) * 100);
    
    if (newPercent >= 100 && oldPercent < 100) {
      // Trigger exactly three distinct haptic touches when goal is completed
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 120);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 240);

      // Open custom Obsidian-themed celebration modal
      setGoalModalVisible(true);
    }
  };

  // Handle deleting a logged drink
  const handleDeleteLog = async (id: string) => {
    // Instant deletion without alert confirmation prompts
    const updatedLogs = logs.filter((log) => log.id !== id);
    setLogs(updatedLogs);
    await saveLogs(updatedLogs);
  };

  // Save profile metrics settings
  const handleSaveSettings = async (updatedSettings: UserSettings) => {
    setSettings(updatedSettings);
    await saveSettings(updatedSettings);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      <View style={styles.container}>
        {activeApp === 'vault' ? (
          <NexusVault 
            settings={settings}
            onOpenSettings={() => setSettingsVisible(true)}
            onSelectApp={(app) => {
              if (app === 'hydration') {
                setActiveApp('hydration');
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
            activeDaysCount={Object.keys(getAggregatedProgress(logs, settings)).filter(k => getAggregatedProgress(logs, settings)[k].logs.length > 0).length}
            onLogDrinkDirect={handleVaultLogDrink}
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

        <SilentLagBanner 
          visible={silentLagVisible}
          onClose={() => setSilentLagVisible(false)}
          lagMinutes={lagMinutes}
          deficitMl={deficitMl}
        />

        <BrewLabSheet 
          visible={brewLabVisible}
          onClose={() => setBrewLabVisible(false)}
          onSave={handleAddCustomLiquid}
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
