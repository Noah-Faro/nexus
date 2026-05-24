import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';
import { Terminal, X } from 'lucide-react-native';
import { theme } from '../theme';

interface ConsoleHelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ConsoleHelpModal({ visible, onClose }: ConsoleHelpModalProps) {
  const shortcuts = [
    { cmd: '/goal <ml>', desc: 'Overrides & locks intake target' },
    { cmd: '/weight <num>', desc: 'Adjusts profile body weight' },
    { cmd: '/clear', desc: 'Clears all logged entries for today' },
    { cmd: '/reset', desc: 'Permanent database factory wipe' },
  ];

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Shortcuts</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <View style={styles.closeIconBg}>
                <X size={20} color={theme.colors.text} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.card}>
              {shortcuts.map((shortcut, index) => (
                <View key={index}>
                  <View style={styles.row}>
                    <Text style={styles.cmdText}>{shortcut.cmd}</Text>
                    <Text style={styles.descText}>{shortcut.desc}</Text>
                  </View>
                  {index < shortcuts.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
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
  body: {
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  row: {
    padding: theme.spacing.md,
    gap: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md,
  },
  cmdText: {
    fontFamily: theme.typography.mono,
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  descText: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
});
