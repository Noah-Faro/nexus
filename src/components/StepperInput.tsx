import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
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
  const handleDecrement = () => {
    Haptics.selectionAsync();
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = () => {
    Haptics.selectionAsync();
    onChange(Math.min(max, value + step));
  };

  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepperBtn} onPress={handleDecrement} activeOpacity={0.7}>
        <Text style={styles.stepperBtnText}>-</Text>
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{value}</Text>
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
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    height: 38,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 36,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c2c2e',
  },
  stepperBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: '#ffffff',
  },
  stepperValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: '#ffffff',
    minWidth: 40,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
