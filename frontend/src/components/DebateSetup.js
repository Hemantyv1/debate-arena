import React, { useState, useEffect } from 'react';
import { startDebate, getLeaderboard } from '../api';

const SUGGESTIONS = [
  'Should AI replace human judges in courts?',
  'Is social media doing more harm than good?',
  'Should voting be mandatory?',
  'Is remote work better than office work?',
  'Should billionaires be taxed at 90%?',
  'Is nuclear energy the answer to climate change?',
  'Should gene editing in humans be legal?',
];

export default function DebateSetup({ onStarted, prefillTopic, onClearPrefill }) {
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('quick');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [btnHovered, setBtnHovered] = useState(false);
  const [recentDebates, setRecentDebates] = useState([]);

  useEffect(() => {
    if (prefillTopic) {
      setTopic(prefillTopic);
      onClearPrefill?.();
    }
  }, [prefillTopic, onClearPrefill]);

  useEffect(() => {
    getLeaderboard()
      .then(data => setRecentDebates(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!topic.trim()) { setError('Enter a debate topic.'); return; }
    if (topic.length > 200) { setError('Topic must be 200 characters or fewer.'); return; }
    setLoading(true);
    try {
      const data = await startDebate(topic.trim(), mode);
      onStarted({ ...data, mode });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const charPct = topic.length / 200;
  const charColor = charPct > 0.85 ? 'var(--red)' : charPct > 0.6 ? 'var(--gold)' : 'var(--text-muted)';

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>

      {/* ── Left: Form ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 55, padding: '64px 72px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

        {/* Agent stance cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 52 }}>
          <AgentCard side="axiom" stance="FOR" />
          <AgentCard side="cipher" stance="AGAINST" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <label style={fieldLabelStyle}>TOPIC</label>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Enter a debatable statement or question..."
            maxLength={200}
            rows={3}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${error ? 'var(--red)' : 'var(--border)'}`,
              color: 'var(--text)',
              fontSize: 32,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600,
              padding: '12px 0',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.3,
              transition: 'border-color 0.2s',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12, marginBottom: 32 }}>
            {error
              ? <p style={{ color: 'var(--red)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>{error}</p>
              : <span />}
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 48,
              lineHeight: 1,
              color: charColor,
              transition: 'color 0.3s',
            }}>
              {topic.length}
            </span>
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
            {['quick', 'deep'].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: mode === m ? (m === 'quick' ? 'var(--red)' : 'var(--blue)') : 'var(--surface)',
                  color: mode === m ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${mode === m ? (m === 'quick' ? 'var(--red)' : 'var(--blue)') : 'var(--border)'}`,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700, fontSize: 13,
                  textTransform: 'uppercase', letterSpacing: '0.2em',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {m === 'quick' ? 'QUICK — 2–3 LINES' : 'DEEP — FULL ARG'}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            style={{
              width: '100%',
              height: 72,
              background: loading ? 'var(--surface-2)' : btnHovered ? '#cc0000' : 'var(--red)',
              color: loading ? 'var(--text-muted)' : '#fff',
              border: 'none',
              clipPath: 'polygon(0 0, 100% 0, 97% 100%, 3% 100%)',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 26,
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'INITIALIZING...' : 'START DEBATE'}
          </button>
        </form>

        {/* Quick load chips */}
        <div style={{ marginTop: 32 }}>
          <p style={fieldLabelStyle}>QUICK LOAD</p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {SUGGESTIONS.map(s => (
              <SuggestionChip key={s} label={s} onClick={() => setTopic(s)} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Recent battles ───────────────────────────────────────────── */}
      <div style={{ flex: 45, padding: '64px 56px', background: 'var(--surface)', overflowY: 'auto' }}>
        <p style={fieldLabelStyle}>RECENT BATTLES</p>
        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800, fontSize: 32, color: 'var(--text)',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 32,
        }}>
          LEADERBOARD
        </h2>

        {recentDebates.length === 0 ? (
          <div style={{ paddingTop: 40, textAlign: 'center' }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--border)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              NO BATTLES YET
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentDebates.map((debate, i) => (
              <MiniDebateRow key={debate.id} debate={debate} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ side, stance }) {
  const isAxiom = side === 'axiom';
  return (
    <div style={{
      background: 'var(--surface)',
      borderLeft: `4px solid ${isAxiom ? 'var(--red)' : 'var(--blue)'}`,
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${isAxiom ? 'var(--red)' : 'var(--blue)'}`,
      minHeight: 200,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '24px 0',
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', inset: -20,
          background: isAxiom
            ? 'radial-gradient(circle, rgba(255,51,51,0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(0,153,255,0.12) 0%, transparent 70%)',
          animation: `orbPulse 3s ease-in-out infinite${isAxiom ? '' : ' 1.5s'}`,
          borderRadius: '50%',
        }} />
        {isAxiom ? (
          <svg viewBox="0 0 80 80" width="72" height="72"
            style={{ position: 'relative', zIndex: 1, animation: 'axiomFloat 4s ease-in-out infinite' }}>
            <polygon points="40,4 76,72 4,72" fill="#ff3333" opacity="0.9"/>
            <polygon points="40,20 62,60 18,60" fill="#0a0a0a"/>
          </svg>
        ) : (
          <svg viewBox="0 0 80 80" width="72" height="72"
            style={{ position: 'relative', zIndex: 1, animation: 'cipherSpin 20s linear infinite' }}>
            <rect x="4" y="4" width="72" height="72" fill="none" stroke="#0099ff" strokeWidth="2"/>
            <circle cx="40" cy="40" r="8" fill="#0099ff"/>
            <line x1="40" y1="4" x2="40" y2="32" stroke="#0099ff" strokeWidth="2"/>
            <line x1="40" y1="48" x2="40" y2="76" stroke="#0099ff" strokeWidth="2"/>
            <line x1="4" y1="40" x2="32" y2="40" stroke="#0099ff" strokeWidth="2"/>
            <line x1="48" y1="40" x2="76" y2="40" stroke="#0099ff" strokeWidth="2"/>
            <circle cx="4" cy="4" r="3" fill="#0099ff"/>
            <circle cx="76" cy="4" r="3" fill="#0099ff"/>
            <circle cx="4" cy="76" r="3" fill="#0099ff"/>
            <circle cx="76" cy="76" r="3" fill="#0099ff"/>
          </svg>
        )}
      </div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800, fontSize: 22, letterSpacing: '0.1em',
        color: isAxiom ? 'var(--red)' : 'var(--blue)',
      }}>
        {isAxiom ? 'AXIOM' : 'CIPHER'}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10, letterSpacing: '0.2em',
        color: 'var(--text-muted)', textTransform: 'uppercase',
      }}>
        ARGUES {stance}
      </div>
    </div>
  );
}

function MiniDebateRow({ debate, rank }) {
  const red = debate.red_votes || 0;
  const blue = debate.blue_votes || 0;
  const total = red + blue;
  const redPct = total ? Math.round((red / total) * 100) : 50;
  const bluePct = 100 - redPct;
  const winner = total ? (red > blue ? 'red' : blue > red ? 'blue' : 'tie') : null;

  return (
    <div style={{
      background: 'var(--surface-2)',
      borderLeft: `3px solid ${rank === 1 ? 'var(--gold)' : 'var(--border)'}`,
      padding: '14px 16px',
      opacity: 0,
      animation: 'fadeSlideUp 0.4s ease forwards',
      animationDelay: `${rank * 0.06}s`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <p style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700, fontSize: 15, color: 'var(--text)',
          lineHeight: 1.2, flex: 1, marginRight: 12,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {debate.topic}
        </p>
        {winner && (
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700, fontSize: 10, textTransform: 'uppercase',
            letterSpacing: '0.15em', flexShrink: 0,
            color: winner === 'red' ? 'var(--red)' : winner === 'blue' ? 'var(--blue)' : 'var(--text-muted)',
          }}>
            {winner === 'red' ? 'AXIOM' : winner === 'blue' ? 'CIPHER' : 'DRAW'}
          </span>
        )}
      </div>
      <div style={{ position: 'relative', height: 3, background: 'var(--border)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${redPct}%`, background: 'var(--red)' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${bluePct}%`, background: 'var(--blue)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--red)' }}>AXIOM {red}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--blue)' }}>CIPHER {blue}</span>
      </div>
    </div>
  );
}

function SuggestionChip({ label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        background: 'transparent',
        border: `1px solid ${hovered ? 'var(--red)' : 'var(--border)'}`,
        clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
        color: hovered ? 'var(--text)' : 'var(--text-muted)',
        fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 600, padding: '7px 16px', cursor: 'pointer',
        transition: 'border-color 0.15s, color 0.15s',
        textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

const fieldLabelStyle = {
  display: 'block',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700, fontSize: 11, letterSpacing: '0.25em',
  textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14,
};
