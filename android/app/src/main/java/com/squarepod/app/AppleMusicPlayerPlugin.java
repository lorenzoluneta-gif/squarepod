package com.squarepod.app;

import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import com.apple.android.music.playback.controller.MediaPlayerController;
import com.apple.android.music.playback.controller.MediaPlayerControllerFactory;
import com.apple.android.music.playback.model.MediaItemType;
import com.apple.android.music.playback.model.MediaPlayerException;
import com.apple.android.music.playback.model.PlaybackRepeatMode;
import com.apple.android.music.playback.model.PlaybackShuffleMode;
import com.apple.android.music.playback.model.PlaybackState;
import com.apple.android.music.playback.model.PlayerQueueItem;
import com.apple.android.music.playback.queue.CatalogPlaybackQueueItemProvider;
import com.apple.android.music.playback.queue.PlaybackQueueItemProvider;
import com.apple.android.sdk.authentication.TokenProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "AppleMusicPlayer")
public class AppleMusicPlayerPlugin extends Plugin {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static boolean nativeLibraryLoaded = false;
    private MediaPlayerController controller;
    private String developerToken;
    private String userToken;

    private final MediaPlayerController.Listener listener = new MediaPlayerController.Listener() {
        @Override
        public void onPlayerStateRestored(MediaPlayerController mediaPlayerController) {
            notifyState();
        }

        @Override
        public void onPlaybackStateChanged(MediaPlayerController mediaPlayerController, int previousState, int currentState) {
            notifyState();
        }

        @Override
        public void onPlaybackStateUpdated(MediaPlayerController mediaPlayerController) {
            notifyState();
        }

        @Override
        public void onBufferingStateChanged(MediaPlayerController mediaPlayerController, boolean isBuffering) {
            notifyState();
        }

        @Override
        public void onCurrentItemChanged(MediaPlayerController mediaPlayerController, PlayerQueueItem previousItem, PlayerQueueItem currentItem) {
            notifyState();
        }

        @Override
        public void onItemEnded(MediaPlayerController mediaPlayerController, PlayerQueueItem item, long endPosition) {
            notifyState();
        }

        @Override
        public void onMetadataUpdated(MediaPlayerController mediaPlayerController, PlayerQueueItem item) {
            notifyState();
        }

        @Override
        public void onPlaybackQueueChanged(MediaPlayerController mediaPlayerController, List<PlayerQueueItem> queueItems) {
            notifyState();
        }

        @Override
        public void onPlaybackQueueItemsAdded(MediaPlayerController mediaPlayerController, int index, int count, int insertionType) {
            notifyState();
        }

        @Override
        public void onPlaybackError(MediaPlayerController mediaPlayerController, MediaPlayerException error) {
            JSObject payload = new JSObject();
            payload.put("message", error != null ? error.getMessage() : "Apple Music playback failed.");
            notifyListeners("playbackError", payload);
        }

        @Override
        public void onPlaybackRepeatModeChanged(MediaPlayerController mediaPlayerController, int repeatMode) {
            notifyState();
        }

        @Override
        public void onPlaybackShuffleModeChanged(MediaPlayerController mediaPlayerController, int shuffleMode) {
            notifyState();
        }
    };

    @PluginMethod
    public void playQueue(PluginCall call) {
        String nextDeveloperToken = call.getString("developerToken");
        String nextUserToken = call.getString("userToken");
        JSArray idsArray = call.getArray("songIds");
        int startIndex = call.getInt("startIndex", 0);
        boolean shuffle = call.getBoolean("shuffle", false);

        if (TextUtils.isEmpty(nextDeveloperToken) || TextUtils.isEmpty(nextUserToken)) {
            call.reject("Missing Apple Music playback tokens.");
            return;
        }
        if (idsArray == null || idsArray.length() == 0) {
            call.reject("Missing Apple Music song IDs.");
            return;
        }

        try {
            ensureNativeLibraryLoaded();
            ArrayList<String> songIds = new ArrayList<>();
            for (int index = 0; index < idsArray.length(); index += 1) {
                String id = idsArray.getString(index);
                if (!TextUtils.isEmpty(id)) {
                    songIds.add(id);
                }
            }
            if (songIds.isEmpty()) {
                call.reject("No playable Apple Music song IDs.");
                return;
            }

            developerToken = nextDeveloperToken;
            userToken = nextUserToken;
            MediaPlayerController player = getController();
            int boundedStartIndex = Math.max(0, Math.min(startIndex, songIds.size() - 1));
            int shuffleMode = shuffle ? PlaybackShuffleMode.SHUFFLE_MODE_SONGS : PlaybackShuffleMode.SHUFFLE_MODE_OFF;
            PlaybackQueueItemProvider provider = new CatalogPlaybackQueueItemProvider.Builder()
                .items(MediaItemType.SONG, songIds.toArray(new String[0]))
                .startItemIndex(boundedStartIndex)
                .shuffleMode(shuffleMode)
                .build();

            mainHandler.post(() -> {
                try {
                    player.setShuffleMode(shuffleMode);
                    player.prepare(provider, boundedStartIndex, true);
                    resolveWithState(call);
                } catch (Throwable error) {
                    call.reject("Unable to play Apple Music queue: " + rootMessage(error));
                }
            });
        } catch (Throwable error) {
            call.reject("Unable to build Apple Music queue: " + rootMessage(error));
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        runPlayerCommand(call, MediaPlayerController::play);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        runPlayerCommand(call, MediaPlayerController::pause);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        runPlayerCommand(call, MediaPlayerController::stop);
    }

    @PluginMethod
    public void next(PluginCall call) {
        runPlayerCommand(call, MediaPlayerController::skipToNextItem);
    }

    @PluginMethod
    public void previous(PluginCall call) {
        runPlayerCommand(call, MediaPlayerController::skipToPreviousItem);
    }

    @PluginMethod
    public void seek(PluginCall call) {
        int position = call.getInt("position", 0);
        runPlayerCommand(call, player -> player.seekToPosition(Math.max(0, position) * 1000L));
    }

    @PluginMethod
    public void setShuffle(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        runPlayerCommand(call, player -> player.setShuffleMode(enabled
            ? PlaybackShuffleMode.SHUFFLE_MODE_SONGS
            : PlaybackShuffleMode.SHUFFLE_MODE_OFF));
    }

    @PluginMethod
    public void setRepeat(PluginCall call) {
        String mode = call.getString("mode", "off");
        int repeatMode = "one".equals(mode)
            ? PlaybackRepeatMode.REPEAT_MODE_ONE
            : "all".equals(mode)
                ? PlaybackRepeatMode.REPEAT_MODE_ALL
                : PlaybackRepeatMode.REPEAT_MODE_OFF;
        runPlayerCommand(call, player -> player.setRepeatMode(repeatMode));
    }

    @PluginMethod
    public void getState(PluginCall call) {
        resolveWithState(call);
    }

    @Override
    protected void handleOnDestroy() {
        if (controller != null) {
            controller.removeListener(listener);
            controller.release();
            controller = null;
        }
        super.handleOnDestroy();
    }

    private MediaPlayerController getController() {
        if (controller != null) return controller;

        ensureNativeLibraryLoaded();
        controller = MediaPlayerControllerFactory.createLocalController(getContext(), mainHandler, new TokenProvider() {
            @Override
            public String getDeveloperToken() {
                return developerToken;
            }

            @Override
            public String getUserToken() {
                return userToken;
            }
        });
        controller.addListener(listener);
        return controller;
    }

    private void runPlayerCommand(PluginCall call, PlayerCommand command) {
        if (controller == null) {
            call.reject("Apple Music player is not ready.");
            return;
        }

        mainHandler.post(() -> {
            try {
                command.run(controller);
                resolveWithState(call);
            } catch (Throwable error) {
                call.reject("Apple Music player command failed: " + rootMessage(error));
            }
        });
    }

    private void resolveWithState(PluginCall call) {
        call.resolve(statePayload());
        notifyState();
    }

    private void notifyState() {
        notifyListeners("playbackState", statePayload());
    }

    private JSObject statePayload() {
        JSObject response = new JSObject();
        if (controller == null) {
            response.put("state", "stopped");
            response.put("isPlaying", false);
            response.put("position", 0);
            response.put("duration", 0);
            response.put("queueIndex", -1);
            response.put("queueCount", 0);
            return response;
        }

        int playbackState = controller.getPlaybackState();
        long positionMillis = Math.max(0, controller.getCurrentPosition());
        long durationMillis = Math.max(0, controller.getDuration());
        response.put("state", playbackState == PlaybackState.PLAYING ? "playing" : playbackState == PlaybackState.PAUSED ? "paused" : "stopped");
        response.put("isPlaying", playbackState == PlaybackState.PLAYING);
        response.put("isBuffering", controller.isBuffering());
        response.put("position", positionMillis / 1000);
        response.put("duration", durationMillis / 1000);
        response.put("queueIndex", controller.getPlaybackQueueIndex());
        response.put("queueCount", controller.getPlaybackQueueItemCount());
        response.put("shuffle", controller.getShuffleMode() == PlaybackShuffleMode.SHUFFLE_MODE_SONGS);
        response.put("repeatMode", repeatModeName(controller.getRepeatMode()));
        return response;
    }

    private String repeatModeName(int repeatMode) {
        if (repeatMode == PlaybackRepeatMode.REPEAT_MODE_ONE) return "one";
        if (repeatMode == PlaybackRepeatMode.REPEAT_MODE_ALL) return "all";
        return "off";
    }

    private String rootMessage(Throwable error) {
        Throwable root = error;
        while (root.getCause() != null) {
            root = root.getCause();
        }
        return root.getMessage() != null ? root.getMessage() : root.getClass().getSimpleName();
    }

    private static synchronized void ensureNativeLibraryLoaded() {
        if (nativeLibraryLoaded) return;
        System.loadLibrary("appleMusicSDK");
        nativeLibraryLoaded = true;
    }

    private interface PlayerCommand {
        void run(MediaPlayerController player);
    }
}
