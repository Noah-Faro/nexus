import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import { theme } from '../theme';

export interface AppAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AppAlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: AppAlertButton[];
  onClose: () => void;
}

export default function AppAlertModal({ visible, title, message, buttons, onClose }: AppAlertModalProps) {
  // Safe handler when button clicked
  const handlePress = (btn: AppAlertButton) => {
    onClose();
    if (btn.onPress) {
      // Small timeout to allow Modal fade dismiss to complete smoothly on iOS
      setTimeout(() => {
        btn.onPress?.();
      }, 100);
    }
  };

  const activeButtons = buttons && buttons.length > 0 
    ? buttons 
    : [{ text: 'OK', style: 'default' as const }];

  const isRowLayout = activeButtons.length <= 2;

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Tab Header Layout */}
          <View style={styles.header}>
            <ShieldAlert size={14} color={theme.colors.accentAmber} />
            <Text style={styles.headerText}>[[system-notification.md]]</Text>
          </View>

          {/* Alert Body */}
          <View style={styles.body}>
            <Text style={styles.yamlDivider}>---</Text>
            
            <Text style={styles.titleText}># {title.toUpperCase()}</Text>
            
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{message}</Text>
            </View>

            <Text style={styles.yamlDivider}>---</Text>

            {/* Buttons Row / Column */}
            <View style={isRowLayout ? styles.rowButtons : styles.colButtons}>
              {activeButtons.map((btn, index) => {
                let btnStyle = styles.defaultBtnText;
                if (btn.style === 'destructive') btnStyle = styles.destructiveBtnText;
                if (btn.style === 'cancel') btnStyle = styles.cancelBtnText;

                return (
                  <TouchableOpacity 
                    key={index} 
                    style={[
                      isRowLayout ? styles.rowBtn : styles.colBtn,
                      index > 0 && isRowLayout && { borderLeftWidth: 1, borderLeftColor: theme.colors.borderMuted },
                      index > 0 && !isRowLayout && { borderTopWidth: 1, borderTopColor: theme.colors.borderMuted }
                    ]} 
                    onPress={() => handlePress(btn)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.btnText, btnStyle]}>
                      {btn.style === 'cancel' ? `[${btn.text}]` : `[[${btn.text}]]`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
  titleText: {
    fontFamily: theme.typography.mono,
    fontSize: 13,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.accentAmber,
    textAlign: 'center',
    marginVertical: theme.spacing.xs,
  },
  messageBox: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
  },
  messageText: {
    fontFamily: theme.typography.mono,
    color: theme.colors.text,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  rowButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: theme.spacing.xs,
  },
  colButtons: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginTop: theme.spacing.xs,
  },
  rowBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  colBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: theme.typography.mono,
    fontSize: 12,
    fontWeight: theme.typography.weight.bold,
  },
  defaultBtnText: {
    color: theme.colors.accent,
  },
  destructiveBtnText: {
    color: theme.colors.accentRed,
  },
  cancelBtnText: {
    color: theme.colors.textMuted,
  },
});
