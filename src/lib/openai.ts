import OpenAI, { toFile } from 'openai';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    client = new OpenAI({
      apiKey,
      // Whisper uploads can be slow; give them room and retry transient drops.
      timeout: 120_000,
      maxRetries: 2,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    });
  }
  return client;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  language: string;
  duration: number;
  text: string;
  segments: TranscriptSegment[];
}

// OpenAI's Whisper endpoint hard-caps uploads at 25 MB.
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Transcribe an audio/video file with Whisper, returning verbose JSON with
 * per-segment timings (needed for the caption editor + SRT export).
 */
// Map the language NAMES the UI sends (from LANGUAGES) to Whisper ISO-639-1 codes.
// Whisper ignores an invalid value like "hindi" and silently auto-detects, which
// drops quiet segments — pinning the real code fixes accuracy.
const LANG_CODES: Record<string, string> = {
  hindi: 'hi', english: 'en', nepali: 'ne', urdu: 'ur', tamil: 'ta',
  malayalam: 'ml', gujarati: 'gu', bengali: 'bn', punjabi: 'pa', telugu: 'te',
  sindhi: 'sd', marathi: 'mr', kannada: 'kn', pushto: 'ps', pashto: 'ps', malay: 'ms',
};

// Short in-script priming samples bias Whisper toward the right language/script
// and improve continuity so it doesn't skip low-volume speech.
const PRIMING: Record<string, string> = {
  hi: 'नमस्ते। यह एक कहानी है। ध्यान से सुनिए।',
  mr: 'नमस्कार. ही एक गोष्ट आहे.',
  ne: 'नमस्ते। यो एउटा कथा हो।',
  ur: 'یہ ایک کہانی ہے۔',
  bn: 'এটি একটি গল্প।',
  ta: 'இது ஒரு கதை.',
  te: 'ఇది ఒక కథ.',
  ml: 'ഇതൊരു കഥയാണ്.',
  gu: 'આ એક વાર્તા છે.',
  kn: 'ಇದು ಒಂದು ಕಥೆ.',
  pa: 'ਇਹ ਇੱਕ ਕਹਾਣੀ ਹੈ।',
};

export async function transcribeFile(
  file: File,
  language?: string
): Promise<TranscriptionResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return transcribeBuffer(buffer, file.name || 'audio.mp4', file.type || 'video/mp4', language);
}

/**
 * Transcribe raw bytes (used server-side after downloading the media from
 * Firebase Storage, so the video never has to pass through the API request
 * body — which on Vercel is capped at 4.5 MB).
 */
export async function transcribeBuffer(
  buffer: Buffer,
  filename: string,
  type: string,
  language?: string
): Promise<TranscriptionResult> {
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Audio is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB, but OpenAI Whisper accepts a maximum of 25 MB. ` +
        `Use a shorter clip or a lower-bitrate file.`
    );
  }

  const openai = getOpenAI();
  const upload = await toFile(buffer, filename || 'audio.mp4', { type: type || 'video/mp4' });

  const langInput = (language || '').toLowerCase().trim();
  const langCode = LANG_CODES[langInput] || (langInput.length === 2 ? langInput : undefined);
  const prompt = langCode ? PRIMING[langCode] : undefined;

  let resp;
  try {
    resp = await openai.audio.transcriptions.create({
      file: upload,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment', 'word'],
      temperature: 0,
      ...(langCode ? { language: langCode } : {}),
      ...(prompt ? { prompt } : {}),
    });
  } catch (e: any) {
    const cause = e?.cause?.code || e?.cause?.message || e?.code;
    const status = e?.status ? ` (HTTP ${e.status})` : '';
    const detail = cause ? ` [${cause}]` : '';
    throw new Error(`OpenAI request failed${status}${detail}: ${e?.message || 'unknown error'}`);
  }

  const r = resp as unknown as {
    language?: string;
    duration?: number;
    text: string;
    segments?: Array<{
      id: number; start: number; end: number; text: string;
      no_speech_prob?: number; avg_logprob?: number; compression_ratio?: number;
    }>;
    words?: Array<{ word: string; start: number; end: number }>;
  };

  const { kept, hard } = cleanSegments(r.segments || []);
  const words = (r.words || [])
    .map((w) => ({ text: (w.word || '').trim(), start: w.start, end: w.end }))
    .filter((w) => w.text);
  // Prefer REAL per-word timestamps (exact sync); fall back to char-splitting.
  const grouped = words.length ? groupWords(words, hard, 3) : splitSegments(kept, 20);
  // Anything Whisper heard but the word pass missed still gets a caption.
  const split = fillGaps(grouped, kept, 3);

  return {
    language: r.language || language || 'unknown',
    duration: r.duration || 0,
    text: split.map((s) => s.text).join(' '),
    segments: split.map((s, i) => ({ id: i, start: s.start, end: s.end, text: s.text })),
  };
}

/* ── Accuracy post-processing ─────────────────────────────────────────────
 * Whisper "hallucinates" text over silence (especially at the very start) and
 * sometimes repeats. verbose_json gives per-segment confidence we can filter on.
 *
 * IMPORTANT: filtering here used to be far too aggressive — a single low
 * avg_logprob (very common for Hindi/Urdu/Tamil and for quiet or accented
 * speech) threw away a whole segment, and every word inside it disappeared
 * from the caption track. That is what produced stretches of video with voice
 * but no captions. We now split rejections into two classes:
 *   - HARD  : provably not speech (boilerplate, looping garbage, silence).
 *             Words inside these spans are dropped.
 *   - SOFT  : merely low-confidence. The segment text is not trusted for the
 *             plain-text transcript, but its WORDS are still captioned, so
 *             audible speech always gets a caption.
 */
const HALLUCINATION_PATTERNS = [
  /thanks? for watching/i, /please subscribe/i, /subtitles? by/i,
  /amara\.org/i, /transcription by/i, /^\s*[♪♫\[\](){}]+\s*$/, /www\./i,
];

export interface SegSpan { start: number; end: number; text: string }

function isLoopingGarbage(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 6) {
    const uniq = new Set(words.map((w) => w.toLowerCase()));
    if (uniq.size <= 2) return true;
  }
  return false;
}

/**
 * Returns the segments we trust (`kept`) plus the spans we are confident hold
 * no speech at all (`hard`), which is the only thing allowed to delete words.
 */
function cleanSegments(
  segs: Array<{ start: number; end: number; text: string; no_speech_prob?: number; avg_logprob?: number; compression_ratio?: number }>
): { kept: SegSpan[]; hard: SegSpan[] } {
  const kept: SegSpan[] = [];
  const hard: SegSpan[] = [];

  for (const s of segs) {
    const text = (s.text || '').trim();
    if (!text) continue;

    const noSpeech = s.no_speech_prob ?? 0;
    const logprob = s.avg_logprob ?? 0;
    const compression = s.compression_ratio ?? 1;

    // ── HARD rejects: this really is not speech ──────────────────────────
    // Known boilerplate Whisper injects over silence.
    if (HALLUCINATION_PATTERNS.some((re) => re.test(text))) { hard.push({ ...s, text }); continue; }
    // Runaway repetition ("the the the…") — compression_ratio is the classic tell.
    if (compression > 2.8) { hard.push({ ...s, text }); continue; }
    if (isLoopingGarbage(text)) { hard.push({ ...s, text }); continue; }
    // Whisper is *very* sure this span is silence AND the text is nonsense.
    if (noSpeech > 0.85 && logprob < -0.8) { hard.push({ ...s, text }); continue; }

    // ── Everything else is kept ──────────────────────────────────────────
    // Low avg_logprob alone is NOT a reason to drop speech: Indic languages,
    // background music, whispering and fast speech all sit well below -1.0.
    kept.push({ start: s.start, end: s.end, text });
  }

  // Safety net: if the filters somehow removed everything, trust the raw
  // segments rather than returning an empty transcript.
  if (kept.length === 0 && segs.length) {
    return {
      kept: segs.filter((s) => (s.text || '').trim()).map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })),
      hard: [],
    };
  }
  return { kept, hard };
}

/* Kalakar-style captions: group REAL word timestamps into 1-3 word chunks,
   breaking at punctuation and natural speech pauses. Only words that fall
   inside a HARD-rejected (proven non-speech) span are discarded — everything
   the model heard otherwise gets a caption. */
function groupWords(
  words: Array<{ text: string; start: number; end: number }>,
  hard: SegSpan[],
  maxWords = 3
): Array<{ start: number; end: number; text: string }> {
  const inHard = (t: number) => hard.some((s) => t >= s.start - 0.05 && t <= s.end + 0.05);
  const ws = hard.length ? words.filter((w) => !inHard((w.start + w.end) / 2)) : words;
  const out: Array<{ start: number; end: number; text: string }> = [];
  let cur: typeof ws = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ start: cur[0].start, end: cur[cur.length - 1].end, text: cur.map((x) => x.text).join(' ') });
    cur = [];
  };
  for (let i = 0; i < ws.length; i++) {
    cur.push(ws[i]);
    const next = ws[i + 1];
    const gap = next ? next.start - ws[i].end : 0;
    const punct = /[.!?,;:।]$/.test(ws[i].text);
    if (cur.length >= maxWords || punct || gap > 0.6 || !next) flush();
  }
  return out;
}

/**
 * Fill silent-looking holes: if the trusted segment list covers speech that the
 * word-level pass dropped (or vice-versa), make sure nothing audible is left
 * without a caption. Any kept segment with no caption overlapping it at all is
 * re-added, split into short chunks.
 */
function fillGaps(
  captions: Array<{ start: number; end: number; text: string }>,
  kept: SegSpan[],
  maxWords = 3
): Array<{ start: number; end: number; text: string }> {
  if (!kept.length) return captions;
  const covered = (a: number, b: number) =>
    captions.some((c) => Math.min(c.end, b) - Math.max(c.start, a) > Math.min(0.25, (b - a) * 0.5));
  const extra: Array<{ start: number; end: number; text: string }> = [];
  for (const s of kept) {
    if (s.end - s.start < 0.12) continue;
    if (covered(s.start, s.end)) continue;
    // Not captioned anywhere — split this segment's text across its duration.
    const words = s.text.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const dur = s.end - s.start;
    const totalChars = words.reduce((a, w) => a + w.length, 0) || 1;
    let t = s.start;
    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords);
      const chars = chunk.reduce((a, w) => a + w.length, 0);
      const sl = (chars / totalChars) * dur;
      extra.push({ start: t, end: Math.min(s.end, t + sl), text: chunk.join(' ') });
      t += sl;
    }
  }
  if (!extra.length) return captions;
  return [...captions, ...extra].sort((a, b) => a.start - b.start);
}

function splitSegments(
  segs: Array<{ start: number; end: number; text: string }>,
  maxChars = 32
): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  for (const s of segs) {
    const dur = Math.max(0.2, s.end - s.start);
    const text = s.text.trim();
    if (text.length <= maxChars) { out.push(s); continue; }

    // Greedy word-wrap into <= maxChars chunks.
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (test.length > maxChars && line) { chunks.push(line); line = w; }
      else line = test;
    }
    if (line) chunks.push(line);

    const totalChars = chunks.reduce((a, c) => a + c.length, 0) || 1;
    let t = s.start;
    for (const c of chunks) {
      const slice = (c.length / totalChars) * dur;
      out.push({ start: t, end: Math.min(s.end, t + slice), text: c });
      t += slice;
    }
  }
  return out;
}

/** Convert transcription segments to an SRT string. */
export function segmentsToSrt(segments: TranscriptSegment[]): string {
  const fmt = (t: number) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t - Math.floor(t)) * 1000);
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
  };

  return segments
    .map((seg, i) => `${i + 1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${seg.text}\n`)
    .join('\n');
}