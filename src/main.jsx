import { render } from 'solid-js/web';
import { createEffect, createSignal, on, onCleanup, onMount } from 'solid-js';
import { GalleryScene } from './scene.js';
import { loadBand } from './band.js';
import './style.css';

// Applies a band's theme: page colours as CSS variables, the browser bar colour and the title.
function applyBand(band) {
  const root = document.documentElement.style;
  root.setProperty('--bg', band.theme.background);
  root.setProperty('--bg-center', band.theme.backgroundCenter);
  root.setProperty('--bg-edge', band.theme.backgroundEdge);
  root.setProperty('--ink', band.theme.ink);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', band.theme.background);
  document.title = `Discography × ${band.name}`;
}

function App(props) {
  const { albums, name: artist, theme } = props.band;
  let stage;
  let scene;
  const [active, setActive] = createSignal(0);
  const [loading, setLoading] = createSignal({ loaded: 0, total: albums.length });
  const [ready, setReady] = createSignal(false);
  const [revealed, setRevealed] = createSignal(false);
  // The caption shows its own index, so it can fade out on the old album before switching.
  const [shown, setShown] = createSignal(0);
  // The logo is drawn as a mask in the ink colour, so it needs its proportions from the image.
  const [logoRatio, setLogoRatio] = createSignal('');
  const [captionHidden, setCaptionHidden] = createSignal(false);
  const selected = () => albums[shown()];
  const pad = (value) => String(value).padStart(2, '0');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let captionTimer = 0;

  // Bubble cursor: a dot on the pointer (no lag). Over something interactive it grows a little,
  // and after labelDelay it opens like a tooltip and says what a click will do; a change of action
  // (say Next becoming Open after a click) hides the label and restarts the wait. Over the Back
  // button it becomes a larger dot, and a white copy of the button, clipped to the dot, shows the
  // text white inside it.
  let bubble;
  let backCopy;
  const [overBack, setOverBack] = createSignal(false);
  const canBubble = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const [pointer, setPointer] = createSignal({ hovered: -1, active: 0, opened: -1, dragging: false });
  const [bubbleShown, setBubbleShown] = createSignal(false);
  const [pressed, setPressed] = createSignal(false);
  const bubbleLabel = () => {
    const { hovered, active: front, opened, dragging } = pointer();
    // An open case is closed with the Back button, so the bubble stays a plain dot over it.
    if (opened >= 0) return '';
    if (dragging) return 'Drag';
    if (hovered < 0) return '';
    if (hovered === front) return 'Open';
    return hovered < front ? 'Prev' : 'Next';
  };
  const labelDelay = 500;
  const [tip, setTip] = createSignal({ text: '', shown: false });
  let tipTimer = 0;
  createEffect(on(bubbleLabel, (label) => {
    clearTimeout(tipTimer);
    setTip((current) => ({ ...current, shown: false }));
    if (label) tipTimer = setTimeout(() => setTip({ text: label, shown: true }), reducedMotion ? 0 : labelDelay);
  }));
  const backDot = 20;
  const mouse = { x: 0, y: 0, bx: 0, by: 0, clip: 0, raf: 0 };
  function followMouse() {
    mouse.bx = mouse.x;
    mouse.by = mouse.y;
    bubble.style.transform = `translate3d(${mouse.bx}px, ${mouse.by}px, 0)`;
    const clipTarget = overBack() ? backDot : 0;
    mouse.clip += (clipTarget - mouse.clip) * (reducedMotion ? 1 : 0.25);
    if (Math.abs(clipTarget - mouse.clip) < 0.1) mouse.clip = clipTarget;
    const rect = backCopy.getBoundingClientRect();
    backCopy.style.clipPath = `circle(${mouse.clip}px at ${mouse.bx - rect.left}px ${mouse.by - rect.top}px)`;
    mouse.raf = mouse.clip !== clipTarget ? requestAnimationFrame(followMouse) : 0;
  }
  function onStageMove(event) {
    if (!canBubble || event.pointerType !== 'mouse') return;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    if (!bubbleShown()) {
      mouse.bx = mouse.x;
      mouse.by = mouse.y;
      setBubbleShown(true);
    }
    if (!mouse.raf) mouse.raf = requestAnimationFrame(followMouse);
  }

  // Fades the caption out, swaps in the new album, and fades it back in. Moves through several
  // albums in a row keep it hidden until they settle.
  createEffect(on(active, (index) => {
    clearTimeout(captionTimer);
    if (reducedMotion || !revealed()) {
      setShown(index);
      return;
    }
    setCaptionHidden(true);
    captionTimer = setTimeout(() => {
      setShown(index);
      setCaptionHidden(false);
    }, 220);
  }, { defer: true }));

  // The scene owns the motion and reports the case in front back through setActive.
  function onKeyDown(event) {
    if (event.altKey || event.metaKey || event.ctrlKey || !scene) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); scene.step(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); scene.step(-1); }
    if (event.key === 'Home') { event.preventDefault(); scene.goTo(0, 'key'); }
    if (event.key === 'End') { event.preventDefault(); scene.goTo(albums.length - 1, 'key'); }
    if (event.key === ' ' && !event.target.closest?.('button, input, textarea, select')) { event.preventDefault(); scene.toggle(); }
    if (event.key === 'Escape') scene.close();
  }

  // The loading screen fades out first; only then does the gallery fade in and play its intro.
  function reveal() {
    if (revealed()) return;
    setRevealed(true);
    scene?.reveal();
  }

  function onPreloaderFaded(event) {
    if (event.target === event.currentTarget && event.propertyName === 'opacity') reveal();
  }

  onMount(() => {
    const logo = new Image();
    logo.onload = () => setLogoRatio(`${logo.naturalWidth} / ${logo.naturalHeight}`);
    logo.src = props.band.logo;
    scene = new GalleryScene(stage, albums, (index) => setActive(index), {
      fogColor: theme.background,
      onProgress: (loaded, total) => setLoading({ loaded, total }),
      onPointer: setPointer,
      onReady: () => {
        setReady(true);
        // Without the fade there is no transitionend to wait for.
        if (reducedMotion) reveal();
      },
    });
    window.addEventListener('keydown', onKeyDown);
  });
  onCleanup(() => {
    clearTimeout(captionTimer);
    clearTimeout(tipTimer);
    cancelAnimationFrame(mouse.raf);
    window.removeEventListener('keydown', onKeyDown);
    scene?.destroy();
  });

  return (
    <main class="app-shell">
      <div class="grain" aria-hidden="true" />
      <div class="stage" classList={{ 'is-hidden': !revealed(), 'has-bubble': canBubble }} ref={stage} role="region" aria-label={`Interactive ${artist} album slider`}
        onPointerMove={onStageMove} onPointerLeave={() => setBubbleShown(false)} onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} />
      <div class="bubble" ref={bubble} aria-hidden="true">
        <span class="bubble-body" classList={{ 'is-shown': bubbleShown() && revealed(), 'is-active': Boolean(bubbleLabel()) && !overBack(), 'has-label': tip().shown && !overBack(), 'is-back': overBack(), 'is-pressed': pressed() }}>
          <span class="bubble-label">{tip().text}</span>
        </span>
      </div>
      {/* Collaboration-style masthead: the site's wordmark, a thin cross, and the band's logo. */}
      <header class="masthead" classList={{ 'is-hidden': !revealed() || !logoRatio() }} role="img" aria-label={`Discography × ${artist}`}>
        <span class="wordmark" aria-hidden="true">Discography</span>
        <svg class="cross" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3 17 17M17 3 3 17" /></svg>
        <span class="logo" aria-hidden="true" style={{ '--logo': `url("${props.band.logo}")`, 'aspect-ratio': logoRatio() }} />
      </header>
      <button class="back-button" classList={{ 'is-shown': pointer().opened >= 0, 'has-bubble': canBubble }} type="button" onClick={() => scene?.close()} tabIndex={pointer().opened >= 0 ? 0 : -1} aria-hidden={pointer().opened < 0}
        onPointerMove={onStageMove} onPointerEnter={(event) => event.pointerType === 'mouse' && setOverBack(true)}
        onPointerLeave={() => { setOverBack(false); setBubbleShown(false); if (!mouse.raf) mouse.raf = requestAnimationFrame(followMouse); }}>
        <span aria-hidden="true">←</span> Back
      </button>
      <div class="back-button back-copy" classList={{ 'is-shown': pointer().opened >= 0 }} ref={backCopy} aria-hidden="true"><span>←</span> Back</div>
      <div class="preloader" classList={{ 'is-done': ready() }} role="status" aria-hidden={ready()} onTransitionEnd={onPreloaderFaded}>
        <span class="preloader-label">Loading <strong>{pad(loading().loaded)}</strong> / {pad(loading().total)}</span>
        <span class="preloader-track"><span class="preloader-fill" style={{ transform: `scaleX(${loading().total ? loading().loaded / loading().total : 1})` }} /></span>
      </div>
      <footer class="bottom-bar" classList={{ 'is-hidden': !revealed() }}>
        <div class="album-caption" classList={{ 'is-switching': captionHidden() }} aria-live="polite">
          <div class="eyebrow">{selected().year}<span class="eyebrow-separator">/</span>{selected().kind}</div>
          <h1>{selected().title}</h1>
        </div>
        {/* Visible navigation is the bubble cursor, the keys and the wheel; these stay for screen readers. */}
        <div class="sr-only">
          <button type="button" onClick={() => scene?.step(-1)} disabled={active() === 0}>Previous album</button>
          <button type="button" onClick={() => scene?.step(1)} disabled={active() === albums.length - 1}>Next album</button>
        </div>
      </footer>
    </main>
  );
}

const root = document.getElementById('root');
let dispose;
loadBand().then((band) => {
  applyBand(band);
  dispose = render(() => <App band={band} />, root);
}).catch((error) => {
  root.innerHTML = '<p class="load-error"></p>';
  root.firstChild.textContent = error.message;
});
if (import.meta.hot) import.meta.hot.dispose(() => dispose?.());
