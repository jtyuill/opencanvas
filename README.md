# OpenCanvas

A free and open-source extension that adds dark mode and custom palettes to your school's Canvas site. OpenCanvas supports Chromium browsers and Firefox from the same source.

## Features

- Two presets: **Standard Black** and **Tokyo Night**, plus a fully editable **Custom** palette.
- Seven editable custom colors with live updates across open Canvas tabs.

## Install a release

Download the archive for your browser from the [latest GitHub release](https://github.com/jtyuill/opencanvas/releases/latest), then extract it.

### Chrome, Edge, and Brave

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the extracted OpenCanvas folder.
4. Open the toolbar popup, enter your school's Canvas address, and click **Connect**.
5. Approve access, then open or refresh Canvas.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select the downloaded Firefox `.zip` or its extracted `manifest.json`.
3. Open the toolbar popup, enter your school's Canvas address, and click **Connect**.
4. Approve access, then open or refresh Canvas.

Firefox removes temporary add-ons when it closes. Persistent Firefox installation requires Mozilla signing.

## Install locally (developers)

The repository manifest supports both browser engines:

- Chromium: load the repository directory from `chrome://extensions`.
- Firefox: select `manifest.json` from `about:debugging#/runtime/this-firefox`.

Run `npm run build:release` to create browser-labeled archives in `release-artifacts/`.
