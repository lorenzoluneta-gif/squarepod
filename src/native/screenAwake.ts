import { registerPlugin } from '@capacitor/core';

export interface ScreenAwakePlugin {
  setKeepAwake(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
}

export const ScreenAwake = registerPlugin<ScreenAwakePlugin>('ScreenAwake', {
  web: () => ({
    async setKeepAwake(options) {
      return options;
    },
  }),
});
