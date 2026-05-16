import React from 'react';
import { AppleMusicSong } from './services/appleMusic';
import { LocalMusicTrack } from './native/localMusic';
import { SpotifyPlaylist, SpotifyPlaylistTrack, SpotifyShortcut, SpotifyTrack } from './services/spotify';

export type ShuffleMode = 'off' | 'songs';
export type PlaybackMode = 'sequential' | 'shuffle' | 'repeatAll' | 'repeatOne';

export type MenuNodeType = 'menu' | 'coverFlow' | 'nowPlaying' | 'songDetail' | 'videos' | 'photos' | 'podcasts' | 'settings' | 'about' | 'clock' | 'game_brick' | 'calendar' | 'stopwatch' | 'appleMusicStatus' | 'spotifyStatus' | 'localMusicStatus' | 'placeholder';

export type MenuAction =
  | 'apple_music_sign_in'
  | 'apple_music_load_library'
  | 'apple_music_search_catalog'
  | 'apple_music_favorite_current'
  | 'spotify_connect'
  | 'spotify_sync_library'
  | 'spotify_play_default'
  | 'local_music_scan'
  | 'local_toggle_continuation'
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
  localTrack?: LocalMusicTrack;
  localQueue?: LocalMusicTrack[];
  localQueueIndex?: number;
  localAlbumKey?: string;
  spotifyUri?: string;
  spotifyPlaylist?: SpotifyPlaylist;
  spotifyPlaylistTrack?: SpotifyPlaylistTrack;
  spotifyShortcut?: SpotifyShortcut;
  spotifyTrack?: SpotifyTrack;
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
  localTrack?: LocalMusicTrack;
  spotifyTrack?: SpotifyTrack;
}
