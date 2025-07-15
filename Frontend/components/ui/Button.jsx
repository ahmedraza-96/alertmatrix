import React, { forwardRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

const Button = forwardRef(({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  ...props
}, ref) => {
  const getButtonStyle = () => {
    const baseStyle = [styles.button];
    
    // Size variants
    if (size === 'small') baseStyle.push(styles.buttonSmall);
    if (size === 'large') baseStyle.push(styles.buttonLarge);
    
    // Variant styles
    switch (variant) {
      case 'primary':
        baseStyle.push(styles.buttonPrimary);
        break;
      case 'secondary':
        baseStyle.push(styles.buttonSecondary);
        break;
      case 'outline':
        baseStyle.push(styles.buttonOutline);
        break;
      case 'ghost':
        baseStyle.push(styles.buttonGhost);
        break;
      case 'danger':
        baseStyle.push(styles.buttonDanger);
        break;
      default:
        baseStyle.push(styles.buttonPrimary);
    }
    
    // Disabled state
    if (disabled || loading) {
      baseStyle.push(styles.buttonDisabled);
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.buttonText];
    
    // Size variants
    if (size === 'small') baseStyle.push(styles.buttonTextSmall);
    if (size === 'large') baseStyle.push(styles.buttonTextLarge);
    
    // Variant text colors
    switch (variant) {
      case 'primary':
        baseStyle.push(styles.buttonTextPrimary);
        break;
      case 'secondary':
        baseStyle.push(styles.buttonTextSecondary);
        break;
      case 'outline':
        baseStyle.push(styles.buttonTextOutline);
        break;
      case 'ghost':
        baseStyle.push(styles.buttonTextGhost);
        break;
      case 'danger':
        baseStyle.push(styles.buttonTextDanger);
        break;
    }
    
    return baseStyle;
  };

  return (
    <TouchableOpacity
      ref={ref}
      style={[...getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {leftIcon && !loading && leftIcon}
      
      {loading ? (
        <ActivityIndicator 
          size={size === 'small' ? 'small' : 'small'} 
          color={variant === 'primary' || variant === 'danger' ? colors.white : colors.primary} 
        />
      ) : (
        <Text style={[...getTextStyle(), textStyle]}>
          {title}
        </Text>
      )}
      
      {rightIcon && !loading && rightIcon}
    </TouchableOpacity>
  );
});

Button.displayName = 'Button';

const styles = StyleSheet.create({
  // Base button styles
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  
  // Size variants
  buttonSmall: {
    height: 36,
    paddingHorizontal: spacing.md,
  },
  
  buttonLarge: {
    height: 56,
    paddingHorizontal: spacing.xl,
  },
  
  // Variant styles
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  
  buttonSecondary: {
    backgroundColor: colors.backgroundTertiary,
  },
  
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  
  buttonDanger: {
    backgroundColor: colors.error,
  },
  
  buttonDisabled: {
    backgroundColor: colors.backgroundTertiary,
    opacity: 0.6,
    ...shadows.sm,
  },
  
  // Text styles
  buttonText: {
    fontSize: typography.base,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  
  buttonTextSmall: {
    fontSize: typography.sm,
  },
  
  buttonTextLarge: {
    fontSize: typography.lg,
  },
  
  // Variant text colors
  buttonTextPrimary: {
    color: colors.white,
  },
  
  buttonTextSecondary: {
    color: colors.textPrimary,
  },
  
  buttonTextOutline: {
    color: colors.primary,
  },
  
  buttonTextGhost: {
    color: colors.primary,
  },
  
  buttonTextDanger: {
    color: colors.white,
  },
});

export default Button; 