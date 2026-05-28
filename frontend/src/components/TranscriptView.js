import React, { useState, useEffect } from 'react';
import { getDebate } from '../api';

export default function TranscriptView({ debateId, onSimilarDebate, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDebate(debateId)
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [debateId]);

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.1em', animation: 'glowPulse 1.5s ease-in-out infinite' }}>
          LOADING TRANSCRIPT...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--red)' }}>ERR: {error}</p>
        <button onClick={onBack} style={backBtnStyle}>← BACK</button>
      </div>
    );
  }

  const { debate, rounds } = data;
  const total = (debate.red_votes || 0) + (debate.blue_votes || 0);
  const winner = total
    ? (debate.red_votes > debate.blue_votes ? 'red' : debate.blue_votes > debate.red_votes ? 'blue' : 'tie')
    : null;

  const createdAt = new Date(debate.created_at);
  const dateStr = createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', padding: '48px 72px 80px' }}>

      {/* Back */}
      <button onClick={onBack} style={backBtnStyle}>← BACK TO LEADERBOARD</button>

      {/* Header */}
      <div style={{ marginBottom: 56, marginTop: 32 }}>
        <p style={labelStyle}>DEBATE TRANSCRIPT</p>
        <h1 style={topicStyle}>{debate.topic}</h1>
        <p style={metaStyle}>{dateStr} AT {timeStr}</p>
      </div>

      {/* Rounds */}
      {(rounds || []).map(r => (
        <RoundTranscript key={r.round_number} round={r} />
      ))}

      {/* Results */}
      {total > 0 && (
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
          <p style={labelStyle}>FINAL RESULT</p>
          <div style={{ display: 'flex', gap: 32, marginTop: 20 }}>
            <VoteBar
              label="AXIOM"
              votes={debate.red_votes || 0}
              total={total}
              color="var(--red)"
              isWinner={winner === 'red'}
            />
            <VoteBar
              label="CIPHER"
              votes={debate.blue_votes || 0}
              total={total}
              color="var(--blue)"
              isWinner={winner === 'blue'}
            />
          </div>
          {winner && winner !== 'tie' && (
            <div style={{
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
              border: '2px solid var(--gold)', padding: '12px 32px', marginTop: 32,
              animation: 'winnerExpand 0.5s ease forwards',
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: 4 }}>
                WINNER
              </span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 32, letterSpacing: '0.1em', color: 'var(--gold)' }}>
                {winner === 'red' ? 'AXIOM' : 'CIPHER'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Similar debate */}
      <button onClick={() => onSimilarDebate(debate.topic)} style={similarBtnStyle}>
        START SIMILAR DEBATE
      </button>
    </div>
  );
}

function RoundTranscript({ round }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-muted)', flexShrink: 0 }}>
          ROUND {round.round_number}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ArgumentCard agent="AXIOM" color="var(--red)" text={round.red_argument} />
        <ArgumentCard agent="CIPHER" color="var(--blue)" text={round.blue_argument} />
      </div>
    </div>
  );
}

function ArgumentCard({ agent, color, text }) {
  return (
    <div style={{
      borderLeft: `3px solid ${color}`,
      padding: '20px 24px',
      background: 'var(--surface)',
      animation: 'fadeSlideUp 0.4s ease forwards',
    }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800, fontSize: 13, letterSpacing: '0.2em',
        color, marginBottom: 12,
      }}>
        {agent}
      </div>
      <p style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13, lineHeight: 1.85,
        color: 'var(--text)', margin: 0,
      }}>
        {text || '—'}
      </p>
    </div>
  );
}

function VoteBar({ label, votes, total, color, isWinner }) {
  const pct = total ? Math.round((votes / total) * 100) : 0;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color, letterSpacing: '0.1em' }}>
          {label} {isWinner ? '★' : ''}
        </span>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, color, lineHeight: 1 }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--border)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 1s ease' }} />
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
        {votes} vote{votes !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

const backBtnStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700, fontSize: 13,
  letterSpacing: '0.15em', textTransform: 'uppercase',
  cursor: 'pointer', padding: 0,
  transition: 'color 0.15s',
};

const labelStyle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700, fontSize: 11,
  letterSpacing: '0.25em', textTransform: 'uppercase',
  color: 'var(--text-muted)', marginBottom: 12,
};

const topicStyle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 800,
  fontSize: 'clamp(32px, 5vw, 64px)',
  color: 'var(--text)',
  textTransform: 'uppercase',
  letterSpacing: '-0.5px',
  lineHeight: 1,
  marginBottom: 12,
};

const metaStyle = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em',
};

const similarBtnStyle = {
  marginTop: 48,
  display: 'block',
  padding: '14px 40px',
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700, fontSize: 15,
  textTransform: 'uppercase', letterSpacing: '0.2em',
  cursor: 'pointer',
};
