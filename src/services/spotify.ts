export interface SpotifyTrack {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artworkUrl?: string;
}

export interface SpotifyPlaylist {
  id: string;
  uri: string;
  name: string;
  description?: string;
  ownerName?: string;
  imageUrl?: string;
  trackTotal: number;
  snapshotId?: string;
  syncedAt: number;
}

export interface SpotifyPlaylistTrack extends SpotifyTrack {
  playlistId: string;
  playlistUri: string;
  playlistName: string;
  position: number;
  addedAt?: string;
  isPlayable?: boolean;
  explicit?: boolean;
}

export interface SpotifyLibraryCache {
  playlists: SpotifyPlaylist[];
  tracksByPlaylist: Record<string, SpotifyPlaylistTrack[]>;
  allTracks: SpotifyPlaylistTrack[];
  lastSyncedAt?: number;
}

export interface SpotifyShortcut {
  id: string;
  title: string;
  uri: string;
  subtitle?: string;
}

export type SpotifyStatus = 'idle' | 'working' | 'ready' | 'needsConfig' | 'error' | 'success';

const SHORTCUTS_STORAGE_KEY = 'squarepod.spotifyShortcuts.v1';

const defaultSpotifyUri = import.meta.env.VITE_SPOTIFY_DEFAULT_URI || 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M';

const titleFromUri = (uri: string) => {
  const parts = uri.split(':');
  const type = parts[1] || 'content';
  const id = parts[2] || uri;
  return `${type.charAt(0).toUpperCase()}${type.slice(1)} ${id.slice(0, 6)}`;
};

const shortcutFromToken = (token: string, index: number): SpotifyShortcut | undefined => {
  const trimmed = token.trim();
  if (!trimmed) return undefined;

  const [rawTitle, rawUri, rawSubtitle] = trimmed.includes('|')
    ? trimmed.split('|').map(part => part.trim())
    : ['', trimmed, ''];
  const uri = rawUri || rawTitle;
  if (!uri.startsWith('spotify:')) return undefined;

  return {
    id: `spotify_shortcut_${index}_${uri.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    title: rawTitle && rawUri ? rawTitle : titleFromUri(uri),
    uri,
    subtitle: rawSubtitle || undefined,
  };
};

export const configuredSpotifyShortcuts = (): SpotifyShortcut[] => {
  const configured = String(import.meta.env.VITE_SPOTIFY_URIS || '')
    .split(',')
    .map(shortcutFromToken)
    .filter((shortcut): shortcut is SpotifyShortcut => Boolean(shortcut));

  if (configured.length) return configured;

  return [{
    id: 'spotify_default_playlist',
    title: 'Default Playlist',
    uri: defaultSpotifyUri,
    subtitle: 'Set VITE_SPOTIFY_DEFAULT_URI or VITE_SPOTIFY_URIS.',
  }];
};

export const readSpotifyShortcuts = () => {
  if (typeof window === 'undefined') return configuredSpotifyShortcuts();

  try {
    const stored = window.localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (!stored) return configuredSpotifyShortcuts();
    const parsed = JSON.parse(stored) as SpotifyShortcut[];
    if (!Array.isArray(parsed)) return configuredSpotifyShortcuts();
    const valid = parsed.filter(shortcut => shortcut.uri?.startsWith('spotify:') && shortcut.title);
    return valid.length ? valid : configuredSpotifyShortcuts();
  } catch {
    return configuredSpotifyShortcuts();
  }
};

export const writeSpotifyShortcuts = (shortcuts: SpotifyShortcut[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
};
