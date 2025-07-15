import React, { forwardRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../styles/theme';

const Card = forwardRef(({
  children,
  elevation = 'md',
  padding = 'default',
  onPress,
  style,
  ...props
}, ref) => {
  const getCardStyle = () => {
    const baseStyle = [styles.card];
    
    // Elevation variants
    switch (elevation) {
      case 'none':
        break;
      case 'sm':
        baseStyle.push(shadows.sm);
        break;
      case 'md':
        baseStyle.push(shadows.md);
        break;
      case 'lg':
        baseStyle.push(shadows.lg);
        break;
      case 'xl':
        baseStyle.push(shadows.xl);
        break;
      default:
        baseStyle.push(shadows.md);
    }
    
    // Padding variants
    switch (padding) {
      case 'none':
        baseStyle.push(styles.cardPaddingNone);
        break;
      case 'small':
        baseStyle.push(styles.cardPaddingSmall);
        break;
      case 'large':
        baseStyle.push(styles.cardPaddingLarge);
        break;
      default:
        baseStyle.push(styles.cardPaddingDefault);
    }
    
    return baseStyle;
  };

  if (onPress) {
    return (
      <TouchableOpacity
        ref={ref}
        style={[...getCardStyle(), style]}
        onPress={onPress}
        activeOpacity={0.8}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View ref={ref} style={[...getCardStyle(), style]} {...props}>
      {children}
    </View>
  );
});

Card.displayName = 'Card';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  
  // Padding variants
  cardPaddingNone: {
    padding: 0,
  },
  
  cardPaddingSmall: {
    padding: spacing.md,
  },
  
  cardPaddingDefault: {
    padding: spacing.lg,
  },
  
  cardPaddingLarge: {
    padding: spacing.xl,
  },
});

export default Card; 