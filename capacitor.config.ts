import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nlvipnutrition.app',
  appName: 'NLVIP Nutrition',
  webDir: 'out',
  server: {
    url: 'https://app.nlvipnutrition.com',
    cleartext: false
  }
};

export default config;
