import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, Alert, Platform, StatusBar, KeyboardAvoidingView, Keyboard } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';

// Core imports
import { theme } from './src/theme';
import { DrinkLog, UserSettings, LiquidType, LIQUID_CONFIGS } from './src/types';
import { 
  loadSettings, 
  saveSettings, 
  loadLogs, 
  saveLogs, 
  calculateGoal, 
  getTodayProgress 
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

export default function App() {
  const [activeView, setActiveView] = useState<'tracker' | 'stats' | 'calendar'>('tracker');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [selectedType, setSelectedType] = useState<LiquidType>('water');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isLoggingExpanded, setIsLoggingExpanded] = useState(false); // Collapsed by default for easy log viewing
  const [goalModalVisible, setGoalModalVisible] = useState(false); // Custom celebration modal
  const [helpModalVisible, setHelpModalVisible] = useState(false); // Custom console help modal

  // Load configuration and data from local storage on launch
  useEffect(() => {
    async function initApp() {
      const storedSettings = await loadSettings();
      const storedLogs = await loadLogs();
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

  if (!settings) {
    return <View style={styles.loadingScreen} />; // Simple black fallback screen during mount
  }

  // Calculate today's current aggregates
  const todayProgress = getTodayProgress(logs, settings);

  // Handle logging a drink
  const handleLogDrink = async (amount: number) => {
    // Tactile haptic tap when logging a drink
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const config = LIQUID_CONFIGS[selectedType];
    const newLog: DrinkLog = {
      id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      timestamp: Date.now(),
      amount,
      type: selectedType,
      tag: config.tag,
      effectiveAmount: Math.round(amount * config.multiplier),
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
    
    const newGoal = calculateGoal(updatedSettings);
    Alert.alert(
      'Config Saved',
      `Dynamic profile successfully loaded.\nNew hydration target: ${newGoal}ml`,
      [{ text: 'OK' }]
    );
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
          Alert.alert('Invalid Parameter', 'Please provide a valid volume in ml (e.g. /goal 3000)');
          return;
        }
        const updated = {
          ...settings,
          useAutoGoal: false,
          customGoal: amt
        };
        setSettings(updated);
        await saveSettings(updated);
        Alert.alert('Goal Locked', `Intake target locked to: ${amt}ml`);
        break;
      }

      case '/weight': {
        const wt = parseFloat(parts[1]);
        if (isNaN(wt) || wt <= 0) {
          Alert.alert('Invalid Parameter', 'Please provide a valid numeric weight (e.g. /weight 75)');
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
        Alert.alert('Weight Updated', `Weight set to ${wt}${settings.weightUnit}. Auto-calculated target: ${computed}ml`);
        break;
      }

      case '/clear':
        Alert.alert(
          'Reset Today\'s Logs?',
          'This will delete all logged liquid entries for today. Are you sure?',
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
                Alert.alert('Cleared', 'Today\'s logs have been cleared.');
              }
            }
          ]
        );
        break;

      case '/reset':
        Alert.alert(
          'Wipe Entire Database?',
          'This will permanently delete ALL historical hydration logs and restore profile settings to defaults. This action is irreversible!',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Wipe Database',
              style: 'destructive',
              onPress: async () => {
                setLogs([]);
                setSettings({
                  weight: 70,
                  weightUnit: 'kg',
                  activityLevel: 'moderate',
                  customGoal: null,
                  useAutoGoal: true,
                });
                await saveLogs([]);
                await saveSettings({
                  weight: 70,
                  weightUnit: 'kg',
                  activityLevel: 'moderate',
                  customGoal: null,
                  useAutoGoal: true,
                });
                Alert.alert('Database Wiped', 'Application restored to clean state.');
              }
            }
          ]
        );
        break;

      default:
        Alert.alert('Command Unknown', `Shortcut "${command}" was not recognized. Type /help to see shortcuts.`);
        break;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="light" />
      <View style={styles.container}>
        {/* Obsidian-Style Tab and Title Header */}
        <Header 
          activeView={activeView} 
          onViewChange={setActiveView} 
          onOpenSettings={() => setSettingsVisible(true)} 
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
              />
              
              {/* Preset tags selection grid */}
              <PresetButtons 
                selectedType={selectedType}
                onSelectType={setSelectedType}
                onQuickLog={handleLogDrink}
                isExpanded={isLoggingExpanded}
                onToggleExpand={() => setIsLoggingExpanded(!isLoggingExpanded)}
              />

              {/* Console command palette */}
              <CommandPalette 
                selectedType={selectedType}
                onLog={handleLogDrink}
                onCommand={handleCommand}
              />
            </KeyboardAvoidingView>
          )}

          {activeView === 'stats' && (
            <GraphView progress={todayProgress} />
          )}

          {activeView === 'calendar' && (
            <CalendarHeatmap logs={logs} settings={settings} />
          )}
        </View>

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
  },
  viewContainer: {
    flex: 1,
  },
  trackerContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
});
