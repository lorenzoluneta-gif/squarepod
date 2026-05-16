package com.squarepod.app;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WheelHaptics")
public class WheelHapticsPlugin extends Plugin {
    private static final int MAX_TICKS = 4;
    private static final long TICK_MS = 16;
    private static final long GAP_MS = 10;
    private static final int AMPLITUDE = 255;

    @PluginMethod
    public void tick(PluginCall call) {
        int count = Math.max(1, Math.min(MAX_TICKS, call.getInt("count", 1)));
        long tickMs = Math.max(1, Math.min(45, call.getInt("durationMs", (int) TICK_MS)));
        long gapMs = Math.max(0, Math.min(45, call.getInt("gapMs", (int) GAP_MS)));
        int amplitude = Math.max(1, Math.min(255, call.getInt("amplitude", AMPLITUDE)));
        Vibrator vibrator = vibrator();
        if (vibrator == null || !vibrator.hasVibrator()) {
            call.resolve();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            long[] timings = new long[count * 2];
            int[] amplitudes = new int[count * 2];
            for (int index = 0; index < count; index += 1) {
                int timingIndex = index * 2;
                timings[timingIndex] = tickMs;
                amplitudes[timingIndex] = amplitude;
                timings[timingIndex + 1] = index == count - 1 ? 0 : gapMs;
                amplitudes[timingIndex + 1] = 0;
            }
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1));
        } else {
            vibrator.vibrate(tickMs);
        }

        call.resolve();
    }

    private Vibrator vibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }

        return (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
    }
}
