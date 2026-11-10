// Sidebar entries of the social system (D80); each task turns on its own.
export const SOCIAL_NAV = {
  feed: false,
  library: false,
  forums: false,
  messages: false,
  notifications: false,
  profile: false,
  moderation: false,
  admin: false,
  stats: false,
};

export type SocialNavItem = keyof typeof SOCIAL_NAV;
