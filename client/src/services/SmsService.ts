import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";

interface SmsReceiverPlugin {
    startWatching(): Promise<{ started: boolean; reason?: string }>;
    stopWatching(): Promise<{ stopped: boolean }>;
    checkPermissions(): Promise<{ granted: boolean }>;
    addListener(eventName: 'smsReceived', listenerFunc: (data: { address: string; body: string; timestamp: number }) => void): Promise<{ remove: () => void }>;
    getPendingPayments(): Promise<{ payments: any[] }>;
    clearPendingPayments(): Promise<{ cleared: boolean }>;
}

const SmsReceiver = registerPlugin<SmsReceiverPlugin>('SmsReceiver');

export interface QueuedPayment {
    amount: number;
    payee: string;
    fullMessage: string;
    timestamp: number;
}

export const SmsService = {
    listener: null as any,
    notifListener: null as any,

    async initialize() {
        if (!Capacitor.isNativePlatform()) return;

        try {
            // Request Notification permissions so we can show Heads-Up popups
            const permStatus = await LocalNotifications.requestPermissions();
            if (permStatus.display !== 'granted') {
                console.warn("Notification permissions not granted! Cannot show UPI popups.");
            }

            // Create notification channel for Android 8+
            if (Capacitor.getPlatform() === 'android') {
                try {
                    await LocalNotifications.createChannel({
                        id: 'upi-payments',
                        name: 'UPI Payments',
                        description: 'Detected UPI payment alerts',
                        importance: 5,
                        visibility: 1,
                        vibration: true,
                    });
                } catch (e) {
                    console.error("Failed to create channel", e);
                }
            }

            // Start dynamic SMS watching for foreground
            const result = await SmsReceiver.startWatching();

            if (!result.started) {
                console.warn("SMS watching not started:", result.reason);
                return;
            }

            // Listen for user tapping a foreground created notification
            SmsService.notifListener = await LocalNotifications.addListener('localNotificationActionPerformed', () => {
                // The tap brings the app to foreground, which triggers appStateChange,
                // so we don't need to do specific navigation here. The dialog will open automatically.
            });

            // Listen for foreground SMS messages
            SmsService.listener = await SmsReceiver.addListener('smsReceived', (sms) => {
                SmsService.processSmsMessage(sms.body, sms.timestamp);
            });

            // Check pending payments immediately on startup
            await SmsService.checkBackgroundPayments();

            // Check for pending payments every time the app comes to foreground
            App.addListener('appStateChange', async ({ isActive }) => {
                if (isActive) {
                    await SmsService.checkBackgroundPayments();
                }
            });

        } catch (e: any) {
            console.error("Failed to initialize SMS service:", e);
        }
    },

    async checkBackgroundPayments() {
        try {
            const result = await SmsReceiver.getPendingPayments();
            if (result.payments && result.payments.length > 0) {
                result.payments.forEach(p => {
                    SmsService.addToQueue({
                        amount: p.amount,
                        payee: p.payee,
                        fullMessage: p.fullMessage,
                        timestamp: p.timestamp || Date.now()
                    });
                });
                await SmsReceiver.clearPendingPayments();
            }
        } catch (e) {
            console.error("Failed to check background payments", e);
        }
    },

    processSmsMessage(message: string, timestamp: number = Date.now()) {
        const lower = message.toLowerCase();
        const isPayment = lower.includes('debited') || lower.includes('sent') ||
            lower.includes('paid') || lower.includes('upi');
        if (!isPayment) return;

        const amountPatterns = [
            /(?:sent|paid)\s+(?:rs\.?|inr)\s*([0-9,]+(?:\.[0-9]+)?)/i,
            /(?:rs\.?|inr)\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:debited|has been)/i,
            /(?:debited.*?)(?:rs\.?|inr)\s*([0-9,]+(?:\.[0-9]+)?)/i,
        ];

        let amountStr: string | null = null;
        for (const pattern of amountPatterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                amountStr = match[1];
                break;
            }
        }

        if (!amountStr) return;

        const amount = parseFloat(amountStr.replace(/,/g, ''));
        if (amount <= 0 || isNaN(amount)) return;

        let payee = "";
        const toMatch = message.match(/(?:to|at)\s+([A-Za-z0-9][A-Za-z0-9.\s@\-_]{1,30}?)(?:\s+on|\s+ref|\s*\.|$)/i);
        if (toMatch && toMatch[1]) {
            payee = toMatch[1].trim();
        }

        // Add to persistent queue
        SmsService.addToQueue({
            amount,
            payee,
            fullMessage: message,
            timestamp
        });

        // Trigger OS notification in foreground
        SmsService.showExpenseNotification(amount, payee);
    },

    getQueue(): QueuedPayment[] {
        try {
            const data = localStorage.getItem('upi_payment_queue');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    addToQueue(payment: QueuedPayment) {
        const queue = SmsService.getQueue();

        // Deduplicate using timestamp range (avoid duplicate if from static receiver + dynamic receiver)
        const isDuplicate = queue.some(p =>
            p.amount === payment.amount &&
            p.payee === payment.payee &&
            Math.abs(p.timestamp - payment.timestamp) < 5000 // Within 5 seconds
        );

        if (!isDuplicate) {
            queue.push(payment);
            localStorage.setItem('upi_payment_queue', JSON.stringify(queue));
            window.dispatchEvent(new CustomEvent('upi_queue_updated'));
        }
    },

    popQueue() {
        const queue = SmsService.getQueue();
        if (queue.length > 0) {
            queue.shift(); // Remove first element
            localStorage.setItem('upi_payment_queue', JSON.stringify(queue));
            window.dispatchEvent(new CustomEvent('upi_queue_updated'));
        }
    },

    async showExpenseNotification(amount: number, payee: string) {
        const notificationId = Math.floor(Math.random() * 1000000);
        try {
            await LocalNotifications.schedule({
                notifications: [
                    {
                        title: "💸 New Payment Detected!",
                        body: `Paid ₹${amount}${payee ? ` to ${payee}` : ''}. Tap to review in FairPay.`,
                        id: notificationId,
                        channelId: 'upi-payments',
                        actionTypeId: "",
                        extra: { amount, payee }
                    }
                ]
            });
        } catch (error) {
            console.error("Failed to schedule notification", error);
        }
    },

    async cleanup() {
        if (SmsService.listener) {
            SmsService.listener.remove();
            SmsService.listener = null;
        }
        if (SmsService.notifListener) {
            SmsService.notifListener.remove();
            SmsService.notifListener = null;
        }
        if (Capacitor.isNativePlatform()) {
            try { await SmsReceiver.stopWatching(); } catch (e) { /* ignore */ }
        }
    }
};
