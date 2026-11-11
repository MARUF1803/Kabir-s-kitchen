import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bot, CheckCheck, Headphones, LockKeyhole, MessageCircle, Send, Sparkles, UserRound } from 'lucide-react';
import apiClient from '../services/api';
import { useApp } from '../context/useApp';
import './CustomerChatPage.css';

export default function CustomerChatPage() {
  const { setCurrentMode, activeBranch, authUser, saveAuthSession, signOut, setSelectedBranchId } = useApp();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesConversationId, setMessagesConversationId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loginMode, setLoginMode] = useState(true);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const messagesEndRef = useRef(null);

  const selected = useMemo(() => {
    if (!conversations.length) return null;
    return conversations.find(c => c.id === selectedId) || conversations[0] || null;
  }, [conversations, selectedId]);
  const visibleMessages = useMemo(
    () => messagesConversationId === selected?.id ? messages : [],
    [messagesConversationId, selected?.id, messages]
  );

  const loadConversations = useCallback(async () => {
    if (!authUser) return;
    try {
      const response = await apiClient.get('/support/conversations?myConversations=true&pageSize=25');
      setError('');
      const list = Array.isArray(response.data) ? response.data : [];
      setConversations(list);
      if (list.length > 0) {
        setSelectedId(prev => prev && list.some(c => c.id === prev) ? prev : list[0].id);
      } else {
        setSelectedId(null);
        setMessages([]);
      }
    } catch (requestError) {
      if (requestError.response?.status !== 401) {
        setError(requestError.response?.data?.message || 'Unable to load conversations.');
      }
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser) {
      // oxlint-disable-next-line react/set-state-in-effect -- This starts an asynchronous API request.
      loadConversations();
    }
  }, [authUser, loadConversations]);

  useEffect(() => {
    if (!selected?.id || !authUser) return;
    let active = true;
    const loadMessages = async () => {
      try {
        const response = await apiClient.get(`/support/conversations/${selected.id}`);
        if (active) {
          setMessages(response.data.messages || []);
          setMessagesConversationId(selected.id);
          setError('');
        }
      } catch (requestError) {
        if (active && requestError.response?.status !== 401) {
          setError(requestError.response?.data?.message || 'Unable to load this conversation.');
        }
      }
    };
    loadMessages();
    const timer = setInterval(loadMessages, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected?.id, authUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages]);

  const login = async (event, credentials = loginForm) => {
    event?.preventDefault();
    setLoginError('');
    try {
      const response = await apiClient.post('/auth/login', {
        emailOrPhone: credentials.email,
        password: credentials.password
      });
      const userData = {
        id: response.data.userId,
        name: response.data.fullName,
        fullName: response.data.fullName,
        email: response.data.email,
        role: response.data.role
      };
      saveAuthSession({ token: response.data.accessToken, user: userData });
      setSelectedBranchId(response.data.currentBranchId || activeBranch.id);
    } catch (requestError) {
      setLoginError(requestError.response?.data?.message || 'Login failed.');
    }
  };

  const register = async (event) => {
    event.preventDefault();
    setLoginError('');
    try {
      await apiClient.post('/auth/register', {
        fullName: registerForm.fullName?.trim() || registerForm.email.split('@')[0],
        email: registerForm.email.trim(),
        phoneNumber: registerForm.phone?.trim() || '+8801700000000',
        password: registerForm.password,
        roleName: 'Customer',
        primaryBranchId: activeBranch.id
      });
      await login(null, { email: registerForm.email.trim(), password: registerForm.password });
    } catch (requestError) {
      const msg = requestError.response?.data?.message;
      if (msg?.includes('already registered')) {
        // Automatically attempt login if user was already registered
        try {
          await login(null, { email: registerForm.email.trim(), password: registerForm.password });
          return;
        } catch {
          setLoginError('Email is already registered. Please sign in with your password.');
          setLoginMode(true);
          return;
        }
      }
      setLoginError(msg || 'Registration failed. Please check connection.');
    }
  };

  const createConversation = async () => {
    setIsCreating(true);
    setError('');
    try {
      const response = await apiClient.post('/support/conversations', {
        branchId: activeBranch.id,
        type: 0,
        subject: 'Order support',
        orderId: null,
        cakeOrderId: null,
        priority: 0
      });
      const conversation = response.data;
      setConversations(prev => [{ ...conversation, customerName: authUser.name, branchName: activeBranch.name, lastMessage: '', updatedAtUtc: conversation.createdAtUtc, unreadCount: 0 }, ...prev]);
      setSelectedId(conversation.id);
      setMessages(conversation.messages || []);
      setMessagesConversationId(conversation.id);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to start chat.');
    } finally {
      setIsCreating(false);
    }
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || !selected) return;

    // Optimistic UI — show instantly before server confirms
    const optimistic = {
      id: `opt-${Date.now()}`,
      senderType: 0, // Customer
      text,
      createdAtUtc: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimistic]);
    setMessagesConversationId(selected.id);
    setMessage('');

    try {
      const response = await apiClient.post(
        `/support/conversations/${selected.id}/messages`,
        { conversationId: selected.id, text, messageType: 0 }
      );
      // Replace optimistic with real data from server
      setMessages(response.data.messages || []);
    } catch (requestError) {
      // Rollback optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setError(requestError.response?.data?.message || 'Message was not sent.');
    }
  };

  if (!authUser) {
    return (
      <main className="customer-chat-auth">
        <button className="workspace-back" onClick={() => setCurrentMode('customer')}><ArrowLeft size={18} /> Back to storefront</button>
        <section className="chat-auth-card">
          <span className="chat-auth-card__icon"><MessageCircle size={30} /></span>
          <span className="eyebrow">Kabir’s Kitchen support</span>
          <h1>{loginMode ? 'Chat with our team' : 'Create your customer account'}</h1>
          <p>Sign in to send messages, view order details, and receive replies from our support team.</p>
          <form onSubmit={loginMode ? login : register}>
            {!loginMode && <label>Full name<input type="text" value={registerForm.fullName} onChange={e => setRegisterForm({ ...registerForm, fullName: e.target.value })} placeholder="Your full name" required /></label>}
            {!loginMode && <label>Phone number<input type="tel" value={registerForm.phone} onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })} placeholder="+88001xxxxxxxx" required /></label>}
            <label>Email<input type="email" value={loginMode ? loginForm.email : registerForm.email} onChange={e => loginMode ? setLoginForm({ ...loginForm, email: e.target.value }) : setRegisterForm({ ...registerForm, email: e.target.value })} placeholder="you@example.com" required /></label>
            <label>Password<input type="password" minLength={loginMode ? undefined : 12} value={loginMode ? loginForm.password : registerForm.password} onChange={e => loginMode ? setLoginForm({ ...loginForm, password: e.target.value }) : setRegisterForm({ ...registerForm, password: e.target.value })} placeholder={loginMode ? 'Your password' : 'At least 12 characters'} required /></label>
            {loginError && <div className="form-error">{loginError}</div>}
            <button type="submit" className="primary-button"><LockKeyhole size={17} /> {loginMode ? 'Sign in to chat' : 'Create account & chat'}</button>
          </form>
          <button className="text-button" onClick={() => setLoginMode(value => !value)}>{loginMode ? 'Need an account? Register' : 'Already have an account? Sign in'}</button>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px dashed #dce8df', textAlign: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block', marginBottom: 10 }}>Prefer WhatsApp without signing in?</span>
            <a
              href="https://wa.me/8801791665634?text=Hello%20Kabir's%20Kitchen!%20I%20have%20an%20inquiry%20about%20my%20order."
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#25D366',
                color: '#fff',
                padding: '9px 18px',
                borderRadius: 10,
                fontSize: '0.8rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(37,211,102,0.3)'
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.187-2.59-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.15.57 4.168 1.564 5.918l-1.657 6.05 6.223-1.632c1.69.924 3.633 1.464 5.71 1.464 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z"/>
              </svg>
              Chat on WhatsApp (01791665634)
            </a>
          </div>
        </section>
        <aside className="chat-auth-visual">
          <div className="chat-auth-visual__content">
            <span className="chat-auth-visual__eyebrow">● We’re online now</span>
            <h2>Real help, right where you are.</h2>
            <p>Talk directly with our kitchen and support team about orders, custom cakes, delivery, and everything in between.</p>
            <div className="chat-auth-visual__messages">
              <div><strong>You</strong>Can I change the delivery time?</div>
              <div><strong>Kabir Support</strong>Absolutely! I can help with that.</div>
              <div><strong>You</strong>Thanks, I’d like to update my order.</div>
            </div>
            <div className="chat-auth-visual__feature"><span>✓ Order support</span><span>✓ Cake guidance</span><span>✓ Secure messages</span></div>
          </div>
        </aside>
      </main>
    );
  }

  return (
    <main className="customer-chat-page">
      <header className="customer-chat-header">
        <button className="workspace-back" onClick={() => setCurrentMode('customer')}><ArrowLeft size={18} /> Back to storefront</button>
        <div className="customer-chat-brand"><span><MessageCircle size={21} /></span><div><strong>Live Support</strong><small>{activeBranch.name} · Online</small></div></div>
        <div className="customer-chat-user"><span>{(authUser?.fullName || authUser?.name || 'C').charAt(0)}</span><div><strong>{authUser?.fullName || authUser?.name || 'Customer'}</strong><small>{authUser?.role || 'Customer'}</small></div><button onClick={signOut}>Sign out</button></div>
      </header>
      <section className="customer-chat-layout">
        <aside className="customer-chat-list">
          <div className="customer-chat-list__head"><div><span className="eyebrow">Your conversations</span><h1>Messages</h1></div><button onClick={createConversation} disabled={isCreating}><Sparkles size={16} /> New chat</button></div>
          <div className="customer-chat-conversations">
            {conversations.map(conversation => (
              <button key={conversation.id} className={selected?.id === conversation.id ? 'active' : ''} onClick={() => setSelectedId(conversation.id)}>
                <span><UserRound size={18} /></span>
                <div><strong>{conversation.subject}</strong><small>{conversation.lastMessage || 'Start your conversation'}</small><em>{new Date(conversation.updatedAtUtc).toLocaleDateString()}</em></div>
                {conversation.unreadCount > 0 && <b>{conversation.unreadCount}</b>}
              </button>
            ))}
          </div>
        </aside>
        <section className="customer-chat-window">
          <header>
            <div><span className="support-agent"><i><Headphones size={17} /></i><div><strong>Support team</strong><small><span /> Online now</small></div></span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <a
                href="https://wa.me/8801791665634?text=Hello%20Kabir's%20Kitchen!%20I%20am%20chatting%20about%20my%20order."
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 11px',
                  borderRadius: 20,
                  background: '#25D366',
                  color: '#fff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textDecoration: 'none'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.187-2.59-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.15.57 4.168 1.564 5.918l-1.657 6.05 6.223-1.632c1.69.924 3.633 1.464 5.71 1.464 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z"/>
                </svg>
                WhatsApp (01791665634)
              </a>
              <span className="chat-secure"><LockKeyhole size={14} /> Private & secure</span>
            </div>
          </header>
          {loading ? <div className="chat-loading">Loading conversations…</div> : selected ? (
            <>
              <div className="customer-chat-messages">
                {visibleMessages.length === 0 && <div className="chat-empty"><span><Bot size={28} /></span><h2>How can we help?</h2><p>Ask about an order, cake, delivery, or anything else.</p></div>}
                {visibleMessages.map(item => {
                  const senderTypeNum = typeof item.senderType === 'string'
                    ? { Customer: 0, Staff: 1, AI: 2 }[item.senderType] ?? 0
                    : item.senderType;
                  const senderClass = senderTypeNum === 1 ? 'staff' : senderTypeNum === 2 ? 'ai' : 'customer';
                  const isCustomer = senderTypeNum === 0;
                  return (
                    <div key={item.id} className={`customer-chat-message customer-chat-message--${senderClass}`}>
                      <span>{isCustomer ? <UserRound size={16} /> : <Headphones size={16} />}</span>
                      <div>
                        <strong>{isCustomer ? (authUser?.fullName || authUser?.name || 'You') : 'Kabir Support'}</strong>
                        <p>{item.text}</p>
                        <small>
                          {new Date(item.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isCustomer && <CheckCheck size={13} />}
                        </small>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form className="customer-chat-composer" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message…" rows="1" />
                <button type="submit" disabled={!message.trim()}><Send size={18} /></button>
              </form>
            </>
          ) : <div className="chat-empty"><span><MessageCircle size={28} /></span><h2>No conversation yet</h2><p>Start a new chat with our support team.</p></div>}
          {error && <div className="chat-error">{error}</div>}
        </section>
      </section>
    </main>
  );
}
