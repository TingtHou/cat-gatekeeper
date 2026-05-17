// renderer.js — animation player driven by auto-discovered folder structure.
// No hardcoded CONFIG. Folder picked by user on first run.

console.log('🐈 renderer loaded');

const FPS = 24;                  // global frame rate
const FRAME_MS = 1000 / FPS;

const container = document.getElementById('cat-container');
const catImg    = document.getElementById('cat');

let scenes  = [];
let playing = false;

// === Animation = preloaded segment of frames (file paths) ===
class Animation {
  constructor({ name, files }) {
    this.name   = name;
    this.files  = files;
    this.frames = [];
    this.loadedCount = 0;
    this.failedCount = 0;
  }

  preload() {
    for (const filePath of this.files) {
      const img = new Image();
      img.onload  = () => {
        this.loadedCount++;
        if (this.loadedCount + this.failedCount === this.length) this._logSummary();
      };
      img.onerror = () => {
        this.failedCount++;
        console.error(`❌ ${this.name} failed: ${filePath}`);
        if (this.loadedCount + this.failedCount === this.length) this._logSummary();
      };
      img.src = `file://${filePath}`;
      this.frames.push(img);
    }
  }

  _logSummary() {
    const tag = this.failedCount ? '⚠️' : '✅';
    console.log(`${tag} ${this.name}: ${this.loadedCount}/${this.length} loaded` +
                (this.failedCount ? ` (${this.failedCount} failed)` : ''));
  }

  get length()    { return this.files.length; }
  frameAt(i)      { return this.frames[i]; }
  get isUsable()  { return this.loadedCount > 0; }
  get lastFrame() { return this.frames[this.frames.length - 1]; }
}

// === Scene = main animation + idle pool ===
class Scene {
  constructor({ name, files, idles, weight }) {
    this.name   = name;
    this.weight = weight || 1;
    this.main   = new Animation({ name: `${name}.main`, files });
    this.idles  = (idles || []).map(i =>
      new Animation({ name: `${name}.idle.${i.name}`, files: i.files })
    );
  }

  preload() {
    this.main.preload();
    this.idles.forEach(i => i.preload());
  }

  get isUsable() { return this.main.isUsable; }

  pickRandomIdle() {
    const pool = this.idles.filter(i => i.isUsable);
    if (pool.length === 0) return null;
    // Equal-weight random pick (all idles weight 1 for now)
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

// === Initialization ===
async function init() {
  const config = await window.cat.getAssetConfig();

  if (config.error === 'no-path') {
    console.error('❗ No assets folder configured. Open the menubar app menu → "Change assets folder…"');
    return;
  }
  if (config.error === 'empty') {
    console.error(`❗ Folder is empty or has no valid animation subfolders: ${config.path}`);
    return;
  }

  console.log(`📁 assets root: ${config.rootPath}`);
  console.log(`🎬 discovered ${config.appearances.length} appearance(s):`);
  config.appearances.forEach(a =>
    console.log(`   - ${a.name} (${a.files.length} frames, ${a.idles.length} idle pool${a.idles.length === 1 ? '' : 's'})`)
  );

  scenes = config.appearances.map(spec => {
    const s = new Scene(spec);
    s.preload();
    return s;
  });
}

// === Player ===
function playAnimation(anim, onComplete) {
  console.log(`▶ ${anim.name} (${anim.length} frames)`);
  playing = true;
  let idx = 0;
  let lastTime = performance.now();

  function tick(now) {
    if (!playing) return;
    if (now - lastTime >= FRAME_MS) {
      const frame = anim.frameAt(idx);
      if (frame && frame.src) catImg.src = frame.src;
      idx++;
      lastTime = now;
      if (idx >= anim.length) {
        playing = false;
        if (onComplete) onComplete();
        return;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function stopPlayback() { playing = false; }

function pickRandomScene() {
  const pool = scenes.filter(s => s.isUsable);
  if (pool.length === 0) return null;
  const totalW = pool.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * totalW;
  for (const s of pool) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return pool[0];
}

function loopRandomIdles(scene) {
  if (catImg.classList.contains('petted')) return;
  const idle = scene.pickRandomIdle();
  if (!idle) return;
  playAnimation(idle, () => {
    if (catImg.classList.contains('petted')) return;
    loopRandomIdles(scene);
  });
}

// === Click to pet ===
catImg.addEventListener('click', (e) => {
  e.stopPropagation();
  if (catImg.classList.contains('petted')) return;
  console.log('🐾 petted!');
  stopPlayback();
  catImg.classList.remove('idle');
  catImg.classList.add('petted');
  window.cat.petted();
});

// === IPC ===
function showCat() {
  console.log('🐈 showCat() called');
  if (scenes.length === 0) {
    console.error('No scenes loaded. Pick an assets folder via the menubar.');
    return;
  }
  const scene = pickRandomScene();
  if (!scene) {
    console.error('No usable scene — frames may still be loading or paths broken.');
    return;
  }
  const idleCount = scene.idles.filter(i => i.isUsable).length;
  console.log(`🎲 scene: ${scene.name} (${idleCount} idle${idleCount === 1 ? '' : 's'} in pool)`);

  catImg.classList.remove('petted', 'idle');
  if (scene.main.frameAt(0)) catImg.src = scene.main.frameAt(0).src;
  container.classList.remove('hidden');
  container.classList.add('visible');

  setTimeout(() => {
    playAnimation(scene.main, () => {
      if (idleCount > 0) {
        loopRandomIdles(scene);
      } else {
        if (scene.main.lastFrame) catImg.src = scene.main.lastFrame.src;
        catImg.classList.add('idle');
      }
    });
  }, 100);
}

function hideCat() {
  console.log('🐈 hideCat() called');
  stopPlayback();
  catImg.classList.remove('idle');
  // Trigger the same bounce/dissolve animation as a pet click
  catImg.classList.add('petted');
  container.classList.remove('visible');
  container.classList.add('hidden');
}

window.cat.onAppear(showCat);
window.cat.onDisappear(hideCat);

// Kick off
init();
