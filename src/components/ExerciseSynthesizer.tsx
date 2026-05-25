import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { X, Save } from 'lucide-react-native';
import { theme } from '../theme';
import { Exercise, MuscleGroup, EquipmentType } from '../trainingTypes';

interface ExerciseSynthesizerProps {
  visible: boolean;
  onClose: () => void;
  onSave: (exercise: Exercise) => void;
}

const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body'];
const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Other'];

export default function ExerciseSynthesizer({ visible, onClose, onSave }: ExerciseSynthesizerProps) {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState(MUSCLE_GROUPS[0]);
  const [equipment, setEquipment] = useState(EQUIPMENT[0]);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for the custom exercise.');
      return;
    }

    const newEx: Exercise = {
      id: 'custom-' + Math.random().toString(36).substring(2, 10),
      name: name.trim(),
      muscleGroup: muscleGroup.toLowerCase() as MuscleGroup,
      equipment: equipment.toLowerCase() as EquipmentType,
      weightUnit,
      incrementStep: weightUnit === 'kg' ? 2.5 : 5,
      isCustom: true
    };

    onSave(newEx);
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Exercise</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.label}>EXERCISE NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Incline Smith Machine Press"
              placeholderTextColor={theme.colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>PRIMARY MUSCLE GROUP</Text>
            <View style={styles.chipContainer}>
              {MUSCLE_GROUPS.map(mg => (
                <TouchableOpacity 
                  key={mg} 
                  style={[styles.chip, muscleGroup === mg && styles.chipActive]}
                  onPress={() => setMuscleGroup(mg)}
                >
                  <Text style={[styles.chipText, muscleGroup === mg && styles.chipTextActive]}>{mg}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>EQUIPMENT</Text>
            <View style={styles.chipContainer}>
              {EQUIPMENT.map(eq => (
                <TouchableOpacity 
                  key={eq} 
                  style={[styles.chip, equipment === eq && styles.chipActive]}
                  onPress={() => setEquipment(eq)}
                >
                  <Text style={[styles.chipText, equipment === eq && styles.chipTextActive]}>{eq}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>WEIGHT UNIT</Text>
            <View style={styles.chipContainer}>
              {['kg', 'lbs'].map(u => (
                <TouchableOpacity 
                  key={u} 
                  style={[styles.chip, weightUnit === u && styles.chipActive]}
                  onPress={() => setWeightUnit(u as 'kg' | 'lbs')}
                >
                  <Text style={[styles.chipText, weightUnit === u && styles.chipTextActive]}>{u.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    width: 60,
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
    marginBottom: 12,
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 8,
    padding: 16,
    color: theme.colors.text,
    fontFamily: theme.typography.sans,
    fontSize: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  chipText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  chipTextActive: {
    color: theme.colors.background,
    fontFamily: 'Outfit_600SemiBold',
  }
});
