import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { theme } from '../theme';
import { LiquidType, LIQUID_CONFIGS } from '../types';

interface PresetButtonsProps {
  selectedType: LiquidType;
  onSelectType: (type: LiquidType) => void;
  onQuickLog: (amount: number) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const PRESET_SIZES = [250, 330, 500, 650]; // 750ml changed to 650ml

export default function PresetButtons({ 
  selectedType, 
  onSelectType, 
  onQuickLog,
  isExpanded,
  onToggleExpand
}: PresetButtonsProps) {

  const touchStartY = React.useRef(0);

  const handleSelect = (type: LiquidType) => {
    Haptics.selectionAsync(); // Tactile haptic feedback when changing drink type
    onSelectType(type);
  };

  const handleToggle = () => {
    Keyboard.dismiss(); // Closes soft keyboard instantly on console toggle
    Haptics.selectionAsync(); // Tactile haptic feedback when toggling panel
    onToggleExpand();
  };

  const handleTouchStart = (e: any) => {
    touchStartY.current = e.nativeEvent.pageY;
  };

  const handleTouchEnd = (e: any) => {
    const touchEndY = e.nativeEvent.pageY;
    const dy = touchEndY - touchStartY.current;

    // Detect swipe gestures on handle
    if (dy > 30) {
      if (isExpanded) {
        Keyboard.dismiss();
        Haptics.selectionAsync();
        onToggleExpand(); // Close
      }
    } else if (dy < -30) {
      if (!isExpanded) {
        Haptics.selectionAsync();
        onToggleExpand(); // Open
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Markdown Obsidian Divider / Pane Collapser (Tap + Swipe Gestures) */}
      <View onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <TouchableOpacity 
          style={styles.collapseHandle} 
          onPress={handleToggle}
          activeOpacity={0.7}
        >
          <Text style={styles.collapseHandleText}>
            {isExpanded ? '--- swipe-down-to-collapse ---' : '--- swipe-up-to-expand ---'}
          </Text>
          {isExpanded ? (
            <ChevronDown size={12} color={theme.colors.accent} />
          ) : (
            <ChevronUp size={12} color={theme.colors.accent} />
          )}
        </TouchableOpacity>
      </View>

      {isExpanded && (
        <ScrollView 
          style={styles.consoleScrollBody} 
          contentContainerStyle={styles.consoleBody}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
        >
          <Text style={styles.sectionTitle}># select-liquid-type</Text>
          
          {/* Beverage Tag Grid */}
          <View style={styles.grid}>
            {(Object.keys(LIQUID_CONFIGS) as LiquidType[]).map((type) => {
              const config = LIQUID_CONFIGS[type];
              const isSelected = selectedType === type;
              
              return (
                <TouchableOpacity
                  key={type}
                  activeOpacity={0.7}
                  style={[
                    styles.card,
                    isSelected && styles.cardActive,
                    isSelected && { borderColor: config.color }
                  ]}
                  onPress={() => handleSelect(type)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTag, { color: config.color }]}>{config.tag}</Text>
                    <Text style={styles.cardMultiplier}>{config.multiplier}x</Text>
                  </View>
                  <Text style={styles.cardLabel}>{config.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Preset Volume loggers */}
          <Text style={styles.sectionTitle}># container-preset</Text>
          <View style={styles.sizeRow}>
            {PRESET_SIZES.map((size) => {
              const config = LIQUID_CONFIGS[selectedType];
              const effectiveSize = Math.round(size * config.multiplier);
              
              return (
                <TouchableOpacity
                  key={size}
                  activeOpacity={0.7}
                  style={styles.sizeBtn}
                  onPress={() => onQuickLog(size)}
                >
                  <Text style={styles.sizeText}>{size}ml</Text>
                  <Text style={styles.effectiveText}>({effectiveSize}ml net)</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.sm, // reduced padding to widen the selection window
    marginVertical: theme.spacing.xs,
  },
  collapseHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  collapseHandleText: {
    fontFamily: theme.typography.mono,
    fontSize: 10,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  consoleScrollBody: {
    maxHeight: 230, // Restrain the expanded height so it remains compact and scrollable
  },
  consoleBody: {
    marginTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: theme.typography.mono,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
  },
  cardActive: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTag: {
    fontFamily: theme.typography.mono,
    fontSize: 12,
    fontWeight: theme.typography.weight.semibold,
  },
  cardMultiplier: {
    fontFamily: theme.typography.mono,
    fontSize: 10,
    color: theme.colors.textMuted,
    backgroundColor: '#161616',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  cardLabel: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.medium,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  sizeBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeText: {
    fontFamily: theme.typography.mono,
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.semibold,
  },
  effectiveText: {
    fontFamily: theme.typography.mono,
    fontSize: 9,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
