/**
 * conversationService.ts - Multi-User Persistent Conversation & Message Service
 * ──────────────────────────────────────────────────────────────────────────────
 * Supports:
 * - Supabase Postgres persistence with Row Level Security (RLS: user_id = auth.uid())
 * - Fallback to user-scoped local storage for instant offline / cache reads
 * - Grouped listing (Today, Yesterday, Earlier)
 * - Real-time saving for user & streaming assistant messages
 * - Background AI title generation via gemini-3.8-flash
 */

import { supabase } from '../supabase';
import { getUserItem, setUserItem, getCurrentUserId } from '../storage/userStorage';
import type { ChatMessage, MascotExpression } from '../../types';

export interface ConversationItem {
  id: string;
  user_id?: string;
  title: string;
  archived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoredMessageRecord {
  id: string;
  conversation_id: string;
  user_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  emotion?: string;
  tool?: string;
  created_at: string;
}

/**
 * Fetch all active conversations for the authenticated user, ordered newest first.
 */
export async function listConversations(userId?: string | null): Promise<ConversationItem[]> {
  const uid = userId || getCurrentUserId();
  const cacheKey = 'conversations_list';

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, user_id, title, archived, created_at, updated_at')
      .eq('archived', false)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setUserItem(cacheKey, data, uid);
      return data as ConversationItem[];
    }
  } catch (err) {
    console.warn('[conversationService] Failed to load from Supabase:', err);
  }

  // Fallback to local user cache
  const cached = getUserItem<ConversationItem[]>(cacheKey, uid);
  return cached || [];
}

/**
 * Create a new conversation record in Supabase (or locally if offline).
 */
export async function createConversation(title: string = 'New Conversation', userId?: string | null): Promise<ConversationItem> {
  const uid = userId || getCurrentUserId();
  const cacheKey = 'conversations_list';
  const now = new Date().toISOString();

  try {
    const { data: authData } = await supabase.auth.getUser();
    const effectiveUid = authData?.user?.id || uid;

    const payload: Partial<ConversationItem> = {
      title,
      archived: false,
      updated_at: now,
    };
    if (effectiveUid) {
      payload.user_id = effectiveUid;
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      const conv = data as ConversationItem;
      const existing = (getUserItem<ConversationItem[]>(cacheKey, uid) || []).filter(c => c.id !== conv.id);
      setUserItem(cacheKey, [conv, ...existing], uid);
      return conv;
    }
  } catch (err) {
    console.warn('[conversationService] Create conversation remote error:', err);
  }

  // Offline / local fallback
  const fallbackId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const localConv: ConversationItem = {
    id: fallbackId,
    user_id: uid || undefined,
    title,
    archived: false,
    created_at: now,
    updated_at: now,
  };
  const existing = getUserItem<ConversationItem[]>(cacheKey, uid) || [];
  setUserItem(cacheKey, [localConv, ...existing], uid);
  return localConv;
}

/**
 * Rename a conversation title.
 */
export async function renameConversation(conversationId: string, newTitle: string, userId?: string | null): Promise<boolean> {
  const uid = userId || getCurrentUserId();
  const cacheKey = 'conversations_list';
  const trimmed = newTitle.trim() || 'Untitled';
  const now = new Date().toISOString();

  // Update local cache immediately for snappy UI
  const existing = getUserItem<ConversationItem[]>(cacheKey, uid) || [];
  const updatedList = existing.map(c => c.id === conversationId ? { ...c, title: trimmed, updated_at: now } : c);
  setUserItem(cacheKey, updatedList, uid);

  try {
    const { error } = await supabase
      .from('conversations')
      .update({ title: trimmed, updated_at: now })
      .eq('id', conversationId);

    return !error;
  } catch (err) {
    console.warn('[conversationService] Rename conversation error:', err);
    return false;
  }
}

/**
 * Delete a conversation (cascades to messages in Supabase).
 */
export async function deleteConversation(conversationId: string, userId?: string | null): Promise<boolean> {
  const uid = userId || getCurrentUserId();
  const cacheKey = 'conversations_list';

  // Remove from local cache
  const existing = getUserItem<ConversationItem[]>(cacheKey, uid) || [];
  setUserItem(cacheKey, existing.filter(c => c.id !== conversationId), uid);

  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    return !error;
  } catch (err) {
    console.warn('[conversationService] Delete conversation error:', err);
    return false;
  }
}

/**
 * Load all messages for a specific conversation in ascending chronological order.
 */
export async function listMessages(conversationId: string, userId?: string | null): Promise<ChatMessage[]> {
  const uid = userId || getCurrentUserId();
  const cacheKey = `messages_${conversationId}`;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, user_id, role, content, emotion, tool, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      const mapped: ChatMessage[] = data.map((m: any) => ({
        id: m.id,
        sender: m.role === 'user' ? 'user' : 'mascot',
        text: m.content,
        time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: m.emotion || 'calm',
        expression: (m.emotion as MascotExpression) || 'calm',
        suggest_tool: m.tool || 'none',
      }));

      setUserItem(cacheKey, mapped, uid);
      return mapped;
    }
  } catch (err) {
    console.warn('[conversationService] Load messages remote error:', err);
  }

  // Fallback to local cache
  const cached = getUserItem<ChatMessage[]>(cacheKey, uid);
  return cached || [];
}

/**
 * Save a message (user prompt or bot response) into Supabase messages table and update conversation timestamp.
 */
export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  meta?: {
    id?: string;
    emotion?: string;
    tool?: string;
  },
  userId?: string | null
): Promise<void> {
  if (!content.trim() || !conversationId) return;

  const uid = userId || getCurrentUserId();
  const now = new Date().toISOString();
  const cacheKey = `messages_${conversationId}`;

  // 1. Update local cache
  const existingMsgs = getUserItem<ChatMessage[]>(cacheKey, uid) || [];
  const newMsg: ChatMessage = {
    id: meta?.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sender: role === 'user' ? 'user' : 'mascot',
    text: content,
    time: 'Just now',
    emotion: meta?.emotion || 'calm',
    expression: (meta?.emotion as MascotExpression) || 'calm',
    suggest_tool: (meta?.tool as any) || 'none',
  };

  // Avoid duplicate appending if id already in cache
  const filtered = existingMsgs.filter(m => m.id !== newMsg.id);
  setUserItem(cacheKey, [...filtered, newMsg], uid);

  // 2. Persist to Supabase
  try {
    const { data: authData } = await supabase.auth.getUser();
    const effectiveUid = authData?.user?.id || uid;

    const payload: any = {
      conversation_id: conversationId,
      role,
      content,
      emotion: meta?.emotion || 'neutral',
      tool: meta?.tool || null,
      created_at: now,
    };
    if (meta?.id && meta.id.includes('-') && meta.id.length === 36) {
      payload.id = meta.id;
    }
    if (effectiveUid) {
      payload.user_id = effectiveUid;
    }

    await Promise.allSettled([
      supabase.from('messages').insert(payload),
      supabase.from('conversations').update({ updated_at: now }).eq('id', conversationId),
    ]);
  } catch (err) {
    console.warn('[conversationService] Save message remote error:', err);
  }
}

/**
 * Generate 3-5 word title in background via gemini-3.8-flash and save it.
 */
export async function generateAndSaveTitle(
  conversationId: string,
  firstMessage: string,
  firstReply: string = '',
  userId?: string | null
): Promise<string> {
  if (!conversationId || !firstMessage.trim()) return 'New Conversation';

  const uid = userId || getCurrentUserId();
  const token = localStorage.getItem('manas_access_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let title = firstMessage.trim().substring(0, 30);

  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/generate-title`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        first_message: firstMessage,
        first_reply: firstReply,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        title = data.title;
      }
    }
  } catch (err) {
    console.warn('[conversationService] Auto-title backend call error:', err);
  }

  // Update in DB & local cache
  await renameConversation(conversationId, title, uid);
  return title;
}
