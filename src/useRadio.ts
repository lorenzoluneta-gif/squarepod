import { useCallback, useEffect, useState } from 'react';
import { Radio, RadioStation, RadioStatus } from './native/radio';

const RADIO_PRESETS_KEY = 'squarepod.radioPresets.v1';
const RADIO_LAST_FREQUENCY_KEY = 'squarepod.radioLastFrequency.v1';

const readPresets = (): RadioStation[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RADIO_PRESETS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => typeof item?.frequency === 'number') : [];
  } catch {
    return [];
  }
};

const writePresets = (presets: RadioStation[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RADIO_PRESETS_KEY, JSON.stringify(presets));
};

const readLastFrequency = () => {
  if (typeof window === 'undefined') return undefined;
  const parsed = Number(window.localStorage.getItem(RADIO_LAST_FREQUENCY_KEY));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const writeLastFrequency = (frequency?: number) => {
  if (typeof window === 'undefined' || typeof frequency !== 'number') return;
  window.localStorage.setItem(RADIO_LAST_FREQUENCY_KEY, String(frequency));
};

const defaultRadioStatus = (): RadioStatus => ({
  wiredHeadsetConnected: false,
  radioHardwareFeaturePresent: false,
  radioBackendAvailable: false,
  frequency: readLastFrequency(),
  isPlaying: false,
  message: 'Checking radio hardware...',
});

export const useRadio = () => {
  const [status, setStatus] = useState<RadioStatus>(defaultRadioStatus);
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [presets, setPresets] = useState<RadioStation[]>(readPresets);
  const [message, setMessage] = useState(status.message);
  const [isWorking, setIsWorking] = useState(false);

  const applyStatus = useCallback((nextStatus: RadioStatus) => {
    setStatus(nextStatus);
    setMessage(nextStatus.message);
    writeLastFrequency(nextStatus.frequency);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      applyStatus(await Radio.getStatus());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [applyStatus]);

  useEffect(() => {
    refreshStatus().catch(() => undefined);

    let disposed = false;
    let statusHandle: { remove: () => Promise<void> } | undefined;
    let errorHandle: { remove: () => Promise<void> } | undefined;

    Radio.addListener('radioStatus', nextStatus => {
      if (!disposed) applyStatus(nextStatus);
    }).then(handle => { statusHandle = handle; }).catch(() => undefined);

    Radio.addListener('radioError', error => {
      if (!disposed) setMessage(error.message);
    }).then(handle => { errorHandle = handle; }).catch(() => undefined);

    return () => {
      disposed = true;
      statusHandle?.remove();
      errorHandle?.remove();
    };
  }, [applyStatus, refreshStatus]);

  const runRadioAction = useCallback(async (action: () => Promise<RadioStatus>) => {
    setIsWorking(true);
    try {
      applyStatus(await action());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      await refreshStatus();
    } finally {
      setIsWorking(false);
    }
  }, [applyStatus, refreshStatus]);

  const scanStations = useCallback(async () => {
    setIsWorking(true);
    try {
      const result = await Radio.scanStations();
      setStations(result.stations || []);
      applyStatus(result.status);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      await refreshStatus();
    } finally {
      setIsWorking(false);
    }
  }, [applyStatus, refreshStatus]);

  const tune = useCallback(async (frequency: number) => {
    await runRadioAction(() => Radio.tune({ frequency }));
  }, [runRadioAction]);

  const savePreset = useCallback((frequency = status.frequency) => {
    if (typeof frequency !== 'number') return;
    setPresets(current => {
      const next = [
        ...current.filter(item => Math.abs(item.frequency - frequency) > 0.01),
        { frequency, title: `${frequency.toFixed(1)} MHz` },
      ].sort((left, right) => left.frequency - right.frequency);
      writePresets(next);
      return next;
    });
  }, [status.frequency]);

  const deletePreset = useCallback((frequency: number) => {
    setPresets(current => {
      const next = current.filter(item => Math.abs(item.frequency - frequency) > 0.01);
      writePresets(next);
      return next;
    });
  }, []);

  return {
    status,
    stations,
    presets,
    message,
    isWorking,
    refreshStatus,
    scanStations,
    tune,
    seekUp: () => runRadioAction(() => Radio.seekUp()),
    seekDown: () => runRadioAction(() => Radio.seekDown()),
    start: () => runRadioAction(() => Radio.start()),
    stop: () => runRadioAction(() => Radio.stop()),
    savePreset,
    deletePreset,
  };
};
