import { render } from 'solid-js/web';
import { For, Match, Show, Switch, createEffect, createResource, createSignal, on, onCleanup, onMount } from 'solid-js';
import { GalleryScene } from './scene.js';
import { bandFromUrl, defaultTheme, loadBand, loadBands } from './band.js';
import './style.css';

const website = 'https://dmytrobarylo.com';

// In-page links still open a new tab with a modifier key or the middle button.
const isPlainClick = (event) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Resolves once Instrument Serif is loaded. The font's stylesheet is imported from CSS, so until it
// arrives there is no face to load: fonts.load() then returns nothing, and so does fonts.ready.
// Gives up after about 5 s.
const serifLoaded = (async () => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const faces = await document.fonts.load('400 40px "Instrument Serif"').catch(() => []);
    if (faces.length) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
})();

// Bubble cursor (mouse only): a dot on the pointer (no lag). Over something interactive it grows a
// little, and once the pointer has rested for labelDelay it opens like a tooltip and says what a
// click will do (options.label). Moving more than restSlop pixels, or a change of action (say Next
// becoming Open after a click), hides the label and restarts the wait. Over a button or link (props
// from .button: the text buttons and the artists) it becomes a larger dot, and a white clone of the
// element, laid over it and clipped to the dot, shows it white inside the dot. The clone sits in one
// layer above the bubble, so it works inside the menu too, whose blur would trap a copy beneath it.
const labelDelay = 5000;
const restSlop = 3;
const buttonDot = 20;
const canBubble = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const cloneStyles = ['font', 'letterSpacing', 'textTransform', 'textDecoration', 'textUnderlineOffset', 'display', 'alignItems', 'justifyContent', 'justifyItems', 'gap', 'padding', 'whiteSpace', 'gridTemplateColumns'];
const contentRect = (element) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect();
};

function createBubble(options) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let bubble;
  let layer;
  const [over, setOver] = createSignal(false);
  const [shown, setShown] = createSignal(false);
  const [pressed, setPressed] = createSignal(false);
  const [tip, setTip] = createSignal({ text: '', shown: false });
  let tipTimer = 0;
  const rest = { x: 0, y: 0 };
  function armTip() {
    clearTimeout(tipTimer);
    setTip((current) => ({ ...current, shown: false }));
    if (options.label()) tipTimer = setTimeout(() => setTip({ text: options.label(), shown: Boolean(options.label()) }), labelDelay);
  }
  createEffect(on(options.label, armTip));
  const mouse = { x: 0, y: 0, clip: 0, raf: 0, left: 0, top: 0 };
  function follow() {
    bubble.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
    const clipTarget = over() ? buttonDot : 0;
    mouse.clip += (clipTarget - mouse.clip) * (reducedMotion ? 1 : 0.25);
    if (Math.abs(clipTarget - mouse.clip) < 0.1) mouse.clip = clipTarget;
    layer.style.clipPath = `circle(${mouse.clip}px at ${mouse.x - mouse.left}px ${mouse.y - mouse.top}px)`;
    mouse.raf = mouse.clip !== clipTarget ? requestAnimationFrame(follow) : 0;
  }
  function move(event) {
    if (!canBubble || event.pointerType !== 'mouse') return;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    if (Math.hypot(mouse.x - rest.x, mouse.y - rest.y) > restSlop) {
      rest.x = mouse.x;
      rest.y = mouse.y;
      armTip();
    }
    if (!shown()) setShown(true);
    if (!mouse.raf) mouse.raf = requestAnimationFrame(follow);
  }
  function enterButton(event) {
    if (!canBubble || event.pointerType !== 'mouse') return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const clone = element.cloneNode(true);
    clone.removeAttribute('id');
    for (const name of cloneStyles) clone.style[name] = style[name];
    // Inline boxes ignore translate (used below to line the clone up), and an inline-block would sit
    // on the layer's baseline.
    if (style.display === 'inline') clone.style.display = 'block';
    // Logo sizes come from the list or masthead around the element.
    for (const name of ['--logo-height', '--logo-max']) clone.style.setProperty(name, style.getPropertyValue(name));
    // A subgrid row (the artist list) has no grid around it in the layer, so it gets the list's
    // resolved columns.
    if (style.gridTemplateColumns.startsWith('subgrid')) {
      let grid = element.parentElement;
      while (grid && !/^\d/.test(getComputedStyle(grid).gridTemplateColumns)) grid = grid.parentElement;
      if (grid) Object.assign(clone.style, { gridTemplateColumns: getComputedStyle(grid).gridTemplateColumns, columnGap: getComputedStyle(grid).columnGap });
    }
    Object.assign(clone.style, {
      position: 'static', inset: 'auto', translate: 'none', transform: 'none', transition: 'none', opacity: '1', visibility: 'visible',
      margin: '0', width: '100%', height: '100%', boxSizing: 'border-box', color: '#fff', textDecorationColor: '#fff', pointerEvents: 'none',
    });
    layer.replaceChildren(clone);
    Object.assign(layer.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    // Inline text lays out its line box differently once it stands alone, so line the clone's
    // content up with the original's.
    const from = contentRect(clone);
    const to = contentRect(element);
    clone.style.translate = `${to.left - from.left}px ${to.top - from.top}px`;
    mouse.left = rect.left;
    mouse.top = rect.top;
    setOver(true);
  }
  function leaveButton() {
    setOver(false);
    setShown(false);
    if (!mouse.raf) mouse.raf = requestAnimationFrame(follow);
  }
  onCleanup(() => {
    clearTimeout(tipTimer);
    cancelAnimationFrame(mouse.raf);
  });
  return {
    over,
    move,
    hide: () => setShown(false),
    // For the surfaces the bubble moves over.
    surface: { onPointerMove: move, onPointerLeave: () => setShown(false), onPointerDown: () => setPressed(true), onPointerUp: () => setPressed(false) },
    // For text buttons and links.
    button: { onPointerMove: move, onPointerEnter: enterButton, onPointerLeave: leaveButton },
    view: () => (
      <>
        <div class="bubble" ref={bubble} aria-hidden="true">
          <span class="bubble-body" classList={{ 'is-shown': shown() && options.revealed(), 'is-active': Boolean(options.label()) && !over(), 'has-label': tip().shown && !over(), 'is-button': over(), 'is-pressed': pressed() }}>
            <span class="bubble-label">{tip().text}</span>
          </span>
        </div>
        <div class="bubble-copy" ref={layer} aria-hidden="true" />
      </>
    ),
  };
}

// Applies a theme: page colours as CSS variables, the browser bar colour and the title.
function applyTheme(theme, title) {
  const root = document.documentElement.style;
  root.setProperty('--bg', theme.background);
  root.setProperty('--bg-center', theme.backgroundCenter);
  root.setProperty('--bg-edge', theme.backgroundEdge);
  root.setProperty('--ink', theme.ink);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.background);
  document.title = title;
}

// A band's logo, drawn as a mask in the ink colour, or its name in capitals when it has none. CSS sizes
// it (.logo, .band-name): as tall as --logo-height, but no wider than --logo-max. The logo's
// proportions and the name's width in em are measured here; onReady fires once they are known.
function BandMark(props) {
  const [ratio, setRatio] = createSignal(0);
  const [ems, setEms] = createSignal(0);
  let name;
  onMount(() => {
    if (props.band.logo) {
      const logo = new Image();
      logo.onload = () => {
        setRatio(logo.naturalWidth / logo.naturalHeight);
        props.onReady?.();
      };
      logo.onerror = () => props.onReady?.();
      logo.src = props.band.logo;
    } else {
      // A name measured in the fallback font comes out too small.
      serifLoaded.then(() => {
        setEms(name.getBoundingClientRect().width / parseFloat(getComputedStyle(name).fontSize));
        props.onReady?.();
      });
    }
  });
  return (
    <Show when={props.band.logo} fallback={<span class="band-name" ref={name} style={{ '--name-ems': ems() || undefined }}>{props.band.name}</span>}>
      <span class="logo" role="img" aria-label={props.band.name} style={{ '--logo': `url("${props.band.logo}")`, '--logo-ratio': ratio() || 1 }} />
    </Show>
  );
}

// The artists on the title screen and in the menu: years, logo, album count. Links work as links (a
// new tab with a modifier key); a plain click switches in place. onReady fires once every logo has
// its size.
function ArtistList(props) {
  const onClick = (event, band) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    props.onSelect(band.folder);
  };
  let ready = 0;
  const markReady = () => {
    if (++ready === props.bands.length) props.onReady?.();
  };
  return (
    <ul class="artist-list">
      <For each={props.bands}>{(band) => (
        <li>
          <a class="artist" href={`?band=${band.folder}`} aria-current={band.folder === props.current ? 'page' : undefined} onClick={(event) => onClick(event, band)} {...props.bubble}>
            <span class="artist-years">{band.years[0]}–{band.years[1]}</span>
            <BandMark band={band} onReady={markReady} />
            <span class="artist-count">{band.albums.length} albums</span>
          </a>
        </li>
      )}</For>
    </ul>
  );
}

function Home(props) {
  const [ready, setReady] = createSignal(false);
  const cursor = createBubble({ label: () => '', revealed: ready });
  return (
    <main class="app-shell home" classList={{ 'has-bubble': canBubble }} {...cursor.surface}>
      <div class="home-body" classList={{ 'is-hidden': !ready() }}>
        <h1 class="home-wordmark">Discography</h1>
        <p class="home-intro">
          An experiment in browsing music as it came on CD: jewel cases you can flick through, turn
          over and open, with the real covers, discs and inserts.
        </p>
        <Show when={props.bands}>
          <ArtistList bands={props.bands} onSelect={props.onSelect} onReady={() => setReady(true)} bubble={cursor.button} />
        </Show>
      </div>
      <footer class="home-footer">
        Made by <a href={website} target="_blank" rel="noopener" {...cursor.button}>Dmytro Barylo</a>
      </footer>
      {cursor.view()}
    </main>
  );
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
  // The masthead waits until the band's logo has its size.
  const [markReady, setMarkReady] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [captionHidden, setCaptionHidden] = createSignal(false);
  const selected = () => albums[shown()];
  const pad = (value) => String(value).padStart(2, '0');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let captionTimer = 0;

  // What a click does, for the bubble cursor. In the menu, a click beside the list closes it.
  let menuButton;
  const [pointer, setPointer] = createSignal({ hovered: -1, active: 0, opened: -1, dragging: false });
  const bubbleLabel = () => {
    if (menuOpen()) return 'Close';
    const { hovered, active: front, opened, dragging } = pointer();
    // While a case is open, a click beside it closes it; over the case itself the bubble stays a
    // plain dot, keeping those clicks for the disc and booklet.
    if (opened >= 0) return hovered === opened ? '' : 'Close';
    if (dragging) return 'Drag';
    if (hovered < 0) return '';
    if (hovered === front) return 'Open';
    return hovered < front ? 'Prev' : 'Next';
  };
  const cursor = createBubble({ label: bubbleLabel, revealed });

  function goHome(event) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    props.onSelect(null);
  }

  // The menu lists the artists over the gallery. Keys go to it, not the scene, while it is open.
  function toggleMenu(open = !menuOpen()) {
    setMenuOpen(open);
    if (open) requestAnimationFrame(() => document.querySelector('.menu [aria-current], .menu .artist')?.focus());
    else menuButton?.focus({ preventScroll: true });
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
    if (menuOpen()) {
      if (event.key === 'Escape') toggleMenu(false);
      return;
    }
    // An open case keeps the row where it is; Space, Escape and Back close it.
    const browse = pointer().opened < 0;
    if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key) && !browse) { event.preventDefault(); return; }
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
    window.removeEventListener('keydown', onKeyDown);
    scene?.destroy();
  });

  return (
    <main class="app-shell">
      <div class="stage" classList={{ 'is-hidden': !revealed(), 'has-bubble': canBubble }} ref={stage} role="region" aria-label={`Interactive ${artist} album slider`} {...cursor.surface} />
      {/* Collaboration-style masthead: the site's wordmark (a link to the title screen), a thin cross,
          and the band's logo (or its name, for bands without one). */}
      <header class="masthead" classList={{ 'is-hidden': !revealed() || !markReady() }}>
        <a class="wordmark" classList={{ 'has-bubble': canBubble }} href="./" onClick={goHome} {...cursor.button}>Discography</a>
        <svg class="cross" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3 17 17M17 3 3 17" /></svg>
        <BandMark band={props.band} onReady={() => setMarkReady(true)} />
      </header>
      <button class="corner-button back-button" classList={{ 'is-shown': pointer().opened >= 0, 'has-bubble': canBubble }} type="button" onClick={() => scene?.close()} tabIndex={pointer().opened >= 0 ? 0 : -1} aria-hidden={pointer().opened < 0} {...cursor.button}>
        <span aria-hidden="true">←</span> Back
      </button>
      <nav class="menu" classList={{ 'is-open': menuOpen(), 'has-bubble': canBubble }} id="menu" aria-label="Artists" inert={menuOpen() ? undefined : true} onClick={(event) => event.target === event.currentTarget && toggleMenu(false)} {...cursor.surface}>
        <ArtistList bands={props.bands} current={props.band.folder} onSelect={(folder) => (folder === props.band.folder ? toggleMenu(false) : props.onSelect(folder))} bubble={cursor.button} />
        <a class="menu-home" href="./" onClick={goHome} {...cursor.button}>Home</a>
      </nav>
      <button class="corner-button menu-button" classList={{ 'is-shown': revealed(), 'has-bubble': canBubble }} type="button" ref={menuButton} onClick={() => toggleMenu()} aria-expanded={menuOpen()} aria-controls="menu" {...cursor.button}>
        {menuOpen() ? 'Close' : 'Menu'}
      </button>
      {cursor.view()}
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

// The title screen, or a band's gallery with ?band=<folder>. Switching keeps the page and pushes
// the URL, so the browser's back button returns to the previous artist or the title screen. The
// current view fades out, the next one is swapped in while the page is blank, and it fades in with
// its own animation: reversing a half-finished fade-out (the gallery can hold up the main thread)
// would make it abrupt.
function Root() {
  const [bands] = createResource(loadBands);
  const [view, setView] = createSignal(null);
  const [phase, setPhase] = createSignal('');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let viewElement;
  let request = 0;
  // Resolves when the fade-out has finished, or after a while if the transition never reports.
  const fadeOut = () => new Promise((resolve) => {
    const done = (event) => {
      if (event && (event.target !== viewElement || event.propertyName !== 'opacity')) return;
      clearTimeout(timer);
      viewElement.removeEventListener('transitionend', done);
      resolve();
    };
    const timer = setTimeout(done, 700);
    viewElement.addEventListener('transitionend', done);
    setPhase('leaving');
  });
  async function show(folder) {
    const current = ++request;
    const next = folder ? loadBand(folder).then((band) => ({ band }), (error) => ({ error: error.message })) : { home: true };
    const fade = Boolean(view()) && !reducedMotion;
    if (fade && phase() !== 'leaving') await fadeOut();
    const shown = await next;
    if (current !== request) return;
    if (shown.band) applyTheme(shown.band.theme, `Discography × ${shown.band.name}`);
    else applyTheme(defaultTheme, 'Discography');
    setView(shown);
    setPhase(fade ? 'entering' : '');
  }
  function select(folder) {
    const url = folder ? `?band=${folder}` : window.location.pathname;
    if (folder !== bandFromUrl()) window.history.pushState(null, '', url);
    show(folder);
  }
  const onPopState = () => show(bandFromUrl());
  window.addEventListener('popstate', onPopState);
  onCleanup(() => window.removeEventListener('popstate', onPopState));
  show(bandFromUrl());

  return (
    <div class="view" classList={{ 'is-leaving': phase() === 'leaving', 'is-entering': phase() === 'entering' }} ref={viewElement}
      onAnimationEnd={(event) => event.target === viewElement && setPhase('')}>
      <Switch>
        <Match when={view()?.band} keyed>{(band) => <App band={band} bands={bands()} onSelect={select} />}</Match>
        <Match when={view()?.home}><Home bands={bands()} onSelect={select} /></Match>
        <Match when={view()?.error}><p class="load-error">{view().error}</p></Match>
      </Switch>
    </div>
  );
}

const dispose = render(() => <Root />, document.getElementById('root'));
if (import.meta.hot) import.meta.hot.dispose(dispose);
