import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Droplet, X, Check } from 'lucide-react-native';
import { theme } from '../theme';
import { DrinkLog } from '../types';
import { generateId } from '../utils';
import { loadLogs, saveLogs, loadSettings, calculateGoal, getTodayProgress } from '../storage';
import StepperInput from './StepperInput';

interface QuickWaterModalProps {
  visible: boolean;
  onClose: () => void;
  onLogDrink?: (amount: number, type?: string) => Promise<void> | void;
  onCloudAutoPush?: () => void | Promise<void>;
}

const PRESET_AMOUNTS = [250, 500, 750, 1000];

export default function QuickWaterModal({
  visible,
  onClose,
  onLogDrink,
  onCloudAutoPush,
}: QuickWaterModalProps) {
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayGoal, setTodayGoal] = useState(3000);
  const [customAmount, setCustomAmount] = useState(250);
  const [isLogging, setIsLogging] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refreshProgress = useCallback(async () => {
    try {
      const [logs, settings] = await Promise.all([loadLogs(), loadSettings()]);
      const progress = getTodayProgress(logs, settings);
      setTodayTotal(progress.totalEffective);
      setTodayGoal(progress.goal);
    } catch (err) {
      console.error('Failed to load hydration progress', err);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setFeedback(null);
      void refreshProgress();
    }
  }, [visible, refreshProgress]);

  const handleLog = async (amount: number) => {
    if (isLogging || amount <= 0) return;
    setIsLogging(true);
    try {
      if (onLogDrink) {
        await onLogDrink(amount, 'water');
      } else {
        const [storedLogs, settings] = await Promise.all([loadLogs(), loadSettings()]);
        const newLog: DrinkLog = {
          id: generateId(),
          timestamp: Date.now(),
          amount,
          type: 'water',
          tag: '#water',
          effectiveAmount: amount,
          caffeineMg: undefined,
          isDecaf: false,
          goalAtTimeOfLog: calculateGoal(settings),
        };
        const updated = [newLog, ...storedLogs];
        await saveLogs(updated);
        void onCloudAutoPush?.();
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedback(`+${amount.toLocaleString()} ml logged!`);
      await refreshProgress();

      setTimeout(() => {
        setFeedback(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to log water', err);
    } finally {
      setIsLogging(false);
    }
  };

  const progressPercent = Math.min(100, Math.round((todayTotal / Math.max(1, todayGoal)) * 100));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Droplet size={18} color={theme.colors.accentCyan} fill={theme.colors.accentCyan} />
              </View>
              <Text style={styles.title}>Hydration Quick Log</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close quick hydration modal"
            >
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Today's Progress Bar */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Today's Intake</Text>
              <Text style={styles.progressValue}>
                {todayTotal.toLocaleString()} / {todayGoal.toLocaleString()} ml
                <Text style={styles.progressPercent}> ({progressPercent}%)</Text>
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          {/* Feedback banner */}
          {feedback && (
            <View style={styles.feedbackBanner}>
              <Check size={16} color={theme.colors.accentGreen} style={{ marginRight: 6 }} />
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}

          {/* Quick Presets Grid */}
          <Text style={styles.sectionTitle}>QUICK PRESETS</Text>
          <View style={styles.presetsGrid}>
            {PRESET_AMOUNTS.map(amount => (
              <TouchableOpacity
                key={amount}
                style={styles.presetBtn}
                onPress={() => handleLog(amount)}
                disabled={isLogging}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Log ${amount} milliliters of water`}
              >
                <Droplet size={16} color={theme.colors.accentCyan} style={styles.presetIcon} />
                <Text style={styles.presetBtnText}>+{amount} ml</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Amount Section */}
          <Text style={styles.sectionTitle}>CUSTOM AMOUNT</Text>
          <View style={styles.customSection}>
            <View style={styles.stepperContainer}>
              <StepperInput
                value={customAmount}
                onChange={val => setCustomAmount(Math.max(50, Math.min(2500, Math.round(val))))}
                min={50}
                max={2500}
                step={50}
              />
            </View>
            <TouchableOpacity
              style={[styles.customLogBtn, isLogging && styles.customLogBtnDisabled]}
              onPress={() => handleLog(customAmount)}
              disabled={isLogging}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Log ${customAmount} milliliters of water`}
            >
              <Text style={styles.customLogBtnText}>Log {customAmount} ml</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(100, 210, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.typography.bold,
    fontSize: 18,
    color: theme.colors.text,
  },
  closeBtn: {
    padding: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16,
  },
  progressCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    borderColor: theme.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  progressLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  progressValue: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  progressPercent: {
    fontFamily: theme.typography.sans,
    color: theme.colors.accentCyan,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceSecondary,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.accentCyan,
    borderRadius: 3,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(50, 215, 75, 0.12)',
    borderColor: 'rgba(50, 215, 75, 0.3)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: theme.spacing.md,
  },
  feedbackText: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.accentGreen,
  },
  sectionTitle: {
    fontFamily: theme.typography.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  presetBtn: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: 'rgba(100, 210, 255, 0.25)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  presetIcon: {
    marginRight: 6,
  },
  presetBtnText: {
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.accentCyan,
  },
  customSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperContainer: {
    flex: 1,
  },
  customLogBtn: {
    backgroundColor: theme.colors.accentCyan,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customLogBtnDisabled: {
    opacity: 0.5,
  },
  customLogBtnText: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: '#000000',
  },
});
