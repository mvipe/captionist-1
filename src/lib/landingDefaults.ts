import type { Testimonial, Creator } from '@/types';

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    name: 'Aarav Mehta',
    handle: '@aarav.edits',
    text: "I've been using YesEditor recently & it's honestly super helpful. It supports multiple languages — generating Hindi captions used to be a real struggle, but with YesEditor the process is super smooth.",
    order: 1,
  },
  {
    id: 't2',
    name: 'Zaryab Khan',
    handle: '@zaryab.cuts',
    text: "If you're an editor or creator from South Asia, this software is your only solution. It's got all the trendy captioning styles like Beast, Iman Gadzi, Devin Jatho and Alex Hormozi, just one click away.",
    order: 2,
  },
  {
    id: 't3',
    name: 'Muhammad Ozair',
    handle: '@ozair.films',
    text: 'YesEditor as captioning software is one of the best out there. The premade templates are really helpful & loading times are really quick. Overall it makes captioning so much easier.',
    order: 3,
  },
  {
    id: 't4',
    name: 'Ananya Rao',
    handle: '@ananya.creates',
    text: 'The Roman + Native toggle is a lifesaver for my Telugu content. I finish a full reel of captions in minutes now instead of typing everything out by hand.',
    order: 4,
  },
  {
    id: 't5',
    name: 'Bilal Ahmed',
    handle: '@bilal.motion',
    text: 'Audio enhancement alone is worth it — my street-shot vlogs finally transcribe cleanly. Export to Premiere as SRT or alpha just works every single time.',
    order: 5,
  },
  {
    id: 't6',
    name: 'Simran Kaur',
    handle: '@simran.reels',
    text: 'Switched my whole team over to YesEditor. The templates match our brand, captions stay in sync, and clients keep asking how we turn edits around this fast.',
    order: 6,
  },
];

export const DEFAULT_CREATORS: Creator[] = [
  { id: 'c1', name: 'Yaas Media', subtitle: 'by Varun Maya', avatarUrl: '', order: 1 },
  { id: 'c2', name: 'Prakhar Gupta', subtitle: 'Creator & Educator', avatarUrl: '', order: 2 },
  { id: 'c3', name: 'Scoop Whoop', subtitle: 'Digital Studio', avatarUrl: '', order: 3 },
  { id: 'c4', name: 'Layers.shop', subtitle: 'by Tech Burner', avatarUrl: '', order: 4 },
  { id: 'c5', name: 'KK Creates', subtitle: 'Editing Studio', avatarUrl: '', order: 5 },
  { id: 'c6', name: 'Nitin Joshi', subtitle: 'Filmmaker', avatarUrl: '', order: 6 },
];

export const LANGUAGES = [
  'Hindi', 'English', 'Nepali', 'Urdu', 'Tamil', 'Malayalam', 'Gujarati',
  'Bengali', 'Punjabi', 'Telugu', 'Sindhi', 'Marathi', 'Kannada', 'Pashto', 'Malay',
];

/**
 * Landing "Select your Language" demo videos.
 *
 * `single` = one clip (no Native/Roman toggle). Otherwise `native` + `roman`.
 * These paths are the bundled fallbacks that ship in /public/videos. An admin can
 * override any of them, or add a whole new language, from the panel
 * (Content → Landing Videos, section = "language"); getLandingContent() overlays
 * the admin entries on top of these. Only languages that actually have a video
 * appear on the landing page.
 */
export interface DemoLanguage {
  name: string;
  native?: string;
  roman?: string;
  single?: string;
}

export const DEMO_LANGUAGES: DemoLanguage[] = [
  { name: 'Hindi', native: '/videos/hindi-landing-native.mp4', roman: '/videos/hindi-landing-roman.mp4' },
  { name: 'English', single: '/videos/english-landing.mp4' },
  { name: 'Urdu', native: '/videos/urdu-landing-native.mp4', roman: '/videos/urdu-landing-roman.mp4' },
  { name: 'Punjabi', native: '/videos/punjabi-landing-native.mp4', roman: '/videos/punjabi-landing-roman.mp4' },
  { name: 'Gujarati', native: '/videos/gujarati-landing-native.mp4', roman: '/videos/gujarati-landing-roman.mp4' },
  { name: 'Marathi', native: '/videos/marathi-landing-native.mp4', roman: '/videos/marathi-landing-roman.mp4' },
  { name: 'Bengali', single: '/videos/bengali-landing.mp4' },
  { name: 'Nepali', native: '/videos/nepali-landing-native.mp4', roman: '/videos/nepali-landing-roman.mp4' },
  { name: 'Tamil', native: '/videos/tamil-landing-native.mp4', roman: '/videos/tamil-landing-roman.mp4' },
];

/** "All your Favourite Templates" showcase cards. */
export interface TemplateVideo {
  title: string;
  videoUrl: string;
  posterUrl?: string;
}

// The Templates section shows the 9 language demos by default — one card per
// language. Admin can change/remove/replace any of them in the panel
// (Content → Landing Videos, section = "templates").
export const DEFAULT_TEMPLATE_VIDEOS: TemplateVideo[] = DEMO_LANGUAGES.map((l) => ({
  title: l.name,
  videoUrl: (l.native ?? l.single)!,
}));

export const FAQ_ITEMS = [
  {
    q: 'How accurate is the transcription?',
    a: 'YesEditor reaches up to 97% accuracy across major desi languages using state-of-the-art speech models, with the ability to fine-tune any output manually.',
  },
  {
    q: 'Is it possible to edit the transcription?',
    a: 'Yes. Every word and segment is fully editable in the caption editor, including timing, text, styling and templates.',
  },
  {
    q: 'What are the rendering options?',
    a: 'You can export burned-in captions, an SRT file, or an alpha-channel file for cross-NLE workflows (Premiere Pro, Final Cut, DaVinci Resolve).',
  },
  {
    q: 'How is the billing managed for team accounts?',
    a: 'Studio plans support team billing with a single invoice and seat management from the subscription panel.',
  },
  {
    q: 'What is available in the Free plan?',
    a: 'The Free plan includes all languages, 5 minutes of transcription, 5 GB storage and basic templates so you can try YesEditor end-to-end.',
  },
  {
    q: 'Can we edit the pre-built Templates?',
    a: 'Absolutely. Every pre-built template is fully customizable — fonts, colors, animation, position and size.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'You can cancel anytime from Manage Subscription. Your plan stays active until the end of the billing cycle.',
  },
  {
    q: 'How is the payment processed?',
    a: 'Payments are processed securely through Razorpay. We never store your card details.',
  },
];
