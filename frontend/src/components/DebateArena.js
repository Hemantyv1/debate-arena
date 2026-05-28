import React, { useState, useEffect, useRef, useCallback } from 'react';
import { openRoundStream, vote, postReaction, BASE, joinSpectators, leaveSpectators, getSpectators, postRoundVote, getRoundVotes } from '../api';
import { speakAs } from '../utils/agentVoices';

const TOTAL_ROUNDS = 3;
const MOODS = { 1: 'OPENING', 2: 'ESCALATING', 3: 'CLOSING ARG.' };
const CONFETTI_COLORS = ['var(--gold)', 'var(--red)', 'var(--blue)', '#ffffff', '#a78bfa', '#34d399'];
const CONFETTI_ANIMS = ['confetti1', 'confetti2', 'confetti3', 'confetti4', 'confetti5'];

const TRASH_TALK = [
  { axiom: "That argument had the structural integrity of wet paper.", cipher: "Emotional rhetoric dressed as logic. Predictable." },
  { axiom: "Is that all you've got? I've seen stronger arguments from a fortune cookie.", cipher: "Your certainty is inversely proportional to your evidence." },
  { axiom: "You're defending a position that collapses under the slightest scrutiny.", cipher: "Confidence without substance. The classic AXIOM special." },
];

function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch (_) {}
}

function playCheer() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = ctx.sampleRate * 0.8;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 0.5) * 0.3;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
  } catch (_) {}
}

export default function DebateArena({ debateId, topic, mode, onNewDebate, soundEnabled }) {
  const [rounds, setRounds] = useState([]);
  const [streamingRound, setStreamingRound] = useState(null);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [votes, setVotes] = useState({ red: 0, blue: 0 });
  const [votedFor, setVotedFor] = useState(null);
  const [roundIntro, setRoundIntro] = useState(null);
  const [countdownNum, setCountdownNum] = useState(null);
  const [shareMsg, setShareMsg] = useState('');
  const [trashTalkPair, setTrashTalkPair] = useState(null);
  const [trashTalkDone, setTrashTalkDone] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(null);
  const [roundVotes, setRoundVotes] = useState([]);
  const [votedRounds, setVotedRounds] = useState(() => {
    try {
      const s = sessionStorage.getItem(`voted_${debateId}`);
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch { return new Set(); }
  });

  const esRef = useRef(null);
  const axiomScrollRef = useRef(null);
  const cipherScrollRef = useRef(null);
  const mountedRef = useRef(true);
  const introTimeoutRef = useRef(null);
  const verdictTimeoutRef = useRef(null);
  const soundEnabledRef = useRef(soundEnabled);
  const redArgRef = useRef('');

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (!soundEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
  }, [soundEnabled]);

  // Spectator join/leave
  useEffect(() => {
    joinSpectators(debateId).then(d => { if (mountedRef.current) setSpectatorCount(d.count); }).catch(() => {});
    const beaconUrl = `${BASE}/api/debate/${debateId}/spectators/leave`;
    const onUnload = () => navigator.sendBeacon(beaconUrl);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      leaveSpectators(debateId).catch(() => {});
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [debateId]);

  // Spectator polling (5s)
  useEffect(() => {
    const iv = setInterval(() => {
      if (mountedRef.current) getSpectators(debateId).then(d => setSpectatorCount(d.count)).catch(() => {});
    }, 5000);
    return () => clearInterval(iv);
  }, [debateId]);

  // Round votes polling (10s)
  useEffect(() => {
    const fetch = () => { if (mountedRef.current) getRoundVotes(debateId).then(setRoundVotes).catch(() => {}); };
    fetch();
    const iv = setInterval(fetch, 10000);
    return () => clearInterval(iv);
  }, [debateId]);

  // Trash talk timing: show for 3s then reveal round button
  useEffect(() => {
    if (status === 'between') {
      setTrashTalkPair(TRASH_TALK[Math.floor(Math.random() * TRASH_TALK.length)]);
      setTrashTalkDone(false);
      const t = setTimeout(() => { if (mountedRef.current) setTrashTalkDone(true); }, 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const scrollPanels = () => {
    if (axiomScrollRef.current) axiomScrollRef.current.scrollTop = axiomScrollRef.current.scrollHeight;
    if (cipherScrollRef.current) cipherScrollRef.current.scrollTop = cipherScrollRef.current.scrollHeight;
  };

  const handleRoundVote = useCallback(async (roundNumber, agent) => {
    if (votedRounds.has(roundNumber)) return;
    try {
      await postRoundVote(debateId, roundNumber, agent);
      const next = new Set(votedRounds);
      next.add(roundNumber);
      sessionStorage.setItem(`voted_${debateId}`, JSON.stringify([...next]));
      setVotedRounds(next);
      getRoundVotes(debateId).then(setRoundVotes).catch(() => {});
    } catch (_) {}
  }, [debateId, votedRounds]);

  const runRound = useCallback((roundNumber) => {
    if (esRef.current) esRef.current.close();
    clearTimeout(introTimeoutRef.current);
    redArgRef.current = '';
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    setRoundIntro(roundNumber);
    setStatus('intro');
    setStreamingRound({ round: roundNumber, side: null, red: '', blue: '' });
    setCountdownNum(null);

    introTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setRoundIntro(null);
      setStatus('streaming');

      const es = openRoundStream(debateId, roundNumber);
      esRef.current = es;

      es.addEventListener('side', (e) => {
        const { side } = JSON.parse(e.data);
        setStreamingRound(prev => ({ ...prev, side }));
        if (side === 'blue') {
          setCountdownNum(null);
          setStatus('streaming');
        }
      });

      es.addEventListener('countdown', (e) => {
        const { count } = JSON.parse(e.data);
        setCountdownNum(count);
        setStatus('countdown');
        if (count === 3 && soundEnabledRef.current) speakAs('AXIOM', redArgRef.current);
      });

      es.addEventListener('chunk', (e) => {
        const { side, text } = JSON.parse(e.data);
        if (side === 'red') redArgRef.current += text;
        setStreamingRound(prev => ({ ...prev, [side]: (prev[side] || '') + text }));
        scrollPanels();
      });

      es.addEventListener('done', (e) => {
        const { red, blue } = JSON.parse(e.data);
        es.close();
        esRef.current = null;
        setRounds(prev => {
          const next = [...prev];
          next[roundNumber - 1] = { red, blue };
          return next;
        });
        setStreamingRound(null);
        setCountdownNum(null);

        if (soundEnabledRef.current) {
          playDing();
          speakAs('CIPHER', blue);
        }

        if (roundNumber === TOTAL_ROUNDS) {
          setStatus('verdict');
          verdictTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) setStatus('voting');
          }, 1800);
        } else {
          setStatus('between');
        }
        scrollPanels();
      });

      es.addEventListener('error', (e) => {
        es.close();
        esRef.current = null;
        const msg = e.data ? JSON.parse(e.data).message : 'Stream disconnected.';
        setErrorMsg(msg);
        setStatus('error');
      });
    }, 1500);
  }, [debateId]);

  useEffect(() => {
    runRound(1);
    return () => {
      esRef.current?.close();
      clearTimeout(introTimeoutRef.current);
      clearTimeout(verdictTimeoutRef.current);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [runRound]);

  const nextRound = rounds.length + 1;
  const currentRound = streamingRound?.round || (rounds.length > 0 ? rounds.length : 1);

  // Space bar to advance round
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === 'Space' && status === 'between') {
        e.preventDefault();
        runRound(nextRound);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [status, nextRound, runRound]);

  const handleVote = async (agent) => {
    try {
      const data = await vote(debateId, agent);
      setVotes({ red: data.red_votes, blue: data.blue_votes });
      setVotedFor(agent);
      setStatus('voted');
      if (soundEnabledRef.current) playCheer();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleShare = () => {
    window.location.hash = `debate/${debateId}`;
    navigator.clipboard.writeText(window.location.href)
      .then(() => setShareMsg('COPIED!'))
      .catch(() => setShareMsg('COPY FAILED'));
    setTimeout(() => setShareMsg(''), 2500);
  };

  if (status === 'verdict') {
    return <VerdictFlash />;
  }

  if (status === 'voting' || status === 'voted') {
    const lastRound = rounds[TOTAL_ROUNDS - 1] || {};
    return (
      <VotingSection
        voted={status === 'voted'}
        votedFor={votedFor}
        votes={votes}
        onVote={handleVote}
        onNewDebate={onNewDebate}
        axiomExcerpt={lastRound.red}
        cipherExcerpt={lastRound.blue}
      />
    );
  }

  // Derive thinking state: side is set but no text yet
  const axiomThinking = (status === 'streaming') && streamingRound?.side === 'red' && !streamingRound.red;
  const cipherThinking = (status === 'streaming') && streamingRound?.side === 'blue' && !streamingRound.blue;

  const redChunks = [];
  const blueChunks = [];

  rounds.forEach((r, i) => {
    if (r) {
      redChunks.push({ roundNumber: i + 1, text: r.red, complete: true });
      blueChunks.push({ roundNumber: i + 1, text: r.blue, complete: true });
    }
  });
  if (streamingRound) {
    const rn = streamingRound.round;
    redChunks.push({ roundNumber: rn, text: streamingRound.red, complete: false, active: streamingRound.side === 'red' });
    blueChunks.push({ roundNumber: rn, text: streamingRound.blue, complete: false, active: streamingRound.side === 'blue', waiting: streamingRound.side === 'red' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', position: 'relative' }}>

      {/* Round intro overlay */}
      {roundIntro && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          animation: 'roundFlash 1.5s ease forwards',
          pointerEvents: 'none',
        }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.4em', color: 'var(--text-muted)', marginBottom: 16 }}>
            BEGINNING
          </p>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(80px, 15vw, 160px)',
            letterSpacing: '-3px', lineHeight: 0.9,
            color: 'transparent',
            WebkitTextStroke: '3px var(--red)',
            textAlign: 'center',
          }}>
            ROUND {roundIntro}
          </div>
        </div>
      )}

      {/* Countdown overlay */}
      {countdownNum !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 45,
          background: 'rgba(8,8,8,0.92)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.3em', color: 'var(--blue)', marginBottom: 16 }}>
            CIPHER RESPONDS IN
          </p>
          <div
            key={countdownNum}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800, fontSize: 200, lineHeight: 1,
              color: 'var(--blue)',
              animation: 'countdownPulse 1s ease',
            }}
          >
            {countdownNum}
          </div>
        </div>
      )}

      {/* Trash talk overlay (between rounds) */}
      {status === 'between' && !trashTalkDone && trashTalkPair && (
        <TrashTalkOverlay pair={trashTalkPair} />
      )}

      {/* Split arena */}
      <div className="split-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <AgentPanel
          agent="axiom"
          chunks={redChunks}
          scrollRef={axiomScrollRef}
          active={streamingRound?.side === 'red'}
          currentRound={currentRound}
          thinking={axiomThinking}
          debateId={debateId}
        />
        <CenterDivider rounds={rounds} streamingRound={streamingRound} />
        <AgentPanel
          agent="cipher"
          chunks={blueChunks}
          scrollRef={cipherScrollRef}
          active={streamingRound?.side === 'blue'}
          currentRound={currentRound}
          thinking={cipherThinking}
          debateId={debateId}
        />
      </div>

      {/* Per-round vote rows */}
      {rounds.map((r, i) => r && (
        <RoundVoteRow
          key={i + 1}
          roundNumber={i + 1}
          votes={roundVotes.find(v => v.round === i + 1)}
          hasVoted={votedRounds.has(i + 1)}
          onVote={handleRoundVote}
        />
      ))}

      {/* Bottom bar */}
      <BottomBar
        topic={topic}
        status={status}
        currentRound={currentRound}
        nextRound={nextRound}
        onNextRound={() => runRound(nextRound)}
        errorMsg={errorMsg}
        onRetry={() => runRound(rounds.length + 1)}
        showShare={rounds.length >= 1}
        onShare={handleShare}
        shareMsg={shareMsg}
        spectatorCount={spectatorCount}
      />
    </div>
  );
}

// ── Agent SVG Avatars ────────────────────────────────────────────────────────

function AxiomAvatar() {
  return (
    <svg width="40" height="40" viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0 }}>
      <polygon points="22,2 42,41 2,41" stroke="var(--red)" strokeWidth="2.5"/>
      <polygon points="22,13 35,38 9,38" fill="var(--red)" opacity="0.2"/>
      <line x1="22" y1="2" x2="22" y2="41" stroke="var(--red)" strokeWidth="1" opacity="0.5"/>
    </svg>
  );
}

function CipherAvatar() {
  return (
    <svg width="40" height="40" viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0 }}>
      <rect x="4" y="4" width="36" height="36" stroke="var(--blue)" strokeWidth="2"/>
      <line x1="4" y1="22" x2="40" y2="22" stroke="var(--blue)" strokeWidth="1" opacity="0.6"/>
      <line x1="22" y1="4" x2="22" y2="40" stroke="var(--blue)" strokeWidth="1" opacity="0.6"/>
      <circle cx="22" cy="22" r="5" fill="var(--blue)" opacity="0.35"/>
      <circle cx="4" cy="4" r="2" fill="var(--blue)"/>
      <circle cx="40" cy="4" r="2" fill="var(--blue)"/>
      <circle cx="4" cy="40" r="2" fill="var(--blue)"/>
      <circle cx="40" cy="40" r="2" fill="var(--blue)"/>
    </svg>
  );
}

// ── Agent Panel ──────────────────────────────────────────────────────────────

function AgentPanel({ agent, chunks, scrollRef, active, currentRound, thinking, debateId }) {
  const isAxiom = agent === 'axiom';
  const agentSide = isAxiom ? 'red' : 'blue';
  const accent = isAxiom ? 'var(--red)' : 'var(--blue)';
  const borderAnim = isAxiom
    ? 'topBorderPulseRed 1.5s ease-in-out infinite'
    : 'topBorderPulseBlue 1.5s ease-in-out infinite';
  const bgAnim = isAxiom
    ? 'bgPulseRed 1.5s ease-in-out infinite'
    : 'bgPulseBlue 1.5s ease-in-out infinite';

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      borderTop: `4px solid ${accent}`,
      borderRight: isAxiom ? '1px solid var(--border)' : 'none',
      animation: active ? `${borderAnim}, ${bgAnim}` : 'none',
      transition: 'background 0.3s',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {isAxiom ? <AxiomAvatar /> : <CipherAvatar />}
          <div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800, fontSize: 44, color: accent,
              textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1,
            }}>
              {isAxiom ? 'AXIOM' : 'CIPHER'}
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, fontSize: 11, letterSpacing: '0.25em',
              color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase',
            }}>
              ARGUES {isAxiom ? 'FOR' : 'AGAINST'} &nbsp;·&nbsp;
              <span style={{ color: active ? accent : 'var(--text-muted)', transition: 'color 0.3s' }}>
                {MOODS[currentRound] || 'READY'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable arguments */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {chunks.map((chunk, i) => (
          <ArgumentEntry key={`${chunk.roundNumber}-${i}`} chunk={chunk} accent={accent} debateId={debateId} agentSide={agentSide} />
        ))}
        {thinking && <ThinkingIndicator accent={accent} />}
      </div>
    </div>
  );
}

function ThinkingIndicator({ accent }) {
  return (
    <div style={{ marginBottom: 28, animation: 'fadeSlideUp 0.3s ease forwards' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 5, height: 5, borderRadius: '50%',
            background: accent, display: 'inline-block',
            animation: `glowPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11, letterSpacing: '0.1em',
          color: accent, marginLeft: 4,
        }}>
          CONSTRUCTING ARGUMENT...
        </span>
      </div>
    </div>
  );
}

function ArgumentEntry({ chunk, accent, debateId, agentSide }) {
  const showCursor = chunk.active && chunk.text;
  const showStandby = chunk.waiting && !chunk.text;
  const isStreaming = chunk.active || chunk.waiting;

  const renderText = () => {
    if (showStandby) return null;
    const html = window.marked?.parse(chunk.text || '') || chunk.text || '';
    return (
      <div
        className="md-content"
        style={{ position: 'relative' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <div style={{ marginBottom: 28, opacity: 0, animation: 'fadeSlideUp 0.4s ease forwards' }}>
      {/* Strength meter (F5) */}
      <div style={{ height: 3, background: 'var(--border)', marginBottom: 10, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          background: accent,
          boxShadow: isStreaming ? `0 0 8px ${accent}` : 'none',
          width: chunk.complete ? '100%' : isStreaming ? undefined : '0%',
          animation: chunk.active ? 'fillBar 15s linear forwards' : 'none',
          transition: chunk.complete ? 'width 0.5s ease' : 'none',
        }} />
      </div>

      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 10, letterSpacing: '0.25em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10,
        borderLeft: `2px solid ${accent}`, paddingLeft: 8,
      }}>
        ROUND {chunk.roundNumber}
      </div>

      {showStandby ? (
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          STANDBY...
        </p>
      ) : (
        <div style={{ position: 'relative' }}>
          {renderText()}
          {showCursor && (
            <span style={{
              display: 'inline-block', width: 8, height: 14,
              background: 'var(--text-muted)', marginLeft: 2,
              verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite',
            }} />
          )}
        </div>
      )}

      {/* Reaction bar — shown only after argument is fully complete (F4) */}
      {chunk.complete && debateId && (
        <ReactionBar debateId={debateId} roundNumber={chunk.roundNumber} agent={agentSide} accent={accent} />
      )}
    </div>
  );
}

// ── Reaction Bar (F4) ────────────────────────────────────────────────────────

const EMOJIS = ['🔥', '💀', '🤯', '👏'];

function ReactionBar({ debateId, roundNumber, agent, accent }) {
  const [counts, setCounts] = useState({ '🔥': 0, '💀': 0, '🤯': 0, '👏': 0 });
  const [bumped, setBumped] = useState(null);

  const handleReact = (emoji) => {
    setCounts(prev => ({ ...prev, [emoji]: prev[emoji] + 1 }));
    setBumped(emoji);
    setTimeout(() => setBumped(null), 400);
    postReaction(debateId, roundNumber, agent, emoji).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 12, opacity: 0, animation: 'fadeSlideUp 0.3s ease 0.2s forwards' }}>
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => handleReact(emoji)}
          style={{
            background: 'var(--surface-2)',
            border: `1px solid ${counts[emoji] > 0 ? accent : 'var(--border)'}`,
            borderRadius: 0,
            padding: '3px 8px',
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: counts[emoji] > 0 ? accent : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 4,
            transform: bumped === emoji ? 'scale(1.25)' : 'scale(1)',
            transition: 'transform 0.15s ease, border-color 0.15s, color 0.15s',
          }}
        >
          <span>{emoji}</span>
          {counts[emoji] > 0 && <span>{counts[emoji]}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Center Divider ───────────────────────────────────────────────────────────

function CenterDivider({ rounds, streamingRound }) {
  return (
    <div style={{
      width: 56, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      borderLeft: '1px solid var(--border)',
      borderRight: '1px solid var(--border)',
      gap: 16,
    }}>
      <div style={{
        width: 38, height: 38, border: '2px solid var(--border)',
        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 11,
        color: 'var(--text-muted)', background: 'var(--bg)', flexShrink: 0,
      }}>
        VS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        {[1, 2, 3].map(r => {
          const done = rounds[r - 1] != null;
          const active = streamingRound?.round === r;
          return (
            <div key={r} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: 4, height: 28,
                background: done
                  ? 'linear-gradient(180deg, var(--red), var(--blue))'
                  : active ? 'var(--red)' : 'var(--border)',
                animation: active ? 'glowPulse 1.5s ease-in-out infinite' : 'none',
                transition: 'background 0.4s',
              }} />
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, fontSize: 9, letterSpacing: '0.1em',
                color: active ? 'var(--text)' : done ? 'var(--text-muted)' : 'var(--border)',
              }}>
                R{r}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Bottom Bar ───────────────────────────────────────────────────────────────

function BottomBar({ topic, status, currentRound, nextRound, onNextRound, errorMsg, onRetry, showShare, onShare, shareMsg, spectatorCount }) {
  const [btnHovered, setBtnHovered] = useState(false);

  return (
    <div style={{
      height: 56, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 32px', gap: 24,
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 14,
        color: 'var(--text-muted)', flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {topic}
      </p>

      {spectatorCount !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#E8422A', display: 'inline-block',
            animation: 'spectatorPulse 1.4s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            {spectatorCount} watching
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        {status === 'streaming' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', animation: 'glowPulse 1s ease-in-out infinite' }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              ROUND {currentRound} — LIVE
            </span>
          </div>
        )}
        {status === 'between' && (
          <>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--border)', letterSpacing: '0.08em' }}>
              SPACE TO CONTINUE
            </span>
            <button
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
              onClick={onNextRound}
              style={{
                padding: '8px 28px',
                background: btnHovered ? 'var(--red)' : 'var(--surface-2)',
                color: btnHovered ? '#fff' : 'var(--text)',
                border: '1px solid var(--border)',
                clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, fontSize: 14, textTransform: 'uppercase',
                letterSpacing: '0.15em', cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {nextRound === TOTAL_ROUNDS ? 'FINAL ROUND' : `ROUND ${nextRound}`}
              <span style={{ display: 'inline-block', marginLeft: 8, animation: 'arrowPulse 1s ease-in-out infinite' }}>→</span>
            </button>
          </>
        )}
        {status === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--red)' }}>
              ERR: {errorMsg}
            </span>
            <button onClick={onRetry} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--red)', background: 'none', border: '1px solid var(--red)', padding: '4px 12px', cursor: 'pointer' }}>
              RETRY
            </button>
          </div>
        )}
        {showShare && (
          <button
            onClick={onShare}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: shareMsg ? 'var(--gold)' : 'var(--text-muted)',
              padding: '5px 14px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, letterSpacing: '0.1em',
              cursor: 'pointer', transition: 'color 0.2s, border-color 0.2s',
              borderColor: shareMsg ? 'var(--gold)' : 'var(--border)',
            }}
          >
            {shareMsg || 'SHARE'}
          </button>
        )}
      </div>

      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.1em', flexShrink: 0 }}>
        RND {currentRound} / {TOTAL_ROUNDS}
      </div>
    </div>
  );
}

// ── Trash Talk Overlay (F6) ──────────────────────────────────────────────────

function TrashTalkOverlay({ pair }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(8,8,8,0.88)',
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', gap: 64, maxWidth: 900, padding: '0 48px', width: '100%' }}>
        <div style={{
          flex: 1, textAlign: 'right',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(16px, 2vw, 24px)',
          color: 'var(--red)', lineHeight: 1.4,
          opacity: 0, animation: 'trashFadeIn 0.5s ease 0.1s forwards',
        }}>
          "{pair.axiom}"
        </div>
        <div style={{
          flex: 1, textAlign: 'left',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(16px, 2vw, 24px)',
          color: 'var(--blue)', lineHeight: 1.4,
          opacity: 0, animation: 'trashFadeIn 0.5s ease 0.6s forwards',
        }}>
          "{pair.cipher}"
        </div>
      </div>
    </div>
  );
}

// ── Verdict Flash ────────────────────────────────────────────────────────────

function VerdictFlash() {
  return (
    <div style={{
      height: 'calc(100vh - 56px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      animation: 'verdictFlash 1.8s ease forwards',
    }}>
      <p style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, letterSpacing: '0.4em',
        color: 'var(--gold)', marginBottom: 20,
      }}>
        THE DEBATE IS OVER
      </p>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800,
        fontSize: 'clamp(80px, 15vw, 160px)',
        letterSpacing: '-3px', lineHeight: 0.9,
        color: 'transparent',
        WebkitTextStroke: '3px var(--gold)',
        textAlign: 'center',
      }}>
        VERDICT<br />TIME
      </div>
    </div>
  );
}

// ── Voting Section ────────────────────────────────────────────────────────────

function VotingSection({ voted, votedFor, votes, onVote, onNewDebate, axiomExcerpt, cipherExcerpt }) {
  const [hoveredSide, setHoveredSide] = useState(null);
  const [stance, setStance] = useState(null);
  const [mindChanged, setMindChanged] = useState(false);
  const total = votes.red + votes.blue;

  const handleStance = (newStance) => {
    if (stance && stance !== newStance) {
      setMindChanged(true);
      setTimeout(() => setMindChanged(false), 2000);
    }
    setStance(newStance);
  };
  const redPct = total ? Math.round((votes.red / total) * 100) : 50;
  const bluePct = total ? 100 - redPct : 50;
  const winner = total ? (votes.red > votes.blue ? 'red' : votes.blue > votes.red ? 'blue' : 'tie') : null;

  const axiomWidth = voted
    ? (winner === 'red' ? '70%' : winner === 'blue' ? '30%' : '50%')
    : hoveredSide === 'red' ? '54%' : hoveredSide === 'blue' ? '46%' : '50%';
  const cipherWidth = voted
    ? (winner === 'blue' ? '70%' : winner === 'red' ? '30%' : '50%')
    : hoveredSide === 'blue' ? '54%' : hoveredSide === 'red' ? '46%' : '50%';

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }} className="vote-split">

      {/* AXIOM side */}
      <div
        onMouseEnter={() => !voted && setHoveredSide('red')}
        onMouseLeave={() => !voted && setHoveredSide(null)}
        onClick={() => !voted && onVote('red')}
        style={{
          width: axiomWidth, transition: 'width 0.8s ease',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          padding: '48px 40px',
          background: voted && winner === 'red'
            ? 'rgba(255,51,51,0.06)'
            : hoveredSide === 'red' ? 'rgba(255,51,51,0.04)' : 'var(--bg)',
          borderTop: '4px solid var(--red)',
          borderRight: '1px solid var(--border)',
          cursor: voted ? 'default' : 'pointer',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {voted && winner === 'red' && <Confetti />}
        {voted && winner === 'red' && (
          <div style={winnerBadgeStyle}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: 6 }}>WINNER</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 38, color: 'var(--gold)', letterSpacing: '0.1em' }}>AXIOM</div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <AxiomAvatar />
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 80, color: 'var(--red)', letterSpacing: '-2px', lineHeight: 0.9, textAlign: 'center' }}>
            AXIOM
          </div>
        </div>
        {!voted && (
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--red)', letterSpacing: '0.3em', marginTop: 12, opacity: hoveredSide === 'red' ? 1 : 0.5, transition: 'opacity 0.2s' }}>
            VOTE TO WIN
          </div>
        )}
        {axiomExcerpt && (
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.7, color: 'var(--text-muted)', marginTop: 28, maxWidth: 360, textAlign: 'center' }}>
            "{axiomExcerpt.slice(0, 200)}{axiomExcerpt.length > 200 ? '…' : ''}"
          </p>
        )}
        {voted && <VoteCount count={votes.red} pct={redPct} color="var(--red)" />}
      </div>

      {/* Center line */}
      <div style={{ width: 2, background: 'var(--border)', flexShrink: 0, position: 'relative' }}>
        {!voted && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 40, height: 40, background: 'var(--bg)',
            border: '2px solid var(--border)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            VS
          </div>
        )}
        {/* Stance picker (F7) */}
        {!voted && (
          <div style={{
            position: 'absolute', top: 32, left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            whiteSpace: 'nowrap',
          }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              YOUR STANCE?
            </p>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => handleStance('for')}
                style={{
                  padding: '4px 10px',
                  background: stance === 'for' ? 'var(--red)' : 'var(--surface)',
                  color: stance === 'for' ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${stance === 'for' ? 'var(--red)' : 'var(--border)'}`,
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11,
                  letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >FOR</button>
              <button
                onClick={() => handleStance('against')}
                style={{
                  padding: '4px 10px',
                  background: stance === 'against' ? 'var(--blue)' : 'var(--surface)',
                  color: stance === 'against' ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${stance === 'against' ? 'var(--blue)' : 'var(--border)'}`,
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11,
                  letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >AGAINST</button>
            </div>
            {mindChanged && (
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 10,
                letterSpacing: '0.2em', color: 'var(--gold)',
                border: '1px solid var(--gold)', padding: '2px 8px',
                animation: 'fadeIn 0.2s ease',
              }}>
                MIND CHANGED
              </span>
            )}
          </div>
        )}
      </div>

      {/* CIPHER side */}
      <div
        onMouseEnter={() => !voted && setHoveredSide('blue')}
        onMouseLeave={() => !voted && setHoveredSide(null)}
        onClick={() => !voted && onVote('blue')}
        style={{
          width: cipherWidth, transition: 'width 0.8s ease',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          padding: '48px 40px',
          background: voted && winner === 'blue'
            ? 'rgba(0,153,255,0.06)'
            : hoveredSide === 'blue' ? 'rgba(0,153,255,0.04)' : 'var(--bg)',
          borderTop: '4px solid var(--blue)',
          cursor: voted ? 'default' : 'pointer',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {voted && winner === 'blue' && <Confetti isBlue />}
        {voted && winner === 'blue' && (
          <div style={winnerBadgeStyle}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: 6 }}>WINNER</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 38, color: 'var(--gold)', letterSpacing: '0.1em' }}>CIPHER</div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <CipherAvatar />
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 80, color: 'var(--blue)', letterSpacing: '-2px', lineHeight: 0.9, textAlign: 'center' }}>
            CIPHER
          </div>
        </div>
        {!voted && (
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--blue)', letterSpacing: '0.3em', marginTop: 12, opacity: hoveredSide === 'blue' ? 1 : 0.5, transition: 'opacity 0.2s' }}>
            VOTE TO WIN
          </div>
        )}
        {cipherExcerpt && (
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.7, color: 'var(--text-muted)', marginTop: 28, maxWidth: 360, textAlign: 'center' }}>
            "{cipherExcerpt.slice(0, 200)}{cipherExcerpt.length > 200 ? '…' : ''}"
          </p>
        )}
        {voted && <VoteCount count={votes.blue} pct={bluePct} color="var(--blue)" />}
      </div>

      {voted && (
        <button
          onClick={onNewDebate}
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            padding: '14px 48px',
            background: 'var(--surface)', color: 'var(--text)',
            border: '1px solid var(--border)',
            clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700, fontSize: 16, textTransform: 'uppercase',
            letterSpacing: '0.2em', cursor: 'pointer', zIndex: 10,
          }}
        >
          START NEW DEBATE
        </button>
      )}
    </div>
  );
}

function VoteCount({ count, pct, color }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const start = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.floor(eased * count));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [count]);

  return (
    <div style={{ marginTop: 32, textAlign: 'center', animation: 'winnerExpand 0.5s ease forwards' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 64, color, lineHeight: 1 }}>
        {displayed}
      </div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 4 }}>
        {pct}% OF VOTES
      </div>
    </div>
  );
}

function Confetti({ isBlue }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: `${15 + (i % 6) * 8}%`,
          left: `${5 + i * 4.5}%`,
          width: i % 3 === 0 ? 9 : 6,
          height: i % 3 === 0 ? 9 : 16,
          background: isBlue
            ? CONFETTI_COLORS[(i + 2) % CONFETTI_COLORS.length]
            : CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          borderRadius: i % 2 === 0 ? '50%' : 0,
          opacity: 0,
          animation: `${CONFETTI_ANIMS[i % 5]} ${1.2 + (i % 4) * 0.2}s ease ${i * 0.06}s forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Per-Round Vote Row (Task 5) ───────────────────────────────────────────────

function AnimatedBar({ pct, color }) {
  const [w, setW] = useState(0);
  useEffect(() => { setW(pct); }, [pct]);
  return (
    <div style={{
      height: '100%',
      background: color,
      width: `${w}%`,
      transition: 'width 0.6s ease',
    }} />
  );
}

function RoundVoteRow({ roundNumber, votes, hasVoted, onVote }) {
  const v = votes || { axiom: 0, cipher: 0 };
  const total = v.axiom + v.cipher;
  const axiomPct = total ? Math.round((v.axiom / total) * 100) : 50;
  const cipherPct = 100 - axiomPct;

  return (
    <div style={{
      flexShrink: 0, borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '8px 32px',
      display: 'flex', alignItems: 'center', gap: 20, minHeight: 44,
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'var(--text-muted)', flexShrink: 0, width: 64,
      }}>
        RND {roundNumber} VOTE
      </span>

      {!hasVoted && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onVote(roundNumber, 'AXIOM')}
            style={{
              padding: '4px 14px', background: 'transparent',
              border: '1px solid #E8422A', color: '#E8422A',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.target.style.background = '#E8422A'; e.target.style.color = '#fff'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#E8422A'; }}
          >
            AXIOM
          </button>
          <button
            onClick={() => onVote(roundNumber, 'CIPHER')}
            style={{
              padding: '4px 14px', background: 'transparent',
              border: '1px solid #4A9EFF', color: '#4A9EFF',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.target.style.background = '#4A9EFF'; e.target.style.color = '#fff'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#4A9EFF'; }}
          >
            CIPHER
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', height: 6, background: 'var(--border)', overflow: 'hidden' }}>
          <AnimatedBar pct={axiomPct} color="#E8422A" />
          <AnimatedBar pct={cipherPct} color="#4A9EFF" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#E8422A', letterSpacing: '0.05em' }}>
            {axiomPct}% ({v.axiom})
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#4A9EFF', letterSpacing: '0.05em' }}>
            ({v.cipher}) {cipherPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

const winnerBadgeStyle = {
  position: 'absolute', top: 32,
  border: '2px solid var(--gold)',
  padding: '12px 32px', textAlign: 'center',
  animation: 'winnerExpand 0.6s ease 0.3s both',
};
