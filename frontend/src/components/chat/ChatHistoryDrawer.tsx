import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Search,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  ChevronRight,
  Clock,
  AlertCircle
} from 'lucide-react';
import type { ConversationItem } from '../../lib/chat/conversationService';

interface ChatHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationItem[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
}

export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  // Group conversations: Today, Yesterday, Earlier
  const groupedConversations = useMemo(() => {
    const today: ConversationItem[] = [];
    const yesterday: ConversationItem[] = [];
    const earlier: ConversationItem[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;

    for (const conv of filteredConversations) {
      const convTime = new Date(conv.updated_at || conv.created_at).getTime();
      if (convTime >= startOfToday) {
        today.push(conv);
      } else if (convTime >= startOfYesterday) {
        yesterday.push(conv);
      } else {
        earlier.push(conv);
      }
    }

    return { today, yesterday, earlier };
  }, [filteredConversations]);

  const handleStartRename = (conv: ConversationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setMenuOpenId(null);
  };

  const handleSaveRename = async (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      await onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleConfirmDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await onDeleteConversation(id);
    } finally {
      setIsDeleting(false);
      setConfirmDeleteId(null);
      setMenuOpenId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel: Slide from left on desktop, bottom sheet on mobile */}
      <aside
        className={`relative z-10 w-full max-w-sm sm:w-80 md:w-96 bg-[#FDFBF7] shadow-2xl flex flex-col h-full border-r border-[#0A0A0A]/10 animate-in slide-in-from-left duration-200 ease-out`}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#0A0A0A]/10 flex items-center justify-between bg-white/70 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#8B5CF6]" />
            <h2 className="font-mono font-bold text-base text-[#0A0A0A] tracking-tight">Chat History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[#0A0A0A]/5 text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action: New Chat button */}
        <div className="p-3 border-b border-[#0A0A0A]/5 bg-[#FDFBF7]">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-mono font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search input */}
        <div className="px-3 py-2 border-b border-[#0A0A0A]/5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#0A0A0A]/40 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#0A0A0A]/10 bg-white text-xs text-[#0A0A0A] placeholder-[#0A0A0A]/40 focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-[#0A0A0A]/40 hover:text-[#0A0A0A]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* List of Conversations */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-10 px-4">
              <MessageSquare className="w-8 h-8 text-[#0A0A0A]/20 mx-auto mb-2" />
              <p className="text-xs text-[#0A0A0A]/60 font-mono">
                {searchQuery ? 'No matching conversations' : 'No past conversations yet'}
              </p>
            </div>
          ) : (
            <>
              {/* Group: Today */}
              {groupedConversations.today.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0A0A0A]/40 px-2">
                    Today
                  </span>
                  {groupedConversations.today.map((conv) => (
                    <ConversationRow
                      key={conv.id}
                      conv={conv}
                      isActive={conv.id === activeConversationId}
                      isEditing={editingId === conv.id}
                      editTitle={editTitle}
                      setEditTitle={setEditTitle}
                      isMenuOpen={menuOpenId === conv.id}
                      setMenuOpenId={setMenuOpenId}
                      onSelect={() => {
                        onSelectConversation(conv.id);
                        onClose();
                      }}
                      onStartRename={handleStartRename}
                      onSaveRename={handleSaveRename}
                      onCancelRename={() => setEditingId(null)}
                      onPromptDelete={(id) => {
                        setConfirmDeleteId(id);
                        setMenuOpenId(null);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Group: Yesterday */}
              {groupedConversations.yesterday.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0A0A0A]/40 px-2">
                    Yesterday
                  </span>
                  {groupedConversations.yesterday.map((conv) => (
                    <ConversationRow
                      key={conv.id}
                      conv={conv}
                      isActive={conv.id === activeConversationId}
                      isEditing={editingId === conv.id}
                      editTitle={editTitle}
                      setEditTitle={setEditTitle}
                      isMenuOpen={menuOpenId === conv.id}
                      setMenuOpenId={setMenuOpenId}
                      onSelect={() => {
                        onSelectConversation(conv.id);
                        onClose();
                      }}
                      onStartRename={handleStartRename}
                      onSaveRename={handleSaveRename}
                      onCancelRename={() => setEditingId(null)}
                      onPromptDelete={(id) => {
                        setConfirmDeleteId(id);
                        setMenuOpenId(null);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Group: Earlier */}
              {groupedConversations.earlier.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0A0A0A]/40 px-2">
                    Earlier
                  </span>
                  {groupedConversations.earlier.map((conv) => (
                    <ConversationRow
                      key={conv.id}
                      conv={conv}
                      isActive={conv.id === activeConversationId}
                      isEditing={editingId === conv.id}
                      editTitle={editTitle}
                      setEditTitle={setEditTitle}
                      isMenuOpen={menuOpenId === conv.id}
                      setMenuOpenId={setMenuOpenId}
                      onSelect={() => {
                        onSelectConversation(conv.id);
                        onClose();
                      }}
                      onStartRename={handleStartRename}
                      onSaveRename={handleSaveRename}
                      onCancelRename={() => setEditingId(null)}
                      onPromptDelete={(id) => {
                        setConfirmDeleteId(id);
                        setMenuOpenId(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {confirmDeleteId && (
          <div className="p-3 bg-rose-50 border-t border-rose-200">
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-900 font-medium leading-tight">
                Delete this conversation? All messages will be permanently removed.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-2.5 py-1 rounded-lg text-xs font-mono text-[#0A0A0A]/70 hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleConfirmDelete(confirmDeleteId)}
                className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

interface ConversationRowProps {
  conv: ConversationItem;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (val: string) => void;
  isMenuOpen: boolean;
  setMenuOpenId: (id: string | null) => void;
  onSelect: () => void;
  onStartRename: (conv: ConversationItem, e: React.MouseEvent) => void;
  onSaveRename: (id: string, e?: React.FormEvent) => void;
  onCancelRename: () => void;
  onPromptDelete: (id: string) => void;
}

const ConversationRow: React.FC<ConversationRowProps> = ({
  conv,
  isActive,
  isEditing,
  editTitle,
  setEditTitle,
  isMenuOpen,
  setMenuOpenId,
  onSelect,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onPromptDelete,
}) => {
  return (
    <div
      onClick={!isEditing ? onSelect : undefined}
      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer border ${
        isActive
          ? 'bg-violet-50/90 border-[#8B5CF6]/50 text-violet-950 font-medium shadow-xs'
          : 'bg-white/60 hover:bg-white border-transparent hover:border-[#0A0A0A]/10 text-[#0A0A0A]/80'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
        <MessageSquare
          className={`w-3.5 h-3.5 shrink-0 ${
            isActive ? 'text-[#8B5CF6]' : 'text-[#0A0A0A]/40 group-hover:text-[#0A0A0A]/70'
          }`}
        />
        {isEditing ? (
          <form
            onSubmit={(e) => onSaveRename(conv.id, e)}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 flex-1"
          >
            <input
              type="text"
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-2 py-0.5 text-xs rounded border border-[#8B5CF6] bg-white focus:outline-none"
            />
            <button
              type="submit"
              className="p-1 hover:bg-emerald-50 text-emerald-600 rounded"
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onCancelRename}
              className="p-1 hover:bg-rose-50 text-rose-600 rounded"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <span className="text-xs truncate block leading-snug">{conv.title || 'New Conversation'}</span>
        )}
      </div>

      {!isEditing && (
        <div className="relative shrink-0 flex items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(isMenuOpen ? null : conv.id);
            }}
            className={`p-1 rounded-lg hover:bg-black/5 text-[#0A0A0A]/50 hover:text-[#0A0A0A] transition-opacity ${
              isMenuOpen ? 'opacity-100 bg-black/5' : 'opacity-0 group-hover:opacity-100'
            }`}
            title="Options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {/* Action Popover */}
          {isMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-7 w-32 bg-white rounded-xl shadow-lg border border-[#0A0A0A]/10 py-1 z-20 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                onClick={(e) => onStartRename(conv, e)}
                className="w-full px-3 py-1.5 text-left text-xs text-[#0A0A0A]/80 hover:bg-violet-50 hover:text-[#8B5CF6] flex items-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Rename
              </button>
              <button
                type="button"
                onClick={() => onPromptDelete(conv.id)}
                className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
