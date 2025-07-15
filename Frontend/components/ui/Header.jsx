import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, layout } from '../../styles/theme';

const Header = ({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  onLeftPress,
  onRightPress,
  showBackButton = false,
  onBackPress,
  style,
  ...props
}) => {
  return (
    <SafeAreaView style={[styles.safeArea, style]}>
      <View style={styles.header} {...props}>
        {/* Left Section */}
        <View style={styles.leftSection}>
          {showBackButton ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onBackPress}
              activeOpacity={0.7}
            >
              <MaterialIcons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
          ) : leftIcon ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onLeftPress}
              activeOpacity={0.7}
            >
              {leftIcon}
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>

        {/* Center Section */}
        <View style={styles.centerSection}>
          {title && (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Section */}
        <View style={styles.rightSection}>
          {rightIcon && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onRightPress}
              activeOpacity={0.7}
            >
              {rightIcon}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.primary,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: layout.headerHeight,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderBottomWidth: 0,
  },
  
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  
  centerSection: {
    flex: 3,
    alignItems: 'center',
  },
  
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  title: {
    fontSize: typography.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
    textAlign: 'center',
  },
  
  subtitle: {
    fontSize: typography.sm,
    color: colors.white,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 2,
  },
});

export default Header; 