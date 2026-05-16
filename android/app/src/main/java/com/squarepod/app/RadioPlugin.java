package com.squarepod.app;

import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Radio")
public class RadioPlugin extends Plugin {
    private static final String FEATURE_BROADCAST_RADIO = "android.hardware.broadcastradio";
    private AudioManager audioManager;
    private AudioDeviceCallback audioDeviceCallback;
    private Double frequency;
    private boolean isPlaying = false;

    @Override
    public void load() {
        super.load();
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && audioManager != null) {
            audioDeviceCallback = new AudioDeviceCallback() {
                @Override
                public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                    publishStatus();
                }

                @Override
                public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                    if (!wiredHeadsetConnected()) {
                        isPlaying = false;
                    }
                    publishStatus();
                }
            };
            audioManager.registerAudioDeviceCallback(audioDeviceCallback, null);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(statusPayload());
    }

    @PluginMethod
    public void scanStations(PluginCall call) {
        String block = blockingReason();
        if (block != null) {
            call.reject(block);
            return;
        }

        JSObject payload = new JSObject();
        payload.put("stations", new JSArray());
        payload.put("status", statusPayload("Radio backend unavailable"));
        call.resolve(payload);
    }

    @PluginMethod
    public void tune(PluginCall call) {
        Double requestedFrequency = call.getDouble("frequency");
        if (requestedFrequency == null) {
            call.reject("Missing FM frequency.");
            return;
        }

        String block = blockingReason();
        if (block != null) {
            call.reject(block);
            return;
        }

        frequency = requestedFrequency;
        call.reject("Radio backend unavailable");
        publishStatus("Radio backend unavailable");
    }

    @PluginMethod
    public void seekUp(PluginCall call) {
        String block = blockingReason();
        call.reject(block != null ? block : "Radio backend unavailable");
    }

    @PluginMethod
    public void seekDown(PluginCall call) {
        String block = blockingReason();
        call.reject(block != null ? block : "Radio backend unavailable");
    }

    @PluginMethod
    public void start(PluginCall call) {
        String block = blockingReason();
        call.reject(block != null ? block : "Radio backend unavailable");
    }

    @PluginMethod
    public void stop(PluginCall call) {
        isPlaying = false;
        call.resolve(statusPayload());
        publishStatus();
    }

    @Override
    protected void handleOnDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && audioManager != null && audioDeviceCallback != null) {
            audioManager.unregisterAudioDeviceCallback(audioDeviceCallback);
        }
        super.handleOnDestroy();
    }

    private String blockingReason() {
        if (!wiredHeadsetConnected()) {
            isPlaying = false;
            return "Insert wired headphones";
        }
        if (!radioHardwareFeaturePresent()) {
            isPlaying = false;
            return "Radio hardware missing";
        }
        if (!radioBackendAvailable()) {
            isPlaying = false;
            return "Radio backend unavailable";
        }
        return null;
    }

    private JSObject statusPayload() {
        return statusPayload(messageForStatus());
    }

    private JSObject statusPayload(String message) {
        JSObject payload = new JSObject();
        payload.put("wiredHeadsetConnected", wiredHeadsetConnected());
        payload.put("radioHardwareFeaturePresent", radioHardwareFeaturePresent());
        payload.put("radioBackendAvailable", radioBackendAvailable());
        payload.put("isPlaying", isPlaying);
        payload.put("message", message);
        if (frequency != null) {
            payload.put("frequency", frequency);
        }
        return payload;
    }

    private String messageForStatus() {
        if (!wiredHeadsetConnected()) return "Insert wired headphones";
        if (!radioHardwareFeaturePresent()) return "Radio hardware missing";
        if (!radioBackendAvailable()) return "Radio backend unavailable";
        return isPlaying ? "Radio playing" : "Radio ready";
    }

    private boolean wiredHeadsetConnected() {
        if (audioManager == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
            for (AudioDeviceInfo device : devices) {
                int type = device.getType();
                if (type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || type == AudioDeviceInfo.TYPE_WIRED_HEADSET) {
                    return true;
                }
            }
            return false;
        }
        return audioManager.isWiredHeadsetOn();
    }

    private boolean radioHardwareFeaturePresent() {
        PackageManager packageManager = getContext().getPackageManager();
        return packageManager != null && packageManager.hasSystemFeature(FEATURE_BROADCAST_RADIO);
    }

    private boolean radioBackendAvailable() {
        return false;
    }

    private void publishStatus() {
        notifyListeners("radioStatus", statusPayload());
    }

    private void publishStatus(String message) {
        notifyListeners("radioStatus", statusPayload(message));
        JSObject error = new JSObject();
        error.put("message", message);
        notifyListeners("radioError", error);
    }
}
