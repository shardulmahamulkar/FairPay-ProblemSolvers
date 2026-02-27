import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Helper type to bypass TypeScript issues on window.SMSReceive
declare global {
    interface Window {
        SMSReceive?: {
            startWatch: (success: () => void, error: (err: any) => void) => void;
            stopWatch: (success: () => void, error: (err: any) => void) => void;
        };
    }
}

export const SmsService = {
    async initialize() {
        if (!Capacitor.isNativePlatform()) return;

        // Check notification permissions first to ensure we can show the popup
        const permStatus = await LocalNotifications.requestPermissions();
        if (permStatus.display !== 'granted') {
            console.warn("Notification permissions not granted! Cannot show UPI popups.");
            return;
        }

        // Set up Local Notification interaction listener
        LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
            console.log('User interacted with Notification!', notificationAction);

            const { amount, note } = notificationAction.notification.extra || {};

            // We can use a custom event or directly navigate the user to NewExpense window
            // Let's fire a global CustomEvent that AppLayout or NewExpensePage listens to
            window.dispatchEvent(new CustomEvent('new_upi_expense', { detail: { amount, note } }));
        });

        if (window.SMSReceive) {
            window.SMSReceive.startWatch(
                () => console.log("SMS Watch started! Listening for UPI payments..."),
                (err) => console.error("Could not start SMS watch", err)
            );

            document.addEventListener('onSMSArrive', (e: any) => {
                const SMS = e.data;
                if (!SMS || !SMS.body) return;

                const message = SMS.body;
                console.log("New SMS arrived", message);

                SmsService.processSmsMessage(message);
            });
        } else {
            console.warn("cordova-plugin-sms-receive not installed or available.");
        }
    },

    processSmsMessage(message: string) {
        const isPaymentMessage = message.toLowerCase().includes('upi') || message.toLowerCase().includes('debited') || message.toLowerCase().includes('sent');
        if (!isPaymentMessage) return;

        // Look for Rs. X.XX or INR X.XX
        // Handles expressions like "Sent Rs. 2.00", "Rs.20.00 debited from...", "INR 50.00 Paid"
        const sentMatch = message.match(/(?:Sent|Paid) (?:Rs\.?|INR)\s*([0-9.,]+)/i);
        const debitedMatch = message.match(/(?:Rs\.?|INR)\s*([0-9.,]+).*debited/i);

        let amountStr = null;
        if (sentMatch && sentMatch[1]) {
            amountStr = sentMatch[1];
        } else if (debitedMatch && debitedMatch[1]) {
            amountStr = debitedMatch[1];
        }

        if (amountStr) {
            const amountNum = parseFloat(amountStr.replace(/,/g, ''));
            if (amountNum > 0) {
                // We found a UPI payment! Fire a local notification asking the user
                SmsService.showExpenseNotification(amountNum, message);
            }
        }
    },

    async showExpenseNotification(amount: number, fullMessage: string) {
        // Generate a random ID for the notification
        const notificationId = Math.floor(Math.random() * 1000000);

        // Extract payee if possible to populate note
        let payee = "";
        const toMatch = fullMessage.match(/to\s+([A-Za-z0-9.@\-_]+)/i);
        if (toMatch && toMatch[1]) payee = toMatch[1];

        await LocalNotifications.schedule({
            notifications: [
                {
                    title: "New Payment Detected! 💸",
                    body: `You just paid Rs.${amount}. Was this for a trip? Tap to split it.`,
                    id: notificationId,
                    schedule: { at: new Date(Date.now() + 1000) }, // ~1 sec from now
                    actionTypeId: "",
                    extra: {
                        amount: amount,
                        note: payee ? `Payment to ${payee}` : "UPI Payment"
                    }
                }
            ]
        });
    }
};
