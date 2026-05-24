import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Keyboard } from 'react-native';
import { Terminal, Plus, Sliders } from 'lucide-react-native';
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
        <Terminal size={16} color={theme.colors.accent} style={styles.consoleIcon} />
        
        <TextInput
          style={styles.textInput}
          value={inputVal}
          onChangeText={setInputVal}
          placeholder={`Add ${currentConfig.label} (e.g. 250, /goal 3000)...`}
          placeholderTextColor={theme.colors.textSubtle}
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
          <Sliders size={16} color={showSlider ? theme.colors.accentAmber : theme.colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleSubmit}
          activeOpacity={0.7}
        >
          <Plus size={16} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* Interactive Dial Slider */}
      {showSlider && (
        <View style={styles.sliderPanel}>
          <Text style={styles.sliderHeader}># drag-to-size</Text>
          <View style={styles.sliderDisplayRow}>
            <Text style={styles.sliderValue}>{sliderVal} ml</Text>
            <Text style={styles.sliderNet}>({Math.round(sliderVal * currentConfig.multiplier)}ml effective)</Text>
          </View>

          {/* Minimalist slider button adjustments */}
          <View style={styles.dialRow}>
            {[100, 250, 400, 500, 750, 1000].map((val) => (
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
              <Text style={styles.cancelText}>Collapse</Text>
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
    marginVertical: theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    height: 48,
  },
  consoleIcon: {
    marginRight: theme.spacing.sm,
  },
  textInput: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.typography.mono,
    fontSize: 13,
    height: '100%',
  },
  sliderToggle: {
    padding: 8,
    marginRight: 4,
    borderRadius: 4,
    backgroundColor: '#1b1b1b',
  },
  submitBtn: {
    backgroundColor: theme.colors.text,
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderPanel: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  sliderHeader: {
    fontFamily: theme.typography.mono,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  sliderDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  sliderValue: {
    fontFamily: theme.typography.mono,
    fontSize: 22,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
  },
  sliderNet: {
    fontFamily: theme.typography.mono,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  dialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: 4,
  },
  dialCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 3,
  },
  dialCellActive: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dialText: {
    fontFamily: theme.typography.mono,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  dialTextActive: {
    color: theme.colors.accentAmber,
    fontWeight: theme.typography.weight.bold,
  },
  sliderActionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  sliderCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.typography.mono,
  },
  sliderConfirm: {
    flex: 2,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: theme.typography.weight.bold,
    fontFamily: theme.typography.mono,
  },
});
