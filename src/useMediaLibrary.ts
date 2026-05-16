import { useCallback, useEffect, useState } from 'react';
import { MediaLibrary, MediaLibraryItem } from './native/mediaLibrary';

interface MediaLibraryState {
  photos: MediaLibraryItem[];
  videos: MediaLibraryItem[];
  status: 'idle' | 'working' | 'success' | 'error' | 'needsPermission';
  message: string;
  scanMedia: () => Promise<void>;
}

export const useMediaLibrary = (): MediaLibraryState => {
  const [photos, setPhotos] = useState<MediaLibraryItem[]>([]);
  const [videos, setVideos] = useState<MediaLibraryItem[]>([]);
  const [status, setStatus] = useState<MediaLibraryState['status']>('idle');
  const [message, setMessage] = useState('Scan Android photos and videos.');

  const scanMedia = useCallback(async () => {
    setStatus('working');
    setMessage('Scanning Android media library...');
    try {
      const result = await MediaLibrary.scanMedia();
      setPhotos(result.photos || []);
      setVideos(result.videos || []);
      setStatus('success');
      setMessage(`Found ${(result.photos || []).length} photos and ${(result.videos || []).length} videos.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : String(error);
      setStatus(nextMessage.toLowerCase().includes('permission') ? 'needsPermission' : 'error');
      setMessage(nextMessage || 'Media scan failed.');
    }
  }, []);

  useEffect(() => {
    scanMedia().catch(() => undefined);
  }, [scanMedia]);

  return {
    photos,
    videos,
    status,
    message,
    scanMedia,
  };
};
