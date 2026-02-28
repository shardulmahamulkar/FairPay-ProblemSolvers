package com.fairpay.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import android.Manifest;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;
import android.content.SharedPreferences;

public class SmsBackgroundReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsBackgroundReceiver";
    private static final String CHANNEL_ID = "upi-payments";
    
    // Patterns matching JS implementation
    private static final Pattern[] AMOUNT_PATTERNS = {
        Pattern.compile("(?:sent|paid)\\s+(?:rs\\.?|inr)\\s*([0-9,]+(?:\\.[0-9]+)?)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(?:rs\\.?|inr)\\s*([0-9,]+(?:\\.[0-9]+)?)\\s*(?:debited|has been)", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(?:debited.*?)(?:rs\\.?|inr)\\s*([0-9,]+(?:\\.[0-9]+)?)", Pattern.CASE_INSENSITIVE)
    };
    
    private static final Pattern PAYEE_PATTERN = Pattern.compile("(?:to|at)\\s+([A-Za-z0-9][A-Za-z0-9.\\s@\\-_]{1,30}?)(?:\\s+on|\\s+ref|\\s*\\.|$)", Pattern.CASE_INSENSITIVE);

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }

        try {
            SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (messages != null && messages.length > 0) {
                StringBuilder bodyBuilder = new StringBuilder();
                for (SmsMessage msg : messages) {
                    bodyBuilder.append(msg.getMessageBody());
                }
                
                String body = bodyBuilder.toString();
                Log.d(TAG, "Static SMS received: " + body);
                
                processSms(context, body);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to process SMS in background", e);
        }
    }

    private void processSms(Context context, String message) {
        String lower = message.toLowerCase();
        boolean isPayment = lower.contains("debited") || lower.contains("sent") || 
                           lower.contains("paid") || lower.contains("upi");
                           
        if (!isPayment) return;

        String amountStr = null;
        for (Pattern p : AMOUNT_PATTERNS) {
            Matcher m = p.matcher(message);
            if (m.find()) {
                amountStr = m.group(1);
                break;
            }
        }

        if (amountStr == null) return;

        double amount;
        try {
            amount = Double.parseDouble(amountStr.replace(",", ""));
        } catch (NumberFormatException e) {
            return;
        }

        if (amount <= 0) return;

        String payee = "";
        Matcher payeeMatcher = PAYEE_PATTERN.matcher(message);
        if (payeeMatcher.find()) {
            payee = payeeMatcher.group(1).trim();
        }

        Log.d(TAG, "Background UPI Payment detected: Rs." + amount + " to " + payee);
        savePayment(context, amount, payee, message);
        showNotification(context, amount, payee);
    }

    private void savePayment(Context context, double amount, String payee, String fullMessage) {
        SharedPreferences prefs = context.getSharedPreferences("FairPaySmsPrefs", Context.MODE_PRIVATE);
        String currentJson = prefs.getString("pending_payments", "[]");
        try {
            JSONArray array = new JSONArray(currentJson);
            JSONObject payment = new JSONObject();
            payment.put("amount", amount);
            payment.put("payee", payee);
            payment.put("fullMessage", fullMessage);
            payment.put("timestamp", System.currentTimeMillis());
            array.put(payment);
            
            prefs.edit().putString("pending_payments", array.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed to save payment", e);
        }
    }

    private void showNotification(Context context, double amount, String payee) {
        // Need to check POST_NOTIFICATIONS permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "Cannot show notification, permission denied");
                return;
            }
        }

        createNotificationChannel(context);

        // Intent to launch the app
        Intent clickIntent = new Intent(context, MainActivity.class);
        clickIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        clickIntent.putExtra("upi_amount", amount);
        clickIntent.putExtra("upi_payee", payee);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            (int) System.currentTimeMillis(),
            clickIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String payeeText = payee.isEmpty() ? "" : " to " + payee;
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info) // Fallback icon
                .setContentTitle("💸 New Payment Detected!")
                .setContentText(String.format("Paid ₹%.2f%s. Tap to add as a shared expense.", amount, payeeText))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

        int notificationId = (int) System.currentTimeMillis();
        NotificationManagerCompat.from(context).notify(notificationId, builder.build());
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "UPI Payments";
            String description = "Detected UPI payment alerts";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            // Register the channel with the system
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
