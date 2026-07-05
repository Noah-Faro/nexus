import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown, ChevronUp, Trash2, Plus, Info } from 'lucide-react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '../theme';
import { WorkoutSession, LoggedSet, TemplateExercise, Exercise, ExerciseDefaults } from '../trainingTypes';
import ExercisePickerModal from './ExercisePickerModal';
import { generateId, getExerciseById } from '../utils';
import StepperInput from './StepperInput';
import CoachCard from './CoachCard';
import { AppAlertButton } from './AppAlertModal';
import { saveActiveSession } from '../trainingStorage';
import { getActiveGymProfile } from '../gymStorage';

const RPE_VALUES = [5, 6, 7, 8, 9, 10] as const;

interface TrainingSessionViewProps {
  session: WorkoutSession;
  templateExercises: TemplateExercise[];
  customExercises: Exercise[];
  exerciseDefaults: Record<string, ExerciseDefaults>;
  history: WorkoutSession[];
  onFinishSession: (session: WorkoutSession) => void;
  onCustomExercisesChange?: (updated: Exercise[]) => void;
  triggerAlert: (title: string, message: string, buttons?: AppAlertButton[]) => void;
}

export default function TrainingSessionView({ session, templateExercises, customExercises, exerciseDefaults, history, onFinishSession, onCustomExercisesChange, triggerAlert }: TrainingSessionViewProps) {
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

        const exSets = session.sets.filter(s => s.exerciseId === exId);
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
  const [currentRpe, setCurrentRpe] = useState(8);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [gymProfile, setGymProfile] = useState<any>(null);

  useEffect(() => {
    getActiveGymProfile().then(setGymProfile);
  }, []);

  const activeTemplateEx = activeExerciseIndex >= 0 && activeExerciseIndex < sessionExercises.length
    ? sessionExercises[activeExerciseIndex]
    : null;
  const activeExDef = activeTemplateEx ? getExerciseById(activeTemplateEx.exerciseId, customExercises) || null : null;
  const activeUnit = activeExDef ? (exerciseDefaults[activeExDef.id]?.weightUnit || activeExDef.weightUnit || 'kg') : 'kg';

  // Load defaults when active exercise changes
  useEffect(() => {
    if (activeExDef) {
      const prevSession = history.find(s => s.id !== session.id && s.sets.some(set => set.exerciseId === activeExDef.id));
      const prevSets = prevSession?.sets.filter(s => s.exerciseId === activeExDef.id);
      
      if (prevSets && prevSets.length > 0) {
        const lastSet = prevSets[prevSets.length - 1];
        setCurrentWeight(lastSet.weight);
        setCurrentReps(lastSet.reps);
        setCurrentRpe(lastSet.rpe || 8);
      } else {
        const defaults = exerciseDefaults[activeExDef.id];
        if (defaults) {
          setCurrentWeight(defaults.defaultWeight);
          setCurrentReps(defaults.defaultReps);
          setCurrentRpe(8);
        } else {
          // Fallback generic defaults
          setCurrentWeight(20);
          setCurrentReps(10);
          setCurrentRpe(8);
        }
      }
    }
  }, [activeExerciseIndex, activeExDef?.id, history, session.id]);

  useEffect(() => {
    if (!session.endTime) {
      saveActiveSession({ ...session, sets, exercises: sessionExercises });
    }
  }, [sets, sessionExercises]);

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
    
    const newSet: LoggedSet = {
      id: generateId(),
      exerciseId: activeExDef.id,
      exerciseName: activeExDef.name,
      setNumber: sets.filter(s => s.exerciseId === activeExDef.id).length + 1,
      weight: currentWeight,
      weightUnit: activeUnit,
      reps: currentReps,
      rpe: currentRpe,
      timestamp: Date.now(),
      estimated1RM: Math.round(currentWeight * (1 + currentReps / 30))
    };

    const newSets = [...sets, newSet];
    setSets(newSets);

    const setsForThisEx = newSets.filter(s => s.exerciseId === activeExDef.id);
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
          return { ...s, setNumber: counter++ };
        }
        return s;
      });
    });
  };

  const handleAddExercise = (exerciseId: string) => {
    const newEx: TemplateExercise = {
      exerciseId,
      targetSets: 3,
      targetReps: 10
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
              <Text style={styles.exerciseSub}>{completedSets.length} / {Math.max(completedSets.length, tEx.targetSets)} sets completed</Text>
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
                  <Text style={styles.setText}>Set {s.setNumber}</Text>
                  <Text style={styles.setText}>{s.weight}{s.weightUnit} × {s.reps}</Text>
                  <Check size={16} color={theme.colors.accent} />
                </View>
              </Swipeable>
            ))}

            {/* Active Set Input */}
            <View style={styles.activeSetContainer}>
              <View style={styles.setRowActive}>
                <Text style={styles.setTextActive}>Set {completedSets.length + 1}</Text>
                <Text style={styles.setTextActive}>{currentWeight}{exUnit} × {currentReps}</Text>
              </View>

              {/* Weight stepper — full width */}
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Weight ({exUnit})</Text>
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

              {/* RPE — row of numbered circle buttons (5-10) */}
              <View style={styles.rpeSection}>
                <View style={styles.rpeLabelRow}>
                  <Text style={styles.inputLabel}>RPE</Text>
                  <TouchableOpacity onPress={showRpeInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Info size={14} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={styles.rpeRow}>
                  {RPE_VALUES.map((val) => {
                    const isSelected = currentRpe === val;
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[styles.rpeCircle, isSelected && styles.rpeCircleSelected]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setCurrentRpe(val);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.rpeCircleText, isSelected && styles.rpeCircleTextSelected]}>
                          {val}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Intra-Set RPE Feedback Snippet */}
              {(() => {
                if (completedSets.length === 0) return null;
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
        <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {sessionExercises.map((tEx, i) => renderExerciseCard(tEx, i))}
        
        <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setPickerVisible(true)}>
          <Plus size={20} color={theme.colors.text} />
          <Text style={styles.addExerciseText}>Add Exercise</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.finishBtn} 
          onPress={() => {
            const finalSession = { ...session, sets, exercises: sessionExercises };
            onFinishSession(finalSession);
          }}
        >
          <View style={styles.finishSquare} />
          <Text style={styles.finishBtnText}>Finish Session</Text>
        </TouchableOpacity>
      </ScrollView>

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleAddExercise}
        customExercises={customExercises}
        onCustomExercisesChange={onCustomExercisesChange}
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
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: theme.colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  timerText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    marginLeft: 8,
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
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
