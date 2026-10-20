import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getThemePreference } from '../database/repositories/settingsRepository';
import { getDesignTheme } from '../constants/design';

const listeners = new Set<() => void>();
export function refreshDesignTheme() { listeners.forEach(listener => listener()); }

/** Follow the existing saved appearance setting, including when returning to a tab. */
export function useDesignTheme() {
  const system = useColorScheme();
  const [dark, setDark] = useState(() => {
    try { return (getThemePreference() ?? system) === 'dark'; }
    catch { return system === 'dark'; }
  });
  useEffect(() => {
    const update = () => {
      try { setDark((getThemePreference() ?? system) === 'dark'); }
      catch { setDark(system === 'dark'); }
    };
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, [system]);
  useFocusEffect(useCallback(() => {
    try { setDark((getThemePreference() ?? system) === 'dark'); }
    catch { setDark(system === 'dark'); }
  }, [system]));
  return { dark, colors: getDesignTheme(dark) };
}
