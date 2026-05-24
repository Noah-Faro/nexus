import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView, Switch, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
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
  const [userName, setUserName] = useState(settings.userName || '');
  const [weight, setWeight] = useState(String(settings.weight));
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>(settings.weightUnit);
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'moderate' | 'active'>(settings.activityLevel);
  const [useAutoGoal, setUseAutoGoal] = useState(settings.useAutoGoal);
  const [customGoal, setCustomGoal] = useState(String(settings.customGoal || 2500));

  const handleSave = () => {
    const updatedSettings: UserSettings = {
      userName: userName.trim(),
      weight: parseFloat(weight) || 70,
      weightUnit,
      activityLevel,
      useAutoGoal,
      customGoal: useAutoGoal ? null : (parseInt(customGoal, 10) || 2500),
    };
    onSave(updatedSettings);
    onClose();
  };

  const tempSettings: UserSettings = {
    userName: userName.trim(),
    weight: parseFloat(weight) || 70,
    weightUnit,
    activityLevel,
    useAutoGoal,
    customGoal: useAutoGoal ? null : (parseInt(customGoal, 10) || 2500),
  };
  const computedGoal = calculateGoal(tempSettings);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <View style={styles.closeIconBg}>
                <X size={20} color={theme.colors.text} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Profile Details</Text>
              </View>
              
              <View style={styles.row}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.nameInput}
                  value={userName}
                  onChangeText={setUserName}
                  placeholder="Commander"
                  placeholderTextColor={theme.colors.textSubtle}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.label}>Weight</Text>
                <View style={styles.weightInputContainer}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={setWeight}
                    placeholderTextColor={theme.colors.textSubtle}
                    returnKeyType="done"
                  />
                  <View style={styles.unitToggle}>
                    <TouchableOpacity
                      style={[styles.unitBtn, weightUnit === 'kg' && styles.unitBtnActive]}
                      onPress={() => setWeightUnit('kg')}
                    >
                      <Text style={[styles.unitBtnText, weightUnit === 'kg' && styles.unitBtnTextActive]}>kg</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitBtn, weightUnit === 'lbs' && styles.unitBtnActive]}
                      onPress={() => setWeightUnit('lbs')}
                    >
                      <Text style={[styles.unitBtnText, weightUnit === 'lbs' && styles.unitBtnTextActive]}>lbs</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.rowVertical}>
                <Text style={styles.label}>Activity Level</Text>
                <View style={styles.segmentedControl}>
                  {(['sedentary', 'moderate', 'active'] as const).map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.segmentBtn, activityLevel === level && styles.segmentBtnActive]}
                      onPress={() => setActivityLevel(level)}
                    >
                      <Text style={[styles.segmentBtnText, activityLevel === level && styles.segmentBtnTextActive]}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Goals</Text>
              </View>
              
              <View style={styles.row}>
                <View style={styles.textStack}>
                  <Text style={styles.label}>Auto-Calculate Target</Text>
                  <Text style={styles.subtext}>Based on weight and activity</Text>
                </View>
                <Switch
                  value={useAutoGoal}
                  onValueChange={setUseAutoGoal}
                  trackColor={{ false: theme.colors.surface, true: '#34C759' }}
                  ios_backgroundColor={theme.colors.surface}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.label}>Daily Target</Text>
                {useAutoGoal ? (
                  <Text style={styles.calculatedGoal}>{computedGoal} ml</Text>
                ) : (
                  <TextInput
                    style={[styles.input, styles.targetInput]}
                    keyboardType="numeric"
                    value={customGoal}
                    onChangeText={setCustomGoal}
                    placeholder="2500"
                    placeholderTextColor={theme.colors.textSubtle}
                    returnKeyType="done"
                  />
                )}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  scrollBody: {
    padding: theme.spacing.lg,
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
    fontFamily: theme.typography.sans,
    fontSize: 13,
    fontWeight: theme.typography.weight.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  rowVertical: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md,
  },
  label: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    color: theme.colors.text,
  },
  textStack: {
    flex: 1,
    paddingRight: 16,
  },
  subtext: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  weightInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 160,
    textAlign: 'right',
  },
  input: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    textAlign: 'center',
  },
  targetInput: {
    minWidth: 100,
  },
  calculatedGoal: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    fontWeight: theme.typography.weight.semibold,
    color: theme.colors.textMuted,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 2,
  },
  unitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unitBtnActive: {
    backgroundColor: theme.colors.surfaceElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  unitBtnText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    fontWeight: theme.typography.weight.medium,
    color: theme.colors.textMuted,
  },
  unitBtnTextActive: {
    color: theme.colors.text,
    fontWeight: theme.typography.weight.bold,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 2,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.surfaceElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  segmentBtnText: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weight.medium,
  },
  segmentBtnTextActive: {
    color: theme.colors.text,
    fontWeight: theme.typography.weight.semibold,
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
});
