import { render } from 'solid-js/web';
import { For, Match, Show, Switch, batch, createComputed, createEffect, createMemo, createSignal, on, onCleanup, onMount, untrack } from 'solid-js';
import { A, HashRouter, Navigate, Route, useLocation, useNavigate, useParams } from '@solidjs/router';
import type { Accessor } from 'solid-js';
import { GalleryScene, PLAYER_BUTTONS, prefersReducedMotion } from './scene';
import type { PlayerButton, PointerState } from './scene';
import { aboutPath, galleryLink, galleryModes, galleryPath, loadCollection, moveQueryToHash } from './collection';
import type { Album, Collection, GalleryLink, GalleryMode, Theme } from './collection';
import type { PageSource } from 'leafthrough';
import './style.css';

const repository = 'https://github.com/dmtrbrl/discography';
const website = 'https://dmytrobarylo.com';
const leafthrough = 'https://github.com/dmtrbrl/leafthrough';

// Bubble cursor (mouse only): a dot on the pointer (no lag). Over something interactive it grows a
// little, and once the pointer has rested for labelDelay it opens like a tooltip and says what a
// click will do (options.label). Moving more than restSlop pixels, a click (a page turned on the
// spot keeps the same label, and the tip came up over a still hand), or a change of action (say
// Next becoming Open after a click) hides the label and restarts the wait. Over a button or link (props
// from .button: the text buttons and links) it becomes a larger dot, and a clone of the
// element in the page's beige, laid over it and clipped to the dot, shows it beige inside the dot. The clone sits in one
// layer above the bubble, so it works over blurred overlays too, whose blur would trap a copy beneath it.
// Over something that answers the pointer itself (options.quiet: the player's buttons, too small to
// cover) the dot becomes a thin ring round it, and the label opens as a tag above the ring.
const labelDelay = 3000;
const restSlop = 3;
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
  // Whether the pointer is over something that shows its own hover.
  quiet?: Accessor<boolean>;
}

// Event handlers for the surfaces the bubble moves over, and for text buttons and links.
interface SurfaceProps {
  onPointerMove: (event: PointerEvent) => void;
  onPointerEnter: (event: PointerEvent) => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
  onPointerUp: () => void;
}
// The move is a native listener: Solid's delegated handlers skip disabled buttons, which left no dot
// over them.
interface ButtonProps {
  'data-bubble': string;
  'on:pointermove': (event: PointerEvent) => void;
  onPointerEnter: (event: PointerEvent) => void;
  onPointerLeave: () => void;
}

function createBubble(options: BubbleOptions) {
  const reducedMotion = prefersReducedMotion();
  let bubble!: HTMLDivElement;
  let layer!: HTMLDivElement;
  let body!: HTMLSpanElement;
  const [over, setOver] = createSignal(false);
  const [shown, setShown] = createSignal(false);
  const [pressed, setPressed] = createSignal(false);
  // Over a disabled button (the caption of an open case, the last album's Next) a click does
  // nothing, so the dot stays plain, with no label.
  const [plain, setPlain] = createSignal(false);
  const [tip, setTip] = createSignal({ text: '', shown: false });
  let tipTimer = 0;
  const rest = { x: 0, y: 0 };
  // A memo, so the wait restarts only when the label changes, not on every change of what it's
  // derived from.
  const label = createMemo(options.label);
  const quiet = () => Boolean(options.quiet?.());
  // No label while something shows a keyboard focus ring: the keyboard is in use, and a tooltip by
  // the mouse would compete with it. A label already open closes when a ring appears.
  const keyboardFocus = () => Boolean(document.querySelector(':focus-visible'));
  function armTip() {
    clearTimeout(tipTimer);
    setTip((current) => ({ ...current, shown: false }));
    if (label()) tipTimer = window.setTimeout(() => setTip({ text: label(), shown: Boolean(label()) && !keyboardFocus() }), labelDelay);
  }
  createEffect(on(label, armTip));
  // After the focus moves or a key is pressed, the ring has settled by the next frame.
  const closeTipForFocus = () => requestAnimationFrame(() => {
    if (keyboardFocus()) setTip((current) => ({ ...current, shown: false }));
  });
  const mouse = { x: 0, y: 0, clip: 0, raf: 0, left: 0, top: 0 };
  // Over a button the clone shows through a circle exactly the dot's size as drawn, read from the
  // dot every frame while it grows or shrinks; a circle animated on its own fell out of step with
  // the dot's transition, which showed a small symbol half white when the pointer jumped between
  // buttons. Off a button the clone's circle closes quickly.
  function follow() {
    bubble.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
    let settled: boolean;
    if (over()) {
      const clip = (body.offsetWidth / 2) * new DOMMatrixReadOnly(getComputedStyle(body).transform).a;
      settled = body.getAnimations().length === 0 && Math.abs(clip - mouse.clip) < 0.05;
      mouse.clip = clip;
    } else {
      mouse.clip = reducedMotion || mouse.clip < 0.1 ? 0 : mouse.clip * 0.75;
      settled = mouse.clip === 0;
    }
    layer.style.clipPath = `circle(${mouse.clip}px at ${mouse.x - mouse.left}px ${mouse.y - mouse.top}px)`;
    mouse.raf = settled ? 0 : requestAnimationFrame(follow);
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
  // The element under the pointer, and what it looked like when cloned. A button inside a group
  // ([data-bubble-group], such as the transport row) has the whole group cloned (`source`), so the
  // dot shows every symbol under it in beige, not the hovered one alone: with small symbols closer
  // together than the dot is wide, a single copy left a neighbour half under the dot in its own
  // colour, and the hovered symbol cut at the dot's edge.
  let target: HTMLElement | null = null;
  let source: HTMLElement | null = null;
  let cloned = '';
  let clonedBox = '';
  const copied = (element: HTMLElement) => element.closest<HTMLElement>('[data-bubble-group]') ?? element;
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
    // Moving between buttons of a group keeps the group's clone where it is.
    const next = copied(element);
    if (next !== element && next === source && layer.firstElementChild && box(next) === layer.dataset.box) {
      setOver(true);
      setShown(true);
      if (!mouse.raf) mouse.raf = requestAnimationFrame(follow);
      return;
    }
    source = next;
    const rect = source.getBoundingClientRect();
    const style = getComputedStyle(source);
    const clone = source.cloneNode(true) as HTMLElement;
    for (const node of [clone, ...clone.querySelectorAll<HTMLElement>('[id], [data-bubble]')]) {
      node.removeAttribute('id');
      node.removeAttribute('data-bubble');
    }
    for (const name of cloneStyles) clone.style[name] = style[name];
    // Inline boxes ignore translate (used below to line the clone up), and an inline-block would sit
    // on the layer's baseline.
    if (style.display === 'inline') clone.style.display = 'block';
    Object.assign(clone.style, {
      position: 'static', inset: 'auto', translate: 'none', transform: 'none', transition: 'none', opacity: '1', visibility: 'visible',
      margin: '0', width: '100%', height: '100%', boxSizing: 'border-box', color: 'var(--bg)', textDecorationColor: 'var(--bg)', pointerEvents: 'none',
    });
    layer.replaceChildren(clone);
    layer.dataset.box = box(source);
    Object.assign(layer.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    // Inline text lays out its line box differently once it stands alone, so line the clone's
    // content up with the original's.
    const from = contentRect(clone);
    const to = contentRect(source);
    clone.style.translate = `${to.left - from.left}px ${to.top - from.top}px`;
    mouse.left = rect.left;
    mouse.top = rect.top;
    setOver(true);
    setShown(true);
    if (!mouse.raf) mouse.raf = requestAnimationFrame(follow);
  }
  function enterButton(event: PointerEvent) {
    const element = event.currentTarget as HTMLElement;
    const disabled = (element as HTMLButtonElement).disabled;
    setPlain(disabled);
    if (canBubble && event.pointerType === 'mouse' && !disabled) showClone(element);
  }
  // Leaving by moving hides the bubble until the next move over a surface; leaving because the
  // element went away keeps the dot where the pointer is.
  function leaveButton(hide = true) {
    target = null;
    setOver(false);
    setPlain(false);
    if (hide) setShown(false);
    if (!mouse.raf) mouse.raf = requestAnimationFrame(follow);
  }
  // A click or a key can change or remove the element under a still pointer, with no pointer event
  // to say so: Back hides as the case closes, the caption changes under the pointer.
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
        setPlain(!next && Boolean((hit as HTMLButtonElement | null)?.disabled));
      } else if (target && signature(target) !== cloned) {
        if (box(target) === clonedBox && syncClone(target)) cloned = signature(target);
        else showClone(target);
      }
    }
    if (performance.now() < recheckUntil) recheckRaf = requestAnimationFrame(recheck);
  }
  // When only the state of the element changed (its classes, at the same size and with the same
  // words, as when a player button changes state), update the clone in place rather than rebuilding it, so its
  // own transitions run inside the dot as they do on the page. Returns false if it needs a rebuild.
  function syncClone(element: HTMLElement) {
    const clone = layer.firstElementChild;
    const original = copied(element);
    if (!clone || original !== source || clone.textContent !== original.textContent) return false;
    const from = original.querySelectorAll('*');
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
    armTip();
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
    // Entering counts as moving: a surface can come out from under a still pointer (an overlay closing).
    surface: { onPointerMove: move, onPointerEnter: move, onPointerLeave: () => setShown(false), onPointerDown: () => setPressed(true), onPointerUp: () => setPressed(false) } satisfies SurfaceProps,
    // For text buttons and links.
    button: { 'data-bubble': '', 'on:pointermove': move, onPointerEnter: enterButton, onPointerLeave: () => leaveButton() } satisfies ButtonProps as ButtonProps,
    view: () => (
      <>
        <div class="bubble" ref={bubble} aria-hidden="true">
          <span class="bubble-body" ref={body} classList={{ 'is-shown': shown() && options.revealed(), 'is-active': Boolean(label()) && !over() && !plain(), 'has-label': tip().shown && !over() && !quiet() && !plain(), 'is-button': over(), 'is-pressed': pressed(), 'is-ring': quiet() }}>
            <span class="bubble-label">{tip().text}</span>
          </span>
          <span class="bubble-tag" classList={{ 'is-shown': shown() && options.revealed() && quiet() && tip().shown }}>{tip().text}</span>
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

// 30-second previews from Apple Music: one lookup per album gives every track's preview URL, keyed
// by the Apple track IDs that scripts/fetch-tracks.mjs stored. Preview URLs aren't kept in collection.json
// since Apple may change them. Each album is fetched once a visit.
const previews = new Map<string, Promise<Map<number, string>>>();

function loadPreviews(collection: number, country = 'us') {
  const key = `${country}:${collection}`;
  let loading = previews.get(key);
  if (!loading) {
    loading = fetch(`https://itunes.apple.com/lookup?id=${collection}&entity=song&limit=200&country=${encodeURIComponent(country)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${response.status}`))))
      .then(({ results }: { results: { wrapperType: string; trackId?: number; previewUrl?: string }[] }) =>
        new Map(results.filter((result) => result.trackId && result.previewUrl).map((result) => [result.trackId!, result.previewUrl!])));
    loading.catch(() => previews.delete(key));
    previews.set(key, loading);
  }
  return loading;
}

// The bubble's label over each of the player's buttons, and the button's accessible name.
const BUTTON_LABELS: Record<PlayerButton, string> = { previous: 'Prev', play: 'Play', pause: 'Pause', next: 'Next' };
const BUTTON_NAMES: Record<PlayerButton, string> = { previous: 'Previous track', play: 'Play', pause: 'Pause', next: 'Next track' };

// The player's printed button symbols as the scene draws them (playerMark), for the transport row
// under the player.
const playerIcon = (kind: PlayerButton) => ({
  previous: <><path d="M1.2-1.1-.55 0 1.2 1.1z" /><rect x="-1.225" y="-1.15" width=".55" height="2.3" rx=".12" /></>,
  play: <path d="M-.85-1.2 1.2 0-.85 1.2z" />,
  pause: <><rect x="-.925" y="-1.15" width=".65" height="2.3" rx=".12" /><rect x=".275" y="-1.15" width=".65" height="2.3" rx=".12" /></>,
  next: <><path d="M-1.2-1.1.55 0-1.2 1.1z" /><rect x=".675" y="-1.15" width=".55" height="2.3" rx=".12" /></>,
})[kind];

type PreviewState = 'stopped' | 'loading' | 'playing' | 'paused';

// What the page can do with the previews: from the keyboard, the transport row and the player's
// buttons; whether the transport row can play anything, and the current track (-1 while stopped),
// which phones show under it.
interface Previews {
  current: Accessor<number>;
  failed: Accessor<boolean>;
  playable: Accessor<boolean>;
  toggle(): void;
  button(button: PlayerButton): void;
}

// The player view's 30-second previews. The player's buttons (and the transport row, which presses
// them) play, pause and skip; the next track follows when one ends. Tracks Apple has no preview for
// are skipped. Playing and pausing spin and stop the disc (onPlaying); the display follows the
// track and time (onDisplay). Leaving the player stops the music.
function createPreviews(options: {
  album: () => Album; shown: () => boolean;
  onPlaying: (playing: boolean) => void; onDisplay: (track: number | null, seconds: number) => void;
}): Previews {
  const audio = new Audio();
  audio.preload = 'none';
  const [current, setCurrent] = createSignal(-1);
  const [state, setState] = createSignal<PreviewState>('stopped');
  const [seconds, setSeconds] = createSignal(0);
  const [failed, setFailed] = createSignal(false);
  const tracks = () => options.album().tracks ?? [];
  let request = 0;
  // The next track's preview, fetched while the current one plays and kept as an object URL, so a
  // track change doesn't wait for the network (on iPhones the disc's spin paused while it did).
  // Apple's preview files allow the cross-origin fetch. `held` is the object URL now playing,
  // revoked only once the audio has moved on from it (Safari needs it while it plays).
  let ahead: { index: number; src: string } | null = null;
  let held: string | null = null;
  const dropAhead = () => {
    if (ahead) URL.revokeObjectURL(ahead.src);
    ahead = null;
  };
  async function fetchAhead(index: number) {
    const album = options.album();
    const track = tracks()[index];
    if (index < 0 || !track?.apple || !album.appleMusic || ahead?.index === index) return;
    const ticket = request;
    const urls = await loadPreviews(album.appleMusic, album.appleMusicCountry).catch(() => null);
    const url = urls?.get(track.apple);
    if (!url || ticket !== request) return;
    try {
      const blob = await (await fetch(url)).blob();
      if (ticket !== request) return;
      dropAhead();
      ahead = { index, src: URL.createObjectURL(blob) };
    } catch {}
  }

  function stop() {
    request++;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    dropAhead();
    if (held) URL.revokeObjectURL(held);
    held = null;
    setCurrent(-1);
    setState('stopped');
    setSeconds(0);
    options.onPlaying(false);
    options.onDisplay(null, 0);
  }

  // Plays track `index`, or with autoplay false only cues it: the track is chosen and shown, paused
  // at its start, as a CD player skips while paused. The previous track's audio is dropped at once,
  // so Play pressed while the new one loads can't resume the old one.
  async function play(index: number, autoplay = true) {
    const album = options.album();
    const track = tracks()[index];
    if (!track?.apple || !album.appleMusic) return;
    if (autoplay && index === current() && state() !== 'stopped' && audio.getAttribute('src')) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    const ticket = ++request;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setCurrent(index);
    setState(autoplay ? 'loading' : 'paused');
    setSeconds(0);
    options.onDisplay(index + 1, 0);
    const urls = await loadPreviews(album.appleMusic, album.appleMusicCountry).catch(() => null);
    if (ticket !== request) return;
    const url = urls?.get(track.apple);
    if (!url) {
      setFailed(true);
      stop();
      return;
    }
    setFailed(false);
    // The preview fetched ahead, if it is this track's; the one played before it can go now.
    if (held) URL.revokeObjectURL(held);
    held = ahead?.index === index ? ahead.src : null;
    if (held) ahead = null;
    audio.src = held ?? url;
    if (!autoplay) return;
    audio.play().catch(() => {
      if (ticket === request) stop();
    });
  }

  // The next track with a preview after `index`, or -1.
  const nextTrack = (index: number) => tracks().findIndex((track, n) => n > index && track.apple);
  // The last track with a preview before `index`, or -1.
  const previousTrack = (index: number) => tracks().reduce((found, track, n) => (n < index && track.apple ? n : found), -1);

  // The player's buttons, as on a CD player. Play resumes, or starts the first track; pause holds
  // the track; next skips ahead; previous restarts the track after its first three seconds, and
  // otherwise goes back one. Only Play starts the music: unless a track is playing, next and
  // previous only cue one, paused at its start. Stopped counts as sitting at the first track.
  function button(kind: PlayerButton) {
    const stopped = state() === 'stopped';
    const index = stopped ? -1 : current();
    const autoplay = state() === 'playing' || state() === 'loading';
    if (kind === 'play') {
      if (index < 0) play(nextTrack(-1));
      else if (state() === 'paused') {
        // A track cued while paused may still be loading its preview: then start it afresh.
        if (audio.getAttribute('src')) audio.play().catch(() => {});
        else play(index);
      }
    } else if (kind === 'pause') {
      if (state() === 'playing') audio.pause();
    } else if (kind === 'next') {
      const next = nextTrack(stopped ? nextTrack(-1) : index);
      if (next >= 0) play(next, autoplay);
    } else if (stopped) {
      const first = nextTrack(-1);
      if (first >= 0) play(first, false);
    } else {
      const previous = previousTrack(index);
      if (audio.currentTime > 3 || previous < 0) audio.currentTime = 0;
      else play(previous, autoplay);
    }
  }

  audio.addEventListener('playing', () => {
    setState('playing');
    options.onPlaying(true);
    void fetchAhead(nextTrack(current()));
  });
  audio.addEventListener('pause', () => {
    // A track change pauses the old track before loading the new one: with the music about to go
    // on (loading), the disc keeps spinning rather than coasting down and up again.
    if (audio.ended || state() === 'stopped' || state() === 'loading' || !audio.src) return;
    setState('paused');
    options.onPlaying(false);
  });
  audio.addEventListener('ended', () => {
    const next = nextTrack(current());
    if (next >= 0) play(next);
    else stop();
  });
  audio.addEventListener('timeupdate', () => {
    const now = Math.floor(audio.currentTime);
    if (!audio.duration || now === seconds()) return;
    setSeconds(now);
    options.onDisplay(current() + 1, now);
  });

  createEffect(on(options.shown, (shown) => {
    if (!shown) stop();
  }, { defer: true }));
  onCleanup(() => {
    request++;
    audio.pause();
    audio.removeAttribute('src');
    dropAhead();
    if (held) URL.revokeObjectURL(held);
  });

  return {
    current: () => (state() === 'stopped' ? -1 : current()),
    failed,
    playable: () => Boolean(options.album().appleMusic) && nextTrack(-1) >= 0,
    toggle: () => (current() >= 0 && state() !== 'stopped' ? play(current()) : play(nextTrack(-1))),
    button,
  };
}

// The inside pages of an album's booklet, for the scene, which adds the cover and back page its case
// already shows. The archive stores many booklet pages as two-page spreads: they are split only in
// memory, preserving the source scans on disk. A scan that fails to load is left out. Kept per
// album, so the booklet opens again without decoding its scans again.
const bookletCache = new Map<string, Promise<PageSource[]>>();
function bookletPages(album: Album) {
  const cached = bookletCache.get(album.id);
  if (cached) return cached;
  const loadImage = async (src: string) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    await image.decode();
    return image;
  };
  const square = (image: HTMLImageElement, panel: number, panels: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const panelWidth = image.naturalWidth / panels;
    const context = canvas.getContext('2d')!;
    if (album.bookletFit === 'contain') {
      // Preserve the complete half-spread, especially its centre edge. Centre-cropping each
      // half separately drops two strips of artwork and breaks continuous shapes at the spine.
      const scale = 1024 / Math.max(panelWidth, image.naturalHeight);
      const width = panelWidth * scale, height = image.naturalHeight * scale;
      const x = (1024 - width) / 2, y = (1024 - height) / 2;
      context.drawImage(image, panel * panelWidth, 0, panelWidth, image.naturalHeight, x, y, width, height);
      // Extend only the outermost pixel into the narrow padding, without stretching the art.
      if (y > 0) {
        context.drawImage(image, panel * panelWidth, 0, panelWidth, 1, x, 0, width, y);
        context.drawImage(image, panel * panelWidth, image.naturalHeight - 1, panelWidth, 1, x, y + height, width, y);
      }
      if (x > 0) {
        context.drawImage(image, panel * panelWidth, 0, 1, image.naturalHeight, 0, y, x, height);
        context.drawImage(image, (panel + 1) * panelWidth - 1, 0, 1, image.naturalHeight, x + width, y, x, height);
      }
      return canvas;
    }
    const crop = Math.min(panelWidth, image.naturalHeight);
    context.drawImage(image, panel * panelWidth + (panelWidth - crop) / 2, (image.naturalHeight - crop) / 2, crop, crop, 0, 0, 1024, 1024);
    return canvas;
  };
  const pages = Promise.all((album.bookletScans ?? []).map((src) => loadImage(src).catch(() => null))).then((scans) => {
    const pages: PageSource[] = [];
    for (const scan of scans) {
      if (!scan) continue;
      const ratio = scan.naturalWidth / scan.naturalHeight;
      const panels = ratio > 3.4 ? 4 : ratio > 1.45 ? 2 : 1;
      for (let panel = 0; panel < panels; panel++) pages.push(square(scan, panel, panels));
    }
    return pages;
  });
  bookletCache.set(album.id, pages);
  return pages;
}

function App(props: { collection: Collection; link: GalleryLink; jump: () => GalleryLink | null; onPath: (path: string) => void }) {
  const { albums, theme } = props.collection;
  let stage!: HTMLDivElement;
  let scene: GalleryScene | undefined;
  // The scene is built a frame after the page, so the loading screen paints first (onMount).
  let sceneRaf = 0;
  let sceneTimer = 0;
  let removeDevSpeed: (() => void) | undefined;
  // A link can name the album in front and its view; without one the row starts at the first.
  const indexOf = (album: string | null) => Math.max(0, albums.findIndex((item) => item.id === album));
  let linked = props.link;
  const startIndex = indexOf(linked.album);
  const [active, setActive] = createSignal(startIndex);
  const [loading, setLoading] = createSignal({ loaded: 0, total: albums.length });
  const [ready, setReady] = createSignal(false);
  const [revealed, setRevealed] = createSignal(false);
  // The caption shows its own index, so it can fade out on the old album before switching.
  const [shown, setShown] = createSignal(startIndex);
  const [captionHidden, setCaptionHidden] = createSignal(false);
  const selected = () => albums[shown()];
  const reducedMotion = prefersReducedMotion();
  let captionTimer = 0;

  let backButton!: HTMLButtonElement;
  let backByKeyboard = false;
  let prevArrow!: HTMLButtonElement;
  let captionButton!: HTMLButtonElement;
  let nextArrow!: HTMLButtonElement;
  let bookletButton!: HTMLButtonElement;
  let listenButton!: HTMLButtonElement;
  // The page about the project (#/about), over the row: the gallery fades out and stays as it was.
  const [aboutOpen, setAboutOpen] = createSignal(false);
  let aboutLink!: HTMLAnchorElement;
  // A jump (see Gallery) is under way: the view is leaving, and the page's controls fade with it.
  const [leaving, setLeaving] = createSignal(false);
  // The view is changing (a jump, the intro, a case opening or closing, the disc going in or out):
  // Close, Escape, Enter, Space, the wordmark, the caption, Booklet and Listen do nothing until it has
  // finished, as clicks on the scene don't (see GalleryScene.viewBusy). Moving along the row works.
  const busy = () => pointer().busy || leaving();
  const [pointer, setPointer] = createSignal<PointerState>({ hovered: -1, active: 0, opened: -1, dragging: false, overDisc: false, overBooklet: false, listening: false, seated: false, discOut: false, overButton: null, busy: false, reading: false, bookletOut: false, overPage: null });
  // The booklet is out in the middle of the screen (or coming out), where LeafThrough turns its
  // pages; the arrows turn them. Which pages show (first and last, of count), once it has landed.
  const bookletOpen = createMemo(() => pointer().reading);
  const [bookletPage, setBookletPage] = createSignal({ first: 0, last: 0, count: 0, loops: false });
  // Whether a page turns on from here: on phones the back cover turns too, back onto the cover.
  const pagesAhead = () => bookletPage().loops || bookletPage().last < bookletPage().count - 1;
  const pageArrows = () => bookletOpen() && bookletPage().count > 0;
  // The pages shown, "2–3" for a spread, "1" for a cover or a phone's single page, for the live region.
  const pageRange = () => `${bookletPage().first + 1}${bookletPage().last > bookletPage().first ? `–${bookletPage().last + 1}` : ''}`;
  const browsing = () => pointer().opened < 0;
  // The disc is in the player (or going in): the transport row shows and the row of cases is out of view.
  const listening = createMemo(() => pointer().listening);
  // The disc has landed on the spindle: only then do the player's screen, its buttons and the
  // transport row under it work.
  const seated = createMemo(() => pointer().seated);
  // Booklet and Listen: while a case is open with its disc and booklet in it, so after an eject, or
  // after the booklet is closed, only once it is back in the case.
  const caseActions = createMemo(() => pointer().opened >= 0 && !pointer().discOut && !pointer().bookletOut);
  const previews = createPreviews({
    album: selected, shown: listening,
    onPlaying: (playing) => scene?.setPlaying(playing), onDisplay: (track, seconds) => scene?.setDisplay(track, seconds),
  });
  let playButton!: HTMLButtonElement;
  // The track phones show under the transport row: on a change the old one fades out, then the new
  // one fades in, as the caption does.
  const [trackShown, setTrackShown] = createSignal(-1);
  const [trackSwitching, setTrackSwitching] = createSignal(false);
  let trackTimer = 0;
  createEffect(on(previews.current, (index) => {
    clearTimeout(trackTimer);
    if (reducedMotion || trackShown() === index) {
      setTrackShown(index);
      setTrackSwitching(false);
      return;
    }
    setTrackSwitching(true);
    trackTimer = window.setTimeout(() => {
      setTrackShown(index);
      setTrackSwitching(false);
    }, 200);
  }, { defer: true }));
  onCleanup(() => clearTimeout(trackTimer));
  // The transport button that was just pressed, here or on the player itself: its symbol dips in
  // and springs back with the player's button (pressButton's 0.07 s in).
  const [pressed, setPressed] = createSignal<PlayerButton | null>(null);
  let pressTimer = 0;
  const pressTwin = (kind: PlayerButton) => {
    clearTimeout(pressTimer);
    setPressed(kind);
    pressTimer = window.setTimeout(() => setPressed(null), 90);
  };
  // The transport row hangs just under the player: its top, from where the scene says the player's
  // lowest edge is (the gap is its margin in style.css). Measured when the player view starts and after a resize (two frames on, once
  // the scene has resized too).
  const [transportTop, setTransportTop] = createSignal<number | null>(null);
  const placeTransport = () => {
    if (listening() && scene) setTransportTop(scene.playerBottom());
  };
  createEffect(on(listening, placeTransport));
  const onResize = () => requestAnimationFrame(() => requestAnimationFrame(placeTransport));
  window.addEventListener('resize', onResize);
  onCleanup(() => window.removeEventListener('resize', onResize));
  // A transport button with keyboard focus lights its symbol on the player.
  const lightOnFocus = (kind: PlayerButton) => ({
    onFocus: (event: FocusEvent) => scene?.focusButton((event.currentTarget as HTMLElement).matches(':focus-visible') ? kind : null),
    onBlur: () => scene?.focusButton(null),
  });
  // The album on Apple Music and Spotify, and where to buy the CD: the artist's shop when
  // collection.json names one, otherwise an Amazon search.
  const spotifyLink = () => `https://open.spotify.com/album/${selected().spotify}`;
  const appleLink = () => `https://music.apple.com/${selected().appleMusicCountry ?? 'us'}/album/${selected().appleMusic}`;
  const buyLink = () => selected().buy ?? `https://www.amazon.com/s?k=${encodeURIComponent(`${selected().artist} ${selected().title} CD`)}&i=popular`;
  // What a click does, for the bubble cursor.
  const bubbleLabel = () => {
    if (aboutOpen()) return '';
    const { hovered, active: front, opened, dragging, overDisc, overBooklet, overButton, bookletOut, overPage } = pointer();
    // On the booklet's pages a click turns them, on (right of the spine) or back (left), while there
    // are pages that way. Only Close or Escape puts it away.
    if (bookletOut) {
      if (!bookletOpen()) return '';
      const { first } = bookletPage();
      if (overPage === 'next') return pagesAhead() ? 'Next' : '';
      if (overPage === 'prev') return first > 0 ? 'Prev' : '';
      return '';
    }
    // In the player: its buttons, and the landed disc, which a click ejects (as Back does).
    if (listening()) return overButton ? BUTTON_LABELS[overButton] : overDisc ? 'Eject' : '';
    // Over an open case the disc goes in the player
    // and the booklet opens; elsewhere on the case the bubble stays a plain dot.
    if (opened >= 0) return hovered === opened ? (overDisc ? 'Listen' : overBooklet ? 'Booklet' : '') : '';
    if (dragging) return 'Drag';
    if (hovered < 0) return '';
    if (hovered === front) return 'Open';
    return hovered < front ? 'Prev' : 'Next';
  };
  const cursor = createBubble({ label: bubbleLabel, revealed, quiet: () => listening() && Boolean(pointer().overButton) });

  // Fades the caption out, swaps in the new album, and fades it back in. Moves through several
  // albums in a row keep it hidden until they settle.
  createEffect(on(active, (index) => {
    clearTimeout(captionTimer);
    if (reducedMotion || !revealed()) {
      setShown(index);
      return;
    }
    setCaptionHidden(true);
    captionTimer = window.setTimeout(() => {
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

  // Keeps the route on the album in front and its view (see Gallery), except while a jump is still
  // on its way to the route it came from.
  createEffect(() => {
    const mode: GalleryMode | null = bookletOpen() ? 'booklet' : listening() ? 'listen' : pointer().opened >= 0 ? 'open' : null;
    const path = aboutOpen() ? aboutPath : galleryPath(albums[active()].id, mode);
    if (revealed() && !leaving()) props.onPath(path);
  });

  // A jump: the view leaves and the gallery starts again on the link's view with the intro, fading
  // in as on the first reveal, as if the page had opened there. The steps in between don't play.
  // The gallery fades out as the view leaves; the player or the booklet drops out of view first, so
  // then it stays until they have gone.
  let stageFade: Animation | undefined;
  function fadeStage(to: 0 | 1, duration: number) {
    stageFade?.cancel();
    if (reducedMotion) return;
    const from = to ? 0 : Number(getComputedStyle(stage).opacity);
    stageFade = stage.animate([{ opacity: from }, { opacity: to }], { duration, easing: 'ease', fill: 'forwards' });
    if (to) stageFade.onfinish = () => stageFade?.cancel();
  }
  onCleanup(() => stageFade?.cancel());
  // #/about is the row as it is, the album in front, under the page about the project, which shows
  // as the jump starts (the gallery, hidden by then, starts again behind it).
  createEffect(on(props.jump, (link) => {
    if (!link) return;
    linked = link;
    const index = link.about ? active() : indexOf(link.album);
    const open = !link.about && link.mode !== null;
    const listen = !link.about && link.mode === 'listen';
    const read = !link.about && link.mode === 'booklet';
    if (!revealed() || !scene) {
      scene?.show(index, open, listen, read);
      return;
    }
    // The view under the about page (the browser's Back from it): only it goes. The booklet comes
    // out of the open case or goes back as its own controls would do it.
    if (!leaving() && index === active() && open === pointer().opened >= 0 && listen === listening()) {
      if (read && !bookletOpen()) scene.openBooklet();
      else if (!read && bookletOpen()) scene.closeBooklet();
      setAboutOpen(link.about);
      return;
    }
    // One step from the view shown, with nothing over it (mostly the browser's Back or Forward):
    // it plays as the page's own controls would, the case opening or closing, the disc going in or
    // out, the row moving to another album. Further away, or while the view is still changing, it
    // jumps.
    if (!busy() && !pointer().bookletOut && !aboutOpen() && !read && !link.about) {
      const shownOpen = pointer().opened >= 0;
      const shownListen = listening();
      if (index === active()) {
        if (!shownOpen && open && !listen) { scene.open(); return; }
        if (shownOpen && !shownListen && !open) { scene.close(); return; }
        if (shownOpen && !shownListen && listen) { scene.insert(); return; }
        if (shownListen && open && !listen) { scene.eject(); return; }
      } else if (!shownOpen && !open) {
        scene.goTo(index, 'click');
        return;
      }
    }
    (document.activeElement as HTMLElement | null)?.blur();
    if (aboutOpen()) fadeStage(0, 0);
    else if (!listening() && !pointer().bookletOut) fadeStage(0, 600);
    setLeaving(true);
    setAboutOpen(link.about);
    scene.show(index, open, listen, read, () => {
      if (link.about) stageFade?.cancel();
      else fadeStage(1, 700);
      batch(() => {
        setActive(index);
        setLeaving(false);
      });
    });
  }, { defer: true }));

  // Focus moves only when the control holding it is about to go away, and only if it got focus by
  // keyboard (otherwise it is let go), to what takes its place. As the case opens: from About to
  // Close in the same corner, from the arrows to Booklet or Listen on their side, and from the
  // caption (disabled once the case is open) to Listen. As it closes, the other way: from Close to
  // About, and from Booklet or Listen to the arrow on their side (the other one at either end of the
  // row). How Close got focus is noted when it gets it (backByKeyboard): any key press, Escape
  // included, makes the focused element count as keyboard-focused from then on. A memo, so this
  // runs only when the case opens or closes, not on every pointer change, and a computation, so
  // focus is read before the controls go inert or disabled, which drops it.
  const isOpen = createMemo(() => pointer().opened >= 0);
  createComputed(on(isOpen, (open) => {
    const focused = document.activeElement;
    const byKeyboard = Boolean(focused?.matches(':focus-visible'));
    if (open) {
      const target = !byKeyboard ? null : focused === aboutLink ? backButton : focused === prevArrow ? bookletButton
        : focused === nextArrow || focused === captionButton ? listenButton : null;
      if (target) requestAnimationFrame(() => target.focus({ preventScroll: true }));
      return;
    }
    requestAnimationFrame(() => {
      if (focused === backButton) {
        if (backByKeyboard) aboutLink.focus({ preventScroll: true });
        else backButton.blur();
      } else if ((focused === bookletButton || focused === listenButton) && byKeyboard) {
        const arrow = focused === bookletButton ? (prevArrow.disabled ? nextArrow : prevArrow) : (nextArrow.disabled ? prevArrow : nextArrow);
        arrow.focus({ preventScroll: true });
      }
    });
  }, { defer: true }));

  // The same for the player view: from Listen to Play when the disc goes in by keyboard, and from
  // the transport row or the store links (inert once the disc comes out), if they had keyboard
  // focus, to Booklet or Listen on their side (Listen from the transport row) once the disc is back
  // in its case and those return. Which it was is noted before the controls change (a computation
  // runs before the DOM updates).
  let playAfterInsert = false;
  let afterEject: HTMLButtonElement | null = null;
  createComputed(on(listening, (listen) => {
    const focused = document.activeElement as HTMLElement | null;
    const byKeyboard = Boolean(focused?.matches(':focus-visible'));
    if (listen) playAfterInsert = focused === listenButton && byKeyboard;
    else if (byKeyboard && focused?.closest('.transport, .case-action')) afterEject = focused.closest('.is-left') ? bookletButton : listenButton;
  }, { defer: true }));
  createEffect(on(seated, (landed) => {
    if (!landed || !playAfterInsert) return;
    playAfterInsert = false;
    requestAnimationFrame(() => playButton.focus({ preventScroll: true }));
  }, { defer: true }));
  // Focuses a control once it has faded in far enough to be visible.
  const focusWhenShown = (target: HTMLElement) => {
    const started = performance.now();
    const focusTarget = () => {
      if (getComputedStyle(target).visibility === 'visible') target.focus({ preventScroll: true });
      else if (performance.now() - started < 1500) requestAnimationFrame(focusTarget);
    };
    requestAnimationFrame(focusTarget);
  };
  createEffect(on(() => pointer().discOut, (out) => {
    const target = afterEject;
    if (out || !target) return;
    afterEject = null;
    focusWhenShown(target);
  }, { defer: true }));

  // The same for the booklet: from Booklet (by keyboard) to the next page's arrow once the pages
  // show, and from the page arrows back to Booklet once the booklet is back in its case.
  let pagesAfterOpen = false;
  let bookletAfterClose = false;
  createComputed(on(bookletOpen, (open) => {
    const focused = document.activeElement;
    const byKeyboard = Boolean(focused?.matches(':focus-visible'));
    if (open) pagesAfterOpen = focused === bookletButton && byKeyboard;
    else bookletAfterClose = byKeyboard && (focused === prevArrow || focused === nextArrow);
  }, { defer: true }));
  createEffect(on(pageArrows, (shown) => {
    if (!shown || !pagesAfterOpen) return;
    pagesAfterOpen = false;
    focusWhenShown(nextArrow);
  }, { defer: true }));
  createEffect(on(() => pointer().bookletOut, (out) => {
    if (out || !bookletAfterClose) return;
    bookletAfterClose = false;
    focusWhenShown(bookletButton);
  }, { defer: true }));

  // The corner button says what it does, in the words the bubble uses over the scene: Close on an
  // open case (back to the row), Eject in the player (the disc back to its case). When it changes
  // in view, the old word fades out first.
  const [backLabel, setBackLabel] = createSignal<'Close' | 'Eject'>(props.link.mode === 'listen' ? 'Eject' : 'Close');
  const [backSwitching, setBackSwitching] = createSignal(false);
  let backTimer = 0;
  createEffect(on(listening, (listen) => {
    const label = listen ? 'Eject' : 'Close';
    clearTimeout(backTimer);
    if (reducedMotion || pointer().opened < 0 || label === backLabel()) {
      setBackLabel(label);
      setBackSwitching(false);
      return;
    }
    setBackSwitching(true);
    backTimer = window.setTimeout(() => {
      setBackLabel(label);
      setBackSwitching(false);
    }, 200);
  }, { defer: true }));
  onCleanup(() => clearTimeout(backTimer));

  // The corner button (Close or Eject): from the player or the booklet to the open case, from the
  // open case or the about page to the row.
  function back() {
    if (busy()) return;
    if (aboutOpen()) closeAbout();
    else if (bookletOpen()) scene?.closeBooklet();
    else if (listening()) scene?.eject();
    else scene?.close();
  }

  // The about page opens from its link in the corner, where Close then takes over, and closes with
  // Close, Escape or the wordmark. Focus follows from one to the other if it got there by keyboard.
  const aboutShown = () => revealed() && pointer().opened < 0 && !aboutOpen() && !bookletOpen() && !leaving();
  function openAbout() {
    if (busy()) return;
    const byKeyboard = aboutLink.matches(':focus-visible');
    setAboutOpen(true);
    if (byKeyboard) requestAnimationFrame(() => backButton.focus({ preventScroll: true }));
  }
  function closeAbout() {
    const byKeyboard = document.activeElement === backButton && backByKeyboard;
    setAboutOpen(false);
    if (byKeyboard) requestAnimationFrame(() => aboutLink.focus({ preventScroll: true }));
  }

  // The scene owns the motion and reports the case in front back through setActive.
  function onKeyDown(event: KeyboardEvent) {
    // The booklet: the arrow keys turn its pages, Home and End go to its covers, Escape closes it.
    if (bookletOpen()) {
      if (event.altKey || event.metaKey || event.ctrlKey || !scene) return;
      const turn = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (turn) { event.preventDefault(); scene.turnPage(turn); }
      if (event.key === 'Home') { event.preventDefault(); scene.turnTo(0); }
      if (event.key === 'End') { event.preventDefault(); scene.turnTo(bookletPage().count - 1); }
      if (event.key === 'Escape') { event.preventDefault(); back(); }
      return;
    }
    // On its way back nothing else works yet.
    if (pointer().bookletOut) return;
    if (aboutOpen()) {
      if (event.key === 'Escape') { event.preventDefault(); closeAbout(); }
      return;
    }
    if (event.altKey || event.metaKey || event.ctrlKey || !scene) return;
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
      if (listening()) { if (seated()) previews.toggle(); }
      else if (!busy()) scene.toggle();
    }
    if (event.key === 'Enter' && !onControl && !listening()) {
      event.preventDefault();
      if (busy()) return;
      if (browse) scene.open();
      else scene.insert();
    }
    if (event.key === 'Escape') back();
  }

  // The loading screen fades out first; only then does the gallery fade in and play its intro.
  function reveal() {
    if (revealed()) return;
    batch(() => {
      setRevealed(true);
      if (linked.about) setAboutOpen(true);
    });
    scene?.reveal();
  }

  function onPreloaderFaded(event: TransitionEvent) {
    if (event.target === event.currentTarget && event.propertyName === 'opacity') reveal();
  }

  onMount(() => {
    // Built after the loading screen's first paint: a frame's callbacks run before that paint, so
    // the timer after one. Building the scene (the cases, their booklets, the procedural textures)
    // holds the main thread for a moment that would otherwise come before anything shows.
    sceneRaf = requestAnimationFrame(() => {
      sceneRaf = 0;
      sceneTimer = window.setTimeout(buildScene);
    });
    window.addEventListener('keydown', onKeyDown);
  });
  function buildScene() {
    sceneTimer = 0;
    scene = new GalleryScene(stage, albums, (index) => setActive(index), {
      fogColor: theme.background,
      startIndex,
      openOnReveal: linked.mode !== null && albums[startIndex]?.id === linked.album,
      listenOnReveal: linked.mode === 'listen',
      readOnReveal: linked.mode === 'booklet',
      bookletPages: (index) => bookletPages(albums[index]),
      onPage: (first, last, count, loops) => setBookletPage({ first, last, count, loops }),
      onProgress: (loaded, total) => setLoading({ loaded, total }),
      onPointer: setPointer,
      onPlayerButton: (button) => {
        pressTwin(button);
        previews.button(button);
      },
      onReady: () => {
        setReady(true);
        // Without the fade there is no transitionend to wait for.
        if (reducedMotion) reveal();
      },
    });
    // The dev server hands the scene to scripted checks (the scripts in scripts/, see the README), and
    // shows a slow motion control for its animations.
    if (import.meta.env.DEV) {
      Object.assign(window, { scene });
      const shown = scene;
      import('./devSpeed').then(({ mountDevSpeed }) => {
        if (scene === shown) removeDevSpeed = mountDevSpeed(shown);
      });
    }
  }
  onCleanup(() => {
    cancelAnimationFrame(sceneRaf);
    clearTimeout(sceneTimer);
    removeDevSpeed?.();
    clearTimeout(captionTimer);
    cancelAnimationFrame(percentRaf);
    window.removeEventListener('keydown', onKeyDown);
    scene?.destroy();
  });

  return (
    <main class="app-shell">
      <div class="stage" classList={{ 'is-hidden': !revealed() || aboutOpen(), 'has-bubble': canBubble }} ref={stage} role="region" aria-label="Interactive album gallery" {...cursor.surface} />
      <header class="masthead" classList={{ 'is-hidden': !revealed() }}>
        {/* From the player or the booklet, back to the gallery's start (a jump, see Gallery). An open
            case or the about page only closes, as with Close. Neither resets the gallery. On the row
            a click would do nothing, so there it is plain text: no link, no bubble, and the pointer
            reaches the row. */}
        <Show when={pointer().opened >= 0 || bookletOpen() || aboutOpen()} fallback={<span class="wordmark">Discography</span>}>
          <A class="wordmark" classList={{ 'has-bubble': canBubble }} href="/" {...cursor.button}
            onClick={(event) => {
              if (busy()) return event.preventDefault();
              if (listening() || bookletOpen()) return;
              event.preventDefault();
              if (aboutOpen()) closeAbout();
              else scene?.close();
            }}>Discography</A>
        </Show>
      </header>
      {/* The left corner: About on the row, Close or Eject in the other views (one fades out as the
          other fades in). */}
      <a class="corner-button about-link" classList={{ 'is-shown': aboutShown(), 'has-bubble': canBubble }} href="#/about" ref={aboutLink}
        tabIndex={aboutShown() ? 0 : -1} aria-hidden={!aboutShown()} onClick={(event) => { event.preventDefault(); openAbout(); }} {...cursor.button}>About</a>
      <button class="corner-button back-button" classList={{ 'is-shown': (pointer().opened >= 0 || aboutOpen()) && !leaving(), 'has-bubble': canBubble }} type="button" ref={backButton} onFocus={() => { backByKeyboard = backButton.matches(':focus-visible'); }} onClick={back}
        tabIndex={pointer().opened >= 0 || aboutOpen() ? 0 : -1} aria-hidden={pointer().opened < 0 && !aboutOpen()} {...cursor.button}>
        <span class="back-label" classList={{ 'is-switching': backSwitching() }}>{backLabel()}</span>
      </button>
      <a class="corner-button github-link" classList={{ 'is-shown': revealed(), 'has-bubble': canBubble }} href={repository} target="_blank" rel="noopener" {...cursor.button}>GitHub</a>
      {cursor.view()}
      {/* A hairline ring that fills clockwise from the top, with the count inside: no word. The count
          is hidden from screen readers, which would announce every step; they get the progress
          bar's value instead. pathLength 100 makes the dash offset the percentage left, whatever
          the radius. */}
      <div class="preloader" classList={{ 'is-done': loaded() }} aria-hidden={loaded()} onTransitionEnd={onPreloaderFaded}>
        <div class="preloader-ring" role="progressbar" aria-label="Loading albums" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress())}>
          <svg class="preloader-dial" viewBox="0 0 100 100" aria-hidden="true">
            <circle class="preloader-rail" cx="50" cy="50" r="49" />
            <circle class="preloader-arc" cx="50" cy="50" r="49" pathLength="100" style={{ 'stroke-dashoffset': 100 - percent() }} />
          </svg>
          <span class="preloader-count" aria-hidden="true">{Math.round(percent())}</span>
        </div>
      </div>
      {/* Under the player: its four buttons again, with the same symbols, once the disc has landed.
          They press the player's own buttons (so those move too), and keyboard focus on one lights
          its symbol on the player. */}
      <div class="transport" classList={{ 'is-shown': seated(), 'has-bubble': canBubble }} style={{ top: transportTop() === null ? undefined : `${transportTop()}px` }}
        role="group" aria-label="Player" inert={seated() ? undefined : true} {...cursor.surface}>
        <div class="transport-buttons" data-bubble-group>
          <For each={PLAYER_BUTTONS}>{(kind) => (
            <button class="transport-button" classList={{ 'is-pressed': pressed() === kind, 'has-bubble': canBubble }} type="button" ref={(element) => { if (kind === 'play') playButton = element; }}
              aria-label={BUTTON_NAMES[kind]} disabled={!previews.playable()} onClick={() => scene?.pressButton(kind)} {...lightOnFocus(kind)} {...cursor.button}>
              <svg viewBox="-1.5 -1.5 3 3" aria-hidden="true">{playerIcon(kind)}</svg>
            </button>
          )}</For>
        </div>
        {/* Phones only (CSS): the current track under the buttons, since the player's screen is too
            small to read there. Its line stays while stopped, so nothing moves when a track starts. */}
        <p class="transport-track" classList={{ 'is-switching': trackSwitching() }} aria-hidden="true">
          <Show when={trackShown() >= 0}>
            <span class="transport-track-number">{String(trackShown() + 1).padStart(2, '0')}</span>
            <span class="transport-track-title">{selected().tracks?.[trackShown()]?.title}</span>
          </Show>
        </p>
        <Show when={previews.failed()}><p class="transport-note" role="status">Song previews couldn't be loaded. Try again in a moment.</p></Show>
      </div>
      {/* The caption, with controls level with it either side. On the row it opens the album in front
          (Tab reaches it between the arrows); in the other views it only names it, Booklet and Listen
          doing the rest. Either side: the arrows while the row is browsed (and to turn the booklet's
          pages while it is out), Booklet and Listen while a case is open, Apple and Spotify (left) and
          Buy the CD (right) once the disc has landed in the player (with the transport row). Each
          pair fades out before the next fades in. */}
      <footer class="bottom-bar" classList={{ 'is-hidden': !revealed(), 'is-leaving': leaving() || aboutOpen() }}>
        <button class="case-action is-left" classList={{ 'is-shown': caseActions(), 'has-bubble': canBubble }} type="button" ref={bookletButton}
          inert={caseActions() ? undefined : true} onClick={() => { if (!busy()) scene?.openBooklet(); }} {...cursor.button}>Booklet</button>
        {/* Apple first: the previews are theirs. */}
        <span class="store-links is-left">
          <Show when={selected().appleMusic}>
            <a class="case-action store-link" classList={{ 'is-shown': seated(), 'has-bubble': canBubble }} href={appleLink()} target="_blank" rel="noopener"
              inert={seated() ? undefined : true} {...cursor.button}>Apple</a>
          </Show>
          <Show when={selected().spotify}>
            <a class="case-action store-link" classList={{ 'is-shown': seated(), 'has-bubble': canBubble }} href={spotifyLink()} target="_blank" rel="noopener"
              inert={seated() ? undefined : true} {...cursor.button}>Spotify</a>
          </Show>
        </span>
        <button class="album-arrow is-prev" ref={prevArrow} classList={{ 'is-shown': browsing() || pageArrows(), 'has-bubble': canBubble }} type="button"
          aria-label={bookletOpen() ? 'Previous booklet pages' : 'Previous album'} disabled={bookletOpen() ? bookletPage().first <= 0 : active() === 0}
          inert={browsing() || pageArrows() ? undefined : true} onClick={() => (bookletOpen() ? scene?.turnPage(-1) : scene?.step(-1))} {...cursor.button}>←</button>
        <div class="album-caption" classList={{ 'is-switching': captionHidden() }} aria-live="polite">
          <button class="album-name" classList={{ 'has-bubble': canBubble }} type="button" ref={captionButton} disabled={pointer().opened >= 0}
            aria-label={pointer().opened < 0 ? `Open ${selected().title} by ${selected().artist} (${selected().year})` : undefined}
            onClick={() => { if (!busy()) scene?.open(); }} {...cursor.button}>
            <span class="eyebrow">{selected().artist}<span class="eyebrow-separator">/</span>{selected().year}</span>
            <span class="album-title">{selected().title}</span>
          </button>
        </div>
        <button class="album-arrow is-next" ref={nextArrow} classList={{ 'is-shown': browsing() || pageArrows(), 'has-bubble': canBubble }} type="button"
          aria-label={bookletOpen() ? 'Next booklet pages' : 'Next album'} disabled={bookletOpen() ? !pagesAhead() : active() === albums.length - 1}
          inert={browsing() || pageArrows() ? undefined : true} onClick={() => (bookletOpen() ? scene?.turnPage(1) : scene?.step(1))} {...cursor.button}>→</button>
        <button class="case-action is-right" classList={{ 'is-shown': caseActions(), 'has-bubble': canBubble }} type="button" ref={listenButton}
          inert={caseActions() ? undefined : true} onClick={() => { if (!busy()) scene?.insert(); }} {...cursor.button}>Listen</button>
        <a class="case-action store-link is-right" classList={{ 'is-shown': seated(), 'has-bubble': canBubble }} href={buyLink()} target="_blank" rel="noopener"
          inert={seated() ? undefined : true} {...cursor.button}>Buy the CD</a>
      </footer>
      {/* The about page: what the project is (no album count, so it holds whatever the collection
          has), and a credit at the bottom, as on the old title screen. Over the row, which fades out meanwhile and comes back as it was. */}
      <section class="about" classList={{ 'is-shown': aboutOpen(), 'has-bubble': canBubble }} aria-label="About Discography"
        inert={aboutOpen() ? undefined : true} {...cursor.surface}>
        <div class="about-body">
          <p>
            Discography is an experiment in browsing music as physical CDs: each album in its
            plastic jewel case, with the booklet folded inside.
          </p>
          <p>
            Flick through the row of albums, turn a case over to read its back and spines, open it,
            leaf through the booklet, and put the disc on the player to hear 30-second song previews.
          </p>
          <p>
            Everything is drawn in the browser with three.js from the real artwork: official covers,
            scans of the printed discs, back inserts and booklets. The plastic, its scratches and the
            sheen of the discs were tuned against photos of real CDs rather than made to look stylised.
            The booklets turn with <a href={leafthrough} target="_blank" rel="noopener" classList={{ 'has-bubble': canBubble }} {...cursor.button}>LeafThrough</a>,
            a library I made for flipping through pages on the web.
          </p>
          <p>
            Covers, booklet scans and disc designs belong to their rights holders. Song previews come
            from Apple Music.
          </p>
        </div>
        <p class="about-credit">
          Made by <a href={website} target="_blank" rel="noopener" classList={{ 'has-bubble': canBubble }} {...cursor.button}>Dmytro Barylo</a>
        </p>
      </section>
      {/* LeafThrough has no DOM of its own in the scene, so the pages shown are announced here. */}
      <p class="sr-only" aria-live="polite">{pageArrows() ? `Booklet pages ${pageRange()} of ${bookletPage().count}` : ''}</p>
    </main>
  );
}

// The gallery's route: #/, #/<album>, or #/<album>/open, /listen or /booklet, and #/about (the same
// route, so the gallery stays as it is under the about page). The gallery writes it
// as it changes. Browsing the row replaces the history entry, so it doesn't fill the browser's
// history; each view (the open case, then the player or the booklet) adds one, and leaving a view
// in the page (Back, Escape, Close) goes back to the entry it came from. Every other change of the
// hash (the wordmark, the browser's Back and Forward, a link pasted into the tab) is a jump, which
// App plays as one move rather than as the steps in between.
function Gallery(props: { collection: Collection }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ album?: string; mode?: string }>();
  const link = untrack(() => galleryLink(params, location.pathname));
  // The route the gallery shows. While `returning`, it is going back to it through the history, and
  // a change written meanwhile waits in `queued`.
  let known = location.pathname;
  let returning = false;
  let queued: string | null = null;
  // The tab's history index this page started at (the router stamps each entry's index on its
  // state as `_depth`). Entries beyond it were pushed by this page, so Close can step back over
  // them; on the start entry (a link straight into a view, or a reload there) it replaces instead.
  // Before, the reveal's two writes in one tick were merged by the router into a replace of the
  // start entry carrying a parent, and stepping back from it left the site.
  const entryDepth = () => (window.history.state?._depth as number | undefined) ?? window.history.length - 1;
  const startDepth = entryDepth();
  // How deep a view is: 0 for the row, 1 for the open case or the about page, 2 for the player or
  // the booklet.
  const depth = (path: string) => {
    if (path === aboutPath) return 1;
    const mode = path.split('/')[2];
    return !mode ? 0 : mode === 'open' ? 1 : 2;
  };
  const [jump, setJump] = createSignal<GalleryLink | null>(null, { equals: false });

  // The tab names the album while the route is one of its views (open case, player, booklet); on
  // the row and the about page it is the page's own name. From the route, which the browser's Back
  // changes before the scene follows, so the tab never lags a view it has left.
  createEffect(() => {
    const [, id, mode] = location.pathname.split('/');
    const album = mode ? props.collection.albums.find((item) => item.id === id) : undefined;
    document.title = album ? `Discography · ${album.title} · ${album.artist}` : 'Discography';
  });

  function write(path: string) {
    if (returning) {
      queued = path;
      return;
    }
    if (path === known) return;
    const from = known;
    known = path;
    if (depth(path) < depth(from) && entryDepth() > startDepth && window.history.state?.parent === path) {
      returning = true;
      navigate(-1);
    } else if (depth(path) > depth(from)) {
      navigate(path, { scroll: false, state: { parent: from } });
    } else {
      navigate(path, { replace: true, scroll: false, state: { parent: window.history.state?.parent } });
    }
  }

  createEffect(on(() => location.pathname, (path) => {
    if (path !== known) {
      known = path;
      returning = false;
      queued = null;
      setJump(galleryLink(params, path));
    } else if (returning) {
      returning = false;
      const next = queued;
      queued = null;
      if (next) write(next);
    }
  }, { defer: true }));

  return <App collection={props.collection} link={link} jump={jump} onPath={write} />;
}

// The page is the collection's gallery, or why it couldn't load. An unknown album, or any other
// hash, goes to the gallery's start.
function Root() {
  const [view, setView] = createSignal<{ collection?: Collection; error?: string } | null>(null);
  moveQueryToHash();
  loadCollection().then(
    (collection) => {
      applyTheme(collection.theme, 'Discography');
      setView({ collection });
    },
    (error: Error) => setView({ error: error.message }),
  );
  return (
    <Switch>
      <Match when={view()?.collection} keyed>{(collection) => (
        <HashRouter>
          <Route path={[aboutPath, '/:album?/:mode?']} matchFilters={{ album: collection.albums.map((album) => album.id), mode: galleryModes }} component={() => <Gallery collection={collection} />} />
          <Route path="*" component={() => <Navigate href="/" />} />
        </HashRouter>
      )}</Match>
      <Match when={view()?.error} keyed>{(error) => <p class="load-error">{error}</p>}</Match>
    </Switch>
  );
}

const dispose = render(() => <Root />, document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.dispose(dispose);
