import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { getErrorMessage } from '../utils/format';

// How often to ask the server for new messages. There is no live connection, so the page polls:
// quickly while the conversation is on screen, slowly otherwise (just enough to keep the badge current).
const POLL_OPEN_MS = 5000;
const POLL_BACKGROUND_MS = 30000;

const merge = (current, incoming) => {
  const byId = new Map(current.map((m) => [m.id, m]));
  incoming.forEach((m) => byId.set(m.id, m));
  return [...byId.values()].sort((a, b) => a.id - b.id);
};

// A project's conversation between the client, the student team and UniPact.
//   enabled: the project has a conversation at all (it has started)
//   active:  the conversation is on screen, so poll quickly and count what arrives as read
export const useProjectMessages = (campaignId, { enabled = true, active = false } = {}) => {
  const [meta, setMeta] = useState({ state: null, canPost: false, closesAt: null, maxLength: 4000, maxAttachmentMb: 25 });
  const [messages, setMessages] = useState([]);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // The newest message the page has asked the server about, so each poll only fetches what came after
  const lastIdRef = useRef(0);
  // Which project the messages above belong to. The router keeps this page mounted when only the project
  // in the address changes, and one project's messages must never be shown or counted under another.
  const loadedForRef = useRef(campaignId);

  const load = useCallback(async () => {
    const switched = loadedForRef.current !== campaignId;
    if (switched) {
      loadedForRef.current = campaignId;
      lastIdRef.current = 0;
      setLoading(true);
    }
    const after = lastIdRef.current;
    try {
      // `open` tells the server this person is looking at the conversation, so it doesn't email them about it
      const params = { ...(after ? { after } : {}), ...(active ? { open: 1 } : {}) };
      const { data } = await api.get(`/campaigns/${campaignId}/messages/`, { params });
      setMeta({ state: data.state, canPost: data.can_post, closesAt: data.closes_at, maxLength: data.max_length, maxAttachmentMb: data.max_attachment_mb });
      setUnread(data.unread);
      if (loadedForRef.current !== campaignId) return; // the page moved on while this was in flight
      if (!after) {
        setMessages((prev) => (switched ? data.messages : merge(prev, data.messages)));
        setHasEarlier(data.has_earlier);
      } else if (data.messages.length > 0) {
        setMessages((prev) => merge(prev, data.messages));
      }
      if (data.messages.length > 0) lastIdRef.current = Math.max(lastIdRef.current, data.messages[data.messages.length - 1].id);
      setError('');
    } catch (err) {
      // A failed poll is retried on the next tick; only a failed first load is worth showing
      if (!after) setError(getErrorMessage(err, 'Could not load the messages.'));
    } finally {
      setLoading(false);
    }
  }, [campaignId, active]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, active ? POLL_OPEN_MS : POLL_BACKGROUND_MS);
    return () => clearInterval(timer);
  }, [enabled, active, load]);

  // While the conversation is on screen, whatever arrives has been seen
  useEffect(() => {
    if (!enabled || !active || unread === 0) return undefined;
    let cancelled = false;
    api.post(`/campaigns/${campaignId}/messages/read/`)
      .then(() => { if (!cancelled) setUnread(0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled, active, unread, campaignId]);

  const send = useCallback(async (body, file = null) => {
    let payload = { body };
    let config;
    if (file) {
      payload = new FormData();
      payload.append('body', body);
      payload.append('attachment', file);
      config = { headers: { 'Content-Type': 'multipart/form-data' } };
    }
    const { data } = await api.post(`/campaigns/${campaignId}/messages/`, payload, config);
    setMessages((prev) => merge(prev, [data]));
    // Fetch from where the page was, not from this message: someone else may have written just before it
    load();
    return data;
  }, [campaignId, load]);

  const loadEarlier = useCallback(async () => {
    const first = messages[0];
    if (!first) return;
    const { data } = await api.get(`/campaigns/${campaignId}/messages/`, { params: { before: first.id } });
    setMessages((prev) => merge(data.messages, prev));
    setHasEarlier(data.has_earlier);
  }, [campaignId, messages]);

  return { ...meta, messages, hasEarlier, unread, loading, error, send, loadEarlier, reload: load };
};
