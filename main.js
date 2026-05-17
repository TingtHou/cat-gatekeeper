// main.js — Electron main process
// Cat Gatekeeper for macOS
// On first launch: ask user to pick assets folder (persistent).
// Each subfolder in the assets folder = one "appearance" animation.
// Each appearance can have an "idle/" subfolder containing idle sub-animations.

const { app, BrowserWindow, screen, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');

// ===== CONFIG =====
const DEFAULT_WORK_MINUTES = 25;
const MAX_STAY_HOURS       = 1;
const DEBUG_MODE = !!process.env.DEBUG_MODE;

function workMs() {
  if (DEBUG_MODE) return 8 * 1000;
  const m = loadSettings().workMinutes ?? DEFAULT_WORK_MINUTES;
  return m * 60 * 1000;
}
const MAX_STAY_MS = DEBUG_MODE ? 60 * 1000 : MAX_STAY_HOURS * 60 * 60 * 1000;

// === Settings persistence ===
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); }
  catch { return {}; }
}

function saveSettings(s) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
}

// === Folder scanner ===
function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function listPNGs(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(name => /\.png$/i.test(name) && !name.startsWith('.'))
      .sort(naturalCompare)
      .map(name => path.join(dir, name));
  } catch { return []; }
}

function listSubdirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name)
      .sort(naturalCompare);
  } catch { return []; }
}

// Scan structure:
//   <rootPath>/<appearance_name>/*.png                  (main animation frames)
//   <rootPath>/<appearance_name>/idle/<idle_name>/*.png (idle sub-animations)
function scanAssets(rootPath) {
  if (!rootPath || !fs.existsSync(rootPath)) return [];

  const appearances = [];

  for (const appearanceName of listSubdirs(rootPath)) {
    const appearanceDir = path.join(rootPath, appearanceName);
    const mainFiles = listPNGs(appearanceDir);
    if (mainFiles.length === 0) continue;  // skip empty folders

    const idles = [];
    const idleRoot = path.join(appearanceDir, 'idle');
    if (fs.existsSync(idleRoot)) {
      for (const idleName of listSubdirs(idleRoot)) {
        const idleFiles = listPNGs(path.join(idleRoot, idleName));
        if (idleFiles.length > 0) {
          idles.push({ name: idleName, files: idleFiles });
        }
      }
    }

    appearances.push({
      name: appearanceName,
      files: mainFiles,
      idles,
      weight: 1,
    });
  }

  return appearances;
}

// === First-run dialog ===
async function askForAssetsFolder() {
  const result = await dialog.showOpenDialog({
    title: 'Choose your cat animations folder',
    message: 'Pick a folder. Each subfolder inside it is one "appearance" animation.',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Use this folder',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

async function ensureAssetsConfigured() {
  let settings = loadSettings();
  if (settings.assetsPath && fs.existsSync(settings.assetsPath)) return settings.assetsPath;

  await dialog.showMessageBox({
    type: 'info',
    title: 'Welcome to Cat Gatekeeper 🐈',
    message: 'Let\'s pick where your cat lives.',
    detail:
      'Pick a folder containing your animation subfolders.\n\n' +
      'Expected structure:\n' +
      '  📁 your_chosen_folder/\n' +
      '    📁 walk_in_yawn/        ← one animation\n' +
      '      🖼️ 00001.png ... 00280.png\n' +
      '      📁 idle/              ← optional, idle actions for this animation\n' +
      '        📁 breathe/  🖼️ *.png\n' +
      '        📁 blink/    🖼️ *.png\n' +
      '    📁 jump_down/           ← another animation\n' +
      '      🖼️ ...\n\n' +
      'You can add more folders later — the app will discover them on next launch.',
    buttons: ['Choose folder…'],
  });

  const picked = await askForAssetsFolder();
  if (picked) {
    settings = { ...settings, assetsPath: picked };
    saveSettings(settings);
  }
  return picked;
}

// === Window / tray / timer ===
let mainWindow    = null;
let tray          = null;
let snoozeUntil   = 0;
let nextShowTimer = null;
let maxStayTimer  = null;
let catVisible    = false;

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.bounds;
  // workArea.y == macOS menubar height (typically 24). Skipping it keeps the
  // menubar fully clickable even when the cat window has captured input.
  const menubarHeight = display.workArea.y;

  mainWindow = new BrowserWindow({
    width:  width,
    height: height - menubarHeight,
    x:      0,
    y:      menubarHeight,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,  // allow file:// from arbitrary user paths
    },
  });

  // 'floating' (level 3) keeps the cat above normal apps but BELOW menubar
  // dropdowns (level 101) — so the tray menu items remain clickable.
  // Trade-off: cat won't cover fullscreen apps (Zoom, Keynote). That's
  // intentional — you don't want to interrupt presentations.
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.loadFile('index.html');

  // Open DevTools in debug mode only
  if (DEBUG_MODE) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function showCat() {
  if (!mainWindow || catVisible) return;
  if (Date.now() < snoozeUntil) { scheduleNext(); return; }

  catVisible = true;
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.show();
  mainWindow.webContents.send('cat-appear');
  maxStayTimer = setTimeout(hideCat, MAX_STAY_MS);
}

function hideCat() {
  if (!mainWindow || !catVisible) return;
  catVisible = false;
  if (maxStayTimer) { clearTimeout(maxStayTimer); maxStayTimer = null; }

  mainWindow.webContents.send('cat-disappear');
  setTimeout(() => {
    if (mainWindow) {
      mainWindow.hide();
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  }, 700);

  scheduleNext();
}

function scheduleNext() {
  if (nextShowTimer) clearTimeout(nextShowTimer);
  nextShowTimer = setTimeout(showCat, workMs());
}

function setWorkInterval(minutes) {
  saveSettings({ ...loadSettings(), workMinutes: minutes });
  scheduleNext();          // restart timer with new interval
  updateTrayMenu();
}

function snooze(hours) {
  snoozeUntil = Date.now() + hours * 60 * 60 * 1000;
  updateTrayMenu();
}

async function changeAssetsFolder() {
  const picked = await askForAssetsFolder();
  if (picked) {
    saveSettings({ ...loadSettings(), assetsPath: picked });
    if (mainWindow) mainWindow.webContents.reload();
    updateTrayMenu();
  }
}

function updateTrayMenu() {
  const settings = loadSettings();
  const workMinutes = settings.workMinutes ?? DEFAULT_WORK_MINUTES;
  const snoozeActive = Date.now() < snoozeUntil;
  const snoozeLabel = snoozeActive
    ? `Snoozed until ${new Date(snoozeUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `Work ${workMinutes}m → cat appears`;

  const assetsPath    = settings.assetsPath || '(not set — click to choose)';
  const trayIconLabel = settings.trayIconPath ? path.basename(settings.trayIconPath) : 'default';

  // Common Pomodoro / focus presets
  const intervalPresets = [15, 20, 25, 30, 45, 60, 90];
  const intervalSubmenu = intervalPresets.map(m => ({
    label:   `${m} minutes`,
    type:    'radio',
    checked: workMinutes === m,
    click:   () => setWorkInterval(m),
  }));

  const menu = Menu.buildFromTemplate([
    { label: snoozeLabel, enabled: false },
    { type: 'separator' },
    { label: 'Show cat now',    click: showCat },
    { label: 'Dismiss cat now', click: hideCat },
    { type: 'separator' },
    { label: 'Work interval',         sublabel: `${workMinutes} min`, submenu: intervalSubmenu },
    { label: 'Change assets folder…', sublabel: assetsPath,           click: changeAssetsFolder },
    { label: 'Reload animations',                                     click: () => mainWindow && mainWindow.webContents.reload() },
    { type: 'separator' },
    { label: 'Change tray icon…',     sublabel: trayIconLabel,        click: changeTrayIcon },
    { label: 'Reset tray icon',                                       click: resetTrayIcon, enabled: !!settings.trayIconPath },
    {
      label: 'Snooze',
      submenu: [
        { label: '1 hour',  click: () => snooze(1) },
        { label: '2 hours', click: () => snooze(2) },
        { label: '4 hours', click: () => snooze(4) },
        { label: 'Cancel snooze', click: () => { snoozeUntil = 0; updateTrayMenu(); } },
      ],
    },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' },
  ]);
  tray.setContextMenu(menu);
}

function getCurrentTrayIcon() {
  const settings = loadSettings();
  const custom   = settings.trayIconPath;

  // 1. Try the user's custom icon
  if (custom && fs.existsSync(custom)) {
    const icon = nativeImage.createFromPath(custom);
    if (!icon.isEmpty()) return icon.resize({ width: 18, height: 18 });
    console.warn(`tray icon at ${custom} could not be loaded, falling back to default`);
  }

  // 2. Fall back to bundled default
  const defaultPath = path.join(__dirname, 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(defaultPath);
  return icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 18, height: 18 });
}

function refreshTrayIcon() {
  if (tray) tray.setImage(getCurrentTrayIcon());
}

async function changeTrayIcon() {
  const result = await dialog.showOpenDialog({
    title: 'Pick a tray icon image',
    message: 'PNG works best. Will be resized to 18×18 pixels for the menubar.',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return;
  saveSettings({ ...loadSettings(), trayIconPath: result.filePaths[0] });
  refreshTrayIcon();
  updateTrayMenu();
}

function resetTrayIcon() {
  const s = loadSettings();
  delete s.trayIconPath;
  saveSettings(s);
  refreshTrayIcon();
  updateTrayMenu();
}

function createTray() {
  tray = new Tray(getCurrentTrayIcon());
  tray.setToolTip('Cat Gatekeeper');
  updateTrayMenu();
}

// === IPC from renderer ===
ipcMain.on('cat-petted', () => { hideCat(); });

ipcMain.handle('get-asset-config', () => {
  const settings = loadSettings();
  if (!settings.assetsPath) return { error: 'no-path' };
  const appearances = scanAssets(settings.assetsPath);
  if (appearances.length === 0) return { error: 'empty', path: settings.assetsPath };
  return { appearances, rootPath: settings.assetsPath };
});

app.whenReady().then(async () => {
  if (process.platform === 'darwin') app.dock.hide();

  await ensureAssetsConfigured();

  createWindow();
  createTray();
  scheduleNext();
});

app.on('window-all-closed', (e) => e.preventDefault());
