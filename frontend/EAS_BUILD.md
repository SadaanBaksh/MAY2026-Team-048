# Building an Android APK with EAS

A step-by-step guide to producing a real, installable `.apk` of the Simplifix app for testing on
a physical Android device — no Android Studio or local Gradle setup required.

## Why EAS, not just "compile it"?

Simplifix is an **Expo-managed** React Native app. There's no plain "compile to APK" button for a
project like this — turning the JS/TS source into a real Android app normally means generating a
full native Android project and running Gradle, which needs Android Studio, the right SDK/NDK
versions, and a fair amount of local setup.

**EAS Build** (Expo Application Services) is Expo's own cloud build service: you push your project
to Expo's servers, their machines do the native Android build, and you get back a download link
for the finished `.apk`. Your machine doesn't need Android Studio or Gradle at all — you only need
`node`/`npm` and an Expo account.

This project already has `frontend/eas.json` configured with a `preview` build profile that
produces a direct-install APK (as opposed to the `.aab` format the Play Store requires) — so the
one-time setup below is mostly just installing the CLI and logging in.

## Prerequisites

- `node` and `npm` installed and on your PATH (check with `node -v` / `npm -v`)
- A free [Expo account](https://expo.dev/signup) — sign up if you don't have one
- The repo cloned, with `frontend/` as your working directory for every command below

## Step 1 — Install the EAS CLI

You don't need to install anything globally — `npx` downloads and runs it on demand, always using
the latest version:

```bash
cd frontend
npx eas-cli --version
```

If this prints a version number, you're set. (If you'd rather install it once instead of
re-downloading every time: `npm install -g eas-cli`, then use `eas` instead of `npx eas-cli` in
every command below.)

## Step 2 — Log in to your Expo account

```bash
npx eas-cli login
```

This asks for your Expo email/username and password (or opens a browser to authenticate,
depending on CLI version). You only need to do this once per machine — it stores a token locally.

Check it worked:

```bash
npx eas-cli whoami
```

## Step 3 — Understand the build profiles

Open `frontend/eas.json` — it already defines three profiles:

```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "android": { "buildType": "apk" } },
    "preview":     { "distribution": "internal", "android": { "buildType": "apk" } },
    "production":  { "autoIncrement": true }
  }
}
```

| Profile | Produces | When to use it |
| --- | --- | --- |
| `development` | APK with the Expo dev client baked in | Rare for this project — for connecting to a live Metro bundler from a real device during active development. |
| `preview` | A plain, direct-install `.apk` | **This is the one you want for testing.** Installable by anyone via a link/QR code — no Play Store, no dev server needed. |
| `production` | A Play Store `.aab` bundle | Only relevant once you're actually publishing to the Play Store. Not an installable file by itself. |

Since we want a testable APK, every command below uses `--profile preview`.

## Step 4 — Confirm the app points at the right backend

Before building, double-check `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=https://simplifix-backend.onrender.com
```

`EXPO_PUBLIC_*` variables are baked into the JS bundle **at build time** — unlike a dev server,
you can't change this after the APK is built. If you want the built APK to hit a different
backend (e.g. a local one via your machine's LAN IP), edit `.env` *before* running the build, not
after.

## Step 5 — Run the build

```bash
npx eas-cli build --platform android --profile preview
```

What you'll be asked/what happens, in order:

1. **First time only — Android app credentials.** EAS needs a signing keystore for the APK. It'll
   offer to generate and manage one for you — say **yes**. (Expo stores it securely on your
   account; you don't need to manage keystore files yourself for testing purposes.)
2. **Upload.** The CLI zips up your project source and uploads it to Expo's build servers.
3. **Queue + build.** Your build joins Expo's build queue (free-tier builds can take anywhere from
   a few minutes to ~30 minutes depending on load), then an actual Android build runs on their
   infrastructure — installing dependencies, running Gradle, signing the APK.
4. **You'll get a link.** When it finishes, the terminal prints a build details URL
   (`https://expo.dev/accounts/<you>/projects/simplifix/builds/<id>`), and the CLI can show a QR
   code too. You can close the terminal at this point — the build keeps running on Expo's side
   regardless; the link is what you actually need.

You can also just watch it happen at [expo.dev](https://expo.dev) under your account's project
dashboard instead of staring at the terminal.

## Step 6 — Install it on a device

Once the build shows **Finished** on the build page:

- **On the Android device itself**: open the build page URL (or scan the QR code EAS shows) and
  tap **Install**. You may need to allow "Install unknown apps" for your browser the first time.
- **From your computer**: download the `.apk` from the build page and transfer it to the device
  (USB, email, cloud drive — whatever's convenient), then open it on the device to install.

That's it — you now have a real, standalone Simplifix app icon on the device, independent of
Expo Go or a running dev server.

## Rebuilding after code changes

There's no "watch mode" for native builds — every time you want an updated APK reflecting new
code, re-run the same command:

```bash
npx eas-cli build --platform android --profile preview
```

Each run produces a new build with its own link; old ones remain downloadable from your Expo
dashboard until you clean them up.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `npx eas-cli` fails immediately with a network/registry error | Usually just an npm registry hiccup — retry. If it persists, check `npm config get registry` is the default. |
| Build fails during the "Install dependencies" phase | Almost always a `package.json`/lockfile issue — make sure `npm install` succeeds cleanly locally first. |
| Build fails during the Gradle/native phase | Click through to the build's log on expo.dev — the actual Gradle error is usually near the bottom. Common causes: a native module needing extra config, or a plugin version mismatch in `app.json`. |
| APK installs but crashes on launch | Check whether it's actually reaching the backend — cold-start on Render's free tier can take 30-60s on the very first request; that's expected, not a crash. If it crashes before even that, check `adb logcat` while it starts (needs the device connected via USB with USB debugging on). |
| "Install blocked" on the device | Android blocks APKs from outside the Play Store by default — enable "Install unknown apps" for whichever app you used to open the file (browser, file manager, etc.), then retry. |
| Build queue is slow | Expected on Expo's free tier at busy times — paid EAS plans get priority queuing, not necessary just for occasional testing. |

## Reference

- [EAS Build docs](https://docs.expo.dev/build/introduction/)
- [eas.json reference](https://docs.expo.dev/build/eas-json/)
