import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, ScrollView, SafeAreaView } from 'react-native';
import { Platform } from '../utils/platform';
import { Link, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthContext } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { colors, typography, spacing, layout } from '../styles/theme';

const SignIn = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { signIn } = useContext(AuthContext);

  const validateForm = () => {
    const newErrors = {};
    if (!username) newErrors.username = 'Username is required';
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    }
    return newErrors;
  };

  const handleSignIn = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      await signIn(username, password);
      router.replace('/dashboard');
    } catch (err) {
      Alert.alert('Login Failed', err.message || 'Please check your credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* Header Section */}
            <View style={styles.headerSection}>
              <View style={styles.logoContainer}>
                <MaterialIcons name="security" size={48} color={colors.primary} />
              </View>
              <Text style={styles.title}>Welcome to AlertMatrix</Text>
              <Text style={styles.subtitle}>
                Sign in to access your security dashboard
              </Text>
            </View>

            {/* Form Section */}
            <Card elevation="lg" style={styles.formCard}>
              <View style={styles.formContent}>
                <Input
                  label="Username"
                  placeholder="Enter your username"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    setErrors({ ...errors, username: '' });
                  }}
                  error={errors.username}
                  leftIcon={
                    <MaterialIcons name="person" size={20} color={colors.textLight} />
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Input
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrors({ ...errors, password: '' });
                  }}
                  error={errors.password}
                  leftIcon={
                    <MaterialIcons name="lock" size={20} color={colors.textLight} />
                  }
                  secureTextEntry
                  showPasswordToggle
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                />

                <Button
                  title="Sign In"
                  onPress={handleSignIn}
                  loading={loading}
                  style={styles.signInButton}
                />

                <View style={styles.footerContainer}>
                  <Text style={styles.footerText}>Don't have an account? </Text>
                  <Link href="/sign-up" asChild>
                    <Text style={styles.linkText}>Sign Up</Text>
                  </Link>
                </View>
              </View>
            </Card>

            {/* Features Section */}
            <View style={styles.featuresSection}>
              <View style={styles.featureItem}>
                <MaterialIcons name="shield" size={24} color={colors.primary} />
                <Text style={styles.featureText}>Advanced Security</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="notifications" size={24} color={colors.primary} />
                <Text style={styles.featureText}>Real-time Alerts</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="videocam" size={24} color={colors.primary} />
                <Text style={styles.featureText}>Live Monitoring</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  keyboardContainer: {
    flex: 1,
  },
  
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  
  title: {
    fontSize: typography['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.relaxed * typography.base,
  },
  
  formCard: {
    marginBottom: spacing.xl,
  },
  
  formContent: {
    gap: spacing.md,
  },
  
  signInButton: {
    marginTop: spacing.md,
  },
  
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  
  footerText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  
  linkText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  
  featuresSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
  },
  
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  
  featureText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
});

export default SignIn;