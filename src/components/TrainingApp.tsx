import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, SafeAreaView, Platform, KeyboardAvoidingView, Alert, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Play, RotateCcw, Clock, ArrowLeft, BarChart2, List, Plus, Settings, Edit2 } from 'lucide-react-native';
import { theme } from '../theme';
import { WorkoutTemplate, WorkoutSession, LoggedSet, Exercise, TemplateExercise } from '../trainingTypes';
import { EXERCISE_LIBRARY } from '../exerciseLibrary';
import { loadTemplates, saveTemplates, loadWorkoutSessions, saveWorkoutSessions, loadCustomExercises, loadExerciseDefaults } from '../trainingStorage';

import TrainingSessionView from './TrainingSessionView';
import TrainingHistory from './TrainingHistory';
import TrainingDashboard from './TrainingDashboard';
import TrainingSettings from './TrainingSettings';
import TemplateEditorSheet from './TemplateEditorSheet';

// Child components we'll build later
// import TemplateList from './TemplateList';

interface TrainingAppProps {
  onReturn: () => void;
  initialCommand?: string;
}

export default function TrainingApp({ onReturn, initialCommand }: TrainingAppProps) {
  const [activeView, setActiveView] = useState<'home' | 'session' | 'history' | 'dashboard'>('home');
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [exerciseDefaults, setExerciseDefaults] = useState<Record<string, { defaultWeight: number, defaultReps: number }>>({});
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [templateEditorVisible, setTemplateEditorVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    async function loadData() {
      const loadedTemplates = await loadTemplates();
      setTemplates(loadedTemplates);
      setSessions(await loadWorkoutSessions());
      setCustomExercises(await loadCustomExercises());
      setExerciseDefaults(await loadExerciseDefaults());
      
      // Handle initialCommand after loading templates
      if (initialCommand) {
        if (initialCommand === 'history') {
          setActiveView('history');
        } else if (initialCommand.startsWith('start ')) {
          const tName = initialCommand.substring(6).toLowerCase();
          const found = loadedTemplates.find(t => t.name.toLowerCase() === tName);
          if (found) {
            handleStartSession(found);
          } else {
            Alert.alert("Template Not Found", `Could not find template matching "${tName}"`);
          }
        }
      }
    }
    loadData();
  }, [initialCommand]);

  const handleStartSession = (template: WorkoutTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newSession: WorkoutSession = {
      id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      templateId: template.id,
      templateName: template.name,
      startTime: Date.now(),
      sets: [],
      totalVolume: 0,
      sessionNumber: sessions.length + 1
    };
    setActiveSession(newSession);
    setActiveView('session');
  };

  const handleFinishSession = async (sessionToSave: WorkoutSession) => {
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
    await saveWorkoutSessions(newSessions);

    setActiveSession(null);
    setActiveView('home');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const cancelSession = () => {
    Alert.alert(
      "Cancel Session?",
      "Are you sure you want to discard this session?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Discard", 
          style: "destructive", 
          onPress: () => {
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
    // We don't have a saveTemplates function in trainingStorage.ts yet, but let's assume it or use AsyncStorage directly here for simplicity, or just update state for now.
    // Wait, let's just update state, and we can add saveTemplates to trainingStorage.ts later if needed.
    setTemplates(updatedTemplates);
    await saveTemplates(updatedTemplates);
  };

  const handleDeleteTemplate = async (id: string) => {
    const updatedTemplates = templates.filter(t => t.id !== id);
    setTemplates(updatedTemplates);
    await saveTemplates(updatedTemplates);
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
    await saveWorkoutSessions(updated);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (activeView === 'session') {
            Alert.alert(
              "Discard Session?",
              "Are you sure you want to discard this workout? All progress will be lost.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Discard", style: "destructive", onPress: () => { setActiveSession(null); setActiveView('home'); } }
              ]
            );
          } else if (activeView === 'home') {
            onReturn();
          } else {
            setActiveView('home');
          }
        }}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeView === 'home' ? 'NEXUS.Iron' : 
           activeView === 'session' ? activeSession?.templateName : 
           activeView === 'history' ? 'History' : 'Progress'}
        </Text>
        <View style={{ width: 60, alignItems: 'flex-end' }}>
          {activeView === 'home' && (
            <TouchableOpacity onPress={() => setSettingsVisible(true)}>
              <Settings size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
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
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 20,
    color: theme.colors.text,
    letterSpacing: 2,
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
