import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Settings, X, ChevronDown } from 'lucide-react-native';
import { theme } from '../theme';
import { WorkoutTemplate, WorkoutSession, Exercise, ExerciseDefaults } from '../trainingTypes';
import { generateId, getExerciseById, type StorageLoadStatus } from '../utils';
import {
  loadActiveSessionResult,
  loadCustomExercisesResult,
  loadExerciseDefaultsResult,
  loadStatusNeedsAttention,
  loadTemplatesResult,
  loadWorkoutSessionsResult,
  recoveryHistoryCompletenessForStatus,
  saveActiveSessionStrict,
  saveTemplates,
  saveWorkoutSessions,
} from '../trainingStorage';
import { finishSessionTransaction } from '../finishSessionTransaction';
import { loadTombstonesStrict, saveTombstonesStrict } from '../tombstones';
import { deleteSessionTransaction } from '../sessionDeletionTransaction';
import {
  clearSessionDeletionJournalStrict,
  recoverPendingSessionDeletion,
  saveSessionDeletionJournalStrict,
} from '../sessionDeletionJournal';
import { runTombstoneTransaction } from '../tombstoneTransactionQueue';

import TrainingSessionView from './TrainingSessionView';
import TrainingHistory from './TrainingHistory';
import TrainingDashboard from './TrainingDashboard';
import TrainingSettings from './TrainingSettings';
import TemplateEditorSheet from './TemplateEditorSheet';
import AppAlertModal, { AppAlertButton } from './AppAlertModal';
import ReorderableTemplateList, { ReorderableTemplateSkeleton } from './ReorderableTemplateList';
import ActiveWorkoutCard from './ActiveWorkoutCard';

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

function trainingLoadWarning(
  results: readonly { label: string; status: StorageLoadStatus }[],
): string | null {
  const affected = results.filter(result => loadStatusNeedsAttention(result.status));
  if (!affected.length) return null;
  const details = affected.map(result => {
    if (result.status === 'invalid') {
      return `${result.label}: malformed records excluded`;
    }
    if (result.status === 'locked') {
      return `${result.label}: encrypted storage locked`;
    }
    return `${result.label}: saved value unreadable`;
  });
  return `${details.join('. ')}. Original saved values were left unchanged.`;
}

interface TrainingAppProps {
  onReturn: () => void;
  initialCommand?: string;
  onCloudAutoPush?: () => void | Promise<void>;
  templateOrder?: string[];
  onTemplateOrderChange?: (ids: string[]) => Promise<void>;
  dataRevision: number;
  onActiveSessionChange?: (session: WorkoutSession | null) => void;
  onLogDrink?: (amount: number, type?: string) => Promise<void> | void;
}

export default function TrainingApp({
  onReturn,
  initialCommand,
  onCloudAutoPush,
  templateOrder,
  onTemplateOrderChange,
  dataRevision,
  onActiveSessionChange,
  onLogDrink,
}: TrainingAppProps) {
  const [activeView, setActiveView] = useState<'home' | 'session' | 'history' | 'dashboard'>('home');
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [exerciseDefaults, setExerciseDefaults] = useState<Record<string, ExerciseDefaults>>({});
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isFinishing, setIsFinishing] = useState(false);
  const [sessionLoadStatus, setSessionLoadStatus] = useState<StorageLoadStatus>('absent');
  const [templateLoadStatus, setTemplateLoadStatus] = useState<StorageLoadStatus>('absent');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [templateEditorVisible, setTemplateEditorVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const isLoadedRef = useRef(false);
  const templatesRef = useRef<WorkoutTemplate[]>([]);
  const sessionsRef = useRef<WorkoutSession[]>([]);
  const templatePersistenceInFlightRef = useRef(false);
  const finishSessionInFlightRef = useRef(false);
  const sessionDeletionInFlightRef = useRef(false);
  const sessionDeletionRecoveryRequiredRef = useRef(false);
  const suppressNextSessionsAutoPushRef = useRef(false);
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
      const [templatesResult, sessionsResult, customExercisesResult, exerciseDefaultsResult] = await Promise.all([
        loadTemplatesResult(),
        loadWorkoutSessionsResult(),
        loadCustomExercisesResult(),
        loadExerciseDefaultsResult(),
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

      const orderedTemplates = reconcileTemplateOrder(templatesResult.value, templateOrderRef.current);
      pendingTrainingReloadRef.current = false;
      templatesRef.current = orderedTemplates;
      sessionsRef.current = sessionsResult.value;
      setTemplates(orderedTemplates);
      setSessions(sessionsResult.value);
      setCustomExercises(customExercisesResult.value);
      setExerciseDefaults(exerciseDefaultsResult.value);
      setTemplateLoadStatus(templatesResult.status);
      const effectiveSessionStatus = sessionDeletionRecoveryRequiredRef.current
        ? 'unreadable'
        : sessionsResult.status;
      setSessionLoadStatus(effectiveSessionStatus);
      const warning = trainingLoadWarning([
        { label: 'Workout templates', status: templatesResult.status },
        { label: 'Training history', status: effectiveSessionStatus },
        { label: 'Custom exercises', status: customExercisesResult.status },
        { label: 'Exercise defaults', status: exerciseDefaultsResult.status },
      ]);
      if (warning) triggerAlert('Training Data Warning', warning);
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
      const deletionRecovery = await runTombstoneTransaction(recoverPendingSessionDeletion);
      sessionDeletionRecoveryRequiredRef.current = deletionRecovery.status === 'unavailable';
      const [
        templatesResult,
        sessionsResult,
        customExercisesResult,
        exerciseDefaultsResult,
        activeSessionResult,
      ] = await Promise.all([
        loadTemplatesResult(),
        loadWorkoutSessionsResult(),
        loadCustomExercisesResult(),
        loadExerciseDefaultsResult(),
        loadActiveSessionResult(),
      ]);

      initialLoadInFlightRef.current = false;
      if (
        latestDataRevisionRef.current !== dataRevisionAtStart ||
        pendingTrainingReloadRef.current
      ) {
        pendingTrainingReloadRef.current = false;
        await reloadTrainingDataAfterMerge();
      } else {
        const orderedTemplates = reconcileTemplateOrder(templatesResult.value, templateOrderRef.current);
        templatesRef.current = orderedTemplates;
        sessionsRef.current = sessionsResult.value;
        setTemplates(orderedTemplates);
        setSessions(sessionsResult.value);
        setCustomExercises(customExercisesResult.value);
        setExerciseDefaults(exerciseDefaultsResult.value);
        setTemplateLoadStatus(templatesResult.status);
        setSessionLoadStatus(
          deletionRecovery.status === 'unavailable'
            ? deletionRecovery.historyStatus
            : sessionsResult.status,
        );
      }

      const effectiveSessionStatus = deletionRecovery.status === 'unavailable'
        ? deletionRecovery.historyStatus
        : sessionsResult.status;
      const warning = trainingLoadWarning([
        { label: 'Workout templates', status: templatesResult.status },
        { label: 'Training history', status: effectiveSessionStatus },
        { label: 'Custom exercises', status: customExercisesResult.status },
        { label: 'Exercise defaults', status: exerciseDefaultsResult.status },
        { label: 'Active workout', status: activeSessionResult.status },
      ]);
      if (warning) triggerAlert('Training Data Warning', warning);
      if (deletionRecovery.status === 'unavailable') {
        console.error('Could not recover an interrupted workout deletion', deletionRecovery.error);
        triggerAlert(
          'Workout History Needs Attention',
          'An interrupted workout deletion could not be safely recovered. Recovery calculations may be incomplete and automatic Training cloud updates are paused. Reopen Training to retry before syncing.',
        );
      }

      if (
        activeSessionResult.status === 'valid' &&
        activeSessionResult.value &&
        !activeSessionResult.value.endTime
      ) {
        setActiveSession(activeSessionResult.value);
        onActiveSessionChange?.(activeSessionResult.value);
        setActiveView('session');
      } else {
        onActiveSessionChange?.(null);
        if (initialCommand) {
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
    if (suppressNextSessionsAutoPushRef.current) {
      suppressNextSessionsAutoPushRef.current = false;
      return;
    }
    if (sessionDeletionRecoveryRequiredRef.current) return;
    if (isLoadedRef.current) {
      console.log('Training state change detected, auto-pushing to cloud...');
      onCloudAutoPush?.();
    }
  }, [sessions, customExercises, exerciseDefaults]);

  useEffect(() => {
    if (initialCommand === 'resume' && activeSession && !activeSession.endTime) {
      setActiveView('session');
    }
  }, [initialCommand, activeSession]);

  const handleStartSession = (template: WorkoutTemplate | null, customSessionCount?: number) => {
    if (activeSession && !activeSession.endTime) {
      triggerAlert(
        "Active Workout in Progress",
        `You already have an active workout ("${activeSession.templateName}"). Finish or discard it before starting a new one.`,
        [
          { text: "Resume Current", style: "default", onPress: () => setActiveView('session') },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }
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
    onActiveSessionChange?.(newSession);
    void saveActiveSessionStrict(newSession).catch(err => {
      console.error('Failed to save initial active workout session', err);
    });
    setActiveView('session');
  };

  const handleFinishSession = async (rawSession: WorkoutSession) => {
    if (finishSessionInFlightRef.current) return;
    finishSessionInFlightRef.current = true;
    setIsFinishing(true);
    beginTrainingMutation();
    try {
      const sessionToSave = { ...rawSession };
      if (!sessionToSave.endTime) {
        sessionToSave.endTime = Date.now();
        sessionToSave.durationMinutes = Math.round((sessionToSave.endTime - sessionToSave.startTime) / 60000);
      }

      // Calculate total volume (excluding cardio)
      let vol = 0;
      sessionToSave.sets.forEach(s => {
        const ex = getExerciseById(s.exerciseId, customExercises);
        const isCardio = Boolean(
          s.timeMinutes !== undefined ||
          ex?.muscleGroup === 'cardio' ||
          ex?.trackingType === 'time' ||
          ex?.trackingType === 'time_distance'
        );
        if (!isCardio) {
          vol += (s.weight * s.reps);
        }
      });
      sessionToSave.totalVolume = vol;

      await finishSessionTransaction(sessionsRef.current, sessionToSave, {
        persistHistory: nextSessions => saveWorkoutSessions([...nextSessions]),
        clearActiveCache: () => saveActiveSessionStrict(null),
        commit: nextSessions => {
          sessionsRef.current = nextSessions;
          setSessions(nextSessions);
          setSessionLoadStatus('valid');
          setActiveSession(null);
          onActiveSessionChange?.(null);
          setActiveView('home');
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            .catch(error => console.error('Workout saved, but success haptic failed', error));
        },
      });
    } catch (error) {
      console.error('Failed to finish session durably', error);
      triggerAlert(
        'Save Error',
        'Your workout remains open. Check device storage or unlock secure storage, then tap Finish Session again.',
      );
    } finally {
      finishSessionInFlightRef.current = false;
      setIsFinishing(false);
      finishTrainingMutation();
    }
  };

  const discardActiveSession = async (): Promise<void> => {
    if (finishSessionInFlightRef.current) return;
    finishSessionInFlightRef.current = true;
    setIsFinishing(true);
    beginTrainingMutation();
    try {
      await saveActiveSessionStrict(null);
      setActiveSession(null);
      onActiveSessionChange?.(null);
      setActiveView('home');
    } catch (error) {
      console.error('Failed to clear active workout durably', error);
      triggerAlert(
        'Discard Error',
        'Your workout remains open because it could not be cleared from device storage. Unlock secure storage or free device space, then retry.',
      );
    } finally {
      finishSessionInFlightRef.current = false;
      setIsFinishing(false);
      finishTrainingMutation();
    }
  };

  const promptActiveWorkoutActions = () => {
    if (isFinishing) return;
    triggerAlert(
      "Active Workout",
      "What would you like to do with your active workout?",
      [
        {
          text: "Minimize Workout",
          style: "default",
          onPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveView('home');
          }
        },
        { 
          text: "Discard Workout", 
          style: "destructive", 
          onPress: () => {
            void discardActiveSession().catch(error => {
              console.error('Unexpected active-workout discard failure', error);
            });
          }
        },
        { text: "Resume Workout", style: "cancel" }
      ]
    );
  };

  const cancelSession = () => {
    promptActiveWorkoutActions();
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
    let deletionDurable = false;
    let deletionTombstonesSnapshot: Awaited<ReturnType<typeof loadTombstonesStrict>> | null = null;

    try {
      await runTombstoneTransaction(async () => {
        const previousTombstones = await loadTombstonesStrict();
        deletionTombstonesSnapshot = previousTombstones;
        templatesRef.current = updatedTemplates;
        setTemplates(updatedTemplates);

        try {
          await saveTemplates(updatedTemplates);
          const deletedAt = Date.now();
          const nextTombstones = [
            ...previousTombstones.filter(tombstone => tombstone.id !== id),
            { id, deletedAt },
          ];
          await saveTombstonesStrict(nextTombstones);
          deletionDurable = true;
        } catch (error) {
          templatesRef.current = previousTemplates;
          setTemplates(previousTemplates);
          try {
            await saveTombstonesStrict(previousTombstones);
            await saveTemplates(previousTemplates);
          } catch (rollbackError) {
            console.error('Failed to roll back workout template deletion', rollbackError);
          }
          throw error;
        }
      });

      if (onTemplateOrderChange) {
        await onTemplateOrderChange(updatedTemplates.map(template => template.id));
      } else {
        await onCloudAutoPush?.();
      }
    } catch (error) {
      console.error('Failed to delete workout template', error);
      templatesRef.current = previousTemplates;
      setTemplates(previousTemplates);
      if (deletionDurable && deletionTombstonesSnapshot) {
        try {
          await runTombstoneTransaction(async () => {
            await saveTombstonesStrict(deletionTombstonesSnapshot ?? []);
            await saveTemplates(previousTemplates);
          });
          if (onTemplateOrderChange) {
            await onTemplateOrderChange(previousTemplates.map(template => template.id));
          }
        } catch (rollbackError) {
          console.error('Failed to roll back workout template deletion after sync failure', rollbackError);
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
      const defaultsResult = await loadExerciseDefaultsResult();
      setExerciseDefaults(defaultsResult.value);
      const warning = trainingLoadWarning([
        { label: 'Exercise defaults', status: defaultsResult.status },
      ]);
      if (warning) triggerAlert('Training Data Warning', warning);
    } finally {
      finishTrainingMutation();
    }
  };

  const renderHome = () => (
    <View style={styles.homeContainer}>
      {activeSession && !activeSession.endTime && (
        <ActiveWorkoutCard
          session={activeSession}
          onResume={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveView('session');
          }}
        />
      )}
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
    </View>
  );

  const handleDeleteSession = async (sessionId: string) => {
    if (sessionDeletionInFlightRef.current) return;
    if (!sessionsRef.current.some(session => session.id === sessionId)) return;

    sessionDeletionInFlightRef.current = true;
    beginTrainingMutation();
    try {
      const result = await runTombstoneTransaction(async () => {
        const previousSessions = [...sessionsRef.current];
        const previousTombstones = [...await loadTombstonesStrict()];
        const deletedAt = Date.now();
        return deleteSessionTransaction(
          previousSessions,
          previousTombstones,
          sessionId,
          deletedAt,
          {
            persistJournal: saveSessionDeletionJournalStrict,
            clearJournal: clearSessionDeletionJournalStrict,
            persistSessions: saveWorkoutSessions,
            persistTombstones: saveTombstonesStrict,
            readSessions: async () => {
              const sessionsResult = await loadWorkoutSessionsResult();
              return { status: sessionsResult.status, value: sessionsResult.value };
            },
            readTombstones: loadTombstonesStrict,
            commit: nextSessions => {
              sessionsRef.current = nextSessions;
              setSessionLoadStatus('valid');
              setSessions(nextSessions);
            },
          },
        );
      });

      if (result.status === 'noop') return;
      if (result.status === 'committed') {
        if (result.journalCleanupError) {
          console.error('Workout deleted, but deletion journal cleanup was deferred', result.journalCleanupError);
        }
        return;
      }

      console.error('Failed to delete workout session transactionally', result.error, result.rollbackErrors);
      if (result.rollback === 'incomplete') {
        sessionDeletionRecoveryRequiredRef.current = true;
        if (result.reconciledSessions) {
          suppressNextSessionsAutoPushRef.current = true;
          sessionsRef.current = result.reconciledSessions;
          setSessionLoadStatus(
            result.reconciledHistoryStatus === 'valid'
              ? 'valid'
              : 'unreadable',
          );
          setSessions(result.reconciledSessions);
        } else {
          setSessionLoadStatus('unreadable');
        }
        triggerAlert(
          'Workout History Needs Attention',
          'The deletion did not complete and the saved history could not be fully restored. Recovery calculations may be incomplete and automatic Training cloud updates are paused. Reopen Training to recover before syncing.',
        );
      } else {
        triggerAlert('Delete Error', 'Could not delete workout session. Your workout history was left unchanged.');
      }
    } catch (error) {
      console.error('Failed to prepare workout deletion', error);
      triggerAlert('Delete Error', 'Could not delete workout session. Your workout history was left unchanged.');
    } finally {
      sessionDeletionInFlightRef.current = false;
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
        {activeView === 'session' ? (
          <TouchableOpacity
            style={styles.backBtn}
            disabled={isFinishing}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveView('home');
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Minimize workout"
          >
            <View style={{ backgroundColor: theme.colors.surfaceElevated, borderRadius: 15, padding: 4 }}>
              <ChevronDown size={20} color={theme.colors.text} />
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (activeView === 'home') {
                onReturn();
              } else {
                setActiveView('home');
              }
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={activeView === 'home' ? 'Return to vault' : 'Back to training'}
          >
            <View style={{ backgroundColor: theme.colors.surfaceElevated, borderRadius: 15, padding: 4 }}>
              <X size={20} color={theme.colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}
        
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {activeView === 'home' ? 'Training' : 
           activeView === 'session' ? activeSession?.templateName : 
           activeView === 'history' ? 'History' : 'Progress'}
        </Text>

        {activeView === 'session' ? (
          <TouchableOpacity
            style={styles.settingsBtn}
            disabled={isFinishing}
            onPress={promptActiveWorkoutActions}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Active workout options"
          >
            <View style={{ backgroundColor: theme.colors.surfaceElevated, borderRadius: 15, padding: 4 }}>
              <X size={20} color={theme.colors.textMuted} />
            </View>
          </TouchableOpacity>
        ) : activeView === 'home' ? (
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setSettingsVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open training settings"
          >
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
           isFinishing={isFinishing}
           onCustomExercisesChange={handleCustomExercisesChange}
           triggerAlert={triggerAlert}
           onLogDrink={onLogDrink}
           onCloudAutoPush={onCloudAutoPush}
           onMinimize={() => setActiveView('home')}
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
          <TrainingDashboard
            sessions={sessions}
            templates={templates}
            customExercises={customExercises}
            historyCompleteness={recoveryHistoryCompletenessForStatus(sessionLoadStatus)}
            templateLoadStatus={templateLoadStatus}
          />
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
  homeContainer: {
    flex: 1,
  },
});
