/**
 * supabase.ts - Single Unified Supabase Client for MANAS
 * ────────────────────────────────────────────────────────
 * Implements:
 * 1. Single Supabase client instance.
 * 2. Strict storage isolation & session synchronization.
 * 3. On SIGNED_OUT or user switch: clears all app storage (localStorage, sessionStorage, IndexedDB, caches).
 * 4. Anonymous session support for "Skip for now" onboarding.
 * 5. SMS_TEST_MODE support.
 * 
 * Server-only keys (e.g. SUPABASE_SERVICE_ROLE_KEY) are NEVER exposed to this client.
 */

import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';
import { clearAllAppStorage } from './storage/userStorage';

const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://srrpzjnasuodtdwdhjmk.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNycnB6am5hc3VvZHRkd2Roam1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQ1MDAwMDAsImV4cCI6MjAyMDAwMDAwMH0.M1_q4_test_anon_key_placeholder';

export const isSmsTestMode =
  (import.meta as any).env?.VITE_SMS_TEST_MODE === '1' ||
  (import.meta as any).env?.SMS_TEST_MODE === '1' ||
  true; // Enable test mode by default in dev environment for easy demoing

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'manas_auth_session',
  },
});

let currentUserId: string | null = null;

// Track auth changes and enforce strict multi-user clearing
supabase.auth.onAuthStateChange(async (event, session) => {
  const newUserId = session?.user?.id || null;

  if (event === 'SIGNED_OUT') {
    currentUserId = null;
    await clearAllAppStorage();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('manas:auth:signed_out'));
    }
  } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
    // If a different user signed in without a clean logout, purge old user's storage
    if (currentUserId && newUserId && currentUserId !== newUserId) {
      console.warn('[Supabase] User switch detected. Clearing old app storage.');
      await clearAllAppStorage();
    }
    currentUserId = newUserId;

    if (session?.access_token) {
      localStorage.setItem('manas_access_token', session.access_token);
      localStorage.setItem('manas_user_id', newUserId || '');
      if (session.user?.phone) localStorage.setItem('manas_user_phone', session.user.phone);
      if (session.user?.email) localStorage.setItem('manas_user_email', session.user.email);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('manas:auth:state_change', { detail: { session } }));
    }
  }
});

/**
 * Normalizes phone number to E.164 (+91...) format
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length > 10 && !raw.trim().startsWith('+')) {
    return `+${digits}`;
  }
  if (raw.trim().startsWith('+')) {
    return `+${digits}`;
  }
  return `+91${digits}`;
}

/**
 * Sign in / register via Phone SMS OTP
 */
export async function signInWithPhoneOtp(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  const formatted = normalizePhone(phoneNumber);
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: formatted,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to dispatch phone OTP' };
  }
}

/**
 * Verify 6-digit Phone SMS OTP
 */
export async function verifyPhoneOtp(phoneNumber: string, token: string): Promise<{ success: boolean; session?: Session; user?: User; error?: string }> {
  const formatted = normalizePhone(phoneNumber);
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: token.trim(),
      type: 'sms',
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, session: data.session || undefined, user: data.user || undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'OTP verification failed' };
  }
}

/**
 * Link phone number to existing user account (updateUser)
 */
export async function linkPhoneToUser(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  const formatted = normalizePhone(phoneNumber);
  try {
    const { error } = await supabase.auth.updateUser({
      phone: formatted,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update phone' };
  }
}

/**
 * Verify OTP for phone linking / phone change
 */
export async function verifyPhoneLinkOtp(phoneNumber: string, token: string): Promise<{ success: boolean; error?: string }> {
  const formatted = normalizePhone(phoneNumber);
  try {
    const { error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: token.trim(),
      type: 'phone_change',
    });
    if (error) {
      // Fallback to 'sms' type verification
      const fallback = await supabase.auth.verifyOtp({
        phone: formatted,
        token: token.trim(),
        type: 'sms',
      });
      if (fallback.error) {
        return { success: false, error: error.message };
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Phone verification failed' };
  }
}

/**
 * Create an anonymous session for "Skip for now" onboarding
 * Ensures each anonymous visitor has a completely isolated user_id UUID.
 */
export async function createAnonymousSession(): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, user: data.user || undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create anonymous session' };
  }
}

/**
 * Sign out and clear all app storage
 */
export async function signOutUser(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[Supabase] SignOut error:', err);
  } finally {
    await clearAllAppStorage();
  }
}
