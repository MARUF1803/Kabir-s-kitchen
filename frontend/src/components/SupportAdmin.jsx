import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageCircle, Send, UserRound, Headphones, RefreshCw, Search, Bot, Sparkles,
  PanelLeftClose, PanelLeft, Info, CheckCircle2, Phone, MapPin, ShoppingBag, X,
  Clock, AlertCircle, ChevronRight
} from 'lucide-react';
import { supportApi } from '../services/api';
import { useApp } from '../context/useApp';

const QUICK_RESPONSES = [
  "Hello! Welcome to Kabir's Kitchen support. How can I assist you today?",
  "We have verified your order. It is currently being prepared fresh in our kitchen.",
  "Our delivery rider is dispatched and heading to your location!",
  "We are checking with the head chef right now and will update you shortly.",
  "Thank you for contacting us! Enjoy your meal and have a wonderful day."
];

export default function SupportAdmin() {
  const { activeBranch, authUser } = useApp();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [conversationDetail, setConversationDetail] = useState({ id: null, data: null });
  const [messageState, setMessageState] = useState({ id: null, data: [] });
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All'); // 'All' | 'Open' | 'InProgress' | 'Resolved'
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const pollTimerRef = useRef(null);
  const selectedConversation = conversationDetail.id === selectedId ? conversationDetail.data : null;
  const messages = useMemo(
    () => messageState.id === selectedId ? messageState.data : [],
    [messageState, selectedId]
  );

  const setMessages = (nextMessages) => {
    setMessageState(previous => {
      const currentMessages = previous.id === selectedId ? previous.data : [];
      return {
        id: selectedId,
        data: typeof nextMessages === 'function' ? nextMessages(currentMessages) : nextMessages
      };
    });
  };

  // 1. Fetch conversation list
  const fetchConversations = useCallback(async (quiet = false) => {
    try {
      const data = await supportApi.list({ pageSize: 50 });
      const list = Array.isArray(data) ? data : [];
      setConversations(list);
      // If none selected, default to first
      setSelectedId(prev => {
        if (prev && list.some(c => c.id === prev)) return prev;
        return list.length > 0 ? list[0].id : null;
      });
    } catch {
      if (!quiet) setError('Unable to load customer conversations.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  // Poll list every 6 seconds
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- This starts an asynchronous API request.
    fetchConversations();
    const interval = setInterval(() => fetchConversations(true), 3000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // 2. Fetch selected conversation messages
  const fetchSelectedMessages = useCallback(async (id, quiet = false) => {
    if (!id) {
      return;
    }
    try {
      const data = await supportApi.get(id);
      setConversationDetail({ id, data });
      setMessageState({ id, data: data?.messages || [] });
      setError('');
    } catch {
      if (!quiet) setError('Unable to load messages for this conversation.');
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      // oxlint-disable-next-line react/set-state-in-effect -- This starts an asynchronous API request.
      fetchSelectedMessages(selectedId);
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        fetchSelectedMessages(selectedId, true);
      }, 1500);
    }
    return () => clearInterval(pollTimerRef.current);
  }, [selectedId, fetchSelectedMessages]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. Send Staff Reply
  const handleSendReply = async (e) => {
    e?.preventDefault();
    if (!replyText.trim() || !selectedId || sending) return;

    const outgoing = replyText.trim();
    setReplyText('');
    setSending(true);

    // Optimistic UI update
    const optimisticMessage = {
      id: Date.now(),
      senderType: 1, // Staff
      senderId: authUser?.id || 1,
      text: outgoing,
      createdAtUtc: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const updated = await supportApi.sendMessage(selectedId, outgoing, 0);
      if (updated?.messages) {
        setMessages(updated.messages);
      }
      // Refresh list to update snippet
      fetchConversations(true);
    } catch {
      setError('Failed to send reply. Please check connection.');
    } finally {
      setSending(false);
    }
  };

  // 4. Update Status (e.g. InProgress or Resolved)
  const handleUpdateStatus = async (newStatusInt) => {
    if (!selectedId || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await supportApi.update(selectedId, {
        status: newStatusInt,
        assignedAgentId: authUser?.id || null
      });
      fetchSelectedMessages(selectedId, true);
      fetchConversations(true);
    } catch {
      setError('Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Filtered conversation list
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      const matchesSearch =
        (c.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterStatus === 'Open') return c.status === 0;
      if (filterStatus === 'InProgress') return c.status === 1 || c.status === 2;
      if (filterStatus === 'Resolved') return c.status === 3 || c.status === 4;
      return true;
    });
  }, [conversations, searchQuery, filterStatus]);

  const totalUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  }, [conversations]);

  const getStatusLabel = (statusInt) => {
    switch (statusInt) {
      case 0: return { label: 'Open', color: '#ea580c', bg: 'rgba(234,88,12,0.1)' };
      case 1: return { label: 'In Progress', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' };
      case 2: return { label: 'Waiting on Staff', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' };
      case 3: return { label: 'Resolved', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' };
      case 4: return { label: 'Closed', color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
      default: return { label: 'Active', color: '#ea580c', bg: 'rgba(234,88,12,0.1)' };
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)', minHeight: '680px', height: 'calc(100vh - 180px)', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {error && <div role="alert" style={{ gridColumn: '1 / -1', padding: '10px 16px', color: '#b91c1c', background: '#fef2f2' }}>{error}</div>}
      
      {/* ── Left Sidebar: Conversations ── */}
      <aside style={{ borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: '#f8fafc', minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#071c14', color: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Headphones size={17} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Staff Live Support</h3>
                <small style={{ fontSize: '0.7rem', color: '#64748b' }}>Active customer chats</small>
              </div>
            </div>
            {totalUnread > 0 && (
              <span style={{ background: '#ea580c', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>
                {totalUnread} new
              </span>
            )}
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search customer, topic..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.78rem', outline: 'none' }}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {['All', 'Open', 'InProgress', 'Resolved'].map(tab => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                style={{
                  border: 'none',
                  background: filterStatus === tab ? '#071c14' : '#f1f5f9',
                  color: filterStatus === tab ? '#d4af37' : '#64748b',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab === 'InProgress' ? 'In Progress' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading && conversations.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
              <RefreshCw size={20} className="spin" style={{ display: 'block', margin: '0 auto 8px' }} />
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
              No customer messages found.
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = conv.id === selectedId;
              const status = getStatusLabel(conv.status);
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    marginBottom: 6,
                    background: isSelected ? '#fff' : 'transparent',
                    border: isSelected ? '1px solid #ea580c' : '1px solid transparent',
                    boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e2e8f0', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>
                        {(conv.customerName || 'C').charAt(0).toUpperCase()}
                      </div>
                      <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{conv.customerName || 'Customer'}</strong>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                      {conv.updatedAtUtc ? new Date(conv.updatedAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: '0.74rem', color: isSelected ? '#071c14' : '#475569', fontWeight: 600 }}>
                      {conv.subject || 'Support Chat'}
                    </div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: status.bg, color: status.color }}>
                      {status.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                      {conv.lastMessage || 'No messages yet'}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#ea580c', color: '#fff', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Right Panel: Chat Thread & Reply ── */}
      <section style={{ display: 'flex', flexDirection: 'column', background: '#fff', minWidth: 0, overflow: 'hidden' }}>
        {selectedConversation ? (
          <>
            {/* Header */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                    {selectedConversation.customerName || 'Customer'}
                  </h3>
                  <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                    {selectedConversation.branchName || activeBranch?.name || 'Branch'}
                  </span>
                  {selectedConversation.orderNumber && (
                    <span style={{ fontSize: '0.72rem', background: 'rgba(234,88,12,0.1)', color: '#ea580c', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                      Order #{selectedConversation.orderNumber}
                    </span>
                  )}
                </div>
                <small style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Topic: {selectedConversation.subject} · ID #{selectedConversation.id}
                </small>
              </div>

              {/* Status Action Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
                <select
                  value={selectedConversation.status}
                  onChange={e => handleUpdateStatus(parseInt(e.target.value, 10))}
                  disabled={updatingStatus}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    background: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  <option value={0}>Open</option>
                  <option value={1}>In Progress</option>
                  <option value={2}>Waiting on Staff</option>
                  <option value={3}>Resolved</option>
                  <option value={4}>Closed</option>
                </select>
              </div>
            </div>

            {/* Message Thread */}
            <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', background: '#fcfcfd', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: '#94a3b8' }}>
                  <MessageCircle size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>No messages in this conversation yet.</p>
                  <small style={{ fontSize: '0.75rem' }}>Send a reply below to initiate support.</small>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isStaff = m.senderType === 1; // Staff
                  const isAi = m.senderType === 2;    // AI Assistant
                  return (
                    <div
                      key={m.id || idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isStaff ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        alignSelf: isStaff ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: '0.68rem', color: '#94a3b8' }}>
                        {isStaff ? (
                          <>
                            <span>{new Date(m.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <strong style={{ color: '#071c14' }}>Staff (You)</strong>
                            <Headphones size={12} color="#ea580c" />
                          </>
                        ) : isAi ? (
                          <>
                            <Bot size={12} color="#2563eb" />
                            <strong style={{ color: '#2563eb' }}>AI Assistant</strong>
                            <span>{new Date(m.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </>
                        ) : (
                          <>
                            <UserRound size={12} />
                            <strong style={{ color: '#0f172a' }}>{selectedConversation.customerName || 'Customer'}</strong>
                            <span>{new Date(m.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </>
                        )}
                      </div>

                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: isStaff ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                          background: isStaff ? '#071c14' : isAi ? '#eff6ff' : '#fff',
                          color: isStaff ? '#fff' : '#0f172a',
                          border: isStaff ? 'none' : isAi ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          fontSize: '0.82rem',
                          lineHeight: 1.45,
                          wordBreak: 'break-word'
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Response Chips */}
            <div style={{ padding: '8px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', gap: 6, overflowX: 'auto' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <Sparkles size={11} /> Quick:
              </span>
              {QUICK_RESPONSES.map((tmpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setReplyText(tmpl)}
                  style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 14,
                    padding: '3px 10px',
                    fontSize: '0.68rem',
                    color: '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.target.style.borderColor = '#ea580c'}
                  onMouseLeave={e => e.target.style.borderColor = '#e2e8f0'}
                >
                  {tmpl.slice(0, 32)}...
                </button>
              ))}
            </div>

            {/* Composer */}
            <form onSubmit={handleSendReply} style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Type your reply to customer... (Press Enter to send)"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={!replyText.trim() || sending}
                style={{
                  background: replyText.trim() ? '#ea580c' : '#cbd5e1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 18px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                  transition: 'background 0.15s'
                }}
              >
                <Send size={15} /> Reply
              </button>
            </form>
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#94a3b8', padding: 40 }}>
            <Headphones size={44} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#475569' }}>No Conversation Selected</h4>
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem' }}>Choose a customer chat from the list on the left to read and send replies.</p>
          </div>
        )}
      </section>
    </div>
  );
}
