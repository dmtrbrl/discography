import { render } from 'solid-js/web';
import { createSignal, onCleanup, onMount } from 'solid-js';
import { DiscScene } from './scene.js';
import { albums, artist } from './data.js';
import './style.css';

function App() {
  let stage;
  let scene;
  const [active, setActive] = createSignal(0);
  const [loading, setLoading] = createSignal({ loaded: 0, total: albums.length });
  const [ready, setReady] = createSignal(false);
  const selected = () => albums[active()];
  const pad = (value) => String(value).padStart(2, '0');

  // The scene owns the motion and reports the disc in front back through setActive.
  function onKeyDown(event) {
    if (event.altKey || event.metaKey || event.ctrlKey || !scene) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); scene.step(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); scene.step(-1); }
    if (event.key === 'Home') { event.preventDefault(); scene.goTo(0, 'key'); }
    if (event.key === 'End') { event.preventDefault(); scene.goTo(albums.length - 1, 'key'); }
    if (event.key === ' ' && !event.target.closest?.('button, input, textarea, select')) { event.preventDefault(); scene.flip(); }
  }

  onMount(() => {
    scene = new DiscScene(stage, albums, (index) => setActive(index), {
      onProgress: (loaded, total) => setLoading({ loaded, total }),
      onReady: () => setReady(true),
    });
    window.addEventListener('keydown', onKeyDown);
  });
  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown);
    scene?.destroy();
  });

  return (
    <main class="app-shell">
      <div class="grain" aria-hidden="true" />
      <div class="stage" ref={stage} role="region" aria-label="Interactive Nirvana album slider" />
      <div class="preloader" classList={{ 'is-done': ready() }} role="status" aria-hidden={ready()}>
        <span class="preloader-label">Loading <strong>{pad(loading().loaded)}</strong> / {pad(loading().total)}</span>
        <span class="preloader-track"><span class="preloader-fill" style={{ transform: `scaleX(${loading().total ? loading().loaded / loading().total : 1})` }} /></span>
      </div>
      <footer class="bottom-bar" classList={{ 'is-hidden': !ready() }}>
        <div class="album-caption" aria-live="polite">
          <div class="eyebrow">{artist} <span class="eyebrow-separator">/</span> {selected().year} <span class="eyebrow-separator">/</span> {selected().kind}</div>
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
