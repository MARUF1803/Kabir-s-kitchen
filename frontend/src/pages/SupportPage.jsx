import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, Headphones, MessageCircle, Plus, Search, Send, Sparkles, Tag, UserRound } from 'lucide-react';
import { useApp } from '../context/useApp';

const initialTickets = [
  { id: 1, number: '#KK-1042', customer: 'Rashid Alam', subject: 'Cake delivery was delayed', priority: 'High', status: 'Open', channel: 'WhatsApp', updated: '5 min ago', preview: 'The cake was supposed to arrive by 4 PM...' },
  { id: 2, number: '#KK-1041', customer: 'Nabila Karim', subject: 'Extra chicken request', priority: 'Normal', status: 'Pending', channel: 'Call', updated: '18 min ago', preview: 'I added extra chicken to my order...' },
  { id: 3, number: '#KK-1039', customer: 'Shafiq Rahman', subject: 'Refund request', priority: 'Medium', status: 'Resolved', channel: 'Chat', updated: '1 hr ago', preview: 'Please confirm the payment refund...' }
];

export default function SupportPage() {
  const { setCurrentMode } = useApp();
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedId, setSelectedId] = useState(1);
  const [query, setQuery] = useState('');
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState('All');
  const selected = useMemo(() => tickets.find(ticket => ticket.id === selectedId) || tickets[0], [tickets, selectedId]);
  const visible = tickets.filter(ticket => (filter === 'All' || ticket.status === filter) && `${ticket.customer} ${ticket.subject}`.toLowerCase().includes(query.toLowerCase()));

  const sendReply = () => {
    if (!reply.trim()) return;
    setTickets(prev => prev.map(ticket => ticket.id === selectedId ? { ...ticket, status: 'Pending', updated: 'Just now', preview: reply } : ticket));
    setReply('');
  };

  return (
    <main className="workspace-page workspace-page--support">
      <header className="workspace-header">
        <button className="workspace-back" onClick={() => setCurrentMode('customer')}><ArrowLeft size={18} /> Back to storefront</button>
        <div><span className="eyebrow">Customer care</span><h1>Support Center</h1></div>
        <div className="support-agent"><span>AK</span><div><strong>Arif Khan</strong><small>Support Agent</small></div><span className="status-dot" /></div>
      </header>
      <section className="support-stats"><article><span><Headphones size={20} /></span><div><small>Open tickets</small><strong>{tickets.filter(t => t.status !== 'Resolved').length}</strong></div></article><article><span><MessageCircle size={20} /></span><div><small>Avg. response</small><strong>4m 12s</strong></div></article><article><span><Sparkles size={20} /></span><div><small>Satisfaction</small><strong>98.2%</strong></div></article></section>
      <section className="support-layout">
        <aside className="support-list"><div className="support-search"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search conversations" /></div><div className="support-filters">{['All', 'Open', 'Pending', 'Resolved'].map(item => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="support-tickets">{visible.map(ticket => <button key={ticket.id} className={selectedId === ticket.id ? 'active' : ''} onClick={() => setSelectedId(ticket.id)}><div className="support-ticket__avatar">{ticket.customer.charAt(0)}</div><span><strong>{ticket.customer}</strong><small>{ticket.subject}</small><em>{ticket.updated}</em></span><i className={`priority-${ticket.priority.toLowerCase()}`}>{ticket.priority}</i></button>)}</div><button className="new-ticket"><Plus size={17} /> New ticket</button></aside>
        <section className="support-conversation"><div className="support-conversation__head"><div><span className="eyebrow">Conversation</span><h2>{selected.subject}</h2><p>{selected.number} · {selected.channel} · {selected.customer}</p></div><span className={`support-status support-status--${selected.status.toLowerCase()}`}>{selected.status}</span></div><div className="support-messages"><div className="message message--customer"><span><UserRound size={16} /></span><div><strong>{selected.customer}</strong><small>{selected.updated}</small><p>{selected.preview}</p></div></div><div className="message message--agent"><span><Tag size={16} /></span><div><strong>Arif Khan</strong><small>Just now</small><p>Thanks for reaching out. I’m checking this request now and will update you shortly.</p></div></div></div><div className="support-reply"><textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a response..." /><div><span>Replying as support agent</span><button onClick={sendReply} disabled={!reply.trim()}><Send size={16} /> Send reply</button></div></div><div className="support-resolve"><button onClick={() => setTickets(prev => prev.map(ticket => ticket.id === selectedId ? { ...ticket, status: 'Resolved' } : ticket))}><CheckCircle2 size={16} /> Resolve ticket</button><button>View order <ChevronRight size={16} /></button></div></section>
      </section>
    </main>
  );
}
