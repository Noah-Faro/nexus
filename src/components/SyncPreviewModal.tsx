import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { theme } from '../theme';
import { SyncDiff } from '../backup';

interface SyncPreviewModalProps {
  visible: boolean;
  diff: SyncDiff | null;
  onConfirm: () => void;
  onCancel: () => void;
  isMerging: boolean;
}

export function SyncPreviewModal({ visible, diff, onConfirm, onCancel, isMerging }: SyncPreviewModalProps) {
  if (!diff) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Cloud Changes Detected</Text>
          <Text style={styles.subtitle}>
            Backup from: {new Date(diff.remoteDate).toLocaleString()}
          </Text>

          <ScrollView style={styles.diffContainer}>
            <Text style={styles.diffText}>
              • {diff.newSessionsCount > 0 ? `+${diff.newSessionsCount}` : diff.newSessionsCount} Workout Sessions
            </Text>
            <Text style={styles.diffText}>
              • {diff.newLogsCount > 0 ? `+${diff.newLogsCount}` : diff.newLogsCount} Hydration Logs
            </Text>
            <Text style={styles.diffText}>
              • Settings {diff.settingsChanged ? 'changed' : 'unchanged'}
            </Text>
            <Text style={styles.diffText}>
              • {diff.tombstonesApplied} Deletions Applied
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable 
              style={[styles.button, styles.cancelButton]} 
              onPress={onCancel}
              disabled={isMerging}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable 
              style={[styles.button, styles.mergeButton]} 
              onPress={onConfirm}
              disabled={isMerging}
            >
              <Text style={styles.mergeText}>{isMerging ? 'Merging...' : 'Merge Now'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: theme.colors.surfaceCard,
    padding: 24,
    borderRadius: 16,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontFamily: theme.typography.semibold,
    fontSize: 20,
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 16,
  },
  diffContainer: {
    maxHeight: 200,
    marginBottom: 24,
  },
  diffText: {
    fontFamily: theme.typography.sans,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 8,
  },
  actions: {
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelText: {
    fontFamily: theme.typography.semibold,
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  mergeButton: {
    backgroundColor: theme.colors.text, // pure white
  },
  mergeText: {
    fontFamily: theme.typography.bold,
    fontSize: 16,
    color: '#000000', // black text
  },
});
