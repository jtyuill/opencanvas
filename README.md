# OpenCanvas

A free and open-source Firefox extension that adds dark mode and custom palettes to your school's Canvas site.

## Features

- Two presets: **Standard Black** and **Tokyo Night**, plus a fully editable **Custom** palette.
- Seven editable custom colors with live updates across open Canvas tabs.

## Install on Firefox

1. Download this repository and extract it to a permanent folder.
2. Open Firefox and enter `about:debugging#/runtime/this-firefox` in the address bar.
3. Click **Load Temporary Add-on** and select `manifest.json` from the OpenCanvas folder.
4. Open the toolbar popup, enter your school's Canvas address (for example, `https://canvas.example.edu`), and click **Connect**.
5. Approve access, then open or refresh Canvas.

Temporary add-ons are removed when Firefox closes. For persistent installation, install a signed `.xpi` build.

## Install locally (developers)

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on** and select this repository's `manifest.json`.
3. Open the toolbar popup and enter your school's Canvas base URL, such as `https://canvas.example.edu`.
4. Approve access to that site, then open or refresh Canvas.
