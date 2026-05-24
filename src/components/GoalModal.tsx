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
          {/* Obsidian Tab Header Layout */}
          <View style={styles.header}>
            <Award size={16} color={theme.colors.accent} />
            <Text style={styles.headerText}>[[goal-achieved.md]]</Text>
          </View>

          {/* YAML Frontmatter Alert */}
          <View style={styles.body}>
            <Text style={styles.yamlDivider}>---</Text>
            
            <View style={styles.badgeContainer}>
              <View style={styles.circle}>
                <Check size={28} color="#000000" />
              </View>
            </View>

            <Text style={styles.titleText}># TARGET ATTAINED</Text>
            
            <View style={styles.yamlBlock}>
              <View style={styles.yamlRow}>
                <Text style={styles.yamlKey}>status: </Text>
                <Text style={styles.yamlVal}>#completed</Text>
              </View>
              <View style={styles.yamlRow}>
                <Text style={styles.yamlKey}>intake_net: </Text>
                <Text style={styles.yamlVal}>{effectiveIntake} ml</Text>
              </View>
              <View style={styles.yamlRow}>
                <Text style={styles.yamlKey}>hydration_rate: </Text>
                <Text style={styles.yamlVal}>100%+</Text>
              </View>
              <View style={styles.yamlRow}>
                <Text style={styles.yamlKey}>message: </Text>
                <Text style={styles.yamlVal}>"Dynamic target successfully achieved."</Text>
              </View>
            </View>

            <Text style={styles.yamlDivider}>---</Text>

            {/* Obsidian Markdown Link Style Button */}
            <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.dismissBtnText}>[Dismiss and Return]</Text>
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
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  yamlDivider: {
    fontFamily: theme.typography.mono,
    color: theme.colors.accent,
    letterSpacing: 2,
    fontSize: 14,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  badgeContainer: {
    marginVertical: theme.spacing.sm,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  titleText: {
    fontFamily: theme.typography.mono,
    fontSize: 16,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  yamlBlock: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    alignSelf: 'stretch',
    gap: 4,
  },
  yamlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  yamlKey: {
    fontFamily: theme.typography.mono,
    color: theme.colors.accentAmber,
    fontSize: 11,
  },
  yamlVal: {
    fontFamily: theme.typography.mono,
    color: theme.colors.text,
    fontSize: 11,
  },
  dismissBtn: {
    marginTop: theme.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
  },
  dismissBtnText: {
    fontFamily: theme.typography.mono,
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: theme.typography.weight.bold,
  },
});
