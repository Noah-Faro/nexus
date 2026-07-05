import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput } from 'react-native';
import { theme } from '../theme';
import * as Haptics from 'expo-haptics';

interface StepperInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function StepperInput({ value, onChange, min = 0, max = 9999, step = 1 }: StepperInputProps) {
  const [textValue, setTextValue] = useState(value.toString());

  useEffect(() => {
    setTextValue(value.toString());
  }, [value]);

  const handleDecrement = () => {
    Haptics.selectionAsync();
    const newVal = Math.max(min, value - step);
    onChange(Number(newVal.toFixed(1)));
  };

  const handleIncrement = () => {
    Haptics.selectionAsync();
    const newVal = Math.min(max, value + step);
    onChange(Number(newVal.toFixed(1)));
  };

  const handleBlur = () => {
    let parsed = parseFloat(textValue.replace(',', '.'));
    if (isNaN(parsed)) {
      setTextValue(value.toString());
      return;
    }
    // Snap to nearest increment
    let snapped = Math.round(parsed / step) * step;
    snapped = Math.max(min, Math.min(max, snapped));
    snapped = Number(snapped.toFixed(2)); // avoid precision issues
    
    setTextValue(snapped.toString());
    onChange(snapped);
  };

  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepperBtn} onPress={handleDecrement} activeOpacity={0.7}>
        <Text style={styles.stepperBtnText}>-</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.stepperValue}
        value={textValue}
        onChangeText={setTextValue}
        onBlur={handleBlur}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <TouchableOpacity style={styles.stepperBtn} onPress={handleIncrement} activeOpacity={0.7}>
        <Text style={styles.stepperBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.surfaceMuted,
    height: 38,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 36,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  stepperBtnText: {
    fontFamily: theme.typography.semibold,
    fontSize: 18,
    color: theme.colors.text,
  },
  stepperValue: {
    flex: 1,
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.text,
    minWidth: 40,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
