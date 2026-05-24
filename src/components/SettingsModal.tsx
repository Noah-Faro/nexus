import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView, Switch, TextInput } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { theme } from '../theme';
import { UserSettings } from '../types';
import { calculateGoal } from '../storage';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
}

export default function SettingsModal({ visible, onClose, settings, onSave }: SettingsModalProps) {
  const [weight, setWeight] = useState(String(settings.weight));
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>(settings.weightUnit);
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'moderate' | 'active'>(settings.activityLevel);
  const [useAutoGoal, setUseAutoGoal] = useState(settings.useAutoGoal);
  const [customGoal, setCustomGoal] = useState(String(settings.customGoal || 2500));

  const handleSave = () => {
    const updatedSettings: UserSettings = {
      weight: parseFloat(weight) || 70,
      weightUnit,
      activityLevel,
      useAutoGoal,
      customGoal: useAutoGoal ? null : (parseInt(customGoal, 10) || 2500),
    };
    onSave(updatedSettings);
    onClose();
  };

  // Temp calculation for real-time review in settings
  const tempSettings: UserSettings = {
    weight: parseFloat(weight) || 70,
    weightUnit,
    activityLevel,
    useAutoGoal,
    customGoal: useAutoGoal ? null : (parseInt(customGoal, 10) || 2500),
  };
  const computedGoal = calculateGoal(tempSettings);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.headerTitle}>edit-profile.md</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody}>
            {/* YAML Frontmatter Layout */}
            <View style={styles.frontmatterContainer}>
              <Text style={styles.yamlDivider}>---</Text>
              <Text style={styles.yamlComment}># User profile settings (YAML format)</Text>
              
              <View style={styles.yamlLine}>
                <Text style={styles.yamlKey}>weight: </Text>
                <Text style={styles.yamlValue}>{weight} {weightUnit}</Text>
              </View>
              
              <View style={styles.yamlLine}>
                <Text style={styles.yamlKey}>activity_level: </Text>
                <Text style={styles.yamlValue}>{activityLevel}</Text>
              </View>
              
              <View style={styles.yamlLine}>
                <Text style={styles.yamlKey}>auto_goal_calculation: </Text>
                <Text style={styles.yamlValue}>{useAutoGoal ? 'true' : 'false'}</Text>
              </View>

              <View style={styles.yamlLine}>
                <Text style={styles.yamlKey}>calculated_target: </Text>
                <Text style={styles.yamlValue}>{computedGoal} ml</Text>
              </View>
              <Text style={styles.yamlDivider}>---</Text>
            </View>

            {/* Input Controls */}
            <View style={styles.controlsSection}>
              {/* Weight Adjustment */}
              <View style={styles.controlGroup}>
                <Text style={styles.controlLabel}>Weight</Text>
                <View style={styles.weightInputRow}>
                  <TextInput
                    style={styles.numericInput}
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={setWeight}
                    placeholderTextColor={theme.colors.textSubtle}
                  />
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, weightUnit === 'kg' && styles.toggleBtnActive]}
                      onPress={() => setWeightUnit('kg')}
                    >
                      <Text style={[styles.toggleBtnText, weightUnit === 'kg' && styles.toggleBtnTextActive]}>kg</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, weightUnit === 'lbs' && styles.toggleBtnActive]}
                      onPress={() => setWeightUnit('lbs')}
                    >
                      <Text style={[styles.toggleBtnText, weightUnit === 'lbs' && styles.toggleBtnTextActive]}>lbs</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Activity Modifier */}
              <View style={styles.controlGroup}>
                <Text style={styles.controlLabel}>Activity Modifier</Text>
                <View style={styles.segmentControl}>
                  {(['sedentary', 'moderate', 'active'] as const).map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.segmentBtn, activityLevel === level && styles.segmentBtnActive]}
                      onPress={() => setActivityLevel(level)}
                    >
                      <Text style={[styles.segmentBtnText, activityLevel === level && styles.segmentBtnTextActive]}>
                        {level.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.helpText}>
                  Calculates baseline water intake: base (35ml/kg) multiplied by 1.0 (sedentary), 1.15 (moderate), or 1.3 (active).
                </Text>
              </View>

              {/* Goal Computation Auto/Manual */}
              <View style={styles.controlGroup}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.controlLabel}>Auto-Calculate Intake Target</Text>
                    <Text style={styles.helpText}>Recommend hydration based on body metrics.</Text>
                  </View>
                  <Switch
                    trackColor={{ false: theme.colors.border, true: theme.colors.accentFade }}
                    thumbColor={useAutoGoal ? theme.colors.accent : theme.colors.textMuted}
                    ios_backgroundColor={theme.colors.border}
                    onValueChange={setUseAutoGoal}
                    value={useAutoGoal}
                  />
                </View>
              </View>

              {/* Manual Override Goal Input */}
              {!useAutoGoal && (
                <View style={[styles.controlGroup, styles.manualGroup]}>
                  <Text style={styles.controlLabel}>Manual Target Water Intake (ml)</Text>
                  <TextInput
                    style={styles.numericInputLarge}
                    keyboardType="numeric"
                    value={customGoal}
                    onChangeText={setCustomGoal}
                    placeholder="e.g. 2500"
                    placeholderTextColor={theme.colors.textSubtle}
                  />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelAction} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveAction} onPress={handleSave}>
              <Check size={16} color="#000000" />
              <Text style={styles.saveText}>Save Config</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '85%',
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontFamily: theme.typography.mono,
    fontSize: 14,
    color: theme.colors.text,
  },
  closeButton: {
    padding: 4,
  },
  scrollBody: {
    padding: theme.spacing.md,
  },
  frontmatterContainer: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  yamlDivider: {
    fontFamily: theme.typography.mono,
    color: theme.colors.accent,
    letterSpacing: 2,
    fontSize: 13,
  },
  yamlComment: {
    fontFamily: theme.typography.mono,
    color: theme.colors.textSubtle,
    fontSize: 11,
    marginBottom: 6,
  },
  yamlLine: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  yamlKey: {
    fontFamily: theme.typography.mono,
    color: theme.colors.accentAmber,
    fontSize: 12,
  },
  yamlValue: {
    fontFamily: theme.typography.mono,
    color: theme.colors.text,
    fontSize: 12,
  },
  controlsSection: {
    gap: theme.spacing.lg,
  },
  controlGroup: {
    gap: theme.spacing.sm,
  },
  manualGroup: {
    paddingLeft: theme.spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.accentAmber,
  },
  controlLabel: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.semibold,
  },
  weightInputRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  numericInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    color: theme.colors.text,
    fontFamily: theme.typography.mono,
    fontSize: 15,
  },
  numericInputLarge: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontFamily: theme.typography.mono,
    fontSize: 18,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  toggleBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.accent,
  },
  toggleBtnText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.mono,
    fontSize: 12,
  },
  toggleBtnTextActive: {
    color: '#000000',
    fontWeight: theme.typography.weight.bold,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.accentFade,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.accent,
  },
  segmentBtnText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.mono,
    fontSize: 10,
    fontWeight: theme.typography.weight.medium,
  },
  segmentBtnTextActive: {
    color: theme.colors.accent,
    fontWeight: theme.typography.weight.bold,
  },
  helpText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 15,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: '#050505',
    gap: theme.spacing.md,
  },
  cancelAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  cancelText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: theme.typography.weight.medium,
  },
  saveAction: {
    flex: 2,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  saveText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: theme.typography.weight.bold,
  },
});
