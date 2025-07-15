import React, { useState, forwardRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

const Input = forwardRef(({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  leftIcon,
  rightIcon,
  secureTextEntry = false,
  size = 'medium',
  variant = 'default',
  multiline = false,
  numberOfLines = 1,
  style,
  inputStyle,
  showPasswordToggle = false,
  ...props
}, ref) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const getInputContainerStyle = () => {
    const baseStyle = [styles.inputContainer];
    
    // Size variants
    if (size === 'small') baseStyle.push(styles.inputContainerSmall);
    if (size === 'large') baseStyle.push(styles.inputContainerLarge);
    
    // Variant styles
    if (variant === 'filled') {
      baseStyle.push(styles.inputContainerFilled);
    }
    
    // States
    if (isFocused) {
      baseStyle.push(styles.inputContainerFocused);
    }
    
    if (error) {
      baseStyle.push(styles.inputContainerError);
    }
    
    return baseStyle;
  };

  const getInputStyle = () => {
    const baseStyle = [styles.input];
    
    // Size variants
    if (size === 'small') baseStyle.push(styles.inputSmall);
    if (size === 'large') baseStyle.push(styles.inputLarge);
    
    // Multiline
    if (multiline) {
      baseStyle.push(styles.inputMultiline);
    }
    
    return baseStyle;
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
      
      <View style={getInputContainerStyle()}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}
        
        <TextInput
          ref={ref}
          style={[...getInputStyle(), inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {(rightIcon || (secureTextEntry && showPasswordToggle)) && (
          <View style={styles.rightIconContainer}>
            {secureTextEntry && showPasswordToggle ? (
              <TouchableOpacity onPress={togglePasswordVisibility}>
                <MaterialIcons
                  name={isPasswordVisible ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={colors.textLight}
                />
              </TouchableOpacity>
            ) : (
              rightIcon
            )}
          </View>
        )}
      </View>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
});

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  
  label: {
    fontSize: typography.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  
  // Size variants
  inputContainerSmall: {
    height: 40,
    paddingHorizontal: spacing.sm,
  },
  
  inputContainerLarge: {
    height: 56,
    paddingHorizontal: spacing.lg,
  },
  
  // Variant styles
  inputContainerFilled: {
    backgroundColor: colors.backgroundTertiary,
    borderColor: 'transparent',
  },
  
  // States
  inputContainerFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  
  inputContainerError: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  
  input: {
    flex: 1,
    fontSize: typography.base,
    color: colors.textPrimary,
    paddingVertical: 0, // Remove default padding
  },
  
  // Size variants
  inputSmall: {
    fontSize: typography.sm,
  },
  
  inputLarge: {
    fontSize: typography.lg,
  },
  
  inputMultiline: {
    height: 'auto',
    minHeight: 80,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  
  leftIconContainer: {
    marginRight: spacing.sm,
  },
  
  rightIconContainer: {
    marginLeft: spacing.sm,
  },
  
  errorText: {
    fontSize: typography.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
});

export default Input; 