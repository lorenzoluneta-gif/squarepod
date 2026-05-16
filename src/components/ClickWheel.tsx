import React from 'react';
import { RotateEndMeta, useWheel } from '../useWheel';
import { playOuterButtonClick, playSelectClick, playWheelTick, unlockUiAudio } from '../audio/uiSounds';

const CLICK_WHEEL_SENSITIVITY = Math.PI / 6;
const OUTER_BUTTON_SOUND_DELAY_MS = 70;

interface ClickWheelProps {
  onRotate: (steps: number) => void;
  onSelect: () => void;
  onMenu: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onRotateStart?: () => void;
  onRotateEnd?: (meta: RotateEndMeta) => void;
}

export function ClickWheel({
  onRotate,
  onSelect,
  onMenu,
  onPlayPause,
  onNext,
  onPrev,
  onRotateStart,
  onRotateEnd,
}: ClickWheelProps) {
  const pendingOuterButtonSoundRef = React.useRef<number | null>(null);

  const clearPendingOuterButtonSound = () => {
    if (pendingOuterButtonSoundRef.current === null) return;
    window.clearTimeout(pendingOuterButtonSoundRef.current);
    pendingOuterButtonSoundRef.current = null;
  };

  const scheduleOuterButtonSound = () => {
    clearPendingOuterButtonSound();
    pendingOuterButtonSoundRef.current = window.setTimeout(() => {
      pendingOuterButtonSoundRef.current = null;
      playOuterButtonClick();
    }, OUTER_BUTTON_SOUND_DELAY_MS);
  };

  const handleZoneClick = (angle: number) => {
    if (angle >= -Math.PI * 0.75 && angle <= -Math.PI * 0.25) {
      onMenu();
    } else if (angle >= Math.PI * 0.25 && angle <= Math.PI * 0.75) {
      onPlayPause();
    } else if (angle > -Math.PI * 0.25 && angle < Math.PI * 0.25) {
      onNext();
    } else {
      onPrev();
    }
  };

  const handleWheelRotate = (steps: number) => {
    clearPendingOuterButtonSound();
    playWheelTick(steps);
    onRotate(steps);
  };

  const handleWheelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    unlockUiAudio();
    scheduleOuterButtonSound();
    handlePointerDown(event);
  };

  const handleWheelPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    handlePointerMove(event);
  };

  const handleWheelPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    handlePointerUp(event);
  };

  const handleWheelPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    clearPendingOuterButtonSound();
    handlePointerUp(event);
  };

  const handleSelectPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    clearPendingOuterButtonSound();
    event.stopPropagation();
    unlockUiAudio();
    playSelectClick();
  };

  const handleRotateStartWithSoundCancel = () => {
    clearPendingOuterButtonSound();
    onRotateStart?.();
  };

  const { wheelRef, handlePointerDown, handlePointerMove, handlePointerUp } = useWheel({ 
    onRotate: handleWheelRotate,
    onClickZone: handleZoneClick,
    onRotateStart: handleRotateStartWithSoundCancel,
    onRotateEnd,
    sensitivity: CLICK_WHEEL_SENSITIVITY,
  });

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none" style={{ touchAction: 'none' }}>
      <div 
        ref={wheelRef}
        onPointerDown={handleWheelPointerDown}
        onPointerMove={handleWheelPointerMove}
        onPointerUp={handleWheelPointerUp}
        onPointerCancel={handleWheelPointerCancel}
        className="h-[calc(100%+7px)] max-h-[343px] aspect-square rounded-full bg-white shadow-[0_10px_20px_rgba(0,0,0,0.1),inset_0_1px_4px_rgba(0,0,0,0.1)] border border-gray-100 flex items-center justify-center relative touch-none pointer-events-auto cursor-pointer"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[30%] flex justify-center items-start pt-[15%] text-[#9CA3AF] font-bold text-sm tracking-[0.15em] uppercase pointer-events-none">
          MENU
        </div>

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[30%] flex justify-center items-end pb-[15%] pointer-events-none">
          <svg width="22" height="11" viewBox="0 0 22 11" fill="currentColor" className="text-[#9CA3AF]">
             {/* Play */}
             <path d="M0 0l9 5.5L0 11z" />
             {/* Pause */}
             <path d="M14 0h2.5v11H14zM19.5 0H22v11h-2.5z" />
          </svg>
        </div>

        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[30%] h-1/2 flex justify-start pl-[15%] pointer-events-none items-center">
          <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" className="text-[#9CA3AF]">
             <path d="M0 0h2.5v11H0zM15 0L6 5.5 15 11z" />
          </svg>
        </div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[30%] h-1/2 flex justify-end pr-[15%] pointer-events-none items-center">
          <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" className="text-[#9CA3AF]">
             <path d="M0 0l9 5.5L0 11zM12.5 0H15v11h-2.5z" />
          </svg>
        </div>

        {/* Center Select visual stays large; the transparent hit target is smaller to avoid stealing outer-button taps. */}
        <div className="absolute left-1/2 top-1/2 z-10 h-[35%] w-[35%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gray-400 bg-gradient-to-b from-gray-100 to-gray-300 shadow-[0_2px_4px_rgba(0,0,0,0.15)] pointer-events-none" />
        <button 
          aria-label="Select"
          className="absolute left-1/2 top-1/2 z-20 h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent cursor-pointer pointer-events-auto"
          onPointerDown={handleSelectPointerDown}
          onClick={onSelect}
        />
      </div>
    </div>
  );
}
