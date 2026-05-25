import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Keyboard } from 'react-native';
import { Plus, ArrowUp } from 'lucide-react-native';
import { theme } from '../theme';
import { LIQUID_CONFIGS, LiquidType, UserSettings, LiquidConfig } from '../types';

interface CommandPaletteProps {
  selectedType: LiquidType;
  onLog: (amount: number) => void;
  onCommand: (cmd: string) => void;
  settings: UserSettings;
}

export default function CommandPalette({ selectedType, onLog, onCommand, settings }: CommandPaletteProps) {
  const [inputVal, setInputVal] = useState('');

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

  const currentConfig = LIQUID_CONFIGS[selectedType as LiquidType] || settings.customLiquids?.[selectedType] || LIQUID_CONFIGS['water'];

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
          style={[styles.submitBtn, !!inputVal.trim() && { backgroundColor: theme.colors.accent }]} 
          onPress={handleSubmit}
          activeOpacity={0.7}
        >
          <ArrowUp size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
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
  submitBtn: {
    backgroundColor: theme.colors.surface,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
