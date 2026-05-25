import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Trash2, X } from 'lucide-react-native';
import { theme } from '../theme';
import { Exercise } from '../trainingTypes';
import { EXERCISE_LIBRARY } from '../exerciseLibrary';
import { loadExerciseDefaults, saveExerciseDefaults, loadCustomExercises, saveCustomExercises } from '../trainingStorage';

interface TrainingSettingsProps {
  onClose: () => void;
  customExercises: Exercise[];
  onCustomExercisesChange: (updated: Exercise[]) => void;
}

export default function TrainingSettings({ onClose, customExercises, onCustomExercisesChange }: TrainingSettingsProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [defaults, setDefaults] = useState<Record<string, { defaultWeight: number, defaultReps: number }>>({});

  useEffect(() => {
    async function loadData() {
      setExercises([...Object.values(EXERCISE_LIBRARY), ...customExercises]);
      
      const loadedDefaults = await loadExerciseDefaults();
      setDefaults(loadedDefaults);
    }
    loadData();
  }, [customExercises]);

  const updateDefault = (id: string, field: 'defaultWeight' | 'defaultReps', value: number) => {
    setDefaults(prev => {
      const current = prev[id] || { defaultWeight: 20, defaultReps: 10 };
      return {
        ...prev,
        [id]: { ...current, [field]: value }
      };
    });
  };

  const handleSave = async () => {
    await saveExerciseDefaults(defaults);
    onClose();
  };

  const handleDeleteCustomExercise = (id: string) => {
    Alert.alert(
      "Delete Custom Exercise?",
      "Are you sure you want to permanently delete this exercise?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            const updated = customExercises.filter(e => e.id !== id);
            await saveCustomExercises(updated);
            onCustomExercisesChange(updated);
          }
        }
      ]
    );
  };

  const renderExerciseSetting = (ex: Exercise) => {
    const exDefaults = defaults[ex.id] || { defaultWeight: 20, defaultReps: 10 };

    return (
      <View key={ex.id} style={styles.settingCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.exerciseName}>{ex.name}</Text>
          {ex.isCustom && (
            <TouchableOpacity onPress={() => handleDeleteCustomExercise(ex.id)}>
              <Trash2 size={20} color="#ff453a" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.pickersRow}>
          <View style={styles.pickerGroup}>
            <Text style={styles.pickerLabel}>Weight ({ex.weightUnit})</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => updateDefault(ex.id, 'defaultWeight', Math.max(0, exDefaults.defaultWeight - ex.incrementStep))}>
                <Text style={styles.stepperBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{exDefaults.defaultWeight}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => updateDefault(ex.id, 'defaultWeight', exDefaults.defaultWeight + ex.incrementStep)}>
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.pickerGroup}>
            <Text style={styles.pickerLabel}>Reps</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => updateDefault(ex.id, 'defaultReps', Math.max(1, exDefaults.defaultReps - 1))}>
                <Text style={styles.stepperBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{exDefaults.defaultReps}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => updateDefault(ex.id, 'defaultReps', exDefaults.defaultReps + 1)}>
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
      <View style={styles.modalContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Exercise Defaults</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <View style={styles.closeIconBg}>
              <X size={20} color={theme.colors.text} />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.descText}>
            Set the starting weight and reps for each exercise. These values will automatically populate the pickers when you start a new exercise in a session.
          </Text>
          
          {exercises.map(renderExerciseSetting)}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '90%',
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    position: 'relative',
  },
  headerTitle: {
    fontFamily: theme.typography.sans,
    fontSize: 18,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 14,
  },
  closeIconBg: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 15,
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  footer: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  saveBtn: {
    backgroundColor: theme.colors.text,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    fontWeight: theme.typography.weight.bold,
    color: '#000000',
  },
  descText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  settingCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exerciseName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: theme.colors.text,
    flex: 1,
    paddingRight: 8,
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
  }
});
