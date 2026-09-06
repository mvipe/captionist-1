import {
  DEFAULT_TESTIMONIALS,
  DEFAULT_CREATORS,
  DEMO_LANGUAGES,
  DEFAULT_TEMPLATE_VIDEOS,
  type DemoLanguage,
  type TemplateVideo,
} from './landingDefaults';
import type { Testimonial, Creator } from '@/types';

/**
 * Safely loads admin-managed landing content from Firestore.
 * Returns baked-in defaults whenever Firebase isn't configured/seeded,
 * so the marketing site always renders.
 */
export async function getLandingContent(): Promise<{
  testimonials: Testimonial[];
  creators: Creator[];
  languages: DemoLanguage[];
  templateVideos: TemplateVideo[];
}> {
  try {
    const { adminDb } = await import('./firebaseAdmin');
    const { COLLECTIONS } = await import('./collections');

    const [tSnap, cSnap, vSnap] = await Promise.all([
      adminDb.collection(COLLECTIONS.testimonials).orderBy('order').get(),
      adminDb.collection(COLLECTIONS.creators).orderBy('order').get(),
      adminDb
        .collection(COLLECTIONS.landingVideos)
        .orderBy('order')
        .get()
        // collection may have no `order` index yet — fall back to unordered
        .catch(() => adminDb.collection(COLLECTIONS.landingVideos).get()),
    ]);

    const testimonials = tSnap.empty
      ? DEFAULT_TESTIMONIALS
      : tSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Testimonial, 'id'>) }));
    const creators = cSnap.empty
      ? DEFAULT_CREATORS
      : cSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Creator, 'id'>) }));

    const videos = vSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return {
      testimonials,
      creators,
      languages: mergeLanguages(videos),
      templateVideos: mergeTemplates(videos),
    };
  } catch {
    return {
      testimonials: DEFAULT_TESTIMONIALS,
      creators: DEFAULT_CREATORS,
      languages: DEMO_LANGUAGES,
      templateVideos: DEFAULT_TEMPLATE_VIDEOS,
    };
  }
}

/** Overlay admin `section: "language"` videos on top of the bundled defaults. */
function mergeLanguages(videos: any[]): DemoLanguage[] {
  const langVids = videos.filter((v) => v.section === 'language' && v.videoUrl && v.language);
  // Nothing seeded yet → bundled defaults so the site is never blank.
  if (!langVids.length) return DEMO_LANGUAGES;

  // Once admin has seeded/added language videos, the site is driven ENTIRELY by
  // Firestore — so removing an entry actually removes it from the landing page.
  const map = new Map<string, DemoLanguage>();
  for (const v of langVids) {
    const cur: DemoLanguage = map.get(v.language) || { name: v.language };
    const variant = String(v.variant || 'native').toLowerCase();
    if (variant === 'single') cur.single = v.videoUrl;
    else if (variant === 'roman') cur.roman = v.videoUrl;
    else cur.native = v.videoUrl;
    map.set(v.language, cur);
  }
  return [...map.values()].filter((l) => l.single || l.native || l.roman);
}

/** Admin `section: "templates"` videos, or the bundled defaults. */
function mergeTemplates(videos: any[]): TemplateVideo[] {
  const t = videos
    .filter((v) => v.section === 'templates' && v.videoUrl)
    .map((v) => ({ title: v.title || '', videoUrl: v.videoUrl, posterUrl: v.posterUrl || undefined }));
  return t.length ? t : DEFAULT_TEMPLATE_VIDEOS;
}
