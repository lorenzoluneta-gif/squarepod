import { Capacitor } from '@capacitor/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DUMMY_SONGS } from './data';
import { AppleMusicPlayer, AppleMusicRepeatMode } from './native/appleMusicPlayer';
import { AppleMusicSong } from './services/appleMusic';
import { PlaybackMode, ShuffleMode, Song } from './types';

interface PlaybackTokens {
  developerToken: string;
  userToken: string;
}

interface UsePlayerOptions {
  getAppleMusicTokens?: () => Promise<PlaybackTokens>;
  onPlaybackError?: (message: string) => void;
}

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&q=80&w=400';

const toPlayableSong = (song: AppleMusicSong): Song => ({
  id: song.catalogId || song.id,
  title: song.title,
  artist: song.artist,
  album: song.album,
  duration: song.duration,
  coverUrl: song.artworkUrl || FALLBACK_COVER,
  appleMusicSong: song,
});

export function usePlayer(options: UsePlayerOptions = {}) {
  const tokenGetterRef = useRef(options.getAppleMusicTokens);
  const errorHandlerRef = useRef(options.onPlaybackError);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Song[]>(DUMMY_SONGS);
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(0);
  const [progress, setProgress] = useState(0);
  const [shuffleMode, setShuffleModeState] = useState<ShuffleMode>('off');
  const [repeatMode, setRepeatModeState] = useState<AppleMusicRepeatMode>('off');
  const [isAppleMusicQueue, setIsAppleMusicQueue] = useState(false);

  const currentSong = queue[currentSongIndex];
  const canUseNativeAppleMusic = Capacitor.getPlatform() === 'android';
  const currentSongDuration = currentSong?.duration || 1;

  const songIds = useMemo(() => queue.map(song => song.id), [queue]);
  const shuffleEnabled = shuffleMode === 'songs';
  const playbackMode: PlaybackMode = repeatMode === 'one'
    ? 'repeatOne'
    : repeatMode === 'all'
      ? 'repeatAll'
      : shuffleEnabled
        ? 'shuffle'
        : 'sequential';

  useEffect(() => {
    tokenGetterRef.current = options.getAppleMusicTokens;
    errorHandlerRef.current = options.onPlaybackError;
  }, [options.getAppleMusicTokens, options.onPlaybackError]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (!isPlaying || isAppleMusicQueue) return undefined;

    timer = setInterval(() => {
      setProgress(current => {
        if (current >= currentSongDuration) {
          setCurrentSongIndex(previous => nextIndex(previous, queue.length, shuffleEnabled, repeatMode));
          return 0;
        }
        return current + 1;
      });
    }, 1000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, isAppleMusicQueue, currentSongDuration, queue.length, repeatMode, shuffleEnabled]);

  useEffect(() => {
    if (!isAppleMusicQueue || !canUseNativeAppleMusic) return undefined;

    let disposed = false;
    let stateHandle: { remove: () => Promise<void> } | undefined;
    let errorHandle: { remove: () => Promise<void> } | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    AppleMusicPlayer.addListener('playbackState', (state) => {
      if (disposed) return;
      setIsPlaying(state.isPlaying);
      setProgress(Math.max(0, state.position || 0));
      if (state.duration > 0) {
        setQueue(previous => previous.map((song, index) => index === currentSongIndex
          ? { ...song, duration: state.duration }
          : song));
      }
      if (state.queueIndex >= 0 && state.queueIndex < queue.length) {
        setCurrentSongIndex(state.queueIndex);
      }
      if (typeof state.shuffle === 'boolean') setShuffleModeState(state.shuffle ? 'songs' : 'off');
      if (state.repeatMode) setRepeatModeState(state.repeatMode);
    }).then(handle => {
      stateHandle = handle;
    });

    AppleMusicPlayer.addListener('playbackError', (error) => {
      if (disposed) return;
      errorHandlerRef.current?.(error.message || 'Apple Music playback failed.');
      setIsPlaying(false);
    }).then(handle => {
      errorHandle = handle;
    });

    pollTimer = setInterval(() => {
      AppleMusicPlayer.getState().catch(() => undefined);
    }, 1000);

    return () => {
      disposed = true;
      if (pollTimer) clearInterval(pollTimer);
      stateHandle?.remove();
      errorHandle?.remove();
    };
  }, [canUseNativeAppleMusic, currentSongIndex, isAppleMusicQueue, queue.length]);

  const runNative = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errorHandlerRef.current?.(message);
      throw error;
    }
  };

  const playPause = () => {
    if (isAppleMusicQueue && canUseNativeAppleMusic) {
      runNative(() => isPlaying ? AppleMusicPlayer.pause() : AppleMusicPlayer.play()).catch(() => undefined);
      setIsPlaying(current => !current);
      return;
    }

    setIsPlaying(current => !current);
  };

  const nextTrack = () => {
    if (isAppleMusicQueue && canUseNativeAppleMusic) {
      runNative(() => AppleMusicPlayer.next()).catch(() => undefined);
    }
    setCurrentSongIndex(previous => nextIndex(previous, queue.length, shuffleEnabled, repeatMode));
    setProgress(0);
    setIsPlaying(true);
  };

  const prevTrack = () => {
    if (progress > 3) {
      if (isAppleMusicQueue && canUseNativeAppleMusic) {
        runNative(() => AppleMusicPlayer.seek({ position: 0 })).catch(() => undefined);
      }
      setProgress(0);
      return;
    }

    if (isAppleMusicQueue && canUseNativeAppleMusic) {
      runNative(() => AppleMusicPlayer.previous()).catch(() => undefined);
    }
    setCurrentSongIndex(previous => previousIndex(previous, queue.length, shuffleEnabled));
    setProgress(0);
    setIsPlaying(true);
  };

  const playSongIndex = (index: number) => {
    if (index >= 0 && index < queue.length) {
      setCurrentSongIndex(index);
      setProgress(0);
      setIsPlaying(true);
    }
  };

  const playSongById = (id: string) => {
    const index = queue.findIndex(song => song.id === id);
    if (index !== -1) playSongIndex(index);
  };

  const playAppleMusicQueue = async (
    songs: AppleMusicSong[],
    startIndex: number,
    shuffleOverride: ShuffleMode = shuffleMode,
    repeatOverride: AppleMusicRepeatMode = repeatMode,
  ) => {
    const playableSongs = songs
      .map(toPlayableSong)
      .filter(song => Boolean(song.id));

    if (!playableSongs.length) {
      throw new Error('No playable Apple Music songs in this list.');
    }
    if (!tokenGetterRef.current) {
      throw new Error('Apple Music playback is missing token access.');
    }

    const boundedStartIndex = Math.max(0, Math.min(startIndex, playableSongs.length - 1));
    setQueue(playableSongs);
    setCurrentSongIndex(boundedStartIndex);
    setProgress(0);
    setIsPlaying(true);
    setIsAppleMusicQueue(true);
    setShuffleModeState(shuffleOverride);
    setRepeatModeState(repeatOverride);

    if (!canUseNativeAppleMusic) return;

    const tokens = await tokenGetterRef.current();
    await runNative(() => AppleMusicPlayer.playQueue({
      developerToken: tokens.developerToken,
      userToken: tokens.userToken,
      songIds: playableSongs.map(song => song.id),
      startIndex: boundedStartIndex,
      shuffle: shuffleOverride === 'songs',
    }));
    await runNative(() => AppleMusicPlayer.setRepeat({ mode: repeatOverride }));
  };

  const setShuffleMode = async (mode: ShuffleMode) => {
    setShuffleModeState(mode);
    if (isAppleMusicQueue && canUseNativeAppleMusic) {
      await runNative(() => AppleMusicPlayer.setShuffle({ enabled: mode === 'songs' }));
    }
  };

  const toggleShuffle = async () => {
    await setShuffleMode(shuffleMode === 'songs' ? 'off' : 'songs');
  };

  const setRepeatMode = async (mode: AppleMusicRepeatMode) => {
    setRepeatModeState(mode);
    if (isAppleMusicQueue && canUseNativeAppleMusic) {
      await runNative(() => AppleMusicPlayer.setRepeat({ mode }));
    }
  };

  const cycleRepeat = async () => {
    const nextMode: AppleMusicRepeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    await setRepeatMode(nextMode);
  };

  const setPlaybackMode = async (mode: PlaybackMode) => {
    const nextShuffle: ShuffleMode = mode === 'shuffle' ? 'songs' : 'off';
    const nextRepeat: AppleMusicRepeatMode = mode === 'repeatOne'
      ? 'one'
      : mode === 'repeatAll'
        ? 'all'
        : 'off';

    setShuffleModeState(nextShuffle);
    setRepeatModeState(nextRepeat);
    if (isAppleMusicQueue && canUseNativeAppleMusic) {
      await runNative(async () => {
        await AppleMusicPlayer.setShuffle({ enabled: nextShuffle === 'songs' });
        await AppleMusicPlayer.setRepeat({ mode: nextRepeat });
      });
    }
  };

  const seekTo = async (position: number) => {
    const nextPosition = Math.max(0, Math.min(position, currentSongDuration));
    setProgress(nextPosition);
    if (isAppleMusicQueue && canUseNativeAppleMusic) {
      await runNative(() => AppleMusicPlayer.seek({ position: nextPosition }));
    }
  };

  return {
    isPlaying,
    currentSong,
    progress,
    queue: songIds,
    shuffleMode,
    repeatMode,
    playbackMode,
    isAppleMusicQueue,
    playPause,
    nextTrack,
    prevTrack,
    playSongById,
    playAppleMusicQueue,
    toggleShuffle,
    cycleRepeat,
    setShuffleMode,
    setRepeatMode,
    setPlaybackMode,
    seekTo,
  };
}

const nextIndex = (
  currentIndex: number,
  queueLength: number,
  shuffleEnabled: boolean,
  repeatMode: AppleMusicRepeatMode,
) => {
  if (queueLength <= 1 || repeatMode === 'one') return currentIndex;
  if (shuffleEnabled) return randomOtherIndex(currentIndex, queueLength);
  if (currentIndex >= queueLength - 1) return repeatMode === 'all' ? 0 : currentIndex;
  return currentIndex + 1;
};

const previousIndex = (currentIndex: number, queueLength: number, shuffleEnabled: boolean) => {
  if (queueLength <= 1) return currentIndex;
  if (shuffleEnabled) return randomOtherIndex(currentIndex, queueLength);
  return currentIndex === 0 ? queueLength - 1 : currentIndex - 1;
};

const randomOtherIndex = (currentIndex: number, queueLength: number) => {
  if (queueLength <= 1) return currentIndex;
  let next = currentIndex;
  while (next === currentIndex) {
    next = Math.floor(Math.random() * queueLength);
  }
  return next;
};
