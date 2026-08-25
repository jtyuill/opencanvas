# OpenCanvas

A free and open-source browser extension that makes Canvas better. OpenCanvas supports Chromium browsers and Firefox
## Features

- Two presets: **Standard Black** and **Tokyo Night**, plus a fully editable **Custom** palette.
- Editable custom colors with live updates across open Canvas tabs.
- Custom course card pictures from uploaded images or HTTPS image URLs.
- Portable JSON settings files for importing and exporting themes, site settings, and course images.
- An **Export to Markdown** button on each assignment page for saving a self-contained Markdown file with its images embedded.

## Install a release

Open the [latest release](https://github.com/jtyuill/opencanvas/releases/latest) and download the file for your browser.

### Chromium browsers

1. Download `opencanvas-<version>-chromium.zip`.
2. Extract the ZIP to a permanent folder. Do not move or delete this folder after installation.
3. Open your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the extracted folder that directly contains `manifest.json`.
6. Pin OpenCanvas to the toolbar if needed, then open its popup.
7. Enter your school's Canvas address, such as `https://canvas.example.edu`, and click **Connect**.
8. Approve access, then open or refresh Canvas.

### Firefox

1. Download `opencanvas-<version>-firefox.zip`.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on** and select the downloaded ZIP. You can also extract it and select `manifest.json`.
4. Open the OpenCanvas toolbar popup.
5. Enter your school's Canvas address, such as `https://canvas.example.edu`, and click **Connect**.
6. Approve access, then open or refresh Canvas.

Firefox removes temporary add-ons when it closes. Permanent Firefox installation requires a Mozilla-signed package, which the GitHub release does not currently provide.

This will be fixed soonTM

## Install from source

1. Clone the repository:

   ```sh
   git clone https://github.com/jtyuill/opencanvas.git
   ```

2. Load the repository folder:
   - Chromium: enable Developer mode on the browser's extensions page, click **Load unpacked**, and select the repository folder.
   - Firefox: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and select `manifest.json`.

## Updating

- Release installation: download the newest browser archive, extract it, and replace the previously loaded folder. On Chromium, click **Reload** on the OpenCanvas extension card.
- Source installation: run `git pull`, then reload the extension from the browser's extension debugging page.

## Troubleshooting

- **"Manifest file is missing or unreadable"** — select the folder that directly contains `manifest.json`, not its parent.
- **OpenCanvas disappears after restarting Firefox** — temporary Firefox add-ons are removed when Firefox closes; repeat the Firefox installation steps.
- **The theme does not appear** — open the popup, confirm the theme is enabled, reconnect the correct Canvas address, and refresh the Canvas tab.
