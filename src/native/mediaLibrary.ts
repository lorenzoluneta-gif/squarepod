import { registerPlugin } from '@capacitor/core';

export type MediaLibraryKind = 'photo' | 'video';

export interface MediaLibraryItem {
  id: string;
  uri: string;
  title: string;
  kind: MediaLibraryKind;
  bucket?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  dateTaken?: number;
  dateAdded?: number;
  thumbnailUri?: string;
}

export interface MediaLibraryResult {
  photos: MediaLibraryItem[];
  videos: MediaLibraryItem[];
}

export interface MediaLibraryPlugin {
  scanMedia(): Promise<MediaLibraryResult>;
}

export const MediaLibrary = registerPlugin<MediaLibraryPlugin>('MediaLibrary');
