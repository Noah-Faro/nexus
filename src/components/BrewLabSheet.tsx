import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  Animated, 
  Dimensions, 
  PanResponder, 
  Keyboard, 
  TouchableWithoutFeedback,
  ScrollView
} from 'react-native';
import { X, Sparkles, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { LiquidConfig, LiquidType } from '../types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface BrewLabSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: LiquidConfig) => void;
}

const PRESET_COLORS = [
  '#0a84ff', // iOS Blue
  '#32d74b', // iOS Green
  '#ff9f0a', // iOS Orange
  '#ff453a', // iOS Red
  '#bf5af2', // iOS Purple
  '#ff375f', // iOS Pink
];

export default function BrewLabSheet({ visible, onClose, onSave }: BrewLabSheetProps) {
  const [name, setName] = useState('');
  const [multiplier, setMultiplier] = useState(1.0);
  const [standardPreset, setStandardPreset] = useState(250);
  const [caffeine, setCaffeine] = useState(0);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  
  // Animated Sheet Position
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset State on Open
      setName('');
      setMultiplier(1.0);
      setStandardPreset(250);
      setCaffeine(0);
      setSelectedColor(PRESET_COLORS[0]);

      // Animate Up
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0.5,
          duration: 350,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      onClose();
    });
  };

  const handleSave = () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const tag = `#${name.toLowerCase().trim().replace(/\s+/g, '-')}`;
    
    // Create base presets: [base/1.5, base, base*1.3, base*2] roughly or custom neat sizes
    const base = standardPreset;
    const presets = [
      Math.round(base * 0.6 / 10) * 10,
      base,
      Math.round(base * 1.3 / 10) * 10,
      Math.round(base * 2.0 / 10) * 10,
    ];

    const config: LiquidConfig = {
      tag,
      label: name.trim(),
      multiplier: Number(multiplier.toFixed(2)),
      color: selectedColor,
      standardPreset,
      presets,
      caffeineMg: caffeine > 0 ? caffeine : undefined
    };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(config);
    handleClose();
  };

  // Drag down gesture to close bottom sheet
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.8) {
          handleClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4
          }).start();
        }
      }
    })
  ).current;

  // Custom Slider Layout Constants (bypasses asynchronous .measure bugs inside Modal)
  const TRACK_PADDING = 10;
  const SLIDER_WIDTH = SCREEN_WIDTH - 48; // SCREEN_WIDTH minus 24 * 2 horizontal padding of sheetContent
  const ACTIVE_TRACK_WIDTH = SLIDER_WIDTH - 2 * TRACK_PADDING;

  const getMultPct = (val: number) => {
    if (val <= 1.0) {
      return ((val - (-1.0)) / 2.0) * 0.5;
    } else {
      return 0.5 + ((val - 1.0) / 0.5) * 0.5;
    }
  };

  const getMultValFromPct = (pct: number) => {
    if (pct <= 0.5) {
      const raw = -1.0 + (pct / 0.5) * 2.0;
      return Math.max(-1.0, Math.min(1.0, Math.round(raw / 0.1) * 0.1));
    } else {
      const raw = 1.0 + ((pct - 0.5) / 0.5) * 0.5;
      return Math.max(1.0, Math.min(1.5, Math.round(raw / 0.05) * 0.05));
    }
  };

  const getCaffPct = (val: number) => val / 300;

  // Custom PanResponders for Sliders
  const prevValMult = useRef(1.0);
  const multSliderPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false, // Prevents ScrollView vertical hijack
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.pageX - (24 + TRACK_PADDING);
        const pct = Math.max(0, Math.min(1, x / ACTIVE_TRACK_WIDTH));
        const val = getMultValFromPct(pct);
        setMultiplier(val);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.pageX - (24 + TRACK_PADDING);
        const pct = Math.max(0, Math.min(1, x / ACTIVE_TRACK_WIDTH));
        const val = getMultValFromPct(pct);
        
        if (Math.abs(val - prevValMult.current) >= 0.04) {
          Haptics.selectionAsync();
          prevValMult.current = val;
        }
        setMultiplier(val);
      }
    })
  ).current;

  const prevValCaff = useRef(0);
  const caffSliderPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false, // Prevents ScrollView vertical hijack
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.pageX - (24 + TRACK_PADDING);
        const pct = Math.max(0, Math.min(1, x / ACTIVE_TRACK_WIDTH));
        const raw = pct * 300;
        const rounded = Math.round(raw / 5) * 5;
        const clamped = Math.max(0, Math.min(300, rounded));
        setCaffeine(clamped);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.pageX - (24 + TRACK_PADDING);
        const pct = Math.max(0, Math.min(1, x / ACTIVE_TRACK_WIDTH));
        const raw = pct * 300;
        const rounded = Math.round(raw / 5) * 5;
        const clamped = Math.max(0, Math.min(300, rounded));
        
        if (Math.abs(clamped - prevValCaff.current) >= 4) {
          Haptics.selectionAsync();
          prevValCaff.current = clamped;
        }
        setCaffeine(clamped);
      }
    })
  ).current;

  const multPercentage = getMultPct(multiplier);
  const caffPercentage = getCaffPct(caffeine);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View 
        style={[styles.sheet, { transform: [{ translateY }] }]}
        pointerEvents="box-none"
      >
        <View style={styles.sheetContent}>
          {/* Drag Handle Area */}
          <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Sparkles size={20} color={selectedColor} style={styles.sparkle} />
              <Text style={styles.title}>Brew Lab</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
            keyboardDismissMode="on-drag"
          >
            {/* Input Name */}
            <Text style={styles.sectionTitle}>Drink Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Matcha Latte, Yerba Mate"
              placeholderTextColor={theme.colors.textSubtle}
              value={name}
              onChangeText={setName}
              maxLength={22}
              autoCorrect={false}
            />

            {/* Accent Color Selection */}
            <Text style={styles.sectionTitle}>Accent Color</Text>
            <View style={styles.colorRow}>
              {PRESET_COLORS.map(color => {
                const isSelected = selectedColor === color;
                return (
                  <TouchableOpacity
                    key={color}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedColor(color);
                    }}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: color },
                      isSelected && styles.colorCircleSelected
                    ]}
                  />
                );
              })}
            </View>

            {/* Hydration Multiplier Custom Slider */}
            <View style={styles.rowHeader}>
              <Text style={styles.sectionTitle}>Hydration Index</Text>
              <Text style={[styles.valueIndicator, { color: selectedColor }]}>
                {multiplier > 0 ? `+${multiplier.toFixed(2)}x` : `${multiplier.toFixed(2)}x`}
              </Text>
            </View>
            <Text style={styles.helpText}>
              Multiplier for effective fluid calculation. Wine is dehydrating (-0.4x), water is baseline (1.0x).
            </Text>

            <View 
              style={styles.sliderContainer}
              {...multSliderPan.panHandlers}
            >
              <View style={styles.sliderTrack} />
              <View style={[styles.sliderFill, { left: TRACK_PADDING, width: getMultPct(multiplier) * ACTIVE_TRACK_WIDTH, backgroundColor: selectedColor }]} />
              <View style={[styles.sliderThumb, { left: TRACK_PADDING + getMultPct(multiplier) * ACTIVE_TRACK_WIDTH, borderColor: selectedColor }]} />
            </View>
            <View style={styles.sliderLabelsRow}>
              <Text style={styles.sliderLabel}>Dehydrating (-1.0x)</Text>
              <Text style={styles.sliderLabel}>Water (1.0x)</Text>
              <Text style={styles.sliderLabel}>Isotonic (1.5x)</Text>
            </View>

            {/* Caffeine Level Custom Slider */}
            <View style={styles.rowHeader}>
              <Text style={styles.sectionTitle}>Caffeine Load</Text>
              <Text style={[styles.valueIndicator, { color: caffeine > 150 ? theme.colors.accentRed : '#ff9f0a' }]}>
                {caffeine} mg
              </Text>
            </View>
            <Text style={styles.helpText}>
              Caffeine content per standard serving cup. (Standard cup of coffee contains ~80mg).
            </Text>

            <View 
              style={styles.sliderContainer}
              {...caffSliderPan.panHandlers}
            >
              <View style={styles.sliderTrack} />
              <View style={[styles.sliderFill, { left: TRACK_PADDING, width: getCaffPct(caffeine) * ACTIVE_TRACK_WIDTH, backgroundColor: '#ff9f0a' }]} />
              <View style={[styles.sliderThumb, { left: TRACK_PADDING + getCaffPct(caffeine) * ACTIVE_TRACK_WIDTH, borderColor: '#ff9f0a' }]} />
            </View>
            <View style={styles.sliderLabelsRow}>
              <Text style={styles.sliderLabel}>0mg (None)</Text>
              <Text style={styles.sliderLabel}>150mg (Strong)</Text>
              <Text style={styles.sliderLabel}>300mg (Limit)</Text>
            </View>

            {caffeine > 150 && (
              <View style={styles.warningBox}>
                <AlertTriangle size={16} color={theme.colors.accentRed} style={styles.warningIcon} />
                <Text style={styles.warningText}>High caffeine load. Estimate clearance carefully to protect sleep.</Text>
              </View>
            )}

            {/* Base Standard Volume Preset selection */}
            <Text style={styles.sectionTitle}>Standard Serving Cup</Text>
            <View style={styles.volumeRow}>
              {[100, 250, 330, 500].map(vol => {
                const isSelected = standardPreset === vol;
                return (
                  <TouchableOpacity
                    key={vol}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setStandardPreset(vol);
                    }}
                    style={[
                      styles.volumeBtn,
                      isSelected && { backgroundColor: selectedColor, borderColor: selectedColor }
                    ]}
                  >
                    <Text style={[
                      styles.volumeText,
                      isSelected && styles.volumeTextSelected
                    ]}>{vol}ml</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              style={[
                styles.saveBtn,
                { backgroundColor: name.trim() ? theme.colors.text : theme.colors.surfaceElevated }
              ]}
              disabled={!name.trim()}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.saveBtnText,
                { color: name.trim() ? '#000000' : theme.colors.textSubtle }
              ]}>Synthesize Formula</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.86,
    justifyContent: 'flex-end',
  },
  sheetContent: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#1d1d1f',
    paddingHorizontal: theme.spacing.lg,
  },
  dragHandleArea: {
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  dragHandle: {
    width: 38,
    height: 4,
    backgroundColor: '#2c2c2e',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sparkle: {
    marginRight: 8,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 22,
    color: '#ffffff',
  },
  closeBtn: {
    backgroundColor: '#1c1c1e',
    padding: 6,
    borderRadius: 99,
  },
  scrollBody: {
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    fontWeight: theme.typography.weight.semibold,
    color: theme.colors.text,
    marginTop: 18,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: theme.typography.sans,
    backgroundColor: '#1c1c1e',
    borderRadius: theme.borderRadius.md,
    color: '#ffffff',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.15 }],
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 4,
  },
  valueIndicator: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
  },
  helpText: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
    marginBottom: 14,
  },
  sliderContainer: {
    height: 30,
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  sliderTrack: {
    height: 5,
    borderRadius: 2,
    backgroundColor: '#1c1c1e',
    position: 'absolute',
    left: 10,
    right: 10,
  },
  sliderFill: {
    height: 5,
    borderRadius: 2,
    position: 'absolute',
    top: 12.5,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 4,
    position: 'absolute',
    top: 5,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 4,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sliderLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 10,
    color: theme.colors.textSubtle,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  warningIcon: {
    marginRight: 8,
  },
  warningText: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.accentRed,
    flex: 1,
  },
  volumeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  volumeBtn: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeText: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weight.medium,
  },
  volumeTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  saveBtn: {
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
  },
});
