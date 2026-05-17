import { registerPlugin } from '@capacitor/core';

export interface VoiceMemoItem {
  id: string;
  uri: string;
  title: string;
  duration: number;
  createdAt: number;
  size: number;
}

export interface VoiceMemosState {
  memos: VoiceMemoItem[];
  isRecording: boolean;
  activeMemoId?: string;
}

export interface VoiceMemosPlugin {
  list(): Promise<VoiceMemosState>;
  startRecording(): Promise<VoiceMemosState>;
  stopRecording(): Promise<VoiceMemosState>;
  play(options: { id: string }): Promise<VoiceMemosState>;
  delete(options: { id: string }): Promise<VoiceMemosState>;
}

export const VoiceMemos = registerPlugin<VoiceMemosPlugin>('VoiceMemos');
