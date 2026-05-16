import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateMenuRoot } from './data';
import { MenuNode, PlaybackMode } from './types';
import { useLocalMusic } from './useLocalMusic';
import { LocalMusicTrack } from './native/localMusic';
import { ClickWheel } from './components/ClickWheel';
import { Screen } from './components/Screen';
import type { RotateEndMeta } from './useWheel';

interface StackItem {
  node: MenuNode;
  cursorIndex: number;
}

const PLAYBACK_MODE_ORDER: PlaybackMode[] = ['sequential', 'shuffle', 'repeatAll', 'repeatOne'];
const COVER_FLOW_MAX_STEPS_PER_INPUT = 4;
const COVER_FLOW_SELECT_HERO_MS = 560;

const findNodeByPath = (root: MenuNode, path: string[]) => {
  let node = root;
  for (const id of path.slice(1)) {
    const next = node.children?.find(child => child.id === id);
    if (!next) return undefined;
    node = next;
  }
  return node;
};

const nowPlayingNode: MenuNode = { id: 'now_playing', title: 'Now Playing', type: 'nowPlaying' };

const isDetachedNavigationNode = (node: MenuNode) => (
  node.id === nowPlayingNode.id ||
  node.id === 'now_playing_queue' ||
  node.id.startsWith('queue_track_')
);

const localTrackNode = (track: LocalMusicTrack, queue: LocalMusicTrack[], index: number): MenuNode => ({
  id: `queue_track_${track.id || index}`,
  title: track.title || 'Unknown Title',
  type: 'songDetail',
  previewImage: track.artworkUri,
  localTrack: track,
  localQueue: queue,
  localQueueIndex: index,
  detailLines: [
    track.artist || 'Unknown Artist',
    track.album || 'Unknown Album',
  ],
});

const localQueueFromMenu = (node: MenuNode) => (
  node.children
    ?.map(child => child.localTrack)
    .filter((track): track is LocalMusicTrack => Boolean(track)) || []
);

export default function App() {
  const coverFlowSelectTimerRef = useRef<number | null>(null);
  const coverFlowSelectingRef = useRef(false);
  const [coverFlowIsSelecting, setCoverFlowIsSelecting] = useState(false);
  const [coverFlowIsDragging, setCoverFlowIsDragging] = useState(false);
  const [coverFlowRelease, setCoverFlowRelease] = useState({ id: 0, velocity: 0 });
  const [playbackQueue, setPlaybackQueue] = useState<LocalMusicTrack[]>([]);
  const localMusic = useLocalMusic();
  const {
    isPlaying,
    currentSong,
    progress,
    playbackMode,
    playPause,
    nextTrack,
    prevTrack,
    setPlaybackMode,
    playQueue,
  } = localMusic;
  const currentTrackMenuKey = [
    localMusic.currentTrack?.id,
    localMusic.currentTrack?.title,
    localMusic.currentTrack?.artist,
    localMusic.currentTrack?.album,
  ].join('|');
  const rootMenu = useMemo(() => generateMenuRoot({
    status: localMusic.status,
    message: localMusic.message,
    tracks: localMusic.tracks,
    musicDirectory: localMusic.musicDirectory,
    currentTrack: localMusic.currentTrack,
    isScanning: localMusic.status === 'working',
  }), [
    localMusic.status,
    localMusic.message,
    localMusic.tracks,
    localMusic.musicDirectory,
    currentTrackMenuKey,
  ]);

  const [stack, setStack] = useState<StackItem[]>([{ node: rootMenu, cursorIndex: 0 }]);
  const currentItem = stack[stack.length - 1];
  const currentNode = currentItem.node;
  const cursorIndex = currentItem.cursorIndex;

  useEffect(() => {
    setStack(prev => {
      const path = prev.map(item => item.node.id);
      const nextStack: StackItem[] = [];

      for (let index = 0; index < prev.length; index += 1) {
        const node = findNodeByPath(rootMenu, path.slice(0, index + 1));
        if (!node) {
          if (isDetachedNavigationNode(prev[index].node)) {
            return [
              ...nextStack,
              ...prev.slice(index),
            ];
          }
          break;
        }

        const maxCursorIndex = Math.max(0, (node.children?.length || 1) - 1);
        nextStack.push({
          node,
          cursorIndex: Math.min(prev[index].cursorIndex, maxCursorIndex),
        });
      }

      return nextStack.length ? nextStack : [{ node: rootMenu, cursorIndex: 0 }];
    });
  }, [rootMenu]);

  useEffect(() => {
    if (currentNode.type === 'coverFlow') return;

    setCoverFlowIsDragging(false);
    if (coverFlowSelectTimerRef.current !== null) {
      window.clearTimeout(coverFlowSelectTimerRef.current);
      coverFlowSelectTimerRef.current = null;
      coverFlowSelectingRef.current = false;
      setCoverFlowIsSelecting(false);
    }
  }, [currentNode.type]);

  useEffect(() => {
    return () => {
      if (coverFlowSelectTimerRef.current !== null) {
        window.clearTimeout(coverFlowSelectTimerRef.current);
      }
    };
  }, []);

  const rotateStackTop = (steps: number, expectedType?: MenuNode['type']) => {
    setStack(prev => {
      const newStack = [...prev];
      const top = { ...newStack[newStack.length - 1] };
      const children = top.node.children;

      if (expectedType && top.node.type !== expectedType) return prev;
      if (!children?.length) return prev;

      const maxIdx = children.length - 1;
      const nextIdx = Math.max(0, Math.min(maxIdx, top.cursorIndex + steps));
      if (nextIdx === top.cursorIndex) return prev;

      top.cursorIndex = nextIdx;
      newStack[newStack.length - 1] = top;
      return newStack;
    });
  };

  const setCoverFlowCursorIndex = useCallback((index: number) => {
    setStack(prev => {
      const newStack = [...prev];
      const top = { ...newStack[newStack.length - 1] };
      const children = top.node.children;

      if (top.node.type !== 'coverFlow' || !children?.length) return prev;

      const maxIdx = children.length - 1;
      const nextIdx = Math.max(0, Math.min(maxIdx, index));
      if (nextIdx === top.cursorIndex) return prev;

      top.cursorIndex = nextIdx;
      newStack[newStack.length - 1] = top;
      return newStack;
    });
  }, []);

  const handleRotateStart = () => {
    if (currentNode.type !== 'coverFlow' || coverFlowSelectingRef.current) return;
    setCoverFlowIsDragging(true);
  };

  const handleRotateEnd = ({ velocity }: RotateEndMeta) => {
    if (currentNode.type !== 'coverFlow') return;
    setCoverFlowIsDragging(false);
    setCoverFlowRelease(prev => ({
      id: prev.id + 1,
      velocity,
    }));
  };

  const handleRotate = (steps: number) => {
    const activePlaybackQueue = playbackQueue.length ? playbackQueue : localMusic.tracks;
    if (currentNode.type === 'nowPlaying' && steps !== 0 && activePlaybackQueue.length) {
      const currentQueueIndex = Math.max(
        0,
        activePlaybackQueue.findIndex(track => track.id === localMusic.currentTrack?.id),
      );
      const queueNode: MenuNode = {
        id: 'now_playing_queue',
        title: 'Up Next',
        type: 'menu',
        children: activePlaybackQueue.map((track, index) => localTrackNode(track, activePlaybackQueue, index)),
      };
      const maxIdx = activePlaybackQueue.length - 1;
      const nextIndex = Math.max(0, Math.min(maxIdx, currentQueueIndex + steps));
      setStack(prev => [...prev, { node: queueNode, cursorIndex: nextIndex }]);
      return;
    }

    const canRotate = currentNode.type === 'menu' || currentNode.type === 'coverFlow';
    if (!canRotate || !currentNode.children || steps === 0) return;

    if (currentNode.type === 'coverFlow') {
      if (coverFlowSelectingRef.current) return;
      setCoverFlowIsDragging(true);

      const boundedSteps = Math.max(
        -COVER_FLOW_MAX_STEPS_PER_INPUT,
        Math.min(COVER_FLOW_MAX_STEPS_PER_INPUT, steps),
      );
      rotateStackTop(boundedSteps, 'coverFlow');
      return;
    }

    rotateStackTop(steps, 'menu');
  };

  const runAction = async (node: MenuNode) => {
    switch (node.action) {
      case 'local_music_scan':
        await localMusic.scanLibrary();
        break;
      case 'player_shuffle_all':
        await setPlaybackMode('shuffle');
        setPlaybackQueue(localMusic.tracks);
        await playQueue(localMusic.tracks, randomStartIndex(localMusic.tracks.length), { shuffle: true });
        setStack(prev => [
          ...prev,
          { node: nowPlayingNode, cursorIndex: 0 }
        ]);
        break;
      default:
        break;
    }
  };

  const handleSelect = () => {
    if (currentNode.type === 'nowPlaying') {
      const currentIndex = Math.max(0, PLAYBACK_MODE_ORDER.indexOf(playbackMode));
      const nextMode = PLAYBACK_MODE_ORDER[(currentIndex + 1) % PLAYBACK_MODE_ORDER.length];
      setPlaybackMode(nextMode).catch(error => {
        console.error('Playback mode update failed', error);
      });
      return;
    }

    if (currentNode.type === 'songDetail' && currentNode.localTrack) {
      const queue = currentNode.localQueue?.length ? currentNode.localQueue : [currentNode.localTrack];
      const selectedIndex = Math.max(0, currentNode.localQueueIndex ?? queue.findIndex(track => track.id === currentNode.localTrack?.id));
      setPlaybackQueue(queue);
      playQueue(queue, selectedIndex)
        .then(() => {
          setStack(prev => [...prev, { node: nowPlayingNode, cursorIndex: 0 }]);
        })
        .catch(error => {
          console.error('Local playback failed', error);
        });
      return;
    }

    if (currentNode.type === 'coverFlow') {
      const selectedAlbum = currentNode.children?.[cursorIndex];
      if (!selectedAlbum || coverFlowSelectingRef.current) return;

      coverFlowSelectingRef.current = true;
      setCoverFlowIsDragging(false);
      setCoverFlowIsSelecting(true);

      coverFlowSelectTimerRef.current = window.setTimeout(() => {
        coverFlowSelectTimerRef.current = null;
        coverFlowSelectingRef.current = false;
        setCoverFlowIsSelecting(false);
        setStack(prev => {
          const top = prev[prev.length - 1];
          if (top.node.type !== 'coverFlow') return prev;
          return [...prev, { node: selectedAlbum, cursorIndex: 0 }];
        });
      }, COVER_FLOW_SELECT_HERO_MS);
      return;
    }

    if (currentNode.type !== 'menu' || !currentNode.children) return;
    
    const selectedChild = currentNode.children[cursorIndex];
    if (selectedChild.action) {
       runAction(selectedChild).catch(error => {
         console.error('Local music action failed', error);
       });
       return;
    }

    if (selectedChild.localTrack) {
       const localTracks = localQueueFromMenu(currentNode);
       const queue = localTracks.length ? localTracks : [selectedChild.localTrack];
       const selectedIndex = Math.max(0, queue.findIndex(track => track.id === selectedChild.localTrack?.id));
       setPlaybackQueue(queue);
       playQueue(queue, selectedIndex)
         .then(() => {
           setStack(prev => [...prev, { node: nowPlayingNode, cursorIndex: 0 }]);
         })
         .catch(error => {
           console.error('Local playback failed', error);
         });
    } else if (selectedChild.id.startsWith('song_')) {
       setStack(prev => [
         ...prev,
         { node: nowPlayingNode, cursorIndex: 0 }
       ]);
    } else if (selectedChild.type === 'nowPlaying') {
       // Just go to now playing view without changing song
       setStack(prev => [
         ...prev,
         { node: nowPlayingNode, cursorIndex: 0 }
       ]);
    } else {
       // Push submenu or other screens (clock, games, placeholders, etc.)
       setStack(prev => [...prev, { node: selectedChild, cursorIndex: 0 }]);
    }
  };

  const handleMenu = () => {
    if (coverFlowSelectTimerRef.current !== null) {
      window.clearTimeout(coverFlowSelectTimerRef.current);
      coverFlowSelectTimerRef.current = null;
      coverFlowSelectingRef.current = false;
      setCoverFlowIsDragging(false);
      setCoverFlowIsSelecting(false);
    }

    setStack(prev => {
      if (prev.length <= 1) return prev;

      const poppedNodeId = prev[prev.length - 1].node.id;
      const nextStack = prev.slice(0, -1);

      while (
        nextStack.length > 1 &&
        nextStack[nextStack.length - 1].node.id === poppedNodeId
      ) {
        nextStack.pop();
      }

      return nextStack;
    });
  };

  const handlePlayPause = () => {
    playPause();
  };

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center p-0 font-sans overflow-hidden">
      <div className="relative w-[min(100vw,100vh)] h-[min(100vw,100vh)] bg-gradient-to-br from-gray-50 to-gray-200 rounded-[56px] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] border-8 border-white px-5 pt-5 pb-6 flex flex-col items-center">
        
        {/* Top Section: Screen */}
        <div className="w-full h-[56%] shrink-0 pb-1">
          <Screen 
            currentNode={currentNode} 
            cursorIndex={cursorIndex} 
            isPlaying={isPlaying} 
            currentSong={currentSong} 
            progress={progress} 
            playbackMode={playbackMode}
            coverFlowIsSelecting={coverFlowIsSelecting}
            coverFlowIsDragging={coverFlowIsDragging}
            coverFlowReleaseId={coverFlowRelease.id}
            coverFlowReleaseVelocity={coverFlowRelease.velocity}
            onCoverFlowSettleTarget={setCoverFlowCursorIndex}
          />
        </div>

        {/* Bottom Section: Click Wheel */}
        <div className="w-full flex-1 flex items-end justify-center relative min-h-0 pb-1">
          <ClickWheel 
            onRotate={handleRotate}
            onSelect={handleSelect}
            onMenu={handleMenu}
            onPlayPause={handlePlayPause}
            onNext={nextTrack}
            onPrev={prevTrack}
            onRotateStart={handleRotateStart}
            onRotateEnd={handleRotateEnd}
          />
        </div>

      </div>
    </div>
  );
}

const randomStartIndex = (length: number) => {
  if (length <= 1) return 0;
  return Math.floor(Math.random() * length);
};
