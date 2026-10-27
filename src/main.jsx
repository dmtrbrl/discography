import { render } from 'solid-js/web';
import { createEffect, createSignal, on, onCleanup, onMount } from 'solid-js';
import { GalleryScene } from './scene.js';
import { albums, artist } from './data.js';
import logo from './nirvana-logo.svg?raw';
import './style.css';

function App() {
  let stage;
  let scene;
  const [active, setActive] = createSignal(0);
  const [loading, setLoading] = createSignal({ loaded: 0, total: albums.length });
  const [ready, setReady] = createSignal(false);
  const [revealed, setRevealed] = createSignal(false);
  // The caption shows its own index, so it can fade out on the old album before switching.
  const [shown, setShown] = createSignal(0);
  const [captionHidden, setCaptionHidden] = createSignal(false);
  const selected = () => albums[shown()];
  const pad = (value) => String(value).padStart(2, '0');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let captionTimer = 0;

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
    scene = new GalleryScene(stage, albums, (index) => setActive(index), {
      onProgress: (loaded, total) => setLoading({ loaded, total }),
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
    window.removeEventListener('keydown', onKeyDown);
    scene?.destroy();
  });

  return (
    <main class="app-shell">
      <div class="grain" aria-hidden="true" />
      <div class="stage" classList={{ 'is-hidden': !revealed() }} ref={stage} role="region" aria-label={`Interactive ${artist} album slider`} />
      <header class="logo" classList={{ 'is-hidden': !revealed() }} role="img" aria-label={artist} innerHTML={logo} />
      <div class="preloader" classList={{ 'is-done': ready() }} role="status" aria-hidden={ready()} onTransitionEnd={onPreloaderFaded}>
        <span class="preloader-label">Loading <strong>{pad(loading().loaded)}</strong> / {pad(loading().total)}</span>
        <span class="preloader-track"><span class="preloader-fill" style={{ transform: `scaleX(${loading().total ? loading().loaded / loading().total : 1})` }} /></span>
      </div>
      <footer class="bottom-bar" classList={{ 'is-hidden': !revealed() }}>
        <div class="album-caption" classList={{ 'is-switching': captionHidden() }} aria-live="polite">
          <div class="eyebrow">{selected().year} <span class="eyebrow-separator">/</span> {selected().kind}</div>
          <h1>{selected().title}</h1>
        </div>
        <div class="controls" aria-label="Slider controls">
          <button class="nav-button" type="button" onClick={() => scene?.step(-1)} disabled={active() === 0} aria-label="Previous album">←</button>
          <span class="counter"><strong>{pad(active() + 1)}</strong><span class="counter-rule" />{pad(albums.length)}</span>
          <button class="nav-button" type="button" onClick={() => scene?.step(1)} disabled={active() === albums.length - 1} aria-label="Next album">→</button>
        </div>
      </footer>
    </main>
  );
}

const dispose = render(() => <App />, document.getElementById('root'));
if (import.meta.hot) import.meta.hot.dispose(dispose);
