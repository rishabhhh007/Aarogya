import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const SUGGEST = {
  doctor: ['Who needs attention first?', "What's my schedule today?", 'Which ward am I on duty this week?', 'Are there free beds?'],
  receptionist: ['Which beds are free?', 'Which doctors have free slots tomorrow?', "Show today's appointments", 'Find patient Shubh'],
  admin: ["Give me today's hospital summary", 'Which wards are almost full?', 'Who needs attention first?', 'Who is on duty today?'],
};

// very small markdown: **bold** and "* " bullets
function Text({ text }) {
  return text.split('\n').map((line, i) => {
    const bullet = /^\s*[*-]\s+/.test(line);
    const body = line.replace(/^\s*[*-]\s+/, '');
    const parts = body.split(/\*\*(.+?)\*\*/g).map((p, n) => (n % 2 ? <b key={n}>{p}</b> : p));
    return <div key={i} className={bullet ? 'bullet' : ''}>{bullet && '• '}{parts}{!line && <br />}</div>;
  });
}

const Svg = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p} />
);

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const wrap = useRef(null);
  const field = useRef(null);
  const body = useRef(null);

  useEffect(() => {
  const el = body.current;
  if (el) el.scrollTop = el.scrollHeight; // scroll only the chat box, never the page
}, [msgs, busy, open]);

  // close on outside click or Escape, focus the bar with Ctrl+K
  useEffect(() => {
    const down = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const key = (e) => {
      if (e.key === 'Escape') { setOpen(false); field.current?.blur(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); field.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, []);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next = [...msgs, { role: 'user', text: q }];
    setMsgs(next); setInput(''); setBusy(true); setOpen(true);
    try {
      const { data } = await api.post('/chat', { messages: next }, { timeout: 60000 });
      setMsgs([...next, { role: 'assistant', text: data.reply }]);
    } catch (e) {
      setMsgs([...next, { role: 'assistant', error: true, text: e.response?.data?.message || 'Could not reach the assistant.' }]);
    }
    setBusy(false);
  };

  return (
    <div className="ask-wrap" ref={wrap}>
      <div className={`ask-bar ${open ? 'open' : ''}`}>
        <form className="ask-in" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <Svg><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></Svg>
          <input ref={field} value={input} onChange={(e) => setInput(e.target.value)} onFocus={() => setOpen(true)}
            placeholder="Ask Aarogya Assistant..." maxLength={500} />
          {!input && <span className="ask-kbd">Ctrl K</span>}
          <button className="ask-send" disabled={busy || !input.trim()} aria-label="Send"><Svg width="16" height="16"><path d="M12 19V5M5 12l7-7 7 7" /></Svg></button>
        </form>
      </div>

      {open && (
        <div className="ask-panel">
          <div className="ask-head">
            <b>{msgs.length ? 'Conversation' : `Try asking, ${user.name.split(' ')[0]}`}</b>
            <div>
              {msgs.length > 0 && <button onClick={() => setMsgs([])}>Clear</button>}
              <button onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
          <div className="chat-body ask-body" ref={body}>
            {!msgs.length && (
              <div className="ask-sugs">
                {(SUGGEST[user.role] || []).map((s) => <button key={s} className="chip-btn" onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            {msgs.map((m, i) => <div key={i} className={`bubble ${m.role} ${m.error ? 'error' : ''}`}><Text text={m.text} /></div>)}
            {busy && <div className="bubble assistant typing"><span /><span /><span /></div>}
            
          </div>
          <div className="chat-note">AI can make mistakes. It supports decisions and never replaces clinical judgement.</div>
        </div>
      )}
    </div>
  );
}