import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.fairpay.app',
    appName: 'FairPay',
    webDir: 'dist',
    plugins: {
        CapacitorUpdater: {
            autoUpdate: false,
        },
    }
};

export default config;
