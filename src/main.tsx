import { render } from 'solid-js/web';
import { For, Match, Show, Switch, createEffect, createMemo, createResource, createSignal, on, onCleanup, onMount } from 'solid-js';
import type { Accessor } from 'solid-js';
import { GalleryScene } from './scene';
import type { PointerState } from './scene';
import { albumFromUrl, bandFromUrl, defaultTheme, galleryUrl, loadBand, loadBands } from './band';
import type { Album, Band, Theme, Track } from './band';
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
const cloneStyles = ['font', 'letterSpacing', 'textTransform', 'textDecoration', 'textUnderlineOffset', 'display', 'alignItems', 'justifyContent', 'justifyItems', 'gap', 'padding', 'whiteSpace'] as const;
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
  // A memo, so the wait restarts only when the label changes, not on every change of what it's
  // derived from.
  const label = createMemo(options.label);
  // No label while something shows a keyboard focus ring: the keyboard is in use, and a tooltip by
  // the mouse would compete with it. A label already open closes when a ring appears.
  const keyboardFocus = () => Boolean(document.querySelector(':focus-visible'));
  function armTip() {
    clearTimeout(tipTimer);
    setTip((current) => ({ ...current, shown: false }));
    if (label()) tipTimer = setTimeout(() => setTip({ text: label(), shown: Boolean(label()) && !keyboardFocus() }), labelDelay);
  }
  createEffect(on(label, armTip));
  // After the focus moves or a key is pressed, the ring has settled by the next frame.
  const closeTipForFocus = () => requestAnimationFrame(() => {
    if (keyboardFocus()) setTip((current) => ({ ...current, shown: false }));
  });
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
  let clonedBox = '';
  const box = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return [rect.left, rect.top, rect.width, rect.height].join('|');
  };
  const signature = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return [element.className, element.textContent, element.getAttribute('aria-current'), element.getAttribute('aria-label'), rect.left, rect.top, rect.width, rect.height].join('|');
  };
  function showClone(element: HTMLElement) {
    target = element;
    cloned = signature(element);
    clonedBox = box(element);
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const clone = element.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.removeAttribute('data-bubble');
    for (const name of cloneStyles) clone.style[name] = style[name];
    // Inline boxes ignore translate (used below to line the clone up), and an inline-block would sit
    // on the layer's baseline.
    if (style.display === 'inline') clone.style.display = 'block';
    // Logo sizes and the artist rows' spacing come from the list or masthead around the element.
    for (const name of ['--logo-height', '--logo-max', '--meta-gap']) clone.style.setProperty(name, style.getPropertyValue(name));
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
        if (box(target) === clonedBox && syncClone(target)) cloned = signature(target);
        else showClone(target);
      }
    }
    if (performance.now() < recheckUntil) recheckRaf = requestAnimationFrame(recheck);
  }
  // When only the state of the element changed (its classes, at the same size and with the same
  // words, as when Menu turns to Close), update the clone in place rather than rebuilding it, so its
  // own transitions run inside the dot as they do on the page. Returns false if it needs a rebuild.
  function syncClone(element: HTMLElement) {
    const clone = layer.firstElementChild;
    if (!clone || clone.textContent !== element.textContent) return false;
    const from = element.querySelectorAll('*');
    const to = clone.querySelectorAll('*');
    if (from.length !== to.length) return false;
    from.forEach((node, index) => {
      const classes = node.getAttribute('class') ?? '';
      if (to[index].getAttribute('class') !== classes) to[index].setAttribute('class', classes);
    });
    return true;
  }
  function watch() {
    if (!canBubble) return;
    recheckUntil = performance.now() + 1000;
    if (!recheckRaf) recheckRaf = requestAnimationFrame(recheck);
  }
  window.addEventListener('click', watch, true);
  window.addEventListener('keydown', watch, true);
  window.addEventListener('keydown', closeTipForFocus, true);
  document.addEventListener('focusin', closeTipForFocus);
  onCleanup(() => {
    clearTimeout(tipTimer);
    cancelAnimationFrame(mouse.raf);
    cancelAnimationFrame(recheckRaf);
    window.removeEventListener('click', watch, true);
    window.removeEventListener('keydown', watch, true);
    window.removeEventListener('keydown', closeTipForFocus, true);
    document.removeEventListener('focusin', closeTipForFocus);
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
          <span class="bubble-body" classList={{ 'is-shown': shown() && options.revealed(), 'is-active': Boolean(label()) && !over(), 'has-label': tip().shown && !over(), 'is-button': over(), 'is-pressed': pressed() }}>
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

// 30-second previews from Apple Music: one lookup per album gives every track's preview URL, keyed
// by the Apple track IDs that scripts/fetch-tracks.mjs stored. Preview URLs aren't kept in band.json
// since Apple may change them. Each album is fetched once a visit.
const previews = new Map<number, Promise<Map<number, string>>>();

function loadPreviews(collection: number) {
  let loading = previews.get(collection);
  if (!loading) {
    loading = fetch(`https://itunes.apple.com/lookup?id=${collection}&entity=song&limit=200&country=us`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${response.status}`))))
      .then(({ results }: { results: { wrapperType: string; trackId?: number; previewUrl?: string }[] }) =>
        new Map(results.filter((result) => result.trackId && result.previewUrl).map((result) => [result.trackId!, result.previewUrl!])));
    loading.catch(() => previews.delete(collection));
    previews.set(collection, loading);
  }
  return loading;
}

const duration = (seconds?: number) => (seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '');

// What the page can do with the tracklist from the keyboard.
interface TracklistControls { toggle(): void; focus(): void }

// The player view's tracklist, right of the player (below it on narrow screens). A click on a track
// plays its preview, a second click pauses it, and the next track follows when one ends. Tracks
// Apple has no preview for are listed but can't be played. Below the list: the album on Apple
// Music, and where to buy the CD (the artist's shop when band.json names one, otherwise an Amazon
// search). Playing and pausing spin and stop the disc (onPlaying); the display follows the track
// and time (onDisplay). Hiding the list stops the music.
function Tracklist(props: {
  album: Album; shown: boolean; bubble: ButtonProps; controls: (controls: TracklistControls) => void;
  onPlaying: (playing: boolean) => void; onDisplay: (track: number | null, seconds: number) => void;
}) {
  const audio = new Audio();
  audio.preload = 'none';
  const [current, setCurrent] = createSignal(-1);
  const [state, setState] = createSignal<'stopped' | 'loading' | 'playing' | 'paused'>('stopped');
  const [progress, setProgress] = createSignal(0);
  const [failed, setFailed] = createSignal(false);
  const tracks = () => props.album.tracks ?? [];
  let list!: HTMLOListElement;
  let request = 0;
  let second = -1;

  function stop() {
    request++;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setCurrent(-1);
    setState('stopped');
    setProgress(0);
    second = -1;
    props.onPlaying(false);
    props.onDisplay(null, 0);
  }

  async function play(index: number) {
    const track = tracks()[index];
    if (!track?.apple || !props.album.appleMusic) return;
    if (index === current() && state() !== 'stopped') {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    const ticket = ++request;
    audio.pause();
    setCurrent(index);
    setState('loading');
    setProgress(0);
    second = -1;
    props.onDisplay(index + 1, 0);
    const urls = await loadPreviews(props.album.appleMusic).catch(() => null);
    if (ticket !== request) return;
    const url = urls?.get(track.apple);
    if (!url) {
      setFailed(!urls);
      stop();
      return;
    }
    setFailed(false);
    audio.src = url;
    audio.play().catch(() => {
      if (ticket === request) stop();
    });
  }

  // The next track with a preview after `index`, or -1.
  const nextTrack = (index: number) => tracks().findIndex((track, n) => n > index && track.apple);

  audio.addEventListener('playing', () => {
    setState('playing');
    props.onPlaying(true);
  });
  audio.addEventListener('pause', () => {
    if (audio.ended || state() === 'stopped' || !audio.src) return;
    setState('paused');
    props.onPlaying(false);
  });
  audio.addEventListener('ended', () => {
    const next = nextTrack(current());
    if (next >= 0) play(next);
    else stop();
  });
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    setProgress(audio.currentTime / audio.duration);
    const now = Math.floor(audio.currentTime);
    if (now === second) return;
    second = now;
    props.onDisplay(current() + 1, now);
  });

  props.controls({
    toggle: () => (current() >= 0 && state() !== 'stopped' ? play(current()) : play(nextTrack(-1))),
    focus: () => list.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true }),
  });
  createEffect(on(() => props.shown, (shown) => {
    if (!shown) stop();
  }, { defer: true }));
  onCleanup(() => {
    request++;
    audio.pause();
    audio.removeAttribute('src');
  });

  const appleLink = () => `https://music.apple.com/us/album/${props.album.appleMusic}`;
  const buyLink = () => props.album.buy ?? `https://www.amazon.com/s?k=${encodeURIComponent(`${props.album.artist} ${props.album.title} CD`)}&i=popular`;
  const label = (track: Track, n: number) => {
    if (!track.apple) return `${track.title}, no preview`;
    if (n === current() && state() === 'playing') return `Pause ${track.title}`;
    return `Play ${track.title}`;
  };

  return (
    <section class="tracklist" classList={{ 'is-shown': props.shown }} inert={props.shown ? undefined : true} aria-label={`${props.album.title} tracklist`}>
      <p class="eyebrow">{props.album.year}<span class="eyebrow-separator">/</span>{props.album.kind}</p>
      <h2 class="album-title">{props.album.title}</h2>
      <ol class="tracks" ref={list}>
        <For each={tracks()}>
          {(track, n) => (
            <li>
              <button class="track" classList={{ 'is-current': n() === current(), 'is-playing': n() === current() && (state() === 'playing' || state() === 'loading'), 'has-bubble': canBubble }}
                type="button" disabled={!track.apple || !props.album.appleMusic} aria-label={label(track, n())} onClick={() => play(n())}
                style={{ '--progress': n() === current() ? progress() : 0 }} {...props.bubble}>
                <span class="track-number" aria-hidden="true">
                  <span class="track-index">{String(n() + 1).padStart(2, '0')}</span>
                  <svg class="track-icon is-play" viewBox="0 0 10 10"><path d="M2.5 1.5v7l6-3.5z" /></svg>
                  <svg class="track-icon is-pause" viewBox="0 0 10 10"><path d="M2.5 1.5h1.8v7H2.5zM5.7 1.5h1.8v7H5.7z" /></svg>
                </span>
                <span class="track-title">{track.title}</span>
                <span class="track-length" aria-hidden="true">{duration(track.length)}</span>
              </button>
            </li>
          )}
        </For>
      </ol>
      <Show when={failed()}>
        <p class="tracklist-note" role="status">Previews couldn't be loaded. Try again in a moment.</p>
      </Show>
      <p class="tracklist-links">
        <Show when={props.album.appleMusic}>
          <a classList={{ 'has-bubble': canBubble }} href={appleLink()} target="_blank" rel="noopener" {...props.bubble}>Apple Music</a>
        </Show>
        <a classList={{ 'has-bubble': canBubble }} href={buyLink()} target="_blank" rel="noopener" {...props.bubble}>Buy the CD</a>
      </p>
    </section>
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
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let captionTimer = 0;

  // What a click does, for the bubble cursor. In the menu, a click beside the list closes it.
  let menuButton!: HTMLButtonElement;
  let backButton!: HTMLButtonElement;
  let backByKeyboard = false;
  let captionButton!: HTMLButtonElement;
  const [pointer, setPointer] = createSignal<PointerState>({ hovered: -1, active: 0, opened: -1, dragging: false, overDisc: false, listening: false, discOut: false });
  // The disc is in the player (or going in): the tracklist shows and the row is out of view.
  const listening = createMemo(() => pointer().listening);
  let tracklist: TracklistControls | undefined;
  const bubbleLabel = () => {
    if (menuOpen()) return 'Close';
    const { hovered, active: front, opened, dragging, overDisc } = pointer();
    if (listening()) return '';
    // While a case is open, a click beside it closes it; over the case itself the bubble stays a
    // plain dot, keeping those clicks for the booklet, except over the disc, which goes in the player.
    if (opened >= 0) return hovered === opened ? (overDisc ? 'Listen' : '') : 'Close';
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

  // The loading counter, 0 to 100. Loading finishes album by album, so it counts up smoothly towards
  // the real progress rather than jumping. Once the gallery is ready it hurries to 100, and the
  // loading screen only fades once it shows 100.
  const [percent, setPercent] = createSignal(0);
  const progress = () => (ready() ? 100 : loading().total ? (loading().loaded / loading().total) * 100 : 0);
  let percentRaf = 0;
  function countUp() {
    const target = progress();
    const next = reducedMotion || Math.abs(target - percent()) < 0.5 ? target : percent() + (target - percent()) * (ready() ? 0.3 : 0.18);
    setPercent(next);
    percentRaf = next !== target ? requestAnimationFrame(countUp) : 0;
  }
  createEffect(on(progress, () => {
    if (!percentRaf) percentRaf = requestAnimationFrame(countUp);
  }));
  const loaded = () => ready() && percent() === 100;

  // Keeps the URL on the album in front and whether it is open, replacing the history entry, so the
  // browser's back button still goes to the previous artist or the title screen. Only while the URL
  // is still this band's: a gallery fading out mustn't overwrite the next one's address.
  createEffect(() => {
    const url = galleryUrl(props.band.folder, albums[active()]?.id, pointer().opened >= 0, listening());
    if (!revealed() || bandFromUrl() !== props.band.folder || window.location.search === url) return;
    window.history.replaceState(window.history.state, '', url);
  });

  // Focus moves only when the control holding it is about to go away: from Back (hidden) to the
  // caption when the case closes. The caption stays usable while the case is open (it puts the disc
  // in the player then), so opening leaves focus on it. Anywhere else focus stays put. Focus returns
  // to the caption only if Back got focus by keyboard; otherwise closing lets it go. How Back got
  // focus is noted when it gets it (backByKeyboard): any key press, Escape included, makes the
  // focused element count as keyboard-focused from then on. A memo, so this runs only when the case
  // opens or closes, not on every pointer change.
  const isOpen = createMemo(() => pointer().opened >= 0);
  createEffect(on(isOpen, (open) => {
    if (menuOpen()) return;
    const focused = document.activeElement;
    requestAnimationFrame(() => {
      if (!open && focused === backButton) {
        if (backByKeyboard) captionButton.focus({ preventScroll: true });
        else backButton.blur();
      }
    });
  }, { defer: true }));

  // The same for the player view: from the caption (hidden in it) to the first track when the disc
  // goes in by keyboard, and from the tracklist (hidden once it leaves) back to the caption when it
  // comes out, if the list had keyboard focus; otherwise focus is let go.
  createEffect(on(listening, (listen) => {
    if (menuOpen()) return;
    const focused = document.activeElement as HTMLElement | null;
    const byKeyboard = Boolean(focused?.matches(':focus-visible'));
    requestAnimationFrame(() => {
      if (listen && focused === captionButton && byKeyboard) tracklist?.focus();
      if (!listen && focused?.closest('.tracklist')) {
        if (byKeyboard) captionButton.focus({ preventScroll: true });
        else focused.blur();
      }
    });
  }, { defer: true }));

  // Back: from the player to the open case, from the open case to the row.
  function back() {
    if (listening()) scene?.eject();
    else scene?.close();
  }

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
    // Space toggles the front case and Enter opens it, unless a control has focus: then the key is
    // that control's (Enter on an arrow steps, on the caption opens).
    const onControl = Boolean((event.target as Element | null)?.closest?.('button, a, input, textarea, select'));
    // In the player view Space plays and pauses; Enter on an open case puts its disc in the player.
    if (event.key === ' ' && !onControl) {
      event.preventDefault();
      if (listening()) tracklist?.toggle();
      else scene.toggle();
    }
    if (event.key === 'Enter' && !onControl && !listening()) { event.preventDefault(); if (browse) scene.open(); else scene.insert(); }
    if (event.key === 'Escape') back();
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
      listenOnReveal: linked.listen,
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
    cancelAnimationFrame(percentRaf);
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
      <button class="corner-button back-button" classList={{ 'is-shown': pointer().opened >= 0, 'has-bubble': canBubble }} type="button" ref={backButton} onFocus={() => { backByKeyboard = backButton.matches(':focus-visible'); }} onClick={back} tabIndex={pointer().opened >= 0 ? 0 : -1} aria-hidden={pointer().opened < 0} {...cursor.button}>
        <span aria-hidden="true">←</span> Back
      </button>
      <nav class="menu" classList={{ 'is-open': menuOpen(), 'has-bubble': canBubble }} id="menu" aria-label="Artists" inert={menuOpen() ? undefined : true} onClick={(event) => event.target === event.currentTarget && toggleMenu(false)} {...cursor.surface}>
        <ArtistList bands={props.bands} current={props.band.folder} onSelect={(folder) => (folder === props.band.folder ? toggleMenu(false) : props.onSelect(folder))} bubble={cursor.button} />
        <a class="menu-home" href="./" onClick={goHome} {...cursor.button}>Home</a>
      </nav>
      {/* Both words sit in the same place and cross-fade; the button is named by aria-label. */}
      <button class="corner-button menu-button" classList={{ 'is-shown': revealed(), 'has-bubble': canBubble }} type="button" ref={menuButton} onClick={() => toggleMenu()}
        aria-label={menuOpen() ? 'Close menu' : 'Menu'} aria-expanded={menuOpen()} aria-controls="menu" {...cursor.button}>
        <span class="menu-label" classList={{ 'is-shown': !menuOpen() }} aria-hidden="true">Menu</span>
        <span class="menu-label" classList={{ 'is-shown': menuOpen() }} aria-hidden="true">Close</span>
      </button>
      {cursor.view()}
      {/* The counter is hidden from screen readers, which would announce every step; they get the
          progress bar's value instead. */}
      <div class="preloader" classList={{ 'is-done': loaded() }} aria-hidden={loaded()} onTransitionEnd={onPreloaderFaded}>
        <span class="preloader-label">Loading <strong aria-hidden="true">{Math.round(percent())}</strong></span>
        <span class="preloader-track" role="progressbar" aria-label={`Loading ${artist}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress())}>
          <span class="preloader-fill" style={{ transform: `scaleX(${percent() / 100})` }} />
        </span>
      </div>
      <Tracklist album={selected()} shown={listening()} bubble={cursor.button} controls={(controls) => { tracklist = controls; }}
        onPlaying={(playing) => scene?.setPlaying(playing)} onDisplay={(track, seconds) => scene?.setDisplay(track, seconds)} />
      {/* The caption, with arrows to the previous and next album level with it. The caption is a button
          that opens the album (Tab reaches it between the arrows), and once it is open puts its disc
          in the player. The arrows hide while a case is open, which keeps the row where it is; the
          whole bar hides while the disc is out of its case, since the tracklist names the album. */}
      <footer class="bottom-bar" classList={{ 'is-hidden': !revealed() || pointer().discOut }} inert={pointer().discOut ? true : undefined}>
        <button class="album-arrow is-prev" classList={{ 'is-shown': pointer().opened < 0, 'has-bubble': canBubble }} type="button" aria-label="Previous album"
          disabled={active() === 0} inert={pointer().opened < 0 ? undefined : true} onClick={() => scene?.step(-1)} {...cursor.button}>←</button>
        <div class="album-caption" classList={{ 'is-switching': captionHidden() }} aria-live="polite">
          <button class="album-open" classList={{ 'has-bubble': canBubble }} type="button" ref={captionButton}
            aria-label={`${pointer().opened < 0 ? 'Open' : 'Listen to'} ${selected().title} (${selected().year}, ${selected().kind})`}
            onClick={() => (pointer().opened < 0 ? scene?.open() : scene?.insert())} {...cursor.button}>
            <span class="eyebrow">{selected().year}<span class="eyebrow-separator">/</span>{selected().kind}</span>
            <span class="album-title">{selected().title}</span>
          </button>
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
