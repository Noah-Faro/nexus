import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown, ChevronUp, Trash2, Plus, Info, Droplet } from 'lucide-react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '../theme';
import { WorkoutSession, LoggedSet, TemplateExercise, Exercise, ExerciseDefaults } from '../trainingTypes';
import ExercisePickerModal from './ExercisePickerModal';
import QuickWaterModal from './QuickWaterModal';
import { generateId, getExerciseById } from '../utils';
import StepperInput from './StepperInput';
import IntegerSlider from './IntegerSlider';
import CoachCard from './CoachCard';
import { AppAlertButton } from './AppAlertModal';
import { saveActiveSessionStrict } from '../trainingStorage';
import { shouldEnqueueActiveSessionAutosave } from '../serializedAsyncQueue';
import { getActiveGymProfile } from '../gymStorage';
import { loadSettings } from '../storage';
import { UserSettings } from '../types';

const RPE_VALUES = [5, 6, 7, 8, 9, 10] as const;

interface TrainingSessionViewProps {
  session: WorkoutSession;
  templateExercises: TemplateExercise[];
  customExercises: Exercise[];
  exerciseDefaults: Record<string, ExerciseDefaults>;
  history: WorkoutSession[];
  onFinishSession: (session: WorkoutSession) => void;
  isFinishing: boolean;
  onCustomExercisesChange?: (updated: Exercise[]) => void;
  triggerAlert: (title: string, message: string, buttons?: AppAlertButton[]) => void;
  onLogDrink?: (amount: number, type?: string) => Promise<void> | void;
  onCloudAutoPush?: () => void | Promise<void>;
  onMinimize?: () => void;
}

export default function TrainingSessionView({
  session,
  templateExercises,
  customExercises,
  exerciseDefaults,
  history,
  onFinishSession,
  isFinishing,
  onCustomExercisesChange,
  triggerAlert,
  onLogDrink,
  onCloudAutoPush,
  onMinimize,
}: TrainingSessionViewProps) {
  const [sessionExercises, setSessionExercises] = useState<TemplateExercise[]>(() => {
    if (session.exercises && session.exercises.length > 0) {
      return session.exercises;
    }
    if (session.sets && session.sets.length > 0) {
      const uniqueIds: string[] = [];
      session.sets.forEach(s => {
        if (!uniqueIds.includes(s.exerciseId)) {
          uniqueIds.push(s.exerciseId);
        }
      });

      const reconstructed = uniqueIds.map(exId => {
        const templateEx = templateExercises.find(t => t.exerciseId === exId);
        if (templateEx) return templateEx;

        const exDef = getExerciseById(exId, customExercises);
        const isCardio = Boolean(exDef?.muscleGroup === 'cardio' || exDef?.trackingType === 'time' || exDef?.trackingType === 'time_distance');
        const exSets = session.sets.filter(s => s.exerciseId === exId);
        if (isCardio) {
          return {
            exerciseId: exId,
            targetSets: Math.max(1, exSets.length),
            targetReps: 0,
            targetMinutes: exSets[0]?.timeMinutes ?? (exSets[0]?.reps || 20),
          };
        }
        return {
          exerciseId: exId,
          targetSets: Math.max(3, exSets.length),
          targetReps: exSets[0]?.reps || 10
        };
      });

      const templateOnly = templateExercises.filter(t => !uniqueIds.includes(t.exerciseId));
      return [...reconstructed, ...templateOnly];
    }
    return templateExercises;
  });
  const [sets, setSets] = useState<LoggedSet[]>(session.sets || []);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [currentWeight, setCurrentWeight] = useState(20);
  const [currentReps, setCurrentReps] = useState(8);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(20);
  const [currentRpe, setCurrentRpe] = useState(8);
  const [logRpe, setLogRpe] = useState(false);
  const [isWarmup, setIsWarmup] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [gymProfile, setGymProfile] = useState<any>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const autosaveErrorShownRef = useRef(false);
  const triggerAlertRef = useRef(triggerAlert);
  triggerAlertRef.current = triggerAlert;

  useEffect(() => {
    getActiveGymProfile().then(setGymProfile);
    loadSettings().then(setSettings);
  }, []);

  const activeTemplateEx = activeExerciseIndex >= 0 && activeExerciseIndex < sessionExercises.length
    ? sessionExercises[activeExerciseIndex]
    : null;
  const activeExDef = activeTemplateEx ? getExerciseById(activeTemplateEx.exerciseId, customExercises) || null : null;
  const activeUnit = activeExDef ? (exerciseDefaults[activeExDef.id]?.weightUnit || activeExDef.weightUnit || 'kg') : 'kg';

  // Load defaults when active exercise changes
  useEffect(() => {
    if (activeExDef) {
      const isCardio = Boolean(activeExDef.muscleGroup === 'cardio' || activeExDef.trackingType === 'time' || activeExDef.trackingType === 'time_distance');
      const prevSession = history.find(s => s.id !== session.id && s.sets.some(set => set.exerciseId === activeExDef.id));
      const prevSets = prevSession?.sets.filter(s => s.exerciseId === activeExDef.id);
      
      if (prevSets && prevSets.length > 0) {
        const lastSet = prevSets[prevSets.length - 1];
        setCurrentWeight(lastSet.weight);
        setCurrentReps(activeTemplateEx?.targetReps ?? lastSet.reps);
        setCurrentTimeMinutes(lastSet.timeMinutes ?? (isCardio ? lastSet.reps : (activeTemplateEx?.targetMinutes ?? 20)));
        setCurrentRpe(lastSet.rpe || 8);
      } else {
        const defaults = exerciseDefaults[activeExDef.id];
        if (defaults) {
          setCurrentWeight(defaults.defaultWeight);
          setCurrentReps(defaults.defaultReps);
          setCurrentTimeMinutes(activeTemplateEx?.targetMinutes ?? 20);
          setCurrentRpe(8);
        } else {
          // Fallback generic defaults
          if (isCardio) {
            const isTimeDist = activeExDef.trackingType === 'time_distance';
            setCurrentWeight(isTimeDist ? 5 : 0);
            setCurrentReps(0);
            setCurrentTimeMinutes(activeTemplateEx?.targetMinutes ?? 20);
            setCurrentRpe(8);
          } else {
            const isDB = activeExDef.equipment === 'dumbbell';
            setCurrentWeight(activeExDef.equipment === 'bodyweight' ? 0 : (isDB ? 10 : 20));
            setCurrentReps(10);
            setCurrentTimeMinutes(20);
            setCurrentRpe(8);
          }
        }
      }
    }
  }, [activeExerciseIndex, activeExDef?.id, history, session.id, activeTemplateEx?.targetMinutes, activeTemplateEx?.targetReps]);

  useEffect(() => {
    if (!shouldEnqueueActiveSessionAutosave(Boolean(session.endTime), isFinishing)) return;
    let cancelled = false;
    void saveActiveSessionStrict({ ...session, sets, exercises: sessionExercises })
      .then(() => {
        autosaveErrorShownRef.current = false;
      })
      .catch(error => {
        console.error('Failed to autosave active workout', error);
        if (cancelled || autosaveErrorShownRef.current) return;
        autosaveErrorShownRef.current = true;
        triggerAlertRef.current(
          'Autosave Error',
          'Workout changes could not be saved. Keep this workout open, unlock secure storage or free device space, then make another change to retry.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isFinishing, session, sessionExercises, sets]);

  // Track timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (session.endTime) {
      setElapsed((session.durationMinutes || 0) * 60);
      return;
    }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - session.startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [session.startTime, session.endTime, session.durationMinutes]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const editingText = session.endTime ? ' (editing)' : '';
    return `${m} min ${s.toString().padStart(2, '0')} sec${editingText}`;
  };

  const handleLogSet = () => {
    if (!activeExDef || !activeTemplateEx) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    const isCardio = Boolean(activeExDef.muscleGroup === 'cardio' || activeExDef.trackingType === 'time' || activeExDef.trackingType === 'time_distance');
    const isTimeDistance = activeExDef.trackingType === 'time_distance';

    const newSet: LoggedSet = isCardio
      ? {
          id: generateId(),
          exerciseId: activeExDef.id,
          exerciseName: activeExDef.name,
          setNumber: isWarmup ? 0 : sets.filter(s => s.exerciseId === activeExDef.id && !s.isWarmup).length + 1,
          weight: isTimeDistance ? currentWeight : 0,
          weightUnit: activeUnit,
          reps: Number(currentTimeMinutes.toFixed(1)),
          timeMinutes: Number(currentTimeMinutes.toFixed(1)),
          rpe: undefined,
          isWarmup,
          timestamp: Date.now(),
          estimated1RM: 0,
        }
      : {
          id: generateId(),
          exerciseId: activeExDef.id,
          exerciseName: activeExDef.name,
          setNumber: isWarmup ? 0 : sets.filter(s => s.exerciseId === activeExDef.id && !s.isWarmup).length + 1,
          weight: currentWeight,
          weightUnit: activeUnit,
          reps: currentReps,
          rpe: (!logRpe || isWarmup) ? undefined : currentRpe,
          isWarmup,
          timestamp: Date.now(),
          estimated1RM: Math.round(currentWeight * (1 + currentReps / 30))
        };

    const newSets = [...sets, newSet];
    setSets(newSets);

    const setsForThisEx = newSets.filter(s => s.exerciseId === activeExDef.id && !s.isWarmup);
    if (setsForThisEx.length === activeTemplateEx.targetSets) {
      setTimeout(() => {
        if (activeExerciseIndex < sessionExercises.length - 1) {
          setActiveExerciseIndex(activeExerciseIndex + 1);
        } else {
          setActiveExerciseIndex(-1);
        }
      }, 300);
    }
  };

  const handleDeleteSet = (setId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSets(prevSets => {
      const updatedSets = prevSets.filter(s => s.id !== setId);
      // Renumber sets for this exercise
      const exId = prevSets.find(s => s.id === setId)?.exerciseId;
      if (!exId) return updatedSets;
      
      let counter = 1;
      return updatedSets.map(s => {
        if (s.exerciseId === exId) {
          if (s.isWarmup) {
            return { ...s, setNumber: 0 };
          }
          return { ...s, setNumber: counter++ };
        }
        return s;
      });
    });
  };

  const handleAddExercise = (exerciseId: string) => {
    const exDef = getExerciseById(exerciseId, customExercises);
    const isCardio = Boolean(exDef?.muscleGroup === 'cardio' || exDef?.trackingType === 'time' || exDef?.trackingType === 'time_distance');
    const newEx: TemplateExercise = isCardio
      ? {
          exerciseId,
          targetSets: 1,
          targetReps: 0,
          targetMinutes: 20,
        }
      : {
          exerciseId,
          targetSets: 3,
          targetReps: 10,
        };
    setSessionExercises([...sessionExercises, newEx]);
  };

  const handleRemoveExercise = (index: number, exId: string) => {
    const hasSets = sets.some(s => s.exerciseId === exId);
    triggerAlert(
      "Remove Exercise?",
      hasSets
        ? "This exercise has logged sets. Removing it will delete those sets from this session."
        : "Are you sure you want to remove this exercise from the session?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => performRemoveExercise(index, exId) }
      ]
    );
  };

  const performRemoveExercise = (index: number, exId: string) => {
    // Remove the exercise from the session
    const updated = [...sessionExercises];
    updated.splice(index, 1);
    setSessionExercises(updated);
    
    // Remove its sets
    const updatedSets = sets.filter(s => s.exerciseId !== exId);
    setSets(updatedSets);

    if (activeExerciseIndex === index) {
      setActiveExerciseIndex(-1);
    } else if (activeExerciseIndex > index) {
      setActiveExerciseIndex(activeExerciseIndex - 1);
    }
  };

  const handleMoveExercise = (index: number, direction: number) => {
    const updated = [...sessionExercises];
    const temp = updated[index];
    updated[index] = updated[index + direction];
    updated[index + direction] = temp;
    setSessionExercises(updated);
    
    // update active index if needed
    if (activeExerciseIndex === index) {
      setActiveExerciseIndex(index + direction);
    } else if (activeExerciseIndex === index + direction) {
      setActiveExerciseIndex(index);
    }
  };

  const showRpeInfo = () => {
    triggerAlert(
      'Rate of Perceived Exertion',
      '10 = absolute failure\n9 = 1 rep left in the tank\n8 = 2 reps left\n7 = 3 reps left\n6 = 4 reps left\n5 = easy warm-up weight',
      [{ text: 'Got it', style: 'default' }],
    );
  };

  const renderExerciseCard = (tEx: TemplateExercise, index: number) => {
    const exDef = getExerciseById(tEx.exerciseId, customExercises);
    if (!exDef) return null;
    const exUnit = (exerciseDefaults[exDef.id]?.weightUnit) || exDef.weightUnit || 'kg';
    const incrementStep = gymProfile?.equipmentIncrements?.[exDef.equipment] ?? exDef.incrementStep ?? 2.5;

    const isExpanded = index === activeExerciseIndex;
    const completedSets = sets.filter(s => s.exerciseId === exDef.id);
    const isCardio = Boolean(exDef.muscleGroup === 'cardio' || exDef.trackingType === 'time' || exDef.trackingType === 'time_distance');
    const isTimeDistance = exDef.trackingType === 'time_distance';

    return (
      <View key={exDef.id + index} style={[styles.exerciseCard, isExpanded && styles.exerciseCardActive]}>
        <TouchableOpacity 
          style={styles.exerciseHeader} 
          onPress={() => setActiveExerciseIndex(isExpanded ? -1 : index)}
          activeOpacity={0.7}
        >
          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8}}>
            <View style={{flex: 1}}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                <Text style={styles.exerciseName} numberOfLines={1} ellipsizeMode="tail">{exDef.name}</Text>
                {exDef.primaryMuscle && (
                  <View style={[styles.groupBadge, { backgroundColor: theme.colors.surfaceSecondary }]}>
                    <Text style={[styles.groupBadgeText, { color: theme.colors.text }]}>
                      {exDef.primaryMuscle.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.exerciseSub}>{completedSets.filter(s => !s.isWarmup).length} / {Math.max(completedSets.filter(s => !s.isWarmup).length, tEx.targetSets)} sets completed</Text>
            </View>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
               <View style={{flexDirection: 'row', marginRight: 16}}>
                 {index > 0 && (
                   <TouchableOpacity onPress={() => handleMoveExercise(index, -1)} style={{marginRight: 12}}>
                     <ChevronUp size={20} color={theme.colors.textMuted} />
                   </TouchableOpacity>
                 )}
                 {index < sessionExercises.length - 1 && (
                   <TouchableOpacity onPress={() => handleMoveExercise(index, 1)} style={{marginRight: 12}}>
                     <ChevronDown size={20} color={theme.colors.textMuted} />
                   </TouchableOpacity>
                 )}
                 <TouchableOpacity onPress={() => handleRemoveExercise(index, exDef.id)}>
                   <Trash2 size={20} color={theme.colors.textMuted} />
                 </TouchableOpacity>
               </View>
            {isExpanded ? <ChevronUp color={theme.colors.textMuted} /> : <ChevronDown color={theme.colors.textMuted} />}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.exerciseBody}>
            {/* Coach Card — always first inside expanded exercise */}
            <CoachCard
              exerciseId={exDef.id}
              history={history}
              incrementKg={incrementStep}
              excludeSessionId={session.id}
              targetReps={tEx.targetReps}
              rpeEnabled={settings?.rpeEnabled}
              primaryGoal={settings?.primaryGoal}
              isCardio={exDef.muscleGroup === 'cardio' || exDef.trackingType === 'time' || exDef.trackingType === 'time_distance'}
              trackingType={exDef.trackingType}
            />

            {/* Completed Sets */}
            {completedSets.map(s => (
              <Swipeable
                key={s.id}
                renderRightActions={() => (
                  <TouchableOpacity style={styles.deleteAction} onPress={() => handleDeleteSet(s.id)}>
                    <Trash2 size={20} color={theme.colors.text} />
                  </TouchableOpacity>
                )}
              >
                <View style={styles.setRow}>
                  <Text style={[styles.setText, s.isWarmup && { color: '#FF9F0A' }]}>
                    {s.isWarmup ? 'Warmup' : `Set ${s.setNumber}`}
                  </Text>
                  <Text style={styles.setText}>
                    {isCardio
                      ? isTimeDistance
                        ? `${s.weight}${s.weightUnit === 'kg' ? 'km' : 'mi'} in ${s.timeMinutes ?? s.reps} min`
                        : `${s.timeMinutes ?? s.reps} min`
                      : `${s.weight}${s.weightUnit} × ${s.reps}`
                    }
                  </Text>
                  <Check size={16} color={theme.colors.accent} />
                </View>
              </Swipeable>
            ))}

            {/* Active Set Input */}
            <View style={styles.activeSetContainer}>
              <View style={[styles.setRowActive, isWarmup && { backgroundColor: 'rgba(255, 159, 10, 0.15)' }]}>
                <Text style={[styles.setTextActive, isWarmup && { color: '#FF9F0A' }]}>
                  {isWarmup ? 'Warmup' : `Set ${completedSets.filter(s => !s.isWarmup).length + 1}`}
                </Text>
                <Text style={[styles.setTextActive, isWarmup && { color: '#FF9F0A' }]}>
                  {isCardio
                    ? isTimeDistance
                      ? `${currentWeight}${exUnit === 'kg' ? 'km' : 'mi'} in ${currentTimeMinutes} min`
                      : `${currentTimeMinutes} min`
                    : `${currentWeight}${exUnit} × ${currentReps}`
                  }
                </Text>
              </View>

              {isCardio ? (
                <>
                  {isTimeDistance && (
                    <View style={styles.inputRow}>
                      <Text style={styles.inputLabel}>
                        Distance ({exUnit === 'kg' ? 'km' : 'mi'})
                      </Text>
                      <View style={styles.inputControl}>
                        <StepperInput
                          value={currentWeight}
                          onChange={(val) => setCurrentWeight(Number(val.toFixed(1)))}
                          min={0}
                          step={0.1}
                        />
                      </View>
                    </View>
                  )}

                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Time (min)</Text>
                    <View style={styles.inputControl}>
                      <StepperInput
                        value={currentTimeMinutes}
                        onChange={(val) => setCurrentTimeMinutes(Number(val.toFixed(1)))}
                        min={0.1}
                        step={1}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {/* Weight stepper — full width */}
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>
                      Weight ({exUnit})
                    </Text>
                    <View style={styles.inputControl}>
                      <StepperInput
                        value={currentWeight}
                        onChange={(val) => setCurrentWeight(Number(val.toFixed(1)))}
                        min={0}
                        step={incrementStep}
                      />
                    </View>
                  </View>

                  {/* Reps stepper — full width */}
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Reps</Text>
                    <View style={styles.inputControl}>
                      <StepperInput
                        value={currentReps}
                        onChange={setCurrentReps}
                        min={1}
                        step={1}
                      />
                    </View>
                  </View>

                  {/* RPE Switch & Slider */}
                  {!isWarmup && (
                    <View style={styles.rpeSection}>
                      <View style={styles.inputRow}>
                        <View style={styles.rpeLabelRow}>
                          <Text style={[styles.inputLabel, { minWidth: 'auto' }]}>Log RPE</Text>
                          <TouchableOpacity onPress={showRpeInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Info size={14} color={theme.colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.inputControl}>
                          <Switch
                            value={logRpe}
                            onValueChange={(val) => {
                              Haptics.selectionAsync();
                              setLogRpe(val);
                              if (val) setIsWarmup(false);
                            }}
                            trackColor={{ false: theme.colors.surfaceMuted, true: '#FF9F0A' }}
                          />
                        </View>
                      </View>
                      {logRpe && (
                        <IntegerSlider 
                          min={5} 
                          max={10} 
                          value={currentRpe} 
                          onChange={setCurrentRpe} 
                        />
                      )}
                    </View>
                  )}
                </>
              )}

              {/* Warmup Toggle */}
              <View style={[styles.inputRow, { marginTop: 8 }]}>
                <Text style={styles.inputLabel}>Warmup Set</Text>
                <View style={styles.inputControl}>
                  <Switch
                    value={isWarmup}
                    onValueChange={(val) => {
                      Haptics.selectionAsync();
                      setIsWarmup(val);
                      if (val) setLogRpe(false);
                    }}
                    trackColor={{ false: theme.colors.surfaceMuted, true: '#FF9F0A' }}
                  />
                </View>
              </View>

              {/* Intra-Set RPE Feedback Snippet */}
              {(() => {
                if (completedSets.length === 0 || isWarmup || isCardio) return null;
                const lastSet = completedSets[completedSets.length - 1];
                if (!lastSet.rpe) return null;
                
                let feedbackText = '';
                const weight = lastSet.weight;
                const reps = lastSet.reps;
                
                // maxReps logic
                const defaultReps = activeExDef ? exerciseDefaults[activeExDef.id]?.defaultReps : undefined;
                const maxReps = activeTemplateEx?.targetReps || defaultReps || 12;
                
                if (reps >= maxReps && lastSet.rpe <= 7) {
                  if (weight === 0) {
                    feedbackText = `You're at the top of the rep range. You have reps left, consider pushing for **${reps + 1} or ${reps + 2}** reps next set.`;
                  } else {
                    const nextWeight = weight + incrementStep;
                    feedbackText = `You're at the top of the rep range. Bump to **${nextWeight}${exUnit}** next set.`;
                  }
                } else if (lastSet.rpe <= 7) {
                  const nextWeight = weight + incrementStep;
                  const nextReps = reps + 1;
                  if (weight === 0) {
                    feedbackText = `You have reps left in the tank. Push for **${nextReps} or ${nextReps + 1}** reps next set.`;
                  } else {
                    feedbackText = `You have reps left in the tank. Consider bumping to **${nextWeight}${exUnit}** or pushing for **${nextReps} or ${nextReps + 1}** reps next set.`;
                  }
                } else if (lastSet.rpe <= 9) {
                  feedbackText = `Great intensity! Keep **${weight}${exUnit}** and aim to match **${reps}** reps.`;
                } else {
                  const dropWeight = Math.max(0, weight - incrementStep * 2);
                  if (weight === 0) {
                    feedbackText = `Max effort! Try to match **${reps}** reps next set.`;
                  } else {
                    feedbackText = `Max effort! Hold **${weight}${exUnit}** and try to match **${reps}** reps, or drop to **${dropWeight}${exUnit}** if you're feeling fatigued.`;
                  }
                }
                
                const parts = feedbackText.split(/\*\*(.*?)\*\*/g);
                return (
                  <Text style={styles.rpeFeedback}>
                    {parts.map((part, i) => 
                      i % 2 === 1 ? <Text key={i} style={{fontFamily: theme.typography.semibold}}>{part}</Text> : part
                    )}
                  </Text>
                );
              })()}

              <TouchableOpacity style={styles.logBtn} onPress={handleLogSet}>
                <Check size={20} color={theme.colors.background} style={{ marginRight: 8 }} />
                <Text style={styles.logBtnText}>Log Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.timerBar}>
        <View style={styles.timerContent}>
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
        </View>
        <TouchableOpacity
          style={styles.waterQuickBtn}
          onPress={() => setWaterModalVisible(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quick log water intake"
        >
          <Droplet size={15} color={theme.colors.accentCyan} fill={theme.colors.accentCyan} />
          <Text style={styles.waterQuickBtnText}>+ Water</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View
          pointerEvents={isFinishing ? 'none' : 'auto'}
          accessibilityElementsHidden={isFinishing}
          importantForAccessibility={isFinishing ? 'no-hide-descendants' : 'auto'}
          style={isFinishing ? styles.editingDisabled : undefined}
        >
          {sessionExercises.map((tEx, i) => renderExerciseCard(tEx, i))}

          <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setPickerVisible(true)}>
            <Plus size={20} color={theme.colors.text} />
            <Text style={styles.addExerciseText}>Add Exercise</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={[styles.finishBtn, isFinishing && styles.finishBtnDisabled]}
          disabled={isFinishing}
          accessibilityRole="button"
          accessibilityLabel={isFinishing ? 'Saving workout' : 'Finish session'}
          accessibilityState={{ disabled: isFinishing, busy: isFinishing }}
          onPress={() => {
            const finalSession = { ...session, sets, exercises: sessionExercises };
            onFinishSession(finalSession);
          }}
        >
          <View style={styles.finishSquare} />
          <Text style={styles.finishBtnText} accessibilityLiveRegion="polite">
            {isFinishing ? 'Saving…' : 'Finish Session'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <ExercisePickerModal
        visible={pickerVisible && !isFinishing}
        onClose={() => setPickerVisible(false)}
        onSelect={handleAddExercise}
        customExercises={customExercises}
        onCustomExercisesChange={onCustomExercisesChange}
      />

      <QuickWaterModal
        visible={waterModalVisible && !isFinishing}
        onClose={() => setWaterModalVisible(false)}
        onLogDrink={onLogDrink}
        onCloudAutoPush={onCloudAutoPush}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    backgroundColor: theme.colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  timerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 15,
  },
  waterQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100, 210, 255, 0.12)',
    borderColor: 'rgba(100, 210, 255, 0.3)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.round,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  waterQuickBtnText: {
    fontFamily: theme.typography.semibold,
    fontSize: 12,
    color: theme.colors.accentCyan,
    marginLeft: 5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  editingDisabled: {
    opacity: 0.55,
  },
  exerciseCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    marginBottom: 12,
    overflow: 'hidden',
  },
  exerciseCardActive: {
    borderColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  exerciseName: {
    fontFamily: theme.typography.semibold,
    fontSize: 16,
    color: theme.colors.text,
  },
  exerciseSub: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  groupBadge: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  groupBadgeText: {
    fontFamily: theme.typography.semibold,
    fontSize: 9,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  exerciseBody: {
    padding: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    opacity: 0.5,
  },
  setText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.text,
    fontSize: 15,
  },
  deleteAction: {
    backgroundColor: theme.colors.accentRed,
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    height: '100%',
  },
  activeSetContainer: {
    marginTop: theme.spacing.md,
  },
  setRowActive: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    backgroundColor: theme.colors.accentCyanFade,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
  },
  setTextActive: {
    fontFamily: theme.typography.semibold,
    color: theme.colors.accentCyan,
    fontSize: 16,
  },
  // Vertical stacking: each input row is full width
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 14,
    minWidth: 80,
  },
  inputControl: {
    flex: 1,
    maxWidth: 200,
  },
  rpeSection: {
    marginBottom: theme.spacing.md,
  },
  rpeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.xs,
  },
  rpeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rpeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeCircleSelected: {
    backgroundColor: theme.colors.accentCyan,
    borderColor: theme.colors.accentCyan,
  },
  rpeCircleText: {
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  rpeCircleTextSelected: {
    color: theme.colors.background,
  },
  rpeFeedback: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  logBtn: {
    backgroundColor: theme.colors.accentCyan,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
  },
  logBtnText: {
    fontFamily: theme.typography.semibold,
    color: theme.colors.background,
    fontSize: 16,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: theme.borderRadius.md,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  finishBtnDisabled: {
    opacity: 0.55,
  },
  finishSquare: {
    width: 14,
    height: 14,
    backgroundColor: theme.colors.accentRed,
    marginRight: 8,
    borderRadius: 3,
  },
  finishBtnText: {
    fontFamily: theme.typography.semibold,
    color: theme.colors.accentRed,
    fontSize: 16,
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  addExerciseText: {
    fontFamily: theme.typography.semibold,
    color: theme.colors.text,
    fontSize: 16,
    marginLeft: 8,
  }
});
