import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Settings, BarChart2, Calendar, Droplet, ChevronLeft } from 'lucide-react-native';
import { theme } from '../theme';
import SegmentedControl from './SegmentedControl';

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
      <View style={styles.segmentedContainer}>
        <SegmentedControl
          values={['tracker', 'stats', 'calendar'] as const}
          selectedValue={activeView}
          onChange={onViewChange}
          labels={['Today', 'Stats', 'Trends']}
          icons={[
            <Droplet size={14} />,
            <BarChart2 size={14} />,
            <Calendar size={14} />
          ]}
        />
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
    fontFamily: theme.typography.bold,
    fontSize: 18,
    color: theme.colors.text,
    textAlign: 'center',
    flex: 1,
  },
  settingsBtn: {
    flex: 1,
    alignItems: 'flex-end',
  },
  segmentedContainer: {
    marginHorizontal: theme.spacing.md,
  },
});
