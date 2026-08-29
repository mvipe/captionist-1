'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ref as storageRef, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebaseClient';
import { v4 as uuid } from 'uuid';
import { useRouter } from 'next/navigation';
import { extractAudioChunks } from '@/lib/audioExtract';

const MAX_FILE = 1e9; // 1 GB — audio is extracted client-side, so video size no longer hits Whisper's 25 MB cap

export default function Uploader({ onDone }: { onDone?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const language = 'auto'; // Whisper auto-detects; manual selection removed
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const pick = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_FILE) return toast.error('Max file size is 1GB');
    if (!/(mp4|mov|quicktime)/i.test(f.type)) return toast.error('Only MP4 / MOV supported');
    setFile(f);
  };

  const authHeaders = async () => ({
    Authorization: `Bearer ${await auth.currentUser!.getIdToken()}`,
    'Content-Type': 'application/json',
  });

  const parseJson = async (res: Response) => {
    const raw = await res.text();
    try { return raw ? JSON.parse(raw) : {}; }
    catch { return { error: raw?.slice(0, 200) || `Request failed (${res.status})` }; }
  };

  const start = async () => {
    if (!file) return;
    setBusy(true);
    let uploadTask: ReturnType<typeof uploadBytesResumable> | null = null;
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not signed in');
      const base = `captionist/${uid}/${uuid()}`;

      /* 1) Start the video upload IMMEDIATELY (background) — runs in parallel
            with audio extraction + transcription. */
      const vref = storageRef(storage, `${base}-${file.name}`);
      uploadTask = uploadBytesResumable(vref, file);
      const task = uploadTask;
      const videoUrlPromise = new Promise<string>((resolve, reject) => {
        task.on('state_changed',
          (s) => setUploadPct(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
          reject,
          () => { setUploadPct(100); getDownloadURL(vref).then(resolve, reject); });
      });
      videoUrlPromise.catch(() => {}); // handled where awaited

      /* 2) Extract audio in-browser (16 kHz mono MP3, ~8-min chunks).
            A 500 MB video becomes a few MB of audio — under Whisper's 25 MB cap. */
      let chunks;
      try {
        chunks = await extractAudioChunks(file, setPhase);
      } catch (err) {
        console.warn('[uploader] audio extraction failed:', err);
        if (file.size > 24 * 1024 * 1024) {
          task.cancel();
          throw new Error('Could not decode this video\'s audio in the browser — the file may be too large for this device\'s memory, or may use an unsupported codec. Try desktop Chrome, or a standard H.264/AAC MP4.');
        }
        chunks = null; // small file → legacy direct path below
      }

      /* 3) Transcribe */
      if (!chunks) {
        // Legacy small-file path: server downloads the video itself
        setPhase('Uploading…');
        const videoUrl = await videoUrlPromise;
        setPhase('Transcribing…');
        const res = await fetch('/api/transcribe', {
          method: 'POST', headers: await authHeaders(),
          body: JSON.stringify({ videoUrl, language, title: file.name }),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        toast.success('Captions ready!');
        setFile(null); onDone?.();
        router.push(`/dashboard/editor/${data.project.id}`);
        return;
      }

      const allSegments: { start: number; end: number; text: string }[] = [];
      let detectedLang = language;
      let totalAudioDur = 0;

      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        setPhase(chunks.length > 1 ? `Transcribing part ${i + 1}/${chunks.length}…` : 'Transcribing…');

        const aref = storageRef(storage, `${base}-audio-${i}.mp3`);
        await uploadBytes(aref, c.blob, { contentType: 'audio/mpeg' });
        const audioUrl = await getDownloadURL(aref);

        const res = await fetch('/api/transcribe-chunk', {
          method: 'POST', headers: await authHeaders(),
          body: JSON.stringify({ audioUrl, language }),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data.error || `Chunk ${i + 1} failed (${res.status})`);

        if (data.language && detectedLang === 'auto') detectedLang = data.language;
        totalAudioDur = Math.max(totalAudioDur, c.windowEndSec);

        /* Chunks overlap by a few seconds so a word spoken across a cut is
           captured whole by at least one of them. The only thing we drop here
           is this chunk's truncated tail — a word Whisper had to cut off at the
           end of the audio it was given. Everything else is kept and the
           duplicates from the overlap are removed in the merge pass below,
           which compares how much two captions actually overlap in time rather
           than trusting a fixed boundary (a fixed boundary dropped BOTH copies
           of a word that ended right on the seam). */
        const offset = c.offsetSec;
        for (const seg of (data.segments || []) as { start: number; end: number; text: string }[]) {
          if (!seg.text || !seg.text.trim()) continue;
          const start = seg.start + offset;
          const end = seg.end + offset;
          if (!c.isLast && end >= c.audioEndSec - 0.05) continue; // truncated tail
          allSegments.push({ start, end, text: seg.text });
        }
      }

      /* Merge pass: drop a caption only when an already-accepted caption covers
         more than half of it. That removes the duplicated overlap region while
         keeping a word that merely straddles the seam. */
      allSegments.sort((a, b) => a.start - b.start);
      const merged: typeof allSegments = [];
      for (const seg of allSegments) {
        const dur = Math.max(0.01, seg.end - seg.start);
        let covered = false;
        for (let k = merged.length - 1; k >= 0 && k > merged.length - 12; k--) {
          const m = merged[k];
          if (m.end <= seg.start) break;                       // sorted: no more overlap possible
          const ov = Math.min(m.end, seg.end) - Math.max(m.start, seg.start);
          if (ov / dur > 0.5) { covered = true; break; }
        }
        if (!covered) merged.push(seg);
      }
      allSegments.length = 0;
      allSegments.push(...merged);

      /* 4) Wait for the video upload to complete, then create the project */
      setPhase('Finishing upload…');
      const videoUrl = await videoUrlPromise;
      setPhase('Finishing…');
      const res = await fetch('/api/projects', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({
          title: file.name, videoUrl, language: detectedLang,
          transcript: { segments: allSegments }, durationSeconds: totalAudioDur,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data.error || `Create failed (${res.status})`);

      toast.success('Captions ready!');
      setFile(null); onDone?.();
      router.push(`/dashboard/editor/${data.project.id}`);
    } catch (e: any) {
      try { uploadTask?.cancel(); } catch {}
      toast.error(e?.message || 'Failed to process');
    } finally {
      setBusy(false); setPhase(''); setUploadPct(null);
    }
  };

  return (
    <div className="surface p-6" style={{ background: 'var(--bg-soft)' }}>
      <input ref={inputRef} type="file" accept="video/mp4,video/quicktime" className="hidden" onChange={(e) => pick(e.target.files?.[0] || null)} />

      {!file ? (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0] || null); }}
          className="grid w-full place-items-center rounded-2xl border border-dashed py-16 transition hover:opacity-80"
          style={{ borderColor: 'var(--border)' }}
        >
          <ImagePlus size={40} style={{ color: 'var(--text-muted)' }} />
          <p className="mt-4 font-medium">Drop your video here or click to upload</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Up to 1 GB — audio is extracted automatically</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Supports: MP4, MOV</p>
        </button>
      ) : (
        <div>
          <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <span className="truncate text-sm">{file.name}</span>
            <button onClick={() => setFile(null)} disabled={busy}><X size={18} /></button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="surface px-4 py-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>Language: Auto-detect</span>
            <button onClick={start} disabled={busy} className="btn-primary">
              {busy ? (<><Loader2 className="animate-spin" size={18} /> {phase}{uploadPct !== null && uploadPct < 100 ? ` · video ${uploadPct}%` : ''}</>) : 'Generate Captions'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}