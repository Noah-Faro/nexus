import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';
import { Terminal, Command } from 'lucide-react-native';
import { theme } from '../theme';

interface ConsoleHelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ConsoleHelpModal({ visible, onClose }: ConsoleHelpModalProps) {
  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Obsidian Tab Header Layout */}
          <View style={styles.header}>
            <Terminal size={14} color={theme.colors.accentAmber} />
            <Text style={styles.headerText}>[[console-help.md]]</Text>
          </View>

          {/* YAML/Markdown Body */}
          <View style={styles.body}>
            <Text style={styles.yamlDivider}>---</Text>
            
            <View style={styles.titleContainer}>
              <Command size={18} color={theme.colors.accent} />
              <Text style={styles.titleText}># CONSOLE SHORTCUTS</Text>
            </View>
            
            <View style={styles.yamlBlock}>
              <View style={styles.yamlRow}>
                <Text style={styles.yamlKey}>• /goal </Text>
                <Text style={styles.yamlType}>&lt;ml&gt;</Text>
                <Text style={styles.yamlDesc}> - Overrides & locks intake target</Text>
              </View>
              <View style={styles.yamlRow}>
                <Text style={styles.yamlKey}>• /weight </Text>
                <Text style={styles.yamlType}>&lt;num&gt;</Text>
                <Text style={styles.yamlDesc}> - Adjusts profile body weight</Text>
              </View>
              <View style={styles.yamlRow}>
                <Text style={styles.yamlKey}>• /clear</Text>
                <Text style={styles.yamlDesc}> - Clears all logged entries for today</Text>
              </View>
              <View style={styles.yamlRow}>
                <Text style={styles.yamlKey}>• /reset</Text>
                <Text style={styles.yamlDesc}> - Permanent database factory wipe</Text>
              </View>
            </View>

            <Text style={styles.yamlDivider}>---</Text>

            {/* Obsidian Markdown Link Style Button */}
            <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.dismissBtnText}>[Dismiss Console Help]</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#050505',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  headerText: {
    fontFamily: theme.typography.mono,
    fontSize: 11,
    color: theme.colors.text,
  },
  body: {
    padding: theme.spacing.lg,
    alignItems: 'stretch',
    gap: theme.spacing.sm,
  },
  yamlDivider: {
    fontFamily: theme.typography.mono,
    color: theme.colors.accent,
    letterSpacing: 2,
    fontSize: 14,
    textAlign: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: theme.spacing.xs,
  },
  titleText: {
    fontFamily: theme.typography.mono,
    fontSize: 14,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
  },
  yamlBlock: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    gap: 10,
  },
  yamlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  yamlKey: {
    fontFamily: theme.typography.mono,
    color: theme.colors.accentAmber,
    fontSize: 11,
    fontWeight: 'bold',
  },
  yamlType: {
    fontFamily: theme.typography.mono,
    color: theme.colors.accentGreen,
    fontSize: 11,
  },
  yamlDesc: {
    fontFamily: theme.typography.mono,
    color: theme.colors.textMuted,
    fontSize: 10.5,
  },
  dismissBtn: {
    marginTop: theme.spacing.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissBtnText: {
    fontFamily: theme.typography.mono,
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: theme.typography.weight.bold,
  },
});
