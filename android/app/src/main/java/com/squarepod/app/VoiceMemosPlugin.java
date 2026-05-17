package com.squarepod.app;

import android.Manifest;
import android.media.MediaMetadataRetriever;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.Comparator;

@CapacitorPlugin(
    name = "VoiceMemos",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class VoiceMemosPlugin extends Plugin {
    private MediaRecorder recorder;
    private MediaPlayer player;
    private File activeRecording;

    @PluginMethod
    public void list(PluginCall call) {
        call.resolve(payload());
    }

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "recordPermissionCallback");
            return;
        }
        startRecordingNow(call);
    }

    @PermissionCallback
    private void recordPermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission denied.");
            return;
        }
        startRecordingNow(call);
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        if (recorder == null) {
            call.resolve(payload());
            return;
        }
        try {
            recorder.stop();
        } catch (RuntimeException error) {
            if (activeRecording != null) activeRecording.delete();
        } finally {
            recorder.release();
            recorder = null;
            activeRecording = null;
        }
        call.resolve(payload());
    }

    @PluginMethod
    public void play(PluginCall call) {
        String id = call.getString("id", "");
        File file = memoFile(id);
        if (file == null || !file.exists()) {
            call.reject("Voice memo not found.");
            return;
        }
        stopPlayer();
        try {
            player = new MediaPlayer();
            player.setDataSource(file.getAbsolutePath());
            player.setOnCompletionListener(done -> stopPlayer());
            player.prepare();
            player.start();
            call.resolve(payload());
        } catch (IOException | RuntimeException error) {
            stopPlayer();
            call.reject("Voice memo playback failed: " + error.getMessage());
        }
    }

    @PluginMethod
    public void delete(PluginCall call) {
        String id = call.getString("id", "");
        File file = memoFile(id);
        if (file == null || !file.exists()) {
            call.reject("Voice memo not found.");
            return;
        }
        if (activeRecording != null && activeRecording.equals(file)) {
            call.reject("Cannot delete active recording.");
            return;
        }
        if (!file.delete()) {
            call.reject("Unable to delete voice memo.");
            return;
        }
        call.resolve(payload());
    }

    private void startRecordingNow(PluginCall call) {
        if (recorder != null) {
            call.reject("Voice memo recording is already active.");
            return;
        }
        stopPlayer();
        File directory = memoDirectory();
        if (!directory.exists() && !directory.mkdirs()) {
            call.reject("Unable to create voice memo directory.");
            return;
        }
        activeRecording = new File(directory, "memo_" + System.currentTimeMillis() + ".m4a");
        try {
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioEncodingBitRate(96000);
            recorder.setAudioSamplingRate(44100);
            recorder.setOutputFile(activeRecording.getAbsolutePath());
            recorder.prepare();
            recorder.start();
            call.resolve(payload());
        } catch (IOException | RuntimeException error) {
            if (recorder != null) {
                recorder.release();
                recorder = null;
            }
            if (activeRecording != null) activeRecording.delete();
            activeRecording = null;
            call.reject("Voice memo recording failed: " + error.getMessage());
        }
    }

    private JSObject payload() {
        JSObject object = new JSObject();
        object.put("memos", scanMemos());
        object.put("isRecording", recorder != null);
        if (activeRecording != null) object.put("activeMemoId", idForFile(activeRecording));
        return object;
    }

    private JSArray scanMemos() {
        JSArray array = new JSArray();
        File[] files = memoDirectory().listFiles(file -> file.isFile() && file.getName().endsWith(".m4a"));
        if (files == null) return array;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
        for (File file : files) {
            JSObject item = new JSObject();
            item.put("id", idForFile(file));
            item.put("uri", Uri.fromFile(file).toString());
            item.put("title", titleForFile(file));
            item.put("duration", durationForFile(file));
            item.put("createdAt", file.lastModified());
            item.put("size", file.length());
            array.put(item);
        }
        return array;
    }

    private File memoDirectory() {
        return new File(getContext().getFilesDir(), "Voice Memos");
    }

    private String idForFile(File file) {
        String name = file.getName();
        return name.endsWith(".m4a") ? name.substring(0, name.length() - 4) : name;
    }

    private File memoFile(String id) {
        if (id == null || id.isEmpty() || id.contains("/") || id.contains("\\")) return null;
        return new File(memoDirectory(), id.endsWith(".m4a") ? id : id + ".m4a");
    }

    private String titleForFile(File file) {
        return "Memo " + android.text.format.DateFormat.format("yyyy-MM-dd HH:mm", file.lastModified());
    }

    private long durationForFile(File file) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(file.getAbsolutePath());
            String value = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            return value == null ? 0 : Long.parseLong(value);
        } catch (Throwable ignored) {
            return 0;
        } finally {
            try {
                retriever.release();
            } catch (IOException ignored) {}
        }
    }

    private void stopPlayer() {
        if (player == null) return;
        try {
            player.stop();
        } catch (RuntimeException ignored) {}
        player.release();
        player = null;
    }
}
