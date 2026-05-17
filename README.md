# 🐈 Cat Gatekeeper

> A menubar app for macOS. When you've been working too long, your cat appears
> on your screen and refuses to leave until you pet it.

Inspired by [ZOKUZOKU's original Cat Gatekeeper Chrome extension](https://chromewebstore.google.com/detail/cat-gatekeeper/dgkcoindljmldhblkdgicflohhhakkfm),
this is a system-wide macOS version — the cat overlays everything, not just
your browser, and you bring your own cat.

---

## Quick start

```bash
git clone https://github.com/<your-username>/cat-gatekeeper.git
cd cat-gatekeeper
npm install
npm start
```

On first run, the menubar app asks you to pick a folder containing your
animation sequences (see [Bring your own cat](#bring-your-own-cat-) below).
After that:

- 🐈 The cat appears every 25 minutes (configurable from 15 / 20 / 25 / 30 / 45 / 60 / 90)
- 🤚 Click the cat to dismiss; it'll bounce and disappear
- ⏸ Snooze for 1 / 2 / 4 hours from the tray menu
- 🎨 Customize the tray icon and the assets folder anytime from the menubar

To package a redistributable `.app`:

```bash
npm run dist
```

The bundle lands in `dist/`. macOS won't run an unsigned `.app` by default —
right-click the `.app` → **Open** → confirm. After the first launch it opens
normally.

---

## Bring your own cat 🎨

This repo does **not ship any animation frames** — you bring your own cat
(or dog, or capybara, or vintage typewriter). Expected folder layout:

```
your_animations_folder/
├── walk_in_yawn/             ← one "appearance" — random one of these plays
│   ├── 00001.png             ← zero-padded sequential frames
│   ├── 00002.png
│   ├── ...
│   └── idle/                 ← optional: idle animations to loop after main ends
│       ├── breathe/
│       │   └── 00001.png ...
│       └── blink/
│           └── 00001.png ...
├── wake_up_stretch/          ← another appearance
│   ├── 00001.png ...
│   └── idle/...
└── jump_down/
    └── ...
```

The app **auto-discovers** this structure when you point it at a folder. Add
new appearances by dropping new subfolders in — just click **Reload animations**
in the tray menu.

### How I generated my frames

1. **Reference photos** of my cat in 3–4 distinct poses
2. **Generate video** using [Nano Banana / Gemini](https://gemini.google.com) (or Sora / Kling / Runway), prompting for a uniform green background `#00FF00` for chroma keying
3. **Extract frames** at 24fps:
   ```bash
   ffmpeg -i cat_walk.mp4 -r 24 frame_%05d.png
   ```
4. **Remove background** using [transparent-background](https://github.com/plemeri/transparent-background) (BiRefNet, free) or CapCut's AI cutout

The whole pipeline takes maybe 30 minutes per appearance once you've got the
hang of it.

---

## Architecture

```
cat-gatekeeper/
├── main.js          # Electron main process
│                    #   - Tray menu, settings persistence, snooze, window mgmt
│                    #   - Reads settings.json from app.getPath('userData')
├── preload.js       # Bridges main ↔ renderer over IPC with context isolation
├── renderer.js      # Animation player (requestAnimationFrame, 24fps)
│                    #   - Loads CONFIG via window.cat.getAssetConfig()
│                    #   - Random scene pick + per-scene idle pool
├── index.html       # Single transparent overlay div
├── style.css        # Cat positioning, pet bounce, idle bob keyframes
├── package.json     # electron-builder config for .app packaging
└── assets/
    └── icon.png     # Default menubar tray icon
```

The window is `floating` level (above normal apps, below system menubar
dropdowns), transparent, click-through except on the cat sprite itself.
A `setVisibleOnAllWorkspaces` call keeps the cat visible across macOS Spaces.

---

## Tips

- **Multi-Mac sync via Google Drive**: point the app at a folder inside your
  Drive's local mirror — all your Macs share the same cat
- **Switch costumes by day**: keep multiple folders (`work_cat/`, `weekend_cat/`)
  and switch via tray → Change assets folder…
- **Custom tray icon**: drop in any small square PNG via tray → Change tray icon…

---

## Credits

- 🐈 Original concept: [Cat Gatekeeper by ZOKUZOKU](https://chromewebstore.google.com/detail/cat-gatekeeper/dgkcoindljmldhblkdgicflohhhakkfm)
- 🛠 Built with [Electron](https://www.electronjs.org/) and [electron-builder](https://www.electron.build/)
- 🖼 Background removal with [transparent-background](https://github.com/plemeri/transparent-background) (BiRefNet)

## License

[MIT](LICENSE)
