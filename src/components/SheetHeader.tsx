import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
}

export default function SheetHeader({
  title,
  onClose,
  closeLabel,
  leftAction,
  rightAction,
  icon,
}: SheetHeaderProps) {
  const handleClose = () => {
    Haptics.selectionAsync();
    onClose?.();
  };

  return (
    <View style={styles.header}>
      {/* Left side button/action */}
      <View style={styles.sideContainer}>
        {leftAction ? (
          leftAction
        ) : onClose && closeLabel ? (
          <TouchableOpacity onPress={handleClose} style={styles.textBtn}>
            <Text style={styles.cancelText}>{closeLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Center title area */}
      <View style={styles.titleContainer}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* Right side button/action */}
      <View style={[styles.sideContainer, styles.rightSide]}>
        {rightAction ? (
          rightAction
        ) : onClose && !closeLabel ? (
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <X size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
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
    height: 56,
  },
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
  },
  iconContainer: {
    marginRight: 8,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
  },
  closeBtn: {
    backgroundColor: '#1c1c1e',
    padding: 6,
    borderRadius: 99,
  },
  textBtn: {
    paddingVertical: 4,
  },
  cancelText: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    color: theme.colors.accentRed,
  },
});
