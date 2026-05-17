# 🐈 Cat Gatekeeper

> A menubar app for macOS. When you've been working too long, my cat **Louisa**
> appears on your screen and refuses to leave until you pet her.

Inspired by [ZOKUZOKU's original Cat Gatekeeper Chrome extension](https://zokuzoku.github.io/cat-gatekeeper),
this is a system-wide macOS version — the cat overlays everything, not just
your browser.

---

## 🚀 Quick start (no coding needed)

You need two things: the **app** and a **set of cat animations**.

### 1. Download the app

Grab `Cat Gatekeeper.app` from the [latest release](https://drive.google.com/file/d/1amt0i7Jo-1pT7w7XJQDBOcZQpfz7hZki/view?usp=drive_link).

1. Open the `.app` and drag **Cat Gatekeeper** anywhere you like —
   `/Applications`, `~/Applications`, your Desktop, anywhere.
2. The first time you launch it, macOS will say
   *"can't verify the developer"* — this is because the app isn't signed.
   Two ways to authorize it:

   **Option A (per-app, faster):**
   - Right-click **Cat Gatekeeper** → choose **Open**
   - Click **Open** in the warning dialog
   - From the second launch onward, just double-click normally

   **Option B (via System Settings):**
   - Try to open the app once (it will be blocked)
   - Open **System Settings → Privacy & Security**
   - Scroll down to **Security** — you'll see *"Cat Gatekeeper was blocked..."*
   - Click **Open Anyway** → enter your password → confirm
   - The app launches and is permanently trusted

### 2. Download Louisa, my cat 🐈

Grab the sample animation pack from this [Google Drive folder](https://drive.google.com/drive/folders/1pLcy6HG94zL36RkT-FjOodZ7pr3V7trk?usp=drive_link).

Download and unzip anywhere you like (e.g. `~/Documents/Louisa/`). Inside,
the structure looks like:

```
Louisa/
├── walk_in_yawn/
│   ├── 00001.png ... 00280.png
│   └── idle/
│       └── ...
└── ...
```

### 3. Point the app at the folder

On first launch, Cat Gatekeeper asks you to **choose your animations folder**.
Pick the `Louisa/` folder you just unzipped.

That's it. Louisa now lives in your menubar 🐈

You can change the folder anytime from the menubar:
**🐈 (tray icon) → Change assets folder…**

---

## What you can do

| | |
|---|---|
| 🐈 | Every 25 minutes (configurable: 15 / 20 / 25 / 30 / 45 / 60 / 90), Louisa appears |
| 🤚 | Click her to dismiss — she'll bounce and disappear |
| ⏸  | Snooze for 1 / 2 / 4 hours from the tray menu |
| 🎨 | Change the menubar icon to any PNG you like |
| 📂 | Swap animation folders anytime (each can have multiple appearances + idle pools) |

All controls live in the menubar — click the cat-head icon at the top-right
of your screen to open the menu.

---

## Bring your own cat 🎨

Louisa is just my cat. If you want to use yours (or a dog, capybara, vintage
typewriter — anything), the app reads any folder with this layout:

```
your_animations_folder/
├── appearance_1/             ← random one of these plays each time
│   ├── 00001.png             ← zero-padded sequential PNG frames
│   ├── 00002.png
│   ├── ...
│   └── idle/                 ← optional: idles loop after the main animation
│       ├── breathe/
│       │   └── 00001.png ...
│       └── blink/
│           └── 00001.png ...
├── appearance_2/
│   └── ...
└── appearance_3/
    └── ...
```

The app **auto-discovers** this structure when you point it at a folder.
To add a new appearance, drop a new subfolder in and click
**Reload animations** in the tray menu.

### How I made Louisa

1. **Reference photos** of my cat in 3–4 distinct poses (sit, walk, yawn, …)
2. **Generate video** using [Nano Banana / Gemini](https://gemini.google.com)
   (or Sora / Kling / Runway), prompting for a uniform green `#00FF00`
   background for chroma keying
3. **Extract frames** at 24fps:
   ```bash
   ffmpeg -i cat_walk.mp4 -r 24 frame_%05d.png
   ```
4. **Remove the green background** using
   [transparent-background](https://github.com/plemeri/transparent-background)
   (BiRefNet, free) or CapCut's AI cutout

Maybe 30 minutes per appearance once you've got the hang of it.

---

## For developers

```bash
git clone https://github.com/<your-username>/cat-gatekeeper.git
cd cat-gatekeeper
npm install
npm start                    # development run with DevTools
npm run dist                 # package an unsigned .dmg into dist/
```

### Architecture

```
cat-gatekeeper/
├── main.js          # Electron main process
│                    #   - Tray menu, settings persistence, snooze, window mgmt
│                    #   - Reads settings.json from app.getPath('userData')
├── preload.js       # Bridges main ↔ renderer over IPC with context isolation
├── renderer.js      # Animation player (requestAnimationFrame, 24fps)
│                    #   - Random scene pick + per-scene idle pool
├── index.html       # Single transparent overlay div
├── style.css        # Cat positioning, pet bounce, idle bob keyframes
├── package.json     # electron-builder config for .app packaging
└── assets/
    └── icon.png     # Default menubar tray icon (any small square PNG)
```

The window is `floating` level (above normal apps, below system menubar
dropdowns), transparent, click-through except on the cat sprite itself. A
`setVisibleOnAllWorkspaces({ visibleOnFullScreen: true })` call keeps the cat
visible across macOS Spaces. Settings live in
`~/Library/Application Support/cat-gatekeeper/settings.json`.

---

## Tips

- **Multi-Mac sync via Google Drive**: point the app at a folder inside your
  Drive's local mirror — all your Macs share the same cat
- **Switch costumes by day**: keep multiple folders (`work_cat/`,
  `weekend_cat/`) and switch via tray → Change assets folder…
- **Custom tray icon**: drop in any small square PNG via
  tray → Change tray icon…

---

## Credits

- 🐈 Original concept: [Cat Gatekeeper by ZOKUZOKU](https://zokuzoku.github.io/cat-gatekeeper/)
- 🛠 Built with [Electron](https://www.electronjs.org/) and [electron-builder](https://www.electron.build/)
- 🖼 Background removal with [transparent-background](https://github.com/plemeri/transparent-background) (BiRefNet)
- 🐈 The real Louisa — for being so photogenic

## License

[MIT](LICENSE)
