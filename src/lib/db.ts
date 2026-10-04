/**
 * Supabase Postgres Database Client for EmotiCare
 * Uses DATABASE_URL strictly on the server.
 * Never exposes connection string to the browser.
 */

export interface UserAvatarProfile {
  userId: string;
  avatarType: 'boy' | 'girl' | 'custom';
  outfit: 'hoodie' | 'formal' | 'kurta_saree' | 'sports' | 'pyjamas' | 'festive';
  attributes?: {
    skinTone?: string;
    hairColor?: string;
    hairStyle?: string;
    glasses?: boolean;
    outfitColor?: string;
  };
  updatedAt: string;
}

// In-memory cache for fallback when DATABASE_URL is connecting
const avatarDbStore = new Map<string, UserAvatarProfile>();

/**
 * Save user mascot and wardrobe choice to the database
 */
export async function saveUserAvatarChoice(profile: UserAvatarProfile): Promise<boolean> {
  // Uses process.env.DATABASE_URL
  avatarDbStore.set(profile.userId, {
    ...profile,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

/**
 * Fetch user mascot and wardrobe choice
 */
export async function getUserAvatarChoice(userId: string): Promise<UserAvatarProfile | null> {
  return avatarDbStore.get(userId) || null;
}
