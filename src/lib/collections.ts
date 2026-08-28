/**
 * Centralized collection names.
 * Everything is suffixed `captionist` because this Firebase project is shared
 * with another live app — keeps Captionist data fully namespaced.
 */
export const COLLECTIONS = {
  users: 'usercaptionist',
  projects: 'projectscaptionist',
  coupons: 'couponscaptionist',
  couponUsage: 'couponusagecaptionist',
  transactions: 'transactionscaptionist',
  tutorials: 'tutorialscaptionist',
  fonts: 'fontscaptionist',
  testimonials: 'testimonialscaptionist',
  creators: 'creatorscaptionist',
  templates: 'templatescaptionist',
  transitions: 'transitionscaptionist',
  userAnimations: 'useranimationscaptionist',
  landingVideos: 'landingvideoscaptionist',
  siteContent: 'sitecontentcaptionist',
  otp: 'otpcaptionist',
} as const;

export type CollectionKey = keyof typeof COLLECTIONS;
