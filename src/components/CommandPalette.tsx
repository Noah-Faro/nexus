import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Keyboard } from 'react-native';
import { Plus, SlidersHorizontal, ArrowUp } from 'lucide-react-native';
import { theme } from '../theme';
import { LIQUID_CONFIGS, LiquidType } from '../types';

interface CommandPaletteProps {
  selectedType: LiquidType;
  onLog: (amount: number) => void;
  onCommand: (cmd: string) => void;
}

export default function CommandPalette({ selectedType, onLog, onCommand }: CommandPaletteProps) {
  const [inputVal, setInputVal] = useState('');
  const [showSlider, setShowSlider] = useState(false);
  const [sliderVal, setSliderVal] = useState(500);

  const handleSubmit = () => {
    if (!inputVal.trim()) return;
    
    // Check if it's a command
    if (inputVal.startsWith('/')) {
      onCommand(inputVal);
      setInputVal('');
      Keyboard.dismiss();
      return;
    }

    // Otherwise, parse as number
    const amount = parseInt(inputVal, 10);
    if (!isNaN(amount) && amount > 0) {
      onLog(amount);
      setInputVal('');
      Keyboard.dismiss();
    }
  };

  const handleSliderSubmit = () => {
    onLog(sliderVal);
    setShowSlider(false);
  };

  const currentConfig = LIQUID_CONFIGS[selectedType];

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        
        <TextInput
          style={styles.textInput}
          value={inputVal}
          onChangeText={setInputVal}
          placeholder={`Add ${currentConfig.label} (e.g. 250, /goal 3000)`}
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="default"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity 
          style={styles.sliderToggle} 
          onPress={() => setShowSlider(!showSlider)}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={20} color={showSlider ? theme.colors.accent : theme.colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.submitBtn, !!inputVal.trim() && { backgroundColor: theme.colors.accent }]} 
          onPress={handleSubmit}
          activeOpacity={0.7}
        >
          <ArrowUp size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Interactive Dial Slider */}
      {showSlider && (
        <View style={styles.sliderPanel}>
          <View style={styles.sliderDisplayRow}>
            <Text style={styles.sliderValue}>{sliderVal} ml</Text>
            <Text style={styles.sliderNet}>({Math.round(sliderVal * currentConfig.multiplier)}ml effective)</Text>
          </View>

          {/* Minimalist slider button adjustments */}
          <View style={styles.dialRow}>
            {[100, 250, 400, 500, 650, 1000].map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.dialCell, sliderVal === val && styles.dialCellActive]}
                onPress={() => setSliderVal(val)}
              >
                <Text style={[styles.dialText, sliderVal === val && styles.dialTextActive]}>
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sliderActionRow}>
            <TouchableOpacity style={styles.sliderCancel} onPress={() => setShowSlider(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sliderConfirm, { backgroundColor: currentConfig.color }]} 
              onPress={handleSliderSubmit}
            >
              <Text style={styles.confirmText}>Add {sliderVal}ml</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 24, // Pill shape
    paddingHorizontal: 16,
    paddingVertical: 6,
    height: 48,
  },
  textInput: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.typography.sans,
    fontSize: 15,
    height: '100%',
  },
  sliderToggle: {
    padding: 8,
    marginRight: 4,
  },
  submitBtn: {
    backgroundColor: theme.colors.surface,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderPanel: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  sliderDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sliderValue: {
    fontFamily: theme.typography.sans,
    fontSize: 28,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
  },
  sliderNet: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  dialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    padding: 4,
  },
  dialCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm - 2,
  },
  dialCellActive: {
    backgroundColor: theme.colors.surfaceElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  dialText: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weight.medium,
  },
  dialTextActive: {
    color: theme.colors.text,
    fontWeight: theme.typography.weight.bold,
  },
  sliderActionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: 8,
  },
  sliderCancel: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: theme.typography.weight.medium,
    fontFamily: theme.typography.sans,
  },
  sliderConfirm: {
    flex: 2,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: theme.typography.weight.bold,
    fontFamily: theme.typography.sans,
  },
});
