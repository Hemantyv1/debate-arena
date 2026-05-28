import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getTranscript } from '../api';

const CHAR_MS = 18;
const TOTAL_ROUNDS = 3;

export default function ReplayArena({ debateId, onBack }) {
  const [transcript, setTranscript] = useState(null);
  const [error, setError] = useState('');
  const [isDone, setIsDone] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [display, setDisplay] = useState({
    completedRounds: [],
    axiomText: '',
    cipherText: '',
    currentRound: 1,
    activeSide: 'axiom',
  });

  const stateRef = useRef({
    roundIdx: 0,
    side: 'axiom',
    charIdx: 0,
    axiomBuilt: '',
    cipherBuilt: '',
    completedRounds: [],
    speed: 1,
  });
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const transcriptRef = useRef(null);

  useEffect(() => { stateRef.current.speed = speed; }, [speed]);
  useEffect(() => () => {
    mountedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const tick = useCallback(() => {
    if (!mountedRef.current) return;
    const s = stateRef.current;
    const t = transcriptRef.current;
    if (!t) return;

    const round = t.rounds[s.roundIdx];
    if (!round) {
      setIsDone(true);
      return;
    }

    const text = s.side === 'axiom'
      ? (round.axiom_argument || '')
      : (round.cipher_argument || '');

    if (s.charIdx < text.length) {
      s.charIdx++;
      if (s.side === 'axiom') s.axiomBuilt = text.slice(0, s.charIdx);
      else s.cipherBuilt = text.slice(0, s.charIdx);
      setDisplay({
        completedRounds: [...s.completedRounds],
        axiomText: s.axiomBuilt,
        cipherText: s.cipherBuilt,
        currentRound: round.round_number,
        activeSide: s.side,
      });
      timerRef.current = setTimeout(tick, CHAR_MS / s.speed);
    } else if (s.side === 'axiom') {
      s.side = 'cipher';
      s.charIdx = 0;
      s.cipherBuilt = '';
      setDisplay(prev => ({ ...prev, activeSide: 'cipher', cipherText: '' }));
      timerRef.current = setTimeout(tick, CHAR_MS / s.speed);
    } else {
      s.completedRounds = [...s.completedRounds, {
        round_number: round.round_number,
        red: round.axiom_argument || '',
        blue: round.cipher_argument || '',
      }];
      s.roundIdx++;
      s.side = 'axiom';
      s.charIdx = 0;
      s.axiomBuilt = '';
      s.cipherBuilt = '';
      setDisplay({
        completedRounds: [...s.completedRounds],
        axiomText: '',
        cipherText: '',
        currentRound: s.roundIdx < t.rounds.length ? t.rounds[s.roundIdx].round_number : round.round_number,
        activeSide: 'axiom',
      });
      if (s.roundIdx >= t.rounds.length) {
        setIsDone(true);
      } else {
        timerRef.current = setTimeout(tick, 600);
      }
    }
  }, []);

  useEffect(() => {
    getTranscript(debateId)
      .then(t => {
        if (!mountedRef.current) return;
        transcriptRef.current = t;
        setTranscript(t);
        stateRef.current = { roundIdx: 0, side: 'axiom', charIdx: 0, axiomBuilt: '', cipherBuilt: '', completedRounds: [], speed: 1 };
        timerRef.current = setTimeout(tick, 200);
      })
      .catch(err => setError(err.message));
  }, [debateId, tick]);

  if (error) {
    return (
      <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--red)' }}>ERR: {error}</p>
        <button onClick={onBack} style={backBtnStyle}>BACK</button>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.1em', animation: 'glowPulse 1.5s ease-in-out infinite' }}>
          LOADING REPLAY...
        </p>
      </div>
    );
  }

  if (isDone) {
    return (
      <ReplayDone
        transcript={transcript}
        debateId={debateId}
        onBack={onBack}
        onRestart={() => {
          setIsDone(false);
          stateRef.current = { roundIdx: 0, side: 'axiom', charIdx: 0, axiomBuilt: '', cipherBuilt: '', completedRounds: [], speed: stateRef.current.speed };
          setDisplay({ completedRounds: [], axiomText: '', cipherText: '', currentRound: 1, activeSide: 'axiom' });
          timerRef.current = setTimeout(tick, 200);
        }}
      />
    );
  }

  const { completedRounds, axiomText, cipherText, currentRound, activeSide } = display;

  const redChunks = [
    ...completedRounds.map(r => ({ roundNumber: r.round_number, text: r.red, complete: true })),
    ...(axiomText || activeSide === 'axiom' ? [{ roundNumber: currentRound, text: axiomText, complete: false, active: activeSide === 'axiom' }] : []),
  ];
  const blueChunks = [
    ...completedRounds.map(r => ({ roundNumber: r.round_number, text: r.blue, complete: true })),
    { roundNumber: currentRound, text: cipherText, complete: false, active: activeSide === 'cipher', waiting: activeSide === 'axiom' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', position: 'relative' }}>
      {/* Split arena */}
      <div className="split-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ReplayPanel agent="axiom" chunks={redChunks} active={activeSide === 'axiom'} currentRound={currentRound} />
        <ReplayCenterDivider completedRounds={completedRounds} currentRound={currentRound} total={TOTAL_ROUNDS} />
        <ReplayPanel agent="cipher" chunks={blueChunks} active={activeSide === 'cipher'} currentRound={currentRound} />
      </div>

      {/* Replay controls bar */}
      <div style={{
        height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 32px', gap: 24,
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {transcript.topic}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#4A9EFF', letterSpacing: '0.18em', textTransform: 'uppercase', border: '1px solid #4A9EFF', padding: '2px 8px' }}>
            REPLAYING
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>SPEED</span>
          {[1, 2, 4].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                padding: '3px 10px',
                background: speed === s ? 'var(--text)' : 'transparent',
                color: speed === s ? 'var(--bg)' : 'var(--text-muted)',
                border: `1px solid ${speed === s ? 'var(--text)' : 'var(--border)'}`,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, cursor: 'pointer',
                letterSpacing: '0.05em',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {s}x
            </button>
          ))}
        </div>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.1em', flexShrink: 0 }}>
          RND {currentRound} / {TOTAL_ROUNDS}
        </span>
      </div>
    </div>
  );
}

// ── Replay sub-components ─────────────────────────────────────────────────────

function ReplayPanel({ agent, chunks, active, currentRound }) {
  const isAxiom = agent === 'axiom';
  const accent = isAxiom ? 'var(--red)' : 'var(--blue)';
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      borderTop: `4px solid ${accent}`,
      borderRight: isAxiom ? '1px solid var(--border)' : 'none',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 44, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
          {isAxiom ? 'AXIOM' : 'CIPHER'}
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.25em', color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase' }}>
          ARGUES {isAxiom ? 'FOR' : 'AGAINST'}
        </div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {chunks.map((chunk, i) => (
          <ReplayArgEntry key={`${chunk.roundNumber}-${i}`} chunk={chunk} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function ReplayArgEntry({ chunk, accent }) {
  const showCursor = chunk.active && chunk.text;
  const showStandby = chunk.waiting && !chunk.text;
  const html = window.marked?.parse(chunk.text || '') || chunk.text || '';

  return (
    <div style={{ marginBottom: 28, opacity: 0, animation: 'fadeSlideUp 0.4s ease forwards' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10, borderLeft: `2px solid ${accent}`, paddingLeft: 8 }}>
        ROUND {chunk.roundNumber}
      </div>
      {showStandby ? (
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>STANDBY...</p>
      ) : (
        <div style={{ position: 'relative' }}>
          <div className="md-content" dangerouslySetInnerHTML={{ __html: html }} />
          {showCursor && (
            <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--text-muted)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />
          )}
        </div>
      )}
    </div>
  );
}

function ReplayCenterDivider({ completedRounds, currentRound, total }) {
  return (
    <div style={{
      width: 56, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      borderLeft: '1px solid var(--border)',
      borderRight: '1px solid var(--border)',
      gap: 16,
    }}>
      <div style={{ width: 38, height: 38, border: '2px solid var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg)' }}>
        VS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        {Array.from({ length: total }, (_, i) => i + 1).map(r => {
          const done = completedRounds.some(c => c.round_number === r);
          const active = currentRound === r && !done;
          return (
            <div key={r} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: 4, height: 28,
                background: done ? 'linear-gradient(180deg, var(--red), var(--blue))' : active ? 'var(--red)' : 'var(--border)',
                animation: active ? 'glowPulse 1.5s ease-in-out infinite' : 'none',
                transition: 'background 0.4s',
              }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.1em', color: active ? 'var(--text)' : done ? 'var(--text-muted)' : 'var(--border)' }}>
                R{r}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReplayDone({ transcript, debateId, onBack, onRestart }) {
  const total = (transcript.red_votes || 0) + (transcript.blue_votes || 0);
  const winner = total ? (transcript.red_votes > transcript.blue_votes ? 'red' : transcript.blue_votes > transcript.red_votes ? 'blue' : 'tie') : null;
  const redPct = total ? Math.round((transcript.red_votes / total) * 100) : 50;
  const bluePct = 100 - redPct;

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', padding: '48px 72px 80px' }}>
      <button onClick={onBack} style={backBtnStyle}>BACK TO LEADERBOARD</button>

      <div style={{ marginBottom: 48, marginTop: 32 }}>
        <p style={labelStyle}>REPLAY COMPLETE</p>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 'clamp(32px, 5vw, 64px)', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 12 }}>
          {transcript.topic}
        </h1>
      </div>

      {total > 0 && (
        <div style={{ marginBottom: 48 }}>
          <p style={labelStyle}>ORIGINAL VOTE RESULT</p>
          <div style={{ display: 'flex', gap: 32, marginTop: 20, maxWidth: 600 }}>
            <ResultBar label="AXIOM" pct={redPct} votes={transcript.red_votes} color="var(--red)" isWinner={winner === 'red'} />
            <ResultBar label="CIPHER" pct={bluePct} votes={transcript.blue_votes} color="var(--blue)" isWinner={winner === 'blue'} />
          </div>
          {winner && winner !== 'tie' && (
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', border: '2px solid var(--gold)', padding: '12px 32px', marginTop: 28, animation: 'winnerExpand 0.5s ease forwards' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: 4 }}>WINNER</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 32, letterSpacing: '0.1em', color: 'var(--gold)' }}>
                {winner === 'red' ? 'AXIOM' : 'CIPHER'}
              </span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onRestart} style={actionBtnStyle}>REPLAY AGAIN</button>
        <a
          href={`#debate/${debateId}`}
          style={{ ...actionBtnStyle, textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}
          onClick={() => window.location.hash = `debate/${debateId}`}
        >
          WATCH LIVE
        </a>
      </div>
    </div>
  );
}

function ResultBar({ label, pct, votes, color, isWinner }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color, letterSpacing: '0.1em' }}>
          {label} {isWinner ? '*' : ''}
        </span>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, color, lineHeight: 1 }}>{pct}%</span>
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
  background: 'none', border: 'none', color: 'var(--text-muted)',
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13,
  letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', padding: 0,
};

const labelStyle = {
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11,
  letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12,
};

const actionBtnStyle = {
  padding: '12px 32px',
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)',
  clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14,
  textTransform: 'uppercase', letterSpacing: '0.2em', cursor: 'pointer',
};
