import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Keyboard, Animated, PanResponder } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { LiquidType, LIQUID_CONFIGS } from '../types';

interface PresetButtonsProps {
  selectedType: LiquidType;
  onSelectType: (type: LiquidType) => void;
  onQuickLog: (amount: number) => void;
  isExpanded: boolean;
  onSetExpanded: (expanded: boolean) => void;
}

export default function PresetButtons({ 
  selectedType, 
  onSelectType, 
  onQuickLog,
  isExpanded,
  onSetExpanded
}: PresetButtonsProps) {

  const MIN_HEIGHT = 45;
  const MAX_HEIGHT = 380;
  
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
                  isSelected && { borderColor: config.color, backgroundColor: config.color + '10' }
                ]}
                onPress={() => handleSelect(type)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.colorDot, { backgroundColor: config.color }]} />
                  <Text style={styles.cardMultiplier}>{config.multiplier}x</Text>
                </View>
                <Text style={styles.cardLabel}>{config.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Quick Log</Text>
        <View style={styles.sizeRow}>
          {(() => {
            const config = LIQUID_CONFIGS[selectedType];
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
                  onPress={() => onQuickLog(size)}
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
});
