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
import { X, Sparkles, AlertTriangle, Palette } from 'lucide-react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { LiquidConfig, LiquidType } from '../types';
import SheetHeader from './SheetHeader';

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
  const [selectedPresets, setSelectedPresets] = useState<number[]>([250]);
  const [caffeineIsFixed, setCaffeineIsFixed] = useState(false);
  const [caffeine, setCaffeine] = useState(0);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  
  // Animated Sheet Position
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset State on Open
      setName('');
      setMultiplier(1.0);
      setSelectedPresets([250]);
      setCaffeineIsFixed(false);
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
    
    const sortedPresets = [...selectedPresets].sort((a, b) => a - b);
    const finalStandard = sortedPresets.length > 0 ? sortedPresets[0] : 250;

    const config: LiquidConfig = {
      tag,
      label: name.trim(),
      multiplier: Number(multiplier.toFixed(2)),
      color: selectedColor,
      standardPreset: finalStandard,
      presets: sortedPresets.length > 0 ? sortedPresets : [250],
      caffeineMg: caffeine > 0 ? caffeine : undefined,
      caffeineIsFixed: caffeine > 0 ? caffeineIsFixed : undefined
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
        setIsSliding(true);
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
      },
      onPanResponderRelease: () => setIsSliding(false),
      onPanResponderTerminate: () => setIsSliding(false),
    })
  ).current;

  const prevValCaff = useRef(0);
  const caffSliderPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false, // Prevents ScrollView vertical hijack
      onPanResponderGrant: (evt) => {
        setIsSliding(true);
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
      },
      onPanResponderRelease: () => setIsSliding(false),
      onPanResponderTerminate: () => setIsSliding(false),
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
          <SheetHeader
            title="Brew Lab"
            onClose={handleClose}
            icon={<Sparkles size={20} color={selectedColor} />}
          />

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
            keyboardDismissMode="on-drag"
            scrollEnabled={!isSliding}
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
                      setShowColorPicker(false);
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
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowColorPicker(!showColorPicker);
                }}
                style={[
                  styles.colorCircle,
                  { backgroundColor: '#2c2c2e', alignItems: 'center', justifyContent: 'center' },
                  !PRESET_COLORS.includes(selectedColor) && styles.colorCircleSelected
                ]}
              >
                <Palette size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {showColorPicker && (
              <View 
                style={styles.colorPickerContainer}
                {...{
                  onTouchStartCapture: () => setIsSliding(true),
                  onTouchEndCapture: () => setIsSliding(false),
                  onTouchCancelCapture: () => setIsSliding(false)
                } as any}
              >
                <ColorPicker
                  color={selectedColor}
                  onColorChangeComplete={(c) => setSelectedColor(c)}
                  thumbSize={24}
                  sliderSize={24}
                  noSnap={true}
                  row={false}
                />
              </View>
            )}

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
              Caffeine content per standard serving cup. (Standard cup of coffee contains ~95mg).
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

            {caffeine > 0 && (
              <View style={styles.caffModeRow}>
                <TouchableOpacity 
                  style={[styles.caffModeBtn, !caffeineIsFixed && { backgroundColor: selectedColor, borderColor: selectedColor }]}
                  onPress={() => { Haptics.selectionAsync(); setCaffeineIsFixed(false); }}
                >
                  <Text style={[styles.caffModeText, !caffeineIsFixed && styles.caffModeTextActive]}>Scales with Volume</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.caffModeBtn, caffeineIsFixed && { backgroundColor: selectedColor, borderColor: selectedColor }]}
                  onPress={() => { Haptics.selectionAsync(); setCaffeineIsFixed(true); }}
                >
                  <Text style={[styles.caffModeText, caffeineIsFixed && styles.caffModeTextActive]}>Fixed per Serving</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Multiple Volume Presets selection */}
            <Text style={styles.sectionTitle}>Available Sizes (ml)</Text>
            <View style={styles.volumesWrapRow}>
              {[50, 100, 150, 250, 330, 500, 650, 1000].map(vol => {
                const isSelected = selectedPresets.includes(vol);
                return (
                  <TouchableOpacity
                    key={vol}
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (isSelected && selectedPresets.length > 1) {
                        setSelectedPresets(selectedPresets.filter(p => p !== vol));
                      } else if (!isSelected) {
                        setSelectedPresets([...selectedPresets, vol]);
                      }
                    }}
                    style={[
                      styles.volumePill,
                      isSelected && { backgroundColor: selectedColor, borderColor: selectedColor }
                    ]}
                  >
                    <Text style={[
                      styles.volumeText,
                      isSelected && styles.volumeTextSelected
                    ]}>{vol}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Visual Preview Card */}
            <Text style={styles.sectionTitle}>Preview</Text>
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View style={[styles.previewColor, { backgroundColor: selectedColor }]} />
                <Text style={styles.previewTitle}>{name.trim() || 'Custom Drink'}</Text>
              </View>
              <View style={styles.previewStats}>
                <Text style={styles.previewStatText}>Hydration: {multiplier > 0 ? '+' : ''}{multiplier.toFixed(2)}x</Text>
                {caffeine > 0 && (
                  <Text style={styles.previewStatText}>Caffeine: {caffeine}mg ({caffeineIsFixed ? 'Fixed' : 'Scales'})</Text>
                )}
                <Text style={styles.previewStatText}>Sizes: {selectedPresets.length > 0 ? [...selectedPresets].sort((a,b)=>a-b).join(', ') : 'None'} ml</Text>
              </View>
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
    fontFamily: theme.typography.semibold,
    fontSize: 14,
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
  caffModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  caffModeBtn: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    borderRadius: 99,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caffModeText: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  caffModeTextActive: {
    color: '#ffffff',
    fontFamily: theme.typography.bold,
  },
  volumesWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  volumePill: {
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    borderRadius: 99,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeText: {
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  volumeTextSelected: {
    color: '#ffffff',
    fontFamily: theme.typography.bold,
  },
  previewCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    marginBottom: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  previewTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: '#ffffff',
  },
  previewStats: {
    gap: 6,
  },
  previewStatText: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
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
  colorPickerContainer: {
    height: 300,
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: '#1c1c1e',
    borderRadius: theme.borderRadius.md,
    padding: 16,
  },
});
