import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';
import { Award, Check } from 'lucide-react-native';
import { theme } from '../theme';

interface GoalModalProps {
  visible: boolean;
  onClose: () => void;
  effectiveIntake: number;
}

export default function GoalModal({ visible, onClose, effectiveIntake }: GoalModalProps) {
  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.badgeContainer}>
            <View style={styles.circle}>
              <Check size={32} color="#000000" />
            </View>
          </View>

          <Text style={styles.titleText}>Target Reached</Text>
          <Text style={styles.messageText}>You've successfully hit your hydration goal for today.</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{effectiveIntake} ml</Text>
              <Text style={styles.statLabel}>Net Intake</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>100%+</Text>
              <Text style={styles.statLabel}>Hydration</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.dismissBtnText}>Awesome</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  badgeContainer: {
    marginBottom: theme.spacing.lg,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  titleText: {
    fontFamily: theme.typography.sans,
    fontSize: 22,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  messageText: {
    fontFamily: theme.typography.sans,
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.sm,
  },
  statValue: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textSubtle,
    fontWeight: theme.typography.weight.medium,
  },
  dismissBtn: {
    backgroundColor: theme.colors.text,
    width: '100%',
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  dismissBtnText: {
    fontFamily: theme.typography.sans,
    fontSize: 16,
    color: '#000000',
    fontWeight: theme.typography.weight.bold,
  },
});
