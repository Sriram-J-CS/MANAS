import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Trash2, Plus, Edit2, Check, Sparkles, MessageSquare, Calendar, ChevronRight } from 'lucide-react';
import { listConversations, deleteConversation, type ConversationItem } from '../../lib/chat/conversationService';

interface MemoryCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
}

export const MemoryCenterModal: React.FC<MemoryCenterModalProps> = ({ isOpen, onClose, token }) => {
  const [activeTab, setActiveTab] = useState<'memories' | 'chats'>('memories');
  const [memories, setMemories] = useState<any[]>([]);
  const [categories, setCategories] = useState<Record<string, any[]>>({});
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState('preferences');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFact, setEditFact] = useState('');

  const fetchMemories = async () => {
    setIsLoadingMemories(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/memory/center', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
        setCategories(data.categories || {});
      }
    } catch (_) {
    } finally {
      setIsLoadingMemories(false);
    }
  };

  const fetchChats = async () => {
    setIsLoadingChats(true);
    try {
      const list = await listConversations();
      setConversations(list);
    } catch (_) {
    } finally {
      setIsLoadingChats(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMemories();
      fetchChats();
    }
  }, [isOpen, token]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;
    setIsAdding(true);
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch('/api/memory/item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ category: newCategory, fact: newFact.trim() })
      });
      if (res.ok) {
        setNewFact('');
        fetchMemories();
      }
    } catch (_) {
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch(`/api/memory/item/${id}`, {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        fetchMemories();
      }
    } catch (_) {}
  };

  const handleSaveEdit = async (id: string) => {
    if (!editFact.trim()) return;
    try {
      const authToken = token || localStorage.getItem('manas_access_token');
      const res = await fetch(`/api/memory/item/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ fact: editFact.trim() })
      });
      if (res.ok) {
        setEditingId(null);
        fetchMemories();
      }
    } catch (_) {}
  };

  const handleDeleteChat = async (id: string) => {
    await deleteConversation(id);
    fetchChats();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0F1117] border border-white/10 text-white shadow-2xl p-6 sm:p-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Memory Center
                </h2>
                <p className="text-xs text-white/50">Transparent control over memories and conversation records</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-2 mt-5 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
            <button
              onClick={() => setActiveTab('memories')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'memories'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Saved Memories ({memories.length})
            </button>
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'chats'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-xs'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Past Chats ({conversations.length})
            </button>
          </div>

          {/* TAB 1: SAVED MEMORIES */}
          {activeTab === 'memories' && (
            <div className="my-6 space-y-6">
              {/* Add New Memory Input */}
              <form onSubmit={handleAddMemory} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <span className="text-[11px] font-mono text-white/40 uppercase block mb-2">Record a Personal Fact</span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80 focus:outline-none focus:border-amber-400"
                  >
                    <option value="preferences">Preferences</option>
                    <option value="goals">Goals & Milestones</option>
                    <option value="people">Important People</option>
                    <option value="strategies">Helpful Strategies</option>
                    <option value="context">Academic / Work Context</option>
                  </select>
                  <input
                    type="text"
                    placeholder="e.g. My final exams start on the 15th"
                    value={newFact}
                    onChange={(e) => setNewFact(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={isAdding || !newFact.trim()}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Save
                  </button>
                </div>
              </form>

              {/* Memories List */}
              {isLoadingMemories ? (
                <div className="py-12 text-center text-white/40 text-xs font-mono">Loading memories...</div>
              ) : memories.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 p-6">
                  <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-60" />
                  <h4 className="text-sm font-semibold text-white mb-1">No Memories Stored Yet</h4>
                  <p className="text-xs text-white/50 max-w-sm mx-auto">
                    When you converse with MANAS or add facts above, they will appear here with full view, edit, and deletion control.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(categories).map(([cat, items]) => (
                    <div key={cat} className="space-y-2">
                      <span className="text-[10px] font-mono text-amber-400/80 uppercase tracking-widest block pl-1">
                        {cat} ({items.length})
                      </span>
                      <div className="space-y-2">
                        {items.map((m: any) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all text-xs"
                          >
                            {editingId === m.id ? (
                              <div className="flex-1 flex gap-2 mr-2">
                                <input
                                  type="text"
                                  value={editFact}
                                  onChange={(e) => setEditFact(e.target.value)}
                                  className="flex-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/20 text-xs text-white focus:outline-none focus:border-amber-400"
                                />
                                <button
                                  onClick={() => handleSaveEdit(m.id)}
                                  className="p-2 rounded-xl bg-amber-500 text-black cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 mr-3 flex-1">
                                <span className="text-white/90">{m.fact}</span>
                                {m.source && (
                                  <span
                                    className={`text-[9px] font-mono px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit ${
                                      m.source.toLowerCase().includes('chat') || m.source.toLowerCase().includes('auto')
                                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                        : 'bg-white/10 text-white/50 border border-white/10'
                                    }`}
                                  >
                                    {(m.source.toLowerCase().includes('chat') || m.source.toLowerCase().includes('auto')) && (
                                      <Sparkles className="w-2.5 h-2.5 text-violet-300" />
                                    )}
                                    {m.source}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {editingId !== m.id && (
                                <button
                                  onClick={() => {
                                    setEditingId(m.id);
                                    setEditFact(m.fact);
                                  }}
                                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteMemory(m.id)}
                                className="p-1.5 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PAST CHATS */}
          {activeTab === 'chats' && (
            <div className="my-6 space-y-4">
              {isLoadingChats ? (
                <div className="py-12 text-center text-white/40 text-xs font-mono">Loading past chats...</div>
              ) : conversations.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 p-6">
                  <MessageSquare className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-60" />
                  <h4 className="text-sm font-semibold text-white mb-1">No Past Chats Recorded</h4>
                  <p className="text-xs text-white/50 max-w-sm mx-auto">
                    When you converse with MANAS in the companion workspace, each session will be securely archived here with options to review or delete.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((c) => {
                    const dateFormatted = new Date(c.updated_at || c.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-white font-medium truncate">{c.title || 'Conversation'}</h4>
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              <span>{dateFormatted}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteChat(c.id)}
                          className="p-2 rounded-xl text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                          title="Delete Chat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
