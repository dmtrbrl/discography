// Dev server only: slow motion for the scene's animations, and a readout of where the booklet is
// in its own (0 in the lid, 1 landed in the reader, with the matching time at normal speed), so a
// moment in it can be named exactly. Loaded from main.tsx behind import.meta.env.DEV. Shift+D shows
// and hides it, remembered in this browser; hidden by default, it stays out of the scripted checks'
// way (shown, it covered the Booklet button on landscape phones).
import type { GalleryScene } from './scene';

const SPEEDS = [1, 0.5, 0.25, 0.1, 0];

export function mountDevSpeed(scene: GalleryScene) {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:10000;display:flex;gap:4px;align-items:center;'
    + 'padding:6px 8px;border-radius:6px;background:rgba(0,0,0,0.75);color:#fff;font:12px/1.3 ui-monospace,Menlo,monospace';
  const buttons = SPEEDS.map((speed) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = speed ? `${speed}×` : 'pause';
    button.style.cssText = 'font:inherit;color:inherit;background:transparent;border:1px solid rgba(255,255,255,0.4);border-radius:4px;padding:2px 6px;cursor:pointer';
    button.addEventListener('click', () => {
      scene.timeScale = speed;
      mark();
    });
    panel.append(button);
    return button;
  });
  const readout = document.createElement('span');
  readout.style.cssText = 'min-width:21em;white-space:pre';
  panel.append(readout);
  // Keep presses and keys on the panel from reaching the scene and the page's shortcuts.
  for (const type of ['pointerdown', 'click', 'keydown'] as const) panel.addEventListener(type, (event) => event.stopPropagation());
  const shown = () => localStorage.getItem('devSpeed') === '1';
  const apply = () => { panel.style.display = shown() ? 'flex' : 'none'; };
  apply();
  const toggle = (event: KeyboardEvent) => {
    if (!event.shiftKey || event.code !== 'KeyD' || event.target instanceof HTMLInputElement) return;
    localStorage.setItem('devSpeed', shown() ? '0' : '1');
    apply();
    if (!shown()) {
      scene.timeScale = 1;
      mark();
    }
  };
  window.addEventListener('keydown', toggle);
  document.body.append(panel);

  function mark() {
    buttons.forEach((button, n) => { button.style.background = SPEEDS[n] === scene.timeScale ? 'rgba(255,255,255,0.3)' : 'transparent'; });
  }
  mark();

  let last = scene.read, direction = 'open', raf = 0;
  const update = () => {
    const t = scene.read;
    if (t !== last) direction = t > last ? 'open' : 'close';
    last = t;
    const { open, close } = scene.bookletDurations;
    // Coming out, 0 to 1 over `open`; going back, 1 to 0 over `close`.
    const seconds = direction === 'open' ? t * open : (1 - t) * close;
    readout.textContent = `booklet t ${t.toFixed(3)}  ${seconds.toFixed(2)} s of ${(direction === 'open' ? open : close).toFixed(1)} s (${direction})`;
    raf = requestAnimationFrame(update);
  };
  update();
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', toggle);
    panel.remove();
  };
}
