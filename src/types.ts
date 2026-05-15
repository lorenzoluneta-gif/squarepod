import React from 'react';
import { AppleMusicSong } from './services/appleMusic';

export type ShuffleMode = 'off' | 'songs';
export type PlaybackMode = 'sequential' | 'shuffle' | 'repeatAll' | 'repeatOne';

export type MenuNodeType = 'menu' | 'coverFlow' | 'nowPlaying' | 'videos' | 'photos' | 'podcasts' | 'settings' | 'about' | 'clock' | 'game_brick' | 'calendar' | 'stopwatch' | 'appleMusicStatus' | 'placeholder';

export type MenuAction =
  | 'apple_music_sign_in'
  | 'apple_music_load_library'
  | 'apple_music_search_catalog'
  | 'apple_music_favorite_current'
  | 'player_shuffle_all';

export interface MenuNode {
  id: string;
  title: string;
  type: MenuNodeType;
  children?: MenuNode[];
  previewIcon?: React.ReactNode;
  previewImage?: string;
  action?: MenuAction;
  detailLines?: string[];
  appleMusicSongId?: string;
  appleMusicSong?: AppleMusicSong;
  appleMusicPlaylistId?: string;
  statusTone?: 'neutral' | 'success' | 'warning' | 'error';
  isLoading?: boolean;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  coverUrl: string;
  url?: string;
  appleMusicSong?: AppleMusicSong;
}
