import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { theme } from '../theme';
import { UserSettings } from '../types';

interface ConsoleHelpModalProps {
  visible: boolean;
  onClose: () => void;
  settings: UserSettings;
}

export default function ConsoleHelpModal({ visible, onClose, settings }: ConsoleHelpModalProps) {
  const [viewMenu, setViewMenu] = useState(false);

  // Reset toggle when closed
  useEffect(() => {
    if (!visible) {
      setViewMenu(false);
    }
  }, [visible]);

  const shortcuts = [
    { cmd: '/goal <ml>', desc: 'Overrides & locks intake target' },
    { cmd: '/weight <num>', desc: 'Adjusts profile body weight' },
    { cmd: '/clear', desc: 'Clears all logged entries for today' },
    { cmd: '/reset', desc: 'Permanent database factory wipe' },
  ];

  const standardBeverages = [
    { key: 'water', label: 'Water' },
    { key: 'coffee', label: 'Coffee' },
    { key: 'tea', label: 'Tea' },
    { key: 'soda', label: 'Soda' },
    { key: 'juice', label: 'Juice' },
    { key: 'sports drink', label: 'Isotonic' },
    { key: 'beer', label: 'Beer' },
    { key: 'wine', label: 'Wine' },
  ];

  const customConfigs = settings?.customLiquids || {};
  const customBeverages = Object.keys(customConfigs).map(key => ({
    key: key.replace(/^#/, ''), // strip leading # in the tag/key
    label: customConfigs[key].label,
  }));

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{viewMenu ? 'Supported Drinks' : 'Shortcuts'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <View style={styles.closeIconBg}>
                <X size={20} color={theme.colors.text} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {viewMenu ? (
              <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={true}>
                <Text style={styles.menuIntro}>
                  Select presets in the grid, or type a custom amount (e.g. 250) directly in the console input to log.
                </Text>
                
                <Text style={styles.menuSectionTitle}>Standard Beverages</Text>
                <View style={styles.menuGrid}>
                  {standardBeverages.map(item => (
                    <View key={item.key} style={styles.menuItem}>
                      <Text style={styles.menuItemKey}>{item.key}</Text>
                      <Text style={styles.menuItemLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>

                {customBeverages.length > 0 && (
                  <>
                    <Text style={styles.menuSectionTitle}>Your Synthesized Formulas</Text>
                    <View style={styles.menuGrid}>
                      {customBeverages.map(item => (
                        <View key={item.key} style={styles.menuItem}>
                          <Text style={styles.menuItemKey}>{item.key}</Text>
                          <Text style={styles.menuItemLabel} numberOfLines={1}>{item.label}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </ScrollView>
            ) : (
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
            )}

            <TouchableOpacity 
              style={styles.toggleButton} 
              onPress={() => setViewMenu(!viewMenu)}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleButtonText}>
                {viewMenu ? 'Show Command Shortcuts' : 'View Supported Drinks'}
              </Text>
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
  menuScroll: {
    maxHeight: 280,
    marginBottom: theme.spacing.md,
  },
  menuIntro: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  menuSectionTitle: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  menuItem: {
    width: '48%',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  menuItemKey: {
    fontFamily: theme.typography.mono,
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.colors.accent,
    marginBottom: 2,
  },
  menuItemLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  toggleButton: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 20,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toggleButtonText: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    fontWeight: theme.typography.weight.semibold,
    color: theme.colors.text,
  },
});
