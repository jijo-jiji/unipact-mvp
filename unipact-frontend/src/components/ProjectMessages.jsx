import React, { useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, Lock, MessageSquare, Paperclip, Send, ShieldCheck, X } from 'lucide-react';
import { findContactDetails, joinWithOr } from '../utils/contactDetails';
import { formatDate, getErrorMessage } from '../utils/format';

const ROLE_LABEL = { CLIENT: 'Client', STUDENT: 'Student', UNIPACT: 'UniPact' };
const ROLE_CLASS = {
  CLIENT: 'bg-[#00AEEF]/10 text-[#0090C6]',
  STUDENT: 'bg-emerald-50 text-emerald-700',
  UNIPACT: 'bg-[#0B1E63] text-white',
};

const dayKey = (value) => new Date(value).toDateString();

const dayLabel = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(value);
};

const sizeLabel = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const timeLabel = (value) => new Date(value).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' });

// On a phone the Enter key starts a new line (there is a Send button); with a keyboard it sends
const enterSends = () => !window.matchMedia?.('(pointer: coarse)').matches;

const COPY = {
  client: {
    other: 'your student team',
    about: 'One conversation for this project, shared with your student team and UniPact.',
    notice: 'UniPact can see this conversation. Changes to scope, price or payment go through UniPact, not this chat.',
    placeholder: 'Write a message to your student team…',
    notStarted: 'Once you have confirmed your team and the project is under way, you can talk to them here.',
    keepOnUniPact: 'Your agreement keeps work with this team on UniPact, including for 12 months after the project.',
  },
  student: {
    other: 'the client',
    about: 'One conversation for this project, shared with the client and UniPact.',
    notice: 'UniPact can see this conversation. Changes to scope, price or payment go through UniPact, not this chat.',
    placeholder: 'Write a message to the client…',
    notStarted: 'Once the client has confirmed the team and the project is under way, you can talk to them here.',
    keepOnUniPact: 'Your Talent Agreement keeps work with this client on UniPact, including for 12 months after your last job for them.',
  },
  admin: {
    other: 'the client and the student team',
    about: 'The conversation between the client and the student team. You write as UniPact.',
    notice: 'Everyone on the project sees what you write here: the client and every student on the team.',
    placeholder: 'Write a message as UniPact…',
    notStarted: 'The conversation opens when the client confirms the team and work starts.',
  },
};

// The Messages tab of a project page: one conversation shared by the client, the student team and UniPact.
// `chat` is what useProjectMessages returns; `viewer` ('client', 'student' or 'admin') words the explanations.
const ProjectMessages = ({ chat, viewer = 'client', started = true, onSent }) => {
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const listRef = useRef(null);
  // Follow new messages only while the reader is at the bottom; don't yank them away from older ones
  const pinnedRef = useRef(true);
  const { messages } = chat;
  const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && pinnedRef.current) list.scrollTop = list.scrollHeight;
  }, [lastId]);

  const copy = COPY[viewer] || COPY.client;

  if (!started || chat.state === 'NOT_STARTED') {
    return (
      <section className="card p-10 text-center text-sm text-[#5B6478]">
        <MessageSquare className="mx-auto mb-2 text-[#00AEEF]" size={28} />
        <h2 className="font-heading font-bold text-lg text-[#0A1748] mb-1">Messages open when the project starts</h2>
        <p className="max-w-md mx-auto">{copy.notStarted}</p>
      </section>
    );
  }

  const submit = async (e) => {
    e?.preventDefault();
    const body = draft.trim();
    if ((!body && !file) || sending || draft.length > chat.maxLength) return;
    setSending(true);
    setSendError('');
    try {
      pinnedRef.current = true;
      await chat.send(body, file);
      setDraft('');
      setFile(null);
      onSent?.();
    } catch (err) {
      setSendError(err.response?.status === 429
        ? 'You are sending messages very quickly. Wait a moment and try again.'
        : getErrorMessage(err, 'Could not send your message.'));
    } finally {
      setSending(false);
    }
  };

  const loadEarlier = async () => {
    const list = listRef.current;
    const heightBefore = list?.scrollHeight || 0;
    setLoadingEarlier(true);
    pinnedRef.current = false;
    try {
      await chat.loadEarlier();
      // Keep the message the reader was looking at in place while older ones appear above it
      requestAnimationFrame(() => {
        if (list) list.scrollTop += list.scrollHeight - heightBefore;
      });
    } finally {
      setLoadingEarlier(false);
    }
  };

  const chooseFile = (e) => {
    const chosen = e.target.files?.[0] || null;
    e.target.value = ''; // so picking the same file again after removing it still registers
    if (!chosen) return;
    if (chosen.size > chat.maxAttachmentMb * 1024 * 1024) {
      setSendError(`Files sent here can be at most ${chat.maxAttachmentMb} MB. Larger files belong in the project's files.`);
      return;
    }
    setSendError('');
    setFile(chosen);
  };

  const tooLong = draft.length > chat.maxLength;
  // A reminder, not a block: see utils/contactDetails.js
  const contactDetails = copy.keepOnUniPact ? findContactDetails(draft) : [];

  return (
    <section className="card overflow-hidden flex flex-col">
      <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[rgba(10,23,72,0.08)]">
        <h2 className="font-heading text-lg font-bold flex items-center gap-2">
          <MessageSquare size={18} className="text-[#00AEEF]" /> Messages
        </h2>
        <p className="text-sm text-[#5B6478] mt-0.5">{copy.about}</p>
        <p className="mt-3 flex items-start gap-2 text-xs text-[#0A1748] bg-[#F5F7FC] border border-[rgba(10,23,72,0.08)] rounded-lg p-2.5">
          <ShieldCheck size={14} className="text-[#00AEEF] shrink-0 mt-0.5" />
          <span>{copy.notice}</span>
        </p>
      </div>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 min-h-[280px] max-h-[55vh] overflow-y-auto px-5 sm:px-6 py-4 space-y-3 bg-white"
        aria-live="polite"
      >
        {chat.loading ? (
          <div className="py-16 text-center text-sm text-[#5B6478]">
            <Loader2 size={18} className="animate-spin inline mr-2 text-[#00AEEF]" /> Loading messages…
          </div>
        ) : chat.error ? (
          <div className="alert-error">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{chat.error}</span>
            <button type="button" onClick={chat.reload} className="ml-auto font-semibold underline">Try again</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#5B6478]">
            No messages yet.{chat.canPost && ' Ask a question or share an update to get started.'}
          </div>
        ) : (
          <>
            {chat.hasEarlier && (
              <div className="text-center">
                <button type="button" onClick={loadEarlier} disabled={loadingEarlier} className="btn-secondary btn-sm">
                  {loadingEarlier ? <Loader2 size={13} className="animate-spin" /> : null} Load earlier messages
                </button>
              </div>
            )}
            {messages.map((m, i) => {
              const newDay = i === 0 || dayKey(messages[i - 1].created_at) !== dayKey(m.created_at);
              return (
                <React.Fragment key={m.id}>
                  {newDay && (
                    <div className="flex items-center gap-3 text-xs text-[#5B6478] pt-1">
                      <span className="flex-1 h-px bg-[rgba(10,23,72,0.08)]" />
                      {dayLabel(m.created_at)}
                      <span className="flex-1 h-px bg-[rgba(10,23,72,0.08)]" />
                    </div>
                  )}
                  <div className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] sm:max-w-[70%]">
                      {!m.mine && (
                        <div className="flex items-center gap-1.5 mb-1 text-xs">
                          <span className="font-semibold text-[#0A1748]">{m.sender_name}</span>
                          {ROLE_LABEL[m.sender_role] && (
                            <span className={`px-1.5 py-px rounded-full text-[10px] font-semibold ${ROLE_CLASS[m.sender_role]}`}>{ROLE_LABEL[m.sender_role]}</span>
                          )}
                        </div>
                      )}
                      <div className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                        m.mine ? 'bg-[#0B1E63] text-white rounded-br-md' : 'bg-[#F5F7FC] text-[#0A1748] border border-[rgba(10,23,72,0.08)] rounded-bl-md'
                      }`}>
                        {m.body}
                        {m.attachment && (
                          <a
                            href={m.attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${m.body ? 'mt-2' : ''} ${
                              m.mine ? 'bg-white/10 hover:bg-white/20' : 'bg-white border border-[rgba(10,23,72,0.08)] hover:border-[#00AEEF]'
                            }`}
                          >
                            <Paperclip size={14} className="shrink-0" />
                            <span className="min-w-0">
                              <span className="block font-semibold break-all">{m.attachment.name}</span>
                              {m.attachment.size > 0 && <span className={`block text-[11px] ${m.mine ? 'text-white/70' : 'text-[#5B6478]'}`}>{sizeLabel(m.attachment.size)}</span>}
                            </span>
                          </a>
                        )}
                      </div>
                      <div className={`text-[11px] text-[#5B6478] mt-1 ${m.mine ? 'text-right' : ''}`}>{m.mine ? 'You · ' : ''}{timeLabel(m.created_at)}</div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      {chat.canPost ? (
        <form onSubmit={submit} className="border-t border-[rgba(10,23,72,0.08)] p-4 sm:p-5 bg-[#F5F7FC]">
          {sendError && <div className="alert-error mb-3"><AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{sendError}</span></div>}
          {contactDetails.length > 0 && (
            <p className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <span>This looks like it includes {joinWithOr(contactDetails)}. {copy.keepOnUniPact} You can still send it.</span>
            </p>
          )}
          {file && (
            <div className="flex items-center gap-2 text-sm bg-white border border-[rgba(10,23,72,0.12)] rounded-lg px-3 py-2 mb-3">
              <Paperclip size={14} className="text-[#00AEEF] shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
              <span className="text-xs text-[#5B6478] shrink-0">{sizeLabel(file.size)}</span>
              <button type="button" onClick={() => setFile(null)} disabled={sending} aria-label="Remove the attached file" className="p-1 rounded text-[#5B6478] hover:text-red-700 shrink-0">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 sm:gap-3">
            <input ref={fileInputRef} type="file" onChange={chooseFile} className="hidden" tabIndex={-1} aria-hidden="true" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title={`Attach a file (up to ${chat.maxAttachmentMb} MB)`}
              aria-label="Attach a file"
              className="btn-secondary shrink-0 h-11 px-3"
            >
              <Paperclip size={16} />
            </button>
            <label className="sr-only" htmlFor="project-message">Write a message</label>
            <textarea
              id="project-message"
              rows={2}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (sendError) setSendError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && enterSends()) submit(e);
              }}
              placeholder={copy.placeholder}
              className="input bg-white resize-y min-h-[44px] max-h-48 flex-1"
            />
            <button type="submit" disabled={(!draft.trim() && !file) || sending || tooLong} className="btn-primary shrink-0 h-11">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send
            </button>
          </div>
          <div className="flex flex-wrap justify-between gap-2 mt-2 text-xs text-[#5B6478]">
            <span>
              {chat.closesAt
                ? `This project is completed. You can keep writing here until ${formatDate(chat.closesAt)}.`
                : 'Press Enter to send, Shift + Enter for a new line.'}
            </span>
            {draft.length > chat.maxLength * 0.9 && (
              <span className={tooLong ? 'text-red-700 font-semibold' : ''}>{draft.length.toLocaleString('en-MY')} / {chat.maxLength.toLocaleString('en-MY')}</span>
            )}
          </div>
        </form>
      ) : !chat.loading && !chat.error && (
        <p className="border-t border-[rgba(10,23,72,0.08)] p-4 sm:p-5 bg-[#F5F7FC] text-sm text-[#5B6478] flex items-start gap-2">
          <Lock size={15} className="shrink-0 mt-0.5" />
          <span>
            This conversation is closed{chat.closesAt ? ` (it stayed open until ${formatDate(chat.closesAt)})` : ''}. You can still read it.
            Contact UniPact if you need anything further on this project.
          </span>
        </p>
      )}
    </section>
  );
};

export default ProjectMessages;
