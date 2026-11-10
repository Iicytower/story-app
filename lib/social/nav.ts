// Sidebar entries of the social system (D80); each task turns on its own.
export const SOCIAL_NAV = {
  feed: true,
  library: true,
  forums: false,
  messages: false,
  notifications: false,
  profile: true,
  moderation: false,
  admin: false,
  stats: false,
};

export type SocialNavItem = keyof typeof SOCIAL_NAV;
