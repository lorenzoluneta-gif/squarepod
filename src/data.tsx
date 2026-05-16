import { Song, MenuNode, PlaybackMode, SleepTimerEndAction } from './types';
import React from 'react';
import { PlayCircle, Film, Image as ImageIcon, Radio as RadioIcon, Settings, Shuffle, Clock, FileText, Calendar, Info, Volume2, RefreshCw, RotateCcw } from 'lucide-react';
import { LocalMusicTrack } from './native/localMusic';
import { MediaLibraryItem } from './native/mediaLibrary';
import { RadioStation, RadioStatus } from './native/radio';
import { AppleMusicPlaylist, AppleMusicSong } from './services/appleMusic';
import { SpotifyPlaylist, SpotifyPlaylistTrack, SpotifyShortcut, SpotifyTrack } from './services/spotify';
import { LOCALE_OPTIONS, Locale, localeLabel, normalizeLocale, t } from './i18n';

export const DUMMY_SONGS: Song[] = [
  {
    id: 's1',
    title: 'Neon Nights',
    artist: 'Synthwave Boy',
    album: 'Retro Future',
    duration: 214,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 's2',
    title: 'Ocean Breeze',
    artist: 'Chill Vibes',
    album: 'Summer Hits',
    duration: 185,
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 's3',
    title: 'Urban Explorer',
    artist: 'The Striders',
    album: 'City Limits',
    duration: 250,
    coverUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 's4',
    title: 'Midnight Drive',
    artist: 'Synthwave Boy',
    album: 'Retro Future',
    duration: 198,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 's5',
    title: 'Sunset Boulevard',
    artist: 'The Striders',
    album: 'California Dreaming',
    duration: 210,
    coverUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80&w=400',
  }
];

export interface AppleMusicMenuState {
  status?: string;
  message?: string;
  hasUserToken?: boolean;
  defaultSearchTerm?: string;
  catalogResults?: AppleMusicSong[];
  libraryResults?: AppleMusicSong[];
  allMusic?: AppleMusicSong[];
  playlists?: AppleMusicPlaylist[];
  playlistTracks?: Record<string, AppleMusicSong[]>;
  lastSyncedAt?: number;
  usingCachedLibrary?: boolean;
  isSyncing?: boolean;
}

export interface SpotifyMenuState {
  status?: string;
  message?: string;
  connected?: boolean;
  spotifyInstalled?: boolean;
  clientId?: string;
  redirectUri?: string;
  shortcuts?: SpotifyShortcut[];
  playlists?: SpotifyPlaylist[];
  tracksByPlaylist?: Record<string, SpotifyPlaylistTrack[]>;
  allTracks?: SpotifyPlaylistTrack[];
  lastSyncedAt?: number;
  hasWebToken?: boolean;
  currentTrack?: SpotifyTrack;
  canPlayOnDemand?: boolean;
  isWorking?: boolean;
  isSyncing?: boolean;
}

export interface LocalMusicMenuState {
  status?: string;
  message?: string;
  tracks?: LocalMusicTrack[];
  musicDirectory?: string;
  currentTrack?: LocalMusicTrack;
  continuationMode?: 'album' | 'library';
  isScanning?: boolean;
  uiSoundVolume?: number;
  autoScan?: boolean;
  playbackMode?: PlaybackMode;
  photos?: MediaLibraryItem[];
  videos?: MediaLibraryItem[];
  mediaStatus?: string;
  mediaMessage?: string;
  isMediaScanning?: boolean;
  radioStatus?: RadioStatus;
  radioStations?: RadioStation[];
  radioPresets?: RadioStation[];
  radioMessage?: string;
  isRadioWorking?: boolean;
  contacts?: ContactEntry[];
  notes?: NoteEntry[];
  noteDraft?: NoteEntry;
  calendarEvents?: CalendarEventEntry[];
  calendarFocusDate?: string;
  sleepTimer?: SleepTimerMenuState;
  mainMenuEnabled?: Record<string, boolean>;
  mainMenuOrder?: string[];
  mainMenuSettingsOrder?: string[];
  mainMenuReorderKey?: string;
  backlightTimer?: string;
  audiobooksEnabled?: boolean;
  eqPreset?: string;
  compilationsEnabled?: boolean;
  language?: Locale;
}

export interface ContactEntry {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface NoteEntry {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  pinned?: boolean;
  attachedSongTitle?: string;
  attachedSongArtist?: string;
  isDraft?: boolean;
}

export interface CalendarEventEntry {
  id: string;
  date: string;
  time?: string;
  title: string;
  notes?: string;
  updatedAt: number;
}

export interface SleepTimerMenuState {
  status: 'off' | 'running' | 'completed';
  startedAt?: number;
  durationMs?: number;
  endAction: SleepTimerEndAction;
}

export const MAIN_MENU_ITEM_ORDER = [
  'music',
  'videos',
  'photos',
  'radio',
  'notes',
  'ex_clock',
  'ex_contacts',
  'ex_calendar',
  'ex_stopwatch',
  'ex_screen_lock',
  'shuffle_songs',
] as const;

export type MainMenuItemKey = typeof MAIN_MENU_ITEM_ORDER[number];

const DEFAULT_MAIN_MENU_ENABLED: Record<MainMenuItemKey, boolean> = {
  music: true,
  videos: true,
  photos: true,
  radio: true,
  notes: true,
  ex_clock: false,
  ex_contacts: false,
  ex_calendar: false,
  ex_stopwatch: false,
  ex_screen_lock: false,
  shuffle_songs: true,
};

export const normalizeMainMenuOrder = (order?: string[]) => {
  const valid = new Set<string>(MAIN_MENU_ITEM_ORDER);
  const seen = new Set<string>();
  const normalized = (order || []).filter(key => {
    if (!valid.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [
    ...normalized,
    ...MAIN_MENU_ITEM_ORDER.filter(key => !seen.has(key)),
  ];
};

export const isMainMenuItemEnabled = (
  enabled: Record<string, boolean> | undefined,
  key: string,
) => enabled?.[key] ?? DEFAULT_MAIN_MENU_ENABLED[key as MainMenuItemKey] ?? false;

const songToMenuNode = (song: Song): MenuNode => ({
  id: `song_${song.id}`,
  title: song.title,
  type: 'nowPlaying',
});

const appleSongToMenuNode = (song: AppleMusicSong, source: 'catalog' | 'library'): MenuNode => ({
  id: `apple_${source}_${song.id}`,
  title: song.title,
  type: 'menu',
  previewImage: song.artworkUrl,
  appleMusicSongId: song.catalogId || song.id,
  appleMusicSong: song,
  detailLines: [
    song.artist,
    song.album,
    source === 'catalog' ? 'Catalog result' : 'In your Playlists',
  ],
});

const normalizeAlbumKey = (song: AppleMusicSong) => (
  `${song.album.trim().toLowerCase()}|${song.artist.trim().toLowerCase()}`
);

const safeNodeId = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  || 'unknown';

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const stableNodeId = (prefix: string, value: string) => `${prefix}_${stableHash(value || 'unknown')}`;

const normalizeLocalAlbumKey = (track: LocalMusicTrack) => (
  `${(track.album || 'Unknown Album').trim().toLowerCase()}|${(track.artist || 'Unknown Artist').trim().toLowerCase()}`
);

const localTrackToMenuNode = (track: LocalMusicTrack, locale: Locale = 'en'): MenuNode => ({
  id: stableNodeId('local_track', track.id || track.uri || `${track.title}|${track.artist}|${track.album}`),
  title: track.title || t(locale, 'title'),
  type: 'songDetail',
  previewImage: track.artworkUri,
  localTrack: track,
  detailLines: [
    track.artist || 'Unknown Artist',
    track.album || 'Unknown Album',
    'Local audio file',
  ],
});

const sortLocalTracks = (tracks: LocalMusicTrack[]) => [...tracks].sort((left, right) => {
  const artistSort = (left.artist || '').localeCompare(right.artist || '', undefined, { sensitivity: 'base' });
  if (artistSort) return artistSort;
  const albumSort = (left.album || '').localeCompare(right.album || '', undefined, { sensitivity: 'base' });
  if (albumSort) return albumSort;
  const trackSort = (left.trackNumber || 0) - (right.trackNumber || 0);
  if (trackSort) return trackSort;
  return (left.title || '').localeCompare(right.title || '', undefined, { sensitivity: 'base' });
});

const generateLocalCoverFlowNode = (tracks: LocalMusicTrack[], locale: Locale): MenuNode => {
  const albumMap = new Map<string, LocalMusicTrack[]>();

  sortLocalTracks(tracks).forEach(track => {
    const key = normalizeLocalAlbumKey(track);
    const albumTracks = albumMap.get(key) || [];
    albumTracks.push(track);
    albumMap.set(key, albumTracks);
  });

  const albums = [...albumMap.entries()]
    .sort(([, left], [, right]) => {
      const albumSort = (left[0].album || '').localeCompare(right[0].album || '', undefined, { sensitivity: 'base' });
      return albumSort || (left[0].artist || '').localeCompare(right[0].artist || '', undefined, { sensitivity: 'base' });
    })
    .map(([key, albumTracks], index): MenuNode => {
      const firstTrack = albumTracks[0];
      const artworkTrack = albumTracks.find(track => Boolean(track.artworkUri)) || firstTrack;

      return {
        id: stableNodeId('cover_album', key || String(index)),
        title: firstTrack.album || 'Unknown Album',
        type: 'menu',
        previewImage: artworkTrack.artworkUri,
        localAlbumKey: key,
        detailLines: [
          firstTrack.artist || 'Unknown Artist',
          `${albumTracks.length} song${albumTracks.length === 1 ? '' : 's'}`,
        ],
        children: albumTracks.map(track => localTrackToMenuNode(track, locale)),
      };
    });

  return {
    id: 'local_cover_flow',
    title: t(locale, 'coverFlow'),
    type: 'coverFlow',
    detailLines: albums.length
      ? [`${albums.length} albums`, 'Browse local albums.']
      : [t(locale, 'scanLocalMusicFirst')],
    children: albums,
  };
};

const groupLocalTracks = (
  tracks: LocalMusicTrack[],
  idPrefix: string,
  getKey: (track: LocalMusicTrack) => string,
  getTitle: (track: LocalMusicTrack) => string,
  locale: Locale,
): MenuNode[] => {
  const groups = new Map<string, LocalMusicTrack[]>();

  sortLocalTracks(tracks).forEach(track => {
    const key = getKey(track);
    const groupTracks = groups.get(key) || [];
    groupTracks.push(track);
    groups.set(key, groupTracks);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    .map(([key, groupTracks]) => ({
      id: stableNodeId(idPrefix, key),
      title: getTitle(groupTracks[0]),
      type: 'menu',
      previewImage: groupTracks.find(track => Boolean(track.artworkUri))?.artworkUri,
      detailLines: [`${groupTracks.length} song${groupTracks.length === 1 ? '' : 's'}`],
      children: groupTracks.map(track => localTrackToMenuNode(track, locale)),
    }));
};

const generateLocalMusicChildren = (state: LocalMusicMenuState = {}): MenuNode[] => {
  const locale = normalizeLocale(state.language);
  const tracks = sortLocalTracks(state.tracks || []);
  const statusTone = state.status === 'success' || state.status === 'ready'
    ? 'success'
    : state.status === 'error' || state.status === 'needsPermission' ? 'error' : 'warning';

  return [
    {
      id: 'now_playing_menu',
      title: t(locale, 'nowPlaying'),
      type: 'nowPlaying',
      detailLines: [
        state.currentTrack ? `${state.currentTrack.title} - ${state.currentTrack.artist}` : t(locale, 'noLocalSongPlaying'),
        t(locale, 'selectSwitchesPlaybackMode'),
      ],
    },
    generateLocalCoverFlowNode(tracks, locale),
    {
      id: 'local_all_songs',
      title: t(locale, 'allSongs'),
      type: 'menu',
      detailLines: [
        `${tracks.length} local songs`,
        'Songs found on this Android device.',
      ],
      children: tracks.length
        ? tracks.map(track => localTrackToMenuNode(track, locale))
        : [{
            id: 'local_no_all_songs',
            title: t(locale, 'noSongs'),
            type: 'localMusicStatus',
            statusTone: 'warning',
            detailLines: [t(locale, 'scanFirst')],
          }],
    },
    {
      id: 'local_artists',
      title: t(locale, 'artists'),
      type: 'menu',
      children: tracks.length
        ? groupLocalTracks(
            tracks,
            'local_artist',
            track => track.artist || 'Unknown Artist',
            track => track.artist || 'Unknown Artist',
            locale,
          )
        : [{
            id: 'local_no_artists',
            title: t(locale, 'noArtists'),
            type: 'localMusicStatus',
            statusTone: 'warning',
            detailLines: [t(locale, 'scanFirst')],
          }],
    },
    {
      id: 'local_albums',
      title: t(locale, 'albums'),
      type: 'menu',
      children: tracks.length
        ? groupLocalTracks(
            tracks,
            'local_album',
            track => normalizeLocalAlbumKey(track),
            track => track.album || 'Unknown Album',
            locale,
          )
        : [{
            id: 'local_no_albums',
            title: t(locale, 'noAlbums'),
            type: 'localMusicStatus',
            statusTone: 'warning',
            detailLines: [t(locale, 'scanFirst')],
          }],
    },
    {
      id: 'local_scan',
      title: state.isScanning ? t(locale, 'scanning') : t(locale, 'scan'),
      type: 'localMusicStatus',
      action: 'local_music_scan',
      isLoading: state.isScanning,
      statusTone,
      detailLines: [
        state.message || 'Scan local audio files.',
        `${tracks.length} songs cached`,
        state.musicDirectory ? `App folder: ${state.musicDirectory}` : 'Reads Android audio library and app Music folder.',
      ],
    },
  ];
};

const generateCoverFlowNode = (songs: AppleMusicSong[]): MenuNode => {
  const albumMap = new Map<string, AppleMusicSong[]>();

  songs.forEach(song => {
    const key = normalizeAlbumKey(song);
    const albumSongs = albumMap.get(key) || [];
    albumSongs.push(song);
    albumMap.set(key, albumSongs);
  });

  const albums = [...albumMap.values()]
    .sort((left, right) => {
      const albumSort = left[0].album.localeCompare(right[0].album, undefined, { sensitivity: 'base' });
      return albumSort || left[0].artist.localeCompare(right[0].artist, undefined, { sensitivity: 'base' });
    })
    .map((albumSongs, index): MenuNode => {
      const firstSong = albumSongs[0];
      const artworkSong = albumSongs.find(song => Boolean(song.artworkUrl)) || firstSong;
      const albumId = `${safeNodeId(firstSong.album)}_${safeNodeId(firstSong.artist)}_${index}`;

      return {
        id: `cover_album_${albumId}`,
        title: firstSong.album,
        type: 'menu',
        previewImage: artworkSong.artworkUrl,
        detailLines: [
          firstSong.artist,
          `${albumSongs.length} song${albumSongs.length === 1 ? '' : 's'}`,
        ],
        children: albumSongs.map(song => appleSongToMenuNode(song, 'library')),
      };
    });

  return {
    id: 'cover_flow',
    title: 'Cover Flow',
    type: 'coverFlow',
    detailLines: albums.length
      ? [`${albums.length} albums`, 'Browse synced playlist albums.']
      : ['Sync Apple Music first.'],
    children: albums,
  };
};

const applePlaylistToMenuNode = (
  playlist: AppleMusicPlaylist,
  playlistSongs: AppleMusicSong[] | undefined,
): MenuNode => ({
  id: `apple_playlist_${playlist.id}`,
  title: playlist.name,
  type: 'menu',
  previewImage: playlist.artworkUrl,
  appleMusicPlaylistId: playlist.id,
  detailLines: [
    playlist.description || 'Apple Music playlist',
    `${playlistSongs?.length ?? playlist.trackCount ?? 0} songs`,
  ],
  children: playlistSongs?.length
    ? playlistSongs.map(song => appleSongToMenuNode(song, 'library'))
    : [{
        id: `apple_playlist_${playlist.id}_empty`,
        title: 'No Songs',
        type: 'appleMusicStatus',
        detailLines: ['No songs returned for this playlist.'],
      }],
});

const generateAppleMusicChildren = (state: AppleMusicMenuState = {}): MenuNode[] => {
  const catalogResults = state.catalogResults || [];
  const allMusic = state.allMusic || [];
  const playlists = state.playlists || [];
  const playlistTracks = state.playlistTracks || {};
  const playlistTrackCount = Object.values(playlistTracks)
    .reduce((total, tracks) => total + tracks.length, 0);
  const defaultSearchTerm = state.defaultSearchTerm || 'Daft Punk';
  const syncLine = state.lastSyncedAt
    ? `${state.usingCachedLibrary ? 'Cached' : 'Synced'} ${new Date(state.lastSyncedAt).toLocaleString()}`
    : 'Not synced yet';
  const searchChildren: MenuNode[] = [
    {
      id: 'apple_search_catalog_run',
      title: 'Search Catalog',
      type: 'appleMusicStatus',
      action: 'apple_music_search_catalog',
      detailLines: [
        `Query: ${defaultSearchTerm}`,
        'Search Apple Music Catalog.',
      ],
    },
    {
      id: 'apple_catalog_results',
      title: 'Results',
      type: 'menu',
      children: catalogResults.length
        ? catalogResults.map(song => appleSongToMenuNode(song, 'catalog'))
        : [{ id: 'apple_no_catalog_results', title: 'No Results', type: 'appleMusicStatus', detailLines: ['Run Search Catalog first.'] }],
    },
  ];

  if (!state.hasUserToken) {
    return [
      {
        id: 'music_sign_in',
        title: 'Sign In',
        type: 'appleMusicStatus',
        action: 'apple_music_sign_in',
        statusTone: 'warning',
        detailLines: [
          'Apple Music sign-in is required.',
          'Select to start sign-in.',
          'Uses MusicKit for Android.',
          'Apple Music app must be installed and logged in.',
        ],
      },
      {
        id: 'apple_connection',
        title: 'Connection',
        type: 'appleMusicStatus',
        statusTone: state.status === 'success' ? 'success' : state.status === 'error' || state.status === 'needsConfig' ? 'error' : 'warning',
        detailLines: [
          state.message || 'Apple Music is not connected.',
          `Search: ${defaultSearchTerm}`,
          'User token: missing',
        ],
      },
    ];
  }

  return [
    {
      id: 'now_playing_menu',
      title: 'Now Playing',
      type: 'nowPlaying',
      detailLines: [
        state.message || 'Apple Music is connected.',
        'Select switches playback mode.',
      ],
    },
    generateCoverFlowNode(allMusic),
    {
      id: 'apple_all_songs',
      title: 'All Music',
      type: 'menu',
      children: allMusic.length
        ? allMusic.map(song => appleSongToMenuNode(song, 'library'))
        : [{ id: 'apple_no_library_results', title: 'No Songs', type: 'appleMusicStatus', detailLines: ['Run Sync first.'] }],
    },
    {
      id: 'apple_playlists',
      title: 'Playlists',
      type: 'menu',
      children: playlists.length
        ? playlists.map(playlist => applePlaylistToMenuNode(playlist, playlistTracks[playlist.id]))
        : [{ id: 'apple_no_playlists', title: 'No Playlists', type: 'appleMusicStatus', detailLines: ['Run Sync first.'] }],
    },
    {
      id: 'apple_favorite_current',
      title: 'Favorite',
      type: 'appleMusicStatus',
      action: 'apple_music_favorite_current',
      detailLines: [
        'Favorite the current song.',
        'Uses Apple Music favorites.',
      ],
    },
    {
      id: 'apple_search',
      title: 'Search',
      type: 'menu',
      children: searchChildren,
    },
    {
      id: 'apple_load_library',
      title: state.isSyncing ? 'Syncing...' : 'Sync',
      type: 'appleMusicStatus',
      action: 'apple_music_load_library',
      isLoading: state.isSyncing,
      statusTone: state.status === 'error' || state.status === 'needsConfig' ? 'error' : state.usingCachedLibrary ? 'warning' : 'neutral',
      detailLines: [
        state.isSyncing ? 'Refreshing playlists and tracks.' : 'Refresh playlists and playlist tracks.',
        `${allMusic.length} playlist songs`,
        `${playlists.length} playlists / ${playlistTrackCount} playlist tracks`,
        syncLine,
      ],
    },
  ];
};

export const generateAppleMusicMenu = (state: AppleMusicMenuState = {}): MenuNode => ({
  id: 'apple_music',
  title: 'Apple Music',
  type: 'menu',
  previewIcon: <PlayCircle className="w-16 h-16 text-red-500" />,
  children: generateAppleMusicChildren(state),
});

const spotifyShortcutToMenuNode = (shortcut: SpotifyShortcut): MenuNode => ({
  id: shortcut.id,
  title: shortcut.title,
  type: 'menu',
  spotifyUri: shortcut.uri,
  spotifyShortcut: shortcut,
  detailLines: [
    shortcut.subtitle || 'Spotify URI shortcut',
    shortcut.uri,
  ],
});

const spotifyTrackToMenuNode = (track: SpotifyTrack): MenuNode => ({
  id: `spotify_track_${track.uri.replace(/[^a-zA-Z0-9]+/g, '_')}`,
  title: track.title,
  type: 'menu',
  previewImage: track.artworkUrl,
  spotifyUri: track.uri,
  spotifyTrack: track,
  detailLines: [
    track.artist,
    track.album,
    'Current Spotify track',
  ],
});

const spotifyPlaylistTrackToMenuNode = (track: SpotifyPlaylistTrack): MenuNode => ({
  id: `spotify_playlist_track_${track.playlistId}_${track.position}_${track.uri.replace(/[^a-zA-Z0-9]+/g, '_')}`,
  title: track.title,
  type: 'menu',
  previewImage: track.artworkUrl,
  spotifyUri: track.uri,
  spotifyPlaylistTrack: track,
  spotifyTrack: track,
  detailLines: [
    track.artist,
    track.album,
    track.playlistName,
  ],
});

const spotifyPlaylistToMenuNode = (
  playlist: SpotifyPlaylist,
  tracks: SpotifyPlaylistTrack[] | undefined,
): MenuNode => ({
  id: `spotify_playlist_${playlist.id}`,
  title: playlist.name,
  type: 'menu',
  previewImage: playlist.imageUrl,
  spotifyUri: playlist.uri,
  spotifyPlaylist: playlist,
  detailLines: [
    playlist.ownerName ? `By ${playlist.ownerName}` : 'Spotify playlist',
    `${tracks?.length ?? playlist.trackTotal} songs`,
    playlist.description || playlist.uri,
  ],
  children: tracks?.length
    ? tracks.map(spotifyPlaylistTrackToMenuNode)
    : [{
        id: `spotify_playlist_${playlist.id}_empty`,
        title: 'No Songs',
        type: 'spotifyStatus',
        detailLines: ['Sync this playlist again.'],
      }],
});

const generateSpotifyCoverFlowNode = (
  playlists: SpotifyPlaylist[],
  tracksByPlaylist: Record<string, SpotifyPlaylistTrack[]>,
): MenuNode => ({
  id: 'spotify_cover_flow',
  title: 'Cover Flow',
  type: 'coverFlow',
  detailLines: playlists.length
    ? [`${playlists.length} playlists`, 'Browse synced Spotify playlists.']
    : ['Sync Spotify playlists first.'],
  children: playlists.map(playlist => spotifyPlaylistToMenuNode(playlist, tracksByPlaylist[playlist.id])),
});

const generateSpotifyChildren = (state: SpotifyMenuState = {}): MenuNode[] => {
  const shortcuts = state.shortcuts || [];
  const playlists = state.playlists || [];
  const tracksByPlaylist = state.tracksByPlaylist || {};
  const allTracks = state.allTracks || [];
  const needsConfig = !state.clientId || !state.spotifyInstalled;
  const syncLine = state.lastSyncedAt
    ? `Synced ${new Date(state.lastSyncedAt).toLocaleString()}`
    : 'Not synced yet';
  const statusTone = state.status === 'success' || state.status === 'ready'
    ? 'success'
    : state.status === 'error' || state.status === 'needsConfig' ? 'error' : 'warning';

  const connectionNodes: MenuNode[] = [
    {
      id: 'spotify_connect',
      title: state.connected ? 'Connected' : 'Connect',
      type: 'spotifyStatus',
      action: 'spotify_connect',
      isLoading: state.isWorking,
      statusTone,
      detailLines: [
        state.message || 'Connect to the local Spotify app.',
        state.spotifyInstalled ? 'Spotify app: installed' : 'Spotify app: missing',
        state.clientId ? 'Client ID: configured' : 'Client ID: missing',
      ],
    },
  ];

  if (needsConfig) {
    return [
      ...connectionNodes,
      {
        id: 'spotify_setup',
        title: 'Setup',
        type: 'spotifyStatus',
        statusTone: 'warning',
        detailLines: [
          'Install Spotify and set VITE_SPOTIFY_CLIENT_ID.',
          `Redirect URI: ${state.redirectUri || 'squarepod://spotify-callback'}`,
          'Whitelist package and SHA fingerprint in Spotify Dashboard.',
        ],
      },
    ];
  }

  return [
    {
      id: 'now_playing_menu',
      title: 'Now Playing',
      type: 'nowPlaying',
      detailLines: [
        state.connected ? 'Spotify remote is connected.' : 'Connect Spotify first.',
        'Select switches playback mode.',
      ],
    },
    ...connectionNodes,
    generateSpotifyCoverFlowNode(playlists, tracksByPlaylist),
    {
      id: 'spotify_all_songs',
      title: 'All Songs',
      type: 'menu',
      detailLines: [
        `${allTracks.length} cached songs`,
        'Unique tracks from synced playlists.',
      ],
      children: allTracks.length
        ? allTracks.map(spotifyPlaylistTrackToMenuNode)
        : [{
            id: 'spotify_no_all_songs',
            title: 'No Songs',
            type: 'spotifyStatus',
            detailLines: ['Run Sync first.'],
          }],
    },
    {
      id: 'spotify_current_track',
      title: 'Current Track',
      type: 'menu',
      children: state.currentTrack
        ? [spotifyTrackToMenuNode(state.currentTrack)]
        : [{
            id: 'spotify_no_current_track',
            title: 'No Track',
            type: 'spotifyStatus',
            detailLines: ['Start Spotify playback first.'],
          }],
    },
    {
      id: 'spotify_shortcuts',
      title: 'Shortcuts',
      type: 'menu',
      detailLines: [
        'Spotify playlist, album, artist, or track URIs.',
        'Set VITE_SPOTIFY_URIS to customize.',
      ],
      children: shortcuts.length
        ? shortcuts.map(spotifyShortcutToMenuNode)
        : [{
            id: 'spotify_no_shortcuts',
            title: 'No Shortcuts',
            type: 'spotifyStatus',
            detailLines: ['Set VITE_SPOTIFY_DEFAULT_URI or VITE_SPOTIFY_URIS.'],
          }],
    },
    {
      id: 'spotify_sync_library',
      title: state.isSyncing ? 'Syncing...' : 'Sync',
      type: 'spotifyStatus',
      action: 'spotify_sync_library',
      isLoading: state.isSyncing,
      statusTone: state.hasWebToken ? 'neutral' : 'warning',
      detailLines: [
        state.hasWebToken ? 'Refresh Spotify playlists and tracks.' : 'Sign in to Spotify Web API, then sync.',
        `${playlists.length} playlists`,
        `${allTracks.length} cached songs`,
        syncLine,
      ],
    },
    {
      id: 'spotify_capabilities',
      title: 'Account',
      type: 'spotifyStatus',
      statusTone: state.canPlayOnDemand ? 'success' : 'warning',
      detailLines: [
        state.canPlayOnDemand ? 'On-demand playback available.' : 'On-demand track playback may require Premium.',
        'Offline playback depends on Spotify app downloads.',
        'SquarePod does not cache Spotify audio.',
      ],
    },
  ];
};

export const generateSpotifyMenu = (spotify: SpotifyMenuState = {}): MenuNode => ({
  id: 'spotify',
  title: 'Spotify',
  type: 'menu',
  previewIcon: <PlayCircle className="w-16 h-16 text-green-500" />,
  children: generateSpotifyChildren(spotify),
});

export const generateMusicMenu = (local: LocalMusicMenuState = {}): MenuNode => {
  const locale = normalizeLocale(local.language);
  return {
    id: 'music',
    title: t(locale, 'music'),
    type: 'menu',
    previewIcon: <PlayCircle className="w-16 h-16 text-green-500" />,
    children: generateLocalMusicChildren(local)
  };
};

const mediaItemToNode = (item: MediaLibraryItem): MenuNode => ({
  id: item.id,
  title: item.title || (item.kind === 'photo' ? 'Photo' : 'Video'),
  type: item.kind === 'photo' ? 'photoDetail' : 'videoDetail',
  previewImage: item.thumbnailUri || item.uri,
  mediaItem: item,
  detailLines: [
    item.bucket || 'Android MediaStore',
    item.kind === 'video' && item.duration ? `${Math.round(item.duration / 1000)} sec` : `${item.width || 0} x ${item.height || 0}`,
    item.mimeType || item.uri,
  ],
});

const generateVideosMenu = (local: LocalMusicMenuState = {}): MenuNode => {
  const locale = normalizeLocale(local.language);
  const videos = local.videos || [];
  const tone = local.mediaStatus === 'success'
    ? 'success'
    : local.mediaStatus === 'error' || local.mediaStatus === 'needsPermission' ? 'error' : 'warning';

  return {
    id: 'videos',
    title: t(locale, 'videos'),
    type: 'menu',
    previewIcon: <Film className="w-16 h-16 text-purple-500" />,
    detailLines: [`${videos.length} local videos`, local.mediaMessage || 'Reads Android MediaStore videos.'],
    children: [
      {
        id: 'v_all',
        title: t(locale, 'videos'),
        type: 'menu',
        previewImage: videos[0]?.thumbnailUri,
        detailLines: [
          `${videos.length} videos`,
          videos[0]?.title ? `Latest: ${videos[0].title}` : local.mediaMessage || 'Open the local video library.',
        ],
        children: videos.length
          ? videos.map(mediaItemToNode)
          : [{
              id: 'v_no_videos',
              title: t(locale, 'noVideos'),
              type: 'localMusicStatus',
              statusTone: tone,
              detailLines: [local.mediaMessage || 'No local videos found.'],
            }],
      },
      {
        id: 'v_scan',
        title: local.isMediaScanning ? t(locale, 'scanning') : `${t(locale, 'scan')} ${t(locale, 'videos')}`,
        type: 'localMusicStatus',
        action: 'media_scan',
        isLoading: local.isMediaScanning,
        statusTone: tone,
        detailLines: [
          local.mediaMessage || 'Refresh Android image/video library.',
          `${videos.length} videos cached`,
        ],
      },
    ],
  };
};

const generatePhotosMenu = (local: LocalMusicMenuState = {}): MenuNode => {
  const locale = normalizeLocale(local.language);
  const photos = local.photos || [];
  const tone = local.mediaStatus === 'success'
    ? 'success'
    : local.mediaStatus === 'error' || local.mediaStatus === 'needsPermission' ? 'error' : 'warning';

  return {
    id: 'photos',
    title: t(locale, 'photos'),
    type: 'menu',
    previewIcon: <ImageIcon className="w-16 h-16 text-orange-500" />,
    detailLines: [`${photos.length} local photos`, local.mediaMessage || 'Reads Android MediaStore images.'],
    children: [
      {
        id: 'p_library',
        title: t(locale, 'photoLibrary'),
        type: 'photoGrid',
        previewImage: photos[0]?.thumbnailUri || photos[0]?.uri,
        detailLines: [
          `${photos.length} photos`,
          photos[0]?.bucket ? `Latest album: ${photos[0].bucket}` : local.mediaMessage || 'Open the local photo grid.',
        ],
        children: photos.length
          ? photos.map(mediaItemToNode)
          : [{
              id: 'p_no_photos',
              title: t(locale, 'noPhotos'),
              type: 'localMusicStatus',
              statusTone: tone,
              detailLines: [local.mediaMessage || 'No local photos found.'],
            }],
      },
      {
        id: 'p_scan',
        title: local.isMediaScanning ? t(locale, 'scanning') : `${t(locale, 'scan')} ${t(locale, 'photos')}`,
        type: 'localMusicStatus',
        action: 'media_scan',
        isLoading: local.isMediaScanning,
        statusTone: tone,
        detailLines: [
          local.mediaMessage || 'Refresh Android image/video library.',
          `${photos.length} photos cached`,
        ],
      },
    ],
  };
};

const radioTone = (status?: RadioStatus): 'neutral' | 'success' | 'warning' | 'error' => {
  if (!status) return 'warning';
  if (!status.wiredHeadsetConnected || !status.radioHardwareFeaturePresent || !status.radioBackendAvailable) return 'error';
  return status.isPlaying ? 'success' : 'neutral';
};

const radioStatusLines = (local: LocalMusicMenuState = {}) => {
  const status = local.radioStatus;
  return [
    status?.message || local.radioMessage || 'Checking radio hardware...',
    `Wired headset: ${status?.wiredHeadsetConnected ? 'connected' : 'required'}`,
    `Broadcast hardware: ${status?.radioHardwareFeaturePresent ? 'present' : 'missing'}`,
    `Radio backend: ${status?.radioBackendAvailable ? 'available' : 'unavailable'}`,
  ];
};

const radioStationNode = (station: RadioStation, preset = false): MenuNode => ({
  id: `${preset ? 'radio_preset' : 'radio_station'}_${station.frequency.toFixed(1).replace('.', '_')}`,
  title: station.title || `${station.frequency.toFixed(1)} MHz`,
  type: 'radioTune',
  action: 'radio_tune',
  radioFrequency: station.frequency,
  detailLines: [`${station.frequency.toFixed(1)} MHz`, preset ? 'Saved preset' : 'Scanned station'],
});

const generateRadioMenu = (local: LocalMusicMenuState = {}): MenuNode => {
  const locale = normalizeLocale(local.language);
  const status = local.radioStatus;
  const stations = local.radioStations || [];
  const presets = local.radioPresets || [];
  const frequency = status?.frequency;
  const tuneChildren: MenuNode[] = [
    { id: 'radio_manual_875', title: '87.5 MHz', type: 'radioTune', action: 'radio_tune', radioFrequency: 87.5 },
    { id: 'radio_manual_900', title: '90.0 MHz', type: 'radioTune', action: 'radio_tune', radioFrequency: 90.0 },
    { id: 'radio_manual_945', title: '94.5 MHz', type: 'radioTune', action: 'radio_tune', radioFrequency: 94.5 },
    { id: 'radio_manual_981', title: '98.1 MHz', type: 'radioTune', action: 'radio_tune', radioFrequency: 98.1 },
    { id: 'radio_manual_1067', title: '106.7 MHz', type: 'radioTune', action: 'radio_tune', radioFrequency: 106.7 },
  ];

  return {
    id: 'radio',
    title: t(locale, 'radio'),
    type: 'menu',
    previewIcon: <RadioIcon className="w-16 h-16 text-purple-600" />,
    detailLines: radioStatusLines(local),
    children: [
      {
        id: 'radio_now_playing',
        title: t(locale, 'nowPlaying'),
        type: 'radioNowPlaying',
        detailLines: radioStatusLines(local),
      },
      {
        id: 'radio_stations',
        title: t(locale, 'stations'),
        type: 'radioStationList',
        children: stations.length
          ? stations.map(station => radioStationNode(station))
          : [{
              id: 'radio_no_stations',
              title: t(locale, 'noStations'),
              type: 'radioStatus',
              statusTone: radioTone(status),
              detailLines: ['Run Scan Stations when a real backend is available.'],
            }],
      },
      {
        id: 'radio_scan',
        title: local.isRadioWorking ? t(locale, 'scanning') : `${t(locale, 'scan')} ${t(locale, 'stations')}`,
        type: 'radioStatus',
        action: 'radio_scan',
        isLoading: local.isRadioWorking,
        statusTone: radioTone(status),
        detailLines: radioStatusLines(local),
      },
      {
        id: 'radio_manual_tune',
        title: t(locale, 'manualTune'),
        type: 'menu',
        children: tuneChildren,
      },
      {
        id: 'radio_presets',
        title: t(locale, 'presets'),
        type: 'menu',
        children: [
          {
            id: 'radio_save_preset',
            title: frequency ? `${t(locale, 'save')} ${frequency.toFixed(1)}` : t(locale, 'savePreset'),
            type: 'radioStatus',
            action: 'radio_save_preset',
            statusTone: radioTone(status),
            detailLines: frequency ? [`${t(locale, 'save')} ${frequency.toFixed(1)} MHz`] : [t(locale, 'tuneFrequencyFirst')],
          },
          ...(
            presets.length
              ? presets.flatMap(preset => [
                  radioStationNode(preset, true),
                  {
                    id: `radio_delete_preset_${preset.frequency.toFixed(1).replace('.', '_')}`,
                    title: `${t(locale, 'delete')} ${preset.frequency.toFixed(1)}`,
                    type: 'radioStatus' as const,
                    action: 'radio_delete_preset' as const,
                    radioFrequency: preset.frequency,
                    detailLines: [`${t(locale, 'delete')} ${preset.frequency.toFixed(1)} MHz`],
                  },
                ])
              : [{
                  id: 'radio_no_presets',
                  title: t(locale, 'noPresets'),
                  type: 'radioStatus' as const,
                  statusTone: 'warning' as const,
                  detailLines: ['Saved presets appear here.'],
                }]
          ),
        ],
      },
      {
        id: 'radio_status',
        title: `${t(locale, 'radio')} ${t(locale, 'status')}`,
        type: 'radioStatus',
        statusTone: radioTone(status),
        detailLines: radioStatusLines(local),
      },
    ],
  };
};

const formatPercent = (value = 0) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

const playbackModeLabel = (mode: PlaybackMode = 'sequential', locale: Locale = 'en') => {
  switch (mode) {
    case 'shuffle':
      return t(locale, 'shuffle');
    case 'repeatAll':
      return t(locale, 'repeatAll');
    case 'repeatOne':
      return t(locale, 'repeatOne');
    case 'sequential':
    default:
      return t(locale, 'sequential');
  }
};

const enabledLabel = (enabled = true, locale: Locale = 'en') => enabled ? t(locale, 'on') : t(locale, 'off');

const backlightLabel = (value: string | undefined, locale: Locale) => (
  value === 'Always On' ? t(locale, 'alwaysOn') : value || '1m'
);

const generateMainMenuSettings = (local: LocalMusicMenuState = {}): MenuNode => {
  const locale = normalizeLocale(local.language);
  const titles: Record<string, string> = {
    music: t(locale, 'music'),
    videos: t(locale, 'videos'),
    photos: t(locale, 'photos'),
    radio: t(locale, 'radio'),
    notes: t(locale, 'notes'),
    ex_clock: t(locale, 'clock'),
    ex_contacts: t(locale, 'contacts'),
    ex_calendar: t(locale, 'calendar'),
    ex_stopwatch: t(locale, 'stopwatch'),
    ex_screen_lock: t(locale, 'screenLock'),
    shuffle_songs: t(locale, 'shuffleSongs'),
  };
  const order = normalizeMainMenuOrder(local.mainMenuSettingsOrder || local.mainMenuOrder);

  return {
    id: 'set_main_menu',
    title: t(locale, 'mainMenu'),
    type: 'menu',
    children: order.map(key => {
      const title = titles[key] || key;
      const enabled = isMainMenuItemEnabled(local.mainMenuEnabled, key);
      const reorderActive = local.mainMenuReorderKey === key;
      return {
      id: `set_main_menu_${key}`,
      title,
      type: 'localMusicStatus',
      action: 'settings_toggle_main_menu_item',
      settingKey: key,
      switchValue: enabled,
      reorderActive,
      statusTone: reorderActive ? 'success' : 'neutral',
      detailLines: [
        t(locale, 'visibilityControl', { name: title }),
        reorderActive ? t(locale, 'moveWithWheel') : t(locale, 'selectReorder'),
        reorderActive ? t(locale, 'selectApplyOrder') : t(locale, 'playPauseToggles'),
      ],
    } satisfies MenuNode;
    }),
  };
};

const generateContactsMenu = (local: LocalMusicMenuState = {}): MenuNode => {
  const locale = normalizeLocale(local.language);
  const contacts = local.contacts || [];
  return {
    id: 'ex_contacts',
    title: t(locale, 'contacts'),
    type: 'contactList',
    children: [
      {
        id: 'contact_add',
        title: t(locale, 'newContact'),
        type: 'localMusicStatus',
        action: 'contact_add',
        statusTone: 'neutral',
        detailLines: ['Creates a local SquarePod contact.'],
      },
      ...contacts.map(contact => ({
        id: `contact_${contact.id}`,
        title: contact.name,
        type: 'contactDetail' as const,
        contactId: contact.id,
        detailLines: [
          contact.phone || t(locale, 'noPhone'),
          contact.email || t(locale, 'noEmail'),
        ],
        children: [
          {
            id: `contact_edit_${contact.id}`,
            title: t(locale, 'editContact'),
            type: 'localMusicStatus' as const,
            action: 'contact_edit' as const,
            contactId: contact.id,
            statusTone: 'neutral' as const,
            detailLines: [t(locale, 'updateContact', { name: contact.name })],
          },
          {
            id: `contact_delete_${contact.id}`,
            title: t(locale, 'deleteContact'),
            type: 'localMusicStatus' as const,
            action: 'contact_delete' as const,
            contactId: contact.id,
            statusTone: 'warning' as const,
            detailLines: [`${t(locale, 'deleteContact')}: ${contact.name}`],
          },
        ],
      })),
    ],
  };
};

const sleepActionLabel = (action: SleepTimerEndAction) => {
  switch (action) {
    case 'fadePause':
      return 'Fade Out + Pause';
    case 'lock':
      return 'Lock Screen';
    case 'pause':
    default:
      return 'Pause Playback';
  }
};

const sleepRemainingMs = (timer?: SleepTimerMenuState) => {
  if (!timer || timer.status !== 'running' || !timer.startedAt || !timer.durationMs) return 0;
  return Math.max(0, timer.startedAt + timer.durationMs - Date.now());
};

const formatDurationLabel = (durationMs: number) => {
  const minutes = Math.round(durationMs / 60000);
  return `${minutes} min`;
};

const generateClockMenu = (local: LocalMusicMenuState = {}): MenuNode => {
  const locale = normalizeLocale(local.language);
  const timer = local.sleepTimer;
  const remaining = sleepRemainingMs(timer);
  const timerRunning = timer?.status === 'running';
  const timerCompleted = timer?.status === 'completed';
  const timerLines = timerRunning
    ? [`${Math.ceil(remaining / 60000)} min left`, `Ends with: ${sleepActionLabel(timer.endAction)}`]
    : timerCompleted
      ? ['Timer expired.', `Ended with: ${sleepActionLabel(timer.endAction)}`]
      : ['Select a duration.', `Ends with: ${sleepActionLabel(timer?.endAction || 'pause')}`];

  return {
    id: 'ex_clock',
    title: t(locale, 'clock'),
    type: 'menu',
    previewIcon: <Clock className="w-16 h-16" />,
    detailLines: timerLines,
    children: [
      {
        id: timerRunning ? 'sleep_timer_running' : timerCompleted ? 'sleep_timer_completed' : 'sleep_timer',
        title: timerRunning ? 'Sleep Timer: On' : timerCompleted ? 'Sleep Timer: Done' : 'Sleep Timer',
        type: 'clock',
        statusTone: timerRunning ? 'success' : timerCompleted ? 'warning' : 'neutral',
        detailLines: timerLines,
        children: [
          ...(timerRunning || timerCompleted ? [
            {
              id: 'sleep_timer_cancel',
              title: timerCompleted ? 'Clear Timer' : 'Cancel Timer',
              type: 'localMusicStatus' as const,
              action: 'sleep_timer_cancel' as const,
              statusTone: 'warning' as const,
              detailLines: ['Stop the timer without changing playback.'],
            },
            {
              id: 'sleep_timer_end_now',
              title: 'End Now',
              type: 'localMusicStatus' as const,
              action: 'sleep_timer_end_now' as const,
              statusTone: 'warning' as const,
              detailLines: [`Run action now: ${sleepActionLabel(timer.endAction)}.`],
            },
          ] : [
            ...[15, 30, 45, 60].map(minutes => ({
              id: `sleep_timer_${minutes}`,
              title: `${minutes} min`,
              type: 'localMusicStatus' as const,
              action: 'sleep_timer_start' as const,
              sleepTimerDurationMs: minutes * 60000,
              sleepTimerMode: 'duration' as const,
              statusTone: 'neutral' as const,
              detailLines: [`Start a ${minutes} minute sleep timer.`, `Ends with: ${sleepActionLabel(timer?.endAction || 'pause')}`],
            })),
          ]),
          {
            id: 'sleep_timer_action',
            title: `End Action: ${sleepActionLabel(timer?.endAction || 'pause')}`,
            type: 'localMusicStatus',
            action: 'sleep_timer_cycle_action',
            statusTone: 'neutral',
            detailLines: ['Select cycles Pause / Fade Out + Pause / Lock Screen.'],
          },
        ],
      },
      { id: 'clk_local', title: 'Local Time', type: 'clock' },
      { id: 'clk_new_york', title: 'New York', type: 'clock' },
      { id: 'clk_london', title: 'London', type: 'clock' },
      { id: 'clk_tokyo', title: 'Tokyo', type: 'clock' },
    ],
  };
};

const generateNotesMenu = (local: LocalMusicMenuState = {}, id = 'notes'): MenuNode => {
  const locale = normalizeLocale(local.language);
  const draft = local.noteDraft;
  const notes = [...(local.notes || [])].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return right.updatedAt - left.updatedAt;
  });
  return {
    id,
    title: t(locale, 'notes'),
    type: 'noteList',
    previewIcon: <FileText className="w-16 h-16" />,
    children: [
      {
        id: 'note_quick',
        title: draft ? 'Continue Draft' : 'Quick Note',
        type: 'localMusicStatus',
        action: 'note_quick',
        statusTone: draft ? 'warning' : 'neutral',
        detailLines: draft ? [draft.title || 'Unsaved draft', 'Select to continue.'] : ['Create a note, optionally attached to the current song.'],
      },
      {
        id: 'note_add',
        title: t(locale, 'newNote'),
        type: 'localMusicStatus',
        action: 'note_add',
        statusTone: 'neutral',
        detailLines: ['Create a clean note without song context.'],
      },
      ...(draft ? [{
        id: 'note_discard_draft',
        title: 'Discard Draft',
        type: 'localMusicStatus' as const,
        action: 'note_discard_draft' as const,
        statusTone: 'warning' as const,
        detailLines: ['Delete the unsaved draft.'],
      }] : []),
      ...notes.map(note => ({
        id: `note_${note.id}`,
        title: `${note.pinned ? '★ ' : ''}${note.title}`,
        type: 'noteDetail' as const,
        noteId: note.id,
        detailLines: [
          note.attachedSongTitle ? `${note.attachedSongArtist || 'Now Playing'} - ${note.attachedSongTitle}` : '',
          note.body,
          t(locale, 'updated', { date: new Date(note.updatedAt).toLocaleDateString() }),
        ].filter(Boolean),
        children: [
          {
            id: `note_edit_${note.id}`,
            title: t(locale, 'editNote'),
            type: 'localMusicStatus' as const,
            action: 'note_edit' as const,
            noteId: note.id,
            statusTone: 'neutral' as const,
            detailLines: [t(locale, 'updateNote', { name: note.title })],
          },
          {
            id: `note_delete_${note.id}`,
            title: t(locale, 'deleteNote'),
            type: 'noteDetail' as const,
            noteId: note.id,
            statusTone: 'warning' as const,
            detailLines: ['Select again to confirm delete.', note.title],
            children: [{
              id: `note_delete_confirm_${note.id}`,
              title: 'Confirm Delete',
              type: 'localMusicStatus' as const,
              action: 'note_delete_confirm' as const,
              noteId: note.id,
              statusTone: 'warning' as const,
              detailLines: ['This cannot be undone.'],
            }],
          },
        ],
      })),
    ],
  };
};

const formatEventDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString();
};

const todayInputValueFromDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayKey = () => todayInputValueFromDate(new Date());

const calendarEventToNode = (event: CalendarEventEntry, locale: Locale): MenuNode => ({
  id: `calendar_event_${event.id}`,
  title: event.time ? `${event.time} ${event.title}` : event.title,
  type: 'calendarEventDetail',
  calendarEventId: event.id,
  calendarEventDate: event.date,
  calendarEventTime: event.time,
  detailLines: [
    formatEventDate(event.date),
    event.time || t(locale, 'allDay'),
    event.notes || t(locale, 'noNotes'),
    t(locale, 'updated', { date: new Date(event.updatedAt).toLocaleDateString() }),
  ],
  children: [
    {
      id: `calendar_event_edit_${event.id}`,
      title: t(locale, 'editEvent'),
      type: 'localMusicStatus',
      action: 'calendar_event_edit',
      calendarEventId: event.id,
      statusTone: 'neutral',
      detailLines: [t(locale, 'updateEvent', { name: event.title })],
    },
    {
      id: `calendar_event_delete_${event.id}`,
      title: t(locale, 'deleteEvent'),
      type: 'calendarEventDetail',
      calendarEventId: event.id,
      statusTone: 'warning',
      detailLines: ['Select again to confirm delete.', event.title],
      children: [{
        id: `calendar_event_delete_confirm_${event.id}`,
        title: 'Confirm Delete',
        type: 'localMusicStatus',
        action: 'calendar_event_delete_confirm',
        calendarEventId: event.id,
        statusTone: 'warning',
        detailLines: ['This cannot be undone.'],
      }],
    },
  ],
});

const generateCalendarMenu = (local: LocalMusicMenuState = {}): MenuNode => {
  const locale = normalizeLocale(local.language);
  const now = local.calendarFocusDate ? new Date(`${local.calendarFocusDate}T00:00:00`) : new Date();
  const today = todayKey();
  const focusDate = todayInputValueFromDate(now);
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const allEvents = [...(local.calendarEvents || [])].sort((left, right) => {
    const dateSort = left.date.localeCompare(right.date);
    if (dateSort) return dateSort;
    return (left.time || '').localeCompare(right.time || '');
  });
  const monthEvents = allEvents.filter(event => event.date.startsWith(currentMonthPrefix));
  const todayEvents = allEvents.filter(event => event.date === focusDate);
  const upcomingEvents = allEvents.filter(event => event.date >= today).slice(0, 20);
  const eventNodes = monthEvents.map(event => calendarEventToNode(event, locale));

  return {
    id: 'ex_calendar',
    title: t(locale, 'calendar'),
    type: 'calendarEventList',
    previewIcon: <Calendar className="w-16 h-16" />,
    children: [
      {
        id: 'calendar_today',
        title: focusDate === today ? 'Today' : formatEventDate(focusDate),
        type: 'calendarEventList',
        calendarEventDate: focusDate,
        detailLines: todayEvents.length ? [`${todayEvents.length} event${todayEvents.length === 1 ? '' : 's'}`, 'Next/Previous changes day.'] : ['No events on this day.', 'Long Select is not required: use New Event.'],
        children: todayEvents.length
          ? todayEvents.map(event => calendarEventToNode(event, locale))
          : [{
              id: 'calendar_today_empty',
              title: t(locale, 'newEvent'),
              type: 'localMusicStatus',
              action: 'calendar_event_add',
              calendarEventDate: focusDate,
              detailLines: ['Create an event for this day.'],
            }],
      },
      {
        id: 'calendar_upcoming',
        title: 'Upcoming',
        type: 'calendarEventList',
        detailLines: upcomingEvents.length ? [`${upcomingEvents.length} upcoming events`] : ['No upcoming events.'],
        children: upcomingEvents.length
          ? upcomingEvents.map(event => calendarEventToNode(event, locale))
          : [{
              id: 'calendar_upcoming_empty',
              title: t(locale, 'newEvent'),
              type: 'localMusicStatus',
              action: 'calendar_event_add',
              detailLines: ['Create the next event.'],
            }],
      },
      {
        id: 'calendar_event_add',
        title: t(locale, 'newEvent'),
        type: 'localMusicStatus',
        action: 'calendar_event_add',
        statusTone: 'neutral',
        detailLines: ['Creates a local SquarePod calendar event.'],
      },
      {
        id: 'calendar_month',
        title: t(locale, 'monthView'),
        type: 'calendar',
        calendarEventDate: focusDate,
        detailLines: monthEvents.length
          ? [t(locale, 'eventsThisMonth', { count: monthEvents.length, plural: monthEvents.length === 1 ? '' : 's' }), 'Next/Previous changes month.']
          : [t(locale, 'noEventsThisMonth')],
        children: eventNodes,
      },
    ],
  };
};

const generateSettingsMenu = (local: LocalMusicMenuState = {}): MenuNode => {
  const locale = normalizeLocale(local.language);
  const trackCount = local.tracks?.length || 0;
  const albumCount = new Set((local.tracks || []).map(normalizeLocalAlbumKey)).size;
  const artistCount = new Set((local.tracks || []).map(track => track.artist || 'Unknown Artist')).size;

  return {
    id: 'settings',
    title: t(locale, 'settings'),
    type: 'menu',
    previewIcon: <Settings className="w-16 h-16 text-gray-400" />,
    children: [
      {
        id: 'set_about',
        title: t(locale, 'about'),
        type: 'about',
        previewIcon: <Info className="w-16 h-16" />,
        detailLines: [
          `${t(locale, 'allSongs')}: ${trackCount}`,
          `${t(locale, 'artists')}: ${artistCount}`,
          `${t(locale, 'albums')}: ${albumCount}`,
          'Android',
          '0.0.0',
        ],
      },
      {
        id: 'set_language',
        title: `${t(locale, 'language')}: ${localeLabel(locale)}`,
        type: 'menu',
        children: LOCALE_OPTIONS.map(option => ({
          id: `set_language_${option.code}`,
          title: option.nativeLabel,
          type: 'localMusicStatus' as const,
          action: 'settings_set_language' as const,
          settingKey: option.code,
          statusTone: option.code === locale ? 'success' as const : 'neutral' as const,
          detailLines: [option.label],
        })),
      },
      generateMainMenuSettings(local),
      {
        id: 'set_playback',
        title: t(locale, 'playback'),
        type: 'menu',
        children: [
          {
            id: 'set_playback_mode',
            title: `${t(locale, 'playbackMode')}: ${playbackModeLabel(local.playbackMode, locale)}`,
            type: 'localMusicStatus',
            action: 'settings_cycle_playback_mode',
            statusTone: 'neutral',
            detailLines: [
              playbackModeLabel(local.playbackMode, locale),
              `${t(locale, 'sequential')} / ${t(locale, 'shuffle')} / ${t(locale, 'repeatAll')} / ${t(locale, 'repeatOne')}`,
            ],
          },
          {
            id: 'set_continuation',
            title: `${t(locale, 'continuePlayback')}: ${local.continuationMode === 'album' ? t(locale, 'album') : t(locale, 'library')}`,
            type: 'localMusicStatus',
            action: 'local_toggle_continuation',
            statusTone: 'neutral',
            detailLines: [
              local.continuationMode === 'album' ? t(locale, 'album') : t(locale, 'library'),
              `${t(locale, 'album')} / ${t(locale, 'library')}`,
            ],
          },
          {
            id: 'set_eq',
            title: `${t(locale, 'eq')}: ${local.eqPreset || t(locale, 'off')}`,
            type: 'localMusicStatus',
            action: 'settings_cycle_eq',
            statusTone: 'neutral',
            detailLines: [
              `${t(locale, 'eq')}: ${local.eqPreset || t(locale, 'off')}`,
              `${t(locale, 'off')} / Bass Boost / Treble Boost / Spoken Word`,
            ],
          },
        ],
      },
      {
        id: 'set_interface',
        title: t(locale, 'interfaceSettings'),
        type: 'menu',
        children: [
          {
            id: 'set_click_sound',
            title: `${t(locale, 'clickSound')}: ${formatPercent(local.uiSoundVolume ?? 0.65)}`,
            type: 'localMusicStatus',
            action: 'settings_cycle_click_sound',
            previewIcon: <Volume2 className="w-16 h-16" />,
            statusTone: 'neutral',
            detailLines: [
              `${t(locale, 'clickSound')}: ${formatPercent(local.uiSoundVolume ?? 0.65)}`,
              `${t(locale, 'off')} / 25 / 50 / 75 / 100`,
            ],
          },
          {
            id: 'set_backlight',
            title: `${t(locale, 'backlight')}: ${backlightLabel(local.backlightTimer, locale)}`,
            type: 'localMusicStatus',
            action: 'settings_cycle_backlight',
            statusTone: 'neutral',
            detailLines: [
              `${t(locale, 'backlight')}: ${backlightLabel(local.backlightTimer, locale)}`,
              `30s / 1m / 2m / ${t(locale, 'alwaysOn')}`,
            ],
          },
        ],
      },
      {
        id: 'set_library',
        title: t(locale, 'librarySettings'),
        type: 'menu',
        children: [
          {
            id: 'set_auto_scan',
            title: `${t(locale, 'autoScan')}: ${enabledLabel(local.autoScan !== false, locale)}`,
            type: 'localMusicStatus',
            action: 'settings_toggle_auto_scan',
            previewIcon: <RefreshCw className="w-16 h-16" />,
            switchValue: local.autoScan !== false,
            statusTone: 'neutral',
            detailLines: [
              `${t(locale, 'autoScan')}: ${enabledLabel(local.autoScan !== false, locale)}`,
              `${t(locale, 'on')} / ${t(locale, 'off')}`,
            ],
          },
          {
            id: 'set_audiobooks',
            title: `${t(locale, 'audiobooks')}: ${enabledLabel(local.audiobooksEnabled, locale)}`,
            type: 'localMusicStatus',
            action: 'settings_toggle_audiobook',
            switchValue: local.audiobooksEnabled !== false,
            statusTone: 'neutral',
            detailLines: [
              `${t(locale, 'audiobooks')}: ${enabledLabel(local.audiobooksEnabled, locale)}`,
              `${t(locale, 'on')} / ${t(locale, 'off')}`,
            ],
          },
          {
            id: 'set_compilations',
            title: `${t(locale, 'compilations')}: ${enabledLabel(local.compilationsEnabled, locale)}`,
            type: 'localMusicStatus',
            action: 'settings_toggle_compilations',
            switchValue: local.compilationsEnabled !== false,
            statusTone: 'neutral',
            detailLines: [
              `${t(locale, 'compilations')}: ${enabledLabel(local.compilationsEnabled, locale)}`,
              `${t(locale, 'on')} / ${t(locale, 'off')}`,
            ],
          },
        ],
      },
      {
        id: 'set_legal',
        title: t(locale, 'legal'),
        type: 'legal',
        detailLines: [
          'SquarePod',
          'Apple Music / Spotify',
          'FM Radio',
        ],
      },
      {
        id: 'set_reset',
        title: t(locale, 'resetAppSettings'),
        type: 'localMusicStatus',
        action: 'settings_reset',
        previewIcon: <RotateCcw className="w-16 h-16" />,
        statusTone: 'warning',
        detailLines: [
          t(locale, 'resetAppSettings'),
          t(locale, 'music'),
        ],
      },
    ],
  };
};

export const generateMenuRoot = (local: LocalMusicMenuState = {}): MenuNode => {
  const locale = normalizeLocale(local.language);
  const configurableItems: Record<string, MenuNode> = {
    music: generateMusicMenu(local),
    videos: generateVideosMenu(local),
    photos: generatePhotosMenu(local),
    radio: generateRadioMenu(local),
    notes: generateNotesMenu(local),
    ex_clock: generateClockMenu(local),
    ex_contacts: generateContactsMenu(local),
    ex_calendar: generateCalendarMenu(local),
    ex_stopwatch: { id: 'ex_stopwatch', title: t(locale, 'stopwatch'), type: 'stopwatch' },
    ex_screen_lock: { id: 'ex_screen_lock', title: t(locale, 'screenLock'), type: 'screenLock', action: 'screen_lock' },
    shuffle_songs: {
      id: 'shuffle_songs',
      title: t(locale, 'shuffleSongs'),
      type: 'localMusicStatus',
      action: 'player_shuffle_all',
      previewIcon: <Shuffle className="w-16 h-16 text-green-500" />,
      detailLines: ['Shuffle all local songs.'],
    },
  };
  const order = normalizeMainMenuOrder(local.mainMenuOrder);
  const enabledItems = order
    .filter(key => isMainMenuItemEnabled(local.mainMenuEnabled, key))
    .map(key => configurableItems[key])
    .filter((item): item is MenuNode => Boolean(item));
  const extrasChildren = order
    .filter(key => !isMainMenuItemEnabled(local.mainMenuEnabled, key))
    .map(key => configurableItems[key])
    .filter((item): item is MenuNode => Boolean(item));

  return {
    id: 'root',
    title: 'iPod',
    type: 'menu',
    children: [
      ...enabledItems,
      {
        id: 'extras',
        title: t(locale, 'extras'),
        type: 'menu',
        children: extrasChildren,
      },
      generateSettingsMenu(local),
    ],
  };
};

export const MENU_ROOT: MenuNode = generateMenuRoot();
