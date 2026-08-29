'use client';

import { Download, Check } from 'lucide-react';

const PLUGINS = [
  {
    name: 'Adobe Premiere Pro',
    desc: 'Send captions straight to your Premiere timeline as a caption track or burned-in graphics.',
    version: 'v2.4.1',
    color: '#9999ff',
    tag: 'Adobe',
  },
  {
    name: 'Final Cut Pro',
    desc: 'Import .fcpxml caption bundles with styling preserved for FCP on macOS.',
    version: 'v1.9.0',
    color: '#f59e0b',
    tag: 'Apple',
  },
  {
    name: 'DaVinci Resolve',
    desc: 'Drop styled subtitles into Resolve via the Fusion-ready export package.',
    version: 'v1.6.2',
    color: '#22d3ee',
    tag: 'Blackmagic',
  },
  {
    name: 'CapCut',
    desc: 'One-tap export of SRT + sticker captions optimized for CapCut mobile & desktop.',
    version: 'v1.2.0',
    color: '#34d399',
    tag: 'Mobile',
  },
];

export default function PluginsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Manage Plugins</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Install YesEditor extensions for your favorite editor and keep captions perfectly in sync.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {PLUGINS.map((p) => (
          <div key={p.name} className="surface flex flex-col p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl text-lg font-bold text-black" style={{ background: p.color }}>
                  {p.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold">{p.name}</h3>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.tag} · {p.version}</span>
                </div>
              </div>
              <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-500">
                Coming soon
              </span>
            </div>
            <p className="mt-4 flex-1 text-sm" style={{ color: 'var(--text-muted)' }}>{p.desc}</p>
            <button className="mt-5 w-full cursor-not-allowed rounded-xl border border-dashed border-slate-600/70 bg-slate-900/40 px-4 py-2.5 text-sm font-medium text-slate-400" disabled>
              <Download size={16} /> Coming soon
            </button>
          </div>
        ))}
      </div>

      <div className="surface flex items-center gap-3 p-5" style={{ background: 'var(--bg-soft)' }}>
        <Check size={18} style={{ color: 'var(--accent)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Every plan can export universal <strong>.srt</strong> and <strong>.txt</strong> files that work in any editor — no plugin required.
        </p>
      </div>
    </div>
  );
}
