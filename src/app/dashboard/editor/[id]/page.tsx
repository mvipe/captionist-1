'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authFetch } from '@/lib/authFetch';
import { storage, auth as fbAuth } from '@/lib/firebaseClient';
import { ref as fontStorageRef, uploadBytes as uploadFontBytes, getDownloadURL as getFontDownloadURL } from 'firebase/storage';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import type { Project } from '@/types';
import {
  sanitizeAnimationCss, namespaceAnimationCss, trackFor, sampleTrack, NEUTRAL,
  isCustomAnim, customAnimId, customAnimDocId, type CustomAnimation, type AnimSample,
} from '@/lib/capAnim';
import {
  ArrowLeft, Download, FileText, Loader2, Save, Trash2, Search, Settings2,
  Play, Pause, Volume2, VolumeX, Maximize2, ZoomIn, ZoomOut, RotateCcw,
  Sparkles, Plus, ChevronLeft, ChevronRight, X, ChevronDown, ChevronUp,
  Eraser, Clock, LayoutGrid, Palette, Check, Ban, Circle, Search as SearchIcon,
  ChevronsLeft, ChevronsUp, MoveHorizontal, ZoomIn as ZoomIcon, Type as TypeIcon,
  Volume2 as SpeakerIcon, Zap, Languages, Bookmark, AlignLeft, AlignCenter, AlignRight,
  Upload, Film,
} from 'lucide-react';

/* ══════════════════════ types ══════════════════════ */

interface Seg {
  id: number; start: number; end: number; text: string;
  style?: Partial<CapStyle>;
  /** How many rows this caption is laid out across. Set by the "Lines" control
   *  in Caption Tools; 1 (or undefined) means a single row that wraps only if
   *  it runs out of box width. */
  lines?: number;
}
interface CapStyle {
  fontFamily: string; fontWeight: number; fontSize: number;
  bold: boolean; italic: boolean; underline: boolean; uppercase: boolean;
  align: 'left' | 'center' | 'right';
  posX: number; posY: number; boxWidth: number;
  colorMode: 'solid' | 'gradient'; color: string; color2: string;
  letterSpacing: number; lineSpacing: number;
  dropShadow: boolean; textStroke: boolean; background: boolean; glow: boolean;
  bgColor: string;
  transition: string; wordTransition: string;
  speedMode: 'dynamic' | 'manual'; speed: number;
  emphasisMode: 'emphasize' | 'spotlight';
  emColorMode: 'solid' | 'gradient'; emColor: string; emColor2: string;
  emSize: number; emFont: string; emWeight: number;
  emBold: boolean; emItalic: boolean; emUnderline: boolean; emUppercase: boolean;
  layout: 'splash' | 'center';
}

const DEFAULT_STYLE: CapStyle = {
  fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 32,
  bold: false, italic: false, underline: false, uppercase: false,
  align: 'center', posX: 50, posY: 77.8, boxWidth: 92,
  colorMode: 'solid', color: '#FFFFFF', color2: '#4f8cff',
  letterSpacing: 0, lineSpacing: 1.35,
  dropShadow: false, textStroke: false, background: false, glow: false,
  bgColor: 'rgba(0,0,0,0.72)',
  transition: 'none', wordTransition: 'none',
  speedMode: 'dynamic', speed: 70,
  emphasisMode: 'emphasize',
  emColorMode: 'solid', emColor: '#C8FF00', emColor2: '#38D2F5',
  emSize: 8.8, emFont: "'Inter', sans-serif", emWeight: 900,
  emBold: true, emItalic: false, emUnderline: false, emUppercase: false,
  layout: 'center',
};

const SCRIPT_FB = "'Noto Sans Devanagari','Noto Sans','Noto Sans Tamil','Noto Sans Bengali',sans-serif";
const withScript = (f: string) => `${f}, ${SCRIPT_FB}`;

const FONTS = [
  { label: 'Inter', family: "'Inter', sans-serif" },
  { label: 'Poppins', family: "'Poppins', sans-serif" },
  { label: 'Montserrat', family: "'Montserrat', sans-serif" },
  { label: 'Roboto', family: "'Roboto', sans-serif" },
  { label: 'Oswald', family: "'Oswald', sans-serif" },
  { label: 'Bebas Neue', family: "'Bebas Neue', sans-serif" },
  { label: 'Anton', family: "'Anton', sans-serif" },
  { label: 'Luckiest Guy', family: "'Luckiest Guy', cursive" },
  { label: 'Archivo Black', family: "'Archivo Black', sans-serif" },
  { label: 'Playfair Display', family: "'Playfair Display', serif" },
  { label: 'Noto Sans Devanagari', family: "'Noto Sans Devanagari', sans-serif" },
];
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Poppins:wght@400;600;700;800&family=Montserrat:wght@400;600;700;800&family=Roboto:wght@400;500;700&family=Oswald:wght@400;600;700&family=Bebas+Neue&family=Anton&family=Luckiest+Guy&family=Archivo+Black&family=Playfair+Display:wght@600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800;900&family=Noto+Sans:wght@400;600;700;800&display=swap';

const WEIGHTS = [
  { label: 'Regular', value: 400 }, { label: 'Medium', value: 500 },
  { label: 'Semibold', value: 600 }, { label: 'Bold', value: 700 }, { label: 'Black', value: 900 },
];

interface Tpl { name: string; premium?: boolean; patch: Partial<CapStyle>; }
const TEMPLATES: Tpl[] = [
  /* word-by-word cascade (Kalakar style) */
  { name: 'Kalakar', patch: { fontFamily: "'Inter', sans-serif", fontWeight: 900, color: '#FFFFFF', emColor: '#C8FF00', uppercase: true, layout: 'splash', background: false, dropShadow: true, transition: 'none', wordTransition: 'pop' } },
  { name: 'Mota', premium: true, patch: { fontFamily: "'Archivo Black', sans-serif", fontWeight: 400, color: '#FFFFFF', emColor: '#22c55e', uppercase: true, dropShadow: true, background: false, transition: 'none', wordTransition: 'zoom' } },
  { name: 'Neon Pop', patch: { fontFamily: "'Bebas Neue', sans-serif", fontWeight: 400, fontSize: 40, color: '#38f5c8', emColor: '#ffffff', uppercase: true, glow: true, background: false, transition: 'none', wordTransition: 'pop' } },
  { name: 'Impact', patch: { fontFamily: "'Archivo Black', sans-serif", fontWeight: 400, color: '#FFD400', emColor: '#FFFFFF', uppercase: true, textStroke: true, dropShadow: true, background: false, transition: 'none', wordTransition: 'pop' } },
  { name: 'Slide Bold', patch: { fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: '#FFFFFF', emColor: '#ff3d77', uppercase: true, dropShadow: true, background: false, transition: 'none', wordTransition: 'slide' } },
  { name: 'Deep Glow', premium: true, patch: { fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#ff3df0', emColor: '#ffffff', uppercase: true, glow: true, background: false, transition: 'none', wordTransition: 'fade' } },
  /* whole-line transition */
  { name: 'Ali Abdaal', premium: true, patch: { fontFamily: "'Inter', sans-serif", fontWeight: 800, color: '#111827', emColor: '#9CA3AF', background: true, bgColor: '#FFFFFF', uppercase: false, dropShadow: false, layout: 'center', transition: 'fade', wordTransition: 'none' } },
  { name: 'Clean Motion', patch: { fontFamily: "'Poppins', sans-serif", fontWeight: 700, color: '#FFFFFF', emColor: '#4f8cff', background: false, dropShadow: true, uppercase: false, transition: 'slideup', wordTransition: 'none' } },
  { name: 'Tabahi', premium: true, patch: { fontFamily: "'Anton', sans-serif", fontWeight: 400, color: '#FFFFFF', italic: true, uppercase: true, textStroke: true, dropShadow: true, background: false, transition: 'slide', wordTransition: 'none' } },
  { name: 'Sunset', patch: { fontFamily: "'Poppins', sans-serif", fontWeight: 800, colorMode: 'gradient', color: '#ff8a3d', color2: '#ff3d77', uppercase: true, background: false, dropShadow: true, transition: 'scale', wordTransition: 'none' } },
  { name: 'Lower Third', patch: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, color: '#FFFFFF', background: true, bgColor: 'rgba(0,0,0,0.72)', align: 'left', posX: 22, posY: 88, uppercase: false, transition: 'slideup', wordTransition: 'none' } },
  /* no transition */
  { name: 'Seedha Saadha', premium: true, patch: { fontFamily: "'Inter', sans-serif", fontWeight: 900, color: '#FFFFFF', emColor: '#C8FF00', background: true, bgColor: 'rgba(0,0,0,0.92)', uppercase: true, transition: 'none', wordTransition: 'none' } },
  { name: 'Minimal', patch: { fontFamily: "'Inter', sans-serif", fontWeight: 600, color: '#FFFFFF', emColor: '#4f8cff', background: false, dropShadow: true, uppercase: false, transition: 'none', wordTransition: 'none' } },
];

const TRANSITIONS = [
  { id: 'none', name: 'None' }, { id: 'fade', name: 'Fade' }, { id: 'pop', name: 'Pop' },
  { id: 'zoom', name: 'Zoom' }, { id: 'scale', name: 'Scale' },
  { id: 'slide', name: 'Slide Left / Right' }, { id: 'slideup', name: 'Slide Up / Down' },
];
const ANIM: Record<string, string> = {
  none: '', fade: 'cap-fade', pop: 'cap-pop', zoom: 'cap-zoom',
  scale: 'cap-scale', slide: 'cap-slide', slideup: 'cap-slideup',
};
/** Built-in transition ids map to a .cap-* class; uploaded ones to .cap-ca_<id>. */
const animClass = (id?: string) => {
  if (!id || id === 'none') return '';
  if (isCustomAnim(id)) return `cap-ca_${customAnimDocId(id).replace(/[^\w]/g, '')}`;
  return ANIM[id] || '';
};

/* ══════════════════════ helpers ══════════════════════ */

/** Seek and resolve only once a frame for that position has really been
 *  decoded, so whatever draws next gets picture rather than blank canvas. */
function seekToFrame(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      v.removeEventListener('seeked', onSeeked);
      clearTimeout(timer);
      resolve();
    };
    const onSeeked = () => {
      // rVFC fires when a frame is actually presented; fall back to readyState.
      const anyV = v as any;
      if (typeof anyV.requestVideoFrameCallback === 'function') anyV.requestVideoFrameCallback(() => finish());
      else if (v.readyState >= 2) finish();
      else v.addEventListener('canplay', finish, { once: true });
    };
    const timer = setTimeout(finish, 4000);   // never hang the export on this
    v.addEventListener('seeked', onSeeked);
    if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) { v.currentTime = t; onSeeked(); }
    else v.currentTime = t;
  });
}

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, '0');
const srtTime = (t: number) => `${pad(t / 3600)}:${pad((t % 3600) / 60)}:${pad(t % 60)},${pad((t - Math.floor(t)) * 1000, 3)}`;
const tc = (t: number) => `${pad(t / 3600)}:${pad((t % 3600) / 60)}:${pad(t % 60)}:${pad((t % 1) * 100)}`;
const clockLbl = (t: number) => `${pad(t / 60)}:${pad(t % 60)}.000`;
const buildSrt = (s: Seg[]) => s.map((x, i) => `${i + 1}\n${srtTime(x.start)} --> ${srtTime(x.end)}\n${x.text}\n`).join('\n');

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2B00}-\u{2BFF}\uFE0F]/gu;

interface WordTok { text: string; start: number; end: number; wi: number; segIdx: number; key: string; }

function segWords(seg: Seg, segIdx: number): WordTok[] {
  const parts = seg.text.split(/\s+/).filter(Boolean);
  const total = parts.reduce((a, w) => a + w.length, 0) || 1;
  const dur = Math.max(0.12, seg.end - seg.start);
  let t = seg.start;
  return parts.map((w, wi) => {
    const slice = (w.length / total) * dur;
    const tok: WordTok = { text: w, start: t, end: t + slice, wi, segIdx, key: `${seg.id}:${wi}` };
    t += slice;
    return tok;
  });
}

function waveHeights(count: number): number[] {
  const out: number[] = []; let seed = 1337;
  for (let i = 0; i < count; i++) {
    seed = (seed * 9301 + 49297) % 233280; const r = seed / 233280;
    const env = 0.35 + 0.65 * Math.abs(Math.sin(i / 7) * Math.cos(i / 23));
    out.push(0.12 + r * 0.55 * env);
  }
  return out;
}
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean); const lines: string[] = []; let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines.length ? lines : [text];
}
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
/** Distribute word tokens across `lines` rows as evenly as possible.
 *  Used by BOTH the live overlay and the canvas export renderer so a caption
 *  laid out over two lines looks the same in the preview and in the file. */
function rowsOf<T>(items: T[], lines: number): T[][] {
  const n = Math.max(1, Math.min(lines || 1, items.length || 1));
  if (n <= 1) return [items];
  const out: T[][] = [];
  const per = Math.ceil(items.length / n);
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
  return out.length ? out : [items];
}

/* Split a caption into chunks of `wordsPerLine × lines` words (Kalakar
   word-style), distributing timing proportionally by character count.
   `lines` is recorded on each chunk so the renderers know to stack it. */
function splitSegWords(s: Seg, wordsPerLine: number, lines = 1): Seg[] {
  const perCap = Math.max(1, wordsPerLine) * Math.max(1, lines);
  const words = s.text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= perCap) return [{ ...s, lines }];
  const dur = Math.max(0.2, s.end - s.start);
  const totalChars = words.reduce((a, w) => a + w.length, 0) || 1;
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += perCap) chunks.push(words.slice(i, i + perCap));
  let t = s.start;
  return chunks.map((c, i) => {
    const chars = c.reduce((a, w) => a + w.length, 0);
    const sl = (chars / totalChars) * dur;
    const seg: Seg = { id: s.id * 1000 + i, start: t, end: Math.min(s.end, t + sl), text: c.join(' '), style: s.style, lines };
    t += sl;
    return seg;
  });
}

/** Character-budget split: up to `maxChars` per line across `lines` lines. */
function splitSeg(s: Seg, maxChars: number, lines: number): Seg[] {
  const cap = Math.max(6, maxChars) * Math.max(1, lines);
  const text = s.text.trim();
  if (text.length <= cap) return [{ ...s, lines }];
  const words = text.split(/\s+/); const chunks: string[] = []; let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (t.length > cap && line) { chunks.push(line); line = w; } else line = t; }
  if (line) chunks.push(line);
  const dur = Math.max(0.2, s.end - s.start); const total = chunks.reduce((a, c) => a + c.length, 0) || 1;
  let t = s.start;
  return chunks.map((c, i) => { const sl = (c.length / total) * dur; const seg: Seg = { id: s.id * 1000 + i, start: t, end: Math.min(s.end, t + sl), text: c, style: s.style, lines }; t += sl; return seg; });
}

/* ══════════════════════ component ══════════════════════ */

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tlRef = useRef<HTMLDivElement>(null);

  // audio graph
  const acRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const chainRef = useRef<AudioNode[]>([]);

  const [project, setProject] = useState<Project | null>(null);
  const [segments, setSegments] = useState<Seg[]>([]);
  const [wordStyles, setWordStyles] = useState<Record<string, Partial<CapStyle>>>({});
  const [title, setTitle] = useState('');
  const [style, setStyle] = useState<CapStyle>(DEFAULT_STYLE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [activeIdx, setActiveIdx] = useState(-1);

  const [tab, setTab] = useState<'text' | 'templates' | 'transitions' | 'audio'>('text');
  const [tlMode, setTlMode] = useState<'word' | 'line'>('line');
  const [trMode, setTrMode] = useState<'line' | 'word'>('line');
  const [pxPerSec, setPxPerSec] = useState(26);
  const [search, setSearch] = useState('');
  const [bump, setBump] = useState(0);

  const [selLine, setSelLine] = useState(-1);
  /* Multi-selection of captions. `selLine` stays the "primary" one (it drives
     the per-line styling scope); `selLines` is everything highlighted, so a
     range can be deleted in one go. */
  const [selLines, setSelLines] = useState<Set<number>>(new Set());
  const selAnchorRef = useRef(-1);
  const selLinesRef = useRef<Set<number>>(new Set());
  const selLineRef = useRef(-1);
  const removeSelectedRef = useRef<() => void>(() => {});
  const selectAllRef = useRef<() => void>(() => {});
  const clearSelRef = useRef<() => void>(() => {});
  const [selWords, setSelWords] = useState<Set<string>>(new Set());

  /* explicit editing scope — defaults to ALL. Selecting words switches to word
     scope (that's an explicit act); clicking captions to navigate does NOT
     hijack the scope — "This Line" is chosen only via its pill. */
  const [txtScope, setTxtScope] = useState<'all' | 'line' | 'word'>('all');
  const [trScope, setTrScope] = useState<'all' | 'line'>('all');
  useEffect(() => {
    if (selWords.size > 0) setTxtScope('word');
    else setTxtScope((s) => (s === 'word' ? 'all' : s));
  }, [selWords]);
  useEffect(() => {
    if (selLine < 0) { setTxtScope((s) => (s === 'line' ? 'all' : s)); setTrScope((s) => (s === 'line' ? 'all' : s)); }
  }, [selLine]);

  const [showTools, setShowTools] = useState(false);
  const [maxChars, setMaxChars] = useState(24);
  const [wordsPer, setWordsPer] = useState<'1' | '2' | '3' | 'chars'>('3');
  const [lineCount, setLineCount] = useState(1);
  const [delay, setDelay] = useState(0);

  const [lineStylingFor, setLineStylingFor] = useState<number | null>(null);
  const [tplTab, setTplTab] = useState<'builtin' | 'presets'>('builtin');
  const [tplSearch, setTplSearch] = useState('');
  const [appliedTpl, setAppliedTpl] = useState<string | null>(null);
  const [presets, setPresets] = useState<{ id?: string; name: string; patch: Partial<CapStyle> }[]>([]);

  const [exportOpen, setExportOpen] = useState(false);
  const [expType, setExpType] = useState<'video' | 'srt' | 'txt'>('video');
  const [expRes, setExpRes] = useState<'720' | '1080'>('720');
  const [rendering, setRendering] = useState(false);
  const [pct, setPct] = useState(0);

  const [cleanOn, setCleanOn] = useState(false);
  const [romanOn, setRomanOn] = useState(false);
  const [romanMap, setRomanMap] = useState<Record<number, string>>({});
  const [romanizing, setRomanizing] = useState(false);

  const [mobilePanel, setMobilePanel] = useState<'none' | 'captions' | 'inspector'>('none');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => { selLinesRef.current = selLines; }, [selLines]);
  useEffect(() => { selLineRef.current = selLine; }, [selLine]);

  const markDirty = () => setDirty(true);
  const isFree = (user?.plan || 'free') === 'free';

  /* fonts */
  useEffect(() => {
    if (document.querySelector('link[data-ed-fonts]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_HREF; l.dataset.edFonts = '1';
    document.head.appendChild(l);
  }, []);

  /* presets + custom fonts + custom animations are stored per-user in Firestore */
  useEffect(() => {
    (async () => {
      try { const r = await authFetch('/api/presets'); if (r.ok) setPresets((await r.json()).presets || []); } catch {}
      try { const r = await authFetch('/api/fonts'); if (r.ok) setCustomFonts((await r.json()).fonts || []); } catch {}
      try { const r = await authFetch('/api/animations'); if (r.ok) setCustomAnims((await r.json()).animations || []); } catch {}
    })();
  }, []);
  const savePreset = async () => {
    const name = prompt('Preset name?'); if (!name) return;
    try {
      const r = await authFetch('/api/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, patch: { ...style } }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed');
      setPresets((p) => [d.preset, ...p]);
      toast.success('Preset saved to your account');
    } catch (e: any) { toast.error(e?.message || 'Save failed'); }
  };

  /* ── My Animations: user-uploaded CSS @keyframes ────────────────────────
     A creator exports/writes an animation as a .css file (After Effects users
     typically hand-write the equivalent @keyframes, or export from a
     CSS-animation tool) and can then apply it to lines or individual words
     exactly like a built-in transition. The CSS is sanitised on both ends and
     the keyframe names are namespaced per animation so two uploads can never
     collide. */
  const [customAnims, setCustomAnims] = useState<CustomAnimation[]>([]);
  const animInputRef = useRef<HTMLInputElement>(null);
  const [animBusy, setAnimBusy] = useState(false);
  const customAnimsRef = useRef<CustomAnimation[]>([]);
  useEffect(() => { customAnimsRef.current = customAnims; }, [customAnims]);

  useEffect(() => {
    customAnims.forEach((a) => {
      if (document.querySelector(`style[data-anim="${a.id}"]`)) return;
      try {
        const { css } = namespaceAnimationCss(a);
        const st = document.createElement('style');
        st.dataset.anim = a.id;
        st.textContent = css;
        document.head.appendChild(st);
      } catch (e) { console.warn('[anim] could not inject', a.name, e); }
    });
  }, [customAnims]);

  const addAnimation = async (f: File | null) => {
    if (!f) return;
    if (!/\.css$/i.test(f.name)) return toast.error('Upload a .css file containing your @keyframes');
    if (f.size > 200 * 1024) return toast.error('Animation file must be under 200 KB');
    setAnimBusy(true);
    try {
      const raw = await f.text();
      // Validate + show the user which keyframes we found before saving.
      const clean = sanitizeAnimationCss(raw);
      const suggested = f.name.replace(/\.css$/i, '').replace(/[-_]+/g, ' ').slice(0, 40);
      const name = (typeof window !== 'undefined' ? window.prompt('Name this animation', suggested) : suggested) || suggested;
      let keyframe = clean.names[0];
      if (clean.names.length > 1 && typeof window !== 'undefined') {
        const pickName = window.prompt(`Which @keyframes should play?\n\n${clean.names.join('\n')}`, clean.names[0]);
        if (pickName && clean.names.includes(pickName.trim())) keyframe = pickName.trim();
      }
      const res = await authFetch('/api/animations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, css: raw, keyframe }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setCustomAnims((p) => [d.animation, ...p]);
      toast.success(`Animation "${d.animation.name}" added`);
    } catch (e: any) { toast.error(e?.message || 'Animation upload failed'); }
    finally { setAnimBusy(false); if (animInputRef.current) animInputRef.current.value = ''; }
  };

  const removeAnimation = async (a: CustomAnimation) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${a.name}"?`)) return;
    try {
      const res = await authFetch(`/api/animations?id=${encodeURIComponent(a.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      document.querySelector(`style[data-anim="${a.id}"]`)?.remove();
      setCustomAnims((p) => p.filter((x) => x.id !== a.id));
      const gone = customAnimId(a.id);
      if (style.transition === gone) patchGlobal({ transition: 'none' });
      if (style.wordTransition === gone) patchGlobal({ wordTransition: 'none' });
      toast.success('Animation deleted');
    } catch (e: any) { toast.error(e?.message || 'Delete failed'); }
  };

  /* custom fonts: injected as @font-face, available in every dropdown */
  const [customFonts, setCustomFonts] = useState<{ id: string; name: string; url: string }[]>([]);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const [fontBusy, setFontBusy] = useState(false);
  useEffect(() => {
    customFonts.forEach((f) => {
      if (document.querySelector(`style[data-font="${f.id}"]`)) return;
      const st = document.createElement('style'); st.dataset.font = f.id;
      st.textContent = `@font-face{font-family:'${f.name}';src:url('${f.url}');font-display:swap;}`;
      document.head.appendChild(st);
    });
  }, [customFonts]);
  const allFonts = useMemo(() => [...FONTS, ...customFonts.map((f) => ({ label: f.name, family: `'${f.name}'` }))], [customFonts]);
  const addFont = async (f: File | null) => {
    if (!f) return;
    if (!/\.(ttf|otf|woff2?)$/i.test(f.name)) return toast.error('Use a .ttf, .otf or .woff2 font file');
    if (f.size > 5 * 1024 * 1024) return toast.error('Font must be under 5 MB');
    setFontBusy(true);
    try {
      const uid = fbAuth.currentUser?.uid; if (!uid) throw new Error('Not signed in');
      const name = f.name.replace(/\.[^.]+$/, '').replace(/['"<>]/g, '').slice(0, 50);
      const r = fontStorageRef(storage, `captionist/${uid}/fonts/${Date.now()}-${f.name}`);
      await uploadFontBytes(r, f);
      const url = await getFontDownloadURL(r);
      const res = await authFetch('/api/fonts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, url }) });
      const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Failed');
      setCustomFonts((p) => [d.font, ...p]);
      toast.success(`Font "${name}" added`);
    } catch (e: any) { toast.error(e?.message || 'Font upload failed'); }
    finally { setFontBusy(false); if (fontInputRef.current) fontInputRef.current.value = ''; }
  };

  /* load */
  useEffect(() => {
    (async () => {
      const res = await authFetch(`/api/projects/${id}`);
      if (res.ok) {
        const { project: p } = await res.json();
        setProject(p); setTitle(p.title);
        const raw: Seg[] = (p.transcript?.segments || []).map((s: any, i: number) => ({ id: s.id ?? i, start: s.start, end: s.end, text: s.text, style: s.style }));
        // Kalakar-style: 1-3 words per caption — auto-split any longer segments
        const needsSplit = raw.some((s) => s.text.trim().split(/\s+/).length > 3);
        setSegments(needsSplit ? raw.flatMap((s) => splitSegWords(s, 3, 1)) : raw);
        if (p.style) setStyle({ ...DEFAULT_STYLE, ...p.style });
        if (p.wordStyles) setWordStyles(p.wordStyles);
        setDuration(p.durationSeconds || 0);
      } else { toast.error('Could not load project'); router.replace('/dashboard/projects'); }
      setLoading(false);
    })();
  }, [id, router]);

  /* Keyboard shortcuts for the caption selection. Ignored while the caret is
     in a text field so editing a caption still works normally. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selLinesRef.current.size || selLineRef.current >= 0) { e.preventDefault(); removeSelectedRef.current(); }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault(); selectAllRef.current();
      } else if (e.key === 'Escape') {
        clearSelRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const totalDur = useMemo(() => duration || segments[segments.length - 1]?.end || 1, [duration, segments]);
  const allWords = useMemo(() => segments.flatMap((s, i) => segWords(s, i)), [segments]);

  /* heavy timeline rows are memoized so drags/typing/timeupdate don't re-render them */
  const tlWidth = Math.max(totalDur * pxPerSec, 800);
  /* The waveform used to be one <span> per 250 ms — a 10-minute video meant
     ~2 400 extra DOM nodes that React had to walk on every single re-render.
     It is now a single canvas painted once per zoom level. */
  const waveRow = useMemo(() => (
    <WaveRow width={tlWidth} seconds={totalDur} />
  ), [tlWidth, totalDur]);
  const rulerRow = useMemo(() => (
    <div className="relative h-7 border-b" style={{ borderColor: 'var(--editor-border)' }}>
      {pxPerSec >= 14 && Array.from({ length: Math.ceil(totalDur) + 1 }).map((_, i) =>
        i % 5 !== 0 ? (<span key={`t${i}`} className="absolute bottom-0 h-1.5 w-px" style={{ left: i * pxPerSec, background: 'var(--editor-border)' }} />) : null
      )}
      {Array.from({ length: Math.ceil(totalDur / 5) + 1 }).map((_, i) => (
        <span key={i}>
          <span className="absolute bottom-0 h-2.5 w-px" style={{ left: i * 5 * pxPerSec, background: 'var(--text-muted)' }} />
          <span className="absolute top-1 text-[10px] tabular-nums" style={{ left: i * 5 * pxPerSec + 4, color: 'var(--text-muted)' }}>{clockLbl(i * 5)}</span>
        </span>
      ))}
    </div>
  ), [totalDur, pxPerSec]);

  /* stage size → font scale identical to export renderer (H/720 * 1.5) */
  const [stageH, setStageH] = useState(0);
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setStageH(el.clientHeight));
    ro.observe(el); setStageH(el.clientHeight);
    return () => ro.disconnect();
  }, [loading]);
  const fontK = ((stageH || 380) / 720) * 1.5;

  /* fit the video stage inside the available area so controls never get pushed off-screen */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapBox, setWrapBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setWrapBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setWrapBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [loading]);
  const [vRatio, setVRatio] = useState(16 / 9);

  /* timeline zoom: Ctrl/⌘ + wheel (trackpad pinch) and two-finger touch pinch */
  useEffect(() => {
    const el = tlRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setPxPerSec((z) => Math.min(220, Math.max(4, Math.round(z * (e.deltaY < 0 ? 1.12 : 0.89)))));
    };
    let pinch: { d: number; z: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const ts = (e: TouchEvent) => { if (e.touches.length === 2) pinch = { d: dist(e.touches), z: pxPerSec }; };
    const tm = (e: TouchEvent) => { if (pinch && e.touches.length === 2) { e.preventDefault(); const k = dist(e.touches) / pinch.d; setPxPerSec(Math.min(220, Math.max(4, Math.round(pinch.z * k)))); } };
    const te = () => { pinch = null; };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te);
    return () => { el.removeEventListener('wheel', onWheel); el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); };
  }, [loading, pxPerSec]);

  /* ── Smooth playback loop ──────────────────────────────────────────────
     Nothing in here touches React state except the active-caption index.
     The playhead, the clock, the seek bar, the timeline scroll position and
     the "live" highlights are all written straight to the DOM.

     Re-rendering this component ten times a second (the old `setCurrent(t)`)
     forced React to reconcile the caption rail, the inspector AND every block
     in the timeline on every tick. On anything longer than a minute or two
     that starved the main thread, and the <video> visibly froze mid-playback
     even once it was fully buffered. */
  const playheadRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);
  const currentRef = useRef(0);
  const pxRef = useRef(pxPerSec); useEffect(() => { pxRef.current = pxPerSec; }, [pxPerSec]);
  const segsRef = useRef(segments); useEffect(() => { segsRef.current = segments; }, [segments]);
  const allWordsRef = useRef<WordTok[]>([]); useEffect(() => { allWordsRef.current = allWords; }, [allWords]);
  const totalDurRef = useRef(1); useEffect(() => { totalDurRef.current = totalDur; }, [totalDur]);
  const activeRef = useRef(-1);
  const liveElRef = useRef<HTMLElement | null>(null);
  const hadFrameRef = useRef(false);

  /* Only the slice of the timeline that is on screen is mounted. A 10-minute
     video is ~2 000 word blocks; mounting them all cost tens of milliseconds
     per render. */
  const [tlWindow, setTlWindow] = useState({ from: 0, to: 240 });
  const tlWindowRef = useRef(tlWindow);
  useEffect(() => { tlWindowRef.current = tlWindow; }, [tlWindow]);
  const syncTlWindow = useCallback(() => {
    const el = tlRef.current; if (!el) return;
    const px = pxRef.current || 1;
    const from = el.scrollLeft / px;
    const to = (el.scrollLeft + el.clientWidth) / px;
    const w = tlWindowRef.current;
    if (from >= w.from + 0.5 && to <= w.to - 0.5) return;   // still inside the padded window
    const pad = Math.max(4, to - from);
    const next = { from: Math.max(0, from - pad), to: to + pad };
    tlWindowRef.current = next;
    setTlWindow(next);
  }, []);

  /** Push the current time into the DOM without re-rendering React. */
  const setTimeUI = useCallback((t: number) => {
    currentRef.current = t;
    if (playheadRef.current) playheadRef.current.style.transform = `translateX(${t * pxRef.current}px)`;
    if (clockRef.current) clockRef.current.textContent = tc(t);
    const total = totalDurRef.current || 1;
    const sb = seekRef.current;
    if (sb && document.activeElement !== sb) {
      const v = Math.min(t, total);
      sb.value = String(v);
      sb.style.background = `linear-gradient(to right, var(--text) ${(v / total) * 100}%, var(--editor-border) 0%)`;
    }
  }, []);

  useEffect(() => {
    let raf = 0; let lastHousekeeping = 0;
    const loop = () => {
      const v = videoRef.current;
      if (v) {
        const t = v.currentTime;
        if (t !== currentRef.current) setTimeUI(t);

        /* Active caption lookup. Captions are sorted, so walk from where we
           were instead of re-scanning the whole array 60 times a second — a
           10-minute video is ~2 000 captions and findIndex() was doing up to
           120 000 comparisons per second. */
        const segs = segsRef.current;
        const cur = segs[activeRef.current];
        if (!(cur && t >= cur.start && t <= cur.end)) {
          let idx = -1;
          const from = activeRef.current;
          if (from >= 0 && from < segs.length && t >= segs[from].start) {
            for (let i = from; i < segs.length && segs[i].start <= t; i++) {
              if (t >= segs[i].start && t <= segs[i].end) { idx = i; break; }
            }
          } else {
            let lo = 0, hi = segs.length - 1;   // seeked backwards / first run
            while (lo <= hi) {
              const mid = (lo + hi) >> 1;
              if (t < segs[mid].start) hi = mid - 1;
              else if (t > segs[mid].end) lo = mid + 1;
              else { idx = mid; break; }
            }
          }
          if (idx !== activeRef.current) { activeRef.current = idx; setActiveIdx(idx); }
        }

        const now = performance.now();
        if (now - lastHousekeeping > 220) {
          lastHousekeeping = now;
          const el = tlRef.current;
          if (el && !v.paused) {
            const x = t * pxRef.current;
            if (x < el.scrollLeft + 60 || x > el.scrollLeft + el.clientWidth - 120) {
              el.scrollLeft = Math.max(0, x - el.clientWidth / 2);
            }
          }
          syncTlWindow();
          /* "live" outlines (the current word block in the timeline and the
             current row in the caption rail) are toggled imperatively so they
             cost nothing in React. */
          const key = allWordsRef.current.find((w) => t >= w.start && t <= w.end)?.key;
          const target = key ? (document.querySelector(`[data-wk="${CSS.escape(key)}"]`) as HTMLElement | null) : null;
          if (liveElRef.current !== target) {
            if (liveElRef.current) liveElRef.current.removeAttribute('data-live');
            if (target) target.setAttribute('data-live', '1');
            liveElRef.current = target;
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [loading, syncTlWindow, setTimeUI]);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const p = () => setPlaying(true), q = () => setPlaying(false);
    const m = () => { if (v.duration && isFinite(v.duration)) setDuration(v.duration); if (v.videoWidth && v.videoHeight) setVRatio(v.videoWidth / v.videoHeight); };
    /* Stall recovery. Firebase Storage serves the MP4 over ranged requests; if
       a range response is slow or the moov atom sits at the end of the file the
       element can sit in `waiting` forever even though the data is already
       buffered. Nudging currentTime forces the decoder to pick up again. */
    let stallTimer: any = null;
    const clearStall = () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } };
    const armStall = () => {
      clearStall();
      stallTimer = setTimeout(() => {
        stallTimer = null;
        if (v.paused || v.ended) return;
        const t = v.currentTime;
        // is the data for "now" actually buffered? then it's a decoder hiccup
        let buffered = false;
        for (let i = 0; i < v.buffered.length; i++) {
          if (t >= v.buffered.start(i) - 0.1 && t < v.buffered.end(i) - 0.05) { buffered = true; break; }
        }
        if (buffered) { v.currentTime = Math.min((v.duration || t) - 0.01, t + 0.02); v.play().catch(() => {}); }
      }, 900);
    };
    const onWaiting = () => armStall();
    const onPlaying = () => clearStall();

    v.addEventListener('play', p); v.addEventListener('pause', q); v.addEventListener('loadedmetadata', m);
    v.addEventListener('waiting', onWaiting); v.addEventListener('stalled', onWaiting);
    v.addEventListener('playing', onPlaying); v.addEventListener('canplay', onPlaying); v.addEventListener('seeked', onPlaying);
    if (v.readyState >= 1) m(); // metadata may already be loaded (cached video) — honor 9:16 / 4:3 immediately
    return () => {
      clearStall();
      v.removeEventListener('play', p); v.removeEventListener('pause', q); v.removeEventListener('loadedmetadata', m);
      v.removeEventListener('waiting', onWaiting); v.removeEventListener('stalled', onWaiting);
      v.removeEventListener('playing', onPlaying); v.removeEventListener('canplay', onPlaying); v.removeEventListener('seeked', onPlaying);
    };
  }, [project?.videoUrl]);

  /* NOTE: ensureAudio() is deliberately NOT called here. Creating a
     MediaElementAudioSourceNode re-routes the element's audio through the
     WebAudio graph for the rest of the page's life, which couples audio output
     to the main thread — when the thread is busy the video visibly hitches.
     The graph is now built only when it is actually needed: the AI-cleaning
     A/B toggle, or an export (which needs an audio track to record). */
  const togglePlay = () => { const v = videoRef.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); };
  const seekTo = (t: number) => { const v = videoRef.current; if (!v) return; v.currentTime = t; setTimeUI(t); };
  const toggleMute = () => { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); };
  const fs = () => stageRef.current?.requestFullscreen?.().catch(() => {});

  /* ── audio graph (real enhancement + A/B) ── */
  const ensureAudio = () => {
    const v = videoRef.current; if (!v || acRef.current) return;
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ac = new Ctx();
      const src = ac.createMediaElementSource(v);
      const dest = ac.createMediaStreamDestination();
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 85;
      const presence = ac.createBiquadFilter(); presence.type = 'peaking'; presence.frequency.value = 3000; presence.gain.value = 3.5; presence.Q.value = 1;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -26; comp.knee.value = 28; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
      const gain = ac.createGain(); gain.gain.value = 1.35;
      acRef.current = ac; srcRef.current = src; destRef.current = dest; chainRef.current = [hp, presence, comp, gain];
      route(false);
    } catch (e) { console.warn('[audio] unavailable', e); }
  };
  const route = (clean: boolean) => {
    const ac = acRef.current, src = srcRef.current, dest = destRef.current; if (!ac || !src || !dest) return;
    try { src.disconnect(); chainRef.current.forEach((n) => n.disconnect()); } catch {}
    if (clean) {
      const [hp, pr, comp, gain] = chainRef.current as any[];
      src.connect(hp); hp.connect(pr); pr.connect(comp); comp.connect(gain);
      gain.connect(ac.destination); gain.connect(dest);
    } else { src.connect(ac.destination); src.connect(dest); }
    ac.resume().catch(() => {});
  };
  const toggleClean = () => {
    ensureAudio();
    const next = !cleanOn; setCleanOn(next); route(next);
    toast.success(next ? 'AI enhancement active' : 'Original audio');
  };

  /* ── selection ──
     Plain click selects one caption. Shift-click extends from the anchor so a
     whole run can be picked in one gesture; Ctrl/Cmd-click toggles a single
     caption in or out of the selection. */
  const selectLine = (i: number, e?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
    const additive = !!(e?.ctrlKey || e?.metaKey);
    const range = !!e?.shiftKey;
    setSelWords(new Set());
    if (range && selAnchorRef.current >= 0) {
      const a = Math.min(selAnchorRef.current, i), b = Math.max(selAnchorRef.current, i);
      const next = new Set<number>();
      for (let x = a; x <= b; x++) next.add(x);
      setSelLines(next);
      setSelLine(i);
      return;
    }
    if (additive) {
      setSelLines((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i); else next.add(i);
        return next;
      });
      selAnchorRef.current = i;
      setSelLine(i);
      return;
    }
    selAnchorRef.current = i;
    setSelLines(new Set([i]));
    setSelLine(i);
  };
  /** Caret moved into a caption's text field: make it the primary line, but
      leave any existing multi-selection alone. */
  const focusLine = (i: number) => {
    setSelLine(i);
    setSelWords(new Set());
    setSelLines((prev) => (prev.size ? prev : new Set([i])));
    if (selAnchorRef.current < 0) selAnchorRef.current = i;
  };
  const clearSel = () => { setSelLines(new Set()); setSelLine(-1); selAnchorRef.current = -1; };
  clearSelRef.current = clearSel;
  const selectAllLines = () => {
    setSelLines(new Set(segments.map((_, i) => i)));
    selAnchorRef.current = 0;
    setSelLine(segments.length ? 0 : -1);
  };
  selectAllRef.current = selectAllLines;

  /* ── edits ── */
  const updateText = (i: number, text: string) => { setSegments((p) => p.map((s, x) => (x === i ? { ...s, text } : s))); markDirty(); };
  const removeSeg = (i: number) => { setSegments((p) => p.filter((_, x) => x !== i)); markDirty(); clearSel(); };
  /** Delete every selected caption at once. */
  const removeSelected = () => {
    const kill = selLines.size ? selLines : (selLine >= 0 ? new Set([selLine]) : new Set<number>());
    if (!kill.size) { toast('Select one or more captions first', { icon: 'ℹ️' }); return; }
    const n = kill.size;
    setSegments((p) => p.filter((_, x) => !kill.has(x)));
    markDirty(); clearSel();
    toast.success(`Deleted ${n} caption${n === 1 ? '' : 's'}`);
  };
  removeSelectedRef.current = removeSelected;
  const addLine = () => { const t = currentRef.current; const s: Seg = { id: Date.now(), start: t, end: Math.min(totalDur, t + 2), text: 'New caption' }; setSegments((p) => [...p, s].sort((a, b) => a.start - b.start)); markDirty(); };

  const patchGlobal = (p: Partial<CapStyle>) => { setStyle((s) => ({ ...s, ...p })); markDirty(); };
  const patchLine = (i: number, p: Partial<CapStyle>) => { setSegments((prev) => prev.map((s, x) => (x === i ? { ...s, style: { ...(s.style || {}), ...p } } : s))); markDirty(); };
  const patchWords = (p: Partial<CapStyle>) => {
    if (selWords.size === 0) return;
    setWordStyles((prev) => { const n = { ...prev }; selWords.forEach((k) => { n[k] = { ...(n[k] || {}), ...p }; }); return n; });
    markDirty();
  };
  /** scope-aware patch. 'all' also clears the same keys from per-line and
      per-word overrides so a global change really applies everywhere. */
  const patchTarget = (p: Partial<CapStyle>) => {
    if (txtScope === 'word' && selWords.size > 0) { patchWords(p); return; }
    if (txtScope === 'line' && selLine >= 0) { patchLine(selLine, p); return; }
    patchGlobal(p);
    const keys = Object.keys(p) as (keyof CapStyle)[];
    setSegments((prev) => prev.map((s) => {
      if (!s.style) return s;
      const st: any = { ...s.style }; keys.forEach((k) => delete st[k]);
      return { ...s, style: st };
    }));
    setWordStyles((prev) => {
      const n: typeof prev = {};
      for (const [k, v] of Object.entries(prev)) { const c: any = { ...v }; keys.forEach((kk) => delete c[kk]); n[k] = c; }
      return n;
    });
  };

  const effLine = (i: number): CapStyle => ({ ...style, ...(segments[i]?.style || {}) });
  const effWord = (i: number, key: string): CapStyle => ({ ...effLine(i), ...(wordStyles[key] || {}) });

  /* current target style shown in the Text tab */
  const targetStyle: CapStyle = useMemo(() => {
    if (txtScope === 'word' && selWords.size > 0) { const k = Array.from(selWords)[0]; const si = segments.findIndex((s) => k.startsWith(`${s.id}:`)); return effWord(Math.max(0, si), k); }
    if (txtScope === 'line' && selLine >= 0) return effLine(selLine);
    return style;
  }, [txtScope, selWords, selLine, segments, wordStyles, style]);

  /* ── caption tools ── */
  const applySplit = () => {
    setSegments((p) => p.flatMap((s) => (wordsPer === 'chars'
      ? splitSeg(s, maxChars, lineCount)
      : splitSegWords(s, Number(wordsPer), lineCount))));
    markDirty();
    toast.success(lineCount > 1
      ? `Captions re-split · ${lineCount} lines`
      : 'Captions re-split');
  };
  const rmPunct = () => { setSegments((p) => p.map((s) => ({ ...s, text: s.text.replace(/[.,!?;:"“”‘’—–]/g, '').replace(/\s+/g, ' ').trim() }))); markDirty(); toast.success('Punctuation removed'); };
  const rmEmph = () => { setWordStyles({}); markDirty(); toast.success('Emphasis removed'); };
  const rmEmoji = () => { setSegments((p) => p.map((s) => ({ ...s, text: s.text.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim() })).filter((s) => s.text)); markDirty(); toast.success('Emojis removed'); };
  const rmGaps = () => { setSegments((p) => { const s = [...p].sort((a, b) => a.start - b.start); for (let i = 1; i < s.length; i++) s[i] = { ...s[i], start: s[i - 1].end }; return s; }); markDirty(); toast.success('Gaps removed'); };
  const setDelayV = (v: number) => { const d = v - delay; setDelay(v); setSegments((p) => p.map((s) => ({ ...s, start: Math.max(0, s.start + d), end: Math.max(0.1, s.end + d) }))); markDirty(); };

  /* ── romanize ── */
  const toggleRoman = async () => {
    if (romanOn) { setRomanOn(false); return; }
    if (Object.keys(romanMap).length) { setRomanOn(true); return; }
    setRomanizing(true);
    try {
      const res = await authFetch('/api/romanize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines: segments.map((s) => s.text) }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      const map: Record<number, string> = {}; segments.forEach((s, i) => (map[s.id] = d.roman[i] ?? s.text));
      setRomanMap(map); setRomanOn(true); toast.success('Roman script ready');
    } catch (e: any) { toast.error(e?.message || 'Romanize failed'); }
    finally { setRomanizing(false); }
  };
  const shown = (s: Seg) => (romanOn && romanMap[s.id] ? romanMap[s.id] : s.text);

  const save = async () => {
    setSaving(true);
    const text = segments.map((s) => s.text).join(' ');
    const res = await authFetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, transcript: { text, segments }, style, wordStyles }) });
    setSaving(false);
    if (res.ok) { setDirty(false); toast.success('Saved'); } else toast.error('Save failed');
  };
  const dl = (data: string, name: string) => { const u = URL.createObjectURL(new Blob([data], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); };
  const safeName = (title || 'captions').replace(/[^\w-]+/g, '_');

  const animDur = (st: CapStyle, seg?: Seg, transitionId?: string) => {
    if (transitionId && isCustomAnim(transitionId)) {
      const a = customAnimsRef.current.find((x) => x.id === customAnimDocId(transitionId));
      if (a?.duration) return a.duration;
    }
    if (st.speedMode === 'manual') return Math.max(0.15, 1.1 - (st.speed / 100) * 0.9);
    const d = seg ? Math.max(0.25, seg.end - seg.start) : 0.8;
    return Math.min(0.8, Math.max(0.32, d * 0.4));
  };

  /** How far into a word's own entrance animation we are, mirroring the CSS
      animation-delay used by the live overlay. */
  const wordDelay = (st: CapStyle, seg: Seg, wordStart: number) => {
    const k = st.speedMode === 'manual' ? (110 - st.speed) / 50 : 1;
    return Math.max(0, wordStart - seg.start) * k;
  };

  /* ── canvas renderer (burns per-word styles + emphasis) ── */
  const drawFrame = (ctx: CanvasRenderingContext2D, W: number, H: number, t: number) => {
    const v = videoRef.current;
    /* Only clear to black if we have never had a frame — otherwise hold the
       previous one. Painting black whenever readyState dips is what put a
       black leader at the head of every exported file. */
    if (v && v.readyState >= 2) { ctx.drawImage(v, 0, 0, W, H); hadFrameRef.current = true; }
    else if (!hadFrameRef.current) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    const si = segments.findIndex((s) => t >= s.start && t <= s.end);
    if (si < 0) return;
    const seg = segments[si]; const st = effLine(si);
    const scale = H / 720; const baseFs = st.fontSize * scale * 1.5;

    /* Build per-word tokens with the SAME style resolution as the live overlay:
       base styles apply to all words; emphasis adds color/size/font on top. */
    interface Tok { text: string; fs: number; font: string; color: string; grad?: [string, string]; underline: boolean; w: number; tw: number; spot?: string; anim: AnimSample; }
    const words = segWords({ ...seg, text: shown(seg) }, si);
    if (words.length === 0) return;
    const customs = customAnimsRef.current;
    const toks: Tok[] = words.map((wd) => {
      const ws: any = wordStyles[wd.key] || {};
      const em = !!ws.emphasized;
      const sw = { ...st, ...ws } as CapStyle;
      const upper = sw.uppercase || (em && sw.emUppercase);
      const italic = sw.italic || (em && sw.emItalic);
      const underline = sw.underline || (em && sw.emUnderline);
      const baseW = sw.bold ? Math.max(sw.fontWeight, 700) : sw.fontWeight;
      const weight = em ? Math.max(sw.emBold ? Math.max(sw.emWeight, 700) : sw.emWeight, sw.bold ? 700 : 0) : baseW;
      const fs = (em ? sw.fontSize * (sw.emSize / 8) : sw.fontSize) * scale * 1.5;
      const font = `${italic ? 'italic ' : ''}${weight} ${fs}px ${withScript(em ? sw.emFont : sw.fontFamily)}`;
      const useGrad = em ? sw.emColorMode === 'gradient' : sw.colorMode === 'gradient';
      const c1 = em ? sw.emColor : sw.color, c2 = em ? sw.emColor2 : sw.color2;
      ctx.font = font;
      const text = upper ? wd.text.toUpperCase() : wd.text;
      const tw = ctx.measureText(text).width;
      const w = tw + ctx.measureText(' ').width;

      /* Word entrance animation, sampled at exactly the same point in time the
         browser's CSS animation would be at in the live preview — this is what
         makes the exported MP4 match what the user saw. */
      const wtr = (ws.wordTransition as string) || st.wordTransition;
      const wTrack = trackFor(wtr, customs);
      let anim = NEUTRAL;
      if (wTrack) {
        const dur = animDur(sw, seg, wtr);
        const p = (t - seg.start - wordDelay(st, seg, wd.start)) / dur;
        anim = p < 0 ? sampleTrack(wTrack, 0) : sampleTrack(wTrack, p);
      }

      return { text, fs, font, color: c1, grad: useGrad ? [c1, c2] as [string, string] : undefined, underline, w, tw, spot: em && sw.emphasisMode === 'spotlight' ? c1 : undefined, anim };
    });

    /* Lay tokens out into rows. A caption split with the "Lines" control comes
       with its own row count, which we honour first; each of those rows is then
       still width-wrapped if it would overflow the caption box. */
    const maxW = W * ((st.boxWidth ?? 92) / 100);
    const rows: Tok[][] = [];
    for (const group of rowsOf(toks, seg.lines || 1)) {
      let row: Tok[] = []; let rw = 0;
      for (const tok of group) {
        if (rw + tok.w > maxW && row.length) { rows.push(row); row = [tok]; rw = tok.w; }
        else { row.push(tok); rw += tok.w; }
      }
      if (row.length) rows.push(row);
    }

    const lh = baseFs * Math.max(st.lineSpacing, 1.35);
    const blockH = rows.length * lh;
    const cx = W * (st.posX / 100);
    let cy = H * (st.posY / 100);
    cy = Math.min(H - blockH / 2 - 12 * scale, Math.max(blockH / 2 + 12 * scale, cy));

    /* Line entrance animation: applied to the whole block (background box
       included) around its own centre, so a "slide up" really slides the box. */
    const lineTrack = trackFor(st.transition, customs);
    const lineAnimS: AnimSample = lineTrack
      ? sampleTrack(lineTrack, (t - seg.start) / animDur(st, seg, st.transition))
      : NEUTRAL;

    ctx.save();
    if (lineTrack) {
      ctx.translate(cx + lineAnimS.tx * scale + lineAnimS.txEm * baseFs, cy + lineAnimS.ty * scale + lineAnimS.tyEm * baseFs);
      if (lineAnimS.rot) ctx.rotate((lineAnimS.rot * Math.PI) / 180);
      ctx.scale(lineAnimS.sx, lineAnimS.sy);
      ctx.translate(-cx, -cy);
    }

    const noShadow = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };
    const applyShadow = (glowColor: string) => {
      if (st.glow) { ctx.shadowColor = glowColor; ctx.shadowBlur = 26 * scale; ctx.shadowOffsetY = 0; }
      else if (st.dropShadow) { ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 18 * scale; ctx.shadowOffsetY = 4 * scale; }
      else noShadow();
    };

    if (st.background) {
      ctx.globalAlpha = lineAnimS.opacity;
      const px = baseFs * 0.4, py = baseFs * 0.3;
      const widest = Math.min(maxW, Math.max(...rows.map((r) => r.reduce((a, x) => a + x.w, 0))));
      const bw = widest + px * 2, bh = blockH + py * 2;
      const bx = st.align === 'left' ? cx - maxW / 2 - px : st.align === 'right' ? cx + maxW / 2 - bw + px : cx - bw / 2;
      noShadow(); ctx.fillStyle = st.bgColor || 'rgba(0,0,0,0.72)';
      roundRect(ctx, bx, cy - bh / 2, bw, bh, baseFs * 0.25); ctx.fill();
    }

    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    rows.forEach((r, ri) => {
      const totalW = r.reduce((a, x) => a + x.w, 0);
      let x = st.align === 'left' ? cx - maxW / 2 : st.align === 'right' ? cx + maxW / 2 - totalW : cx - totalW / 2;
      const y = cy - blockH / 2 + lh / 2 + ri * lh;
      for (const tok of r) {
        const a = tok.anim;
        const animated = a !== NEUTRAL || lineAnimS !== NEUTRAL;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, lineAnimS.opacity * a.opacity));
        if (animated) {
          const wcx = x + tok.tw / 2, wcy = y;
          ctx.translate(wcx + a.tx * scale + a.txEm * tok.fs, wcy + a.ty * scale + a.tyEm * tok.fs);
          if (a.rot) ctx.rotate((a.rot * Math.PI) / 180);
          if (a.sx !== 1 || a.sy !== 1) ctx.scale(a.sx, a.sy);
          ctx.translate(-wcx, -wcy);
        }
        ctx.font = tok.font;
        if (tok.spot) {
          noShadow(); ctx.fillStyle = tok.spot;
          roundRect(ctx, x - tok.fs * 0.08, y - tok.fs * 0.58, tok.tw + tok.fs * 0.16, tok.fs * 1.16, tok.fs * 0.15); ctx.fill();
          ctx.fillStyle = '#000';
        } else if (tok.grad) {
          const g = ctx.createLinearGradient(x, 0, x + tok.tw, 0); g.addColorStop(0, tok.grad[0]); g.addColorStop(1, tok.grad[1]);
          applyShadow(tok.grad[0]); ctx.fillStyle = g;
        } else { applyShadow(tok.color); ctx.fillStyle = tok.color; }
        if (st.textStroke && !tok.spot) { ctx.lineWidth = Math.max(2, tok.fs * 0.06); ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.lineJoin = 'round'; ctx.strokeText(tok.text, x, y); }
        ctx.fillText(tok.text, x, y);
        if (tok.underline) {
          noShadow();
          ctx.strokeStyle = tok.spot ? '#000' : (tok.grad ? tok.grad[0] : tok.color);
          ctx.lineWidth = Math.max(1.5, tok.fs * 0.06);
          ctx.beginPath(); ctx.moveTo(x, y + tok.fs * 0.44); ctx.lineTo(x + tok.tw, y + tok.fs * 0.44); ctx.stroke();
        }
        ctx.restore();
        x += tok.w;
      }
    });
    noShadow();
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  const render = async () => {
    if (expType === 'srt') { dl(buildSrt(segments), `${safeName}.srt`); toast.success('SRT downloaded'); return; }
    if (expType === 'txt') { dl(segments.map((s) => shown(s)).join('\n'), `${safeName}.txt`); toast.success('TXT downloaded'); return; }

    const tpl = TEMPLATES.find((x) => x.name === appliedTpl);
    if (isFree && tpl?.premium) { toast.error('Premium template — switch to a free template or upgrade.'); return; }
    if (isFree && expRes === '1080') { toast.error('1080P is a premium resolution. Choose 720P or upgrade.'); return; }

    const video = videoRef.current, canvas = canvasRef.current;
    if (!project?.videoUrl || !video || !canvas) { toast.error('Video not ready'); return; }
    const H = expRes === '1080' ? 1080 : 720;
    const ratio = (video.videoWidth || 1280) / (video.videoHeight || 720);
    const W = Math.round(H * ratio);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    try { ctx.drawImage(video, 0, 0, W, H); canvas.toDataURL(); } catch { toast.error('Enable Storage CORS, then hard-reload.'); return; }

    ensureAudio();
    const cs = canvas.captureStream?.(30); if (!cs) { toast.error('Canvas capture unsupported'); return; }
    const aTracks = destRef.current ? destRef.current.stream.getAudioTracks() : [];
    const out = new MediaStream([...cs.getVideoTracks(), ...aTracks]);

    setRendering(true); setPct(0);
    const wasT = video.currentTime, wasP = video.paused;
    try {
      const mp4Mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
      const webmMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const mime = mp4Mime || webmMime;
      const isMp4 = !!mp4Mime;
      const rec = new MediaRecorder(out, { mimeType: mime, videoBitsPerSecond: H >= 1080 ? 12_000_000 : 8_000_000 });
      const chunks: BlobPart[] = []; rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise<Blob>((res, rej) => { rec.onstop = () => res(new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' })); rec.onerror = () => rej(new Error('Recording failed')); });
      let raf = 0;
      const loop = () => { drawFrame(ctx, W, H, video.currentTime); setPct(Math.min(99, Math.round((video.currentTime / (video.duration || totalDur)) * 100))); raf = requestAnimationFrame(loop); };
      /* Rewind and wait until frame 0 is actually decoded BEFORE arming the
         recorder. Previously recording began immediately and playback only
         started once the seek finished, so the first few seconds of every
         export were the blank canvas. */
      video.pause();
      await seekToFrame(video, 0);
      drawFrame(ctx, W, H, 0);          // first recorded frame is a real one
      setPct(0);

      rec.start(100);
      raf = requestAnimationFrame(loop);
      await video.play();
      await new Promise<void>((r) => { const e = () => { video.removeEventListener('ended', e); r(); }; video.addEventListener('ended', e); });
      rec.stop(); cancelAnimationFrame(raf);
      const blob = await done; const u = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = u; a.download = `${safeName}_${H}p.${isMp4 ? 'mp4' : 'webm'}`; a.click(); URL.revokeObjectURL(u);
      toast.success(isMp4 ? 'Render complete (MP4)' : 'Render complete (WebM — this browser can\'t record MP4)');
    } catch (e: any) { toast.error(e?.message || 'Render failed'); }
    finally { video.pause(); video.currentTime = wasT; if (!wasP) video.play().catch(() => {}); setRendering(false); setPct(0); }
  };

  /* ── live overlay: per-word styles + emphasis + transitions ── */
  const activeSeg = activeIdx >= 0 ? segments[activeIdx] : null;
  const lineSt = activeIdx >= 0 ? effLine(activeIdx) : style;
  const lineAnim = animClass(lineSt.transition);

  /* drag caption box on the video to reposition (updates X/Y %) */
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number; line: number } | null>(null);
  const dragMovedRef = useRef(false);
  const onCapPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect(); if (!rect || activeIdx < 0) return;
    dragMovedRef.current = false;
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: lineSt.posX, py: lineSt.posY, line: activeIdx };
    const apply = (ev: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      if (Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy) > 4) dragMovedRef.current = true;
      if (!dragMovedRef.current) return;
      const nx = Math.min(98, Math.max(2, d.px + ((ev.clientX - d.sx) / rect.width) * 100));
      const ny = Math.min(96, Math.max(4, d.py + ((ev.clientY - d.sy) / rect.height) * 100));
      // Drag moves ALL captions (global) unless this line already has its own position
      const hasOwn = segments[d.line]?.style?.posX !== undefined || segments[d.line]?.style?.posY !== undefined;
      if (hasOwn) patchLine(d.line, { posX: nx, posY: ny }); else patchGlobal({ posX: nx, posY: ny });
    };
    let raf = 0; let last: PointerEvent | null = null;
    const move = (ev: PointerEvent) => { last = ev; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (last) apply(last); }); };
    const up = (ev: PointerEvent) => {
      if (raf) cancelAnimationFrame(raf);
      const line = dragRef.current?.line ?? -1;
      dragRef.current = null;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (!dragMovedRef.current && !(ev.ctrlKey || ev.metaKey) && line >= 0) {
        // plain click on the caption box: select the line (a click on a word
        // fires right after and narrows the selection to that word)
        setSelLine(line); setSelWords(new Set());
      }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  /* resize the caption box: corner handles scale font size, side handles change box width */
  const startBoxResize = (e: React.PointerEvent, kind: 'corner' | 'width', dx: number, dy: number) => {
    e.stopPropagation(); e.preventDefault();
    if (activeIdx < 0) return;
    const line = activeIdx;
    const sx = e.clientX, sy = e.clientY;
    const f0 = lineSt.fontSize, w0 = lineSt.boxWidth ?? 92;
    const rect = stageRef.current?.getBoundingClientRect();
    const apply = (ev: PointerEvent) => {
      if (kind === 'corner') {
        const d = ((ev.clientX - sx) * dx + (ev.clientY - sy) * dy) / 2;
        patchLine(line, { fontSize: Math.round(Math.min(90, Math.max(10, f0 + d * 0.2))) });
      } else if (rect) {
        const d = (((ev.clientX - sx) * dx) / rect.width) * 200;
        patchLine(line, { boxWidth: Math.round(Math.min(98, Math.max(18, w0 + d))) });
      }
    };
    let raf = 0; let last: PointerEvent | null = null;
    const move = (ev: PointerEvent) => { last = ev; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (last) apply(last); }); };
    const up = () => { if (raf) cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  /* Replay the caption animation right where the user is:
     - a caption is on screen → just re-trigger its animation (no seeking)
     - a specific line was chosen → jump to it
     - otherwise → jump to the next caption after the playhead (paused; animation still plays) */
  const previewFromHere = (preferLine?: number) => {
    if (segments.length === 0) return;
    if (preferLine !== undefined && preferLine >= 0) { seekTo(segments[preferLine].start + 0.02); setBump((n) => n + 1); return; }
    if (activeIdx >= 0) { setBump((n) => n + 1); return; }
    let idx = segments.findIndex((s) => s.start >= currentRef.current);
    if (idx < 0) idx = segments.length - 1;
    seekTo(segments[idx].start + 0.02); setBump((n) => n + 1);
  };

  /* Kalakar-style keyword highlight: emphasize every 3rd word of each line */
  const autoEmphasize = () => {
    const next: Record<string, Partial<CapStyle>> = {};
    segments.forEach((s) => {
      segWords(s, 0).forEach((w) => { if (w.wi % 3 === 2) (next[w.key] = { ...(next[w.key] || {}), emphasized: true } as any); });
    });
    setWordStyles(next);
  };

  const overlayWrap: React.CSSProperties = {
    position: 'absolute', left: `${lineSt.posX}%`, top: `${lineSt.posY}%`,
    transform: 'translate(-50%,-50%)', width: `${lineSt.boxWidth ?? 92}%`,
    display: 'flex', justifyContent: 'center', pointerEvents: 'auto', cursor: 'grab',
    touchAction: 'none', zIndex: 5,
  };
  const boxStyle: React.CSSProperties = {
    maxWidth: '100%', textAlign: lineSt.align,
    background: lineSt.background ? lineSt.bgColor : 'transparent',
    padding: lineSt.background ? '0.3em 0.65em' : 0, borderRadius: lineSt.background ? '0.5em' : 0,
    lineHeight: Math.max(lineSt.lineSpacing, 1.3), whiteSpace: 'normal', overflowWrap: 'break-word',
    outline: selLine === activeIdx && activeIdx >= 0 ? '1.5px dashed var(--accent)' : 'none',
    outlineOffset: 4,
  };
  const wordSpan = (w: WordTok): React.CSSProperties => {
    const ws = wordStyles[w.key] || {};
    const em = !!(ws as any).emphasized;
    const st = { ...lineSt, ...ws } as CapStyle;
    const useGrad = em ? st.emColorMode === 'gradient' : st.colorMode === 'gradient';
    const c1 = em ? st.emColor : st.color, c2 = em ? st.emColor2 : st.color2;
    const size = em ? st.fontSize * (st.emSize / 8) : st.fontSize;
    const fam = em ? st.emFont : st.fontFamily;
    const wt = em
      ? Math.max(st.emBold ? Math.max(st.emWeight, 700) : st.emWeight, st.bold ? 700 : 0)
      : (st.bold ? Math.max(st.fontWeight, 700) : st.fontWeight);
    const spotlight = em && st.emphasisMode === 'spotlight';
    return {
      display: 'inline-block', margin: '0 .18em',
      fontFamily: withScript(fam), fontWeight: wt,
      fontSize: `${Math.max(11, size * fontK)}px`,
      fontStyle: (st.italic || (em && st.emItalic)) ? 'italic' : 'normal',
      textDecoration: (st.underline || (em && st.emUnderline)) ? 'underline' : 'none',
      textTransform: (st.uppercase || (em && st.emUppercase)) ? 'uppercase' : 'none',
      letterSpacing: `${st.letterSpacing}px`,
      color: useGrad ? 'transparent' : c1,
      ...(useGrad ? { backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text' as any } : {}),
      ...(spotlight ? { background: c1, color: '#000', padding: '0 .18em', borderRadius: '.2em' } : {}),
      textShadow: st.glow ? `0 0 12px ${c1}, 0 0 26px ${c1}` : st.dropShadow ? '0 4px 18px rgba(0,0,0,.85)' : 'none',
      WebkitTextStroke: st.textStroke ? '1.2px rgba(0,0,0,.9)' : (undefined as any),
      animationDuration: `${animDur(st, activeSeg || undefined)}s`,
    };
  };

  const activeWords = useMemo(() => (activeSeg ? segWords({ ...activeSeg, text: shown(activeSeg) }, activeIdx) : []), [activeSeg, activeIdx, romanOn, romanMap]);

  const filtered = useMemo(
    () => segments.map((s, i) => ({ s, i })).filter(({ s }) => !search || s.text.toLowerCase().includes(search.toLowerCase())),
    [segments, search]
  );

  /* The caption list is memoized and its "currently playing" marker is applied
     with a data-attribute (see the effect near the timeline), so the rail is
     NOT rebuilt every time the active caption changes during playback. */
  const capRows = useMemo(() => filtered.map(({ s, i }) => {
    const sel = selLines.has(i) || i === selLine;
    return (
      <div key={s.id} data-cap-row={i} onClick={(e) => { selectLine(i, e); if (!e.shiftKey && !(e.ctrlKey || e.metaKey)) seekTo(s.start); }}
        className="cap-row group flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 transition"
        style={{ background: sel ? 'rgba(79,140,255,.10)' : 'transparent', borderColor: sel ? 'var(--accent)' : 'transparent' }}>
        <span className="cap-row-badge grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold">{i + 1}</span>
        <input value={shown(s)} onChange={(e) => updateText(i, e.target.value)} onFocus={() => focusLine(i)}
          onMouseDown={(e) => { if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault(); }}
          className="flex-1 bg-transparent text-[15px] outline-none" style={{ fontFamily: withScript("'Inter',sans-serif") }} />
        <button onClick={(e) => { e.stopPropagation(); setLineStylingFor(i); setCollapsed((c) => ({ ...c, typo: true })); }}
          title="Line styling" className="shrink-0 rounded-md p-1.5 transition" style={{ color: 'var(--text-muted)' }}>
          <LayoutGrid size={17} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); removeSeg(i); }} className="shrink-0 opacity-0 transition group-hover:opacity-100" style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filtered, selLine, selLines, romanOn, romanMap]);

  /* ── timeline blocks ── */
  const fitW = wrapBox.w && wrapBox.h ? Math.max(220, Math.min(wrapBox.w, wrapBox.h * vRatio)) : 640;
  const fitH = fitW / vRatio;

  const toggleWord = (key: string, additive: boolean) => {
    setSelLine(-1); setSelLines(new Set());
    setSelWords((prev) => {
      const n = new Set(additive ? prev : []);
      if (prev.has(key) && additive) n.delete(key); else n.add(key);
      return n;
    });
  };

  /* drag a caption block's edge in the timeline to change its start/end time */
  const startEdge = (e: React.PointerEvent, i: number, side: 'start' | 'end') => {
    e.stopPropagation(); e.preventDefault();
    const s0 = segments[i]; if (!s0) return;
    const sx = e.clientX; const st0 = s0.start, en0 = s0.end;
    const apply = (ev: PointerEvent) => {
      const dt = (ev.clientX - sx) / pxPerSec;
      setSegments((prev) => prev.map((s, x) => {
        if (x !== i) return s;
        if (side === 'start') return { ...s, start: Math.max(0, Math.min(en0 - 0.15, st0 + dt)) };
        return { ...s, end: Math.min(totalDur, Math.max(st0 + 0.15, en0 + dt)) };
      }));
    };
    let raf = 0; let last: PointerEvent | null = null;
    const move = (ev: PointerEvent) => { last = ev; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (last) apply(last); }); };
    const up = () => { if (raf) cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); markDirty(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  /* drag the middle of a caption block to SHIFT it in time (snaps to neighbours).
     A click without movement selects + seeks instead. */
  const startMove = (e: React.PointerEvent, i: number) => {
    e.stopPropagation();
    const s0 = segments[i]; if (!s0) return;
    const sx = e.clientX; const st0 = s0.start; const dur = s0.end - s0.start;
    let moved = false;
    const apply = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      if (Math.abs(dx) > 3) moved = true;
      if (!moved) return;
      let ns = st0 + dx / pxPerSec;
      const prevEnd = segments[i - 1]?.end ?? 0;
      const nextStart = segments[i + 1]?.start ?? totalDur;
      if (Math.abs(ns - prevEnd) < 0.12) ns = prevEnd;                    // snap to previous block
      if (Math.abs(ns + dur - nextStart) < 0.12) ns = nextStart - dur;    // snap to next block
      ns = Math.max(0, Math.min(totalDur - dur, ns));
      setSegments((prev) => prev.map((s, x) => (x === i ? { ...s, start: ns, end: ns + dur } : s)));
    };
    let raf = 0; let last: PointerEvent | null = null;
    const move = (ev: PointerEvent) => { last = ev; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (last) apply(last); }); };
    const up = (ev: PointerEvent) => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (moved) markDirty();
      else {
        selectLine(i, ev);
        if (!ev.shiftKey && !(ev.ctrlKey || ev.metaKey)) seekTo(segments[i].start);
      }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  /* ── timeline blocks: memoized AND windowed ────────────────────────────
     Only what is scrolled into view is mounted, and the "active"/"live"
     highlight is applied through data-attributes by the playback loop, so a
     caption change does not force this list to re-render. */
  const tlBlocks = useMemo(() => {
    const { from, to } = tlWindow;
    if (tlMode === 'word') {
      return allWords
        .filter((w) => w.end >= from && w.start <= to)
        .map((w) => {
          const sel = selWords.has(w.key);
          const em = !!(wordStyles[w.key] as any)?.emphasized;
          return (
            <button key={w.key} data-wk={w.key}
              onClick={(e) => { e.stopPropagation(); toggleWord(w.key, e.metaKey || e.ctrlKey || e.shiftKey); seekTo(w.start); }}
              className="tl-word absolute top-4 flex items-center justify-center overflow-hidden rounded-md px-1 text-[10px] font-semibold"
              title={w.text}
              style={{ left: w.start * pxPerSec, width: Math.max(7, (w.end - w.start) * pxPerSec - 2), height: 40,
                background: em ? '#C8FF00' : 'var(--editor-block)', color: em ? '#000' : 'var(--text)',
                outline: sel ? '2px solid var(--accent)' : 'none',
                fontFamily: withScript("'Inter',sans-serif") }}>
              <span className="truncate">{w.text}</span>
            </button>
          );
        });
    }
    return segments
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.end >= from && s.start <= to)
      .map(({ s, i }) => {
        const sel = selLines.has(i) || i === selLine;
        return (
          <div key={s.id} data-tl-seg={i} onClick={(e) => e.stopPropagation()}
            className="tl-seg absolute top-3 flex items-stretch rounded-lg text-[10px] font-semibold" title={s.text}
            style={{ left: s.start * pxPerSec, width: Math.max(14, (s.end - s.start) * pxPerSec - 2), height: 44,
              boxShadow: sel ? '0 0 0 2px var(--accent), 0 4px 14px rgba(0,0,0,.35)' : '0 2px 8px rgba(0,0,0,.2)',
              fontFamily: withScript("'Inter',sans-serif") }}>
            <span onPointerDown={(e) => startEdge(e, i, 'start')} className="w-2 shrink-0 cursor-ew-resize rounded-l-lg" style={{ background: 'rgba(255,255,255,.22)' }} />
            <span onPointerDown={(e) => startMove(e, i)} className="flex min-w-0 flex-1 cursor-grab items-center px-1.5 active:cursor-grabbing"><span className="truncate">{shown(s)}</span></span>
            <span onPointerDown={(e) => startEdge(e, i, 'end')} className="w-2 shrink-0 cursor-ew-resize rounded-r-lg" style={{ background: 'rgba(255,255,255,.22)' }} />
          </div>
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tlMode, tlWindow, allWords, segments, pxPerSec, selWords, selLine, selLines, wordStyles, romanOn, romanMap, totalDur]);

  /* keep the imperative "active caption" highlight in sync with activeIdx */
  useEffect(() => {
    const el = tlRef.current; if (!el) return;
    const prev = el.querySelector('[data-tl-seg][data-on]');
    if (prev) prev.removeAttribute('data-on');
    if (activeIdx >= 0) el.querySelector(`[data-tl-seg="${activeIdx}"]`)?.setAttribute('data-on', '1');
    const prevRow = document.querySelector('[data-cap-row][data-on]');
    if (prevRow) prevRow.removeAttribute('data-on');
    if (activeIdx >= 0) document.querySelector(`[data-cap-row="${activeIdx}"]`)?.setAttribute('data-on', '1');
  }, [activeIdx, tlBlocks, tlMode]);

  if (loading) return (<div className="fixed inset-0 z-50 grid place-items-center" style={{ background: 'var(--editor-bg)' }}><Loader2 className="animate-spin" style={{ color: 'var(--accent)' }} size={30} /></div>);

  /* ── My Animations panel (shared by the Transitions and My Presets tabs) ── */
  const applyTransition = (id: string) => {
    if (trMode === 'line') {
      if (trScope === 'line' && selLine >= 0) patchLine(selLine, { transition: id });
      else {
        patchGlobal({ transition: id });
        // "Apply to All": clear per-line overrides so it's truly universal
        setSegments((prev) => prev.map((s) => (s.style?.transition !== undefined ? { ...s, style: { ...s.style, transition: undefined } } : s)));
      }
    } else {
      if (selWords.size) patchWords({ wordTransition: id } as any); else patchGlobal({ wordTransition: id });
    }
    previewFromHere(trMode === 'line' && trScope === 'line' && selLine >= 0 ? selLine : undefined);
  };

  const currentTransitionId = trMode === 'line'
    ? (trScope === 'line' && selLine >= 0 ? effLine(selLine).transition : style.transition)
    : style.wordTransition;

  const MyAnimations = (
    <div className="space-y-3">
      <input ref={animInputRef} type="file" accept=".css,text/css" className="hidden" onChange={(e) => addAnimation(e.target.files?.[0] || null)} />
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold">My Animations</p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Upload your own animation and apply it to captions</p>
        </div>
        <button onClick={() => animInputRef.current?.click()} disabled={animBusy} className="btn-primary !px-3 !py-2 text-xs disabled:opacity-60">
          {animBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
        </button>
      </div>

      {customAnims.length === 0 ? (
        <div className="surface p-3 text-left" style={{ background: 'var(--editor-panel)' }}>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Built an animation in After Effects or another tool? Export/save it as a <b>.css</b> file with an
            <code> @keyframes </code> rule and upload it here — it then works exactly like a built-in
            transition, on whole lines or on single words, and is burned into your exported video.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg p-2 text-[10px] leading-tight" style={{ background: 'var(--editor-surface)', color: 'var(--text-muted)' }}>{`@keyframes myBounce {
  0%   { opacity: 0; transform: translateY(40px) scale(.6); }
  60%  { opacity: 1; transform: translateY(-8px) scale(1.1); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}`}</pre>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {customAnims.map((a) => {
            const id = customAnimId(a.id);
            const on = currentTransitionId === id;
            return (
              <div key={a.id} className="relative">
                <button onClick={() => applyTransition(id)}
                  className="grid aspect-square w-full place-items-center gap-1.5 rounded-2xl border p-2 text-center transition"
                  style={{ background: 'var(--editor-panel)', borderColor: on ? 'var(--accent)' : 'transparent' }}>
                  <span key={`${a.id}-${bump}`} className={animClass(id)} style={{ animationDuration: '.6s' }}>
                    <Film size={18} style={{ color: on ? 'var(--accent)' : 'var(--text-muted)' }} />
                  </span>
                  <span className="line-clamp-2 text-[10px] font-semibold leading-tight" style={{ color: on ? 'var(--accent)' : 'var(--text-muted)' }}>{a.name}</span>
                </button>
                <button onClick={() => removeAnimation(a)} title="Delete animation"
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full"
                  style={{ background: 'var(--editor-surface)', border: '1px solid var(--editor-border)', color: '#ef4444' }}>
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ── Caption Tools dropdown ── */
  const ToolsPanel = (
    <div className="surface absolute left-3 right-3 top-[92px] z-40 max-h-[70vh] overflow-y-auto p-4 shadow-2xl editor-scroll" style={{ background: 'var(--editor-surface)', borderColor: 'var(--editor-border)' }}>
      <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Display Settings</p>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="mb-1 block text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Words / Line</label>
          <select className="input !py-2 text-xs" value={wordsPer} onChange={(e) => setWordsPer(e.target.value as any)}><option value="1">1 Word</option><option value="2">2 Words</option><option value="3">3 Words</option><option value="chars">By Chars</option></select></div>
        <div><label className="mb-1 block text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Max Chars</label>
          <input type="number" className="input !py-2 text-xs" value={maxChars} onChange={(e) => setMaxChars(Math.max(6, Number(e.target.value)))} /></div>
        <div><label className="mb-1 block text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Lines</label>
          <select className="input !py-2 text-xs" value={lineCount} onChange={(e) => setLineCount(Number(e.target.value))}><option value={1}>1 Line</option><option value={2}>2 Lines</option></select></div>
      </div>
      <button onClick={applySplit} className="btn-primary mt-3 w-full !py-2 text-xs">
        Apply split ({wordsPer === 'chars' ? `${maxChars} chars` : `${wordsPer} word${wordsPer === '1' ? '' : 's'}`} × {lineCount} line{lineCount === 1 ? '' : 's'})
      </button>

      <p className="mb-2 mt-5 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Actions</p>
      <div className="space-y-2">
        <ToolRow title="Remove Punctuation" desc="Strip all punctuation for a cleaner, minimal look" onClick={rmPunct} />
        <ToolRow title="Remove Emphasis" desc="Remove all text emphasis for uniform appearance" onClick={rmEmph} />
        <ToolRow title="Remove Gaps in Captions" desc="Eliminate gaps between captions for seamless flow" onClick={rmGaps} />
        <ToolRow title="Remove Emojis" desc="Remove all emojis from captions" onClick={rmEmoji} />
        <ToolRow title={romanOn ? 'Show Native Script' : 'Show Roman Script'} desc="Transliterate captions between native and Roman" onClick={toggleRoman} busy={romanizing} on={romanOn} icon={Languages} />
      </div>

      <p className="mb-2 mt-5 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Timing</p>
      <div className="surface p-3" style={{ background: 'var(--editor-panel)' }}>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold"><Clock size={14} style={{ color: 'var(--accent)' }} /> Caption Delay</span>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{delay === 0 ? 'No delay' : `${delay > 0 ? '+' : ''}${delay.toFixed(1)}s`}</span>
        </div>
        <input type="range" min={-5} max={5} step={0.1} value={delay} onChange={(e) => setDelayV(Number(e.target.value))} className="w-full" />
        <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}><span>-5s</span><span>0</span><span>+5s</span></div>
      </div>
    </div>
  );

  /* ── Line Styling popover (⊞ on each caption row) ── */
  const LineStyling = lineStylingFor === null ? null : (() => {
    const i = lineStylingFor; const st = effLine(i);
    return (
      <div className="fixed inset-0 z-[70]" onClick={() => setLineStylingFor(null)}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="surface absolute left-1/2 top-1/2 max-h-[80vh] w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-0 shadow-2xl editor-scroll"
          style={{ background: 'var(--editor-surface)', borderColor: 'var(--editor-border)' }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--editor-border)' }}>
            <span className="flex items-center gap-2 text-sm font-bold"><LayoutGrid size={16} style={{ color: 'var(--accent)' }} /> LINE STYLING</span>
            <span className="rounded-md px-3 py-1 text-[11px] font-semibold" style={{ background: 'var(--editor-panel)', color: 'var(--text-muted)' }}>Line {i + 1}</span>
          </div>

          <button onClick={() => setCollapsed((c) => ({ ...c, typo: !c.typo }))} className="flex w-full items-center gap-2 border-b px-4 py-3 text-[11px] font-bold uppercase tracking-widest" style={{ borderColor: 'var(--editor-border)', color: 'var(--text-muted)' }}>
            {collapsed.typo ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Typography
          </button>
          {collapsed.typo && (
            <div className="space-y-3 border-b px-4 py-3" style={{ borderColor: 'var(--editor-border)' }}>
              <Row label="Font Family"><select className="input !py-2 text-sm" value={st.fontFamily} onChange={(e) => patchLine(i, { fontFamily: e.target.value })}>{allFonts.map((f) => <option key={f.label} value={f.family}>{f.label}</option>)}</select></Row>
              <Row label="Font Face"><select className="input !py-2 text-sm" value={st.fontWeight} onChange={(e) => patchLine(i, { fontWeight: Number(e.target.value) })}>{WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}</select></Row>
              <Row label="Size"><input type="range" min={12} max={72} value={st.fontSize} onChange={(e) => patchLine(i, { fontSize: Number(e.target.value) })} className="w-full" /></Row>
              <Row label="Color"><div className="flex items-center gap-2"><input type="color" value={st.color} onChange={(e) => patchLine(i, { color: e.target.value })} className="h-8 w-10 rounded border-0 bg-transparent" /><input className="input !py-2 text-sm font-mono" value={st.color} onChange={(e) => patchLine(i, { color: e.target.value })} /></div></Row>
            </div>
          )}

          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--editor-border)' }}>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Background</span>
            <Switch on={st.background} onClick={() => patchLine(i, { background: !st.background })} />
          </div>

          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--editor-border)' }}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Position</p>
            <div className="surface p-3" style={{ background: 'var(--editor-panel)' }}>
              <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>Position</p>
              <div className="flex items-center gap-2">
                <span className="text-xs">X</span>
                <input type="number" className="input !py-1.5 text-xs" value={st.posX.toFixed(1)} onChange={(e) => patchLine(i, { posX: Number(e.target.value) })} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
                <button onClick={() => patchLine(i, { posX: DEFAULT_STYLE.posX })} className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: 'var(--editor-surface)' }}><RotateCcw size={13} /></button>
                <span className="text-xs">Y</span>
                <input type="number" className="input !py-1.5 text-xs" value={st.posY.toFixed(1)} onChange={(e) => patchLine(i, { posY: Number(e.target.value) })} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
                <button onClick={() => patchLine(i, { posY: DEFAULT_STYLE.posY })} className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: 'var(--editor-surface)' }}><RotateCcw size={13} /></button>
              </div>
            </div>
          </div>

          <div className="px-4 py-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Templates</p>
            <div className="surface mb-3 flex items-center gap-2 px-3 py-2" style={{ background: 'var(--editor-panel)' }}>
              <SearchIcon size={14} style={{ color: 'var(--text-muted)' }} />
              <input value={tplSearch} onChange={(e) => setTplSearch(e.target.value)} placeholder="Search templates..." className="w-full bg-transparent text-sm outline-none" />
            </div>
            <div className="space-y-2">
              {TEMPLATES.filter((t) => t.name.toLowerCase().includes(tplSearch.toLowerCase())).map((t) => (
                <button key={t.name} onClick={() => { patchLine(i, t.patch); toast.success(`${t.name} → Line ${i + 1}`); }} className="surface w-full p-3 text-left" style={{ background: 'var(--editor-panel)', borderColor: 'var(--editor-border)' }}>
                  <div className="mb-2 flex items-center gap-1.5"><span className="text-sm font-bold">{t.name}</span>{t.premium && <span className="text-xs">👑</span>}</div>
                  <TplPreview t={t} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  })();

  const CaptionRail = (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <h2 className="text-xl font-extrabold">Captions</h2>
        <div className="flex items-center gap-2">
          <button className="grid h-9 w-9 place-items-center rounded-full" style={{ background: 'var(--editor-panel)' }}><Search size={15} /></button>
          <button onClick={() => setShowTools((v) => !v)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: 'var(--editor-panel)', color: showTools ? 'var(--accent)' : 'var(--text)' }}>
            <Settings2 size={14} style={{ color: 'var(--accent)' }} /> Caption Tools <ChevronDown size={13} style={{ transform: showTools ? 'rotate(180deg)' : 'none' }} />
          </button>
        </div>
      </div>
      <div className="px-4 pb-2 pt-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search captions…" className="input !py-2 text-xs" />
      </div>
      {selLines.size > 0 ? (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(79,140,255,.12)', border: '1px solid var(--accent)' }}>
          <span className="text-xs font-semibold">{selLines.size} selected</span>
          <button onClick={selectAllLines} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Select all</button>
          <div className="flex-1" />
          <button onClick={clearSel} className="text-xs" style={{ color: 'var(--text-muted)' }}>Clear</button>
          <button onClick={removeSelected} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
            style={{ background: '#ef4444', color: '#fff' }}><Trash2 size={12} /> Delete</button>
        </div>
      ) : (
        <p className="px-4 pb-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Tip: Shift-click to select a range, Ctrl/Cmd-click to add one, then Delete.
        </p>
      )}
      {showTools && ToolsPanel}
      <div className="editor-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {capRows}
      </div>
    </div>
  );

  const selWordText = selWords.size === 1 ? allWords.find((w) => w.key === Array.from(selWords)[0])?.text : null;

  const ExportPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-5"><h2 className="text-2xl font-extrabold">Export</h2></div>
      <div className="editor-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {isFree && (TEMPLATES.find((t) => t.name === appliedTpl)?.premium || expRes === '1080') && (
          <div className="flex gap-3 rounded-2xl border p-4" style={{ borderColor: 'rgba(239,68,68,.4)', background: 'rgba(239,68,68,.08)' }}>
            <Ban size={18} className="mt-0.5 shrink-0" style={{ color: '#ef4444' }} />
            <p className="text-sm leading-snug" style={{ color: '#f87171' }}>
              Premium templates are preview-only on your plan. Switch to a free template to render now, or upgrade to use this one.
            </p>
          </div>
        )}
        <div>
          <label className="mb-2 block text-sm font-bold">Type</label>
          <select className="input" value={expType} onChange={(e) => setExpType(e.target.value as any)}>
            <option value="video">Video</option><option value="srt">Subtitles (.srt)</option><option value="txt">Transcript (.txt)</option>
          </select>
        </div>
        {expType === 'video' && (
          <div>
            <label className="mb-2 block text-sm font-bold">Resolution</label>
            <select className="input" value={expRes} onChange={(e) => setExpRes(e.target.value as any)}>
              <option value="720">720P</option><option value="1080">1080P {isFree ? '(Premium)' : ''}</option>
            </select>
          </div>
        )}
        {rendering && (
          <div className="surface p-4" style={{ background: 'var(--editor-panel)' }}>
            <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold">Rendering…</span><span className="tabular-nums">{pct}%</span></div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--editor-border)' }}><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} /></div>
            <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>Rendering plays the video once in real time. Keep this tab open.</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 border-t p-3" style={{ borderColor: 'var(--editor-border)' }}>
        <button onClick={() => setExportOpen(false)} className="btn-ghost flex-1 !py-3">Back</button>
        <button onClick={render} disabled={rendering} className="btn-primary flex-1 !py-3 disabled:opacity-50">{rendering ? <Loader2 size={16} className="animate-spin" /> : null} Render</button>
      </div>
    </div>
  );

  const Inspector = exportOpen ? ExportPanel : (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-1 border-b px-3 pt-3" style={{ borderColor: 'var(--editor-border)' }}>
        {(['text', 'templates', 'transitions', 'audio'] as const).map((t) => {
          const on = tab === t; const label = t === 'audio' ? 'AI Audio' : t[0].toUpperCase() + t.slice(1);
          return (<button key={t} onClick={() => setTab(t)} className="relative px-3 py-2.5 text-[13px] font-semibold transition" style={{ color: on ? 'var(--accent)' : 'var(--text-muted)' }}>{label}{on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: 'var(--accent)' }} />}</button>);
        })}
      </div>

      <div className="editor-scroll min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'text' && (
          <div className="space-y-5">
            <div className="surface p-3" style={{ background: 'var(--editor-panel)' }}>
              <div className="mb-2 flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-surface)' }}>
                <Tab2 on={txtScope === 'all'} onClick={() => setTxtScope('all')}>All Captions</Tab2>
                <Tab2 on={txtScope === 'line'} onClick={() => { if (selLine >= 0) setTxtScope('line'); else toast('Select a caption first', { icon: 'ℹ️' }); }}>This Line</Tab2>
                <Tab2 on={txtScope === 'word'} onClick={() => { if (selWords.size > 0) setTxtScope('word'); else toast('Select word(s) in the timeline first', { icon: 'ℹ️' }); }}>Word</Tab2>
              </div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold">{txtScope === 'word' ? 'Editing Word Style' : txtScope === 'line' ? `Editing Line ${selLine + 1}` : 'Editing All Captions'}</span>
                <span className="text-[11px]" style={{ color: '#f5b74f' }}>{txtScope === 'word' ? 'Styles apply to selected word(s) only' : txtScope === 'line' ? 'Applies to this line' : 'Applies to every caption'}</span>
              </div>
              {selWordText && (<div className="mb-2 flex items-center gap-2 px-1"><span className="text-lg font-semibold" style={{ color: 'var(--accent)' }}>{selWordText}</span><Check size={16} style={{ color: 'var(--accent)' }} /></div>)}
              <input className="input !py-2.5 text-sm" value={selWords.size === 1 ? (selWordText || '') : selLine >= 0 ? shown(segments[selLine]) : ''} readOnly={selWords.size > 0}
                onChange={(e) => selLine >= 0 && selWords.size === 0 && updateText(selLine, e.target.value)} placeholder="Select a caption or word…" />
              <button onClick={() => { setSelWords(new Set()); setSelLine(-1); }} className="btn-ghost mt-2 w-full !py-2 text-xs">Clear Selection</button>
            </div>

            <Group title="Fonts" open={collapsed.fonts !== false} onToggle={() => setCollapsed((c) => ({ ...c, fonts: c.fonts === false }))}>
              <div className="flex items-center gap-2">
                <span className="w-[76px] shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>Font Family</span>
                <select className="input flex-1 !py-2 text-sm" value={targetStyle.fontFamily} onChange={(e) => patchTarget({ fontFamily: e.target.value })}>
                  {allFonts.map((f) => <option key={f.label} value={f.family} style={{ fontFamily: f.family }}>{f.label}</option>)}
                </select>
                <IconBtn onClick={() => patchTarget({ fontFamily: DEFAULT_STYLE.fontFamily })}><RotateCcw size={13} /></IconBtn>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[76px] shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>Font Face</span>
                <select className="input flex-1 !py-2 text-sm" value={targetStyle.fontWeight} onChange={(e) => patchTarget({ fontWeight: Number(e.target.value) })}>
                  {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
                <IconBtn onClick={() => patchTarget({ fontWeight: DEFAULT_STYLE.fontWeight })}><RotateCcw size={13} /></IconBtn>
              </div>
              <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={(e) => addFont(e.target.files?.[0] || null)} />
              <button onClick={() => fontInputRef.current?.click()} disabled={fontBusy} className="btn-ghost w-full !py-2 text-xs disabled:opacity-60">
                {fontBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add custom font (.ttf / .otf / .woff2)
              </button>
              <div className="flex items-center gap-2">
                <input type="range" min={10} max={90} value={targetStyle.fontSize} onChange={(e) => patchTarget({ fontSize: Number(e.target.value) })} className="flex-1" />
                <div className="surface flex w-[74px] items-center justify-between px-2 py-1.5 text-sm" style={{ background: 'var(--editor-panel)' }}><span>{targetStyle.fontSize}</span><span className="text-xs" style={{ color: 'var(--text-muted)' }}>px</span></div>
                <div className="flex flex-col">
                  <button onClick={() => patchTarget({ fontSize: Math.min(90, targetStyle.fontSize + 1) })} className="grid h-[18px] w-7 place-items-center rounded-t-md" style={{ background: 'var(--editor-panel)' }}><ChevronUp size={11} /></button>
                  <button onClick={() => patchTarget({ fontSize: Math.max(10, targetStyle.fontSize - 1) })} className="grid h-[18px] w-7 place-items-center rounded-b-md" style={{ background: 'var(--editor-panel)' }}><ChevronDown size={11} /></button>
                </div>
                <IconBtn onClick={() => patchTarget({ fontSize: DEFAULT_STYLE.fontSize })}><RotateCcw size={13} /></IconBtn>
              </div>
            </Group>

            <Group title="Format" open={collapsed.format !== false} onToggle={() => setCollapsed((c) => ({ ...c, format: c.format === false }))}>
              <div className="flex items-center justify-between"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>Styles</span>
                <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-panel)' }}>
                  <Seg2 on={targetStyle.uppercase} onClick={() => patchTarget({ uppercase: !targetStyle.uppercase })}><span className="text-sm font-bold">Tt</span></Seg2>
                  <Seg2 on={targetStyle.bold} onClick={() => patchTarget({ bold: !targetStyle.bold })}><span className="text-sm font-black">T</span></Seg2>
                  <Seg2 on={targetStyle.italic} onClick={() => patchTarget({ italic: !targetStyle.italic })}><span className="text-sm font-bold italic">t</span></Seg2>
                  <Seg2 on={targetStyle.underline} onClick={() => patchTarget({ underline: !targetStyle.underline })}><span className="text-sm font-bold underline">U</span></Seg2>
                </div>
              </div>
              <div className="flex items-center justify-between"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>Text Alignment</span>
                <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-panel)' }}>
                  <Seg2 on={targetStyle.align === 'left'} onClick={() => patchTarget({ align: 'left' })}><AlignLeft size={15} /></Seg2>
                  <Seg2 on={targetStyle.align === 'center'} onClick={() => patchTarget({ align: 'center' })}><AlignCenter size={15} /></Seg2>
                  <Seg2 on={targetStyle.align === 'right'} onClick={() => patchTarget({ align: 'right' })}><AlignRight size={15} /></Seg2>
                </div>
              </div>
            </Group>

            <Group title="Position" open={collapsed.pos !== false} onToggle={() => setCollapsed((c) => ({ ...c, pos: c.pos === false }))}>
              <div className="flex items-center gap-2">
                <span className="text-sm">X</span>
                <input type="number" className="input !py-2 text-sm" value={targetStyle.posX.toFixed(1)} onChange={(e) => patchTarget({ posX: Number(e.target.value) })} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
                <IconBtn onClick={() => patchTarget({ posX: DEFAULT_STYLE.posX })}><RotateCcw size={13} /></IconBtn>
                <span className="text-sm">Y</span>
                <input type="number" className="input !py-2 text-sm" value={targetStyle.posY.toFixed(1)} onChange={(e) => patchTarget({ posY: Number(e.target.value) })} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
                <IconBtn onClick={() => patchTarget({ posY: DEFAULT_STYLE.posY })}><RotateCcw size={13} /></IconBtn>
              </div>
            </Group>

            <Group title="Color" open={collapsed.color !== false} onToggle={() => setCollapsed((c) => ({ ...c, color: c.color === false }))}>
              <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-panel)' }}>
                <Tab2 on={targetStyle.colorMode === 'solid'} onClick={() => patchTarget({ colorMode: 'solid' })}><Circle size={12} /> Solid</Tab2>
                <Tab2 on={targetStyle.colorMode === 'gradient'} onClick={() => patchTarget({ colorMode: 'gradient' })}><Palette size={12} /> Gradient</Tab2>
              </div>
              <ColorRow label="Color" value={targetStyle.color} onChange={(v) => patchTarget({ color: v })} onReset={() => patchTarget({ color: DEFAULT_STYLE.color })} />
              {targetStyle.colorMode === 'gradient' && <ColorRow label="Color 2" value={targetStyle.color2} onChange={(v) => patchTarget({ color2: v })} onReset={() => patchTarget({ color2: DEFAULT_STYLE.color2 })} />}
            </Group>

            <Group title="Emphasis" open={collapsed.emph !== false} onToggle={() => setCollapsed((c) => ({ ...c, emph: c.emph === false }))}>
              {selWords.size === 0 && <p className="text-[11px]" style={{ color: '#f5b74f' }}>Select one or more words in the timeline to emphasize them.</p>}
              <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-panel)' }}>
                <Tab2 on={targetStyle.emphasisMode === 'emphasize'} onClick={() => patchTarget({ emphasisMode: 'emphasize', ...( selWords.size ? { emphasized: true } as any : {}) })}>Emphasize</Tab2>
                <Tab2 on={targetStyle.emphasisMode === 'spotlight'} onClick={() => patchTarget({ emphasisMode: 'spotlight', ...( selWords.size ? { emphasized: true } as any : {}) })}>Spotlight</Tab2>
              </div>
              <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-panel)' }}>
                <Tab2 on={targetStyle.emColorMode === 'solid'} onClick={() => patchTarget({ emColorMode: 'solid' })}><Circle size={12} /> Solid</Tab2>
                <Tab2 on={targetStyle.emColorMode === 'gradient'} onClick={() => patchTarget({ emColorMode: 'gradient' })}><Palette size={12} /> Gradient</Tab2>
              </div>
              <ColorRow label="Color" value={targetStyle.emColor} onChange={(v) => patchTarget({ emColor: v, ...(selWords.size ? { emphasized: true } as any : {}) })} onReset={() => patchTarget({ emColor: DEFAULT_STYLE.emColor })} />
              <div className="flex items-center gap-2">
                <span className="w-16 text-sm" style={{ color: 'var(--text-muted)' }}>Size</span>
                <input type="range" min={4} max={16} step={0.1} value={targetStyle.emSize} onChange={(e) => patchTarget({ emSize: Number(e.target.value) })} className="flex-1" />
                <div className="surface w-14 px-2 py-1.5 text-center text-sm" style={{ background: 'var(--editor-panel)' }}>{targetStyle.emSize.toFixed(1)}</div>
                <IconBtn onClick={() => patchTarget({ emSize: DEFAULT_STYLE.emSize })}><RotateCcw size={13} /></IconBtn>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[76px] shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>Font</span>
                <select className="input flex-1 !py-2 text-sm" value={targetStyle.emFont} onChange={(e) => patchTarget({ emFont: e.target.value })}>
                  {allFonts.map((f) => <option key={f.label} value={f.family}>{f.label}</option>)}
                </select>
                <IconBtn onClick={() => patchTarget({ emFont: DEFAULT_STYLE.emFont })}><RotateCcw size={13} /></IconBtn>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[76px] shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>Font Face</span>
                <select className="input flex-1 !py-2 text-sm" value={targetStyle.emWeight} onChange={(e) => patchTarget({ emWeight: Number(e.target.value) })}>
                  {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
                <IconBtn onClick={() => patchTarget({ emWeight: DEFAULT_STYLE.emWeight })}><RotateCcw size={13} /></IconBtn>
              </div>
              <div className="flex items-center justify-between"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>Emphasis Styles</span>
                <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-panel)' }}>
                  <Seg2 on={targetStyle.emUppercase} onClick={() => patchTarget({ emUppercase: !targetStyle.emUppercase })}><span className="text-sm font-bold">Tt</span></Seg2>
                  <Seg2 on={targetStyle.emBold} onClick={() => patchTarget({ emBold: !targetStyle.emBold })}><span className="text-sm font-black">T</span></Seg2>
                  <Seg2 on={targetStyle.emItalic} onClick={() => patchTarget({ emItalic: !targetStyle.emItalic })}><span className="text-sm font-bold italic">t</span></Seg2>
                  <Seg2 on={targetStyle.emUnderline} onClick={() => patchTarget({ emUnderline: !targetStyle.emUnderline })}><span className="text-sm font-bold underline">U</span></Seg2>
                </div>
              </div>
            </Group>

            <Group title="Spacing" open={collapsed.spacing !== false} onToggle={() => setCollapsed((c) => ({ ...c, spacing: c.spacing === false }))}>
              <SliderRow label="Letter Spacing" min={-2} max={12} step={1} value={targetStyle.letterSpacing} onChange={(v) => patchTarget({ letterSpacing: v })} onReset={() => patchTarget({ letterSpacing: 0 })} />
              <SliderRow label="Line Spacing" min={0.8} max={2.2} step={0.05} value={targetStyle.lineSpacing} onChange={(v) => patchTarget({ lineSpacing: v })} onReset={() => patchTarget({ lineSpacing: DEFAULT_STYLE.lineSpacing })} />
            </Group>

            <Group title="Effects" open={collapsed.fx !== false} onToggle={() => setCollapsed((c) => ({ ...c, fx: c.fx === false }))}>
              <SwitchRow label="Drop Shadow" on={targetStyle.dropShadow} onClick={() => patchTarget({ dropShadow: !targetStyle.dropShadow })} />
              <SwitchRow label="Glow" on={targetStyle.glow} onClick={() => patchTarget({ glow: !targetStyle.glow })} />
              <SwitchRow label="Text Stroke" on={targetStyle.textStroke} onClick={() => patchTarget({ textStroke: !targetStyle.textStroke })} />
              <SwitchRow label="Background" on={targetStyle.background} onClick={() => patchTarget({ background: !targetStyle.background })} />
              {targetStyle.background && (
                <ColorRow label="Bg Color" value={targetStyle.bgColor.startsWith('#') ? targetStyle.bgColor : '#000000'} onChange={(v) => patchTarget({ bgColor: v })} onReset={() => patchTarget({ bgColor: DEFAULT_STYLE.bgColor })} />
              )}
            </Group>
          </div>
        )}

        {tab === 'templates' && (
          <div className="space-y-4">
            <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-panel)' }}>
              <Tab2 on={tplTab === 'builtin'} onClick={() => setTplTab('builtin')}>Built-in Templates</Tab2>
              <Tab2 on={tplTab === 'presets'} onClick={() => setTplTab('presets')}>My Presets</Tab2>
            </div>
            <div className="flex gap-2">
              <div className="surface flex flex-1 items-center gap-2 px-3 py-2" style={{ background: 'var(--editor-panel)' }}>
                <SearchIcon size={14} style={{ color: 'var(--text-muted)' }} />
                <input value={tplSearch} onChange={(e) => setTplSearch(e.target.value)} placeholder="Find a template" className="w-full bg-transparent text-sm outline-none" />
              </div>
              <button onClick={savePreset} className="btn-ghost !px-3 !py-2 text-xs"><Bookmark size={14} /> Save preset</button>
            </div>

            {(tplTab === 'builtin' ? TEMPLATES : presets.map((p) => ({ name: p.name, patch: p.patch } as Tpl)))
              .filter((t) => t.name.toLowerCase().includes(tplSearch.toLowerCase()))
              .map((t) => {
                const active = appliedTpl === t.name;
                return (
                  <div key={t.name} className="surface overflow-hidden p-0" style={{ borderColor: active ? 'var(--accent)' : 'var(--editor-border)', background: 'var(--editor-surface)' }}>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="flex items-center gap-1.5 text-sm font-bold">{t.name}{(t as Tpl).premium && <span className="text-xs">👑</span>}</span>
                      <span className="flex items-center gap-2">{active && <Check size={16} style={{ color: 'var(--accent)' }} />}<Palette size={15} style={{ color: 'var(--text-muted)' }} /></span>
                    </div>
                    <button onClick={() => { setStyle((s) => ({ ...s, ...t.patch })); setAppliedTpl(t.name); if ((t as Tpl).patch.emColor) autoEmphasize(); markDirty(); previewFromHere(); toast.success(`${t.name} applied`); }} className="w-full px-4 pb-3">
                      <TplPreview t={t as Tpl} big />
                    </button>
                    {active && (
                      <div className="space-y-3 border-t px-4 py-3" style={{ borderColor: 'var(--editor-border)' }}>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Layout</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Toggle2 on={style.layout === 'splash'} onClick={() => patchGlobal({ layout: 'splash' })}><LayoutGrid size={14} /> Splash</Toggle2>
                            <Toggle2 on={style.layout === 'center'} onClick={() => patchGlobal({ layout: 'center' })}><AlignCenter size={14} /> Center</Toggle2>
                          </div>
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Colors</p>
                          <ColorRow label="Primary" value={style.color} onChange={(v) => patchGlobal({ color: v })} onReset={() => patchGlobal({ color: DEFAULT_STYLE.color })} />
                        </div>
                        <div className="surface space-y-2 p-3" style={{ background: 'var(--editor-panel)' }}>
                          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Emphasis</p>
                          <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-surface)' }}>
                            <Tab2 on={style.emphasisMode === 'emphasize'} onClick={() => patchGlobal({ emphasisMode: 'emphasize' })}>Emphasize</Tab2>
                            <Tab2 on={style.emphasisMode === 'spotlight'} onClick={() => patchGlobal({ emphasisMode: 'spotlight' })}>Spotlight</Tab2>
                          </div>
                          <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-surface)' }}>
                            <Tab2 on={style.emColorMode === 'solid'} onClick={() => patchGlobal({ emColorMode: 'solid' })}><Circle size={12} /> Solid</Tab2>
                            <Tab2 on={style.emColorMode === 'gradient'} onClick={() => patchGlobal({ emColorMode: 'gradient' })}><Palette size={12} /> Gradient</Tab2>
                          </div>
                          <ColorRow label="Color" value={style.emColor} onChange={(v) => patchGlobal({ emColor: v })} onReset={() => patchGlobal({ emColor: DEFAULT_STYLE.emColor })} />
                        </div>
                        <button onClick={() => { setStyle(DEFAULT_STYLE); setWordStyles({}); setAppliedTpl(null); markDirty(); }} className="btn-primary w-full !py-2.5 text-sm">Remove Style</button>
                      </div>
                    )}
                  </div>
                );
              })}
            {tplTab === 'presets' && presets.length === 0 && <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No presets yet. Style a caption, then “Save preset”.</p>}
            {tplTab === 'presets' && (
              <div className="border-t pt-4" style={{ borderColor: 'var(--editor-border)' }}>{MyAnimations}</div>
            )}
          </div>
        )}

        {tab === 'transitions' && (
          <div className="space-y-4">
            <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-panel)' }}>
              <Tab2 on={trMode === 'line'} onClick={() => setTrMode('line')}>Line</Tab2>
              <Tab2 on={trMode === 'word'} onClick={() => setTrMode('word')}>Word</Tab2>
            </div>
            <p className="text-sm font-semibold">Transitions will be <span style={{ color: 'var(--accent)' }}>Applied</span> on {trMode === 'line' ? 'Line' : 'Word'}</p>
            {trMode === 'line' && (
              <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--editor-panel)' }}>
                <Tab2 on={trScope === 'all'} onClick={() => setTrScope('all')}>Apply to All</Tab2>
                <Tab2 on={trScope === 'line'} onClick={() => { if (selLine >= 0) setTrScope('line'); else toast('Select a caption first', { icon: 'ℹ️' }); }}>This Caption</Tab2>
              </div>
            )}
            {trMode === 'word' && selWords.size === 0 && <p className="text-xs" style={{ color: '#f5b74f' }}>Please select one or more words to apply animations</p>}
            <div className="grid grid-cols-3 gap-3">
              {TRANSITIONS.map((tr) => {
                const on = currentTransitionId === tr.id;
                return (
                  <button key={tr.id} onClick={() => applyTransition(tr.id)}
                    className="grid aspect-square place-items-center gap-1.5 rounded-2xl border p-2 text-center transition"
                    style={{ background: 'var(--editor-panel)', borderColor: on ? 'var(--accent)' : 'transparent' }}>
                    <TrIcon id={tr.id} on={on} />
                    <span className="text-[10px] font-semibold leading-tight" style={{ color: on ? 'var(--accent)' : 'var(--text-muted)' }}>{tr.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="border-t pt-4" style={{ borderColor: 'var(--editor-border)' }}>{MyAnimations}</div>
            <div className="flex items-center justify-between pt-2">
              <div><p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Speed Mode <span style={{ color: 'var(--accent)' }}>● {style.speedMode === 'dynamic' ? 'Dynamic' : 'Manual'}</span></p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{style.speedMode === 'dynamic' ? 'Automatically calculated based on timing' : 'Set your preferred speed manually'}</p></div>
              <Switch on={style.speedMode === 'dynamic'} onClick={() => patchGlobal({ speedMode: style.speedMode === 'dynamic' ? 'manual' : 'dynamic' })} />
            </div>
            {style.speedMode === 'manual' && (
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Speed</span>
                <input type="range" min={10} max={100} value={style.speed} onChange={(e) => patchGlobal({ speed: Number(e.target.value) })} className="flex-1" />
                <div className="surface w-14 px-2 py-1.5 text-center text-sm" style={{ background: 'var(--editor-panel)' }}>{style.speed}</div>
              </div>
            )}
            <button onClick={() => { setBump((n) => n + 1); const s = segments[Math.max(0, activeIdx)]; if (s) seekTo(s.start + 0.01); }} className="btn-ghost w-full !py-2 text-xs">Preview transition</button>
          </div>
        )}

        {tab === 'audio' && (
          <div className="space-y-4 text-center">
            <span className="surface inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold" style={{ background: 'var(--editor-panel)', color: 'var(--accent)' }}><Sparkles size={13} /> AI-Powered</span>
            <h3 className="text-xl font-extrabold">Audio Enhancement</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Clean up your audio, Remove Background Noise &amp; Enhance Overall Audio Quality.</p>
            <p className="text-xs font-semibold italic" style={{ color: 'var(--text-muted)' }}>Audio Enhancement Removes Background Music as well!</p>
            <div className="surface flex items-center gap-3 p-3 text-left" style={{ background: 'var(--editor-panel)' }}>
              <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: cleanOn ? 'var(--accent)' : 'var(--editor-surface)', color: cleanOn ? '#fff' : 'var(--text-muted)' }}><SpeakerIcon size={18} /></span>
              <div className="flex-1"><p className="text-sm font-bold">AI Audio Cleaning</p><p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{cleanOn ? 'AI enhancement is active' : 'Playing original audio'}</p></div>
              <Switch on={cleanOn} onClick={toggleClean} />
            </div>
            <div className="surface p-4" style={{ background: 'var(--editor-panel)' }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: cleanOn ? 'var(--accent)' : 'var(--text-muted)' }}><span className="h-2 w-2 rounded-full" style={{ background: cleanOn ? 'var(--accent)' : 'var(--text-muted)' }} />{cleanOn ? 'Enhanced Audio' : 'Original Audio'}</span>
                <Zap size={14} style={{ color: cleanOn ? 'var(--accent)' : 'var(--text-muted)' }} />
              </div>
              <div className="flex h-16 items-center gap-[2px]">
                {waveHeights(46).map((h, i) => (<span key={i} className="flex-1 rounded-full" style={{ height: `${(cleanOn ? h * 1.25 : h) * 100}%`, background: cleanOn ? 'var(--accent)' : 'var(--text-muted)', opacity: cleanOn ? 0.9 : 0.4, transition: 'all .25s' }} />))}
              </div>
              <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>Press play and toggle to A/B before vs after.</p>
            </div>
            <div className="surface flex items-center gap-3 p-3 text-left" style={{ background: 'var(--editor-panel)' }}>
              <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'var(--editor-surface)' }}><Zap size={15} style={{ color: '#f5b74f' }} /></span>
              <div><p className="text-sm font-bold">Remaining Credits</p><p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{Math.max(0, 100 - (user?.usage.audioCleansUsed || 0))} credits available</p></div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-3" style={{ borderColor: 'var(--editor-border)' }}>
        <button onClick={() => setExportOpen(true)} className="btn-primary w-full !py-3">Export</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--editor-bg)', color: 'var(--text)' }}>
      <header className="flex items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-4" style={{ borderColor: 'var(--editor-border)', background: 'var(--editor-surface)' }}>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button onClick={() => router.push('/dashboard/projects')} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--editor-panel)' }}><ArrowLeft size={18} /></button>
          <input value={title} onChange={(e) => { setTitle(e.target.value); markDirty(); }} className="min-w-0 flex-1 truncate bg-transparent text-base font-extrabold outline-none sm:text-lg" />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button onClick={() => dl(segments.map((s) => shown(s)).join('\n'), `${safeName}.txt`)} className="btn-ghost !px-2.5 !py-2 text-xs"><FileText size={14} /><span className="hidden sm:inline"> TXT</span></button>
          <button onClick={() => dl(buildSrt(segments), `${safeName}.srt`)} className="btn-ghost !px-2.5 !py-2 text-xs"><Download size={14} /><span className="hidden sm:inline"> SRT</span></button>
          <button onClick={save} disabled={!dirty || saving} className="btn-primary !px-3 !py-2 text-xs disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}<span className="hidden sm:inline"> Save</span></button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <aside className="hidden w-[340px] shrink-0 border-r lg:block" style={{ borderColor: 'var(--editor-border)', background: 'var(--editor-surface)' }}>{CaptionRail}</aside>
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
            <div ref={wrapRef} className="flex min-h-0 flex-1 items-center justify-center">
            <div ref={stageRef} className="relative overflow-hidden rounded-2xl border bg-black" style={{ borderColor: 'var(--editor-border)', width: fitW, height: fitH }}>
              {project?.videoUrl ? (<><video ref={videoRef} src={project.videoUrl} crossOrigin="anonymous" preload="auto" onClick={togglePlay} playsInline disablePictureInPicture className="h-full w-full cursor-pointer object-contain" /><canvas ref={canvasRef} className="hidden" /></>)
                : (<div className="grid h-full place-items-center text-sm" style={{ color: 'var(--text-muted)' }}>Video preview unavailable</div>)}
              {!playing && project?.videoUrl && (
                <button onClick={togglePlay} className="absolute inset-0 z-[4] grid place-items-center transition hover:opacity-90" style={{ background: 'rgba(0,0,0,.18)' }}>
                  <span className="grid h-16 w-16 place-items-center rounded-full" style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 10px 32px rgba(0,0,0,.45)' }}><Play size={26} className="ml-1" /></span>
                </button>
              )}
              <div className="absolute left-3 top-3"><span className="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(0,0,0,.55)', color: '#fff' }}><RotateCcw size={12} /> Replace</span></div>
              <div className="absolute right-3 top-3"><span className="rounded-md px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(0,0,0,.55)', color: '#f5b74f' }}>● Low-res</span></div>
              <PerfHud videoRef={videoRef} segments={segments.length} />

              {activeSeg && activeWords.length > 0 && (
                <div key={`${activeIdx}-${lineSt.transition}-${bump}`} style={overlayWrap} onPointerDown={onCapPointerDown} title="Drag to reposition">
                  <span className={lineAnim} style={{ ...boxStyle, animationDuration: `${animDur(lineSt, activeSeg, lineSt.transition)}s` }}>
                    {rowsOf(activeWords, activeSeg.lines || 1).map((row, ri) => (
                    <span key={`r${ri}`} style={(activeSeg.lines || 1) > 1
                      ? { display: 'block', textAlign: lineSt.align }
                      : { display: 'contents' }}>
                    {row.map((w) => {
                      const ws = wordStyles[w.key] || {};
                      const wtr = (ws as any).wordTransition || style.wordTransition;
                      // Each word enters at its spoken moment within the caption.
                      // Manual Speed Mode scales the pace (lower speed = longer delays).
                      const scale = lineSt.speedMode === 'manual' ? (110 - lineSt.speed) / 50 : 1;
                      const delay = activeSeg ? Math.max(0, w.start - activeSeg.start) * scale : w.wi * 0.12 * scale;
                      const wSel = selWords.has(w.key);
                      return (
                        <span
                          key={w.key}
                          className={animClass(wtr)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (dragMovedRef.current) return; // it was a drag, not a click
                            toggleWord(w.key, e.ctrlKey || e.metaKey || e.shiftKey);
                          }}
                          style={{
                            ...wordSpan(w),
                            cursor: 'pointer', pointerEvents: 'auto',
                            animationDuration: `${animDur(lineSt, activeSeg || undefined, wtr)}s`,
                            ...(wSel ? { outline: '1.5px dashed var(--accent)', outlineOffset: 2, borderRadius: 4 } : {}),
                            ...(wtr && wtr !== 'none' ? { animationDelay: `${delay.toFixed(3)}s` } : {}),
                          }}
                        >{w.text}</span>
                      );
                    })}
                    </span>
                    ))}
                  </span>
                  {selLine === activeIdx && (
                    <>
                      {([[-1, -1, 'nwse'], [1, -1, 'nesw'], [-1, 1, 'nesw'], [1, 1, 'nwse']] as [number, number, string][]).map(([hx, hy, cur]) => (
                        <span key={`c${hx}${hy}`} onPointerDown={(e) => startBoxResize(e, 'corner', hx, hy)}
                          className="absolute z-10 h-3 w-3 rounded-full border-2 border-white"
                          style={{ background: 'var(--accent)', cursor: `${cur}-resize`,
                            left: hx < 0 ? -7 : undefined, right: hx > 0 ? -7 : undefined,
                            top: hy < 0 ? -7 : undefined, bottom: hy > 0 ? -7 : undefined }} />
                      ))}
                      {[-1, 1].map((hx) => (
                        <span key={`s${hx}`} onPointerDown={(e) => startBoxResize(e, 'width', hx, 0)}
                          className="absolute z-10 h-5 w-2.5 -translate-y-1/2 rounded-sm border-2 border-white"
                          style={{ background: 'var(--accent)', cursor: 'ew-resize', top: '50%',
                            left: hx < 0 ? -7 : undefined, right: hx > 0 ? -7 : undefined }} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            </div>

            <div className="mx-auto mt-3 w-full max-w-2xl shrink-0 rounded-2xl border px-3 pb-2.5 pt-2.5" style={{ borderColor: 'var(--editor-border)', background: 'var(--editor-surface)' }}>
              <input
                ref={seekRef}
                type="range" min={0} max={totalDur || 1} step={0.01} defaultValue={0}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="seekbar mb-2.5 w-full"
                style={{ background: 'linear-gradient(to right, var(--text) 0%, var(--editor-border) 0%)' }}
              />
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: 'var(--accent)', color: '#fff' }}>{playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}</button>
              <button onClick={toggleMute} className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: 'var(--editor-panel)' }}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
              <div className="surface px-4 py-2 font-mono text-xs tabular-nums" style={{ background: 'var(--editor-panel)', color: 'var(--text-muted)' }}>
                <span ref={clockRef} style={{ color: 'var(--text)' }}>{tc(0)}</span> / {tc(totalDur)}
              </div>
              <div className="flex-1" />
              <button onClick={fs} className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: 'var(--editor-panel)' }}><Maximize2 size={16} /></button>
              </div>
            </div>
            </main>
          </div>

          {/* full-width editor band: toolbar + timeline (spans under captions + video) */}
          <div className="border-t px-3 pb-2 pt-3 sm:px-4" style={{ borderColor: 'var(--editor-border)', background: 'var(--editor-surface)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl p-0.5" style={{ background: 'var(--editor-panel)' }}>
                {(['word', 'line'] as const).map((m) => (
                  <button key={m} onClick={() => { setTlMode(m); setSelWords(new Set()); }} className="rounded-lg px-4 py-1.5 text-xs font-bold uppercase transition"
                    style={tlMode === m ? { background: 'var(--editor-surface)', color: 'var(--text)' } : { color: 'var(--text-muted)' }}>{m}</button>
                ))}
              </div>
              <button onClick={addLine} className="btn-ghost !px-3 !py-1.5 text-xs"><Plus size={14} /> {tlMode === 'line' ? 'Line' : 'Word'}</button>
              <div className="mx-1 h-6 w-px" style={{ background: 'var(--editor-border)' }} />
              <button onClick={() => { const s = [...segments].reverse().find((x) => x.end < currentRef.current); if (s) seekTo(s.start); }} className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: 'var(--editor-panel)' }}><ChevronLeft size={15} /></button>
              <button onClick={() => { const s = segments.find((x) => x.start > currentRef.current); if (s) seekTo(s.start); }} className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: 'var(--editor-panel)' }}><ChevronRight size={15} /></button>
              <button onClick={removeSelected} title={selLines.size > 1 ? `Delete ${selLines.size} captions` : 'Delete caption'}
                className="flex h-8 items-center gap-1 rounded-lg px-2" style={{ background: 'var(--editor-panel)', color: selLines.size ? '#ef4444' : 'var(--text)' }}>
                <Trash2 size={15} />{selLines.size > 1 && <span className="text-xs font-bold">{selLines.size}</span>}
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setPxPerSec((z) => Math.max(4, z - 8))} className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: 'var(--editor-panel)' }}><ZoomOut size={15} /></button>
                <input type="range" min={4} max={220} value={pxPerSec} onChange={(e) => setPxPerSec(Number(e.target.value))} className="w-28" />
                <button onClick={() => setPxPerSec((z) => Math.min(220, z + 8))} className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: 'var(--editor-panel)' }}><ZoomIn size={15} /></button>
              </div>
            </div>

            {/* timeline */}
            <div className="mt-3 rounded-2xl border" style={{ borderColor: 'var(--editor-border)', background: 'var(--editor-surface)' }}>
              <div ref={tlRef} className="editor-scroll relative overflow-x-auto"
                onClick={(e) => { const el = tlRef.current; if (!el) return; const r = el.getBoundingClientRect(); const x = e.clientX - r.left + el.scrollLeft; seekTo(Math.max(0, Math.min(totalDur, x / pxPerSec))); }}>
                <div className="relative" style={{ width: tlWidth, minHeight: 190 }}>
                  {rulerRow}

                  <div className="relative h-[72px] border-b" style={{ borderColor: 'var(--editor-border)' }}>{tlBlocks}</div>

                  {waveRow}

                  <div ref={playheadRef} className="pointer-events-none absolute inset-y-0 z-10" style={{ left: 0, transform: 'translateX(0px)', willChange: 'transform' }}>
                    <div className="h-full w-0.5" style={{ background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }} />
                    <div className="absolute -left-2 -top-0.5 h-3.5 w-4" style={{ background: 'var(--accent)', clipPath: 'polygon(0 0,100% 0,50% 100%)' }} />
                  </div>
                </div>
              </div>
            </div>

            {tlMode === 'word' && (
              <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Click a word to style it · Ctrl/Cmd-click to select several · {selWords.size} selected
              </p>
            )}
          </div>

          <div className="flex items-center justify-around border-t p-2 lg:hidden" style={{ borderColor: 'var(--editor-border)', background: 'var(--editor-surface)' }}>
            <button onClick={() => setMobilePanel('captions')} className="flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}><FileText size={18} /> Captions</button>
            <button onClick={togglePlay} className="grid h-11 w-11 place-items-center rounded-full" style={{ background: 'var(--accent)', color: '#fff' }}>{playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}</button>
            <button onClick={() => setMobilePanel('inspector')} className="flex flex-col items-center gap-0.5 px-4 py-1 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}><Sparkles size={18} /> Style</button>
          </div>
        </div>

        <aside className="hidden w-[380px] shrink-0 border-l lg:block" style={{ borderColor: 'var(--editor-border)', background: 'var(--editor-surface)' }}>{Inspector}</aside>
      </div>

      {LineStyling}

      {mobilePanel !== 'none' && (
        <div className="fixed inset-0 z-[60] lg:hidden" onClick={() => setMobilePanel('none')}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-x-0 bottom-0 top-14 flex flex-col rounded-t-3xl border-t" style={{ background: 'var(--editor-surface)', borderColor: 'var(--editor-border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-bold">{mobilePanel === 'captions' ? 'Captions' : 'Style'}</span>
              <button onClick={() => setMobilePanel('none')} className="grid h-8 w-8 place-items-center rounded-full" style={{ background: 'var(--editor-panel)' }}><X size={16} /></button>
            </div>
            <div className="min-h-0 flex-1">{mobilePanel === 'captions' ? CaptionRail : Inspector}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════ UI atoms ══════════════════════ */

/**
 * Playback profiler. Add ?perf=1 to the editor URL to show it.
 *
 * It separates the three things that look identical to a viewer ("the video
 * keeps sticking") but have completely different fixes:
 *   decode   — dropped frames: the file is too heavy for this machine to decode
 *   network  — buffered-ahead seconds falling to ~0: it is still downloading
 *   main     — long-task milliseconds per second: JavaScript is blocking paint
 */
function PerfHud({ videoRef, segments }: { videoRef: React.RefObject<HTMLVideoElement>; segments: number }) {
  const [on, setOn] = useState(false);
  const [s, setS] = useState({ fps: 0, dropped: 0, total: 0, ahead: 0, blocked: 0, res: '', stalls: 0 });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOn(new URLSearchParams(window.location.search).get('perf') === '1');
  }, []);
  useEffect(() => {
    if (!on) return;
    let blocked = 0, stalls = 0, raf = 0, last = performance.now(), frames = 0, lastT = 0;
    let po: PerformanceObserver | null = null;
    try {
      po = new PerformanceObserver((l) => { for (const e of l.getEntries()) blocked += e.duration; });
      po.observe({ entryTypes: ['longtask'] });
    } catch {}
    const v = videoRef.current;
    const onWait = () => { stalls++; };
    v?.addEventListener('waiting', onWait);
    v?.addEventListener('stalled', onWait);
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        const vid = videoRef.current;
        let ahead = 0;
        if (vid) {
          for (let i = 0; i < vid.buffered.length; i++) {
            if (vid.currentTime >= vid.buffered.start(i) && vid.currentTime <= vid.buffered.end(i)) {
              ahead = vid.buffered.end(i) - vid.currentTime; break;
            }
          }
        }
        const q = vid?.getVideoPlaybackQuality?.();
        setS({
          fps: Math.round((frames * 1000) / (now - last)),
          dropped: q?.droppedVideoFrames ?? 0,
          total: q?.totalVideoFrames ?? 0,
          ahead: Math.round(ahead),
          blocked: Math.round(blocked),
          stalls,
          res: vid ? `${vid.videoWidth}×${vid.videoHeight}` : '',
        });
        blocked = 0; frames = 0; last = now; lastT = vid?.currentTime ?? 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); po?.disconnect();
      v?.removeEventListener('waiting', onWait); v?.removeEventListener('stalled', onWait);
    };
  }, [on, videoRef]);
  if (!on) return null;
  const warn = (bad: boolean) => ({ color: bad ? '#ff6b6b' : '#8ef58e' });
  return (
    <div className="absolute bottom-3 left-3 z-[9] rounded-lg px-3 py-2 font-mono text-[11px] leading-relaxed"
      style={{ background: 'rgba(0,0,0,.78)', color: '#ddd', pointerEvents: 'none' }}>
      <div>source {s.res} · {segments} captions</div>
      <div>decode  <span style={warn(s.total > 0 && s.dropped / s.total > 0.02)}>{s.dropped}/{s.total} dropped</span></div>
      <div>network <span style={warn(s.ahead < 3)}>{s.ahead}s buffered</span> · {s.stalls} stalls</div>
      <div>main    <span style={warn(s.blocked > 150)}>{s.blocked} ms/s blocked</span> · {s.fps} fps</div>
    </div>
  );
}

/** Timeline waveform, painted once to a canvas instead of ~2 400 DOM nodes. */
function WaveRow({ width, seconds }: { width: number; seconds: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const h = 80;
    c.width = Math.max(1, Math.floor(width * dpr));
    c.height = Math.floor(h * dpr);
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, h);
    const bars = Math.max(40, Math.min(1400, Math.floor(width / 4)));
    const hs = waveHeights(bars);
    const bw = Math.max(1.5, width / bars - 2);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(79,140,255,1)');
    grad.addColorStop(1, 'rgba(79,140,255,.4)');
    ctx.fillStyle = grad;
    for (let i = 0; i < bars; i++) {
      const bh = hs[i] * h;
      const x = (i * width) / bars;
      const r = Math.min(bw / 2, 3);
      roundRect(ctx, x, (h - bh) / 2, bw, bh, r);
      ctx.fill();
    }
  }, [width, seconds]);
  return <canvas ref={ref} className="block h-20" style={{ width, background: 'var(--editor-panel)' }} />;
}

function Group({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div>
      <button onClick={onToggle} className="mb-2 flex w-full items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {title}
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}
function IconBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--editor-panel)' }}>{children}</button>;
}
function Stepper({ label, value, onPrev, onNext, onReset, bold }: { label: string; value: string; onPrev: () => void; onNext: () => void; onReset: () => void; bold?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[76px] shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="surface flex-1 px-3 py-2 text-sm" style={{ background: 'var(--editor-panel)', fontWeight: bold ? 800 : 500 }}>{value}</div>
      <div className="flex flex-col">
        <button onClick={onNext} className="grid h-[18px] w-7 place-items-center rounded-t-md" style={{ background: 'var(--editor-panel)' }}><ChevronUp size={11} /></button>
        <button onClick={onPrev} className="grid h-[18px] w-7 place-items-center rounded-b-md" style={{ background: 'var(--editor-panel)' }}><ChevronDown size={11} /></button>
      </div>
      <IconBtn onClick={onReset}><RotateCcw size={13} /></IconBtn>
    </div>
  );
}
function Seg2({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="grid h-8 w-9 place-items-center rounded-lg transition" style={{ background: on ? 'var(--editor-surface)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-muted)' }}>{children}</button>;
}
function Tab2({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition" style={{ background: on ? 'var(--editor-surface)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-muted)' }}>{children}</button>;
}
function Toggle2({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-semibold" style={{ background: 'var(--editor-panel)', borderColor: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-muted)' }}>{children}</button>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="flex items-center gap-2"><span className="w-[86px] shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span><div className="flex-1">{children}</div></div>);
}
function ColorRow({ label, value, onChange, onReset }: { label: string; value: string; onChange: (v: string) => void; onReset: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="surface flex flex-1 items-center gap-2 px-2 py-1.5" style={{ background: 'var(--editor-panel)' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>#</span>
        <input value={value.replace('#', '').toUpperCase()} onChange={(e) => onChange('#' + e.target.value.replace('#', ''))} className="w-full bg-transparent text-sm font-mono outline-none" />
      </div>
      <IconBtn onClick={onReset}><RotateCcw size={13} /></IconBtn>
    </div>
  );
}
function SliderRow({ label, min, max, step, value, onChange, onReset }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; onReset: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[92px] shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
      <div className="surface w-14 px-2 py-1.5 text-center text-sm" style={{ background: 'var(--editor-panel)' }}>{step < 1 ? value.toFixed(1) : value}</div>
      <IconBtn onClick={onReset}><RotateCcw size={13} /></IconBtn>
    </div>
  );
}
function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative h-6 w-11 shrink-0 rounded-full transition" style={{ background: on ? 'var(--accent)' : 'var(--editor-border)' }}>
      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: on ? 22 : 2 }} />
    </button>
  );
}
function SwitchRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (<div className="flex items-center justify-between py-1"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span><Switch on={on} onClick={onClick} /></div>);
}
function ToolRow({ title, desc, onClick, busy, on = false, icon: Icon = Eraser }: { title: string; desc: string; onClick: () => void; busy?: boolean; on?: boolean; icon?: any }) {
  return (
    <button onClick={onClick} disabled={busy} className="surface flex w-full items-center gap-3 p-3 text-left transition hover:opacity-90 disabled:opacity-60" style={{ background: 'var(--editor-panel)', borderColor: 'var(--editor-border)' }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--editor-surface)' }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} style={{ color: 'var(--text-muted)' }} />}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>{desc}</span></span>
      <span className="pointer-events-none"><Switch on={on} onClick={() => {}} /></span>
    </button>
  );
}
function TplPreview({ t, big }: { t: Tpl; big?: boolean }) {
  const p = t.patch;
  const emColor = p.emColor || '#C8FF00';
  const wt = p.wordTransition && p.wordTransition !== 'none' ? p.wordTransition : null;
  const lt = p.transition && p.transition !== 'none' ? p.transition : null;
  const base: React.CSSProperties = {
    fontFamily: withScript(p.fontFamily || "'Inter',sans-serif"),
    fontWeight: (p.fontWeight as number) || 700,
    fontStyle: p.italic ? 'italic' : 'normal',
    color: p.colorMode === 'gradient' ? 'transparent' : p.color,
    backgroundImage: p.colorMode === 'gradient' ? `linear-gradient(90deg, ${p.color}, ${p.color2})` : undefined,
    WebkitBackgroundClip: p.colorMode === 'gradient' ? 'text' : undefined,
    textShadow: p.glow ? `0 0 10px ${p.color}, 0 0 20px ${p.color}` : p.dropShadow ? '0 2px 10px rgba(0,0,0,.7)' : undefined,
    WebkitTextStroke: p.textStroke ? '1px rgba(0,0,0,.9)' : undefined,
    textTransform: p.uppercase ? 'uppercase' : 'none',
    fontSize: big ? 20 : 15,
  };
  const words: { text: string; em?: boolean }[] = [{ text: 'The' }, { text: 'quick' }, { text: 'brown', em: true }, { text: 'fox' }];
  return (
    <div className="grid place-items-center overflow-hidden rounded-xl px-3" style={{ height: big ? 92 : 62, background: 'var(--editor-bg)' }}>
      <span
        className={!wt && lt ? ANIM[lt] : ''}
        style={{
          display: 'inline-block',
          ...(!wt && lt ? { animationIterationCount: 'infinite', animationDuration: '1.6s' } : {}),
          ...(p.background ? { background: p.bgColor || '#fff', padding: '4px 10px', borderRadius: 8 } : {}),
        }}
      >
        {words.map((w, i) => (
          <span
            key={i}
            className={wt ? ANIM[wt] : ''}
            style={{
              ...base,
              ...(w.em ? { color: emColor, backgroundImage: undefined, WebkitTextStroke: undefined } : {}),
              display: 'inline-block', marginRight: '0.28em',
              ...(wt ? { animationIterationCount: 'infinite', animationDuration: '1.8s', animationDelay: `${i * 0.18}s` } : {}),
            }}
          >{w.text}</span>
        ))}
      </span>
    </div>
  );
}

function TrIcon({ id, on }: { id: string; on: boolean }) {
  const c = on ? 'var(--accent)' : 'var(--text-muted)';
  const box = 'grid h-11 w-11 place-items-center rounded-xl';
  if (id === 'none') return <span className={box}><Ban size={20} style={{ color: c }} /></span>;
  if (id === 'fade') return <span className={box}><span className="h-6 w-6 rounded" style={{ background: c, filter: 'blur(3px)', opacity: .8 }} /></span>;
  if (id === 'pop') return <span className={box}><span className="h-5 w-5 rounded-full" style={{ background: c, opacity: .85 }} /></span>;
  if (id === 'zoom') return <span className={box}><ZoomIcon size={20} style={{ color: c }} /></span>;
  if (id === 'scale') return <span className={box}><MoveHorizontal size={20} style={{ color: c }} /></span>;
  if (id === 'slide') return <span className={box}><ChevronsLeft size={20} style={{ color: c }} /></span>;
  return <span className={box}><ChevronsUp size={20} style={{ color: c }} /></span>;
}