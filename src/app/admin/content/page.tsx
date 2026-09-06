'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import { Plus, Trash2, Loader2, Pencil, X, Upload, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebaseClient';
import { v4 as uuid } from 'uuid';
import { DEMO_LANGUAGES } from '@/lib/landingDefaults';

type FieldType = 'text' | 'textarea' | 'number' | 'select';
interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  /** For *Url fields: what a paired upload button should accept. */
  accept?: string;
}

// Any field whose key ends in "Url" gets an inline "Upload file" button that
// pushes to Firebase Storage and fills the field with the download URL.
const isUrlField = (key: string) => /url$/i.test(key);
const acceptFor = (f: Field) => f.accept || (/video/i.test(f.key) ? 'video/*' : 'image/*');

const SCHEMAS: Record<string, { label: string; fields: Field[] }> = {
  tutorials: {
    label: 'Tutorials',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'videoUrl', label: 'Video', type: 'text', placeholder: 'https://… or upload', accept: 'video/*' },
      { key: 'thumbnailUrl', label: 'Thumbnail', type: 'text', accept: 'image/*' },
      { key: 'duration', label: 'Duration', type: 'text', placeholder: '3:17' },
      { key: 'order', label: 'Order', type: 'number' },
    ],
  },
  testimonials: {
    label: 'Testimonials',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'handle', label: 'Handle', type: 'text', placeholder: '@creator' },
      { key: 'avatarUrl', label: 'Avatar', type: 'text', accept: 'image/*' },
      { key: 'text', label: 'Testimonial', type: 'textarea' },
      { key: 'order', label: 'Order', type: 'number' },
    ],
  },
  creators: {
    label: 'Creators',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'avatarUrl', label: 'Avatar', type: 'text', accept: 'image/*' },
      { key: 'order', label: 'Order', type: 'number' },
    ],
  },
  landingVideos: {
    label: 'Landing Videos',
    fields: [
      {
        key: 'section',
        label: 'Section',
        type: 'select',
        options: ['language', 'templates', 'hero', 'testimonial'],
      },
      {
        key: 'language',
        label: 'Language (for "language" section)',
        type: 'text',
        placeholder: 'e.g., Hindi',
      },
      {
        key: 'variant',
        label: 'Variant (for "language" section)',
        type: 'select',
        options: ['native', 'roman', 'single'],
      },
      { key: 'title', label: 'Title (for "templates")', type: 'text', placeholder: 'e.g., Bold Pop' },
      { key: 'videoUrl', label: 'Video', type: 'text', placeholder: 'https://… or upload', accept: 'video/*' },
      { key: 'posterUrl', label: 'Poster image', type: 'text', accept: 'image/*' },
      { key: 'order', label: 'Order', type: 'number' },
    ],
  },
  templates: {
    label: 'Caption Templates',
    fields: [
      { key: 'name', label: 'Template Name', type: 'text', placeholder: 'e.g., Kalakar Glow' },
      { key: 'tag', label: 'Tag', type: 'text', placeholder: 'e.g., Bold · Shadow' },
      { key: 'fontFamily', label: 'Font Family', type: 'text', placeholder: "'Luckiest Guy', cursive" },
      { key: 'fontSize', label: 'Font Size (px)', type: 'number' },
      { key: 'color', label: 'Color', type: 'text', placeholder: '#b6ff3a' },
      { key: 'bold', label: 'Bold (true/false)', type: 'text' },
      { key: 'uppercase', label: 'Uppercase (true/false)', type: 'text' },
      { key: 'order', label: 'Order', type: 'number' },
    ],
  },
  transitions: {
    label: 'Transitions',
    fields: [
      { key: 'name', label: 'Transition Name', type: 'text', placeholder: 'e.g., Fade' },
      { key: 'duration', label: 'Duration (ms)', type: 'number', placeholder: '300' },
      { key: 'description', label: 'Description', type: 'text', placeholder: 'e.g., Smooth fade effect' },
      { key: 'order', label: 'Order', type: 'number' },
    ],
  },
};

const TYPES = Object.keys(SCHEMAS);

export default function AdminContent() {
  const [type, setType] = useState<string>('tutorials');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Which URL field is uploading, and its progress %.
  const [upload, setUpload] = useState<{ key: string; pct: number } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const schema = SCHEMAS[type];

  const load = useCallback(async (t: string) => {
    setLoading(true);
    const res = await authFetch(`/api/admin/content?type=${t}`);
    if (res.ok) setItems((await res.json()).items);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(type);
    setForm({});
    setEditingId(null);
  }, [type, load]);

  const setField = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  // One-click: create the 9 default language demos (native/roman/single) and one
  // template card per language as real Firestore rows, so admin can edit/remove
  // every attribute. Videos point at the bundled /public/videos clips.
  const seedLandingDefaults = async () => {
    if (!confirm('Add the 9 default language demos and 9 template cards as editable rows? You can change or delete any of them afterward.')) return;
    setSeeding(true);
    try {
      const docs: Record<string, any>[] = [];
      let o = 1;
      for (const l of DEMO_LANGUAGES) {
        if (l.single) docs.push({ section: 'language', language: l.name, variant: 'single', videoUrl: l.single, order: o++ });
        if (l.native) docs.push({ section: 'language', language: l.name, variant: 'native', videoUrl: l.native, order: o++ });
        if (l.roman) docs.push({ section: 'language', language: l.name, variant: 'roman', videoUrl: l.roman, order: o++ });
      }
      let t = 1;
      for (const l of DEMO_LANGUAGES) {
        docs.push({ section: 'templates', title: l.name, videoUrl: (l.native ?? l.single) || '', order: t++ });
      }
      for (const d of docs) {
        await authFetch('/api/admin/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'landingVideos', data: d }),
        });
      }
      toast.success(`Added ${docs.length} rows`);
      load('landingVideos');
    } catch {
      toast.error('Seeding failed');
    } finally {
      setSeeding(false);
    }
  };

  const uploadFile = async (fieldKey: string, file: File) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return toast.error('Not signed in');
    setUpload({ key: fieldKey, pct: 0 });
    try {
      // Upload under the admin's own uid so the existing per-user Storage rule
      // (the same one the dashboard uploader relies on) allows the write.
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `captionist/${uid}/landing/${uuid()}-${safe}`;
      const task = uploadBytesResumable(storageRef(storage, path), file, { contentType: file.type });
      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (s) => setUpload({ key: fieldKey, pct: Math.round((s.bytesTransferred / s.totalBytes) * 100) }),
          reject,
          () => resolve()
        );
      });
      const url = await getDownloadURL(task.snapshot.ref);
      setField(fieldKey, url);
      toast.success('Uploaded');
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUpload(null);
      if (fileInputs.current[fieldKey]) fileInputs.current[fieldKey]!.value = '';
    }
  };

  const submit = async () => {
    setSaving(true);
    const data: Record<string, any> = { ...form };
    schema.fields.forEach((f) => {
      if (f.type === 'number') data[f.key] = Number(data[f.key]) || 0;
    });

    const res = editingId
      ? await authFetch('/api/admin/content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id: editingId, data }),
        })
      : await authFetch('/api/admin/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, data }),
        });

    setSaving(false);
    if (res.ok) {
      toast.success(editingId ? 'Updated' : 'Added');
      setForm({});
      setEditingId(null);
      load(type);
    } else {
      toast.error('Save failed');
    }
  };

  const edit = (item: any) => {
    setEditingId(item.id);
    const f: Record<string, any> = {};
    schema.fields.forEach((fld) => (f[fld.key] = item[fld.key] ?? ''));
    setForm(f);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    await authFetch(`/api/admin/content?type=${type}&id=${id}`, { method: 'DELETE' });
    toast.success('Deleted');
    load(type);
  };

  const primaryLabel = (item: any) =>
    item.title || item.name || (item.language ? `${item.language} · ${item.variant || 'native'}` : '') || item.handle || item.id;
  const secondaryLabel = (item: any) =>
    item.description || item.text || item.subtitle || item.section || item.duration || '';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Content</h1>

      {/* Type tabs */}
      <div className="surface flex flex-wrap gap-1 p-1" style={{ background: 'var(--bg-soft)' }}>
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold transition"
            style={type === t ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--text-muted)' }}
          >
            {SCHEMAS[t].label}
          </button>
        ))}
      </div>

      {/* Landing Videos helper: seed the defaults as editable rows */}
      {type === 'landingVideos' && (
        <div className="surface flex flex-wrap items-center justify-between gap-3 p-4" style={{ background: 'var(--bg-soft)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Rows here drive the landing page. Section <b style={{ color: 'var(--text)' }}>language</b> = the picker demos,
            section <b style={{ color: 'var(--text)' }}>templates</b> = the Favourite Templates cards. Add the bundled
            defaults to edit or remove any of them.
          </p>
          <button
            onClick={seedLandingDefaults}
            disabled={seeding}
            className="btn-ghost !py-2 text-sm disabled:opacity-50"
          >
            {seeding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Add default videos
          </button>
        </div>
      )}

      {/* Form */}
      <div className="surface p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            {editingId ? <Pencil size={18} style={{ color: 'var(--accent)' }} /> : <Plus size={18} style={{ color: 'var(--accent)' }} />}
            {editingId ? `Edit ${schema.label.replace(/s$/, '')}` : `Add ${schema.label.replace(/s$/, '')}`}
          </h2>
          {editingId && (
            <button onClick={() => { setEditingId(null); setForm({}); }} className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              <X size={14} /> Cancel
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {schema.fields.map((f) => (
            <label key={f.key} className={f.type === 'textarea' ? 'block sm:col-span-2' : 'block'}>
              <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{f.label}</span>
              {f.type === 'textarea' ? (
                <textarea className="input" rows={3} value={form[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} />
              ) : f.type === 'select' ? (
                <select className="input" value={form[f.key] ?? f.options?.[0]} onChange={(e) => setField(f.key, e.target.value)}>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type === 'number' ? 'number' : 'text'} className="input" value={form[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} />
              )}

              {/* Inline uploader for URL fields */}
              {isUrlField(f.key) && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    ref={(el) => { fileInputs.current[f.key] = el; }}
                    type="file"
                    accept={acceptFor(f)}
                    className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(f.key, file); }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputs.current[f.key]?.click()}
                    disabled={!!upload}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  >
                    {upload?.key === f.key ? (
                      <><Loader2 size={13} className="animate-spin" /> Uploading {upload.pct}%</>
                    ) : (
                      <><Upload size={13} /> Upload file</>
                    )}
                  </button>
                  {form[f.key] && (
                    <a href={form[f.key]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--accent)' }}>
                      <ExternalLink size={12} /> preview
                    </a>
                  )}
                </div>
              )}
            </label>
          ))}
        </div>
        <button onClick={submit} disabled={saving || !!upload} className="btn-primary mt-5 !py-2.5 text-sm disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : editingId ? <Pencil size={15} /> : <Plus size={15} />}
          {editingId ? 'Save changes' : 'Add item'}
        </button>
      </div>

      {/* List */}
      <div className="surface overflow-hidden">
        <div className="border-b p-5" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-bold">{schema.label} ({items.length})</h2>
        </div>
        {loading ? (
          <div className="grid place-items-center p-10">
            <Loader2 className="animate-spin" style={{ color: 'var(--accent)' }} size={22} />
          </div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Nothing here yet. Add your first {schema.label.replace(/s$/, '').toLowerCase()} above.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4" style={{ borderColor: 'var(--border)' }}>
                {(item.avatarUrl || item.thumbnailUrl || item.imageUrl || item.posterUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.avatarUrl || item.thumbnailUrl || item.imageUrl || item.posterUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{primaryLabel(item)}</p>
                  <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>{secondaryLabel(item)}</p>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>#{item.order ?? '—'}</span>
                <button onClick={() => edit(item)} className="grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--accent)' }}>
                  <Pencil size={15} />
                </button>
                <button onClick={() => remove(item.id)} className="grid h-9 w-9 place-items-center rounded-full" style={{ color: '#ef4444' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
