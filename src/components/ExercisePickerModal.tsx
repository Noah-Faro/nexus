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

type CategoryType = 'all' | 'push' | 'pull' | 'legs' | 'core' | 'cardio';
type EquipmentFilterType = 'all' | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';

export default function ExercisePickerModal({ visible, onClose, onSelect, customExercises, onCustomExercisesChange }: ExercisePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
  const [activeEquipment, setActiveEquipment] = useState<EquipmentFilterType>('all');
  const [activePrimary, setActivePrimary] = useState<string>('all');
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

    if (activeCategory !== 'all' && e.muscleGroup !== activeCategory) return false;
    if (activeEquipment !== 'all' && e.equipment !== activeEquipment) return false;
    if (activePrimary !== 'all' && e.primaryMuscle !== activePrimary) return false;

    return true;
  });

  // Section grouping for 'All' view to make it highly structured
  const sections = [
    { title: 'PUSH', data: filtered.filter(e => e.muscleGroup === 'push') },
    { title: 'PULL', data: filtered.filter(e => e.muscleGroup === 'pull') },
    { title: 'LEGS', data: filtered.filter(e => e.muscleGroup === 'legs') },
    { title: 'CORE', data: filtered.filter(e => e.muscleGroup === 'core') },
    { title: 'CARDIO', data: filtered.filter(e => e.muscleGroup === 'cardio') }
  ].filter(s => s.data.length > 0);

  // Derive available primary muscles from the currently filtered list
  const availablePrimaryMuscles = Array.from(new Set(allExercises.map(e => e.primaryMuscle).filter(Boolean))) as string[];


  const getEquipmentColor = (equipment: string) => {
    switch (equipment) {
      case 'barbell': return theme.colors.accentCyan;
      case 'dumbbell': return theme.colors.accentAmber;
      case 'cable': return theme.colors.accentPurple;
      case 'bodyweight': return theme.colors.accentGreen;
      case 'machine': return theme.colors.textMuted;
      default: return theme.colors.textMuted;
    }
  };

  const handleSelectExercise = (exerciseId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(exerciseId);
    setSearchQuery('');
    setActiveCategory('all');
    setActiveEquipment('all');
    setActivePrimary('all');
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
          <View style={styles.itemRow}>
            <Text style={styles.exerciseName} numberOfLines={1}>{ex.name}</Text>
            <View style={styles.groupBadges}>
              <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>
                  {ex.muscleGroup.toUpperCase()}
                </Text>
              </View>
              {ex.primaryMuscle && (
                <View style={[styles.groupBadge, { backgroundColor: theme.colors.surfaceSecondary }]}>
                  <Text style={[styles.groupBadgeText, { color: theme.colors.text }]}>
                    {ex.primaryMuscle.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>
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
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={{ paddingHorizontal: theme.spacing.md }}>
          <SheetHeader
            title="Select Exercise"
            onClose={onClose}
            rightAction={
              <TouchableOpacity onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSynthVisible(true);
              }} style={{ padding: theme.spacing.xs }}>
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
            values={['all', 'push', 'pull', 'legs', 'core', 'cardio'] as const}
            selectedValue={activeCategory}
            onChange={(val) => {
              setActiveCategory(val);
              setActivePrimary('all'); // Reset primary muscle filter when category changes
            }}
            labels={['All', 'Push', 'Pull', 'Legs', 'Core', 'Cardio']}
          />
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity 
              style={[styles.filterChip, activeEquipment === 'all' && styles.filterChipActive]}
              onPress={() => setActiveEquipment('all')}
            >
              <Text style={[styles.filterChipText, activeEquipment === 'all' && styles.filterChipTextActive]}>All Equip.</Text>
            </TouchableOpacity>
            {['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'].map(eq => (
              <TouchableOpacity 
                key={eq}
                style={[styles.filterChip, activeEquipment === eq && styles.filterChipActive]}
                onPress={() => setActiveEquipment(eq as EquipmentFilterType)}
              >
                <Text style={[styles.filterChipText, activeEquipment === eq && styles.filterChipTextActive]}>
                  {eq.charAt(0).toUpperCase() + eq.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
            <TouchableOpacity 
              style={[styles.filterChip, activePrimary === 'all' && styles.filterChipActive]}
              onPress={() => setActivePrimary('all')}
            >
              <Text style={[styles.filterChipText, activePrimary === 'all' && styles.filterChipTextActive]}>All Muscles</Text>
            </TouchableOpacity>
            {availablePrimaryMuscles.map(pm => (
              <TouchableOpacity 
                key={pm}
                style={[styles.filterChip, activePrimary === pm && styles.filterChipActive]}
                onPress={() => setActivePrimary(pm)}
              >
                <Text style={[styles.filterChipText, activePrimary === pm && styles.filterChipTextActive]}>{pm}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
    fontFamily: theme.typography.bold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: theme.colors.textMuted,
  },
  sectionDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  exerciseItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderMuted,
  },
  itemContent: {
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  groupBadges: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    alignItems: 'center',
    flexShrink: 0,
  },
  exerciseName: {
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.text,
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: theme.typography.semibold,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  customBadge: {
    backgroundColor: theme.colors.accentRed,
    borderColor: theme.colors.accentRed,
  },
  customBadgeText: {
    fontFamily: theme.typography.bold,
    fontSize: 8,
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  groupBadge: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.xs,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
  },
  groupBadgeText: {
    fontFamily: theme.typography.semibold,
    fontSize: 8,
    color: theme.colors.textMuted,
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
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  filterChipText: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  filterChipTextActive: {
    color: theme.colors.background,
    fontFamily: theme.typography.semibold,
  }
});
