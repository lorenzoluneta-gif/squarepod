import { PluginListenerHandle, registerPlugin } from '@capacitor/core';

export interface RadioStatus {
  wiredHeadsetConnected: boolean;
  radioHardwareFeaturePresent: boolean;
  radioBackendAvailable: boolean;
  frequency?: number;
  isPlaying: boolean;
  message: string;
}

export interface RadioStation {
  frequency: number;
  title: string;
}

export interface RadioPlugin {
  getStatus(): Promise<RadioStatus>;
  scanStations(): Promise<{ stations: RadioStation[]; status: RadioStatus }>;
  tune(options: { frequency: number }): Promise<RadioStatus>;
  seekUp(): Promise<RadioStatus>;
  seekDown(): Promise<RadioStatus>;
  start(): Promise<RadioStatus>;
  stop(): Promise<RadioStatus>;
  addListener(eventName: 'radioStatus', listenerFunc: (status: RadioStatus) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'radioError', listenerFunc: (error: { message: string }) => void): Promise<PluginListenerHandle>;
}

export const Radio = registerPlugin<RadioPlugin>('Radio');
