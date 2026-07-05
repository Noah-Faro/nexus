import AsyncStorage from '@react-native-async-storage/async-storage';
import { GymProfile } from './trainingTypes';

const GYM_PROFILES_KEY = '@nexus_gym_profiles';
const ACTIVE_GYM_ID_KEY = '@nexus_active_gym_id';

export const defaultGymProfile: GymProfile = {
  id: 'default',
  name: 'Default Gym',
  equipmentIncrements: {
    barbell: 2.5,
    dumbbell: 1,
    machine: 2.5,
    cable: 1,
    bodyweight: 1,
  }
};

export async function loadGymProfiles(): Promise<GymProfile[]> {
  try {
    const data = await AsyncStorage.getItem(GYM_PROFILES_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load gym profiles', e);
  }
  return [defaultGymProfile];
}

export async function saveGymProfiles(profiles: GymProfile[]): Promise<void> {
  try {
    await AsyncStorage.setItem(GYM_PROFILES_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Failed to save gym profiles', e);
  }
}

export async function getActiveGymId(): Promise<string> {
  try {
    const id = await AsyncStorage.getItem(ACTIVE_GYM_ID_KEY);
    return id || 'default';
  } catch (e) {
    console.error('Failed to get active gym id', e);
    return 'default';
  }
}

export async function setActiveGymId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_GYM_ID_KEY, id);
  } catch (e) {
    console.error('Failed to set active gym id', e);
  }
}

export async function getActiveGymProfile(): Promise<GymProfile> {
  const profiles = await loadGymProfiles();
  const activeId = await getActiveGymId();
  return profiles.find(p => p.id === activeId) || profiles[0] || defaultGymProfile;
}
