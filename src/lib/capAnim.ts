/**
 * Caption animation engine.
 *
 * One source of truth for BOTH the live editor overlay (CSS animations) and the
 * canvas export renderer (which has to interpolate the same motion by hand, so
 * the downloaded MP4 matches what the user previewed).
 *
 * It also backs "My Animations": users upload a .css file containing
 * `@keyframes`, we sanitise it, namespace it per user, inject it for the live
 * preview and parse it into sampled keyframes for the export renderer.
 */

/* ══════════════════════ model ══════════════════════ */

export interface AnimStop {
  /** 0…1 along the animation */
  p: number;
  opacity?: number;
  /** translate, in px at a 720p reference height (scaled by the renderer) */
  tx?: number;
  ty?: number;
  /** translate as a fraction of the token's own size (from % / em units) */
  txEm?: number;
  tyEm?: number;
  sx?: number;
  sy?: number;
  /** rotation in degrees */
  rot?: number;
  blur?: number;
}

export interface AnimSample {
  opacity: number;
  tx: number; ty: number;
  txEm: number; tyEm: number;
  sx: number; sy: number;
  rot: number;
  blur: number;
}

export interface AnimTrack {
  stops: AnimStop[];
  /** easing applied between stops */
  ease: 'linear' | 'ease' | 'back';
}

export const NEUTRAL: AnimSample = { opacity: 1, tx: 0, ty: 0, txEm: 0, tyEm: 0, sx: 1, sy: 1, rot: 0, blur: 0 };

/* ══════════════════════ built-ins ══════════════════════
 * These mirror the .cap-* classes in globals.css exactly. If you change one,
 * change the other.                                                          */

export const BUILTIN_TRACKS: Record<string, AnimTrack> = {
  fade: { ease: 'ease', stops: [{ p: 0, opacity: 0 }, { p: 1, opacity: 1 }] },
  pop: {
    ease: 'back',
    stops: [
      { p: 0, opacity: 0, sx: 0.4, sy: 0.4 },
      { p: 0.65, opacity: 1, sx: 1.15, sy: 1.15 },
      { p: 1, opacity: 1, sx: 1, sy: 1 },
    ],
  },
  zoom: { ease: 'ease', stops: [{ p: 0, opacity: 0, sx: 1.7, sy: 1.7 }, { p: 1, opacity: 1, sx: 1, sy: 1 }] },
  scale: { ease: 'ease', stops: [{ p: 0, opacity: 0.3, sx: 0.55, sy: 0.55 }, { p: 1, opacity: 1, sx: 1, sy: 1 }] },
  slide: { ease: 'ease', stops: [{ p: 0, opacity: 0, tx: -56 }, { p: 1, opacity: 1, tx: 0 }] },
  slideup: { ease: 'ease', stops: [{ p: 0, opacity: 0, ty: 48 }, { p: 1, opacity: 1, ty: 0 }] },
};

/* ══════════════════════ sampling ══════════════════════ */

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
// approximates cubic-bezier(.2,1.4,.4,1) — the overshoot used by .cap-pop
const easeBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function applyEase(kind: AnimTrack['ease'], t: number) {
  if (kind === 'linear') return t;
  return kind === 'back' ? easeBack(t) : easeOut(t);
}

const pick = (s: AnimStop, k: keyof AnimStop, fallback: number) =>
  (s[k] as number | undefined) ?? fallback;

/** Sample a track at progress `p` (0…1, clamped). */
export function sampleTrack(track: AnimTrack | null | undefined, p: number): AnimSample {
  if (!track || !track.stops.length) return NEUTRAL;
  const t = Math.max(0, Math.min(1, p));
  const stops = track.stops;

  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].p && t <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break; }
  }
  if (t <= stops[0].p) { a = stops[0]; b = stops[0]; }
  if (t >= stops[stops.length - 1].p) { a = b = stops[stops.length - 1]; }

  const span = b.p - a.p;
  const local = span <= 0 ? 1 : applyEase(track.ease, (t - a.p) / span);
  const mix = (k: keyof AnimStop, def: number) => {
    const av = pick(a, k, def), bv = pick(b, k, def);
    return av + (bv - av) * local;
  };

  return {
    opacity: mix('opacity', 1),
    tx: mix('tx', 0), ty: mix('ty', 0),
    txEm: mix('txEm', 0), tyEm: mix('tyEm', 0),
    sx: mix('sx', 1), sy: mix('sy', 1),
    rot: mix('rot', 0),
    blur: mix('blur', 0),
  };
}

/* ══════════════════════ CSS @keyframes parsing ══════════════════════ */

function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Pull `@keyframes name { … }` blocks out of a stylesheet, brace-balanced. */
export function extractKeyframeBlocks(css: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const src = stripComments(css);
  const re = /@(?:-webkit-)?keyframes\s+("[^"]+"|'[^']+'|[\w-]+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    if (depth !== 0) break;
    const name = m[1].replace(/^['"]|['"]$/g, '');
    out.push({ name, body: src.slice(re.lastIndex, i - 1) });
    re.lastIndex = i;
  }
  return out;
}

const NUM = '([-+]?[0-9]*\\.?[0-9]+)';

function readLength(value: string): { px: number; em: number } {
  const m = value.trim().match(new RegExp(`^${NUM}\\s*(px|%|em|rem|vh|vw)?$`, 'i'));
  if (!m) return { px: 0, em: 0 };
  const n = parseFloat(m[1]);
  const unit = (m[2] || 'px').toLowerCase();
  // % and em are relative to the animated element (its own size / font size).
  if (unit === '%' || unit === 'em' || unit === 'rem') return { px: 0, em: unit === '%' ? n / 100 : n };
  return { px: n, em: 0 };
}

function parseTransform(value: string, into: AnimStop) {
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    const fn = m[1].toLowerCase();
    const args = m[2].split(',').map((x) => x.trim()).filter(Boolean);
    const num = (i: number) => parseFloat(args[i] || '0') || 0;
    switch (fn) {
      case 'translatex': { const l = readLength(args[0] || '0'); into.tx = (into.tx || 0) + l.px; into.txEm = (into.txEm || 0) + l.em; break; }
      case 'translatey': { const l = readLength(args[0] || '0'); into.ty = (into.ty || 0) + l.px; into.tyEm = (into.tyEm || 0) + l.em; break; }
      case 'translate':
      case 'translate3d': {
        const lx = readLength(args[0] || '0'); const ly = readLength(args[1] || '0');
        into.tx = (into.tx || 0) + lx.px; into.txEm = (into.txEm || 0) + lx.em;
        into.ty = (into.ty || 0) + ly.px; into.tyEm = (into.tyEm || 0) + ly.em;
        break;
      }
      case 'scale': into.sx = num(0); into.sy = args.length > 1 ? num(1) : num(0); break;
      case 'scale3d': into.sx = num(0); into.sy = num(1); break;
      case 'scalex': into.sx = num(0); break;
      case 'scaley': into.sy = num(0); break;
      case 'rotate':
      case 'rotatez': {
        const a = (args[0] || '0deg').trim();
        const deg = /rad$/i.test(a) ? (parseFloat(a) * 180) / Math.PI : /turn$/i.test(a) ? parseFloat(a) * 360 : parseFloat(a);
        into.rot = deg || 0;
        break;
      }
      default: break;
    }
  }
}

/** Parse one `@keyframes` body into a sampled track. */
export function parseKeyframeBody(body: string, ease: AnimTrack['ease'] = 'ease'): AnimTrack {
  const stops: AnimStop[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const selectors = m[1].split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    const decls = m[2];
    const base: AnimStop = { p: 0 };
    for (const d of decls.split(';')) {
      const idx = d.indexOf(':');
      if (idx < 0) continue;
      const prop = d.slice(0, idx).trim().toLowerCase().replace(/^-webkit-/, '');
      const value = d.slice(idx + 1).trim();
      if (prop === 'transform') parseTransform(value, base);
      else if (prop === 'opacity') base.opacity = Math.max(0, Math.min(1, parseFloat(value)));
      else if (prop === 'scale') { const n = parseFloat(value); if (!isNaN(n)) { base.sx = n; base.sy = n; } }
      else if (prop === 'rotate') { const n = parseFloat(value); if (!isNaN(n)) base.rot = n; }
      else if (prop === 'translate') parseTransform(`translate(${value})`, base);
      else if (prop === 'filter') { const b = value.match(/blur\(\s*([\d.]+)px\s*\)/i); if (b) base.blur = parseFloat(b[1]); }
    }
    for (const sel of selectors) {
      let p: number | null = null;
      if (sel === 'from') p = 0;
      else if (sel === 'to') p = 1;
      else if (/%$/.test(sel)) { const n = parseFloat(sel); if (!isNaN(n)) p = n / 100; }
      if (p === null) continue;
      stops.push({ ...base, p: Math.max(0, Math.min(1, p)) });
    }
  }
  stops.sort((a, b) => a.p - b.p);
  return { stops, ease };
}

/* ══════════════════════ user CSS sanitising ══════════════════════ */

/** Properties a user animation may set. Anything else is stripped. */
const ALLOWED_PROPS = new Set([
  'transform', 'opacity', 'filter', 'color', 'background-color', 'letter-spacing',
  'word-spacing', 'text-shadow', '-webkit-text-stroke', '-webkit-text-stroke-color',
  '-webkit-text-stroke-width', 'scale', 'rotate', 'translate', 'visibility',
  'font-weight', 'font-size', 'text-decoration-color', 'clip-path',
]);

const FORBIDDEN = /(url\s*\(|expression\s*\(|javascript\s*:|@import|<|>|behavior\s*:|binding\s*:)/i;

export interface SanitizedAnimation {
  /** the cleaned stylesheet, keyframes only, names left as authored */
  css: string;
  /** the @keyframes names found, in order */
  names: string[];
  /** parsed tracks by name, for the canvas export renderer */
  tracks: Record<string, AnimTrack>;
}

/**
 * Accepts a user-uploaded .css file, throws away everything that is not an
 * `@keyframes` block, and drops any declaration that isn't a safe visual
 * property. The result can be injected into the page without letting an
 * uploaded file reach the network, load fonts/images, or escape its selector.
 */
export function sanitizeAnimationCss(input: string): SanitizedAnimation {
  const css = stripComments(String(input || ''));
  if (FORBIDDEN.test(css)) throw new Error('Animation CSS may not contain url(), @import or HTML.');

  const blocks = extractKeyframeBlocks(css);
  if (!blocks.length) throw new Error('No @keyframes found. Export or write a CSS file containing at least one @keyframes rule.');
  if (blocks.length > 12) throw new Error('That file has too many @keyframes rules (max 12).');

  const names: string[] = [];
  const tracks: Record<string, AnimTrack> = {};
  const outBlocks: string[] = [];

  for (const b of blocks) {
    if (!/^[A-Za-z][\w-]{0,48}$/.test(b.name)) throw new Error(`Unsupported @keyframes name "${b.name}".`);

    const cleanedSteps: string[] = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(b.body))) {
      const selectors = m[1].split(',').map((x) => x.trim().toLowerCase())
        .filter((x) => x === 'from' || x === 'to' || /^\d+(\.\d+)?%$/.test(x));
      if (!selectors.length) continue;
      const decls = m[2].split(';').map((d) => {
        const idx = d.indexOf(':');
        if (idx < 0) return null;
        const prop = d.slice(0, idx).trim().toLowerCase();
        const value = d.slice(idx + 1).trim();
        if (!ALLOWED_PROPS.has(prop) || !value || value.length > 200) return null;
        return `${prop}: ${value}`;
      }).filter(Boolean) as string[];
      if (!decls.length) continue;
      cleanedSteps.push(`${selectors.join(',')} { ${decls.join('; ')} }`);
    }
    if (!cleanedSteps.length) continue;

    names.push(b.name);
    tracks[b.name] = parseKeyframeBody(b.body, 'ease');
    outBlocks.push(`@keyframes ${b.name} { ${cleanedSteps.join(' ')} }`);
  }

  if (!names.length) throw new Error('None of the @keyframes contained a supported property (transform, opacity, filter, color…).');
  if (css.length > 40_000) throw new Error('Animation file is too large (max 40 KB).');

  return { css: outBlocks.join('\n'), names, tracks };
}

/* ══════════════════════ per-user namespacing ══════════════════════ */

export interface CustomAnimation {
  id: string;
  name: string;      // display name
  css: string;       // sanitised @keyframes, authored names
  keyframe: string;  // which @keyframes name to play
  duration?: number; // seconds, optional override
}

/** Transition ids for user animations look like `custom:<docId>`. */
export const CUSTOM_PREFIX = 'custom:';
export const isCustomAnim = (id?: string) => !!id && id.startsWith(CUSTOM_PREFIX);
export const customAnimId = (id: string) => `${CUSTOM_PREFIX}${id}`;
export const customAnimDocId = (id: string) => id.slice(CUSTOM_PREFIX.length);

/** Rewrite the keyframe names so two users' "bounce" can't collide. */
export function namespaceAnimationCss(a: CustomAnimation): { css: string; className: string; keyframe: string } {
  const ns = `ca_${a.id.replace(/[^\w]/g, '')}`;
  let css = a.css;
  for (const { name } of extractKeyframeBlocks(a.css)) {
    css = css.replace(new RegExp(`(@keyframes\\s+)${name}(\\s*\\{)`, 'g'), `$1${ns}_${name}$2`);
  }
  const keyframe = `${ns}_${a.keyframe}`;
  const className = `cap-${ns}`;
  css += `\n.${className} { animation-name: ${keyframe}; animation-fill-mode: both; animation-timing-function: ease; }`;
  return { css, className, keyframe };
}

/** The track the export renderer should use for a transition id. */
export function trackFor(id: string | undefined, customs: CustomAnimation[]): AnimTrack | null {
  if (!id || id === 'none') return null;
  if (isCustomAnim(id)) {
    const doc = customs.find((c) => c.id === customAnimDocId(id));
    if (!doc) return null;
    const blocks = extractKeyframeBlocks(doc.css);
    const block = blocks.find((b) => b.name === doc.keyframe) || blocks[0];
    return block ? parseKeyframeBody(block.body, 'ease') : null;
  }
  return BUILTIN_TRACKS[id] || null;
}
