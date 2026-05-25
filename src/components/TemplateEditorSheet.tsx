import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { X, Save, Plus, ChevronUp, ChevronDown, Trash2 } from 'lucide-react-native';
import { theme } from '../theme';
import { WorkoutTemplate, TemplateExercise, Exercise } from '../trainingTypes';
import { EXERCISE_LIBRARY } from '../exerciseLibrary';
import ExercisePickerModal from './ExercisePickerModal';

interface TemplateEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  template: WorkoutTemplate | null; // null means create new
  onSave: (template: WorkoutTemplate) => void;
  onDelete?: (id: string) => void;
  customExercises: Exercise[];
  onCustomExercisesChange?: (updated: Exercise[]) => void;
}

const TEMPLATE_COLORS = ['#64d2ff', '#32d74b', '#ff9f0a', '#ff453a', '#bf5af2', '#ffd60a'];

export default function TemplateEditorSheet({ visible, onClose, template, onSave, onDelete, customExercises, onCustomExercisesChange }: TemplateEditorSheetProps) {
  const [name, setName] = useState(template?.name || '');
  const [color, setColor] = useState(template?.color || TEMPLATE_COLORS[0]);
  const [exercises, setExercises] = useState<TemplateExercise[]>(template?.exercises || []);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Reset state when a new template is passed
  React.useEffect(() => {
    if (visible) {
      setName(template?.name || '');
      setColor(template?.color || TEMPLATE_COLORS[0]);
      setExercises(template?.exercises || []);
    }
  }, [visible, template]);

  const handleAddExercise = (exerciseId: string) => {
    setExercises([...exercises, { exerciseId, targetSets: 3, targetReps: 10 }]);
  };

  const handleRemoveExercise = (index: number) => {
    const updated = [...exercises];
    updated.splice(index, 1);
    setExercises(updated);
  };

  const handleMoveExercise = (index: number, direction: number) => {
    const updated = [...exercises];
    const temp = updated[index];
    updated[index] = updated[index + direction];
    updated[index + direction] = temp;
    setExercises(updated);
  };

  const updateTarget = (index: number, field: 'targetSets' | 'targetReps', delta: number) => {
    const updated = [...exercises];
    updated[index] = {
      ...updated[index],
      [field]: Math.max(1, updated[index][field] + delta)
    };
    setExercises(updated);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Missing Name", "Please enter a template name.");
      return;
    }
    if (exercises.length === 0) {
      Alert.alert("No Exercises", "Please add at least one exercise.");
      return;
    }
    
    onSave({
      id: template?.id || Math.random().toString(36).substring(2, 15),
      name: name.trim(),
      color,
      exercises
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{template ? 'Edit Template' : 'New Template'}</Text>
          <View style={styles.headerRight}>
            {template && onDelete && (
              <TouchableOpacity onPress={() => {
                Alert.alert(
                  "Delete Template",
                  "Are you sure you want to delete this workout template?",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => { onDelete(template.id); onClose(); } }
                  ]
                );
              }} style={[styles.headerBtn, { marginRight: 16 }]}>
                <Trash2 size={20} color="#ff453a" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.label}>TEMPLATE NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Push Day, Full Body"
              placeholderTextColor={theme.colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>ACCENT COLOR</Text>
            <View style={styles.colorRow}>
              {TEMPLATE_COLORS.map(c => (
                <TouchableOpacity 
                  key={c} 
                  style={[styles.colorCircle, { backgroundColor: c }, color === c && styles.colorCircleActive]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>EXERCISES</Text>
            {exercises.map((tEx, index) => {
              const exDef = EXERCISE_LIBRARY[tEx.exerciseId] || customExercises.find(c => c.id === tEx.exerciseId);
              if (!exDef) return null;

              return (
                <View key={index} style={styles.exerciseCard}>
                  <View style={styles.exHeaderRow}>
                    <Text style={styles.exName}>{exDef.name}</Text>
                    <View style={styles.exActions}>
                      {index > 0 && (
                        <TouchableOpacity onPress={() => handleMoveExercise(index, -1)} style={styles.actionBtn}>
                          <ChevronUp size={20} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                      )}
                      {index < exercises.length - 1 && (
                        <TouchableOpacity onPress={() => handleMoveExercise(index, 1)} style={styles.actionBtn}>
                          <ChevronDown size={20} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => handleRemoveExercise(index)} style={styles.actionBtn}>
                        <Trash2 size={20} color="#ff453a" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.pickersRow}>
                    <View style={styles.pickerGroup}>
                      <Text style={styles.pickerLabel}>Sets</Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => updateTarget(index, 'targetSets', -1)}>
                          <Text style={styles.stepperBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepperValue}>{tEx.targetSets}</Text>
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => updateTarget(index, 'targetSets', 1)}>
                          <Text style={styles.stepperBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.pickerGroup}>
                      <Text style={styles.pickerLabel}>Reps</Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => updateTarget(index, 'targetReps', -1)}>
                          <Text style={styles.stepperBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepperValue}>{tEx.targetReps}</Text>
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => updateTarget(index, 'targetReps', 1)}>
                          <Text style={styles.stepperBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setPickerVisible(true)}>
              <Plus size={20} color={theme.colors.text} />
              <Text style={styles.addExerciseText}>Add Exercise</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleAddExercise}
        customExercises={customExercises}
        onCustomExercisesChange={onCustomExercisesChange}
      />
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: theme.typography.sans,
    color: '#ff453a',
    fontSize: 16,
  },
  saveText: {
    fontFamily: 'Outfit_600SemiBold',
    color: '#32d74b',
    fontSize: 16,
    textAlign: 'right',
  },
  headerTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: theme.colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
  },
  label: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: theme.colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 8,
    padding: 16,
    color: theme.colors.text,
    fontFamily: theme.typography.sans,
    fontSize: 16,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleActive: {
    borderColor: theme.colors.text,
  },
  exerciseCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    marginBottom: 12,
  },
  exHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: theme.colors.text,
    flex: 1,
  },
  exActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    paddingLeft: 12,
  },
  pickersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerGroup: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 4,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3a3c',
    borderRadius: 6,
  },
  stepperBtnText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepperValue: {
    fontFamily: 'Outfit_600SemiBold',
    color: theme.colors.text,
    fontSize: 16,
    width: 50,
    textAlign: 'center',
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
