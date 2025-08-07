// Username to email mapping for login
const USERNAME_EMAIL_MAP: Record<string, string> = {
  'saleem': 'saleem@poppatjamals.com',
  'supervisor1': 'supervisor1@test.com',
  'scanner1': 'scanner1@test.com',
};

export const getUserEmail = (username: string): string => {
  return USERNAME_EMAIL_MAP[username] || `${username}@poppatjamals.com`;
};

export const getUsernameFromEmail = (email: string): string => {
  const entry = Object.entries(USERNAME_EMAIL_MAP).find(([_, emailAddr]) => emailAddr === email);
  return entry?.[0] || email.split('@')[0];
};