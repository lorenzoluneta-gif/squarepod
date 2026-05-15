import React, { useEffect, useRef } from 'react';

interface UseWheelProps {
  onRotate: (steps: number) => void;
  onClickZone?: (angle: number) => void;
  onRotateStart?: () => void;
  onRotateEnd?: (meta: RotateEndMeta) => void;
  sensitivity?: number; // angular distance per tick (radians)
}

export interface RotateEndMeta {
  velocity: number;
}

const ROTATE_IDLE_RELEASE_MS = 120;

export function useWheel({
  onRotate,
  onClickZone,
  onRotateStart,
  onRotateEnd,
  sensitivity = Math.PI / 8,
}: UseWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isRotating = useRef(false);

  const accumulatedAngle = useRef(0);
  const lastStepAngle = useRef(0);
  const prevAngle = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);
  const lastMoveTime = useRef(0);
  const recentVelocity = useRef(0);

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

  const clearIdleTimer = () => {
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  };

  const emitRotateEnd = () => {
    if (!isRotating.current) return;

    isRotating.current = false;
    onRotateEnd?.({ velocity: recentVelocity.current });
  };

  const scheduleIdleRelease = () => {
    clearIdleTimer();
    idleTimer.current = window.setTimeout(() => {
      idleTimer.current = null;
      if (!isRotating.current) return;
      recentVelocity.current = 0;
      isRotating.current = false;
      onRotateEnd?.({ velocity: 0 });
    }, ROTATE_IDLE_RELEASE_MS);
  };

  useEffect(() => {
    return clearIdleTimer;
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    isRotating.current = false;
    clearIdleTimer();
    hasMoved.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startTime.current = Date.now();
    lastMoveTime.current = performance.now();
    recentVelocity.current = 0;

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

    const now = performance.now();
    const dt = Math.max(0.016, (now - lastMoveTime.current) / 1000);
    const instantaneousVelocity = (delta / sensitivity) / dt;
    recentVelocity.current = recentVelocity.current * 0.35 + instantaneousVelocity * 0.65;
    lastMoveTime.current = now;

    if (hasMoved.current && !isRotating.current) {
      isRotating.current = true;
      onRotateStart?.();
    }

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

    if (hasMoved.current) {
      scheduleIdleRelease();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    clearIdleTimer();

    if (isDragging.current && !hasMoved.current && Date.now() - startTime.current < 500) {
      const angle = getAngle(e.clientX, e.clientY);
      if (angle !== null && onClickZone) {
        onClickZone(angle);
      }
    }

    emitRotateEnd();
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
