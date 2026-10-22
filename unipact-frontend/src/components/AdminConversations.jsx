import React, { useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import ProjectMessages from './ProjectMessages';
import StatusBadge from './StatusBadge';
import { useProjectMessages } from '../hooks/useProjectMessages';

const when = (value) => {
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
};

// One conversation, open. Mounted per project (the parent gives it a key) so each starts clean.
const ConversationPanel = ({ campaignId, onSent }) => {
  const chat = useProjectMessages(campaignId, { enabled: true, active: true });
  return <ProjectMessages chat={chat} viewer="admin" onSent={onSent} />;
};

// The Admin hub's Messages tab: every project conversation on the left, the chosen one on the right.
// Admins read along and reply as UniPact.
const AdminConversations = ({ conversations, loading, onOpened, onRefresh }) => {
  const [selectedId, setSelectedId] = useState(null);
  const selected = conversations.find((c) => c.id === selectedId) || null;

  const open = (conversation) => {
    setSelectedId(conversation.id);
    onOpened(conversation.id);
    // Below the lg breakpoint the conversation sits under the list, so bring it into view
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => document.getElementById('conversation-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section className="lg:col-span-5 space-y-3">
        <h2 className="font-heading font-bold text-lg flex items-center gap-2">
          <MessageSquare size={17} className="text-[#00AEEF]" /> Project conversations
        </h2>
        <p className="text-sm text-[#5B6478]">Each project has one conversation between the client and the student team. You can read along and reply as UniPact.</p>

        {loading ? (
          <div className="card p-10 text-center text-sm text-[#5B6478]">
            <Loader2 size={18} className="animate-spin inline mr-2 text-[#00AEEF]" /> Loading conversations…
          </div>
        ) : conversations.length === 0 ? (
          <div className="card p-10 text-center text-sm text-[#5B6478]">
            No conversations yet. One opens for each project when the client confirms the team and work starts.
          </div>
        ) : (
          <ul className="space-y-3">
            {conversations.map((c) => {
              const isSelected = c.id === selectedId;
              // The open conversation is being read as it arrives
              const unread = isSelected ? 0 : c.unread;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => open(c)}
                    aria-pressed={isSelected}
                    className={`card w-full text-left p-4 transition-colors hover:border-[#00AEEF] ${isSelected ? 'border-2 border-[#00AEEF] bg-[#E6F7FD]/40' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold min-w-0 break-words">{c.title}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {unread > 0 && <span className="badge bg-[#00AEEF] border-transparent text-[#0A1748] px-1.5 py-0">{unread}</span>}
                        <StatusBadge status={c.status} />
                      </span>
                    </div>
                    <div className="text-xs text-[#5B6478] mt-0.5 break-words">
                      {c.company_name}{c.team.length > 0 && ` · ${c.team.join(', ')}`}
                    </div>
                    {c.last_message ? (
                      <div className="flex items-baseline justify-between gap-3 mt-2 text-sm">
                        <span className={`min-w-0 truncate ${unread > 0 ? 'font-semibold text-[#0A1748]' : 'text-[#5B6478]'}`}>
                          {c.last_message.sender_name}: {c.last_message.body}
                        </span>
                        <span className="text-xs text-[#5B6478] shrink-0">{when(c.last_message.created_at)}</span>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-[#5B6478] italic">No messages yet.</div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div id="conversation-panel" className="lg:col-span-7 scroll-mt-24">
        {selected ? (
          <div className="space-y-3">
            <div className="text-sm text-[#5B6478]">
              <strong className="text-[#0A1748]">{selected.title}</strong> · {selected.company_name}
              {selected.team.length > 0 && <> with {selected.team.join(', ')}</>}
            </div>
            <ConversationPanel key={selected.id} campaignId={selected.id} onSent={onRefresh} />
          </div>
        ) : (
          <div className="card p-12 text-center text-sm text-[#5B6478]">
            <MessageSquare className="mx-auto mb-2 text-[#00AEEF]" size={28} />
            Pick a conversation to read it and reply as UniPact.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminConversations;
