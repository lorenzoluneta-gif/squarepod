# SquarePod

SquarePod is an Android-first local music player with an iPod-style interface. The current product direction is local audio playback: the app scans music files already on the Android device, builds a local library, and plays those files through the native Android `MediaPlayer`.

It does not depend on Apple Music or Spotify for the primary playback path.

## Current State

What works now:

- Local Android music scanning.
- Local audio playback.
- Offline playback for copied local files.
- Cover Flow grouped by local albums.
- All Songs, Artists, and Albums browsing.
- Now Playing screen with album artwork, progress, shuffle, repeat, and battery display.
- Song detail screen before playback.
- Click-wheel navigation with generated wheel/select/button sounds.
- Playback queue persistence across app restarts.
- Last track and position persistence across app restarts.
- Album continuation mode:
  - `Continue: Library`: after an album/artist context ends, continue through the wider local library.
  - `Continue: Album`: stop within the selected album/artist context.

What is not the current path:

- Apple Music is not a viable offline source for this app. Apple controls DRM playback and offline downloads inside its own app.
- Spotify is not a viable way for SquarePod to guarantee offline playback. Spotify owns downloaded audio and App Remote/Web API cannot make SquarePod cache or directly play it.
- SquarePod does not cache DRM audio from Apple Music, Spotify, or any other streaming provider.
- The remaining Apple Music and Spotify files in the repo are historical/experimental integration code, not the current production path.

## Platform

Current target:

- Android through Capacitor.
- Package name: `com.squarepod.app`.

Not implemented:

- iOS native local music support.
- Desktop packaged app.
- Web-only local playback parity.

The Vite web app can run in a browser for interface development, but the real music scanning and playback implementation is Android-native.

## Music Library Sources

The Android native plugin scans these locations:

- Android MediaStore audio library.
- App-specific music folder:
  `/sdcard/Android/data/com.squarepod.app/files/Music`
- Public SquarePod folder:
  `/sdcard/Music/SquarePod`

Supported file extensions in the scanner:

- `.mp3`
- `.m4a`
- `.aac`
- `.flac`
- `.wav`
- `.ogg`
- `.opus`

Actual playback support still depends on Android's media stack on the target device.

## Cover Art

SquarePod currently loads cover art from:

- Embedded artwork inside the audio file.
- Android MediaStore album art, when available.

It does not currently scan sidecar image files such as `cover.jpg`, `folder.jpg`, or `album.png`. If a file shows no cover, embed artwork into the audio file and rescan.

## Copy Music To Device

Use the public SquarePod folder for the least fragile workflow:

```sh
adb shell mkdir -p /sdcard/Music/SquarePod
adb push "/Users/gigass/Music/QQ音乐" /sdcard/Music/SquarePod/
```

Then open SquarePod and select:

```text
Music -> Scan
```

Alternative app-specific folder:

```sh
adb shell mkdir -p /sdcard/Android/data/com.squarepod.app/files/Music
adb push "/path/to/music-or-folder" /sdcard/Android/data/com.squarepod.app/files/Music/
```

## Development

Install dependencies:

```sh
npm install
```

Run the web dev server:

```sh
npm run dev
```

Type-check:

```sh
npm run lint
```

Build the web app:

```sh
npm run build
```

Build Android debug APK:

```sh
npm run android:build
```

Install the debug APK on the connected device:

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Launch the app:

```sh
adb shell am start -n com.squarepod.app/.MainActivity
```

Force-stop and relaunch:

```sh
adb shell am force-stop com.squarepod.app
adb shell am start -n com.squarepod.app/.MainActivity
```

## Useful Scripts

```sh
npm run dev
```

Starts the Vite dev server on port `3000`.

```sh
npm run lint
```

Runs TypeScript type checking with `tsc --noEmit`.

```sh
npm run android:sync
```

Builds the web app and syncs Capacitor Android assets.

```sh
npm run android:build
```

Runs `android:sync`, then builds the Android debug APK with Gradle.

```sh
npm run android:run
```

Syncs Capacitor and runs the Android app through Capacitor tooling.

```sh
npm run android:open
```

Opens the Android project.

## Architecture

Important frontend files:

- `src/App.tsx`: app state, navigation stack, playback queue behavior, local continuation mode.
- `src/data.tsx`: menu tree generation for Music, Cover Flow, Artists, Albums, Settings, Extras.
- `src/useLocalMusic.ts`: React hook around the native local music plugin.
- `src/native/localMusic.ts`: TypeScript interface for the native plugin.
- `src/components/Screen.tsx`: iPod screen UI, Cover Flow, Now Playing, song detail, battery display.
- `src/components/ClickWheel.tsx`: wheel layout, pointer handling, select/menu/play/next/previous controls.
- `src/useWheel.ts`: click-wheel gesture interpretation.
- `src/audio/uiSounds.ts`: generated UI sounds for wheel ticks and button clicks.
- `src/components/CachedImage.tsx`: renders local `file://` and `content://` artwork through Capacitor-safe URLs.

Important Android files:

- `android/app/src/main/java/com/squarepod/app/LocalMusicPlugin.java`: local library scanning, metadata extraction, artwork cache, MediaPlayer playback, queue persistence.
- `android/app/src/main/java/com/squarepod/app/DeviceStatusPlugin.java`: battery status bridge.
- `android/app/src/main/java/com/squarepod/app/MainActivity.java`: plugin registration and immersive fullscreen setup.
- `android/app/src/main/AndroidManifest.xml`: app permissions, package queries, launcher activity, file provider.

Legacy integration files still present:

- `src/services/appleMusic.ts`
- `src/useAppleMusic.ts`
- `src/native/appleMusicAuth.ts`
- `src/native/appleMusicPlayer.ts`
- `android/app/src/main/java/com/squarepod/app/AppleMusicAuthPlugin.java`
- `android/app/src/main/java/com/squarepod/app/AppleMusicPlayerPlugin.java`
- `src/services/spotify.ts`
- `src/services/spotifyAuth.ts`
- `src/services/spotifyLibrary.ts`
- `src/useSpotify.ts`
- `src/native/spotifyRemote.ts`
- `android/app/src/main/java/com/squarepod/app/SpotifyRemotePlugin.java`

Those files are not the current product direction. Treat them as historical work unless the project explicitly reopens Apple Music or Spotify support.

## Permissions

SquarePod requests audio library access:

- Android 13 and newer: `READ_MEDIA_AUDIO`
- Older Android versions: `READ_EXTERNAL_STORAGE`

It also declares `INTERNET` because legacy Apple Music/Spotify code and Capacitor browser flows still exist in the project. Local music playback itself does not require internet.

## Known Limits

- No streaming-provider audio caching.
- No Apple Music offline playback inside SquarePod.
- No Spotify offline playback guarantee inside SquarePod.
- No sidecar cover image scanning.
- No playlist editor yet.
- No search UI yet.
- Some menu sections outside Music are placeholders.
- Local playback quality and codec support depend on Android `MediaPlayer`.
- The repo still contains legacy integration code that should be removed or isolated before a clean public release.

## Current Verification Flow

Before installing a build on device:

```sh
npm run lint
npm run android:build
```

Install and launch:

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am force-stop com.squarepod.app
adb shell am start -n com.squarepod.app/.MainActivity
```

Check foreground activity:

```sh
adb shell dumpsys window | rg -n "mCurrentFocus|mFocusedApp"
```
