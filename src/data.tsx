import { Song, MenuNode } from './types';
import React from 'react';
import { PlayCircle, Film, Image as ImageIcon, Mic, Settings, Shuffle, Clock, FileText, Calendar, Gamepad2, Info } from 'lucide-react';
import { AppleMusicPlaylist, AppleMusicSong } from './services/appleMusic';

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

export const generateMusicMenu = (appleMusic: AppleMusicMenuState = {}): MenuNode => {
  return {
    id: 'music',
    title: 'Music',
    type: 'menu',
    previewIcon: <PlayCircle className="w-16 h-16 text-blue-500" />,
    children: generateAppleMusicChildren(appleMusic)
  };
};

export const generateMenuRoot = (appleMusic: AppleMusicMenuState = {}): MenuNode => ({
  id: 'root',
  title: 'iPod',
  type: 'menu',
  children: [
    generateMusicMenu(appleMusic),
    {
      id: 'videos',
      title: 'Videos',
      type: 'menu',
      previewIcon: <Film className="w-16 h-16 text-purple-500" />,
      children: [
        { id: 'v_playlists', title: 'Video Playlists', type: 'menu', children: [] },
        { id: 'v_movies', title: 'Movies', type: 'menu', children: [] },
        { id: 'v_music_videos', title: 'Music Videos', type: 'menu', children: [] },
        { id: 'v_tv_shows', title: 'TV Shows', type: 'menu', children: [] },
        { id: 'v_podcasts', title: 'Video Podcasts', type: 'menu', children: [] },
      ]
    },
    {
      id: 'photos',
      title: 'Photos',
      type: 'menu',
      previewIcon: <ImageIcon className="w-16 h-16 text-orange-500" />,
      children: [
        { id: 'p_slideshow', title: 'Slideshow Settings', type: 'menu', children: [] },
        { id: 'p_roll', title: 'Camera Roll', type: 'photos' },
        { id: 'p_library', title: 'Photo Library', type: 'photos' },
      ]
    },
    {
      id: 'podcasts',
      title: 'Podcasts',
      type: 'menu',
      previewIcon: <Mic className="w-16 h-16 text-purple-600" />,
      children: [
        { id: 'pod_1', title: 'Tech Talk Daily', type: 'podcasts' },
        { id: 'pod_2', title: 'History Uncovered', type: 'podcasts' },
        { id: 'pod_3', title: 'Comedy Hour', type: 'podcasts' },
      ]
    },
    {
      id: 'extras',
      title: 'Extras',
      type: 'menu',
      children: [
        { id: 'ex_clock', title: 'Clock', type: 'menu', previewIcon: <Clock className="w-16 h-16" />, children: [
          { id: 'clk_new_york', title: 'New York', type: 'clock' },
          { id: 'clk_london', title: 'London', type: 'clock' },
          { id: 'clk_tokyo', title: 'Tokyo', type: 'clock' },
        ] },
        { id: 'ex_games', title: 'Games', type: 'menu', previewIcon: <Gamepad2 className="w-16 h-16" />, children: [
          { id: 'game_brick', title: 'Brick', type: 'game_brick' },
          { id: 'game_parachute', title: 'Parachute', type: 'placeholder' },
          { id: 'game_solitaire', title: 'Solitaire', type: 'placeholder' },
          { id: 'game_music_quiz', title: 'Music Quiz', type: 'placeholder' },
        ] },
        { id: 'ex_contacts', title: 'Contacts', type: 'placeholder', children: [] },
        { id: 'ex_calendar', title: 'Calendar', type: 'calendar', previewIcon: <Calendar className="w-16 h-16" />, children: [] },
        { id: 'ex_notes', title: 'Notes', type: 'placeholder', previewIcon: <FileText className="w-16 h-16" />, children: [] },
        { id: 'ex_stopwatch', title: 'Stopwatch', type: 'stopwatch' },
        { id: 'ex_screen_lock', title: 'Screen Lock', type: 'placeholder' },
      ]
    },
    {
      id: 'settings',
      title: 'Settings',
      type: 'menu',
      previewIcon: <Settings className="w-16 h-16 text-gray-400" />,
      children: [
        { id: 'set_about', title: 'About', type: 'about', previewIcon: <Info className="w-16 h-16" /> },
        { id: 'set_main_menu', title: 'Main Menu', type: 'placeholder' },
        { id: 'set_shuffle', title: 'Shuffle', type: 'placeholder' },
        { id: 'set_repeat', title: 'Repeat', type: 'placeholder' },
        { id: 'set_backlight', title: 'Backlight Timer', type: 'placeholder' },
        { id: 'set_audiobooks', title: 'Audiobooks', type: 'placeholder' },
        { id: 'set_eq', title: 'EQ', type: 'placeholder' },
        { id: 'set_compilations', title: 'Compilations', type: 'placeholder' },
        { id: 'set_language', title: 'Language', type: 'placeholder' },
        { id: 'set_legal', title: 'Legal', type: 'placeholder' },
        { id: 'set_reset', title: 'Reset all settings', type: 'placeholder' },
      ]
    },
    {
      id: 'shuffle_songs',
      title: 'Shuffle Songs',
      type: 'appleMusicStatus',
      action: 'player_shuffle_all',
      previewIcon: <Shuffle className="w-16 h-16 text-green-500" />,
      detailLines: ['Shuffle all synced playlist songs.'],
    }
  ]
});

export const MENU_ROOT: MenuNode = generateMenuRoot();
