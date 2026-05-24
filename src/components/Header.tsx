import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Settings, BarChart2, Calendar, Droplet, ChevronLeft } from 'lucide-react-native';
import { theme } from '../theme';

interface HeaderProps {
  activeView: 'tracker' | 'stats' | 'calendar';
  onViewChange: (view: 'tracker' | 'stats' | 'calendar') => void;
  onOpenSettings: () => void;
  onGoBackToHub: () => void;
}

export default function Header({ activeView, onViewChange, onOpenSettings, onGoBackToHub }: HeaderProps) {
  return (
    <View style={styles.container}>
      {/* iOS Style Title Bar */}
      <View style={styles.titleBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onGoBackToHub} activeOpacity={0.7}>
          <ChevronLeft size={28} color={theme.colors.accent} style={{ marginLeft: -8 }} />
          <Text style={styles.backText}>Vault</Text>
        </TouchableOpacity>
        
        <Text style={styles.titleText}>
          {activeView === 'tracker' && 'Hydration'}
          {activeView === 'stats' && 'Insights'}
          {activeView === 'calendar' && 'History'}
        </Text>

        <TouchableOpacity style={styles.settingsBtn} onPress={onOpenSettings} activeOpacity={0.7}>
          <Settings size={22} color={theme.colors.accent} />
        </TouchableOpacity>
      </View>

      {/* iOS Segmented Control */}
      <View style={styles.segmentedControl}>
        <TouchableOpacity 
          style={[styles.segment, activeView === 'tracker' && styles.activeSegment]} 
          onPress={() => onViewChange('tracker')}
          activeOpacity={0.8}
        >
          <Droplet size={14} color={activeView === 'tracker' ? '#000' : theme.colors.text} />
          <Text style={[styles.segmentText, activeView === 'tracker' && styles.activeSegmentText]}>
            Today
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.segment, activeView === 'stats' && styles.activeSegment]} 
          onPress={() => onViewChange('stats')}
          activeOpacity={0.8}
        >
          <BarChart2 size={14} color={activeView === 'stats' ? '#000' : theme.colors.text} />
          <Text style={[styles.segmentText, activeView === 'stats' && styles.activeSegmentText]}>
            Stats
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.segment, activeView === 'calendar' && styles.activeSegment]} 
          onPress={() => onViewChange('calendar')}
          activeOpacity={0.8}
        >
          <Calendar size={14} color={activeView === 'calendar' ? '#000' : theme.colors.text} />
          <Text style={[styles.segmentText, activeView === 'calendar' && styles.activeSegmentText]}>
            Trends
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backText: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    color: theme.colors.accent,
    marginLeft: -4,
  },
  titleText: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    fontWeight: theme.typography.weight.semibold,
    color: theme.colors.text,
    textAlign: 'center',
    flex: 1,
  },
  settingsBtn: {
    flex: 1,
    alignItems: 'flex-end',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.sm,
    marginHorizontal: theme.spacing.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm - 2,
    gap: 6,
  },
  activeSegment: {
    backgroundColor: theme.colors.text, // White background for active segment
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  segmentText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    fontWeight: theme.typography.weight.medium,
    color: theme.colors.text,
  },
  activeSegmentText: {
    color: '#000000', // Black text on white background
    fontWeight: theme.typography.weight.semibold,
  },
});
