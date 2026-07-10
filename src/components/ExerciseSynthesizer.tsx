import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { theme } from '../theme';
import { Exercise, MuscleGroup, EquipmentType } from '../trainingTypes';
import { generateId } from '../utils';
import SheetHeader from './SheetHeader';
import AppAlertModal from './AppAlertModal';

interface ExerciseSynthesizerProps {
  visible: boolean;
  onClose: () => void;
  onSave: (exercise: Exercise) => void;
}

const CATEGORIES: MuscleGroup[] = ['push', 'pull', 'legs', 'core', 'cardio'];
const PRIMARY_MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Cardio', 'Full Body'];
const EQUIPMENT: EquipmentType[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
const TRACKING_TYPES = [
  { id: 'weight_reps', label: 'Weight & Reps' },
  { id: 'time', label: 'Time Only (Seconds)' },
  { id: 'time_distance', label: 'Time & Distance' }
] as const;

export default function ExerciseSynthesizer({ visible, onClose, onSave }: ExerciseSynthesizerProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MuscleGroup>('push');
  const [primaryMuscle, setPrimaryMuscle] = useState(PRIMARY_MUSCLES[0]);
  const [equipment, setEquipment] = useState<EquipmentType>('dumbbell');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [trackingType, setTrackingType] = useState<'weight_reps' | 'time' | 'time_distance'>('weight_reps');

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const triggerAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      triggerAlert('Missing Name', 'Please enter a name for the custom exercise.');
      return;
    }

    const newEx: Exercise = {
      id: 'custom-' + generateId(),
      name: name.trim(),
      muscleGroup: category,
      primaryMuscle,
      equipment,
      weightUnit,
      trackingType,
      incrementStep: trackingType === 'time_distance' ? 0.1 : (weightUnit === 'kg' ? 2.5 : 5),
      isCustom: true
    };

    onSave(newEx);
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <SheetHeader
          title="New Exercise"
          onClose={onClose}
          closeLabel="Cancel"
          rightAction={
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          }
        />

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
            <Text style={styles.label}>CATEGORY (PPL)</Text>
            <View style={styles.chipContainer}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.chip, category === cat && styles.chipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>PRIMARY MUSCLE</Text>
            <View style={styles.chipContainer}>
              {PRIMARY_MUSCLES.map(pm => (
                <TouchableOpacity 
                  key={pm} 
                  style={[styles.chip, primaryMuscle === pm && styles.chipActive]}
                  onPress={() => setPrimaryMuscle(pm)}
                >
                  <Text style={[styles.chipText, primaryMuscle === pm && styles.chipTextActive]}>{pm}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>TRACKING TYPE</Text>
            <View style={styles.chipContainer}>
              {TRACKING_TYPES.map(tt => (
                <TouchableOpacity 
                  key={tt.id} 
                  style={[styles.chip, trackingType === tt.id && styles.chipActive]}
                  onPress={() => setTrackingType(tt.id)}
                >
                  <Text style={[styles.chipText, trackingType === tt.id && styles.chipTextActive]}>{tt.label}</Text>
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
                  <Text style={[styles.chipText, equipment === eq && styles.chipTextActive]}>{eq.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {trackingType !== 'time' && (
            <View style={styles.section}>
              <Text style={styles.label}>{trackingType === 'time_distance' ? 'DISTANCE UNIT' : 'WEIGHT UNIT'}</Text>
              <View style={styles.chipContainer}>
                {['kg', 'lbs'].map(u => (
                  <TouchableOpacity 
                    key={u} 
                    style={[styles.chip, weightUnit === u && styles.chipActive]}
                    onPress={() => setWeightUnit(u as 'kg' | 'lbs')}
                  >
                    <Text style={[styles.chipText, weightUnit === u && styles.chipTextActive]}>
                      {trackingType === 'time_distance' ? (u === 'kg' ? 'KM' : 'MILES') : u.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
        <AppAlertModal
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          buttons={[{ text: 'OK', style: 'default' }]}
          onClose={() => setAlertVisible(false)}
        />
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
