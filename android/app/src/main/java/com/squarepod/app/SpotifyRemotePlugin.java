package com.squarepod.app;

import android.text.TextUtils;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.spotify.android.appremote.api.ConnectionParams;
import com.spotify.android.appremote.api.Connector;
import com.spotify.android.appremote.api.PlayerApi;
import com.spotify.android.appremote.api.SpotifyAppRemote;
import com.spotify.protocol.client.CallResult;
import com.spotify.protocol.client.ErrorCallback;
import com.spotify.protocol.client.Subscription;
import com.spotify.protocol.types.Capabilities;
import com.spotify.protocol.types.Empty;
import com.spotify.protocol.types.PlayerContext;
import com.spotify.protocol.types.PlayerState;
import com.spotify.protocol.types.Repeat;
import com.spotify.protocol.types.Track;

@CapacitorPlugin(name = "SpotifyRemote")
public class SpotifyRemotePlugin extends Plugin {
    private SpotifyAppRemote spotifyAppRemote;
    private Subscription<PlayerState> playerStateSubscription;
    private Subscription<PlayerContext> playerContextSubscription;
    private Subscription<Capabilities> capabilitiesSubscription;
    private PlayerState lastPlayerState;
    private PlayerContext lastPlayerContext;
    private Capabilities lastCapabilities;

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject payload = new JSObject();
        payload.put("spotifyInstalled", SpotifyAppRemote.isSpotifyInstalled(getContext()));
        payload.put("connected", isConnected());
        call.resolve(payload);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String clientId = call.getString("clientId");
        String redirectUri = call.getString("redirectUri");
        boolean showAuthView = call.getBoolean("showAuthView", true);

        if (TextUtils.isEmpty(clientId) || TextUtils.isEmpty(redirectUri)) {
            call.reject("Missing Spotify client ID or redirect URI.");
            return;
        }
        if (!SpotifyAppRemote.isSpotifyInstalled(getContext())) {
            call.reject("Spotify app is not installed on this Android device.");
            return;
        }
        if (isConnected()) {
            resolveWithState(call);
            return;
        }

        ConnectionParams connectionParams = new ConnectionParams.Builder(clientId)
            .setRedirectUri(redirectUri)
            .showAuthView(showAuthView)
            .build();

        SpotifyAppRemote.connect(getContext(), connectionParams, new Connector.ConnectionListener() {
            @Override
            public void onConnected(SpotifyAppRemote appRemote) {
                spotifyAppRemote = appRemote;
                subscribeToRemoteState();
                refreshCapabilities();
                resolveWithState(call);
            }

            @Override
            public void onFailure(Throwable error) {
                call.reject("Spotify connection failed: " + rootMessage(error));
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        cleanupSubscriptions();
        if (spotifyAppRemote != null) {
            SpotifyAppRemote.disconnect(spotifyAppRemote);
            spotifyAppRemote = null;
        }
        lastPlayerState = null;
        lastPlayerContext = null;
        resolveWithState(call);
    }

    @PluginMethod
    public void playUri(PluginCall call) {
        String uri = call.getString("uri");
        Integer index = call.getInt("index");
        if (TextUtils.isEmpty(uri)) {
            call.reject("Missing Spotify URI.");
            return;
        }

        runPlayerCall(call, playerApi -> {
            if (index != null && index >= 0) {
                return playerApi.skipToIndex(uri, index);
            }
            return playerApi.play(uri);
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        runPlayerCall(call, PlayerApi::resume);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        runPlayerCall(call, PlayerApi::pause);
    }

    @PluginMethod
    public void next(PluginCall call) {
        runPlayerCall(call, PlayerApi::skipNext);
    }

    @PluginMethod
    public void previous(PluginCall call) {
        runPlayerCall(call, PlayerApi::skipPrevious);
    }

    @PluginMethod
    public void seek(PluginCall call) {
        int position = call.getInt("position", 0);
        runPlayerCall(call, playerApi -> playerApi.seekTo(Math.max(0, position) * 1000L));
    }

    @PluginMethod
    public void setShuffle(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        runPlayerCall(call, playerApi -> playerApi.setShuffle(enabled));
    }

    @PluginMethod
    public void setRepeat(PluginCall call) {
        String mode = call.getString("mode", "off");
        int repeat = "one".equals(mode)
            ? Repeat.ONE
            : "all".equals(mode) ? Repeat.ALL : Repeat.OFF;
        runPlayerCall(call, playerApi -> playerApi.setRepeat(repeat));
    }

    @PluginMethod
    public void getState(PluginCall call) {
        if (!isConnected()) {
            resolveWithState(call);
            return;
        }

        spotifyAppRemote.getPlayerApi().getPlayerState()
            .setResultCallback(playerState -> {
                lastPlayerState = playerState;
                resolveWithState(call);
            })
            .setErrorCallback(error -> call.reject("Spotify state request failed: " + rootMessage(error)));
    }

    @Override
    protected void handleOnDestroy() {
        cleanupSubscriptions();
        if (spotifyAppRemote != null) {
            SpotifyAppRemote.disconnect(spotifyAppRemote);
            spotifyAppRemote = null;
        }
        super.handleOnDestroy();
    }

    private boolean isConnected() {
        return spotifyAppRemote != null && spotifyAppRemote.isConnected();
    }

    private void subscribeToRemoteState() {
        if (!isConnected()) return;
        cleanupSubscriptions();

        playerStateSubscription = spotifyAppRemote.getPlayerApi().subscribeToPlayerState();
        playerStateSubscription
            .setEventCallback(playerState -> {
                lastPlayerState = playerState;
                notifyState();
            });
        playerStateSubscription.setErrorCallback(notifyPlaybackError());

        playerContextSubscription = spotifyAppRemote.getPlayerApi().subscribeToPlayerContext();
        playerContextSubscription
            .setEventCallback(playerContext -> {
                lastPlayerContext = playerContext;
                notifyState();
            });
        playerContextSubscription.setErrorCallback(notifyPlaybackError());

        capabilitiesSubscription = spotifyAppRemote.getUserApi().subscribeToCapabilities();
        capabilitiesSubscription
            .setEventCallback(capabilities -> {
                lastCapabilities = capabilities;
                notifyState();
            });
        capabilitiesSubscription.setErrorCallback(notifyPlaybackError());
    }

    private void refreshCapabilities() {
        if (!isConnected()) return;
        spotifyAppRemote.getUserApi().getCapabilities()
            .setResultCallback(capabilities -> {
                lastCapabilities = capabilities;
                notifyState();
            })
            .setErrorCallback(notifyPlaybackError());
    }

    private ErrorCallback notifyPlaybackError() {
        return error -> {
            JSObject payload = new JSObject();
            payload.put("message", rootMessage(error));
            notifyListeners("playbackError", payload);
        };
    }

    private void cleanupSubscriptions() {
        if (playerStateSubscription != null) {
            playerStateSubscription.cancel();
            playerStateSubscription = null;
        }
        if (playerContextSubscription != null) {
            playerContextSubscription.cancel();
            playerContextSubscription = null;
        }
        if (capabilitiesSubscription != null) {
            capabilitiesSubscription.cancel();
            capabilitiesSubscription = null;
        }
    }

    private void runPlayerCall(PluginCall call, SpotifyPlayerCommand command) {
        if (!isConnected()) {
            call.reject("Spotify remote is not connected.");
            return;
        }

        try {
            command.run(spotifyAppRemote.getPlayerApi())
                .setResultCallback(result -> resolveWithState(call))
                .setErrorCallback(error -> call.reject("Spotify command failed: " + rootMessage(error)));
        } catch (Throwable error) {
            call.reject("Spotify command failed: " + rootMessage(error));
        }
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
        response.put("isConnected", isConnected());

        PlayerState state = lastPlayerState;
        if (state == null) {
            response.put("state", "stopped");
            response.put("isPlaying", false);
            response.put("position", 0);
            response.put("duration", 0);
            if (lastCapabilities != null) {
                response.put("canPlayOnDemand", lastCapabilities.canPlayOnDemand);
            }
            return response;
        }

        Track track = state.track;
        long durationMs = track != null ? Math.max(0, track.duration) : 0;
        response.put("state", state.isPaused ? "paused" : "playing");
        response.put("isPlaying", !state.isPaused);
        response.put("position", Math.max(0, state.playbackPosition) / 1000);
        response.put("duration", durationMs / 1000);
        if (state.playbackOptions != null) {
            response.put("shuffle", state.playbackOptions.isShuffling);
            response.put("repeatMode", repeatModeName(state.playbackOptions.repeatMode));
        }
        if (lastCapabilities != null) {
            response.put("canPlayOnDemand", lastCapabilities.canPlayOnDemand);
        }
        if (lastPlayerContext != null) {
            response.put("contextUri", lastPlayerContext.uri);
            response.put("contextTitle", lastPlayerContext.title);
        }
        if (track != null) {
            JSObject trackPayload = new JSObject();
            trackPayload.put("uri", track.uri);
            trackPayload.put("title", track.name);
            trackPayload.put("artist", track.artist != null ? track.artist.name : "");
            trackPayload.put("album", track.album != null ? track.album.name : "");
            trackPayload.put("duration", durationMs / 1000);
            if (track.imageUri != null) {
                trackPayload.put("imageUri", track.imageUri.raw);
            }
            response.put("track", trackPayload);
        }
        return response;
    }

    private String repeatModeName(int repeatMode) {
        if (repeatMode == Repeat.ONE) return "one";
        if (repeatMode == Repeat.ALL) return "all";
        return "off";
    }

    private String rootMessage(Throwable error) {
        Throwable root = error;
        while (root != null && root.getCause() != null) {
            root = root.getCause();
        }
        if (root == null) return "Unknown error";
        return root.getMessage() != null ? root.getMessage() : root.getClass().getSimpleName();
    }

    private interface SpotifyPlayerCommand {
        CallResult<Empty> run(PlayerApi playerApi);
    }
}
