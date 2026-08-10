# OpenCanvas

A free and open-source Chromium extension that adds dark mode and custom palettes to your school's Canvas site.

## Features

- Two presets: **Standard Black** and **Tokyo Night**, plus a fully editable **Custom** palette.
- Seven editable custom colors with live updates across open Canvas tabs.

## Install on Windows (no experience needed)

You do not need to know how to code. You only need a web browser and a free program called Git.

1. **Install Git for Windows.** Download it from <https://git-scm.com/download/win> and run the installer. Keep clicking **Next** until it finishes — the default options are fine.
2. **Download the code.** Open the **Start** menu, search for **Git Bash**, and open it. A black window with text will appear.
3. In that window, type the following and press Enter:

   ```sh
   git clone https://github.com/jtyuill/opencanvas.git
   ```

   (This copies the OpenCanvas code into a folder named `opencanvas` on your computer.)

4. **Open Chrome** (or Edge or Brave), and type `chrome://extensions` in the address bar. Press Enter.
5. Turn on **Developer mode** — it is a switch in the top-right corner of the page.
6. Click **Load unpacked** (top-left). In the window that opens, find and select the `opencanvas` folder you just downloaded. It is usually under `C:\Users\YourName\opencanvas`.
7. OpenCanvas is now installed. Click its icon in the toolbar, enter your school's Canvas web address (for example `https://canvas.example.edu`), and click **Connect**.
8. Approve access when Chrome asks, then open or refresh your Canvas site. The dark theme is on.

Troubleshooting:

- **"Manifest file is missing or unreadable"** — you selected the wrong folder. Pick the one that contains a file named `manifest.json`, not the one above it.
- **Do not move or delete the `opencanvas` folder** after loading it, or the extension will stop working. If you need to move it, remove the extension, move the folder, and load it again.
- **Updates** — to get a newer version, open Git Bash, type `cd opencanvas` (or `cd ~/opencanvas`), press Enter, then type `git pull` and press Enter. Reload the extension on the `chrome://extensions` page.

## Install locally (developers)

1. Open `chrome://extensions` in Chrome, Chromium, Brave, or Edge.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this repository directory.
4. Open the toolbar popup and enter your school's Canvas base URL, such as `https://canvas.example.edu`.
5. Approve access to that site, then open or refresh Canvas.
