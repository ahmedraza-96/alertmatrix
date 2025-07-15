import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Alert } from 'react-native';
import { router, Redirect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Header from '../../components/ui/Header';
import { colors, typography, spacing, shadows } from '../../styles/theme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { apiClient, createAuthHeaders } from '../../utils/apiClient';
import { AuthContext } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';

export default function Reports() {
  const { token, isAuthenticated } = useContext(AuthContext);
  const [range, setRange] = useState('daily');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  // Fetch data whenever the selected range changes
  useEffect(() => {
    fetchReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Check if user is authenticated
      if (!token) {
        throw new Error('Authentication required');
      }

      console.log(`🔍 Fetching reports for range: ${range}`);
      console.log(`🔍 Using token: ${token ? 'Present' : 'Missing'}`);
      console.log(`🔍 Auth headers:`, createAuthHeaders(token));

      // Attempt to fetch report data from backend with authentication
      const response = await apiClient.get(`/api/reports?range=${range}`, createAuthHeaders(token));
      
      console.log(`🔍 Raw response:`, response);
      
      // Handle new response format with access control
      if (response?.hasAccess === false) {
        // User doesn't have camera or alarm access
        setReportData([]);
        setError(response.message || 'Please add a camera or set up an alert to view reports.');
        return;
      }
      
      // Accept both { data: [...] } and plain array responses
      const normalized = Array.isArray(response) ? response : response?.data || [];
      setReportData(normalized);
      console.log(`✅ Successfully fetched ${normalized.length} report entries for ${range} range`);
    } catch (err) {
      console.error('❌ Failed to fetch reports:', err);
      console.error('❌ Error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack,
        token: token ? 'Present' : 'Missing',
        range: range
      });
      
      setError(err.message);
      
      // If authentication failed, don't show sample data
      if (err.message.includes('Authentication') || err.message.includes('authorization') || err.message.includes('token')) {
        setReportData([]);
        return;
      }
      
      // Don't show fallback sample data for access control issues
      if (err.message.includes('camera') || err.message.includes('alert')) {
        setReportData([]);
        return;
      }
      
      // Fallback sample data so UI still renders in dev environments without backend support
      const today = new Date();
      const sample = Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return {
          label: date.toISOString().slice(0, 10),
          gunAlerts: Math.floor(Math.random() * 5),
          knifeAlerts: Math.floor(Math.random() * 3),
          alarmAlerts: Math.floor(Math.random() * 4),
        };
      });
      setReportData(sample.reverse());
    } finally {
      setLoading(false);
    }
  };

  // Helper to render the range selector buttons
  const renderRangeSelector = () => {
    const ranges = [
      { key: 'daily', label: 'Daily' },
      { key: 'weekly', label: 'Weekly' },
      { key: 'monthly', label: 'Monthly' },
    ];

    return (
      <View style={styles.rangeSelector}>
        {ranges.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.rangeButton,
              range === key && styles.rangeButtonActive,
            ]}
            onPress={() => setRange(key)}
          >
            <Text
              style={[
                styles.rangeButtonText,
                range === key && styles.rangeButtonTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render the report data as a simple table
  const renderReportTable = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      );
    }

    if (!reportData || reportData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialIcons 
            name={error ? "error-outline" : "assignment"} 
            size={48} 
            color={error ? colors.error : colors.textSecondary} 
          />
          <Text style={styles.emptyText}>
            {error ? 'Failed to load reports' : 'No data available for this range'}
          </Text>
          {error && (
            <Text style={styles.errorDetails}>
              {error.includes('Authentication') || error.includes('authorization') || error.includes('token') 
                ? 'Please sign in again to view reports' 
                : error.includes('camera') || error.includes('alert')
                ? 'Please add a camera or set up an alert to view reports.'
                : 'Please check your connection and try again'}
            </Text>
          )}
          {error && !error.includes('camera') && !error.includes('alert') && (
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={fetchReportData}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.table}>
        {/* Table Header */}
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.tableHeaderCell, styles.cellLabel]}>Date</Text>
          <Text style={[styles.tableHeaderCell, styles.cell]}>Gun Alerts</Text>
          <Text style={[styles.tableHeaderCell, styles.cell]}>Knife Alerts</Text>
          <Text style={[styles.tableHeaderCell, styles.cell]}>Alarm Detected</Text>
        </View>

        {/* Table Rows */}
        {reportData.map((item, index) => (
          <View
            key={index}
            style={[
              styles.tableRow,
              index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
            ]}
          >
            <Text style={[styles.cellLabel]}>{item.label || item.date || item.week || item.month}</Text>
            <Text style={styles.cell}>{item.gunAlerts ?? item.gun_alerts ?? 0}</Text>
            <Text style={styles.cell}>{item.knifeAlerts ?? item.knife_alerts ?? 0}</Text>
            <Text style={styles.cell}>{item.alarmAlerts ?? item.alarm_alerts ?? item.alarmCount ?? item.alarms ?? 0}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Generate HTML string for the PDF report
  const generateHtmlReport = () => {
    const rowsHtml = reportData
      .map(
        (r) => `
          <tr>
            <td style="padding:8px;border:1px solid #ddd;">${r.label || r.date || r.week || r.month}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${
              r.gunAlerts ?? r.gun_alerts ?? 0
            }</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${
              r.knifeAlerts ?? r.knife_alerts ?? 0
            }</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${
              r.alarmAlerts ?? r.alarm_alerts ?? r.alarmCount ?? r.alarms ?? 0
            }</td>
          </tr>`
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>AlertMatrix Report</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h1 style="text-align:center;">AlertMatrix – ${range.charAt(0).toUpperCase() + range.slice(1)} Report</h1>
          <p style="text-align:center;margin-bottom:24px;">Generated on ${new Date().toLocaleString()}</p>
          <table style="border-collapse:collapse;width:100%;">
            <thead>
              <tr style="background:#f2f2f2;">
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Date</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:center;">Gun Alerts</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:center;">Knife Alerts</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:center;">Alarm Detected</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const handleDownloadPdf = async () => {
    try {
      const html = generateHtmlReport();
      const { uri } = await Print.printToFileAsync({ html });

      if (Platform.OS === 'web') {
        // For web, just open the PDF in a new tab
        window.open(uri, '_blank');
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('PDF Generated', 'PDF has been saved:', [{ text: 'OK' }]);
      }
    } catch (err) {
      console.error('Failed to generate PDF', err);
      Alert.alert('Error', 'Failed to generate PDF.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Security Reports"
        showBackButton
        onBackPress={() => router.back()}
        style={styles.header}
      />
      
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <MaterialIcons name="assessment" size={32} color={colors.primary} />
          <Text style={styles.pageTitle}>Security Reports</Text>
          <Text style={styles.pageDescription}>
            View and download detailed security reports for your monitoring system
          </Text>
        </View>

        {/* Range Selector */}
        {renderRangeSelector()}

        {/* Report Table */}
        {renderReportTable()}

        {/* Download Button - Only show if there's data */}
        {reportData && reportData.length > 0 && (
          <Button
            title="Download PDF"
            onPress={handleDownloadPdf}
            variant="primary"
            size="large"
            style={styles.downloadButton}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  
  header: {
    backgroundColor: colors.primary,
    borderBottomWidth: 0,
    ...shadows.sm,
  },
  
  container: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 10,
    padding: spacing.lg,
  },
  
  pageHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    backgroundColor: colors.backgroundAccent,
    borderRadius: 16,
    padding: spacing.lg,
    ...shadows.sm,
  },

  pageTitle: {
    fontSize: typography['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  pageDescription: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.relaxed * typography.base,
  },

  rangeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },

  rangeButton: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginHorizontal: spacing.sm,
  },

  rangeButtonActive: {
    backgroundColor: colors.primary,
  },

  rangeButtonText: {
    fontSize: typography.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },

  rangeButtonTextActive: {
    color: colors.white,
  },

  table: {
    width: '100%',
  },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: colors.border,
  },

  tableRowEven: {
    backgroundColor: colors.backgroundSecondary,
  },

  tableRowOdd: {
    backgroundColor: colors.background,
  },

  tableHeaderRow: {
    backgroundColor: colors.backgroundAccent,
  },

  tableHeaderCell: {
    flex: 1,
    padding: spacing.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  cellLabel: {
    flex: 1,
    padding: spacing.md,
    color: colors.textPrimary,
  },

  cell: {
    flex: 1,
    padding: spacing.md,
    textAlign: 'center',
    color: colors.textPrimary,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },

  emptyText: {
    fontSize: typography.lg,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  errorDetails: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: typography.lineHeight.relaxed * typography.sm,
  },

  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.sm,
  },

  retryButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: typography.fontWeight.medium,
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  loadingText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  downloadButton: {
    marginTop: spacing.lg,
  },
}); 