import { PluginListenerHandle, registerPlugin } from '@capacitor/core';

export type LocalRepeatMode = 'off' | 'one' | 'all';

export interface LocalMusicTrack {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  trackNumber: number;
  artworkUri?: string;
}

export interface LocalMusicLibrary {
  tracks: LocalMusicTrack[];
  musicDirectory: string;
}

export interface LocalMusicPlaybackState {
  state: 'stopped' | 'playing' | 'paused';
  isPlaying: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeatMode: LocalRepeatMode;
  index: number;
  queueLength: number;
  track?: LocalMusicTrack;
}

export interface LocalMusicPlugin {
  scanLibrary(): Promise<LocalMusicLibrary>;
  playQueue(options: { tracks: LocalMusicTrack[]; startIndex?: number; shuffle?: boolean; repeatMode?: LocalRepeatMode }): Promise<LocalMusicPlaybackState>;
  play(): Promise<LocalMusicPlaybackState>;
  pause(): Promise<LocalMusicPlaybackState>;
  next(): Promise<LocalMusicPlaybackState>;
  previous(): Promise<LocalMusicPlaybackState>;
  seek(options: { position: number }): Promise<LocalMusicPlaybackState>;
  setShuffle(options: { enabled: boolean }): Promise<LocalMusicPlaybackState>;
  setRepeat(options: { mode: LocalRepeatMode }): Promise<LocalMusicPlaybackState>;
  getState(): Promise<LocalMusicPlaybackState>;
  addListener(
    eventName: 'playbackState',
    listenerFunc: (state: LocalMusicPlaybackState) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackError',
    listenerFunc: (error: { message: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const LocalMusic = registerPlugin<LocalMusicPlugin>('LocalMusic');

