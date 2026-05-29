import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../theme';
import { WorkoutSession } from '../trainingTypes';

interface TrainingDashboardProps {
  sessions: WorkoutSession[];
}

export default function TrainingDashboard({ sessions }: TrainingDashboardProps) {
  
  // Calculate total volume across all sessions
  const totalVolume = sessions.reduce((sum, s) => sum + s.totalVolume, 0);

  // Group by muscle group (naive calculation based on template name for now)
  const pushVol = sessions.filter(s => s.templateName.toLowerCase().includes('push')).reduce((sum, s) => sum + s.totalVolume, 0);
  const pullVol = sessions.filter(s => s.templateName.toLowerCase().includes('pull')).reduce((sum, s) => sum + s.totalVolume, 0);
  const legsVol = sessions.filter(s => s.templateName.toLowerCase().includes('legs')).reduce((sum, s) => sum + s.totalVolume, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>ALL-TIME PROGRESS</Text>
      
      <View style={styles.statGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{sessions.length}</Text>
          <Text style={styles.statLabel}>Total Sessions</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{(totalVolume / 1000).toFixed(1)}t</Text>
          <Text style={styles.statLabel}>Total Tonnage</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>VOLUME DISTRIBUTION</Text>
      <View style={styles.chartContainer}>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>PUSH</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { backgroundColor: theme.colors.accentCyan, width: totalVolume ? `${(pushVol / totalVolume) * 100}%` : '0%' }]} />
          </View>
          <Text style={styles.barValue}>{pushVol} kg</Text>
        </View>
        
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>PULL</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { backgroundColor: theme.colors.accentGreen, width: totalVolume ? `${(pullVol / totalVolume) * 100}%` : '0%' }]} />
          </View>
          <Text style={styles.barValue}>{pullVol} kg</Text>
        </View>
        
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>LEGS</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { backgroundColor: theme.colors.accentAmber, width: totalVolume ? `${(legsVol / totalVolume) * 100}%` : '0%' }]} />
          </View>
          <Text style={styles.barValue}>{legsVol} kg</Text>
        </View>
      </View>
      
      <Text style={styles.note}>Note: Real graph visualization requires additional charting libraries.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: theme.colors.textMuted,
    letterSpacing: 2,
    marginBottom: 16,
    marginTop: 8,
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: 20,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 28,
    color: theme.colors.text,
  },
  statLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: 20,
    marginBottom: 20,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  barLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: theme.colors.text,
    width: 40,
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 6,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  barValue: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textMuted,
    width: 60,
    textAlign: 'right',
  },
  note: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  }
});
