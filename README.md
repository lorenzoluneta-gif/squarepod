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
- Click-wheel navigation with generated wheel/select/button sounds and native Android haptic ticks.
- Playback queue persistence across app restarts.
- Last track and position persistence across app restarts.
- Album continuation mode:
  - `Continue: Library`: after an album/artist context ends, continue through the wider local library.
  - `Continue: Album`: stop within the selected album/artist context.
- Configurable playback mode: Sequential, Shuffle, Repeat All, Repeat One.
- Local UI settings for click sound volume, auto scan, backlight dimming, audiobook filtering, EQ preset, compilation grouping, language, and main menu visibility/order.
- Local notes, contacts, and calendar events stored in app-local browser storage.
- Extras improvements:
  - Sleep Timer with cancel, end-now, adjustable duration, persisted state, and end actions.
  - Stopwatch with start, pause, resume, lap recording, reset, and last-session summary.
  - Screen Lock with an explicit two-step unlock flow.
  - Quick Note with draft recovery and optional current-song context.
  - Calendar Today, Upcoming, Month View, date/month stepping, event editing, and delete confirmation.
- Android MediaStore photo/video scanning with photo grid, photo detail, and video playback screens.
- FM Radio UI and native plugin surface for hardware-backed radio status, tune, seek, scan, start/stop, and local presets.
- Localized UI strings for English, Simplified Chinese, Spanish, Japanese, Korean, French, German, and Brazilian Portuguese.

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

## Photos And Videos

SquarePod can scan Android MediaStore images and videos through the native `MediaLibraryPlugin`.

Current behavior:

- Reads photos and videos from Android MediaStore after the relevant Android media permissions are granted.
- Shows a local photo grid and full-screen photo detail view.
- Shows local video entries with thumbnails when available.
- Plays selected videos through the web screen's HTML video element after converting native file/content URIs through Capacitor.

This is a local media browser. It is not a cloud photo library and does not edit, delete, or sync media files.

## FM Radio

SquarePod has a radio menu and native plugin contract for hardware-backed FM radio.

Current behavior:

- Checks wired-headset, broadcast-hardware, and backend availability.
- Supports status refresh, scan, tune, seek up/down, start, stop, save preset, and delete preset through the app UI.
- Stores presets and last tuned frequency locally.

There is no internet-radio fallback. If a device has no compatible broadcast radio hardware/backend, the UI reports that directly.

## Extras

The Extras area now uses closed-loop interactions instead of placeholder-only screens:

- Sleep Timer:
  - Start fixed-duration timers.
  - Cancel a running timer.
  - End immediately.
  - Add or subtract five minutes while running.
  - Choose what happens when it ends: pause playback, fade/pause label, or lock screen.
- Stopwatch:
  - Start, pause, resume, lap, reset.
  - Keep running when leaving the screen.
  - Preserve a last-session summary after reset.
- Screen Lock:
  - Restricts normal controls while locked.
  - Allows playback pause/resume while locked.
  - Requires Menu then Select to unlock.
- Notes:
  - Quick Note entry.
  - Draft persistence.
  - Optional current-song context.
  - Delete confirmation.
- Calendar:
  - Today and Upcoming event lists.
  - Month View with month stepping.
  - Date stepping from Today.
  - Event creation/editing and delete confirmation.

Contacts are still app-local contacts, not Android system contacts.

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
- `src/data.tsx`: menu tree generation for Music, Cover Flow, Artists, Albums, Settings, Extras, Radio, Photos, Videos, Notes, Calendar, Contacts.
- `src/useLocalMusic.ts`: React hook around the native local music plugin.
- `src/useMediaLibrary.ts`: React hook around the native Android media library plugin.
- `src/useRadio.ts`: React hook around the native radio plugin and local radio preset storage.
- `src/native/localMusic.ts`: TypeScript interface for the native plugin.
- `src/native/mediaLibrary.ts`: TypeScript interface for Android photo/video scanning.
- `src/native/radio.ts`: TypeScript interface for hardware radio status and controls.
- `src/native/wheelHaptics.ts`: TypeScript interface for native haptic ticks.
- `src/components/Screen.tsx`: iPod screen UI, Cover Flow, Now Playing, song detail, battery display.
- `src/components/ClickWheel.tsx`: wheel layout, pointer handling, select/menu/play/next/previous controls.
- `src/useWheel.ts`: click-wheel gesture interpretation.
- `src/audio/uiSounds.ts`: generated UI sounds for wheel ticks and button clicks.
- `src/components/CachedImage.tsx`: renders local `file://` and `content://` artwork through Capacitor-safe URLs.
- `src/i18n.ts`: supported locale list and UI messages.

Important Android files:

- `android/app/src/main/java/com/squarepod/app/LocalMusicPlugin.java`: local library scanning, metadata extraction, artwork cache, MediaPlayer playback, queue persistence.
- `android/app/src/main/java/com/squarepod/app/MediaLibraryPlugin.java`: Android MediaStore photo/video scanning and thumbnail extraction.
- `android/app/src/main/java/com/squarepod/app/RadioPlugin.java`: hardware-backed radio plugin surface; reports unavailable status where backend support is missing.
- `android/app/src/main/java/com/squarepod/app/WheelHapticsPlugin.java`: native vibration ticks for wheel and button feedback.
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

SquarePod also requests:

- Android 13 and newer: `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`
- `VIBRATE` for click-wheel haptic feedback.

It also declares `INTERNET` because legacy Apple Music/Spotify code and Capacitor browser flows still exist in the project. Local music playback itself does not require internet.

## Known Limits

- No streaming-provider audio caching.
- No Apple Music offline playback inside SquarePod.
- No Spotify offline playback guarantee inside SquarePod.
- No sidecar cover image scanning.
- No playlist editor yet.
- No search UI yet.
- Contacts are app-local only; Android system contacts are not integrated.
- Notes, contacts, calendar events, menu settings, stopwatch state, and sleep timer state are stored in local WebView storage rather than a durable native database.
- Calendar reminders are not native Android notifications yet.
- FM Radio depends on compatible device hardware/backend support; there is no network radio fallback.
- Photo/video media browsing is read-only.
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
