import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Settings, X } from 'lucide-react-native';
import { theme } from '../theme';
import { WorkoutTemplate, WorkoutSession, Exercise, ExerciseDefaults } from '../trainingTypes';
import { generateId } from '../utils';
import { loadTemplates, saveTemplates, loadWorkoutSessions, saveWorkoutSessions, loadCustomExercises, loadExerciseDefaults, loadActiveSession, saveActiveSession } from '../trainingStorage';
import { loadTombstonesStrict, recordDeletion, saveTombstonesStrict } from '../tombstones';

import TrainingSessionView from './TrainingSessionView';
import TrainingHistory from './TrainingHistory';
import TrainingDashboard from './TrainingDashboard';
import TrainingSettings from './TrainingSettings';
import TemplateEditorSheet from './TemplateEditorSheet';
import AppAlertModal, { AppAlertButton } from './AppAlertModal';
import ReorderableTemplateList, { ReorderableTemplateSkeleton } from './ReorderableTemplateList';

function reconcileTemplateOrder(
  templates: WorkoutTemplate[],
  savedOrder?: string[]
): WorkoutTemplate[] {
  if (!savedOrder) return templates;

  const templatesById = new Map(templates.map(template => [template.id, template]));
  const includedIds = new Set<string>();
  const orderedTemplates: WorkoutTemplate[] = [];

  savedOrder.forEach(id => {
    if (includedIds.has(id)) return;
    const template = templatesById.get(id);
    if (!template) return;
    includedIds.add(id);
    orderedTemplates.push(template);
  });

  templates.forEach(template => {
    if (includedIds.has(template.id)) return;
    includedIds.add(template.id);
    orderedTemplates.push(template);
  });

  return orderedTemplates;
}

function hasSameTemplateOrder(left: WorkoutTemplate[], right: WorkoutTemplate[]): boolean {
  return left.length === right.length && left.every((template, index) => template.id === right[index]?.id);
}

interface TrainingAppProps {
  onReturn: () => void;
  initialCommand?: string;
  onCloudAutoPush?: () => void | Promise<void>;
  templateOrder?: string[];
  onTemplateOrderChange?: (ids: string[]) => Promise<void>;
  dataRevision: number;
}

export default function TrainingApp({
  onReturn,
  initialCommand,
  onCloudAutoPush,
  templateOrder,
  onTemplateOrderChange,
  dataRevision,
}: TrainingAppProps) {
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
  const templatesRef = useRef<WorkoutTemplate[]>([]);
  const sessionsRef = useRef<WorkoutSession[]>([]);
  const templatePersistenceInFlightRef = useRef(false);
  const trainingMutationInFlightRef = useRef(0);
  const trainingMutationRevisionRef = useRef(0);
  const pendingTrainingReloadRef = useRef(false);
  const initialLoadInFlightRef = useRef(true);
  const lastDataRevisionRef = useRef(dataRevision);
  const latestDataRevisionRef = useRef(dataRevision);
  latestDataRevisionRef.current = dataRevision;
  const templateOrderRef = useRef(templateOrder);
  templateOrderRef.current = templateOrder;
  const [isLoading, setIsLoading] = useState(true);

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

  function beginTrainingMutation(): void {
    trainingMutationInFlightRef.current += 1;
    trainingMutationRevisionRef.current += 1;
  }

  function finishTrainingMutation(): void {
    trainingMutationInFlightRef.current = Math.max(0, trainingMutationInFlightRef.current - 1);
    if (trainingMutationInFlightRef.current === 0) {
      flushPendingTrainingReload();
    }
  }

  async function reloadTrainingDataAfterMerge(): Promise<void> {
    if (initialLoadInFlightRef.current || trainingMutationInFlightRef.current > 0) {
      pendingTrainingReloadRef.current = true;
      return;
    }

    while (true) {
      const mutationRevisionAtStart = trainingMutationRevisionRef.current;
      const dataRevisionAtStart = latestDataRevisionRef.current;
      const [loadedTemplates, loadedSessions, loadedCustomExercises, loadedExerciseDefaults] = await Promise.all([
        loadTemplates(),
        loadWorkoutSessions(),
        loadCustomExercises(),
        loadExerciseDefaults(),
      ]);

      if (initialLoadInFlightRef.current || trainingMutationInFlightRef.current > 0) {
        pendingTrainingReloadRef.current = true;
        return;
      }
      if (
        trainingMutationRevisionRef.current !== mutationRevisionAtStart ||
        latestDataRevisionRef.current !== dataRevisionAtStart
      ) {
        continue;
      }

      const orderedTemplates = reconcileTemplateOrder(loadedTemplates, templateOrderRef.current);
      pendingTrainingReloadRef.current = false;
      templatesRef.current = orderedTemplates;
      sessionsRef.current = loadedSessions;
      setTemplates(orderedTemplates);
      setSessions(loadedSessions);
      setCustomExercises(loadedCustomExercises);
      setExerciseDefaults(loadedExerciseDefaults);
      return;
    }
  }

  function flushPendingTrainingReload(): void {
    if (
      !pendingTrainingReloadRef.current ||
      initialLoadInFlightRef.current ||
      trainingMutationInFlightRef.current > 0
    ) return;
    pendingTrainingReloadRef.current = false;
    void reloadTrainingDataAfterMerge().catch(error => {
      console.error('Failed to reload merged training data', error);
      triggerAlert('Sync Refresh Error', 'Cloud data was saved, but Training could not refresh. Reopen Training to retry.');
    });
  }

  useEffect(() => {
    async function loadData() {
      const dataRevisionAtStart = latestDataRevisionRef.current;
      const [
        loadedTemplates,
        loadedSessions,
        loadedCustomExercises,
        loadedExerciseDefaults,
        cachedSession,
      ] = await Promise.all([
        loadTemplates(),
        loadWorkoutSessions(),
        loadCustomExercises(),
        loadExerciseDefaults(),
        loadActiveSession(),
      ]);

      initialLoadInFlightRef.current = false;
      if (
        latestDataRevisionRef.current !== dataRevisionAtStart ||
        pendingTrainingReloadRef.current
      ) {
        pendingTrainingReloadRef.current = false;
        await reloadTrainingDataAfterMerge();
      } else {
        const orderedTemplates = reconcileTemplateOrder(loadedTemplates, templateOrderRef.current);
        templatesRef.current = orderedTemplates;
        sessionsRef.current = loadedSessions;
        setTemplates(orderedTemplates);
        setSessions(loadedSessions);
        setCustomExercises(loadedCustomExercises);
        setExerciseDefaults(loadedExerciseDefaults);
      }

      if (cachedSession && !cachedSession.endTime) {
        setActiveSession(cachedSession);
        setActiveView('session');
      } else if (initialCommand) {
        if (initialCommand === 'history') {
          setActiveView('history');
        } else if (initialCommand.startsWith('start ')) {
          const templateName = initialCommand.substring(6).toLowerCase();
          const found = templatesRef.current.find(template => template.name.toLowerCase() === templateName);
          if (found) {
            handleStartSession(found, sessionsRef.current.length);
          } else {
            triggerAlert("Template Not Found", 'Could not find template matching "' + templateName + '"');
          }
        }
      }

      setIsLoading(false);

      // Allow state updates to settle, then enable reactive cloud pushes
      setTimeout(() => {
        isLoadedRef.current = true;
      }, 500);
    }
    void loadData().catch(error => {
      initialLoadInFlightRef.current = false;
      console.error('Failed to load training data', error);
      setIsLoading(false);
      triggerAlert('Load Error', 'Training data could not be loaded. Reopen Training to retry.');
    });
  }, [initialCommand]);

  useEffect(() => {
    if (isLoading) return;
    if (trainingMutationInFlightRef.current > 0) {
      pendingTrainingReloadRef.current = true;
      return;
    }

    const orderedTemplates = reconcileTemplateOrder(templatesRef.current, templateOrder);
    if (hasSameTemplateOrder(templatesRef.current, orderedTemplates)) return;

    templatesRef.current = orderedTemplates;
    setTemplates(orderedTemplates);
  }, [templateOrder, isLoading]);

  useEffect(() => {
    if (dataRevision === lastDataRevisionRef.current) return;
    lastDataRevisionRef.current = dataRevision;
    if (isLoading || initialLoadInFlightRef.current) {
      pendingTrainingReloadRef.current = true;
      return;
    }
    void reloadTrainingDataAfterMerge().catch(error => {
      console.error('Failed to reload merged training data', error);
      triggerAlert('Sync Refresh Error', 'Cloud data was saved, but Training could not refresh. Reopen Training to retry.');
    });
  }, [dataRevision]);

  useEffect(() => {
    if (isLoadedRef.current) {
      console.log('Training state change detected, auto-pushing to cloud...');
      onCloudAutoPush?.();
    }
  }, [sessions, customExercises, exerciseDefaults]);

  const handleStartSession = (template: WorkoutTemplate | null, customSessionCount?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const count = customSessionCount !== undefined ? customSessionCount : sessionsRef.current.length;
    const newSession: WorkoutSession = {
      id: generateId(),
      templateId: template?.id || 'empty-workout',
      templateName: template?.name || 'Workout',
      startTime: Date.now(),
      sets: [],
      totalVolume: 0,
      sessionNumber: count + 1
    };
    setActiveSession(newSession);
    setActiveView('session');
  };

  const handleFinishSession = async (rawSession: WorkoutSession) => {
    beginTrainingMutation();
    try {
      const sessionToSave = { ...rawSession };
      if (!sessionToSave.endTime) {
        sessionToSave.endTime = Date.now();
        sessionToSave.durationMinutes = Math.round((sessionToSave.endTime - sessionToSave.startTime) / 60000);
      }

      // Calculate total volume
      let vol = 0;
      sessionToSave.sets.forEach(s => { vol += (s.weight * s.reps); });
      sessionToSave.totalVolume = vol;

      const dedupedSessions = sessionsRef.current.filter(s => s.id !== sessionToSave.id);
      const newSessions = [sessionToSave, ...dedupedSessions];
      sessionsRef.current = newSessions;
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
    } finally {
      finishTrainingMutation();
    }
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

  const persistTemplateMutation = async (
    nextTemplates: WorkoutTemplate[],
    previousTemplates: WorkoutTemplate[],
    errorTitle: string,
    errorMessage: string
  ): Promise<boolean> => {
    if (templatePersistenceInFlightRef.current) return false;

    templatePersistenceInFlightRef.current = true;
    beginTrainingMutation();
    templatesRef.current = nextTemplates;
    setTemplates(nextTemplates);

    try {
      await saveTemplates(nextTemplates);
      if (onTemplateOrderChange) {
        await onTemplateOrderChange(nextTemplates.map(template => template.id));
      } else {
        await onCloudAutoPush?.();
      }
      return true;
    } catch (error) {
      console.error(errorMessage, error);
      templatesRef.current = previousTemplates;
      setTemplates(previousTemplates);

      try {
        await saveTemplates(previousTemplates);
        if (onTemplateOrderChange) {
          await onTemplateOrderChange(previousTemplates.map(template => template.id));
        }
      } catch (rollbackError) {
        console.error('Failed to roll back workout template persistence', rollbackError);
      }

      triggerAlert(errorTitle, errorMessage);
      return false;
    } finally {
      templatePersistenceInFlightRef.current = false;
      finishTrainingMutation();
    }
  };

  const handleSaveTemplate = async (template: WorkoutTemplate) => {
    const previousTemplates = templatesRef.current;
    const existingIndex = previousTemplates.findIndex(t => t.id === template.id);
    let updatedTemplates: WorkoutTemplate[];
    if (existingIndex >= 0) {
      updatedTemplates = [...previousTemplates];
      updatedTemplates[existingIndex] = template;
    } else {
      updatedTemplates = [...previousTemplates, template];
    }

    await persistTemplateMutation(
      updatedTemplates,
      previousTemplates,
      'Save Error',
      'Could not save workout template. Your previous templates were restored.'
    );
  };

  const handleDeleteTemplate = async (id: string) => {
    if (templatePersistenceInFlightRef.current) return;

    const previousTemplates = templatesRef.current;
    const updatedTemplates = previousTemplates.filter(template => template.id !== id);
    if (updatedTemplates.length === previousTemplates.length) return;

    templatePersistenceInFlightRef.current = true;
    beginTrainingMutation();
    let previousTombstones: Awaited<ReturnType<typeof loadTombstonesStrict>> | null = null;
    let mutationStarted = false;

    try {
      previousTombstones = await loadTombstonesStrict();
      mutationStarted = true;
      templatesRef.current = updatedTemplates;
      setTemplates(updatedTemplates);

      await saveTemplates(updatedTemplates);
      const nextTombstones = previousTombstones.map(tombstone => ({ ...tombstone }));
      const existingTombstone = nextTombstones.find(tombstone => tombstone.id === id);
      if (existingTombstone) {
        existingTombstone.deletedAt = Date.now();
      } else {
        nextTombstones.push({ id, deletedAt: Date.now() });
      }
      await saveTombstonesStrict(nextTombstones);

      if (onTemplateOrderChange) {
        await onTemplateOrderChange(updatedTemplates.map(template => template.id));
      } else {
        await onCloudAutoPush?.();
      }
    } catch (error) {
      console.error('Failed to delete workout template', error);
      templatesRef.current = previousTemplates;
      setTemplates(previousTemplates);

      if (mutationStarted && previousTombstones) {
        try {
          await saveTemplates(previousTemplates);
          await saveTombstonesStrict(previousTombstones);
          if (onTemplateOrderChange) {
            await onTemplateOrderChange(previousTemplates.map(template => template.id));
          }
        } catch (rollbackError) {
          console.error('Failed to roll back workout template deletion', rollbackError);
        }
      }

      triggerAlert('Delete Error', 'Could not delete workout template. Your previous templates were restored.');
    } finally {
      templatePersistenceInFlightRef.current = false;
      finishTrainingMutation();
    }
  };

  const handleReorderTemplates = async (updatedTemplates: WorkoutTemplate[]): Promise<boolean> => {
    const previousTemplates = templatesRef.current;
    if (hasSameTemplateOrder(previousTemplates, updatedTemplates)) return true;

    return persistTemplateMutation(
      updatedTemplates,
      previousTemplates,
      'Reorder Error',
      'Could not save the new workout order. Your previous order was restored.'
    );
  };

  const handleCustomExercisesChange = (updated: Exercise[]): void => {
    beginTrainingMutation();
    try {
      setCustomExercises(updated);
    } finally {
      finishTrainingMutation();
    }
  };

  const handleTrainingSettingsClose = async (): Promise<void> => {
    setSettingsVisible(false);
    beginTrainingMutation();
    try {
      setExerciseDefaults(await loadExerciseDefaults());
    } finally {
      finishTrainingMutation();
    }
  };

  const renderHome = () => (
    <ReorderableTemplateList
      templates={templates}
      onStart={handleStartSession}
      onEdit={template => {
        setEditingTemplate(template);
        setTemplateEditorVisible(true);
      }}
      onReorder={handleReorderTemplates}
      onCreate={() => {
        setEditingTemplate(null);
        setTemplateEditorVisible(true);
      }}
      onOpenHistory={() => setActiveView('history')}
      onOpenProgress={() => setActiveView('dashboard')}
    />
  );

  const handleDeleteSession = async (sessionId: string) => {
    beginTrainingMutation();
    try {
      await recordDeletion(sessionId); // Finding #1: Track deletion for sync
      const updated = sessionsRef.current.filter(s => s.id !== sessionId);
      sessionsRef.current = updated;
      setSessions(updated);
      try {
        await saveWorkoutSessions(updated);
      } catch (e) {
        console.error("Failed to delete session", e);
        triggerAlert("Delete Error", "Could not delete workout session.");
      }
    } finally {
      finishTrainingMutation();
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.backBtn}>
            <View style={{ backgroundColor: theme.colors.surfaceElevated, borderRadius: 15, padding: 4 }}>
              <X size={20} color={theme.colors.textMuted} />
            </View>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>Training</Text>
          <View style={styles.settingsBtn}>
            <Settings size={22} color={theme.colors.accent} />
          </View>
        </View>
        <ReorderableTemplateSkeleton />
      </View>
    );
  }

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
          <View style={{ backgroundColor: theme.colors.surfaceElevated, borderRadius: 15, padding: 4 }}>
            <X size={20} color={theme.colors.textMuted} />
          </View>
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
           onCustomExercisesChange={handleCustomExercisesChange}
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
            onCustomExercisesChange={handleCustomExercisesChange}
            onClose={handleTrainingSettingsClose}
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
          onCustomExercisesChange={handleCustomExercisesChange}
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
});
