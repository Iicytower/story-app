// Sidebar entries of the social system (D80); each task turns on its own.
export const SOCIAL_NAV = {
  feed: true,
  library: true,
  forums: false,
  messages: false,
  notifications: true,
  profile: true,
  // Only for an author with a publication, a moderator or an invited account (AppShell).
  moderation: true,
  admin: false,
  stats: false,
};

export type SocialNavItem = keyof typeof SOCIAL_NAV;
