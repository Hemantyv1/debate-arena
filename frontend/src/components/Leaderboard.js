import React, { useState, useEffect } from 'react';
import { getLeaderboard } from '../api';

export default function Leaderboard({ onSelectDebate, onReplayDebate }) {
  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getLeaderboard()
      .then(data => setDebates(Array.isArray(data) ? data : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', padding: '56px 72px' }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <p style={sectionLabel}>ALL TIME</p>
        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800,
          fontSize: 'clamp(48px, 7vw, 96px)',
          textTransform: 'uppercase',
          letterSpacing: '-1px',
          lineHeight: 0.9,
          color: 'var(--text)',
        }}>
          HALL OF<br />
          <span style={{ WebkitTextStroke: '2px var(--red)', color: 'transparent' }}>
            BATTLES
          </span>
        </h1>
      </div>

      {/* Table header */}
      {!loading && !error && debates.length > 0 && (
        <div style={tableHeaderStyle}>
          <span style={{ width: 64, flexShrink: 0 }}>RNK</span>
          <span style={{ flex: 1 }}>TOPIC</span>
          <span style={{ width: 200, textAlign: 'right' }}>VOTES</span>
          <span style={{ width: 120, textAlign: 'right' }}>WINNER</span>
        </div>
      )}

      {loading && (
        <div style={centeredState}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--text-muted)', animation: 'glowPulse 1.5s ease-in-out infinite', letterSpacing: '0.08em' }}>
            LOADING DEBATES...
          </p>
        </div>
      )}

      {error && (
        <div style={{ borderLeft: '4px solid var(--red)', paddingLeft: 16 }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--red)' }}>ERR: {error}</p>
        </div>
      )}

      {!loading && !error && debates.length === 0 && (
        <div style={{ ...centeredState, paddingTop: 80 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(40px, 5vw, 72px)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            WebkitTextStroke: '1px var(--border)',
            color: 'transparent',
            lineHeight: 1,
            animation: 'glowPulse 3s ease-in-out infinite',
          }}>
            NO BATTLES<br />YET
          </div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--border)', marginTop: 24, letterSpacing: '0.05em' }}>
            start a debate and cast your vote
          </p>
        </div>
      )}

      {!loading && !error && debates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {debates.map((debate, index) => (
            <DebateRow
              key={debate.id}
              debate={debate}
              rank={index + 1}
              onSelect={() => onSelectDebate?.(debate.id)}
              onReplay={() => onReplayDebate?.(debate.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DebateRow({ debate, rank, onSelect, onReplay }) {
  const [hovered, setHovered] = useState(false);

  const red = debate.red_votes || 0;
  const blue = debate.blue_votes || 0;
  const total = red + blue;
  const redPct = total ? Math.round((red / total) * 100) : 50;
  const bluePct = 100 - redPct;
  const winner = total ? (red > blue ? 'red' : blue > red ? 'blue' : 'tie') : null;

  const borderColor = rank === 1 ? 'var(--gold)' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : 'var(--border)';
  const rankColor = rank === 1 ? 'var(--gold)' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : 'var(--border)';
  const glowColor = rank === 1 ? 'rgba(245,197,24,0.15)' : rank === 2 ? 'rgba(192,192,192,0.1)' : rank === 3 ? 'rgba(205,127,50,0.1)' : 'transparent';

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        borderLeft: `4px solid ${hovered ? borderColor : rank <= 3 ? borderColor : 'var(--border)'}`,
        borderTop: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        background: hovered ? `var(--surface), ${glowColor}` : 'var(--surface)',
        boxShadow: hovered && rank <= 3 ? `inset 0 0 40px ${glowColor}` : 'none',
        transform: hovered ? 'translateX(8px)' : 'translateX(0)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        opacity: 0,
        animation: 'fadeSlideUp 0.4s ease forwards',
        animationDelay: `${rank * 0.06}s`,
        gap: 24,
        cursor: 'pointer',
      }}
    >
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800, fontSize: 40, lineHeight: 1,
        color: rankColor, width: 64, flexShrink: 0,
      }}>
        {String(rank).padStart(2, '0')}
      </span>

      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 20,
        color: 'var(--text)', flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {debate.topic}
      </p>

      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--red)', letterSpacing: '0.1em' }}>
            AX {red}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)' }}>
            {total}
          </span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--blue)', letterSpacing: '0.1em' }}>
            {blue} CI
          </span>
        </div>
        <div style={{ position: 'relative', height: 4, background: 'var(--border)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${redPct}%`, background: 'var(--red)' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${bluePct}%`, background: 'var(--blue)' }} />
        </div>
      </div>

      <span style={{
        width: 80, flexShrink: 0, textAlign: 'right',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 13,
        letterSpacing: '0.15em', textTransform: 'uppercase',
        color: winner === 'red' ? 'var(--red)' : winner === 'blue' ? 'var(--blue)' : 'var(--text-muted)',
      }}>
        {winner === 'red' ? 'AXIOM' : winner === 'blue' ? 'CIPHER' : total ? 'DRAW' : '—'}
      </span>

      <button
        onClick={(e) => { e.stopPropagation(); onReplay?.(); }}
        style={{
          flexShrink: 0,
          padding: '4px 14px',
          background: 'transparent',
          border: '1px solid #4A9EFF',
          color: '#4A9EFF',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700, fontSize: 11,
          letterSpacing: '0.15em', textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#4A9EFF'; e.currentTarget.style.color = '#000'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4A9EFF'; }}
      >
        REPLAY
      </button>
    </div>
  );
}

const sectionLabel = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700, fontSize: 11,
  letterSpacing: '0.25em', textTransform: 'uppercase',
  color: 'var(--text-muted)', marginBottom: 12,
};

const tableHeaderStyle = {
  display: 'flex', alignItems: 'center', gap: 24,
  padding: '0 24px 12px',
  borderBottom: '1px solid var(--border)', marginBottom: 4,
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700, fontSize: 11,
  letterSpacing: '0.2em', textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

const centeredState = { textAlign: 'center', paddingTop: 60 };
