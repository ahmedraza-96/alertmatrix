import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, ScrollView, SafeAreaView } from 'react-native';
import { Platform } from '../utils/platform';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthContext } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Header from '../components/ui/Header';
import { colors, typography, spacing, shadows } from '../styles/theme';

const SignUp = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { register } = useContext(AuthContext);

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
    if (!confirmPassword) newErrors.confirmPassword = 'Confirm Password is required';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!contactNumber) newErrors.contactNumber = 'Contact Number is required';
    return newErrors;
  };

  const handleSignUp = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      await register(username, password);
      Alert.alert('Success', 'Account created successfully!');
      router.replace('/');
    } catch (err) {
      Alert.alert('Registration Failed', err.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Create Account"
        showBackButton
        onBackPress={() => router.back()}
        style={styles.header}
      />
      
      <LinearGradient
        colors={[colors.backgroundAccent, colors.background, colors.backgroundSecondary]}
        style={styles.gradientContainer}
      >
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
                <MaterialIcons name="person-add" size={48} color={colors.primary} />
              </View>
              <Text style={styles.title}>Join AlertMatrix</Text>
              <Text style={styles.subtitle}>
                Create your account to start monitoring your security systems
              </Text>
            </View>

            {/* Form Section */}
            <Card elevation="lg" style={styles.formCard}>
              <View style={styles.formContent}>
                <Input
                  label="Username"
                  placeholder="Choose a username"
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
                  placeholder="Create a strong password"
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

                <Input
                  label="Confirm Password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setErrors({ ...errors, confirmPassword: '' });
                  }}
                  error={errors.confirmPassword}
                  leftIcon={
                    <MaterialIcons name="lock" size={20} color={colors.textLight} />
                  }
                  secureTextEntry
                  showPasswordToggle
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                />

                <Input
                  label="Contact Number"
                  placeholder="Enter your phone number"
                  value={contactNumber}
                  onChangeText={(text) => {
                    setContactNumber(text);
                    setErrors({ ...errors, contactNumber: '' });
                  }}
                  error={errors.contactNumber}
                  leftIcon={
                    <MaterialIcons name="phone" size={20} color={colors.textLight} />
                  }
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Button
                  title="Create Account"
                  onPress={handleSignUp}
                  loading={loading}
                  style={styles.signUpButton}
                />

                <View style={styles.footerContainer}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <Link href="/" asChild>
                    <Text style={styles.linkText}>Sign In</Text>
                  </Link>
                </View>
              </View>
            </Card>

            {/* Security Features */}
            <Card elevation="sm" style={styles.securityCard}>
              <View style={styles.securityHeader}>
                <MaterialIcons name="verified-user" size={24} color={colors.success} />
                <Text style={styles.securityTitle}>Your Security Matters</Text>
              </View>
              <View style={styles.securityFeatures}>
                <View style={styles.securityFeature}>
                  <MaterialIcons name="check-circle" size={16} color={colors.success} />
                  <Text style={styles.securityFeatureText}>End-to-end encryption</Text>
                </View>
                <View style={styles.securityFeature}>
                  <MaterialIcons name="check-circle" size={16} color={colors.success} />
                  <Text style={styles.securityFeatureText}>Secure data storage</Text>
                </View>
                <View style={styles.securityFeature}>
                  <MaterialIcons name="check-circle" size={16} color={colors.success} />
                  <Text style={styles.securityFeatureText}>24/7 monitoring</Text>
                </View>
              </View>
            </Card>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: 0,
    ...shadows.sm,
  },
  
  gradientContainer: {
    flex: 1,
  },
  
  keyboardContainer: {
    flex: 1,
  },
  
  scrollContainer: {
    flexGrow: 1,
  },
  
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
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
    fontSize: typography['2xl'],
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
    marginBottom: spacing.lg,
  },
  
  formContent: {
    gap: spacing.md,
  },
  
  signUpButton: {
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
  
  securityCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    ...shadows.md,
  },
  
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  
  securityTitle: {
    fontSize: typography.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  
  securityFeatures: {
    gap: spacing.sm,
  },
  
  securityFeature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  securityFeatureText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
});

export default SignUp;