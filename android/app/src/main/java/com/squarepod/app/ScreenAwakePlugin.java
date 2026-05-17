package com.squarepod.app;

import android.app.Activity;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenAwake")
public class ScreenAwakePlugin extends Plugin {
    @PluginMethod
    public void setKeepAwake(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            if (enabled) {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }

            JSObject result = new JSObject();
            result.put("enabled", enabled);
            call.resolve(result);
        });
    }
}
