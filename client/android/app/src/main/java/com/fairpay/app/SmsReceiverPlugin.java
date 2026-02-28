package com.fairpay.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "SmsReceiver",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS }
        )
    }
)
public class SmsReceiverPlugin extends Plugin {

    private static final String TAG = "SmsReceiverPlugin";
    private static final String SMS_RECEIVED_ACTION = "android.provider.Telephony.SMS_RECEIVED";
    private BroadcastReceiver smsReceiver = null;
    private boolean isWatching = false;

    @PluginMethod
    public void startWatching(PluginCall call) {
        // Check if permissions are granted, if not request them
        if (getPermissionState("sms") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermissionCallback");
            return;
        }

        startSmsReceiver(call);
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (getPermissionState("sms") == com.getcapacitor.PermissionState.GRANTED) {
            startSmsReceiver(call);
        } else {
            Log.w(TAG, "SMS permission was denied by user");
            call.resolve(new JSObject().put("started", false).put("reason", "permission_denied"));
        }
    }

    private void startSmsReceiver(PluginCall call) {
        if (isWatching) {
            Log.d(TAG, "SMS receiver already running");
            call.resolve(new JSObject().put("started", true).put("reason", "already_running"));
            return;
        }

        smsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (SMS_RECEIVED_ACTION.equals(intent.getAction())) {
                    try {
                        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
                        if (messages != null && messages.length > 0) {
                            StringBuilder body = new StringBuilder();
                            String address = messages[0].getOriginatingAddress();
                            for (SmsMessage msg : messages) {
                                body.append(msg.getMessageBody());
                            }

                            Log.d(TAG, "SMS received from " + address + ": " + body.toString());

                            JSObject data = new JSObject();
                            data.put("address", address != null ? address : "");
                            data.put("body", body.toString());
                            data.put("timestamp", System.currentTimeMillis());

                            // Fire event to the WebView
                            notifyListeners("smsReceived", data);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error processing SMS", e);
                    }
                }
            }
        };

        try {
            IntentFilter filter = new IntentFilter(SMS_RECEIVED_ACTION);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                getContext().registerReceiver(smsReceiver, filter);
            }
            isWatching = true;
            Log.d(TAG, "SMS receiver registered successfully");
            call.resolve(new JSObject().put("started", true));
        } catch (Exception e) {
            Log.e(TAG, "Failed to register SMS receiver", e);
            call.reject("Failed to start SMS watching: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopWatching(PluginCall call) {
        if (smsReceiver != null) {
            try {
                getContext().unregisterReceiver(smsReceiver);
            } catch (Exception e) {
                Log.w(TAG, "Error unregistering receiver", e);
            }
            smsReceiver = null;
            isWatching = false;
        }
        call.resolve(new JSObject().put("stopped", true));
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        boolean granted = getPermissionState("sms") == com.getcapacitor.PermissionState.GRANTED;
        call.resolve(new JSObject().put("granted", granted));
    }

    @Override
    protected void handleOnDestroy() {
        if (smsReceiver != null) {
            try {
                getContext().unregisterReceiver(smsReceiver);
            } catch (Exception e) {
                Log.w(TAG, "Error unregistering receiver on destroy", e);
            }
            smsReceiver = null;
            isWatching = false;
        }
    }

    @PluginMethod
    public void getPendingPayments(PluginCall call) {
        android.content.SharedPreferences prefs = getContext().getSharedPreferences("FairPaySmsPrefs", Context.MODE_PRIVATE);
        String currentJson = prefs.getString("pending_payments", "[]");
        
        JSObject result = new JSObject();
        try {
            result.put("payments", new com.getcapacitor.JSArray(currentJson));
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error reading pending payments", e);
            call.reject("Failed to read pending payments", e);
        }
    }

    @PluginMethod
    public void clearPendingPayments(PluginCall call) {
        android.content.SharedPreferences prefs = getContext().getSharedPreferences("FairPaySmsPrefs", Context.MODE_PRIVATE);
        prefs.edit().remove("pending_payments").apply();
        call.resolve(new JSObject().put("cleared", true));
    }

    public void notifyAppOpenFromNotification(JSObject data) {
        notifyListeners("appOpenFromSmsNotification", data);
    }
}
