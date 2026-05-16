import { Capacitor } from '@capacitor/core';
import { useEffect, useMemo, useState } from 'react';
import { LocalMusic, LocalMusicPlaybackState, LocalMusicTrack, LocalRepeatMode } from './native/localMusic';
import { PlaybackMode, ShuffleMode, Song } from './types';

export type LocalMusicStatus = 'idle' | 'working' | 'ready' | 'needsPermission' | 'error' | 'success';

const CACHE_KEY = 'squarepod.localMusicLibrary.v1';
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&q=80&w=400';

const readCachedTracks = () => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '[]') as LocalMusicTrack[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCachedTracks = (tracks: LocalMusicTrack[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(tracks));
};

const trackToSong = (track?: LocalMusicTrack): Song | undefined => {
  if (!track) return undefined;
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    coverUrl: track.artworkUri || FALLBACK_COVER,
    localTrack: track,
  };
};

const playbackModeFromState = (shuffle: ShuffleMode, repeat: LocalRepeatMode): PlaybackMode => {
  if (repeat === 'one') return 'repeatOne';
  if (repeat === 'all') return 'repeatAll';
  return shuffle === 'songs' ? 'shuffle' : 'sequential';
};

export function useLocalMusic() {
  const isAndroid = Capacitor.getPlatform() === 'android';
  const [status, setStatus] = useState<LocalMusicStatus>('idle');
  const [message, setMessage] = useState('Scan local music to build your library.');
  const [tracks, setTracks] = useState<LocalMusicTrack[]>(readCachedTracks);
  const [musicDirectory, setMusicDirectory] = useState('');
  const [playbackState, setPlaybackState] = useState<LocalMusicPlaybackState>();
  const [shuffleMode, setShuffleModeState] = useState<ShuffleMode>('off');
  const [repeatMode, setRepeatModeState] = useState<LocalRepeatMode>('off');
  const [progress, setProgress] = useState(0);

  const currentTrack = playbackState?.track;
  const playbackQueue = playbackState?.queue || [];
  const currentSong = useMemo(() => trackToSong(currentTrack), [currentTrack]);
  const isPlaying = Boolean(playbackState?.isPlaying);
  const duration = currentSong?.duration || Math.max(1, playbackState?.duration || 1);
  const playbackMode = playbackModeFromState(shuffleMode, repeatMode);

  useEffect(() => {
    if (!isAndroid) {
      setStatus('error');
      setMessage('Local music playback is implemented in the Android app.');
      return;
    }

    let disposed = false;
    let stateHandle: { remove: () => Promise<void> } | undefined;
    let errorHandle: { remove: () => Promise<void> } | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    LocalMusic.addListener('playbackState', state => {
      if (!disposed) applyPlaybackState(state);
    }).then(handle => {
      stateHandle = handle;
    });
    LocalMusic.addListener('playbackError', error => {
      if (disposed) return;
      setStatus('error');
      setMessage(error.message || 'Local playback failed.');
    }).then(handle => {
      errorHandle = handle;
    });
    LocalMusic.getState().then(applyPlaybackState).catch(() => undefined);
    pollTimer = setInterval(() => {
      LocalMusic.getState().then(applyPlaybackState).catch(() => undefined);
    }, 1500);

    return () => {
      disposed = true;
      if (pollTimer) clearInterval(pollTimer);
      stateHandle?.remove();
      errorHandle?.remove();
    };
  }, [isAndroid]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = setInterval(() => {
      setProgress(current => Math.min(duration, current + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [duration, isPlaying]);

  const applyPlaybackState = (state: LocalMusicPlaybackState) => {
    setPlaybackState(state);
    setProgress(Math.max(0, state.position || 0));
    setShuffleModeState(state.shuffle ? 'songs' : 'off');
    setRepeatModeState(state.repeatMode || 'off');
    if (state.track) {
      setStatus('ready');
      setMessage(`${state.isPlaying ? 'Playing' : 'Ready'}: ${state.track.title}`);
    }
  };

  const scanLibrary = async () => {
    if (!isAndroid) throw new Error('Local music scan is only implemented in the Android app.');
    setStatus('working');
    setMessage('Scanning local music...');
    try {
      const library = await LocalMusic.scanLibrary();
      setTracks(library.tracks);
      setMusicDirectory(library.musicDirectory);
      writeCachedTracks(library.tracks);
      setStatus('success');
      setMessage(library.tracks.length
        ? `Scanned ${library.tracks.length} local songs.`
        : `No songs found. Add files to ${library.musicDirectory}`);
      return library;
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'Local music scan failed.';
      setStatus(nextMessage.includes('permission') ? 'needsPermission' : 'error');
      setMessage(nextMessage);
      throw error;
    }
  };

  useEffect(() => {
    if (!isAndroid) return;
    scanLibrary().catch(() => undefined);
  }, [isAndroid]);

  const playQueue = async (queue: LocalMusicTrack[], startIndex = 0, options: { shuffle?: boolean; repeatMode?: LocalRepeatMode } = {}) => {
    if (!queue.length) throw new Error('No local tracks to play.');
    setStatus('working');
    setMessage('Starting local playback...');
    const state = await LocalMusic.playQueue({
      tracks: queue,
      startIndex,
      shuffle: options.shuffle ?? shuffleMode === 'songs',
      repeatMode: options.repeatMode ?? repeatMode,
    });
    applyPlaybackState(state);
    return state;
  };

  const playPause = () => {
    const command = isPlaying ? LocalMusic.pause() : LocalMusic.play();
    command.then(applyPlaybackState).catch(error => {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Local play/pause failed.');
    });
  };

  const nextTrack = () => {
    LocalMusic.next().then(applyPlaybackState).catch(error => {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Local next failed.');
    });
  };

  const prevTrack = () => {
    LocalMusic.previous().then(applyPlaybackState).catch(error => {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Local previous failed.');
    });
  };

  const seekTo = async (position: number) => {
    const state = await LocalMusic.seek({ position: Math.max(0, Math.floor(position)) });
    applyPlaybackState(state);
    return state;
  };

  const setShuffleMode = async (mode: ShuffleMode) => {
    const state = await LocalMusic.setShuffle({ enabled: mode === 'songs' });
    applyPlaybackState(state);
    return state;
  };

  const setRepeatMode = async (mode: LocalRepeatMode) => {
    const state = await LocalMusic.setRepeat({ mode });
    applyPlaybackState(state);
    return state;
  };

  const setPlaybackMode = async (mode: PlaybackMode) => {
    const nextShuffle: ShuffleMode = mode === 'shuffle' ? 'songs' : 'off';
    const nextRepeat: LocalRepeatMode = mode === 'repeatOne'
      ? 'one'
      : mode === 'repeatAll' ? 'all' : 'off';
    await setShuffleMode(nextShuffle);
    await setRepeatMode(nextRepeat);
  };

  return {
    status,
    message,
    tracks,
    musicDirectory,
    currentSong,
    currentTrack,
    playbackQueue,
    isPlaying,
    progress,
    playbackMode,
    shuffleMode,
    repeatMode,
    scanLibrary,
    playQueue,
    playPause,
    nextTrack,
    prevTrack,
    seekTo,
    setPlaybackMode,
  };
}
