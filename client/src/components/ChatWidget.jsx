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

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy, open]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next = [...msgs, { role: 'user', text: q }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const { data } = await api.post('/chat', { messages: next }, { timeout: 60000 });
      setMsgs([...next, { role: 'assistant', text: data.reply }]);
    } catch (e) {
      setMsgs([...next, { role: 'assistant', error: true, text: e.response?.data?.message || 'Could not reach the assistant.' }]);
    }
    setBusy(false);
  };

  return (
    <>
      {!open && <button className="chat-fab" onClick={() => setOpen(true)} title="Ask Aarogya Assistant">💬</button>}
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div><b>Aarogya Assistant</b><small>AI helper · answers from hospital data</small></div>
            <div>
              {msgs.length > 0 && <button title="Clear" onClick={() => setMsgs([])}>🗑</button>}
              <button onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>
          <div className="chat-body">
            {!msgs.length && (
              <div className="chat-hello">
                <p>Hi {user.name.split(' ')[0]} 👋 Ask me about your hospital data.</p>
                {(SUGGEST[user.role] || []).map((s) => <button key={s} className="chip-btn" onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            {msgs.map((m, i) => <div key={i} className={`bubble ${m.role} ${m.error ? 'error' : ''}`}><Text text={m.text} /></div>)}
            {busy && <div className="bubble assistant typing"><span /><span /><span /></div>}
            <div ref={end} />
          </div>
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question..." maxLength={500} />
            <button className="btn" disabled={busy || !input.trim()}>Send</button>
          </form>
          <div className="chat-note">AI can make mistakes. It supports decisions and never replaces clinical judgement.</div>
        </div>
      )}
    </>
  );
}