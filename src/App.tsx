import React, { useEffect, useMemo, useRef, useState } from 'react';
import { generateMenuRoot } from './data';
import { MenuNode, PlaybackMode } from './types';
import { usePlayer } from './usePlayer';
import { useAppleMusic } from './useAppleMusic';
import { ClickWheel } from './components/ClickWheel';
import { Screen } from './components/Screen';

interface StackItem {
  node: MenuNode;
  cursorIndex: number;
}

const PLAYBACK_MODE_ORDER: PlaybackMode[] = ['sequential', 'shuffle', 'repeatAll', 'repeatOne'];
const COVER_FLOW_MAX_STEPS_PER_INPUT = 4;
const COVER_FLOW_SELECT_FLIP_MS = 1180;

const findNodeByPath = (root: MenuNode, path: string[]) => {
  let node = root;
  for (const id of path.slice(1)) {
    const next = node.children?.find(child => child.id === id);
    if (!next) return node;
    node = next;
  }
  return node;
};

export default function App() {
  const coverFlowSelectTimerRef = useRef<number | null>(null);
  const coverFlowSelectingRef = useRef(false);
  const [coverFlowIsSelecting, setCoverFlowIsSelecting] = useState(false);
  const appleMusic = useAppleMusic();
  const {
    isPlaying,
    currentSong,
    progress,
    playbackMode,
    playPause,
    nextTrack,
    prevTrack,
    playSongById,
    playAppleMusicQueue,
    setPlaybackMode,
  } = usePlayer({
    getAppleMusicTokens: appleMusic.getPlaybackTokens,
    onPlaybackError: message => console.error('Apple Music playback failed', message),
  });
  const rootMenu = useMemo(() => generateMenuRoot({
    status: appleMusic.status,
    message: appleMusic.message,
    hasUserToken: appleMusic.hasUserToken,
    defaultSearchTerm: appleMusic.defaultSearchTerm,
    catalogResults: appleMusic.catalogResults,
    libraryResults: appleMusic.libraryResults,
    allMusic: appleMusic.allMusic,
    playlists: appleMusic.playlists,
    playlistTracks: appleMusic.playlistTracks,
    lastSyncedAt: appleMusic.lastSyncedAt,
    usingCachedLibrary: appleMusic.usingCachedLibrary,
    isSyncing: appleMusic.status === 'working',
  }), [
    appleMusic.status,
    appleMusic.message,
    appleMusic.hasUserToken,
    appleMusic.defaultSearchTerm,
    appleMusic.catalogResults,
    appleMusic.libraryResults,
    appleMusic.allMusic,
    appleMusic.playlists,
    appleMusic.playlistTracks,
    appleMusic.lastSyncedAt,
    appleMusic.usingCachedLibrary,
  ]);

  const [stack, setStack] = useState<StackItem[]>([{ node: rootMenu, cursorIndex: 0 }]);
  const currentItem = stack[stack.length - 1];
  const currentNode = currentItem.node;
  const cursorIndex = currentItem.cursorIndex;

  useEffect(() => {
    setStack(prev => {
      const path = prev.map(item => item.node.id);
      return prev.map((item, index) => ({
        node: findNodeByPath(rootMenu, path.slice(0, index + 1)),
        cursorIndex: item.cursorIndex,
      }));
    });
  }, [rootMenu]);

  useEffect(() => {
    if (currentNode.type === 'coverFlow') return;

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

  const handleRotate = (steps: number) => {
    const canRotate = currentNode.type === 'menu' || currentNode.type === 'coverFlow';
    if (!canRotate || !currentNode.children || steps === 0) return;

    if (currentNode.type === 'coverFlow') {
      if (coverFlowSelectingRef.current) return;

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
      case 'apple_music_sign_in':
        await appleMusic.startSignIn();
        break;
      case 'apple_music_search_catalog':
        await appleMusic.searchCatalog();
        break;
      case 'apple_music_load_library':
        await appleMusic.loadLibrarySongs();
        break;
      case 'apple_music_favorite_current':
        if (currentSong?.appleMusicSong) {
          await appleMusic.addSongToFavorites(currentSong.appleMusicSong);
        }
        break;
      case 'player_shuffle_all':
        await setPlaybackMode('shuffle');
        await playAppleMusicQueue(appleMusic.allMusic, randomStartIndex(appleMusic.allMusic.length), 'songs', 'off');
        setStack(prev => [
          ...prev,
          { node: { id: 'now_playing', title: 'Now Playing', type: 'nowPlaying' }, cursorIndex: 0 }
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

    if (currentNode.type === 'coverFlow') {
      const selectedAlbum = currentNode.children?.[cursorIndex];
      if (!selectedAlbum || coverFlowSelectingRef.current) return;

      coverFlowSelectingRef.current = true;
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
      }, COVER_FLOW_SELECT_FLIP_MS);
      return;
    }

    if (currentNode.type !== 'menu' || !currentNode.children) return;
    
    const selectedChild = currentNode.children[cursorIndex];
    if (selectedChild.action) {
       runAction(selectedChild);
       return;
    }

    if (selectedChild.appleMusicSong) {
       const appleMusicSongs = currentNode.children
         .map(child => child.appleMusicSong)
         .filter((song): song is NonNullable<typeof song> => Boolean(song));
       const selectedIndex = Math.max(0, appleMusicSongs.findIndex(song => song.id === selectedChild.appleMusicSong?.id));
       playAppleMusicQueue(appleMusicSongs, selectedIndex).catch(error => {
         console.error('Apple Music playback failed', error);
       });
       setStack(prev => [
         ...prev,
         { node: { id: 'now_playing', title: 'Now Playing', type: 'nowPlaying' }, cursorIndex: 0 }
       ]);
    } else if (selectedChild.id.startsWith('song_')) {
       // Play the song
       const songId = selectedChild.id.split('_')[1];
       playSongById(songId);
       
       // Force a navigate to 'nowPlaying' screen
       setStack(prev => [
         ...prev,
         { node: { id: 'now_playing', title: 'Now Playing', type: 'nowPlaying' }, cursorIndex: 0 }
       ]);
    } else if (selectedChild.type === 'nowPlaying') {
       // Just go to now playing view without changing song
       setStack(prev => [
         ...prev,
         { node: { id: 'now_playing', title: 'Now Playing', type: 'nowPlaying' }, cursorIndex: 0 }
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
      setCoverFlowIsSelecting(false);
    }

    // Pop stack if we are not at root
    setStack(prev => {
      if (prev.length > 1) {
        const newStack = [...prev];
        newStack.pop();
        return newStack;
      }
      return prev;
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
