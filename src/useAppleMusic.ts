import { Capacitor } from '@capacitor/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppleMusicAuth } from './native/appleMusicAuth';
import { AppleMusicClient, AppleMusicConfigError, AppleMusicPlaylist, AppleMusicSong } from './services/appleMusic';

type AppleMusicStatus = 'idle' | 'working' | 'ready' | 'needsConfig' | 'error' | 'success';
const USER_TOKEN_STORAGE_KEY = 'squarepod.appleMusicUserToken';
const LIBRARY_CACHE_VERSION = 1;
const LIBRARY_CACHE_PREFIX = 'squarepod.appleMusicLibraryCache.v1';

interface AppleMusicLibraryCache {
  version: number;
  cachedAt: number;
  allMusic: AppleMusicSong[];
  playlists: AppleMusicPlaylist[];
  playlistTracks: Record<string, AppleMusicSong[]>;
}

const summarizeAppleMusicError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('404') && message.includes('/tracks')) {
    return 'Some playlists have no readable tracks.';
  }
  if (message.includes('401') || message.includes('403')) {
    return 'Apple Music authorization needs refresh.';
  }
  return message;
};

const storedUserToken = () => {
  if (typeof window === 'undefined') return import.meta.env.VITE_APPLE_MUSIC_USER_TOKEN || '';
  return window.localStorage.getItem(USER_TOKEN_STORAGE_KEY) || import.meta.env.VITE_APPLE_MUSIC_USER_TOKEN || '';
};

const cacheKeyForToken = (token: string) => `${LIBRARY_CACHE_PREFIX}.${token.slice(0, 24)}`;

const formatCacheAge = (cachedAt: number) => {
  const ageMs = Date.now() - cachedAt;
  if (ageMs < 60_000) return 'just now';
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const readLibraryCache = (token: string): AppleMusicLibraryCache | undefined => {
  if (typeof window === 'undefined' || !token) return undefined;

  try {
    const raw = window.localStorage.getItem(cacheKeyForToken(token));
    if (!raw) return undefined;
    const cache = JSON.parse(raw) as AppleMusicLibraryCache;
    if (cache.version !== LIBRARY_CACHE_VERSION) return undefined;
    if (!Array.isArray(cache.allMusic) || !Array.isArray(cache.playlists) || !cache.playlistTracks) return undefined;
    return cache;
  } catch {
    return undefined;
  }
};

const writeLibraryCache = (token: string, cache: Omit<AppleMusicLibraryCache, 'version' | 'cachedAt'>) => {
  if (typeof window === 'undefined' || !token) return;

  const payload: AppleMusicLibraryCache = {
    version: LIBRARY_CACHE_VERSION,
    cachedAt: Date.now(),
    ...cache,
  };
  window.localStorage.setItem(cacheKeyForToken(token), JSON.stringify(payload));
};

export function useAppleMusic() {
  const [userToken, setUserToken] = useState(storedUserToken);
  const client = useMemo(() => new AppleMusicClient(userToken), [userToken]);
  const [status, setStatus] = useState<AppleMusicStatus>('idle');
  const [message, setMessage] = useState(
    userToken ? 'Apple Music user token is connected.' : 'Apple Music is not connected.',
  );
  const [catalogResults, setCatalogResults] = useState<AppleMusicSong[]>([]);
  const [libraryResults, setLibraryResults] = useState<AppleMusicSong[]>([]);
  const [allMusic, setAllMusic] = useState<AppleMusicSong[]>([]);
  const [playlists, setPlaylists] = useState<AppleMusicPlaylist[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<Record<string, AppleMusicSong[]>>({});
  const [lastSong, setLastSong] = useState<AppleMusicSong | undefined>();
  const [lastSyncedAt, setLastSyncedAt] = useState<number | undefined>();
  const [usingCachedLibrary, setUsingCachedLibrary] = useState(false);
  const loadedLibraryForToken = useRef('');

  const dedupeSongs = (songs: AppleMusicSong[]) => {
    const seen = new Set<string>();
    return songs.filter((song) => {
      const key = song.catalogId
        || song.libraryId
        || `${song.title.trim().toLowerCase()}|${song.artist.trim().toLowerCase()}|${song.album.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const applyCachedLibrary = (cache: AppleMusicLibraryCache) => {
    setLibraryResults([]);
    setAllMusic(cache.allMusic);
    setPlaylists(cache.playlists);
    setPlaylistTracks(cache.playlistTracks);
    setLastSong(cache.allMusic[0]);
    setLastSyncedAt(cache.cachedAt);
    setUsingCachedLibrary(true);
  };

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    let cancelled = false;
    AppleMusicAuth.getStatus()
      .then((authStatus) => {
        if (cancelled) return;
        if (!authStatus.appleMusicInstalled) {
          setStatus('needsConfig');
          setMessage('Apple Music app is not installed on this Android device.');
          return;
        }
        if (!authStatus.musicKitAvailable) {
          setStatus('needsConfig');
          setMessage('Apple Music app is installed. MusicKit Android SDK is missing from android/app/libs.');
          return;
        }
        if (!userToken) {
          setStatus('needsConfig');
          setMessage('Apple Music app and SDK are available. Sign in is still required.');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Apple Music status check failed.');
      });

    return () => {
      cancelled = true;
    };
  }, [userToken]);

  const run = async (operation: () => Promise<string>, workingMessage: string) => {
    setStatus('working');
    setMessage(workingMessage);

    try {
      const nextMessage = await operation();
      setStatus('success');
      setMessage(nextMessage);
    } catch (error) {
      console.error('Apple Music operation failed', error);
      const needsConfig = error instanceof AppleMusicConfigError;
      setStatus(needsConfig ? 'needsConfig' : 'error');
      setMessage(error instanceof Error ? error.message : 'Apple Music request failed.');
    }
  };

  const loadLibrarySnapshot = async () => {
    const playlistsResult = await Promise.allSettled([
      client.getLibraryPlaylists(),
    ]);

    const nextPlaylists = playlistsResult[0].status === 'fulfilled' ? playlistsResult[0].value : [];
    const playlistTrackEntries = await Promise.allSettled(
      nextPlaylists.map(async (playlist) => {
        const tracks = await client.getPlaylistTracks(playlist.id);
        return [playlist.id, tracks] as const;
      }),
    );
    const nextPlaylistTracks = Object.fromEntries(
      playlistTrackEntries
        .filter((result): result is PromiseFulfilledResult<readonly [string, AppleMusicSong[]]> => result.status === 'fulfilled')
        .map(result => result.value),
    );
    const nextAllMusic = dedupeSongs(Object.values(nextPlaylistTracks).flat());
    const errors = [
      playlistsResult[0].status === 'rejected' ? summarizeAppleMusicError(playlistsResult[0].reason) : '',
      ...playlistTrackEntries
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => summarizeAppleMusicError(result.reason)),
    ].filter(Boolean);
    const uniqueErrors = [...new Set(errors)];

    setLibraryResults([]);
    setAllMusic(nextAllMusic);
    setPlaylists(nextPlaylists);
    setPlaylistTracks(nextPlaylistTracks);
    setLastSong(nextAllMusic[0]);
    if (nextAllMusic.length || nextPlaylists.length) {
      const syncedAt = Date.now();
      setLastSyncedAt(syncedAt);
      setUsingCachedLibrary(false);
      writeLibraryCache(userToken, {
        allMusic: nextAllMusic,
        playlists: nextPlaylists,
        playlistTracks: nextPlaylistTracks,
      });
    }

    return {
      allMusic: nextAllMusic,
      playlists: nextPlaylists,
      playlistTracks: nextPlaylistTracks,
      errors: uniqueErrors,
    };
  };

  useEffect(() => {
    if (!userToken || loadedLibraryForToken.current === userToken) return;
    loadedLibraryForToken.current = userToken;

    const cached = readLibraryCache(userToken);
    if (cached) {
      applyCachedLibrary(cached);
      setStatus('ready');
      setMessage(`Loaded cached Apple Music library from ${formatCacheAge(cached.cachedAt)}. Syncing...`);
    }

    loadLibrarySnapshot()
      .then(({ allMusic: nextAllMusic, playlists: nextPlaylists, playlistTracks: nextPlaylistTracks, errors }) => {
        const playlistTrackCount = Object.values(nextPlaylistTracks)
          .reduce((total, tracks) => total + tracks.length, 0);

        if (nextAllMusic.length || nextPlaylists.length) {
          setStatus(errors.length ? 'error' : 'success');
          setMessage(errors.length
            ? `Partial Apple Music load. All Music: ${nextAllMusic.length}, playlists: ${nextPlaylists.length}. ${errors.join(' | ')}`
            : `Synced ${nextAllMusic.length} playlist songs, ${nextPlaylists.length} playlists, and ${playlistTrackCount} playlist tracks.`);
          return;
        }

        if (cached) {
          applyCachedLibrary(cached);
          setStatus('error');
          setMessage(`Sync returned no library data. Using cached library from ${formatCacheAge(cached.cachedAt)}.`);
          return;
        }

        setStatus('error');
        setMessage(errors.join(' | ') || 'Apple Music login complete, but no library data was returned.');
      })
      .catch((error) => {
        console.error('Apple Music library load failed', error);
        if (cached) {
          applyCachedLibrary(cached);
          setStatus('error');
          setMessage(`Sync failed. Using cached library from ${formatCacheAge(cached.cachedAt)}. ${error instanceof Error ? error.message : 'Apple Music library request failed.'}`);
          return;
        }
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Apple Music library request failed.');
      });
  }, [client, userToken]);

  const checkConnection = () => run(async () => {
    if (Capacitor.getPlatform() === 'android') {
      const authStatus = await AppleMusicAuth.getStatus();
      if (!authStatus.appleMusicInstalled) {
        throw new AppleMusicConfigError('Apple Music app is not installed on this Android device.');
      }
      if (!authStatus.musicKitAvailable) {
        throw new AppleMusicConfigError('Apple MusicKit Android SDK is missing from android/app/libs.');
      }
    }

    const configured = await client.isConfigured();
    if (!configured) {
      throw new AppleMusicConfigError('Missing Apple Music developer token configuration.');
    }

    return client.hasUserToken
      ? 'Developer token and user token are configured.'
      : 'Developer token is configured. User token is still missing.';
  }, 'Checking Apple Music configuration...');

  const startSignIn = () => run(async () => {
    if (Capacitor.getPlatform() !== 'android') {
      throw new AppleMusicConfigError('Apple Music login is only implemented in the Android app.');
    }

    const authStatus = await AppleMusicAuth.getStatus();
    if (!authStatus.appleMusicInstalled) {
      throw new AppleMusicConfigError('Apple Music app is not installed on this Android device.');
    }
    if (!authStatus.musicKitAvailable) {
      throw new AppleMusicConfigError('Apple MusicKit Android SDK is missing from android/app/libs.');
    }

    const developerToken = await client.getDeveloperToken();
    const result = await AppleMusicAuth.signIn({
      developerToken,
      startScreenMessage: 'Sign in to Apple Music to manage your library in SquarePod.',
    });

    if (!result.userToken) {
      throw new Error('Apple Music returned no user token.');
    }

    window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, result.userToken);
    setUserToken(result.userToken);
    return 'Apple Music login complete.';
  }, 'Opening Apple Music sign-in...');

  const loadLibrarySongs = () => run(async () => {
    const previousCache = readLibraryCache(userToken);
    const { allMusic: nextAllMusic, playlists: nextPlaylists, playlistTracks: nextPlaylistTracks, errors } = await loadLibrarySnapshot();
    const playlistTrackCount = Object.values(nextPlaylistTracks)
      .reduce((total, tracks) => total + tracks.length, 0);
    if (errors.length) {
      throw new Error(`Partial Apple Music sync. ${errors.join(' | ')}`);
    }

    if (!nextAllMusic.length && !nextPlaylists.length && previousCache) {
      applyCachedLibrary(previousCache);
    }

    return nextAllMusic.length
      ? `Synced ${nextAllMusic.length} playlist songs, ${nextPlaylists.length} playlists, and ${playlistTrackCount} playlist tracks.`
      : previousCache
        ? `No playlist songs were returned. Kept cached library from ${formatCacheAge(previousCache.cachedAt)}.`
        : 'No playlist songs were returned. Check whether your Apple Music playlists contain readable tracks.';
  }, 'Syncing your Apple Music library...');

  const searchCatalog = () => run(async () => {
    const songs = await client.searchCatalog();
    setCatalogResults(songs);
    setLastSong(songs[0]);
    return songs.length
      ? `Found ${songs.length} catalog songs for "${client.defaultSearchTerm}".`
      : `No catalog songs found for "${client.defaultSearchTerm}".`;
  }, `Searching Apple Music Catalog for "${client.defaultSearchTerm}"...`);

  const getPlaybackTokens = async () => ({
    developerToken: await client.getDeveloperToken(),
    userToken,
  });

  const addSongToFavorites = async (song: AppleMusicSong) => {
    const songId = song.catalogId || song.id;
    if (!songId) {
      throw new Error('This Apple Music song has no favorite-capable ID.');
    }

    await client.addSongToFavorites(songId);
    setStatus('success');
    setMessage(`Favorited ${song.title}.`);
  };

  return {
    status,
    message,
    hasUserToken: Boolean(userToken),
    defaultSearchTerm: client.defaultSearchTerm,
    catalogResults,
    libraryResults,
    allMusic,
    playlists,
    playlistTracks,
    lastSong,
    lastSyncedAt,
    usingCachedLibrary,
    startSignIn,
    checkConnection,
    searchCatalog,
    loadLibrarySongs,
    getPlaybackTokens,
    addSongToFavorites,
  };
}
