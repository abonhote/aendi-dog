import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Eindeutige App-ID (umgekehrte Domain). Muss vor dem ersten „cap add android“ feststehen,
  // später (und im Play Store ohnehin) nur noch mit grossem Aufwand änderbar.
  appId: 'ch.aendi.aendidog',
  appName: 'Ändi Dog',
  webDir: 'dist',
};

export default config;
