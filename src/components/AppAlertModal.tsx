import React from 'react';
import { StyleSheet, Text, View, Modal, Pressable, StyleProp, TextStyle } from 'react-native';
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
  const handlePress = (btn: AppAlertButton) => {
    onClose();
    if (btn.onPress) {
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
          <View style={styles.body}>
            <Text style={styles.titleText}>{title}</Text>
            <Text style={styles.messageText}>{message}</Text>
          </View>

          <View style={isRowLayout ? styles.rowButtons : styles.colButtons}>
            {activeButtons.map((btn, index) => {
              let btnStyle: StyleProp<TextStyle> = styles.defaultBtnText;
              if (btn.style === 'destructive') btnStyle = styles.destructiveBtnText;
              if (btn.style === 'cancel') btnStyle = styles.cancelBtnText;

              return (
                <Pressable 
                  key={index} 
                  style={({ pressed }) => [
                    styles.btn,
                    isRowLayout ? styles.rowBtn : styles.colBtn,
                    index > 0 && isRowLayout && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border },
                    index > 0 && !isRowLayout && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
                    pressed && { opacity: 0.7 }
                  ]} 
                  onPress={() => handlePress(btn)}
                >
                  <Text style={[styles.btnText, btnStyle]}>
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  container: {
    width: 270,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 14,
    overflow: 'hidden',
  },
  body: {
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  titleText: {
    fontFamily: theme.typography.bold,
    fontSize: 17,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  messageText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  rowButtons: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  colButtons: {
    flexDirection: 'column',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  btn: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBtn: {
    flex: 1,
    height: 44,
  },
  colBtn: {
    width: '100%',
    height: 44,
  },
  btnText: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
  },
  defaultBtnText: {
    color: theme.colors.accent,
    fontFamily: theme.typography.semibold,
  },
  destructiveBtnText: {
    color: theme.colors.accentRed,
  },
  cancelBtnText: {
    color: theme.colors.accent,
  },
});
