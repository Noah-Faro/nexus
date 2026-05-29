import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, Alert, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Play, ChevronLeft, BarChart2, List, Plus, Settings, Edit2 } from 'lucide-react-native';
import { theme } from '../theme';
import { WorkoutTemplate, WorkoutSession, Exercise, ExerciseDefaults } from '../trainingTypes';
import { generateId } from '../utils';
import { EXERCISE_LIBRARY } from '../exerciseLibrary';
import { loadTemplates, saveTemplates, loadWorkoutSessions, saveWorkoutSessions, loadCustomExercises, loadExerciseDefaults, loadActiveSession, saveActiveSession } from '../trainingStorage';

import TrainingSessionView from './TrainingSessionView';
import TrainingHistory from './TrainingHistory';
import TrainingDashboard from './TrainingDashboard';
import TrainingSettings from './TrainingSettings';
import TemplateEditorSheet from './TemplateEditorSheet';
import AppAlertModal, { AppAlertButton } from './AppAlertModal';

// Child components we'll build later
// import TemplateList from './TemplateList';

interface TrainingAppProps {
  onReturn: () => void;
  initialCommand?: string;
  onCloudAutoPush?: () => void;
}

export default function TrainingApp({ onReturn, initialCommand, onCloudAutoPush }: TrainingAppProps) {
  const [activeView, setActiveView] = useState<'home' | 'session' | 'history' | 'dashboard'>('home');
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [exerciseDefaults, setExerciseDefaults] = useState<Record<string, ExerciseDefaults>>({});
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [templateEditorVisible, setTemplateEditorVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const isLoadedRef = useRef(false);

  // Custom alert modal state
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

  useEffect(() => {
    async function loadData() {
      const loadedTemplates = await loadTemplates();
      const loadedSessions = await loadWorkoutSessions();
      setTemplates(loadedTemplates);
      setSessions(loadedSessions);
      setCustomExercises(await loadCustomExercises());
      setExerciseDefaults(await loadExerciseDefaults());
      
      const cachedSession = await loadActiveSession();
      if (cachedSession && !cachedSession.endTime) {
        setActiveSession(cachedSession);
        setActiveView('session');
      } else if (initialCommand) {
        if (initialCommand === 'history') {
          setActiveView('history');
        } else if (initialCommand.startsWith('start ')) {
          const tName = initialCommand.substring(6).toLowerCase();
          const found = loadedTemplates.find(t => t.name.toLowerCase() === tName);
          if (found) {
            handleStartSession(found, loadedSessions.length);
          } else {
            triggerAlert("Template Not Found", `Could not find template matching "${tName}"`);
          }
        }
      }
      
      // Allow state updates to settle, then enable reactive cloud pushes
      setTimeout(() => {
        isLoadedRef.current = true;
      }, 500);
    }
    loadData();
  }, [initialCommand]);

  useEffect(() => {
    if (isLoadedRef.current) {
      console.log('Training state change detected, auto-pushing to cloud...');
      onCloudAutoPush?.();
    }
  }, [templates, sessions, customExercises, exerciseDefaults]);

  const handleStartSession = (template: WorkoutTemplate, customSessionCount?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const count = customSessionCount !== undefined ? customSessionCount : sessions.length;
    const newSession: WorkoutSession = {
      id: generateId(),
      templateId: template.id,
      templateName: template.name,
      startTime: Date.now(),
      sets: [],
      totalVolume: 0,
      sessionNumber: count + 1
    };
    setActiveSession(newSession);
    setActiveView('session');
  };

  const handleFinishSession = async (rawSession: WorkoutSession) => {
    const sessionToSave = { ...rawSession };
    if (!sessionToSave.endTime) {
      sessionToSave.endTime = Date.now();
      sessionToSave.durationMinutes = Math.round((sessionToSave.endTime - sessionToSave.startTime) / 60000);
    }
    
    // Calculate total volume
    let vol = 0;
    sessionToSave.sets.forEach(s => { vol += (s.weight * s.reps); });
    sessionToSave.totalVolume = vol;

    const dedupedSessions = sessions.filter(s => s.id !== sessionToSave.id);
    const newSessions = [sessionToSave, ...dedupedSessions];
    
    setSessions(newSessions);
    try {
      await saveWorkoutSessions(newSessions);
    } catch (e) {
      console.error("Failed to save session", e);
      triggerAlert("Save Error", "Could not save workout session to device storage.");
    }

    await saveActiveSession(null);
    setActiveSession(null);
    setActiveView('home');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const cancelSession = () => {
    triggerAlert(
      "Cancel Session?",
      "Are you sure you want to discard this session?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Discard", 
          style: "destructive", 
          onPress: async () => {
            await saveActiveSession(null);
            setActiveSession(null);
            setActiveView('home');
          }
        }
      ]
    );
  };

  // Minimal Home View (Template Picker)
  const handleSaveTemplate = async (template: WorkoutTemplate) => {
    const existingIndex = templates.findIndex(t => t.id === template.id);
    let updatedTemplates;
    if (existingIndex >= 0) {
      updatedTemplates = [...templates];
      updatedTemplates[existingIndex] = template;
    } else {
      updatedTemplates = [...templates, template];
    }
    setTemplates(updatedTemplates);
    try {
      await saveTemplates(updatedTemplates);
    } catch (e) {
      console.error("Failed to save template", e);
      triggerAlert("Save Error", "Could not save workout template.");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const updatedTemplates = templates.filter(t => t.id !== id);
    setTemplates(updatedTemplates);
    try {
      await saveTemplates(updatedTemplates);
    } catch (e) {
      console.error("Failed to delete template", e);
      triggerAlert("Delete Error", "Could not delete workout template.");
    }
  };

  const renderHome = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={styles.sectionTitle}>START WORKOUT</Text>
      {templates.map(t => (
        <View 
          key={t.id} 
          style={[styles.templateCard, { borderLeftColor: t.color || theme.colors.accent }]}
        >
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={styles.templateName}>{t.name}</Text>
            <Text style={styles.templateSummary}>{t.exercises.length} Exercises</Text>
          </View>
          <TouchableOpacity 
            style={{ padding: 8, marginRight: 8 }} 
            onPress={() => {
              setEditingTemplate(t);
              setTemplateEditorVisible(true);
            }}
          >
            <Edit2 size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.startBtn, { backgroundColor: t.color || theme.colors.accent }]} 
            onPress={() => handleStartSession(t)}
          >
            <Play fill="#000" size={16} color="#000" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity 
        style={styles.createTemplateBtn} 
        onPress={() => {
          setEditingTemplate(null);
          setTemplateEditorVisible(true);
        }}
      >
        <Plus size={20} color={theme.colors.text} />
        <Text style={styles.createTemplateText}>Create Template</Text>
      </TouchableOpacity>

      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => setActiveView('history')}>
          <List size={24} color={theme.colors.textMuted} />
          <Text style={styles.statCardText}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => setActiveView('dashboard')}>
          <BarChart2 size={24} color={theme.colors.textMuted} />
          <Text style={styles.statCardText}>Progress</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const handleDeleteSession = async (sessionId: string) => {
    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    try {
      await saveWorkoutSessions(updated);
    } catch (e) {
      console.error("Failed to delete session", e);
      triggerAlert("Delete Error", "Could not delete workout session.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (activeView === 'session') {
            triggerAlert(
              "Exit Workout?",
              "Are you sure you want to exit? This will discard your current workout progress.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Exit & Discard",
                  style: "destructive",
                  onPress: async () => {
                    await saveActiveSession(null);
                    setActiveSession(null);
                    setActiveView('home');
                  }
                }
              ]
            );
          } else if (activeView === 'home') {
            onReturn();
          } else {
            setActiveView('home');
          }
        }} activeOpacity={0.7}>
          <ChevronLeft size={28} color={theme.colors.accent} style={{ marginLeft: -8 }} />
          <Text style={styles.backText}>
            {activeView === 'home' ? 'Vault' : 'Back'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle} numberOfLines={1}>
          {activeView === 'home' ? 'Training' : 
           activeView === 'session' ? activeSession?.templateName : 
           activeView === 'history' ? 'History' : 'Progress'}
        </Text>

        {activeView === 'home' ? (
          <TouchableOpacity style={styles.settingsBtn} onPress={() => setSettingsVisible(true)} activeOpacity={0.7}>
            <Settings size={22} color={theme.colors.accent} />
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>
      
      {activeView === 'home' && renderHome()}
      {activeView === 'session' && activeSession && (
         <TrainingSessionView 
           session={activeSession}
           templateExercises={templates.find(t => t.id === activeSession.templateId)?.exercises || []}
           customExercises={customExercises}
           exerciseDefaults={exerciseDefaults}
           history={sessions}
           onFinishSession={handleFinishSession}
           onCustomExercisesChange={setCustomExercises}
           triggerAlert={triggerAlert}
         />
      )}
      {activeView === 'history' && (
         <TrainingHistory 
           sessions={sessions} 
           onDeleteSession={handleDeleteSession} 
           onEditSession={(s) => {
             setActiveSession(s);
             setActiveView('session');
           }}
           customExercises={customExercises}
           triggerAlert={triggerAlert}
         />
      )}
      {activeView === 'dashboard' && (
         <TrainingDashboard sessions={sessions} />
      )}

      {settingsVisible && (
        <Modal visible={settingsVisible} animationType="slide" transparent={true}>
          <TrainingSettings 
            customExercises={customExercises}
            onCustomExercisesChange={setCustomExercises}
            onClose={() => {
              setSettingsVisible(false);
              // Refresh defaults when closing settings
              loadExerciseDefaults().then(setExerciseDefaults);
            }} 
          />
        </Modal>
      )}

      {templateEditorVisible && (
        <TemplateEditorSheet
          visible={templateEditorVisible}
          onClose={() => setTemplateEditorVisible(false)}
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onDelete={handleDeleteTemplate}
          customExercises={customExercises}
          onCustomExercisesChange={setCustomExercises}
        />
      )}

      <AppAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 16,
    paddingTop: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backText: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    color: theme.colors.accent,
    marginLeft: -4,
  },
  headerTitle: {
    fontFamily: theme.typography.bold,
    fontSize: 18,
    color: theme.colors.text,
    textAlign: 'center',
    flex: 2,
  },
  settingsBtn: {
    flex: 1,
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: theme.colors.textMuted,
    letterSpacing: 2,
    marginBottom: 16,
    marginTop: 8,
  },
  templateCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  templateName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: 4,
  },
  templateSummary: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  startBtn: {
    padding: 8,
    borderRadius: 8,
  },
  createTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: theme.borderRadius.md,
    marginTop: 8,
    marginBottom: 24,
  },
  createTemplateText: {
    fontFamily: 'Outfit_600SemiBold',
    color: theme.colors.text,
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 20,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.text,
    marginTop: 8,
    fontWeight: theme.typography.weight.medium,
  }
});
