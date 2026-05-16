package com.squarepod.app;

import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceStatus")
public class DeviceStatusPlugin extends Plugin {
    @PluginMethod
    public void getBattery(PluginCall call) {
        Intent batteryStatus = getContext().registerReceiver(
            null,
            new IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        );

        if (batteryStatus == null) {
            call.reject("Battery status unavailable.");
            return;
        }

        int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean charging = status == BatteryManager.BATTERY_STATUS_CHARGING
            || status == BatteryManager.BATTERY_STATUS_FULL;

        if (level < 0 || scale <= 0) {
            call.reject("Battery level unavailable.");
            return;
        }

        JSObject result = new JSObject();
        result.put("percent", Math.max(0, Math.min(100, Math.round((level * 100f) / scale))));
        result.put("charging", charging);
        call.resolve(result);
    }
}
