import { Song, MenuNode } from './types';
import React from 'react';
import { PlayCircle, Film, Image as ImageIcon, Mic, Settings, Shuffle, Clock, FileText, Calendar, Gamepad2, Info } from 'lucide-react';
import { LocalMusicTrack } from './native/localMusic';
import { AppleMusicPlaylist, AppleMusicSong } from './services/appleMusic';
import { SpotifyPlaylist, SpotifyPlaylistTrack, SpotifyShortcut, SpotifyTrack } from './services/spotify';

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
  isScanning?: boolean;
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

const localTrackToMenuNode = (track: LocalMusicTrack): MenuNode => ({
  id: stableNodeId('local_track', track.id || track.uri || `${track.title}|${track.artist}|${track.album}`),
  title: track.title || 'Unknown Title',
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

const generateLocalCoverFlowNode = (tracks: LocalMusicTrack[]): MenuNode => {
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
        children: albumTracks.map(localTrackToMenuNode),
      };
    });

  return {
    id: 'local_cover_flow',
    title: 'Cover Flow',
    type: 'coverFlow',
    detailLines: albums.length
      ? [`${albums.length} albums`, 'Browse local albums.']
      : ['Scan local music first.'],
    children: albums,
  };
};

const groupLocalTracks = (
  tracks: LocalMusicTrack[],
  idPrefix: string,
  getKey: (track: LocalMusicTrack) => string,
  getTitle: (track: LocalMusicTrack) => string,
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
      children: groupTracks.map(localTrackToMenuNode),
    }));
};

const generateLocalMusicChildren = (state: LocalMusicMenuState = {}): MenuNode[] => {
  const tracks = sortLocalTracks(state.tracks || []);
  const statusTone = state.status === 'success' || state.status === 'ready'
    ? 'success'
    : state.status === 'error' || state.status === 'needsPermission' ? 'error' : 'warning';

  return [
    {
      id: 'now_playing_menu',
      title: 'Now Playing',
      type: 'nowPlaying',
      detailLines: [
        state.currentTrack ? `${state.currentTrack.title} - ${state.currentTrack.artist}` : 'No local song playing.',
        'Select switches playback mode.',
      ],
    },
    generateLocalCoverFlowNode(tracks),
    {
      id: 'local_all_songs',
      title: 'All Songs',
      type: 'menu',
      detailLines: [
        `${tracks.length} local songs`,
        'Songs found on this Android device.',
      ],
      children: tracks.length
        ? tracks.map(localTrackToMenuNode)
        : [{
            id: 'local_no_all_songs',
            title: 'No Songs',
            type: 'localMusicStatus',
            statusTone: 'warning',
            detailLines: ['Select Scan first.'],
          }],
    },
    {
      id: 'local_artists',
      title: 'Artists',
      type: 'menu',
      children: tracks.length
        ? groupLocalTracks(
            tracks,
            'local_artist',
            track => track.artist || 'Unknown Artist',
            track => track.artist || 'Unknown Artist',
          )
        : [{
            id: 'local_no_artists',
            title: 'No Artists',
            type: 'localMusicStatus',
            statusTone: 'warning',
            detailLines: ['Select Scan first.'],
          }],
    },
    {
      id: 'local_albums',
      title: 'Albums',
      type: 'menu',
      children: tracks.length
        ? groupLocalTracks(
            tracks,
            'local_album',
            track => normalizeLocalAlbumKey(track),
            track => track.album || 'Unknown Album',
          )
        : [{
            id: 'local_no_albums',
            title: 'No Albums',
            type: 'localMusicStatus',
            statusTone: 'warning',
            detailLines: ['Select Scan first.'],
          }],
    },
    {
      id: 'local_scan',
      title: state.isScanning ? 'Scanning...' : 'Scan',
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
  return {
    id: 'music',
    title: 'Music',
    type: 'menu',
    previewIcon: <PlayCircle className="w-16 h-16 text-green-500" />,
    children: generateLocalMusicChildren(local)
  };
};

export const generateMenuRoot = (local: LocalMusicMenuState = {}): MenuNode => ({
  id: 'root',
  title: 'iPod',
  type: 'menu',
  children: [
    generateMusicMenu(local),
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
      type: 'localMusicStatus',
      action: 'player_shuffle_all',
      previewIcon: <Shuffle className="w-16 h-16 text-green-500" />,
      detailLines: ['Shuffle all local songs.'],
    }
  ]
});

export const MENU_ROOT: MenuNode = generateMenuRoot();
