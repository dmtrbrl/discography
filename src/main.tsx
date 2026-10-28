import { render } from 'solid-js/web';
import { For, Match, Show, Switch, createEffect, createResource, createSignal, on, onCleanup, onMount } from 'solid-js';
import type { Accessor } from 'solid-js';
import { GalleryScene } from './scene';
import type { PointerState } from './scene';
import { albumFromUrl, bandFromUrl, defaultTheme, galleryUrl, loadBand, loadBands } from './band';
import type { Band, Theme } from './band';
import './style.css';

const website = 'https://dmytrobarylo.com';
const repository = 'https://github.com/dmtrbrl/discography';

// In-page links still open a new tab with a modifier key or the middle button.
const isPlainClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Resolves once Instrument Serif is loaded. The font's stylesheet is imported from CSS, so until it
// arrives there is no face to load: fonts.load() then returns nothing, and so does fonts.ready.
// Gives up after about 5 s.
const serifLoaded = (async () => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const faces = await document.fonts.load('400 40px "Instrument Serif"').catch((): FontFace[] => []);
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
const labelDelay = 3000;
const restSlop = 3;
const buttonDot = 20;
const canBubble = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const cloneStyles = ['font', 'letterSpacing', 'textTransform', 'textDecoration', 'textUnderlineOffset', 'display', 'alignItems', 'justifyContent', 'justifyItems', 'gap', 'padding', 'whiteSpace', 'gridTemplateColumns'] as const;
const contentRect = (element: Node) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect();
};

interface BubbleOptions {
  // What a click will do, shown as the label; empty for none.
  label: Accessor<string>;
  // Whether the page is showing yet.
  revealed: Accessor<boolean>;
}

// Event handlers for the surfaces the bubble moves over, and for text buttons and links.
interface SurfaceProps {
  onPointerMove: (event: PointerEvent) => void;
  onPointerEnter: (event: PointerEvent) => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
  onPointerUp: () => void;
}
interface ButtonProps {
  'data-bubble': string;
  onPointerMove: (event: PointerEvent) => void;
  onPointerEnter: (event: PointerEvent) => void;
  onPointerLeave: () => void;
}

function createBubble(options: BubbleOptions) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let bubble!: HTMLDivElement;
  let layer!: HTMLDivElement;
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
  function move(event: PointerEvent) {
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
  // The element whose clone is shown, and what it looked like when cloned.
  let target: HTMLElement | null = null;
  let cloned = '';
  const signature = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return [element.className, element.textContent, element.getAttribute('aria-current'), rect.left, rect.top, rect.width, rect.height].join('|');
  };
  function showClone(element: HTMLElement) {
    target = element;
    cloned = signature(element);
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const clone = element.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.removeAttribute('data-bubble');
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
    setShown(true);
    if (!mouse.raf) mouse.raf = requestAnimationFrame(follow);
  }
  function enterButton(event: PointerEvent) {
    const element = event.currentTarget as HTMLElement;
    if (canBubble && event.pointerType === 'mouse' && !(element as HTMLButtonElement).disabled) showClone(element);
  }
  // Leaving by moving hides the bubble until the next move over a surface; leaving because the
  // element went away keeps the dot where the pointer is.
  function leaveButton(hide = true) {
    target = null;
    setOver(false);
    if (hide) setShown(false);
    if (!mouse.raf) mouse.raf = requestAnimationFrame(follow);
  }
  // A click or a key can change or remove the element under a still pointer, with no pointer event
  // to say so: Menu becomes Close, Back hides as the case closes, the menu closes under an artist.
  // For a moment afterwards, check every frame what is under the pointer: drop the clone if the
  // element is gone, inactive (disabled, inert, aria-hidden) or still fading in, redraw it if the
  // element changed, or move to another button now under the pointer.
  const usable = (element: HTMLElement | null | undefined): element is HTMLElement => Boolean(element?.isConnected) && !(element as HTMLButtonElement).disabled
    && !element!.closest('[inert], [aria-hidden="true"]') && Number(getComputedStyle(element!).opacity) > 0.5;
  let recheckUntil = 0;
  let recheckRaf = 0;
  function recheck() {
    recheckRaf = 0;
    if (target || shown()) {
      const hit = document.elementFromPoint(mouse.x, mouse.y)?.closest<HTMLElement>('[data-bubble]');
      const next = usable(hit) ? hit : null;
      if (next !== target) {
        if (next) showClone(next);
        else leaveButton(false);
      } else if (target && signature(target) !== cloned) {
        showClone(target);
      }
    }
    if (performance.now() < recheckUntil) recheckRaf = requestAnimationFrame(recheck);
  }
  function watch() {
    if (!canBubble) return;
    recheckUntil = performance.now() + 1000;
    if (!recheckRaf) recheckRaf = requestAnimationFrame(recheck);
  }
  window.addEventListener('click', watch, true);
  window.addEventListener('keydown', watch, true);
  onCleanup(() => {
    clearTimeout(tipTimer);
    cancelAnimationFrame(mouse.raf);
    cancelAnimationFrame(recheckRaf);
    window.removeEventListener('click', watch, true);
    window.removeEventListener('keydown', watch, true);
  });
  return {
    over,
    move,
    hide: () => setShown(false),
    // For the surfaces the bubble moves over.
    // Entering counts as moving: a surface can come out from under a still pointer (a menu closing).
    surface: { onPointerMove: move, onPointerEnter: move, onPointerLeave: () => setShown(false), onPointerDown: () => setPressed(true), onPointerUp: () => setPressed(false) } satisfies SurfaceProps,
    // For text buttons and links.
    button: { 'data-bubble': '', onPointerMove: move, onPointerEnter: enterButton, onPointerLeave: () => leaveButton() } satisfies ButtonProps as ButtonProps,
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
function applyTheme(theme: Theme, title: string) {
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
function BandMark(props: { band: Band; onReady?: () => void }) {
  const [ratio, setRatio] = createSignal(0);
  const [ems, setEms] = createSignal(0);
  let name!: HTMLSpanElement;
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
      <span class="logo" role="img" aria-label={props.band.name} style={{ '--logo': `url("${props.band.logo}")`, '--logo-ratio': ratio() || 1, '--logo-scale': props.band.logoScale }} />
    </Show>
  );
}

// The artists on the title screen and in the menu: years, logo, album count. Links work as links (a
// new tab with a modifier key); a plain click switches in place. onReady fires once every logo has
// its size.
function ArtistList(props: { bands: Band[] | undefined; current?: string; onSelect: (folder: string) => void; onReady?: () => void; bubble?: ButtonProps }) {
  const onClick = (event: MouseEvent, band: Band) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    props.onSelect(band.folder);
  };
  let ready = 0;
  const markReady = () => {
    if (++ready === props.bands?.length) props.onReady?.();
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

// Switching view: a band's folder, or null for the title screen.
type Select = (folder: string | null) => void;

function Home(props: { bands: Band[] | undefined; onSelect: Select }) {
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
        <span>Made by <a href={website} target="_blank" rel="noopener" {...cursor.button}>Dmytro Barylo</a></span>
        <a href={repository} target="_blank" rel="noopener" {...cursor.button}>Source on GitHub</a>
      </footer>
      {cursor.view()}
    </main>
  );
}

function App(props: { band: Band; bands: Band[] | undefined; onSelect: Select }) {
  const { albums, name: artist, theme } = props.band;
  let stage!: HTMLDivElement;
  let scene: GalleryScene | undefined;
  // A link can name the album in front and ask for it open; an unknown album starts at the first.
  const linked = albumFromUrl();
  const startIndex = Math.max(0, albums.findIndex((album) => album.id === linked.album));
  const [active, setActive] = createSignal(startIndex);
  const [loading, setLoading] = createSignal({ loaded: 0, total: albums.length });
  const [ready, setReady] = createSignal(false);
  const [revealed, setRevealed] = createSignal(false);
  // The caption shows its own index, so it can fade out on the old album before switching.
  const [shown, setShown] = createSignal(startIndex);
  // The masthead waits until the band's logo has its size.
  const [markReady, setMarkReady] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [captionHidden, setCaptionHidden] = createSignal(false);
  const selected = () => albums[shown()];
  const pad = (value: number) => String(value).padStart(2, '0');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let captionTimer = 0;

  // What a click does, for the bubble cursor. In the menu, a click beside the list closes it.
  let menuButton!: HTMLButtonElement;
  const [pointer, setPointer] = createSignal<PointerState>({ hovered: -1, active: 0, opened: -1, dragging: false });
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

  function goHome(event: MouseEvent) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    props.onSelect(null);
  }

  // The menu lists the artists over the gallery. Keys go to it, not the scene, while it is open.
  function toggleMenu(open = !menuOpen()) {
    setMenuOpen(open);
    if (open) requestAnimationFrame(() => document.querySelector<HTMLElement>('.menu [aria-current], .menu .artist')?.focus());
    else menuButton.focus({ preventScroll: true });
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

  // Keeps the URL on the album in front and whether it is open, replacing the history entry, so the
  // browser's back button still goes to the previous artist or the title screen. Only while the URL
  // is still this band's: a gallery fading out mustn't overwrite the next one's address.
  createEffect(() => {
    const url = galleryUrl(props.band.folder, albums[active()]?.id, pointer().opened >= 0);
    if (!revealed() || bandFromUrl() !== props.band.folder || window.location.search === url) return;
    window.history.replaceState(window.history.state, '', url);
  });

  // The scene owns the motion and reports the case in front back through setActive.
  function onKeyDown(event: KeyboardEvent) {
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
    if (event.key === ' ' && !(event.target as Element | null)?.closest?.('button, input, textarea, select')) { event.preventDefault(); scene.toggle(); }
    if (event.key === 'Escape') scene.close();
  }

  // The loading screen fades out first; only then does the gallery fade in and play its intro.
  function reveal() {
    if (revealed()) return;
    setRevealed(true);
    scene?.reveal();
  }

  function onPreloaderFaded(event: TransitionEvent) {
    if (event.target === event.currentTarget && event.propertyName === 'opacity') reveal();
  }

  onMount(() => {
    scene = new GalleryScene(stage, albums, (index) => setActive(index), {
      fogColor: theme.background,
      startIndex,
      openOnReveal: linked.open && albums[startIndex]?.id === linked.album,
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
      {/* The caption, with arrows to the previous and next album level with it. The arrows hide while a
          case is open, which keeps the row where it is. */}
      <footer class="bottom-bar" classList={{ 'is-hidden': !revealed() }}>
        <button class="album-arrow is-prev" classList={{ 'is-shown': pointer().opened < 0, 'has-bubble': canBubble }} type="button" aria-label="Previous album"
          disabled={active() === 0} inert={pointer().opened < 0 ? undefined : true} onClick={() => scene?.step(-1)} {...cursor.button}>←</button>
        <div class="album-caption" classList={{ 'is-switching': captionHidden() }} aria-live="polite">
          <div class="eyebrow">{selected().year}<span class="eyebrow-separator">/</span>{selected().kind}</div>
          <h1>{selected().title}</h1>
        </div>
        <button class="album-arrow is-next" classList={{ 'is-shown': pointer().opened < 0, 'has-bubble': canBubble }} type="button" aria-label="Next album"
          disabled={active() === albums.length - 1} inert={pointer().opened < 0 ? undefined : true} onClick={() => scene?.step(1)} {...cursor.button}>→</button>
      </footer>
    </main>
  );
}

// The title screen, or a band's gallery with ?band=<folder>. Switching keeps the page and pushes
// the URL, so the browser's back button returns to the previous artist or the title screen.
// A curtain drawn like the page background fades in over the current view, the next view is swapped
// in under it, and it fades out. The views themselves never change opacity: an ancestor's opacity
// cuts off the menu's backdrop blur at once, so the menu dropped out ahead of the fade.
// What Root shows: a band's gallery, the title screen, or why a band couldn't load.
interface View {
  band?: Band;
  home?: boolean;
  error?: string;
}

function Root() {
  const [bands] = createResource(loadBands);
  const [view, setView] = createSignal<View | null>(null);
  const [covered, setCovered] = createSignal(false);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let curtain!: HTMLDivElement;
  let request = 0;
  // Resolves when the curtain is fully in, or after a while if the transition never reports.
  const cover = () => new Promise<void>((resolve) => {
    const done = (event?: TransitionEvent) => {
      if (event && (event.target !== curtain || event.propertyName !== 'opacity')) return;
      clearTimeout(timer);
      curtain.removeEventListener('transitionend', done);
      resolve();
    };
    const timer = setTimeout(done, 700);
    curtain.addEventListener('transitionend', done);
    setCovered(true);
  });
  async function show(folder: string | null) {
    const current = ++request;
    const next: View | Promise<View> = folder
      ? loadBand(folder).then((band) => ({ band }), (error: Error) => ({ error: error.message }))
      : { home: true };
    if (view() && !reducedMotion && !covered()) await cover();
    const shown = await next;
    if (current !== request) return;
    if (shown.band) applyTheme(shown.band.theme, `Discography × ${shown.band.name}`);
    else applyTheme(defaultTheme, 'Discography');
    setView(shown);
    setCovered(false);
  }
  function select(folder: string | null) {
    const url = folder ? galleryUrl(folder) : window.location.pathname;
    if (folder !== bandFromUrl()) window.history.pushState(null, '', url);
    show(folder);
  }
  const onPopState = () => show(bandFromUrl());
  window.addEventListener('popstate', onPopState);
  onCleanup(() => window.removeEventListener('popstate', onPopState));
  show(bandFromUrl());

  return (
    <>
      <Switch>
        <Match when={view()?.band} keyed>{(band) => <App band={band} bands={bands()} onSelect={select} />}</Match>
        <Match when={view()?.home}><Home bands={bands()} onSelect={select} /></Match>
        <Match when={view()?.error} keyed>{(error) => <p class="load-error">{error}</p>}</Match>
      </Switch>
      <div class="curtain" classList={{ 'is-covering': covered() }} ref={curtain} aria-hidden="true" />
    </>
  );
}

const dispose = render(() => <Root />, document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.dispose(dispose);
