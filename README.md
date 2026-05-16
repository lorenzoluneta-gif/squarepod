# squarepod

## Run Locally

1. Install dependencies:
   `npm install`
2. Run the web app:
   `npm run dev`

## Spotify Remote on Android

SquarePod controls the local Spotify app through Spotify App Remote. Spotify remains the playback engine and owns offline downloads/caching. SquarePod does not cache Spotify audio.

1. Create an app in the Spotify Developer Dashboard.
2. Add the Android package name:
   `com.squarepod.app`
3. Add the debug signing fingerprint. For the default debug keystore:
   `keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android`
4. Add a redirect URI, for example:
   `squarepod://spotify-callback`
5. Create `.env.local` with:
   `VITE_SPOTIFY_CLIENT_ID="your_client_id"`
   `VITE_SPOTIFY_REDIRECT_URI="squarepod://spotify-callback"`
6. Optional: configure Spotify URI shortcuts:
   `VITE_SPOTIFY_DEFAULT_URI="spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"`
   `VITE_SPOTIFY_URIS="Downloaded Playlist|spotify:playlist:your_playlist_id|Downloaded in Spotify,Album|spotify:album:your_album_id"`
7. Spotify playlist metadata sync uses Spotify Web API OAuth with PKCE. The same redirect URI is used for the OAuth callback.
8. Install Spotify from Google Play and log in. Premium is required for on-demand music streaming and offline downloads.
9. Build and install:
   `npm run android:build`
   `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`

Offline behavior is bounded by Spotify: playback of downloaded content is handled by the Spotify app, and App Remote cannot start a new connection to Spotify without network access. For best results, connect SquarePod to Spotify while online, start the downloaded playlist, then go offline and continue controlling playback.

## Spotify Playlist Sync

SquarePod caches Spotify playlist metadata in IndexedDB:

- playlists: id, URI, name, image, owner, snapshot, track count
- tracks: URI, title, artist, album, duration, artwork, playlist position

It does not cache audio. The Music menu exposes:

- Cover Flow: synced Spotify playlists, one cover per playlist
- All Songs: de-duplicated tracks from synced playlists
- Sync: starts Spotify OAuth if needed, then refreshes playlists and tracks

Clicking a playlist or track still delegates playback to the local Spotify app through App Remote. If Spotify reports `canPlayOnDemand: false`, exact single-track playback can be restricted by Spotify; playlist playback is the safer path.
