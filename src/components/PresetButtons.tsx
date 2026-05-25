import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Keyboard, Animated, PanResponder, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { LiquidType, LIQUID_CONFIGS, UserSettings, LiquidConfig } from '../types';

interface PresetButtonsProps {
  selectedType: LiquidType;
  onSelectType: (type: LiquidType) => void;
  onQuickLog: (amount: number, isDecaf?: boolean) => void;
  isExpanded: boolean;
  onSetExpanded: (expanded: boolean) => void;
  settings: UserSettings;
  onOpenBrewLab: () => void;
  onDeleteCustomLiquid: (tag: string) => void;
  decafPrefs: Record<string, boolean>;
  onUpdateDecafPrefs: (prefs: Record<string, boolean>) => void;
}

export default function PresetButtons({ 
  selectedType, 
  onSelectType, 
  onQuickLog,
  isExpanded,
  onSetExpanded,
  settings,
  onOpenBrewLab,
  onDeleteCustomLiquid,
  decafPrefs,
  onUpdateDecafPrefs
}: PresetButtonsProps) {
  const currentDecaf = decafPrefs[selectedType] || false;

  const MIN_HEIGHT = 45;
  const MAX_HEIGHT = 430;
  
  const animatedHeight = useRef(new Animated.Value(isExpanded ? MAX_HEIGHT : MIN_HEIGHT)).current;
  const currentHeight = useRef(isExpanded ? MAX_HEIGHT : MIN_HEIGHT);
  const startHeightRef = useRef(isExpanded ? MAX_HEIGHT : MIN_HEIGHT);
  const localExpandedRef = useRef(isExpanded);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    animatedHeight.addListener(({ value }) => {
      currentHeight.current = value;
    });
    return () => {
      animatedHeight.removeAllListeners();
    };
  }, [animatedHeight]);

  useEffect(() => {
    localExpandedRef.current = isExpanded;
    if (!isDraggingRef.current) {
      Animated.spring(animatedHeight, {
        toValue: isExpanded ? MAX_HEIGHT : MIN_HEIGHT,
        useNativeDriver: false,
        bounciness: 4,
      }).start();
    }
  }, [isExpanded, animatedHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        animatedHeight.stopAnimation();
        startHeightRef.current = currentHeight.current;
      },
      onPanResponderMove: (_, gestureState) => {
        let newHeight = startHeightRef.current - gestureState.dy;
        if (newHeight > MAX_HEIGHT + 20) newHeight = MAX_HEIGHT + 20; // slight overscroll resistance
        if (newHeight < MIN_HEIGHT) newHeight = MIN_HEIGHT;
        animatedHeight.setValue(newHeight);

        // Real-time threshold check
        const middlePoint = (MAX_HEIGHT + MIN_HEIGHT) / 2;
        const newExpanded = newHeight > middlePoint;
        if (newExpanded !== localExpandedRef.current) {
          localExpandedRef.current = newExpanded;
          Haptics.selectionAsync();
          onSetExpanded(newExpanded);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        isDraggingRef.current = false;
        const finalHeight = startHeightRef.current - gestureState.dy;
        const middlePoint = (MAX_HEIGHT + MIN_HEIGHT) / 2;

        const isFlickDown = gestureState.vy > 0.5;
        const isFlickUp = gestureState.vy < -0.5;

        let shouldBeExpanded = localExpandedRef.current;
        if (isFlickUp) {
          shouldBeExpanded = true;
        } else if (isFlickDown) {
          shouldBeExpanded = false;
        } else {
          shouldBeExpanded = finalHeight > middlePoint;
        }

        if (!shouldBeExpanded) {
          Keyboard.dismiss();
        }
        Haptics.selectionAsync();
        onSetExpanded(shouldBeExpanded);

        Animated.spring(animatedHeight, { 
          toValue: shouldBeExpanded ? MAX_HEIGHT : MIN_HEIGHT, 
          useNativeDriver: false, 
          bounciness: 4 
        }).start();
      },
      onPanResponderTerminate: (_, gestureState) => {
        isDraggingRef.current = false;
        const finalHeight = startHeightRef.current - gestureState.dy;
        const middlePoint = (MAX_HEIGHT + MIN_HEIGHT) / 2;

        const isFlickDown = gestureState.vy > 0.5;
        const isFlickUp = gestureState.vy < -0.5;

        let shouldBeExpanded = localExpandedRef.current;
        if (isFlickUp) {
          shouldBeExpanded = true;
        } else if (isFlickDown) {
          shouldBeExpanded = false;
        } else {
          shouldBeExpanded = finalHeight > middlePoint;
        }

        if (!shouldBeExpanded) {
          Keyboard.dismiss();
        }
        Haptics.selectionAsync();
        onSetExpanded(shouldBeExpanded);

        Animated.spring(animatedHeight, { 
          toValue: shouldBeExpanded ? MAX_HEIGHT : MIN_HEIGHT, 
          useNativeDriver: false, 
          bounciness: 4 
        }).start();
      }
    })
  ).current;

  const handleSelect = (type: LiquidType) => {
    Haptics.selectionAsync(); 
    onSelectType(type);
  };

  const handleToggle = () => {
    Keyboard.dismiss(); 
    Haptics.selectionAsync(); 
    onSetExpanded(!isExpanded);
  };

  return (
    <Animated.View style={[styles.container, { height: animatedHeight }]}>
      {/* iOS style Drag Handle */}
      <View {...panResponder.panHandlers} style={styles.handleContainer}>
        <TouchableOpacity 
          style={styles.handleArea} 
          onPress={handleToggle}
          activeOpacity={0.7}
        >
          <View style={styles.dragHandle} />
          <Text style={styles.handleText}>{isExpanded ? 'Swipe down to collapse' : 'Swipe up to expand'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.consoleScrollBody} 
        contentContainerStyle={styles.consoleBody}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Beverage</Text>
        
        {/* Beverage Grid */}
        <View style={styles.grid}>
          {(() => {
            const standardTypes = Object.keys(LIQUID_CONFIGS) as LiquidType[];
            const customConfigs = settings.customLiquids || {};
            const customTypes = Object.keys(customConfigs);
            
            const handleSelect = (type: string) => {
              Haptics.selectionAsync(); 
              onSelectType(type);
            };

            const renderCard = (type: string, config: LiquidConfig, isCustom: boolean) => {
              const isSelected = selectedType === type;
              
              // Dynamic label based on decaf selection
              const cardIsDecaf = decafPrefs[type] || false;
              let displayLabel = config.label;
              if (cardIsDecaf) {
                if (type === 'tea') displayLabel = 'Decaf Tea';
                else if (type === 'coffee') displayLabel = 'Decaf Coffee';
              }

              // Dynamic badge logic: hide caffeine badge if it's currently decaf
              const showBadge = config.caffeineMg && !cardIsDecaf;
              
              const handleLongPress = () => {
                if (!isCustom) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                Alert.alert(
                  'Delete Custom Formula',
                  `Remove "${config.label}" from your deck?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Delete', 
                      style: 'destructive',
                      onPress: () => {
                        onDeleteCustomLiquid(type);
                        if (selectedType === type) {
                          onSelectType('water');
                        }
                      }
                    }
                  ]
                );
              };

              return (
                <TouchableOpacity
                  key={type}
                  activeOpacity={0.7}
                  style={[
                    styles.card,
                    isSelected && styles.cardActive,
                    isSelected && { borderColor: config.color, backgroundColor: config.color + '10' }
                  ]}
                  onPress={() => handleSelect(type)}
                  onLongPress={handleLongPress}
                  delayLongPress={600}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.colorDot, { backgroundColor: config.color }]} />
                    <Text style={styles.cardMultiplier}>
                      {config.multiplier > 0 ? `+${config.multiplier.toFixed(2)}x` : `${config.multiplier.toFixed(2)}x`}
                    </Text>
                  </View>
                  <View style={styles.labelRow}>
                    <Text style={styles.cardLabel} numberOfLines={1}>{displayLabel}</Text>
                    {showBadge ? (
                      <Text style={styles.caffBadge}>{config.caffeineMg}mg</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            };

            return [
              ...standardTypes.map(t => renderCard(t, LIQUID_CONFIGS[t], false)),
              ...customTypes.map(t => renderCard(t, customConfigs[t], true)),
              <TouchableOpacity
                key="add-custom"
                activeOpacity={0.7}
                style={[styles.card, styles.cardAddCustom]}
                onPress={onOpenBrewLab}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.addCustomPlus}>+</Text>
                </View>
                <Text style={styles.cardLabelAddCustom}>Synthesize</Text>
              </TouchableOpacity>
            ];
          })()}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Quick Log</Text>
          {(selectedType === 'coffee' || selectedType === 'tea') && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                Haptics.selectionAsync();
                onUpdateDecafPrefs({
                  ...decafPrefs,
                  [selectedType]: !currentDecaf
                });
              }}
              style={[
                styles.decafToggleBtn,
                currentDecaf ? styles.decafActiveBtn : styles.caffeineActiveBtn
              ]}
            >
              <Text style={[
                styles.decafToggleText,
                currentDecaf ? styles.decafActiveText : styles.caffeineActiveText
              ]}>
                {currentDecaf ? 'Decaf ON' : 'Caffeine ON'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.sizeRow}>
          {(() => {
            const config = LIQUID_CONFIGS[selectedType as LiquidType] || settings.customLiquids?.[selectedType] || LIQUID_CONFIGS['water'];
            return config.presets.map((size) => {
              const effectiveSize = Math.round(size * config.multiplier);
              const isStandard = size === config.standardPreset;
              
              return (
                <TouchableOpacity
                  key={size}
                  activeOpacity={0.7}
                  style={[
                    styles.sizeBtn,
                    isStandard && {
                      backgroundColor: config.color,
                      borderColor: config.color,
                    }
                  ]}
                  onPress={() => onQuickLog(size, currentDecaf)}
                >
                  <Text style={[
                    styles.sizeText,
                    isStandard && { color: '#ffffff', fontWeight: 'bold' }
                  ]}>{size}ml</Text>
                  <Text style={[
                    styles.effectiveText,
                    isStandard && { color: 'rgba(255,255,255,0.8)' }
                  ]}>{effectiveSize}ml net</Text>
                </TouchableOpacity>
              );
            });
          })()}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md, 
    marginVertical: 0,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  handleArea: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  handleText: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  consoleScrollBody: {
    flex: 1,
  },
  consoleBody: {
    paddingBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontFamily: theme.typography.sans,
    fontSize: 15,
    fontWeight: theme.typography.weight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: theme.spacing.lg,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  cardActive: {
    borderColor: theme.colors.accent,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cardMultiplier: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cardLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.medium,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sizeBtn: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeText: {
    fontFamily: theme.typography.sans,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.semibold,
  },
  effectiveText: {
    fontFamily: theme.typography.sans,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  cardAddCustom: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  addCustomPlus: {
    fontSize: 20,
    color: theme.colors.textMuted,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  cardLabelAddCustom: {
    fontFamily: theme.typography.sans,
    fontSize: 15,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weight.semibold,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  caffBadge: {
    fontFamily: theme.typography.sans,
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
    color: '#ff9f0a',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 4,
    width: '100%',
  },
  decafToggleBtn: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decafActiveBtn: {
    backgroundColor: 'rgba(50, 215, 75, 0.1)',
    borderColor: '#32d74b',
  },
  decafActiveText: {
    color: '#32d74b',
  },
  caffeineActiveBtn: {
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
    borderColor: '#ff9f0a',
  },
  caffeineActiveText: {
    color: '#ff9f0a',
  },
  decafToggleText: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weight.semibold,
  },
});
