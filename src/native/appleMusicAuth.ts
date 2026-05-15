import { registerPlugin } from '@capacitor/core';

export interface AppleMusicSignInOptions {
  developerToken: string;
  startScreenMessage?: string;
}

export interface AppleMusicSignInResult {
  userToken: string;
}

export interface AppleMusicAuthStatus {
  musicKitAvailable: boolean;
  appleMusicInstalled: boolean;
  appleMusicPackage: string;
}

export interface AppleMusicAuthPlugin {
  getStatus(): Promise<AppleMusicAuthStatus>;
  signIn(options: AppleMusicSignInOptions): Promise<AppleMusicSignInResult>;
}

export const AppleMusicAuth = registerPlugin<AppleMusicAuthPlugin>('AppleMusicAuth');
