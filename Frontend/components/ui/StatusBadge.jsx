import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

const StatusBadge = ({
  status,
  text,
  size = 'medium',
  variant = 'filled',
  style,
  textStyle,
  ...props
}) => {
  const getStatusColors = () => {
    switch (status) {
      case 'active':
      case 'urgent':
      case 'error':
        return {
          background: variant === 'filled' ? colors.error : colors.errorLight,
          text: variant === 'filled' ? colors.white : colors.error,
          border: colors.error,
        };
      case 'warning':
      case 'acknowledged':
        return {
          background: variant === 'filled' ? colors.warning : colors.warningLight,
          text: variant === 'filled' ? colors.white : colors.warning,
          border: colors.warning,
        };
      case 'success':
      case 'resolved':
      case 'online':
        return {
          background: variant === 'filled' ? colors.success : colors.successLight,
          text: variant === 'filled' ? colors.white : colors.success,
          border: colors.success,
        };
      case 'info':
      case 'inactive':
        return {
          background: variant === 'filled' ? colors.info : colors.infoLight,
          text: variant === 'filled' ? colors.white : colors.info,
          border: colors.info,
        };
      default:
        return {
          background: variant === 'filled' ? colors.secondary : colors.backgroundTertiary,
          text: variant === 'filled' ? colors.white : colors.textSecondary,
          border: colors.secondary,
        };
    }
  };

  const getBadgeStyle = () => {
    const baseStyle = [styles.badge];
    const statusColors = getStatusColors();
    
    // Size variants
    if (size === 'small') baseStyle.push(styles.badgeSmall);
    if (size === 'large') baseStyle.push(styles.badgeLarge);
    
    // Apply colors based on variant
    if (variant === 'filled') {
      baseStyle.push({
        backgroundColor: statusColors.background,
      });
    } else if (variant === 'outline') {
      baseStyle.push({
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: statusColors.border,
      });
    } else if (variant === 'subtle') {
      baseStyle.push({
        backgroundColor: statusColors.background,
      });
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.badgeText];
    const statusColors = getStatusColors();
    
    // Size variants
    if (size === 'small') baseStyle.push(styles.badgeTextSmall);
    if (size === 'large') baseStyle.push(styles.badgeTextLarge);
    
    // Apply text color
    baseStyle.push({ color: statusColors.text });
    
    return baseStyle;
  };

  const displayText = text || status?.toUpperCase() || 'DEFAULT';

  return (
    <View style={[...getBadgeStyle(), style]} {...props}>
      <Text style={[...getTextStyle(), textStyle]}>
        {displayText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    minWidth: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Size variants
  badgeSmall: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    minWidth: 24,
  },
  
  badgeLarge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 40,
  },
  
  // Text styles
  badgeText: {
    fontSize: typography.xs,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    lineHeight: typography.lineHeight.tight * typography.xs,
  },
  
  badgeTextSmall: {
    fontSize: 10,
    lineHeight: 12,
  },
  
  badgeTextLarge: {
    fontSize: typography.sm,
    lineHeight: typography.lineHeight.tight * typography.sm,
  },
});

export default StatusBadge; 