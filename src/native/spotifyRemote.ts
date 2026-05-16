import { PluginListenerHandle, registerPlugin } from '@capacitor/core';

export type SpotifyRepeatMode = 'off' | 'one' | 'all';

export interface SpotifyRemoteConfig {
  clientId: string;
  redirectUri: string;
  showAuthView?: boolean;
}

export interface SpotifyPlaybackState {
  state: 'stopped' | 'playing' | 'paused';
  isConnected: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  shuffle?: boolean;
  repeatMode?: SpotifyRepeatMode;
  canPlayOnDemand?: boolean;
  contextUri?: string;
  contextTitle?: string;
  track?: {
    uri: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    imageUri?: string;
  };
}

export interface SpotifyRemoteStatus {
  spotifyInstalled: boolean;
  connected: boolean;
}

export interface SpotifyRemotePlugin {
  getStatus(): Promise<SpotifyRemoteStatus>;
  connect(options: SpotifyRemoteConfig): Promise<SpotifyPlaybackState>;
  disconnect(): Promise<SpotifyPlaybackState>;
  playUri(options: { uri: string; index?: number }): Promise<SpotifyPlaybackState>;
  resume(): Promise<SpotifyPlaybackState>;
  pause(): Promise<SpotifyPlaybackState>;
  next(): Promise<SpotifyPlaybackState>;
  previous(): Promise<SpotifyPlaybackState>;
  seek(options: { position: number }): Promise<SpotifyPlaybackState>;
  setShuffle(options: { enabled: boolean }): Promise<SpotifyPlaybackState>;
  setRepeat(options: { mode: SpotifyRepeatMode }): Promise<SpotifyPlaybackState>;
  getState(): Promise<SpotifyPlaybackState>;
  addListener(
    eventName: 'playbackState',
    listenerFunc: (state: SpotifyPlaybackState) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackError',
    listenerFunc: (error: { message: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const SpotifyRemote = registerPlugin<SpotifyRemotePlugin>('SpotifyRemote');

