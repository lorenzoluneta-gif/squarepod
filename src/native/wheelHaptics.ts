import { registerPlugin } from '@capacitor/core';

export interface WheelHapticsPlugin {
  tick(options?: { count?: number; durationMs?: number; gapMs?: number; amplitude?: number }): Promise<void>;
}

export const WheelHaptics = registerPlugin<WheelHapticsPlugin>('WheelHaptics', {
  web: () => ({
    async tick(options?: { count?: number; durationMs?: number; gapMs?: number }) {
      const count = Math.min(Math.max(1, Math.abs(options?.count ?? 1)), 4);
      if (!navigator.vibrate) return;
      const durationMs = Math.max(1, Math.min(40, options?.durationMs ?? 14));
      const gapMs = Math.max(0, Math.min(40, options?.gapMs ?? 12));
      const pattern = Array.from({ length: count * 2 - 1 }, (_, index) => index % 2 === 0 ? durationMs : gapMs);
      navigator.vibrate(pattern);
    },
  }),
});
