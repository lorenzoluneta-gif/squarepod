import React from 'react';
import { AppleMusicSong } from './services/appleMusic';
import { LocalMusicTrack } from './native/localMusic';
import { MediaLibraryItem } from './native/mediaLibrary';
import { SpotifyPlaylist, SpotifyPlaylistTrack, SpotifyShortcut, SpotifyTrack } from './services/spotify';

export type ShuffleMode = 'off' | 'songs';
export type PlaybackMode = 'sequential' | 'shuffle' | 'repeatAll' | 'repeatOne';
export type EditorKind = 'note' | 'contact' | 'calendarEvent';
export type EditorMode = 'create' | 'edit';
export type EditorFieldKey = 'title' | 'body' | 'name' | 'phone' | 'email' | 'date' | 'time' | 'notes';
export type EditorFields = Partial<Record<EditorFieldKey, string>>;
export type SleepTimerEndAction = 'pause' | 'fadePause' | 'lock';
export type SleepTimerMode = 'duration' | 'song' | 'album' | 'queue';

export interface TextEditorState {
  kind: EditorKind;
  mode: EditorMode;
  id?: string;
  fields: EditorFields;
  error?: string;
}

export type MenuNodeType = 'menu' | 'coverFlow' | 'nowPlaying' | 'songDetail' | 'videos' | 'videoDetail' | 'photoGrid' | 'photoDetail' | 'photos' | 'podcasts' | 'radioStatus' | 'radioNowPlaying' | 'radioStationList' | 'radioTune' | 'settings' | 'about' | 'clock' | 'calendar' | 'calendarEventList' | 'calendarEventDetail' | 'stopwatch' | 'contactList' | 'contactDetail' | 'noteList' | 'noteDetail' | 'textEditor' | 'screenLock' | 'legal' | 'appleMusicStatus' | 'spotifyStatus' | 'localMusicStatus' | 'placeholder';

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
  | 'player_shuffle_all'
  | 'settings_cycle_click_sound'
  | 'settings_toggle_auto_scan'
  | 'settings_cycle_playback_mode'
  | 'settings_reset'
  | 'media_scan'
  | 'radio_scan'
  | 'radio_tune'
  | 'radio_seek_up'
  | 'radio_seek_down'
  | 'radio_start'
  | 'radio_stop'
  | 'radio_save_preset'
  | 'radio_delete_preset'
  | 'contact_add'
  | 'contact_edit'
  | 'contact_delete'
  | 'note_add'
  | 'note_quick'
  | 'note_discard_draft'
  | 'note_edit'
  | 'note_delete'
  | 'note_delete_confirm'
  | 'calendar_event_add'
  | 'calendar_event_edit'
  | 'calendar_event_delete'
  | 'calendar_event_delete_confirm'
  | 'sleep_timer_start'
  | 'sleep_timer_cancel'
  | 'sleep_timer_end_now'
  | 'sleep_timer_cycle_action'
  | 'editor_save'
  | 'editor_cancel'
  | 'settings_toggle_main_menu_item'
  | 'settings_cycle_backlight'
  | 'settings_toggle_audiobook'
  | 'settings_cycle_eq'
  | 'settings_toggle_compilations'
  | 'settings_cycle_language'
  | 'settings_set_language'
  | 'screen_lock'
  | 'screen_unlock';

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
  mediaItem?: MediaLibraryItem;
  radioFrequency?: number;
  settingKey?: string;
  switchValue?: boolean;
  reorderActive?: boolean;
  contactId?: string;
  noteId?: string;
  calendarEventId?: string;
  calendarEventDate?: string;
  calendarEventTime?: string;
  sleepTimerDurationMs?: number;
  sleepTimerMode?: SleepTimerMode;
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
