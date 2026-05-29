import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Plus, ChevronUp, ChevronDown, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { WorkoutTemplate, TemplateExercise, Exercise } from '../trainingTypes';
import { generateId, getExerciseById } from '../utils';
import { EXERCISE_LIBRARY } from '../exerciseLibrary';
import ExercisePickerModal from './ExercisePickerModal';
import StepperInput from './StepperInput';
import SheetHeader from './SheetHeader';
import AppAlertModal, { AppAlertButton } from './AppAlertModal';

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

  // Local alert modal state
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
    const exDef = getExerciseById(exercises[index].exerciseId, customExercises);
    triggerAlert(
      "Remove Exercise?",
      `Remove "${exDef?.name || 'this exercise'}" from the template?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            const updated = [...exercises];
            updated.splice(index, 1);
            setExercises(updated);
          }
        }
      ]
    );
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
      triggerAlert("Missing Name", "Please enter a template name.");
      return;
    }
    if (exercises.length === 0) {
      triggerAlert("No Exercises", "Please add at least one exercise.");
      return;
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({
      id: template?.id || generateId(),
      name: name.trim(),
      color,
      exercises
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <SheetHeader
          title={template ? 'Edit Template' : 'New Template'}
          onClose={onClose}
          leftAction={
            <TouchableOpacity onPress={onClose} style={styles.deleteHeaderBtn} activeOpacity={0.7}>
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          }
          rightAction={
            template && onDelete ? (
              <TouchableOpacity onPress={() => {
                triggerAlert(
                  "Delete Template",
                  "Are you sure you want to delete this workout template?",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => { onDelete(template.id); onClose(); } }
                  ]
                );
              }} style={styles.deleteHeaderBtn} activeOpacity={0.7}>
                <Trash2 size={20} color={theme.colors.accentRed} />
              </TouchableOpacity>
            ) : null
          }
        />

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
              const exDef = getExerciseById(tEx.exerciseId, customExercises);
              if (!exDef) return null;

              return (
                <View key={`${tEx.exerciseId}-${index}`} style={styles.exerciseCard}>
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
                        <Trash2 size={20} color={theme.colors.accentRed} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.pickersRow}>
                    <View style={styles.pickerGroup}>
                      <Text style={styles.pickerLabel}>Sets</Text>
                      <StepperInput
                        value={tEx.targetSets}
                        onChange={(val) => updateTarget(index, 'targetSets', val - tEx.targetSets)}
                        min={1}
                      />
                    </View>

                    <View style={styles.pickerGroup}>
                      <Text style={styles.pickerLabel}>Reps</Text>
                      <StepperInput
                        value={tEx.targetReps}
                        onChange={(val) => updateTarget(index, 'targetReps', val - tEx.targetReps)}
                        min={1}
                      />
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
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: name.trim() && exercises.length > 0 ? theme.colors.text : theme.colors.surfaceElevated }]} 
            onPress={handleSave}
            disabled={!name.trim() || exercises.length === 0}
            activeOpacity={0.8}
          >
            <Text style={[styles.saveBtnText, { color: name.trim() && exercises.length > 0 ? '#000000' : theme.colors.textSubtle }]}>
              Save Template
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleAddExercise}
        customExercises={customExercises}
        onCustomExercisesChange={onCustomExercisesChange}
      />

      <AppAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
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
    color: theme.colors.accentRed,
    fontSize: 16,
  },
  saveText: {
    fontFamily: 'Outfit_600SemiBold',
    color: theme.colors.accent,
    fontSize: 16,
    textAlign: 'right',
  },
  headerTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: theme.colors.text,
  },
  footer: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
  },
  deleteHeaderBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: theme.colors.surfaceSecondary,
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
    borderRadius: theme.borderRadius.md,
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
