import React, { ImgHTMLAttributes, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const ARTWORK_CACHE_NAME = 'squarepod-artwork-v1';
const objectUrlCache = new Map<string, string>();
const pendingArtworkLoads = new Map<string, Promise<string>>();

const resolveLocalArtwork = (sourceUrl?: string) => {
  if (!sourceUrl) return undefined;
  if (sourceUrl.startsWith('file://') || sourceUrl.startsWith('content://')) {
    return Capacitor.convertFileSrc(sourceUrl);
  }
  return sourceUrl;
};

const loadCachedArtwork = async (sourceUrl: string) => {
  if (sourceUrl.startsWith('file://') || sourceUrl.startsWith('content://')) {
    return Capacitor.convertFileSrc(sourceUrl);
  }

  const memoryHit = objectUrlCache.get(sourceUrl);
  if (memoryHit) return memoryHit;

  const pendingLoad = pendingArtworkLoads.get(sourceUrl);
  if (pendingLoad) return pendingLoad;

  const load = (async () => {
    if (!('caches' in window)) return sourceUrl;

    try {
      const cache = await caches.open(ARTWORK_CACHE_NAME);
      const cachedResponse = await cache.match(sourceUrl);

      if (cachedResponse) {
        const cachedBlob = await cachedResponse.blob();
        const objectUrl = URL.createObjectURL(cachedBlob);
        objectUrlCache.set(sourceUrl, objectUrl);
        return objectUrl;
      }

      const response = await fetch(sourceUrl, {
        cache: 'force-cache',
        mode: 'cors',
      });

      if (!response.ok) return sourceUrl;

      await cache.put(sourceUrl, response.clone());
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      objectUrlCache.set(sourceUrl, objectUrl);
      return objectUrl;
    } catch {
      return sourceUrl;
    }
  })();

  pendingArtworkLoads.set(sourceUrl, load);

  try {
    return await load;
  } finally {
    pendingArtworkLoads.delete(sourceUrl);
  }
};

interface CachedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string;
}

export function CachedImage({ src, onError, ...props }: CachedImageProps) {
  const [cachedSrc, setCachedSrc] = useState(resolveLocalArtwork(src));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    const localSrc = resolveLocalArtwork(src);
    setCachedSrc(localSrc);

    if (!src || localSrc !== src) return;

    loadCachedArtwork(src).then(nextSrc => {
      if (!cancelled) {
        setFailed(false);
        setCachedSrc(nextSrc);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!cachedSrc || failed) return null;

  return (
    <img
      {...props}
      src={cachedSrc}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
