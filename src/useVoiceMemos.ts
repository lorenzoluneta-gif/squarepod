import { useCallback, useEffect, useState } from 'react';
import { VoiceMemoItem, VoiceMemos } from './native/voiceMemos';

interface VoiceMemosState {
  memos: VoiceMemoItem[];
  isRecording: boolean;
  activeMemoId?: string;
  status: 'idle' | 'working' | 'ready' | 'recording' | 'error' | 'needsPermission';
  message: string;
  refresh: () => Promise<void>;
  toggleRecording: () => Promise<void>;
  play: (id: string) => Promise<void>;
  deleteMemo: (id: string) => Promise<void>;
}

export function useVoiceMemos(): VoiceMemosState {
  const [memos, setMemos] = useState<VoiceMemoItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeMemoId, setActiveMemoId] = useState<string>();
  const [status, setStatus] = useState<VoiceMemosState['status']>('idle');
  const [message, setMessage] = useState('Record Android voice memos.');

  const applyState = useCallback((next: { memos?: VoiceMemoItem[]; isRecording?: boolean; activeMemoId?: string }) => {
    setMemos(next.memos || []);
    setIsRecording(Boolean(next.isRecording));
    setActiveMemoId(next.activeMemoId);
    setStatus(next.isRecording ? 'recording' : 'ready');
    setMessage(next.isRecording ? 'Recording voice memo...' : `${(next.memos || []).length} voice memos.`);
  }, []);

  const handleError = useCallback((error: unknown) => {
    const nextMessage = error instanceof Error ? error.message : String(error);
    setStatus(nextMessage.toLowerCase().includes('permission') ? 'needsPermission' : 'error');
    setMessage(nextMessage || 'Voice memo action failed.');
  }, []);

  const refresh = useCallback(async () => {
    setStatus('working');
    try {
      applyState(await VoiceMemos.list());
    } catch (error) {
      handleError(error);
    }
  }, [applyState, handleError]);

  const toggleRecording = useCallback(async () => {
    setStatus('working');
    try {
      applyState(isRecording ? await VoiceMemos.stopRecording() : await VoiceMemos.startRecording());
    } catch (error) {
      handleError(error);
    }
  }, [applyState, handleError, isRecording]);

  const play = useCallback(async (id: string) => {
    setStatus('working');
    try {
      applyState(await VoiceMemos.play({ id }));
    } catch (error) {
      handleError(error);
    }
  }, [applyState, handleError]);

  const deleteMemo = useCallback(async (id: string) => {
    setStatus('working');
    try {
      applyState(await VoiceMemos.delete({ id }));
    } catch (error) {
      handleError(error);
    }
  }, [applyState, handleError]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  return { memos, isRecording, activeMemoId, status, message, refresh, toggleRecording, play, deleteMemo };
}
