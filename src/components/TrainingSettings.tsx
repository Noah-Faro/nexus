import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { Trash2, Search, ChevronRight, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Exercise } from '../trainingTypes';
import { EXERCISE_LIBRARY } from '../exerciseLibrary';
import { loadExerciseDefaults, saveExerciseDefaults, loadCustomExercises, saveCustomExercises } from '../trainingStorage';
import StepperInput from './StepperInput';
import SheetHeader from './SheetHeader';
import AppAlertModal, { AppAlertButton } from './AppAlertModal';
import SegmentedControl from './SegmentedControl';

interface TrainingSettingsProps {
  onClose: () => void;
  customExercises: Exercise[];
  onCustomExercisesChange: (updated: Exercise[]) => void;
}

type CategoryType = 'all' | 'push' | 'pull' | 'legs' | 'custom';

export default function TrainingSettings({ onClose, customExercises, onCustomExercisesChange }: TrainingSettingsProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [defaults, setDefaults] = useState<Record<string, { defaultWeight: number, defaultReps: number, weightUnit?: 'kg' | 'lbs' }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

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

  useEffect(() => {
    async function loadData() {
      setExercises([...Object.values(EXERCISE_LIBRARY), ...customExercises]);
      
      const loadedDefaults = await loadExerciseDefaults();
      setDefaults(loadedDefaults);
    }
    loadData();
  }, [customExercises]);

  const updateDefault = (id: string, field: 'defaultWeight' | 'defaultReps' | 'weightUnit', value: any) => {
    setDefaults(prev => {
      const current = prev[id] || { defaultWeight: 20, defaultReps: 10, weightUnit: 'kg' };
      return {
        ...prev,
        [id]: { ...current, [field]: value }
      };
    });
  };

  const handleSave = async () => {
    await saveExerciseDefaults(defaults);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const handleDeleteCustomExercise = (id: string) => {
    triggerAlert(
      "Delete Custom Exercise?",
      "Are you sure you want to permanently delete this exercise?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            const updated = customExercises.filter(e => e.id !== id);
            await saveCustomExercises(updated);
            onCustomExercisesChange(updated);
            
            // Clean up its default entry too
            setDefaults(prev => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }
        }
      ]
    );
  };

  // Dynamic search and tab category filters
  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ex.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ex.equipment.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeCategory === 'all') return true;
    if (activeCategory === 'custom') return ex.isCustom;
    return ex.muscleGroup === activeCategory;
  });

  const groupedExercises: Record<string, Exercise[]> = {};
  filteredExercises.forEach(ex => {
    const key = ex.isCustom ? 'custom' : ex.muscleGroup;
    if (!groupedExercises[key]) {
      groupedExercises[key] = [];
    }
    groupedExercises[key].push(ex);
  });

  const categoryOrder = ['push', 'pull', 'legs', 'custom'];
  const categoryLabels: Record<string, string> = {
    push: 'Push Exercises',
    pull: 'Pull Exercises',
    legs: 'Legs Exercises',
    custom: 'Custom Exercises',
  };

  const renderExerciseSetting = (ex: Exercise) => {
    const exDefaults = defaults[ex.id] || { defaultWeight: 20, defaultReps: 10, weightUnit: ex.weightUnit || 'kg' };
    const currentUnit = exDefaults.weightUnit || ex.weightUnit || 'kg';
    const isExpanded = expandedExerciseId === ex.id;

    return (
      <View key={ex.id} style={styles.settingAccordionContainer}>
        <TouchableOpacity
          style={styles.settingRowHeader}
          onPress={() => {
            Haptics.selectionAsync();
            setExpandedExerciseId(prev => prev === ex.id ? null : ex.id);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.exInfo}>
            <View style={styles.exNameContainer}>
              <Text style={styles.exerciseName} numberOfLines={1} ellipsizeMode="tail">
                {ex.name}
              </Text>
              {ex.isCustom && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteCustomExercise(ex.id);
                  }}
                  style={styles.trashBtn}
                >
                  <Trash2 size={16} color={theme.colors.accentRed} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.exerciseSub}>
              {ex.muscleGroup.toUpperCase()} • {ex.equipment.toUpperCase()}
            </Text>
          </View>
          <View style={styles.chevronContainer}>
            {isExpanded ? (
              <ChevronDown size={18} color={theme.colors.textMuted} />
            ) : (
              <ChevronRight size={18} color={theme.colors.textMuted} />
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedPanel}>
            <View style={styles.controlItem}>
              <Text style={styles.controlLabel}>Weight ({currentUnit})</Text>
              <StepperInput
                value={exDefaults.defaultWeight}
                onChange={(val) => updateDefault(ex.id, 'defaultWeight', Number(val.toFixed(1)))}
                min={0}
                step={ex.incrementStep || 2.5}
              />
            </View>

            <View style={styles.controlItem}>
              <Text style={styles.controlLabel}>Reps</Text>
              <StepperInput
                value={exDefaults.defaultReps}
                onChange={(val) => updateDefault(ex.id, 'defaultReps', val)}
                min={1}
                step={1}
              />
            </View>

            <View style={styles.controlItem}>
              <Text style={styles.controlLabel}>Unit</Text>
              <TouchableOpacity
                style={[styles.unitToggle, currentUnit === 'lbs' && styles.unitToggleLbs]}
                onPress={() => {
                  Haptics.selectionAsync();
                  const nextUnit = currentUnit === 'kg' ? 'lbs' : 'kg';
                  updateDefault(ex.id, 'weightUnit', nextUnit);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.unitToggleText}>{currentUnit.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
      <View style={styles.modalContent}>
        <View style={{ paddingHorizontal: 16 }}>
          <SheetHeader
            title="Exercise Defaults"
            onClose={onClose}
          />
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search defaults..."
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

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filteredExercises.length > 0 ? (
            categoryOrder.map(cat => {
              const items = groupedExercises[cat];
              if (!items || items.length === 0) return null;

              return (
                <View key={cat} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{categoryLabels[cat].toUpperCase()}</Text>
                  </View>
                  {items.map((ex, idx) => (
                    <View key={ex.id}>
                      {idx > 0 && <View style={styles.divider} />}
                      {renderExerciseSetting(ex)}
                    </View>
                  ))}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No exercise defaults match your filters</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AppAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
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
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222222',
    backgroundColor: '#050505',
  },
  headerLabelLeft: {
    fontFamily: theme.typography.bold,
    fontSize: 10,
    color: theme.colors.textMuted,
    letterSpacing: 1,
    flex: 1,
  },
  headerRightLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 270,
    justifyContent: 'space-between',
  },
  headerLabelCent: {
    fontFamily: theme.typography.bold,
    fontSize: 10,
    color: theme.colors.textMuted,
    letterSpacing: 1,
    width: 84,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.xl,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  cardTitle: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md,
  },
  footer: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  saveBtn: {
    backgroundColor: theme.colors.text,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: theme.typography.semibold,
    fontSize: 17,
    color: '#000000',
  },
  settingAccordionContainer: {
    backgroundColor: 'transparent',
  },
  settingRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  exInfo: {
    flex: 1,
    marginRight: 8,
  },
  exNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  exerciseName: {
    fontFamily: theme.typography.sans,
    fontSize: 16,
    color: theme.colors.text,
    flexShrink: 1,
  },
  trashBtn: {
    padding: 2,
  },
  exerciseSub: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  chevronContainer: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#111111',
  },
  controlItem: {
    alignItems: 'center',
    gap: 6,
  },
  controlLabel: {
    fontFamily: theme.typography.semibold,
    fontSize: 10,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  unitToggle: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 6,
    width: 60,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitToggleLbs: {
    borderColor: theme.colors.accent,
    backgroundColor: '#0f2027',
  },
  unitToggleText: {
    fontFamily: theme.typography.bold,
    fontSize: 12,
    color: theme.colors.text,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  }
});
