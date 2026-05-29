import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Search, Plus } from 'lucide-react-native';
import { theme } from '../theme';
import { Exercise } from '../trainingTypes';
import { EXERCISE_LIBRARY } from '../exerciseLibrary';
import ExerciseSynthesizer from './ExerciseSynthesizer';
import { saveCustomExercises } from '../trainingStorage';
import SheetHeader from './SheetHeader';
import SegmentedControl from './SegmentedControl';
import * as Haptics from 'expo-haptics';

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exerciseId: string) => void;
  customExercises: Exercise[];
  onCustomExercisesChange?: (updated: Exercise[]) => void;
}

type CategoryType = 'all' | 'push' | 'pull' | 'legs' | 'custom';

export default function ExercisePickerModal({ visible, onClose, onSelect, customExercises, onCustomExercisesChange }: ExercisePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
  const [synthVisible, setSynthVisible] = useState(false);

  const handleSaveCustom = async (newEx: Exercise) => {
    const updated = [...(customExercises || []), newEx];
    await saveCustomExercises(updated);
    if (onCustomExercisesChange) {
      onCustomExercisesChange(updated);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelect(newEx.id); // Automatically select newly created custom exercise
    setSynthVisible(false);
    onClose();
  };

  const allExercises = [
    ...Object.values(EXERCISE_LIBRARY),
    ...(customExercises || [])
  ];

  // Apply real-time search query and category filtering
  const filtered = allExercises.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.equipment.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeCategory === 'all') return true;
    if (activeCategory === 'custom') return e.isCustom;
    return e.muscleGroup === activeCategory;
  });

  // Section grouping for 'All' view to make it highly structured
  const sections = [
    { title: 'PUSH', data: filtered.filter(e => e.muscleGroup === 'push' && !e.isCustom) },
    { title: 'PULL', data: filtered.filter(e => e.muscleGroup === 'pull' && !e.isCustom) },
    { title: 'LEGS', data: filtered.filter(e => e.muscleGroup === 'legs' && !e.isCustom) },
    { title: 'CUSTOM EXERCISES', data: filtered.filter(e => e.isCustom) }
  ].filter(s => s.data.length > 0);

  const getEquipmentColor = (equipment: string) => {
    switch (equipment) {
      case 'barbell': return '#64d2ff'; // Cyan
      case 'dumbbell': return '#ff9f0a'; // Amber
      case 'cable': return '#bf5af2'; // Purple
      case 'bodyweight': return '#32d74b'; // Green
      case 'machine': return '#8e8e93'; // Slate
      default: return theme.colors.textMuted;
    }
  };

  const handleSelectExercise = (exerciseId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(exerciseId);
    setSearchQuery('');
    setActiveCategory('all');
    onClose();
  };

  const renderExerciseItem = (ex: Exercise) => {
    const equipColor = getEquipmentColor(ex.equipment);

    return (
      <TouchableOpacity 
        key={ex.id} 
        style={styles.exerciseItem}
        onPress={() => handleSelectExercise(ex.id)}
        activeOpacity={0.7}
      >
        <View style={styles.itemContent}>
          <Text style={styles.exerciseName}>{ex.name}</Text>
          <View style={styles.badgeRow}>
            {ex.isCustom && (
              <View style={[styles.badge, styles.customBadge]}>
                <Text style={styles.customBadgeText}>CUSTOM</Text>
              </View>
            )}
            <View style={[styles.badge, { borderColor: equipColor }]}>
              <Text style={[styles.badgeText, { color: equipColor }]}>
                {ex.equipment.toUpperCase()}
              </Text>
            </View>
            <View style={styles.groupBadge}>
              <Text style={styles.groupBadgeText}>
                {ex.muscleGroup.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={{ paddingHorizontal: 16 }}>
          <SheetHeader
            title="Select Exercise"
            onClose={onClose}
            rightAction={
              <TouchableOpacity onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSynthVisible(true);
              }} style={{ padding: 4 }}>
                <Plus size={24} color={theme.colors.text} />
              </TouchableOpacity>
            }
          />
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>

        <View style={styles.tabsContainer}>
          <SegmentedControl
            values={['all', 'push', 'pull', 'legs', 'custom'] as const}
            selectedValue={activeCategory}
            onChange={(val) => setActiveCategory(val)}
            labels={['All', 'Push', 'Pull', 'Legs', 'Custom']}
          />
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {activeCategory === 'all' ? (
            sections.length > 0 ? (
              sections.map(sec => (
                <View key={sec.title} style={styles.sectionContainer}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{sec.title}</Text>
                    <View style={styles.sectionDivider} />
                  </View>
                  {sec.data.map(renderExerciseItem)}
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No exercises found matching search</Text>
              </View>
            )
          ) : (
            filtered.length > 0 ? (
              filtered.map(renderExerciseItem)
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No exercises found in this category</Text>
              </View>
            )
          )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
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
  tabsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: theme.colors.textMuted,
  },
  sectionDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#222222',
  },
  exerciseItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#111111',
  },
  itemContent: {
    flexDirection: 'column',
    gap: 6,
  },
  exerciseName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: theme.colors.text,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  customBadge: {
    backgroundColor: '#ff453a',
    borderColor: '#ff453a',
  },
  customBadgeText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 9,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  groupBadge: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  groupBadgeText: {
    fontFamily: theme.typography.sans,
    fontSize: 9,
    color: theme.colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  }
});
