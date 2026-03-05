import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.fairpay.app',
    appName: 'FairPay',
    webDir: 'dist',
    plugins: {
        CapacitorUpdater: {
            autoUpdate: false,
        },
        StatusBar: {
            // Don't overlay the status bar — reserve its space so the header
            // sits below it. Style is set dynamically from AppHeader.
            overlaysWebView: false,
            style: 'DARK',         // default for initial dark-mode launch
            backgroundColor: '#003F66',
        },
    }
};

export default config;
