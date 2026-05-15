/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPLE_MUSIC_DEVELOPER_TOKEN?: string;
  readonly VITE_APPLE_MUSIC_TOKEN_ENDPOINT?: string;
  readonly VITE_APPLE_MUSIC_USER_TOKEN?: string;
  readonly VITE_APPLE_MUSIC_STOREFRONT?: string;
  readonly VITE_APPLE_MUSIC_DEFAULT_SEARCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
