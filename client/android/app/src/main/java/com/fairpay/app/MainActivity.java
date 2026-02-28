package com.fairpay.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmsReceiverPlugin.class);
        super.onCreate(savedInstanceState);
        
        // Handle intent if started from a notification
        handleIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.hasExtra("upi_amount")) {
            double amount = intent.getDoubleExtra("upi_amount", 0.0);
            String payee = intent.getStringExtra("upi_payee");
            
            // Forward this data to the SmsReceiverPlugin to broadcast to JS
            SmsReceiverPlugin plugin = (SmsReceiverPlugin) this.bridge.getPlugin("SmsReceiver").getInstance();
            if (plugin != null) {
                JSObject data = new JSObject();
                data.put("amount", amount);
                data.put("payee", payee != null ? payee : "");
                plugin.notifyAppOpenFromNotification(data);
            }
        }
    }
}
