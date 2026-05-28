import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import DebateSetup from './components/DebateSetup';
import DebateArena from './components/DebateArena';
import Leaderboard from './components/Leaderboard';
import TranscriptView from './components/TranscriptView';
import ReplayArena from './components/ReplayArena';
import { getTodayCount, getLeaderboard } from './api';

function getInitialState() {
  const replayMatch = window.location.hash.match(/^#debate\/([0-9a-f-]{36})\/replay$/i);
  if (replayMatch) return { view: 'replay', debateId: replayMatch[1] };
  const match = window.location.hash.match(/^#debate\/([0-9a-f-]{36})$/i);
  if (match) return { view: 'transcript', debateId: match[1] };
  return { view: 'landing', debateId: null };
}

const initial = getInitialState();

export default function App() {
  const [view, setView] = useState(initial.view);
  const [debateId, setDebateId] = useState(initial.debateId);
  const [topic, setTopic] = useState('');
  const [debateMode, setDebateMode] = useState('quick');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [todayCount, setTodayCount] = useState(null);
  const [fading, setFading] = useState(false);
  const [prefillTopic, setPrefillTopic] = useState('');
  const [streak, setStreak] = useState(null);

  useEffect(() => {
    getTodayCount().then(n => setTodayCount(n)).catch(() => {});
    getLeaderboard().then(data => {
      if (!Array.isArray(data)) return;
      let a = 0, c = 0;
      data.forEach(d => {
        const r = d.red_votes || 0, b = d.blue_votes || 0;
        if (!r && !b) return;
        if (r > b) a++; else if (b > r) c++;
      });
      setStreak({ axiom: a, cipher: c });
    }).catch(() => {});
  }, []);

  const navigate = (newView) => {
    setFading(true);
    setTimeout(() => {
      setView(newView);
      setFading(false);
    }, 150);
  };

  const handleDebateStarted = ({ id, topic: t, mode }) => {
    setDebateId(id);
    setTopic(t);
    setDebateMode(mode || 'quick');
    window.location.hash = `debate/${id}`;
    navigate('arena');
    setTodayCount(c => (c || 0) + 1);
  };

  const handleSelectDebate = (id) => {
    setDebateId(id);
    window.location.hash = `debate/${id}`;
    navigate('transcript');
  };

  const handleReplayDebate = (id) => {
    setDebateId(id);
    window.location.hash = `debate/${id}/replay`;
    navigate('replay');
  };

  if (view === 'landing') {
    return (
      <div style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.15s ease' }}>
        <LandingPage onEnter={() => navigate('setup')} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={headerStyle}>
        <button onClick={() => navigate('setup')} style={brandStyle}>
          DEBATE ARENA
        </button>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {streak && (streak.axiom !== streak.cipher) && (
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, fontSize: 13,
              letterSpacing: '0.08em', marginRight: 4,
              color: streak.axiom > streak.cipher ? 'var(--red)' : 'var(--blue)',
            }}>
              {streak.axiom > streak.cipher
                ? `AXIOM 🔥 ${streak.axiom}W`
                : `CIPHER ❄️ ${streak.cipher}W`}
            </span>
          )}
          {todayCount !== null && (
            <span style={todayCountStyle}>{todayCount} TODAY</span>
          )}
          <NavBtn active={view === 'setup' || view === 'arena'} onClick={() => navigate('setup')}>
            NEW DEBATE
          </NavBtn>
          <NavBtn active={view === 'leaderboard' || view === 'transcript'} onClick={() => navigate('leaderboard')}>
            LEADERBOARD
          </NavBtn>
        </nav>
      </header>

      {/* Fixed bottom-right sound button */}
      <SoundToggle enabled={soundEnabled} onToggle={() => setSoundEnabled(e => !e)} />

      <main style={{ flex: 1, opacity: fading ? 0 : 1, transition: 'opacity 0.15s ease' }}>
        {view === 'setup' && (
          <DebateSetup
            onStarted={handleDebateStarted}
            prefillTopic={prefillTopic}
            onClearPrefill={() => setPrefillTopic('')}
          />
        )}
        {view === 'arena' && debateId && (
          <DebateArena
            debateId={debateId}
            topic={topic}
            mode={debateMode}
            onNewDebate={() => navigate('setup')}
            soundEnabled={soundEnabled}
          />
        )}
        {view === 'leaderboard' && (
          <Leaderboard onSelectDebate={handleSelectDebate} onReplayDebate={handleReplayDebate} />
        )}
        {view === 'transcript' && debateId && (
          <TranscriptView
            debateId={debateId}
            onSimilarDebate={(t) => { setPrefillTopic(t); navigate('setup'); }}
            onBack={() => navigate('leaderboard')}
          />
        )}
        {view === 'replay' && debateId && (
          <ReplayArena
            debateId={debateId}
            onBack={() => navigate('leaderboard')}
          />
        )}
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 22px',
        clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
        border: 'none',
        background: active ? 'var(--red)' : hovered ? 'var(--surface-2)' : 'var(--surface)',
        color: active ? '#fff' : hovered ? 'var(--text)' : 'var(--text-muted)',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 14,
        textTransform: 'uppercase', letterSpacing: '0.12em',
        transition: 'background 0.15s, color 0.15s',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function SoundToggle({ enabled, onToggle }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={enabled ? 'Sound on — click to mute' : 'Sound off — click to enable'}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 999,
        width: 48, height: 48,
        background: '#111',
        border: `1px solid ${hovered ? '#fff' : '#333'}`,
        borderRadius: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        padding: 0,
        color: enabled ? '#ffffff' : '#555555',
      }}
    >
      {enabled ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <line x1="23" y1="9" x2="17" y2="15"/>
          <line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      )}
    </button>
  );
}

const headerStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 48px', height: 56,
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg)',
  flexShrink: 0, position: 'sticky', top: 0, zIndex: 100,
};

const brandStyle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 800, fontSize: 18,
  color: 'var(--text)', textTransform: 'uppercase',
  letterSpacing: '0.15em',
  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
};

const todayCountStyle = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10, color: 'var(--text-muted)',
  letterSpacing: '0.1em', marginRight: 8,
};
