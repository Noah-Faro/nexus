import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { theme } from '../theme';
import * as Haptics from 'expo-haptics';

interface SheetHeaderProps {
  title: string;
  onClose?: () => void;
  closeLabel?: string; // Optional text like "Cancel" instead of an 'X' icon
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  icon?: React.ReactNode;
  /** Keeps the title beside the close action for dense, responsive sheets. */
  leading?: boolean;
  /** Allows a title to wrap when Dynamic Type or a narrow sheet needs it. */
  twoLine?: boolean;
}

export default function SheetHeader({
  title,
  onClose,
  closeLabel,
  leftAction,
  rightAction,
  icon,
  leading = false,
  twoLine = false,
}: SheetHeaderProps) {
  const handleClose = () => {
    Haptics.selectionAsync();
    onClose?.();
  };

  return (
    <View style={[styles.header, twoLine && styles.headerTwoLine]}>
      {/* Left side button/action */}
      <View style={[styles.sideContainer, leading && styles.leadingSideContainer]}>
        {leftAction ? (
          leftAction
        ) : onClose && closeLabel ? (
          <Pressable onPress={handleClose} style={styles.textBtn} accessibilityRole="button">
            <Text style={styles.cancelText}>{closeLabel}</Text>
          </Pressable>
        ) : onClose && !closeLabel ? (
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={20} color={theme.colors.text} />
          </Pressable>
        ) : null}
      </View>

      {/* Center title area */}
      <View style={[styles.titleContainer, leading && styles.titleContainerLeading]}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={[styles.title, leading && styles.titleLeading]} numberOfLines={twoLine ? 2 : 1}>
          {title}
        </Text>
      </View>

      {/* Right side button/action */}
      <View style={[
        styles.sideContainer,
        styles.rightSide,
        leading && !rightAction && styles.leadingRightSide,
      ]}>
        {rightAction ? (
          rightAction
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    minHeight: 56,
  },
  headerTwoLine: { minHeight: 64 },
  sideContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightSide: {
    justifyContent: 'flex-end',
  },
  titleContainer: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  titleContainerLeading: { flex: 1, justifyContent: 'flex-start' },
  leadingSideContainer: { flex: 0 },
  leadingRightSide: { flex: 0, width: 0 },
  iconContainer: {
    marginRight: 8,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    flexShrink: 1,
  },
  titleLeading: { textAlign: 'left' },
  closeBtn: {
    backgroundColor: theme.colors.surfaceElevated,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  textBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cancelText: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    color: theme.colors.accentRed,
  },
  pressed: { opacity: 0.72 },
});
