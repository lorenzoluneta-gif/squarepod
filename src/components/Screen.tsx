import React, { useEffect, useRef, useState } from 'react';
import { MenuNode, PlaybackMode, Song } from '../types';
import { motion, useReducedMotion } from 'motion/react';
import { CachedImage } from './CachedImage';
import { DeviceStatus } from '../native/deviceStatus';

interface ScreenProps {
  currentNode: MenuNode;
  cursorIndex: number;
  isPlaying: boolean;
  currentSong?: Song;
  progress: number;
  playbackMode: PlaybackMode;
  coverFlowIsSelecting: boolean;
  coverFlowIsDragging: boolean;
  coverFlowReleaseId: number;
  coverFlowReleaseVelocity: number;
  onCoverFlowSettleTarget: (index: number) => void;
}

const COVER_FLOW_DRAG_MAX_SPEED = 14;
const COVER_FLOW_DRAG_FOLLOW_RATE = 16;
const COVER_FLOW_SETTLE_MAX_SPEED = 4.1;
const COVER_FLOW_SETTLE_FOLLOW_RATE = 6.4;
const COVER_FLOW_SETTLE_EPSILON = 0.015;
const COVER_FLOW_RELEASE_MAX_DISTANCE = 1.65;
const COVER_FLOW_RELEASE_MIN_DISTANCE = 0.62;
const COVER_FLOW_RELEASE_VELOCITY_FACTOR = 0.22;
const COVER_FLOW_RELEASE_VELOCITY_EPSILON = 0.15;
const COVER_FLOW_VISIBLE_RANGE = 4.25;

export function Screen({
  currentNode,
  cursorIndex,
  isPlaying,
  currentSong,
  progress,
  playbackMode,
  coverFlowIsSelecting,
  coverFlowIsDragging,
  coverFlowReleaseId,
  coverFlowReleaseVelocity,
  onCoverFlowSettleTarget,
}: ScreenProps) {
  const [coverFlowPosition, setCoverFlowPosition] = useState(cursorIndex);
  const [batteryPercent, setBatteryPercent] = useState<number>();
  const [batteryCharging, setBatteryCharging] = useState(false);
  const coverFlowPositionRef = useRef(cursorIndex);
  const coverFlowTargetRef = useRef(cursorIndex);
  const coverFlowMotionModeRef = useRef<'drag' | 'settle'>('settle');
  const coverFlowFrameRef = useRef<number | null>(null);
  const coverFlowLastTimeRef = useRef<number | null>(null);
  const coverFlowLastReleaseIdRef = useRef(coverFlowReleaseId);
  const coverFlowPreviousNodeIdRef = useRef<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const coverFlowAlbumCount = currentNode.type === 'coverFlow'
    ? currentNode.children?.length || 0
    : 0;

  useEffect(() => {
    const previousNodeId = coverFlowPreviousNodeIdRef.current;
    const enteredCoverFlow = currentNode.type === 'coverFlow' && previousNodeId !== currentNode.id;
    const enteredFromCoverAlbum = enteredCoverFlow && Boolean(previousNodeId?.startsWith('cover_album_'));

    if (currentNode.type !== 'coverFlow') {
      if (coverFlowFrameRef.current !== null) {
        cancelAnimationFrame(coverFlowFrameRef.current);
        coverFlowFrameRef.current = null;
      }
      coverFlowMotionModeRef.current = 'settle';
      coverFlowLastTimeRef.current = null;
      coverFlowLastReleaseIdRef.current = coverFlowReleaseId;
      coverFlowPreviousNodeIdRef.current = currentNode.id;
      return;
    }

    if (enteredCoverFlow && !enteredFromCoverAlbum) {
      if (coverFlowFrameRef.current !== null) {
        cancelAnimationFrame(coverFlowFrameRef.current);
        coverFlowFrameRef.current = null;
      }
      coverFlowPositionRef.current = cursorIndex;
      coverFlowTargetRef.current = cursorIndex;
      coverFlowMotionModeRef.current = 'settle';
      coverFlowLastTimeRef.current = null;
      coverFlowLastReleaseIdRef.current = coverFlowReleaseId;
      setCoverFlowPosition(cursorIndex);
    }

    if (shouldReduceMotion || coverFlowIsSelecting) {
      if (coverFlowFrameRef.current !== null) {
        cancelAnimationFrame(coverFlowFrameRef.current);
        coverFlowFrameRef.current = null;
      }
      coverFlowPositionRef.current = cursorIndex;
      coverFlowTargetRef.current = cursorIndex;
      coverFlowMotionModeRef.current = 'settle';
      coverFlowLastTimeRef.current = null;
      coverFlowLastReleaseIdRef.current = coverFlowReleaseId;
      coverFlowPreviousNodeIdRef.current = currentNode.id;
      setCoverFlowPosition(cursorIndex);
      return;
    }

    if (coverFlowReleaseId !== coverFlowLastReleaseIdRef.current) {
      coverFlowLastReleaseIdRef.current = coverFlowReleaseId;

      const current = coverFlowPositionRef.current;
      const velocityDirection = Math.sign(coverFlowReleaseVelocity);
      const maxIndex = Math.max(0, coverFlowAlbumCount - 1);
      const rawTarget = Math.abs(coverFlowReleaseVelocity) < COVER_FLOW_RELEASE_VELOCITY_EPSILON
        ? current
        : current + Math.max(
          COVER_FLOW_RELEASE_MIN_DISTANCE,
          Math.min(
            COVER_FLOW_RELEASE_MAX_DISTANCE,
            Math.abs(coverFlowReleaseVelocity) * COVER_FLOW_RELEASE_VELOCITY_FACTOR,
          ),
        ) * velocityDirection;
      const targetIndex = Math.max(0, Math.min(maxIndex, Math.round(rawTarget)));

      coverFlowTargetRef.current = targetIndex;
      coverFlowMotionModeRef.current = 'settle';
      onCoverFlowSettleTarget(targetIndex);
    } else {
      coverFlowTargetRef.current = cursorIndex;
      coverFlowMotionModeRef.current = coverFlowIsDragging ? 'drag' : 'settle';
    }

    const step = (timestamp: number) => {
      const previousTime = coverFlowLastTimeRef.current ?? timestamp;
      const dt = Math.min(0.04, Math.max(0.001, (timestamp - previousTime) / 1000));
      coverFlowLastTimeRef.current = timestamp;

      const current = coverFlowPositionRef.current;
      const target = coverFlowTargetRef.current;
      const distance = target - current;

      if (Math.abs(distance) < COVER_FLOW_SETTLE_EPSILON) {
        coverFlowPositionRef.current = target;
        setCoverFlowPosition(target);
        coverFlowFrameRef.current = null;
        coverFlowLastTimeRef.current = null;
        return;
      }

      const isDragging = coverFlowMotionModeRef.current === 'drag';
      const followRate = isDragging ? COVER_FLOW_DRAG_FOLLOW_RATE : COVER_FLOW_SETTLE_FOLLOW_RATE;
      const maxSpeed = isDragging ? COVER_FLOW_DRAG_MAX_SPEED : COVER_FLOW_SETTLE_MAX_SPEED;
      const easedStep = distance * (1 - Math.exp(-followRate * dt));
      const maxStep = maxSpeed * dt;
      const nextStep = Math.sign(distance) * Math.min(Math.abs(easedStep), maxStep, Math.abs(distance));
      const nextPosition = current + nextStep;

      coverFlowPositionRef.current = nextPosition;
      setCoverFlowPosition(nextPosition);
      coverFlowFrameRef.current = requestAnimationFrame(step);
    };

    if (coverFlowFrameRef.current === null) {
      coverFlowLastTimeRef.current = null;
      coverFlowFrameRef.current = requestAnimationFrame(step);
    }
    coverFlowPreviousNodeIdRef.current = currentNode.id;
  }, [
    cursorIndex,
    currentNode.type,
    coverFlowAlbumCount,
    coverFlowIsSelecting,
    coverFlowIsDragging,
    coverFlowReleaseId,
    coverFlowReleaseVelocity,
    onCoverFlowSettleTarget,
    shouldReduceMotion,
  ]);

  useEffect(() => {
    return () => {
      if (coverFlowFrameRef.current !== null) {
        cancelAnimationFrame(coverFlowFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const refreshBattery = () => {
      DeviceStatus.getBattery()
        .then(status => {
          if (disposed) return;
          setBatteryPercent(status.percent);
          setBatteryCharging(status.charging);
        })
        .catch(() => undefined);
    };

    refreshBattery();
    const timer = window.setInterval(refreshBattery, 60000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderPlaybackModeIcon = () => {
    if (currentNode.type !== 'nowPlaying' || playbackMode === 'sequential') return null;

    if (playbackMode === 'shuffle') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Shuffle">
          <path d="M16 3h5v5" />
          <path d="M4 20 21 3" />
          <path d="M21 16v5h-5" />
          <path d="M15 15 21 21" />
          <path d="M4 4l5 5" />
        </svg>
      );
    }

    return (
      <div className="relative h-4 w-4" aria-label={playbackMode === 'repeatOne' ? 'Repeat One' : 'Repeat All'}>
        <svg className="absolute inset-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 1l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 23l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        {playbackMode === 'repeatOne' && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[45%] text-[8px] font-black leading-none">1</span>
        )}
      </div>
    );
  };

  const renderHeader = () => (
    <div className="bg-gradient-to-b from-gray-100 to-gray-200 h-[24px] min-h-[24px] max-h-[24px] shrink-0 border-b border-gray-300 flex items-center justify-between px-6 overflow-hidden">
      <div className="flex items-center space-x-1 w-16 h-full">
        {isPlaying && (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" className="text-gray-700">
             <path d="M0 0h3v12H0zm7 0h3v12H7z" />
          </svg>
        )}
      </div>
      <div className="text-[10px] leading-none font-bold text-gray-700 uppercase tracking-tighter truncate flex-1 text-center">
        {currentNode.title}
      </div>
      <div className="flex items-center justify-end w-16 h-full gap-1 text-gray-700">
         {renderPlaybackModeIcon()}
         {batteryPercent !== undefined && (
           <span className="min-w-[21px] text-right text-[9px] font-black leading-none tabular-nums text-gray-700">
             {batteryPercent}%
           </span>
         )}
         <div className="relative h-2 w-4 rounded-sm border border-gray-400 bg-white">
           <div
             className={`h-full rounded-[1px] ${batteryPercent !== undefined && batteryPercent <= 15 ? 'bg-red-500' : 'bg-green-500'}`}
             style={{ width: `${batteryPercent ?? 100}%` }}
           />
           {batteryCharging && (
             <div className="absolute inset-0 flex items-center justify-center text-[7px] font-black leading-none text-black/70">
               +
             </div>
           )}
         </div>
      </div>
    </div>
  );

  const renderRightPreview = (selectedChild?: MenuNode) => {
    if (selectedChild?.previewImage) {
      return (
        <div className="w-1/2 h-full bg-neutral-50 flex items-center justify-center p-6">
           <CachedImage src={selectedChild.previewImage} className="w-full aspect-square object-cover shadow-lg rounded-sm" />
        </div>
      );
    }

    const isMusicRelated = ['music', 'now_playing_menu', 'shuffle_songs'].includes(selectedChild?.id || '');
    
    if (currentSong && (isMusicRelated || (!selectedChild?.previewIcon && !selectedChild?.previewImage && !selectedChild?.detailLines?.length))) {
      const duration = Math.max(1, currentSong.duration || 1);
      const progressPercent = Math.max(0, Math.min(100, (progress / duration) * 100));
      const remaining = Math.max(0, duration - progress);

      return (
        <div className="w-1/2 h-full bg-neutral-50 flex flex-col items-center justify-center p-6">
          <div className="w-full aspect-square shadow-lg relative group overflow-hidden rounded-sm bg-neutral-300">
            <CachedImage src={currentSong.coverUrl} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-auto">Now Playing</p>
              <p className="text-sm font-bold leading-tight px-2 w-full truncate">{currentSong.title}</p>
              <p className="text-[10px] font-medium w-full truncate px-2 mb-2">{currentSong.artist}</p>
            </div>
          </div>
          <div className="mt-4 w-full px-2">
            <div className="h-1 bg-gray-300 rounded-full w-full overflow-hidden">
              <div 
                className="h-full bg-blue-500" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] text-gray-400 font-bold">{formatTime(progress)}</span>
              <span className="text-[8px] text-gray-400 font-bold">-{formatTime(remaining)}</span>
            </div>
          </div>
        </div>
      );
    }

    if (selectedChild?.detailLines?.length) {
      return (
        <div className="w-1/2 h-full bg-neutral-50 flex flex-col justify-center p-5 overflow-hidden shadow-inner">
          <div className="flex items-center gap-2">
            {selectedChild.isLoading && (
              <motion.div
                className="h-3 w-3 shrink-0 rounded-full border-2 border-gray-300 border-t-blue-500"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            )}
            <div className="text-sm font-bold leading-tight text-gray-900 truncate">{selectedChild.title}</div>
          </div>
          <div className="mt-3 space-y-2">
            {selectedChild.detailLines.map((line, index) => (
              <div key={`${line}-${index}`} className="text-[10px] font-semibold leading-tight text-gray-500">
                {line}
              </div>
            ))}
          </div>
          {selectedChild.isLoading && (
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-gray-200">
              <motion.div
                className="h-full w-1/3 rounded-full bg-blue-500"
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          )}
        </div>
      );
    }

    if (selectedChild?.previewIcon) {
       return (
         <div className="w-1/2 h-full bg-neutral-50 flex items-center justify-center p-6 relative overflow-hidden shadow-inner">
            <div className="text-gray-400">
               {selectedChild.previewIcon}
            </div>
         </div>
       );
    }

    return (
      <div className="w-1/2 h-full bg-neutral-50 flex items-center justify-center relative overflow-hidden shadow-inner">
         <div className="text-gray-300 opacity-30 pointer-events-none scale-150">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-24 h-24">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
         </div>
      </div>
    );
  };

  const renderNowPlayingFull = () => {
    if (!currentSong) return <div className="flex-1 flex items-center justify-center text-xs font-bold font-sans">No Song Selected</div>;

    const duration = Math.max(1, currentSong.duration || 1);
    const progressPercent = Math.max(0, Math.min(100, (progress / duration) * 100));
    const remaining = Math.max(0, duration - progress);
    
    return (
      <div className="flex-1 flex w-full h-full bg-neutral-50">
        <div className="w-1/2 p-6 flex flex-col items-center justify-center border-r border-gray-200">
           <CachedImage src={currentSong.coverUrl} className="w-full aspect-square object-cover shadow-lg rounded-sm" />
        </div>
        <div className="w-1/2 flex flex-col justify-center px-6 font-sans overflow-hidden">
          <div className="min-h-[88px]">
            <div className="text-lg font-bold truncate leading-tight text-gray-900">{currentSong.title}</div>
            <div className="text-sm font-semibold text-gray-700 truncate leading-tight mt-1">{currentSong.artist}</div>
            <div className="text-xs text-gray-500 truncate leading-tight mt-1">{currentSong.album}</div>
          </div>
          
          <div className="mt-6 flex flex-col w-full">
            <div className="w-full bg-gray-300 h-1.5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-gray-500 mt-1.5">
              <span>{formatTime(progress)}</span>
              <span>-{formatTime(remaining)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSongDetail = () => {
    const track = currentNode.localTrack;
    if (!track) {
      return <div className="flex-1 flex items-center justify-center text-xs font-bold font-sans">No Song Selected</div>;
    }

    return (
      <div className="flex-1 flex w-full h-full bg-neutral-50">
        <div className="w-1/2 p-6 flex flex-col items-center justify-center border-r border-gray-200">
          <div className="w-full aspect-square overflow-hidden rounded-sm bg-neutral-300 shadow-lg">
            {track.artworkUri ? (
              <CachedImage src={track.artworkUri} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-300 to-neutral-600 px-3 text-center text-sm font-black uppercase leading-tight text-white/90">
                {track.album || track.title}
              </div>
            )}
          </div>
        </div>
        <div className="w-1/2 flex flex-col justify-center px-6 font-sans overflow-hidden">
          <div className="text-[10px] font-black uppercase leading-none text-blue-600">Song</div>
          <div className="mt-2 text-lg font-black leading-tight text-gray-950 line-clamp-2">{track.title || 'Unknown Title'}</div>
          <div className="mt-2 text-sm font-bold leading-tight text-gray-700 line-clamp-2">{track.artist || 'Unknown Artist'}</div>
          <div className="mt-1 text-xs font-semibold leading-tight text-gray-500 line-clamp-2">{track.album || 'Unknown Album'}</div>
          <div className="mt-5 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
              <svg width="11" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                <path d="M0 0l10 6-10 6z" />
              </svg>
            </div>
            <div className="text-[11px] font-black uppercase leading-none text-gray-700">Select to Play</div>
          </div>
        </div>
      </div>
    );
  };

  const renderCoverArtwork = (album: MenuNode, isCenter: boolean) => {
    const title = album.title || 'Unknown Album';

    return (
      <>
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-300 via-neutral-400 to-neutral-600 text-center">
          <div className={`px-3 font-black uppercase leading-tight text-white/90 drop-shadow-sm ${isCenter ? 'text-sm' : 'text-[9px]'}`}>
            {title}
          </div>
        </div>
        {album.previewImage && (
          <CachedImage
            src={album.previewImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        )}
      </>
    );
  };

  const renderCoverFlow = () => {
    const albums = currentNode.children || [];
    const selectedAlbum = albums[cursorIndex];

    if (!albums.length || !selectedAlbum) {
      return (
        <div className="flex-1 bg-gradient-to-b from-neutral-100 to-neutral-200 flex flex-col items-center justify-center px-8 text-center">
          <div className="h-24 w-24 rounded-sm border border-neutral-300 bg-gradient-to-br from-neutral-200 to-neutral-400 shadow-inner" />
          <div className="mt-5 text-sm font-black leading-tight text-neutral-800">No Albums</div>
          <div className="mt-1 text-[11px] font-bold leading-tight text-neutral-500">Scan local music first.</div>
        </div>
      );
    }

    const renderPosition = coverFlowIsSelecting ? cursorIndex : coverFlowPosition;
    const displayIndex = Math.max(0, Math.min(albums.length - 1, Math.round(renderPosition)));
    const displayAlbum = coverFlowIsSelecting ? selectedAlbum : albums[displayIndex] || selectedAlbum;
    const visibleAlbums = albums
      .map((album, index) => ({ album, index, distance: index - renderPosition }))
      .filter(({ index, distance }) => Math.abs(distance) <= COVER_FLOW_VISIBLE_RANGE || (coverFlowIsSelecting && index === cursorIndex));
    const artist = displayAlbum.detailLines?.[0] || 'Unknown Artist';

    return (
      <div className="relative flex-1 overflow-hidden bg-[linear-gradient(180deg,#f6f6f4_0%,#d9dbdf_46%,#a9adb5_47%,#f3f4f3_100%)]">
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/65 to-transparent pointer-events-none" />
        <div className="absolute left-1/2 top-[128px] h-[2px] w-28 -translate-x-1/2 rounded-full bg-black/20 blur-[1px]" />
        <div
          className="absolute inset-x-0 top-2 h-[158px]"
          style={{ perspective: 900, transformStyle: 'preserve-3d' }}
        >
          {visibleAlbums.map(({ album, index, distance }) => {
            const isSelectedAlbum = index === cursorIndex;
            const absDistance = Math.abs(distance);
            const sign = Math.sign(distance);
            const clampedDistance = Math.max(-1, Math.min(1, distance));
            const beyondFirstSlot = Math.max(0, absDistance - 1);
            const trackOffset = absDistance <= 1
              ? distance * 82
              : sign * (82 + beyondFirstSlot * 48);
            const x = -60 + trackOffset;
            const y = Math.min(18, absDistance * 7);
            const rotateY = -64 * clampedDistance;
            const scale = Math.max(0.44, 1 - Math.min(absDistance, 1) * 0.24 - beyondFirstSlot * 0.095);
            const opacity = coverFlowIsSelecting && !isSelectedAlbum
              ? 0.12
              : Math.max(0.16, 1 - Math.min(absDistance, 1) * 0.22 - beyondFirstSlot * 0.18);
            const shadowOpacity = Math.max(0.16, 0.46 - absDistance * 0.08);
            const isHeroCard = coverFlowIsSelecting && isSelectedAlbum;

            return (
              <div
                key={album.id}
                className="absolute left-1/2 top-2 h-[120px] w-[120px] origin-center will-change-transform"
                style={{
                  opacity,
                  zIndex: 100 - Math.round(absDistance * 10),
                  transform: `translate3d(${x}px, ${y}px, ${80 - absDistance * 12}px) rotateY(${rotateY}deg) scale(${scale})`,
                  transformStyle: 'preserve-3d',
                  willChange: 'transform, opacity',
                }}
              >
                <motion.div
                  className="relative h-full w-full"
                  initial={false}
                  animate={isHeroCard && !shouldReduceMotion
                    ? {
                        rotateY: 0,
                        scale: 1.18,
                        y: -10,
                        filter: 'brightness(1.06) saturate(1.06)',
                      }
                    : {
                        rotateY: 0,
                        scale: 1,
                        y: 0,
                        filter: 'brightness(1) saturate(1)',
                      }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.46,
                    ease: [0.25, 1, 0.5, 1],
                  }}
                  style={{
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'center center',
                    willChange: 'transform',
                  }}
                >
                  <div
                    className={`absolute inset-0 h-full w-full overflow-hidden rounded-[2px] bg-neutral-300 ${absDistance < 0.08 ? 'shadow-[0_24px_32px_-14px_rgba(0,0,0,0.72)] ring-1 ring-white/90' : 'shadow-[0_16px_20px_-15px_rgba(0,0,0,0.78)]'}`}
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(0deg) translateZ(1px)',
                    }}
                  >
                    {renderCoverArtwork(album, absDistance < 0.08)}
                    <div className={`absolute inset-0 pointer-events-none ${absDistance < 0.08 ? 'bg-[linear-gradient(110deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.04)_34%,rgba(0,0,0,0.08)_100%)]' : 'bg-black/10'}`} />
                  </div>
                </motion.div>
                <motion.div
                  className="absolute left-0 top-[122px] h-10 w-full overflow-hidden [transform:scaleY(-1)]"
                  animate={{ opacity: shadowOpacity }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.16 }}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-[2px] bg-neutral-300">
                    {renderCoverArtwork(album, false)}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/65 to-white" />
                  </div>
                </motion.div>
                {absDistance < 0.08 && (
                  <div className="absolute -inset-1 rounded-[4px] border border-black/10 pointer-events-none" />
                )}
              </div>
            );
          })}
        </div>

        <motion.div
          key={displayAlbum.id}
          className="absolute inset-x-7 bottom-0 z-[160] px-3 py-2 text-center [text-shadow:0_1px_1px_rgba(255,255,255,0.75)]"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="truncate text-[15px] font-black leading-tight text-neutral-950">{displayAlbum.title}</div>
          <div className="mt-1 truncate text-[11px] font-bold leading-tight text-neutral-700">{artist}</div>
        </motion.div>
      </div>
    );
  };

  const renderMenu = () => {
    const children = currentNode.children || [];
    const scrollStart = Math.max(0, cursorIndex - 4);
    const rowHeight = 32;
    
    // Determine preview to show on the right
    const selectedChild = children[cursorIndex];
    const previewImg = selectedChild?.previewImage;
    
    return (
      <div className="flex-1 flex w-full relative">
        <div className="w-1/2 h-full flex flex-col border-r border-gray-300 bg-white">
          <div className="flex-grow flex flex-col pt-2 relative overflow-hidden">
             <motion.div
               className="absolute left-0 right-0 h-[32px] bg-gradient-to-b from-blue-400 to-blue-600 shadow-sm z-0"
               animate={{ y: (cursorIndex - scrollStart) * rowHeight }}
               transition={{ type: "spring", stiffness: 450, damping: 40 }}
             />
             {/* Scrolling window: each line is 32px height (px-4 py-1.5). */}
             <motion.div 
               className="w-full absolute z-10"
               animate={{ y: -scrollStart * rowHeight }}
               transition={{ type: "spring", stiffness: 450, damping: 40 }}
             >
               {children.map((child, idx) => {
                 const isSelected = idx === cursorIndex;
                 return (
                   <div 
                      key={child.id} 
	                      className="relative h-[32px] px-4 flex justify-between items-center bg-transparent"
	                   >
	                     <span className={`relative text-sm font-bold truncate z-10 transition-colors duration-150 ${isSelected ? 'text-white' : 'text-gray-800'}`}>
	                       {child.title}
	                     </span>
                     {child.isLoading && (
                       <motion.span
                         className={`relative h-3 w-3 shrink-0 rounded-full border-2 z-10 ${isSelected ? 'border-white/50 border-t-white' : 'border-gray-300 border-t-blue-500'}`}
                         animate={{ rotate: 360 }}
                         transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                       />
                     )}
                     {!child.isLoading && child.type === 'menu' && (
                       <span className={`relative text-[10px] font-bold pl-2 z-10 transition-colors duration-150 ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                         &gt;
                       </span>
                     )}
                   </div>
                 );
               })}
             </motion.div>
          </div>
        </div>
        
        {/* Right side preview */}
        {renderRightPreview(selectedChild)}
      </div>
    );
  };

  const renderClock = () => {
    // A simple static clock mockup
    return (
      <div className="flex-1 bg-neutral-100 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="w-32 h-32 rounded-full border-[8px] border-gray-400 bg-white relative flex items-center justify-center shadow-inner">
          <div className="absolute top-2 w-1 h-3 bg-gray-300"></div>
          <div className="absolute bottom-2 w-1 h-3 bg-gray-300"></div>
          <div className="absolute left-2 w-3 h-1 bg-gray-300"></div>
          <div className="absolute right-2 w-3 h-1 bg-gray-300"></div>
          
          {/* Hands */}
          <div className="w-1 h-12 bg-gray-800 absolute bottom-1/2 left-1/2 -mb-0.5 -ml-0.5 origin-bottom rotate-45 rounded-full"></div>
          <div className="w-1.5 h-8 bg-gray-800 absolute bottom-1/2 left-1/2 -mb-0.5 -ml-[3px] origin-bottom -rotate-[30deg] rounded-full"></div>
          <div className="w-0.5 h-14 bg-red-500 absolute bottom-1/2 left-1/2 -mb-0.5 -ml-[1px] origin-bottom rotate-[180deg]"></div>
          
          <div className="w-3 h-3 bg-gray-800 rounded-full z-10 absolute"></div>
        </div>
        <div className="mt-8 text-xl font-bold text-gray-800 font-sans tracking-tight">10:09 AM</div>
        <div className="text-xs font-semibold text-gray-500">{currentNode.title || 'Clock'}</div>
      </div>
    );
  };

  const renderGameBrick = () => {
    return (
      <div className="flex-1 bg-white flex flex-col pt-4">
        {/* Simple Brick breakout mockup */}
        <div className="flex justify-between px-2 mb-2">
          <div className="text-[10px] font-bold">SCORE: 004815</div>
          <div className="text-[10px] font-bold">LIVES: 3</div>
        </div>
        <div className="flex-1 border-t-2 border-gray-800 bg-gray-50 relative overflow-hidden mx-2 mb-2 shadow-inner">
          {/* Bricks */}
          <div className="w-full flex space-x-1 p-2">
             <div className="h-4 flex-1 bg-gray-800 border-b border-gray-400"></div>
             <div className="h-4 flex-1 bg-gray-800 border-b border-gray-400"></div>
             <div className="h-4 flex-1 bg-transparent"></div>
             <div className="h-4 flex-1 bg-gray-800 border-b border-gray-400"></div>
          </div>
          <div className="w-full flex space-x-1 px-2">
             <div className="h-4 flex-1 bg-gray-600 border-b border-gray-400"></div>
             <div className="h-4 flex-1 bg-gray-600 border-b border-gray-400"></div>
             <div className="h-4 flex-1 bg-gray-600 border-b border-gray-400"></div>
             <div className="h-4 flex-1 bg-gray-600 border-b border-gray-400"></div>
          </div>
          <div className="w-full flex space-x-1 px-2 pt-1">
             <div className="h-4 flex-1 bg-gray-400 border-b border-gray-300"></div>
             <div className="h-4 flex-1 bg-transparent border-b border-gray-300"></div>
             <div className="h-4 flex-1 bg-gray-400 border-b border-gray-300"></div>
             <div className="h-4 flex-1 bg-gray-400 border-b border-gray-300"></div>
          </div>
          
          {/* Ball */}
          <div className="w-3 h-3 bg-gray-900 rounded-full absolute top-[60%] left-[45%]"></div>
          
          {/* Paddle */}
          <div className="w-16 h-2 rounded-full bg-gray-900 absolute bottom-4 left-[40%]"></div>
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    return (
      <div className="flex-1 bg-white flex flex-col p-2">
        <div className="text-center font-bold text-sm bg-blue-500 text-white py-1 rounded-sm shadow-sm mb-2">October 2001</div>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-gray-400">{d}</div>
          ))}
          {[...Array(31)].map((_, i) => (
            <div key={i} className={`text-center text-xs font-bold py-1 ${i === 22 ? 'bg-blue-100 border border-blue-500 text-blue-800 shadow-sm rounded-sm z-10' : 'text-gray-800'}`}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStopwatch = () => {
    return (
       <div className="flex-1 bg-neutral-100 flex flex-col items-center justify-center p-6 text-center">
         <div className="text-4xl font-bold font-mono tracking-tighter text-gray-800">00:00.00</div>
         <div className="mt-8 flex space-x-4">
           <div className="text-xs font-bold border-2 border-gray-400 rounded px-3 py-1 bg-white shadow-sm">Start (Select)</div>
           <div className="text-xs font-bold text-gray-400 border-2 border-gray-300 rounded px-3 py-1">Clear (Menu)</div>
         </div>
       </div>
    );
  };

  const renderAbout = () => {
     return (
       <div className="flex-1 bg-white flex flex-col p-4">
          <div className="font-bold text-lg mb-4 text-center">iPod</div>
          <div className="space-y-2 align-middle">
            <div className="flex border-b border-gray-100 pb-1 justify-between text-xs font-bold"><span className="text-gray-500">Songs</span><span>10</span></div>
            <div className="flex border-b border-gray-100 pb-1 justify-between text-xs font-bold"><span className="text-gray-500">Capacity</span><span>4.8 GB</span></div>
            <div className="flex border-b border-gray-100 pb-1 justify-between text-xs font-bold"><span className="text-gray-500">Available</span><span>4.1 GB</span></div>
            <div className="flex border-b border-gray-100 pb-1 justify-between text-xs font-bold"><span className="text-gray-500">Version</span><span>1.0</span></div>
            <div className="flex justify-between text-xs font-bold"><span className="text-gray-500">S/N</span><span>JQ438B0B88</span></div>
          </div>
       </div>
     );
  };

  const renderPlaceholder = () => {
     return (
       <div className="flex-1 flex flex-col items-center justify-center bg-white p-6 text-center">
         <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
         </svg>
         <div className="text-gray-500 font-bold text-sm tracking-tight">Not Implemented</div>
         <div className="text-gray-400 text-xs mt-1 leading-tight">This feature is a mockup.</div>
       </div>
     );
  };

  const renderServiceStatus = () => {
    const toneClass = currentNode.statusTone === 'success'
      ? 'text-green-600'
      : currentNode.statusTone === 'error'
        ? 'text-red-600'
        : currentNode.statusTone === 'warning'
          ? 'text-amber-600'
          : 'text-gray-600';

    return (
      <div className="flex-1 bg-white flex flex-col p-5 overflow-hidden">
        <div className={`text-sm font-bold leading-tight ${toneClass}`}>{currentNode.title}</div>
        <div className="mt-3 space-y-2">
          {(currentNode.detailLines || ['No service details available.']).map((line, index) => (
            <div key={`${line}-${index}`} className="text-[11px] leading-tight font-semibold text-gray-700">
              {line}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPhotos = () => {
    return (
      <div className="flex-1 bg-black p-1 grid grid-cols-4 gap-1 content-start">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="aspect-square bg-gray-800 rounded-sm relative overflow-hidden">
             <img src={`https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&q=60&w=100`} className="absolute inset-0 object-cover w-full h-full opacity-60" />
          </div>
        ))}
      </div>
    );
  };

  const renderPodcasts = () => {
     return renderNowPlayingFull(); // use music player for podcast mockup
  };

  const renderScreenContent = () => {
    switch (currentNode.type) {
      case 'coverFlow': return renderCoverFlow();
      case 'nowPlaying': return renderNowPlayingFull();
      case 'songDetail': return renderSongDetail();
      case 'clock': return renderClock();
      case 'game_brick': return renderGameBrick();
      case 'calendar': return renderCalendar();
      case 'stopwatch': return renderStopwatch();
      case 'appleMusicStatus':
      case 'spotifyStatus':
      case 'localMusicStatus':
        return renderServiceStatus();
      case 'about': return renderAbout();
      case 'photos': return renderPhotos();
      case 'podcasts': return renderPodcasts();
      case 'videos': return renderPlaceholder();
      case 'settings': return renderPlaceholder();
      case 'placeholder': return renderPlaceholder();
      case 'menu':
      default: return renderMenu();
    }
  };

  return (
    <div className="w-full h-full bg-white border-[4px] border-neutral-900 rounded-[36px] shadow-inner flex flex-col overflow-hidden">
      {renderHeader()}
      <div className="w-full h-[calc(100%-24px)] min-h-0 overflow-hidden flex">
        {renderScreenContent()}
      </div>
    </div>
  );
}
