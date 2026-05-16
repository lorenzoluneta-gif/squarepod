package com.squarepod.app;

import android.Manifest;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.media.MediaMetadataRetriever;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.text.TextUtils;
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
import java.io.FileFilter;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "LocalMusic",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_MEDIA_AUDIO }, alias = "audio"),
        @Permission(strings = { Manifest.permission.READ_EXTERNAL_STORAGE }, alias = "storage")
    }
)
public class LocalMusicPlugin extends Plugin {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final List<LocalTrack> queue = new ArrayList<>();
    private MediaPlayer player;
    private int currentIndex = -1;
    private boolean prepared = false;
    private boolean shuffle = false;
    private String repeatMode = "off";
    private final Runnable progressTicker = new Runnable() {
        @Override
        public void run() {
            notifyState();
            mainHandler.postDelayed(this, 1000);
        }
    };

    @PluginMethod
    public void scanLibrary(PluginCall call) {
        if (!hasAudioPermission()) {
            requestPermissionForAlias(permissionAlias(), call, "scanLibraryPermissionCallback");
            return;
        }
        call.resolve(scanPayload());
    }

    @PermissionCallback
    private void scanLibraryPermissionCallback(PluginCall call) {
        if (!hasAudioPermission()) {
            call.reject("Audio library permission denied.");
            return;
        }
        call.resolve(scanPayload());
    }

    @PluginMethod
    public void playQueue(PluginCall call) {
        JSArray tracks = call.getArray("tracks");
        int startIndex = call.getInt("startIndex", 0);
        boolean nextShuffle = call.getBoolean("shuffle", false);
        String nextRepeat = call.getString("repeatMode", "off");

        if (tracks == null || tracks.length() == 0) {
            call.reject("Missing local music queue.");
            return;
        }

        List<LocalTrack> nextQueue = new ArrayList<>();
        for (int index = 0; index < tracks.length(); index += 1) {
            JSObject item = trackAt(tracks, index);
            LocalTrack track = LocalTrack.fromJS(item);
            if (track != null) nextQueue.add(track);
        }

        if (nextQueue.isEmpty()) {
            call.reject("No playable local tracks.");
            return;
        }

        queue.clear();
        queue.addAll(nextQueue);
        shuffle = nextShuffle;
        repeatMode = normalizeRepeat(nextRepeat);
        currentIndex = Math.max(0, Math.min(startIndex, queue.size() - 1));
        playCurrent(call);
    }

    @PluginMethod
    public void play(PluginCall call) {
        if (player == null || !prepared) {
            if (currentIndex >= 0 && currentIndex < queue.size()) {
                playCurrent(call);
                return;
            }
            call.reject("No local track is loaded.");
            return;
        }
        player.start();
        startTicker();
        resolveWithState(call);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (player != null && prepared && player.isPlaying()) {
            player.pause();
        }
        resolveWithState(call);
    }

    @PluginMethod
    public void next(PluginCall call) {
        if (queue.isEmpty()) {
            call.reject("No local music queue.");
            return;
        }
        currentIndex = nextIndex();
        playCurrent(call);
    }

    @PluginMethod
    public void previous(PluginCall call) {
        if (queue.isEmpty()) {
            call.reject("No local music queue.");
            return;
        }
        currentIndex = Math.max(0, currentIndex - 1);
        playCurrent(call);
    }

    @PluginMethod
    public void seek(PluginCall call) {
        int position = call.getInt("position", 0);
        if (player != null && prepared) {
            player.seekTo(Math.max(0, position) * 1000);
        }
        resolveWithState(call);
    }

    @PluginMethod
    public void setShuffle(PluginCall call) {
        shuffle = call.getBoolean("enabled", false);
        resolveWithState(call);
    }

    @PluginMethod
    public void setRepeat(PluginCall call) {
        repeatMode = normalizeRepeat(call.getString("mode", "off"));
        resolveWithState(call);
    }

    @PluginMethod
    public void getState(PluginCall call) {
        resolveWithState(call);
    }

    @Override
    protected void handleOnDestroy() {
        stopTicker();
        releasePlayer();
        super.handleOnDestroy();
    }

    private JSObject scanPayload() {
        List<LocalTrack> tracks = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        Set<String> seenPaths = new HashSet<>();
        tracks.addAll(scanMediaStore(seen, seenPaths));
        tracks.addAll(scanAppMusicDirectory(seen, seenPaths));
        tracks.addAll(scanPublicSquarePodDirectory(seen, seenPaths));
        Collections.sort(tracks, Comparator
            .comparing((LocalTrack track) -> safe(track.artist).toLowerCase(Locale.ROOT))
            .thenComparing(track -> safe(track.album).toLowerCase(Locale.ROOT))
            .thenComparingInt(track -> track.trackNumber)
            .thenComparing(track -> safe(track.title).toLowerCase(Locale.ROOT)));

        JSArray trackArray = new JSArray();
        for (LocalTrack track : tracks) {
            trackArray.put(track.toJS());
        }

        JSObject payload = new JSObject();
        payload.put("tracks", trackArray);
        payload.put("musicDirectory", appMusicDirectory().getAbsolutePath());
        return payload;
    }

    private List<LocalTrack> scanMediaStore(Set<String> seen, Set<String> seenPaths) {
        List<LocalTrack> tracks = new ArrayList<>();
        String[] projection = {
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.TRACK,
            MediaStore.Audio.Media.ALBUM_ID,
        };
        String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";

        try (Cursor cursor = getContext().getContentResolver().query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            null,
            MediaStore.Audio.Media.TITLE + " ASC"
        )) {
            if (cursor == null) return tracks;
            int idIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            int dataIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA);
            int titleIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
            int artistIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
            int albumIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
            int durationIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
            int trackIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK);
            int albumIdIndex = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID);

            while (cursor.moveToNext()) {
                long id = cursor.getLong(idIndex);
                Uri uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                String uriString = uri.toString();
                if (!seen.add(uriString)) continue;
                String path = cursor.getString(dataIndex);
                if (!TextUtils.isEmpty(path)) seenPaths.add(path);
                long albumId = cursor.getLong(albumIdIndex);
                String trackId = "mediastore_" + id;
                String artworkUri = null;
                if (!TextUtils.isEmpty(path)) {
                    artworkUri = extractEmbeddedArtwork(path, trackId);
                }
                if (artworkUri == null) {
                    artworkUri = cacheAlbumArtwork(albumId, trackId);
                }
                tracks.add(new LocalTrack(
                    trackId,
                    uriString,
                    safeTitle(cursor.getString(titleIndex), uriString),
                    safeArtist(cursor.getString(artistIndex)),
                    safeAlbum(cursor.getString(albumIndex)),
                    Math.max(1, Math.round(cursor.getLong(durationIndex) / 1000f)),
                    Math.max(0, cursor.getInt(trackIndex) % 1000),
                    artworkUri
                ));
            }
        } catch (Throwable ignored) {
            return tracks;
        }
        return tracks;
    }

    private List<LocalTrack> scanAppMusicDirectory(Set<String> seen, Set<String> seenPaths) {
        List<LocalTrack> tracks = new ArrayList<>();
        File directory = appMusicDirectory();
        if (!directory.exists()) directory.mkdirs();
        scanFilesRecursive(directory, seen, seenPaths, tracks);
        return tracks;
    }

    private List<LocalTrack> scanPublicSquarePodDirectory(Set<String> seen, Set<String> seenPaths) {
        List<LocalTrack> tracks = new ArrayList<>();
        File musicRoot = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC);
        File directory = new File(musicRoot, "SquarePod");
        if (!directory.exists()) return tracks;
        scanFilesRecursive(directory, seen, seenPaths, tracks);
        return tracks;
    }

    private void scanFilesRecursive(File directory, Set<String> seen, Set<String> seenPaths, List<LocalTrack> tracks) {
        File[] files = directory.listFiles(new FileFilter() {
            @Override
            public boolean accept(File file) {
                return file.isDirectory() || isAudioFile(file.getName());
            }
        });
        if (files == null) return;

        for (File file : files) {
            if (file.isDirectory()) {
                scanFilesRecursive(file, seen, seenPaths, tracks);
                continue;
            }
            String path = file.getAbsolutePath();
            if (!seenPaths.add(path)) continue;
            Uri uri = Uri.fromFile(file);
            String uriString = uri.toString();
            if (!seen.add(uriString)) continue;
            tracks.add(trackFromFile(file, uriString));
        }
    }

    private LocalTrack trackFromFile(File file, String uriString) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(file.getAbsolutePath());
            String title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
            String artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
            String album = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
            String duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            String trackNumber = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER);
            String trackId = "file_" + Math.abs(uriString.hashCode());
            return new LocalTrack(
                trackId,
                uriString,
                safeTitle(title, file.getName()),
                safeArtist(artist),
                safeAlbum(album),
                parseDuration(duration),
                parseTrackNumber(trackNumber),
                writeArtwork(retriever.getEmbeddedPicture(), trackId)
            );
        } catch (Throwable ignored) {
            return new LocalTrack(
                "file_" + Math.abs(uriString.hashCode()),
                uriString,
                safeTitle(null, file.getName()),
                "Unknown Artist",
                "Unknown Album",
                1,
                0,
                null
            );
        } finally {
            try {
                retriever.release();
            } catch (IOException ignored) {}
        }
    }

    private void playCurrent(PluginCall call) {
        if (currentIndex < 0 || currentIndex >= queue.size()) {
            call.reject("No local track selected.");
            return;
        }
        LocalTrack track = queue.get(currentIndex);
        try {
            releasePlayer();
            prepared = false;
            player = new MediaPlayer();
            player.setDataSource(getContext(), Uri.parse(track.uri));
            player.setOnPreparedListener(mediaPlayer -> {
                prepared = true;
                mediaPlayer.start();
                startTicker();
                resolveWithState(call);
            });
            player.setOnCompletionListener(mediaPlayer -> {
                if ("one".equals(repeatMode)) {
                    mediaPlayer.seekTo(0);
                    mediaPlayer.start();
                    notifyState();
                    return;
                }
                if (currentIndex < queue.size() - 1 || "all".equals(repeatMode) || shuffle) {
                    currentIndex = nextIndex();
                    playCurrent(null);
                } else {
                    notifyState();
                }
            });
            player.setOnErrorListener((mediaPlayer, what, extra) -> {
                JSObject payload = new JSObject();
                payload.put("message", "Local playback failed: " + what + "/" + extra);
                notifyListeners("playbackError", payload);
                return true;
            });
            player.prepareAsync();
        } catch (Throwable error) {
            call.reject("Unable to play local track: " + rootMessage(error));
        }
    }

    private int nextIndex() {
        if (queue.isEmpty()) return -1;
        if (shuffle && queue.size() > 1) {
            int next = (int) Math.floor(Math.random() * queue.size());
            return next == currentIndex ? (next + 1) % queue.size() : next;
        }
        if (currentIndex < queue.size() - 1) return currentIndex + 1;
        return "all".equals(repeatMode) ? 0 : currentIndex;
    }

    private void resolveWithState(PluginCall call) {
        if (call != null) call.resolve(statePayload());
        notifyState();
    }

    private void notifyState() {
        notifyListeners("playbackState", statePayload());
    }

    private JSObject statePayload() {
        JSObject payload = new JSObject();
        boolean isPlaying = player != null && prepared && player.isPlaying();
        payload.put("isPlaying", isPlaying);
        payload.put("state", isPlaying ? "playing" : prepared ? "paused" : "stopped");
        payload.put("position", player != null && prepared ? Math.max(0, player.getCurrentPosition() / 1000) : 0);
        payload.put("duration", player != null && prepared ? Math.max(1, player.getDuration() / 1000) : 0);
        payload.put("shuffle", shuffle);
        payload.put("repeatMode", repeatMode);
        payload.put("index", currentIndex);
        payload.put("queueLength", queue.size());
        if (currentIndex >= 0 && currentIndex < queue.size()) {
            payload.put("track", queue.get(currentIndex).toJS());
        }
        return payload;
    }

    private void releasePlayer() {
        if (player != null) {
            player.reset();
            player.release();
            player = null;
        }
        prepared = false;
    }

    private void startTicker() {
        mainHandler.removeCallbacks(progressTicker);
        mainHandler.postDelayed(progressTicker, 1000);
    }

    private void stopTicker() {
        mainHandler.removeCallbacks(progressTicker);
    }

    private boolean hasAudioPermission() {
        return getPermissionState(permissionAlias()) == PermissionState.GRANTED
            || Build.VERSION.SDK_INT < Build.VERSION_CODES.M;
    }

    private String permissionAlias() {
        return Build.VERSION.SDK_INT >= 33 ? "audio" : "storage";
    }

    private File appMusicDirectory() {
        File base = getContext().getExternalFilesDir(null);
        if (base == null) base = getContext().getFilesDir();
        return new File(base, "Music");
    }

    private String extractEmbeddedArtwork(String path, String trackId) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(path);
            return writeArtwork(retriever.getEmbeddedPicture(), trackId);
        } catch (Throwable ignored) {
            return null;
        } finally {
            try {
                retriever.release();
            } catch (IOException ignored) {}
        }
    }

    private String cacheAlbumArtwork(long albumId, String trackId) {
        if (albumId <= 0) return null;
        Uri uri = ContentUris.withAppendedId(
            Uri.parse("content://media/external/audio/albumart"),
            albumId
        );
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) return null;
            byte[] bytes = readAllBytes(input);
            return writeArtwork(bytes, trackId);
        } catch (Throwable ignored) {
            return null;
        }
    }

    private String writeArtwork(byte[] bytes, String trackId) {
        if (bytes == null || bytes.length == 0) return null;
        File directory = new File(getContext().getCacheDir(), "artwork");
        if (!directory.exists() && !directory.mkdirs()) return null;
        String extension = artworkExtension(bytes);
        File file = new File(directory, safeFileName(trackId) + extension);
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(bytes);
            return Uri.fromFile(file).toString();
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static byte[] readAllBytes(InputStream input) throws IOException {
        byte[] buffer = new byte[8192];
        int read;
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static String artworkExtension(byte[] bytes) {
        if (bytes.length >= 8
            && (bytes[0] & 0xff) == 0x89
            && bytes[1] == 0x50
            && bytes[2] == 0x4e
            && bytes[3] == 0x47) {
            return ".png";
        }
        if (bytes.length >= 3
            && (bytes[0] & 0xff) == 0xff
            && (bytes[1] & 0xff) == 0xd8
            && (bytes[2] & 0xff) == 0xff) {
            return ".jpg";
        }
        return ".jpg";
    }

    private static String safeFileName(String value) {
        return value.replaceAll("[^a-zA-Z0-9_.-]", "_");
    }

    private static boolean isAudioFile(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.endsWith(".mp3")
            || lower.endsWith(".m4a")
            || lower.endsWith(".aac")
            || lower.endsWith(".flac")
            || lower.endsWith(".wav")
            || lower.endsWith(".ogg")
            || lower.endsWith(".opus");
    }

    private static String normalizeRepeat(String value) {
        if ("one".equals(value) || "all".equals(value)) return value;
        return "off";
    }

    private static int parseDuration(String value) {
        try {
            return Math.max(1, Math.round(Long.parseLong(value) / 1000f));
        } catch (Throwable ignored) {
            return 1;
        }
    }

    private static int parseTrackNumber(String value) {
        if (TextUtils.isEmpty(value)) return 0;
        try {
            return Math.max(0, Integer.parseInt(value.replaceAll("[^0-9]", "")) % 1000);
        } catch (Throwable ignored) {
            return 0;
        }
    }

    private static String safe(String value) {
        return TextUtils.isEmpty(value) ? "" : value;
    }

    private static String safeTitle(String value, String fallback) {
        return TextUtils.isEmpty(value) ? fallback.replaceFirst("\\.[^.]+$", "") : value;
    }

    private static String safeArtist(String value) {
        return TextUtils.isEmpty(value) || "<unknown>".equals(value) ? "Unknown Artist" : value;
    }

    private static String safeAlbum(String value) {
        return TextUtils.isEmpty(value) || "<unknown>".equals(value) ? "Unknown Album" : value;
    }

    private static String rootMessage(Throwable error) {
        Throwable root = error;
        while (root != null && root.getCause() != null) {
            root = root.getCause();
        }
        if (root == null) return "Unknown error";
        return root.getMessage() != null ? root.getMessage() : root.getClass().getSimpleName();
    }

    private static JSObject trackAt(JSArray array, int index) {
        try {
            Object value = array.get(index);
            if (value instanceof JSObject) return (JSObject) value;
            if (value instanceof JSONObject) return JSObject.fromJSONObject((JSONObject) value);
        } catch (Throwable ignored) {}
        return null;
    }

    private static class LocalTrack {
        final String id;
        final String uri;
        final String title;
        final String artist;
        final String album;
        final int duration;
        final int trackNumber;
        final String artworkUri;

        LocalTrack(String id, String uri, String title, String artist, String album, int duration, int trackNumber, String artworkUri) {
            this.id = id;
            this.uri = uri;
            this.title = title;
            this.artist = artist;
            this.album = album;
            this.duration = duration;
            this.trackNumber = trackNumber;
            this.artworkUri = artworkUri;
        }

        JSObject toJS() {
            JSObject object = new JSObject();
            object.put("id", id);
            object.put("uri", uri);
            object.put("title", title);
            object.put("artist", artist);
            object.put("album", album);
            object.put("duration", duration);
            object.put("trackNumber", trackNumber);
            if (artworkUri != null) object.put("artworkUri", artworkUri);
            return object;
        }

        static LocalTrack fromJS(JSObject object) {
            if (object == null) return null;
            String uri = object.getString("uri");
            if (TextUtils.isEmpty(uri)) return null;
            return new LocalTrack(
                object.getString("id", "track_" + Math.abs(uri.hashCode())),
                uri,
                object.getString("title", "Unknown Track"),
                object.getString("artist", "Unknown Artist"),
                object.getString("album", "Unknown Album"),
                object.getInteger("duration", 1),
                object.getInteger("trackNumber", 0),
                object.getString("artworkUri")
            );
        }
    }
}
