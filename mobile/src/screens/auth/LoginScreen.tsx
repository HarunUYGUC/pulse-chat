import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { MessageSquare, User, Lock, ArrowRight, Zap } from 'lucide-react-native';

interface LoginScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { login, quickLogin, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setLocalError('Please fill in all fields.');
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    clearError();

    try {
      await login({
        usernameOrEmail: identifier.trim(),
        password,
      });
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Failed to sign in.';
      setLocalError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (username: string) => {
    setSubmitting(true);
    setLocalError(null);
    clearError();
    try {
      await quickLogin(username);
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Quick login failed.';
      setLocalError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Branding */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <MessageSquare color={colors.text} size={36} />
          </View>
          <Text style={styles.brandTitle}>PulseChat</Text>
          <Text style={styles.brandSubtitle}>Welcome back! Sign in to continue.</Text>
        </View>

        {/* Error message banner */}
        {(localError || error) && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{localError || error}</Text>
          </View>
        )}

        {/* Form Inputs */}
        <View style={styles.formContainer}>
          <Text style={styles.label}>USERNAME OR EMAIL</Text>
          <View style={styles.inputWrapper}>
            <User color={colors.textSecondary} size={18} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. alice or alice@pulse.chat"
              placeholderTextColor={colors.textMuted}
              value={identifier}
              onChangeText={(t) => {
                setIdentifier(t);
                setLocalError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputWrapper}>
            <Lock color={colors.textSecondary} size={18} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setLocalError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleLogin}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.submitButtonText}>Sign In</Text>
                <ArrowRight color={colors.text} size={18} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Demo Logins */}
        <View style={styles.quickLoginSection}>
          <View style={styles.quickHeader}>
            <Zap color={colors.warning} size={16} />
            <Text style={styles.quickTitle}>QUICK DEMO LOGINS (1-TAP)</Text>
          </View>
          <View style={styles.quickButtonsRow}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => handleQuickLogin('alice')}
              disabled={submitting}
            >
              <Text style={styles.quickBtnText}>Alice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => handleQuickLogin('bob')}
              disabled={submitting}
            >
              <Text style={styles.quickBtnText}>Bob</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => handleQuickLogin('charlie')}
              disabled={submitting}
            >
              <Text style={styles.quickBtnText}>Charlie</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Navigation */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Need an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
  },
  errorBox: {
    backgroundColor: '#da373c26',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 44,
    color: colors.text,
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  quickLoginSection: {
    marginTop: 20,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  quickTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  quickButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  registerLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
