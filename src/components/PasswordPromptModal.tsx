import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { theme } from '../theme';

interface PasswordPromptModalProps {
  visible: boolean;
  title: string;
  message: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export default function PasswordPromptModal({ visible, title, message, onSubmit, onCancel }: PasswordPromptModalProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    onSubmit(password);
    setPassword('');
  };

  const handleCancel = () => {
    setPassword('');
    onCancel();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={handleCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Vault Password"
            placeholderTextColor={theme.colors.textSubtle}
            secureTextEntry
            autoFocus
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Decrypt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    fontFamily: theme.typography.bold,
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textSubtle,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    color: theme.colors.text,
    fontFamily: theme.typography.sans,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: theme.colors.text,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  submitButtonText: {
    fontFamily: theme.typography.semibold,
    color: theme.colors.background,
    fontSize: 15,
  },
  cancelButtonText: {
    fontFamily: theme.typography.semibold,
    color: theme.colors.text,
    fontSize: 15,
  },
});
