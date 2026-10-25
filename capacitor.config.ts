import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Eindeutige App-ID (umgekehrte Domain). Vor dem ersten „cap add android“ anpassen,
  // später nur noch mit Aufwand änderbar.
  appId: 'ch.aendi.aendidog',
  appName: 'Ändi Dog',
  webDir: 'dist',
};

export default config;
