import React, { useRef } from 'react';

interface UseWheelProps {
  onRotate: (steps: number) => void;
  onClickZone?: (angle: number) => void;
  sensitivity?: number; // angular distance per tick (radians)
}

export function useWheel({ onRotate, onClickZone, sensitivity = Math.PI / 8 }: UseWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const accumulatedAngle = useRef(0);
  const lastStepAngle = useRef(0);
  const prevAngle = useRef<number | null>(null);

  // For tap detection
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const hasMoved = useRef(false);

  const getAngle = (x: number, y: number) => {
    if (!wheelRef.current) return null;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(y - cy, x - cx);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    hasMoved.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startTime.current = Date.now();

    prevAngle.current = getAngle(e.clientX, e.clientY);
    
    if (wheelRef.current) {
      wheelRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || prevAngle.current === null) return;

    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (dx * dx + dy * dy > 25) { 
      hasMoved.current = true;
    }

    const angle = getAngle(e.clientX, e.clientY);
    if (angle === null) return;

    let delta = angle - prevAngle.current;

    // Handle wrap around
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;

    accumulatedAngle.current += delta;
    prevAngle.current = angle;

    const angleDiff = accumulatedAngle.current - lastStepAngle.current;
    if (Math.abs(angleDiff) >= sensitivity) {
      const steps = Math.trunc(angleDiff / sensitivity);
      if (steps !== 0) {
        onRotate(steps);
        lastStepAngle.current += steps * sensitivity;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging.current && !hasMoved.current && Date.now() - startTime.current < 500) {
      const angle = getAngle(e.clientX, e.clientY);
      if (angle !== null && onClickZone) {
        onClickZone(angle);
      }
    }

    isDragging.current = false;
    prevAngle.current = null;
    if (wheelRef.current) {
      wheelRef.current.releasePointerCapture(e.pointerId);
    }
  };

  return {
    wheelRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
