import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Play, ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '../theme';
import { WorkoutSession, LoggedSet, TemplateExercise, Exercise } from '../trainingTypes';
import { EXERCISE_LIBRARY } from '../exerciseLibrary';
import ExercisePickerModal from './ExercisePickerModal';

interface TrainingSessionViewProps {
  session: WorkoutSession;
  templateExercises: TemplateExercise[];
  customExercises: Exercise[];
  exerciseDefaults: Record<string, { defaultWeight: number, defaultReps: number }>;
  history: WorkoutSession[];
  onFinishSession: (session: WorkoutSession) => void;
  onCustomExercisesChange?: (updated: Exercise[]) => void;
}

export default function TrainingSessionView({ session, templateExercises, customExercises, exerciseDefaults, history, onFinishSession, onCustomExercisesChange }: TrainingSessionViewProps) {
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
  const [pickerVisible, setPickerVisible] = useState(false);

  const activeTemplateEx = sessionExercises[activeExerciseIndex];
  const activeExDef = activeTemplateEx ? EXERCISE_LIBRARY[activeTemplateEx.exerciseId] || customExercises.find(c => c.id === activeTemplateEx.exerciseId) : null;

  // Load defaults when active exercise changes
  useEffect(() => {
    if (activeExDef) {
      const defaults = exerciseDefaults[activeExDef.id];
      if (defaults) {
        setCurrentWeight(defaults.defaultWeight);
        setCurrentReps(defaults.defaultReps);
      } else {
        // Fallback generic defaults
        setCurrentWeight(20);
        setCurrentReps(10);
      }
    }
  }, [activeExerciseIndex, activeExDef?.id]);

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
      id: Math.random().toString(36).substring(2, 15),
      exerciseId: activeExDef.id,
      exerciseName: activeExDef.name,
      setNumber: sets.filter(s => s.exerciseId === activeExDef.id).length + 1,
      weight: currentWeight,
      weightUnit: activeExDef.weightUnit,
      reps: currentReps,
      timestamp: Date.now(),
      estimated1RM: Math.round(currentWeight * (1 + currentReps / 30))
    };

    const newSets = [...sets, newSet];
    setSets(newSets);

    // Auto advance if target sets reached and this is the first time we hit the target
    const setsForThisEx = newSets.filter(s => s.exerciseId === activeExDef.id);
    if (setsForThisEx.length === activeTemplateEx.targetSets) {
      if (activeExerciseIndex < sessionExercises.length - 1) {
        setTimeout(() => {
          setActiveExerciseIndex(activeExerciseIndex + 1);
        }, 300);
      }
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

  const incrementWeight = () => setCurrentWeight(prev => Number((prev + (activeExDef?.incrementStep || 2.5)).toFixed(1)));
  const decrementWeight = () => setCurrentWeight(prev => Math.max(0, Number((prev - (activeExDef?.incrementStep || 2.5)).toFixed(1))));
  
  const incrementReps = () => setCurrentReps(prev => prev + 1);
  const decrementReps = () => setCurrentReps(prev => Math.max(1, prev - 1));

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
    if (hasSets) {
      Alert.alert(
        "Remove Exercise",
        "This exercise has logged sets. Removing it will delete those sets. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: () => performRemoveExercise(index, exId) }
        ]
      );
    } else {
      performRemoveExercise(index, exId);
    }
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

  const renderExerciseCard = (tEx: TemplateExercise, index: number) => {
    const exDef = EXERCISE_LIBRARY[tEx.exerciseId] || customExercises.find(c => c.id === tEx.exerciseId);
    if (!exDef) return null;

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
              <Text style={styles.exerciseName} numberOfLines={1} ellipsizeMode="tail">{exDef.name}</Text>
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
            {/* Completed Sets */}
            {completedSets.map(s => (
              <Swipeable
                key={s.id}
                renderRightActions={() => (
                  <TouchableOpacity style={styles.deleteAction} onPress={() => handleDeleteSet(s.id)}>
                    <Trash2 size={20} color="#fff" />
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

            {/* Ghost Row */}
            {(() => {
              const prevSession = history.find(s => s.id !== session.id && s.sets.some(set => set.exerciseId === exDef.id));
              const prevSets = prevSession?.sets.filter(s => s.exerciseId === exDef.id);
              if (prevSets && prevSets.length > 0) {
                const bestSet = prevSets.reduce((a, b) => a.weight * a.reps > b.weight * b.reps ? a : b);
                return (
                  <View style={styles.ghostRow}>
                    <Text style={styles.ghostText}>Last: {prevSets.length} sets (Best: {bestSet.weight}{bestSet.weightUnit} × {bestSet.reps})</Text>
                  </View>
                );
              }
              return null;
            })()}

            {/* Active Set Input - Always shown (Dynamic set count) */}
            <View style={styles.activeSetContainer}>
              <View style={styles.setRowActive}>
                <Text style={styles.setTextActive}>Set {completedSets.length + 1}</Text>
                <Text style={styles.setTextActive}>{currentWeight}{exDef.weightUnit} × {currentReps}</Text>
                <View style={styles.rmBadge}>
                  <Text style={styles.rmBadgeText}>Est 1RM: {Math.round(currentWeight * (1 + currentReps / 30))} {exDef.weightUnit}</Text>
                </View>
              </View>

              {/* Pickers */}
              <View style={styles.pickersContainer}>
                <View style={styles.pickerCol}>
                  <Text style={styles.pickerLabel}>Weight ({exDef.weightUnit})</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity style={styles.stepperBtn} onPress={decrementWeight}><Text style={styles.stepperBtnText}>-</Text></TouchableOpacity>
                    <Text style={styles.stepperValue}>{currentWeight}</Text>
                    <TouchableOpacity style={styles.stepperBtn} onPress={incrementWeight}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.pickerCol}>
                  <Text style={styles.pickerLabel}>Reps</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity style={styles.stepperBtn} onPress={decrementReps}><Text style={styles.stepperBtnText}>-</Text></TouchableOpacity>
                    <Text style={styles.stepperValue}>{currentReps}</Text>
                    <TouchableOpacity style={styles.stepperBtn} onPress={incrementReps}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.logBtn} onPress={handleLogSet}>
                <Check size={20} color="#000" style={{ marginRight: 8 }} />
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
    fontFamily: 'Outfit_400Regular', // Monospace-ish is ideal but Outfit works
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
    borderColor: '#3a3a3c',
    borderWidth: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  exerciseName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: theme.colors.text,
  },
  exerciseSub: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  exerciseBody: {
    padding: 16,
    paddingTop: 0,
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
    backgroundColor: '#ff453a',
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    height: '100%',
  },
  activeSetContainer: {
    marginTop: 16,
  },
  ghostRow: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    alignItems: 'center',
  },
  ghostText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  rmBadge: {
    backgroundColor: 'rgba(100, 210, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rmBadgeText: {
    fontFamily: theme.typography.sans,
    color: '#64d2ff',
    fontSize: 12,
  },
  setRowActive: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    backgroundColor: 'rgba(100, 210, 255, 0.1)',
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  setTextActive: {
    fontFamily: theme.typography.sans,
    color: '#64d2ff',
    fontSize: 16,
    fontWeight: theme.typography.weight.semibold,
  },
  pickersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pickerCol: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 4,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3a3c',
    borderRadius: 6,
  },
  stepperBtnText: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  stepperValue: {
    fontFamily: 'Outfit_600SemiBold',
    color: theme.colors.text,
    fontSize: 18,
    width: 60,
    textAlign: 'center',
  },
  logBtn: {
    backgroundColor: '#64d2ff',
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    color: '#000',
    fontSize: 16,
  },
  doneText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.accent,
    textAlign: 'center',
    paddingVertical: 16,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  finishSquare: {
    width: 14,
    height: 14,
    backgroundColor: '#ff453a',
    marginRight: 8,
    borderRadius: 3,
  },
  finishBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    color: '#ff453a',
    fontSize: 16,
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  addExerciseText: {
    fontFamily: 'Outfit_600SemiBold',
    color: theme.colors.text,
    fontSize: 16,
    marginLeft: 8,
  }
});
