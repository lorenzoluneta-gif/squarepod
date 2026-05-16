import { Capacitor } from '@capacitor/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SpotifyPlaybackState, SpotifyRemote, SpotifyRepeatMode } from './native/spotifyRemote';
import {
  readSpotifyShortcuts,
  SpotifyLibraryCache,
  SpotifyPlaylist,
  SpotifyPlaylistTrack,
  SpotifyShortcut,
  SpotifyStatus,
  SpotifyTrack,
  writeSpotifyShortcuts,
} from './services/spotify';
import { hasSpotifyTokens, startSpotifyAuth, waitForSpotifyAuth } from './services/spotifyAuth';
import { readSpotifyLibraryCache, syncSpotifyLibrary } from './services/spotifyLibrary';
import { PlaybackMode, ShuffleMode, Song } from './types';

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&q=80&w=400';

const spotifyImageToUrl = (imageUri?: string) => {
  if (!imageUri) return undefined;
  if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) return imageUri;
  return undefined;
};

const stateToTrack = (state?: SpotifyPlaybackState): SpotifyTrack | undefined => {
  const track = state?.track;
  if (!track?.uri) return undefined;

  return {
    id: track.uri,
    uri: track.uri,
    title: track.title || 'Unknown Track',
    artist: track.artist || 'Unknown Artist',
    album: track.album || 'Unknown Album',
    duration: Math.max(1, track.duration || state?.duration || 1),
    artworkUrl: spotifyImageToUrl(track.imageUri),
  };
};

const trackToSong = (track?: SpotifyTrack): Song | undefined => {
  if (!track) return undefined;
  return {
    id: track.uri,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    coverUrl: track.artworkUrl || FALLBACK_COVER,
    spotifyTrack: track,
  };
};

const playbackModeFromState = (shuffle: ShuffleMode, repeat: SpotifyRepeatMode): PlaybackMode => {
  if (repeat === 'one') return 'repeatOne';
  if (repeat === 'all') return 'repeatAll';
  return shuffle === 'songs' ? 'shuffle' : 'sequential';
};

const spotifyErrorMessage = (error: unknown, fallback = 'Spotify remote request failed.') => {
  const rawMessage = error instanceof Error ? error.message : fallback;
  const jsonStart = rawMessage.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(rawMessage.slice(jsonStart)) as { message?: string };
      if (parsed.message) {
        if (parsed.message.includes('log-in')) {
          return 'Open Spotify on this device and log in, then connect again.';
        }
        return parsed.message;
      }
    } catch {
      // Keep the original SDK message when it is not JSON.
    }
  }
  if (rawMessage.includes('log-in')) {
    return 'Open Spotify on this device and log in, then connect again.';
  }
  return rawMessage;
};

export function useSpotify() {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
  const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || 'squarepod://spotify-callback';
  const platform = Capacitor.getPlatform();
  const isAndroid = platform === 'android';
  const [status, setStatus] = useState<SpotifyStatus>('idle');
  const [message, setMessage] = useState(
    clientId ? 'Spotify remote is not connected.' : 'Set VITE_SPOTIFY_CLIENT_ID to enable Spotify Remote.',
  );
  const [spotifyInstalled, setSpotifyInstalled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [shortcuts, setShortcuts] = useState<SpotifyShortcut[]>(readSpotifyShortcuts);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [tracksByPlaylist, setTracksByPlaylist] = useState<Record<string, SpotifyPlaylistTrack[]>>({});
  const [allTracks, setAllTracks] = useState<SpotifyPlaylistTrack[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<number>();
  const [hasWebToken, setHasWebToken] = useState(hasSpotifyTokens);
  const [isSyncing, setIsSyncing] = useState(false);
  const [playbackState, setPlaybackState] = useState<SpotifyPlaybackState>();
  const [shuffleMode, setShuffleModeState] = useState<ShuffleMode>('off');
  const [repeatMode, setRepeatModeState] = useState<SpotifyRepeatMode>('off');
  const [progress, setProgress] = useState(0);
  const errorHandlerRef = useRef<(message: string) => void>();

  const currentTrack = useMemo(() => stateToTrack(playbackState), [playbackState]);
  const currentSong = useMemo(() => trackToSong(currentTrack), [currentTrack]);
  const isPlaying = Boolean(playbackState?.isPlaying);
  const duration = currentSong?.duration || Math.max(1, playbackState?.duration || 1);
  const playbackMode = playbackModeFromState(shuffleMode, repeatMode);

  const applyLibraryCache = (cache: SpotifyLibraryCache) => {
    setPlaylists(cache.playlists);
    setTracksByPlaylist(cache.tracksByPlaylist);
    setAllTracks(cache.allTracks);
    setLastSyncedAt(cache.lastSyncedAt);
  };

  useEffect(() => {
    if (!isAndroid) {
      setStatus('needsConfig');
      setMessage('Spotify Remote is only implemented in the Android app.');
      return;
    }

    SpotifyRemote.getStatus()
      .then(nextStatus => {
        setSpotifyInstalled(nextStatus.spotifyInstalled);
        setConnected(nextStatus.connected);
        if (!nextStatus.spotifyInstalled) {
          setStatus('needsConfig');
          setMessage('Spotify app is not installed on this Android device.');
          return;
        }
        if (!clientId) {
          setStatus('needsConfig');
          setMessage('Missing VITE_SPOTIFY_CLIENT_ID.');
        }
      })
      .catch(error => {
        setStatus('error');
        setMessage(spotifyErrorMessage(error, 'Spotify status check failed.'));
      });
  }, [clientId, isAndroid]);

  useEffect(() => {
    if (!isAndroid) return undefined;

    let disposed = false;
    let stateHandle: { remove: () => Promise<void> } | undefined;
    let errorHandle: { remove: () => Promise<void> } | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    SpotifyRemote.addListener('playbackState', state => {
      if (disposed) return;
      applyPlaybackState(state);
    }).then(handle => {
      stateHandle = handle;
    });

    SpotifyRemote.addListener('playbackError', error => {
      if (disposed) return;
      const nextMessage = error.message || 'Spotify playback failed.';
      errorHandlerRef.current?.(nextMessage);
      setStatus('error');
      setMessage(nextMessage);
    }).then(handle => {
      errorHandle = handle;
    });

    pollTimer = setInterval(() => {
      SpotifyRemote.getState().then(applyPlaybackState).catch(() => undefined);
    }, 1500);

    return () => {
      disposed = true;
      if (pollTimer) clearInterval(pollTimer);
      stateHandle?.remove();
      errorHandle?.remove();
    };
  }, [isAndroid]);

  useEffect(() => {
    let disposed = false;

    readSpotifyLibraryCache().then(cache => {
      if (disposed) return;
      applyLibraryCache(cache);
    });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !hasWebToken) return;
    const syncAge = lastSyncedAt ? Date.now() - lastSyncedAt : Infinity;
    if (syncAge < 30 * 60 * 1000) return;

    syncLibrary({ silent: true }).catch(() => undefined);
  }, [clientId, hasWebToken, lastSyncedAt]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    const timer = setInterval(() => {
      setProgress(current => Math.min(duration, current + 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [duration, isPlaying]);

  const applyPlaybackState = (state: SpotifyPlaybackState) => {
    setPlaybackState(state);
    setConnected(state.isConnected);
    setProgress(Math.max(0, state.position || 0));
    if (typeof state.shuffle === 'boolean') setShuffleModeState(state.shuffle ? 'songs' : 'off');
    if (state.repeatMode) setRepeatModeState(state.repeatMode);
    if (state.isConnected) {
      setStatus('ready');
      setMessage(state.track ? `Spotify is playing ${state.track.title}.` : 'Spotify remote is connected.');
    }
  };

  const run = async <T,>(operation: () => Promise<T>, workingMessage: string) => {
    setStatus('working');
    setMessage(workingMessage);

    try {
      const result = await operation();
      setStatus('success');
      return result;
    } catch (error) {
      const nextMessage = spotifyErrorMessage(error);
      setStatus('error');
      setMessage(nextMessage);
      throw error;
    }
  };

  const connect = () => run(async () => {
    if (!isAndroid) throw new Error('Spotify Remote is only implemented in the Android app.');
    if (!clientId) throw new Error('Missing VITE_SPOTIFY_CLIENT_ID.');
    const state = await SpotifyRemote.connect({
      clientId,
      redirectUri,
      showAuthView: true,
    });
    applyPlaybackState(state);
    return state;
  }, 'Connecting to Spotify...');

  const syncLibrary = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!clientId) throw new Error('Missing VITE_SPOTIFY_CLIENT_ID.');
    setIsSyncing(true);
    if (!silent) {
      setStatus('working');
      setMessage(hasWebToken ? 'Syncing Spotify playlists...' : 'Opening Spotify sign-in...');
    }

    try {
      if (!hasSpotifyTokens()) {
        const authWaiter = waitForSpotifyAuth(clientId, redirectUri);
        await startSpotifyAuth(clientId, redirectUri);
        await authWaiter;
        setHasWebToken(true);
      }

      const cache = await syncSpotifyLibrary(clientId);
      applyLibraryCache(cache);
      setHasWebToken(true);
      if (!silent) {
        setStatus('success');
        setMessage(`Synced ${cache.playlists.length} playlists and ${cache.allTracks.length} songs.`);
      }
      return cache;
    } catch (error) {
      const nextMessage = spotifyErrorMessage(error, 'Spotify playlist sync failed.');
      if (!silent) {
        setStatus('error');
        setMessage(nextMessage);
      }
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const ensureConnected = async () => {
    if (connected) return;
    await connect();
  };

  const playUri = async (uri: string, index?: number) => run(async () => {
    await ensureConnected();
    const state = await SpotifyRemote.playUri({ uri, index });
    applyPlaybackState(state);
    rememberShortcut({ id: `spotify_recent_${Date.now()}`, title: uriLabel(uri), uri, subtitle: 'Recent playback' });
    return state;
  }, `Playing ${uriLabel(uri)}...`);

  const rememberShortcut = (shortcut: SpotifyShortcut) => {
    setShortcuts(previous => {
      const next = [
        shortcut,
        ...previous.filter(item => item.uri !== shortcut.uri),
      ].slice(0, 12);
      writeSpotifyShortcuts(next);
      return next;
    });
  };

  const playPause = () => {
    const command = async () => {
      await ensureConnected();
      const state = isPlaying ? await SpotifyRemote.pause() : await SpotifyRemote.resume();
      applyPlaybackState(state);
    };
    command().catch(error => {
      setStatus('error');
      setMessage(spotifyErrorMessage(error, 'Spotify play/pause failed.'));
    });
  };

  const nextTrack = () => {
    run(async () => {
      await ensureConnected();
      const state = await SpotifyRemote.next();
      applyPlaybackState(state);
      return state;
    }, 'Skipping to next track...').catch(() => undefined);
  };

  const prevTrack = () => {
    run(async () => {
      await ensureConnected();
      const state = await SpotifyRemote.previous();
      applyPlaybackState(state);
      return state;
    }, 'Skipping to previous track...').catch(() => undefined);
  };

  const seekTo = async (position: number) => run(async () => {
    await ensureConnected();
    const state = await SpotifyRemote.seek({ position: Math.max(0, Math.floor(position)) });
    applyPlaybackState(state);
    return state;
  }, 'Seeking Spotify playback...');

  const setShuffleMode = async (mode: ShuffleMode) => run(async () => {
    await ensureConnected();
    const state = await SpotifyRemote.setShuffle({ enabled: mode === 'songs' });
    setShuffleModeState(mode);
    applyPlaybackState(state);
    return state;
  }, 'Updating Spotify shuffle...');

  const setRepeatMode = async (mode: SpotifyRepeatMode) => run(async () => {
    await ensureConnected();
    const state = await SpotifyRemote.setRepeat({ mode });
    setRepeatModeState(mode);
    applyPlaybackState(state);
    return state;
  }, 'Updating Spotify repeat...');

  const setPlaybackMode = async (mode: PlaybackMode) => {
    const nextShuffle: ShuffleMode = mode === 'shuffle' ? 'songs' : 'off';
    const nextRepeat: SpotifyRepeatMode = mode === 'repeatOne'
      ? 'one'
      : mode === 'repeatAll' ? 'all' : 'off';
    await setShuffleMode(nextShuffle);
    await setRepeatMode(nextRepeat);
  };

  const cycleRepeat = async () => {
    const nextMode: SpotifyRepeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    await setRepeatMode(nextMode);
  };

  return {
    status,
    message,
    spotifyInstalled,
    connected,
    clientId,
    redirectUri,
    shortcuts,
    playlists,
    tracksByPlaylist,
    allTracks,
    lastSyncedAt,
    hasWebToken,
    currentTrack,
    currentSong,
    isPlaying,
    progress,
    playbackMode,
    shuffleMode,
    repeatMode,
    canPlayOnDemand: playbackState?.canPlayOnDemand,
    isSyncing,
    connect,
    syncLibrary,
    playUri,
    playPause,
    nextTrack,
    prevTrack,
    seekTo,
    setPlaybackMode,
    setShuffleMode,
    setRepeatMode,
    cycleRepeat,
  };
}

const uriLabel = (uri: string) => {
  const [, type, id] = uri.split(':');
  if (!type || !id) return uri;
  return `${type.charAt(0).toUpperCase()}${type.slice(1)} ${id.slice(0, 6)}`;
};
