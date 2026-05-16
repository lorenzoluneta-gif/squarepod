import { SpotifyLibraryCache, SpotifyPlaylist, SpotifyPlaylistTrack } from './spotify';
import { getSpotifyAccessToken } from './spotifyAuth';

const DB_NAME = 'squarepod-spotify-library';
const DB_VERSION = 1;
const CACHE_STORE = 'cache';
const CACHE_KEY = 'library';
const SPOTIFY_API = 'https://api.spotify.com/v1';

interface SpotifyImage {
  url: string;
  width?: number;
  height?: number;
}

interface SpotifyPaging<T> {
  items: T[];
  next: string | null;
}

interface SpotifyPlaylistApi {
  id: string;
  uri: string;
  name: string;
  description?: string;
  images?: SpotifyImage[];
  owner?: { display_name?: string };
  tracks?: { total?: number };
  snapshot_id?: string;
}

interface SpotifyTrackApi {
  id: string;
  uri: string;
  name: string;
  duration_ms?: number;
  explicit?: boolean;
  is_playable?: boolean;
  album?: {
    name?: string;
    images?: SpotifyImage[];
  };
  artists?: Array<{ name?: string }>;
}

interface SpotifyPlaylistItemApi {
  added_at?: string;
  track?: SpotifyTrackApi | null;
}

const emptyCache = (): SpotifyLibraryCache => ({
  playlists: [],
  tracksByPlaylist: {},
  allTracks: [],
});

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(CACHE_STORE)) {
      db.createObjectStore(CACHE_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Could not open Spotify cache.'));
});

const transaction = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, mode);
    const request = run(tx.objectStore(CACHE_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Spotify cache request failed.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Spotify cache transaction failed.'));
    };
  });
};

export const readSpotifyLibraryCache = async () => {
  if (typeof indexedDB === 'undefined') return emptyCache();
  try {
    return await transaction<SpotifyLibraryCache | undefined>('readonly', store => store.get(CACHE_KEY)) || emptyCache();
  } catch {
    return emptyCache();
  }
};

const writeSpotifyLibraryCache = async (cache: SpotifyLibraryCache) => {
  await transaction<IDBValidKey>('readwrite', store => store.put(cache, CACHE_KEY));
};

const firstImage = (images?: SpotifyImage[]) => images?.[0]?.url;

const requestSpotify = async <T>(url: string, accessToken: string) => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const message = await response.text();
    if (response.status === 403 && message.includes('Active premium subscription required')) {
      throw new Error('Spotify Web API blocked: the Spotify Developer app owner needs an active Premium subscription. Playlist sync cannot run until Spotify allows Web API access for this app.');
    }
    throw new Error(`Spotify Web API request failed: ${response.status} ${message}`);
  }

  return response.json() as Promise<T>;
};

const requestAllPages = async <T>(firstUrl: string, accessToken: string) => {
  const items: T[] = [];
  let url: string | null = firstUrl;

  while (url) {
    const page = await requestSpotify<SpotifyPaging<T>>(url, accessToken);
    items.push(...page.items);
    url = page.next;
  }

  return items;
};

const normalizePlaylist = (playlist: SpotifyPlaylistApi, syncedAt: number): SpotifyPlaylist => ({
  id: playlist.id,
  uri: playlist.uri,
  name: playlist.name || 'Untitled Playlist',
  description: playlist.description?.replace(/<[^>]*>/g, ''),
  ownerName: playlist.owner?.display_name,
  imageUrl: firstImage(playlist.images),
  trackTotal: playlist.tracks?.total || 0,
  snapshotId: playlist.snapshot_id,
  syncedAt,
});

const normalizeTrack = (
  item: SpotifyPlaylistItemApi,
  playlist: SpotifyPlaylist,
  position: number,
): SpotifyPlaylistTrack | undefined => {
  const track = item.track;
  if (!track?.uri || !track.id) return undefined;

  return {
    id: track.id,
    uri: track.uri,
    title: track.name || 'Unknown Track',
    artist: track.artists?.map(artist => artist.name).filter(Boolean).join(', ') || 'Unknown Artist',
    album: track.album?.name || 'Unknown Album',
    duration: Math.max(1, Math.round((track.duration_ms || 1000) / 1000)),
    artworkUrl: firstImage(track.album?.images) || playlist.imageUrl,
    playlistId: playlist.id,
    playlistUri: playlist.uri,
    playlistName: playlist.name,
    position,
    addedAt: item.added_at,
    isPlayable: track.is_playable,
    explicit: track.explicit,
  };
};

export const syncSpotifyLibrary = async (clientId: string) => {
  const accessToken = await getSpotifyAccessToken(clientId);
  if (!accessToken) throw new Error('Sign in to Spotify before syncing playlists.');

  const syncedAt = Date.now();
  const playlistItems = await requestAllPages<SpotifyPlaylistApi>(
    `${SPOTIFY_API}/me/playlists?limit=50`,
    accessToken,
  );
  const playlists = playlistItems.map(playlist => normalizePlaylist(playlist, syncedAt));
  const tracksByPlaylist: Record<string, SpotifyPlaylistTrack[]> = {};

  for (const playlist of playlists) {
    const fields = [
      'next',
      'items(added_at,track(id,uri,name,duration_ms,explicit,is_playable,artists(name),album(name,images(url,width,height))))',
    ].join(',');
    const url = `${SPOTIFY_API}/playlists/${encodeURIComponent(playlist.id)}/tracks?limit=50&fields=${encodeURIComponent(fields)}`;
    const items = await requestAllPages<SpotifyPlaylistItemApi>(url, accessToken);
    tracksByPlaylist[playlist.id] = items
      .map((item, index) => normalizeTrack(item, playlist, index))
      .filter((track): track is SpotifyPlaylistTrack => Boolean(track));
  }

  const uniqueTracks = new Map<string, SpotifyPlaylistTrack>();
  playlists.forEach(playlist => {
    tracksByPlaylist[playlist.id]?.forEach(track => {
      if (!uniqueTracks.has(track.uri)) uniqueTracks.set(track.uri, track);
    });
  });

  const cache: SpotifyLibraryCache = {
    playlists,
    tracksByPlaylist,
    allTracks: [...uniqueTracks.values()],
    lastSyncedAt: syncedAt,
  };
  await writeSpotifyLibraryCache(cache);
  return cache;
};
