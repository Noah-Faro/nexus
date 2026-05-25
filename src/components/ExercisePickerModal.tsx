import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Search, Plus } from 'lucide-react-native';
import { theme } from '../theme';
import { Exercise } from '../trainingTypes';
import { EXERCISE_LIBRARY } from '../exerciseLibrary';
import ExerciseSynthesizer from './ExerciseSynthesizer';
import { saveCustomExercises } from '../trainingStorage';

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exerciseId: string) => void;
  customExercises: Exercise[];
  onCustomExercisesChange?: (updated: Exercise[]) => void;
}

export default function ExercisePickerModal({ visible, onClose, onSelect, customExercises, onCustomExercisesChange }: ExercisePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [synthVisible, setSynthVisible] = useState(false);

  const handleSaveCustom = async (newEx: Exercise) => {
    const updated = [...(customExercises || []), newEx];
    await saveCustomExercises(updated);
    if (onCustomExercisesChange) {
      onCustomExercisesChange(updated);
    }
    onSelect(newEx.id); // Automatically select newly created custom exercise
    setSynthVisible(false);
    onClose();
  };

  const allExercises = [
    ...Object.values(EXERCISE_LIBRARY),
    ...(customExercises || [])
  ];

  const filtered = allExercises.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Exercise</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setSynthVisible(true)} style={styles.iconBtn}>
              <Plus size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView style={styles.list}>
          {filtered.map(ex => (
            <TouchableOpacity 
              key={ex.id} 
              style={styles.exerciseItem}
              onPress={() => {
                onSelect(ex.id);
                setSearchQuery('');
                onClose();
              }}
            >
              <View>
                <Text style={styles.exerciseName}>{ex.name}</Text>
                <Text style={styles.exerciseSub}>{ex.muscleGroup.toUpperCase()} • {ex.equipment.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      {synthVisible && (
        <ExerciseSynthesizer
          visible={synthVisible}
          onClose={() => setSynthVisible(false)}
          onSave={handleSaveCustom}
        />
      )}
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
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    position: 'relative',
  },
  headerTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: theme.colors.text,
  },
  headerRight: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 4,
    marginLeft: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.typography.sans,
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  exerciseItem: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  exerciseName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 4,
  },
  exerciseSub: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
  }
});
