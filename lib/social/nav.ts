// Sidebar entries of the social system (D80); each task turns on its own.
export const SOCIAL_NAV = {
  feed: true,
  library: true,
  forums: true,
  messages: true,
  notifications: true,
  profile: true,
  // Only for an author with a publication, a moderator or an invited account (AppShell).
  moderation: true,
  // Only for an admin without an active global ban (AppShell).
  admin: true,
  // Only for an author with a publication (AppShell).
  stats: true,
};

export type SocialNavItem = keyof typeof SOCIAL_NAV;
