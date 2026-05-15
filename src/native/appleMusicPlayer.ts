import { PluginListenerHandle, registerPlugin } from '@capacitor/core';

export type AppleMusicRepeatMode = 'off' | 'one' | 'all';

export interface AppleMusicPlaybackState {
  state: 'stopped' | 'playing' | 'paused';
  isPlaying: boolean;
  isBuffering?: boolean;
  position: number;
  duration: number;
  queueIndex: number;
  queueCount: number;
  shuffle?: boolean;
  repeatMode?: AppleMusicRepeatMode;
}

export interface AppleMusicPlayerPlugin {
  playQueue(options: {
    developerToken: string;
    userToken: string;
    songIds: string[];
    startIndex: number;
    shuffle?: boolean;
  }): Promise<AppleMusicPlaybackState>;
  play(): Promise<AppleMusicPlaybackState>;
  pause(): Promise<AppleMusicPlaybackState>;
  stop(): Promise<AppleMusicPlaybackState>;
  next(): Promise<AppleMusicPlaybackState>;
  previous(): Promise<AppleMusicPlaybackState>;
  seek(options: { position: number }): Promise<AppleMusicPlaybackState>;
  setShuffle(options: { enabled: boolean }): Promise<AppleMusicPlaybackState>;
  setRepeat(options: { mode: AppleMusicRepeatMode }): Promise<AppleMusicPlaybackState>;
  getState(): Promise<AppleMusicPlaybackState>;
  addListener(
    eventName: 'playbackState',
    listenerFunc: (state: AppleMusicPlaybackState) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackError',
    listenerFunc: (error: { message: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const AppleMusicPlayer = registerPlugin<AppleMusicPlayerPlugin>('AppleMusicPlayer');
