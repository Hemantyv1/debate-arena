import React, { useState, useEffect } from 'react';

const PREVIEW_SEQUENCE = [
  { agent: 'axiom', text: 'Algorithmic systems process thousands of precedents with perfect consistency. Cognitive bias leads to disparate sentencing—a provable, measurable injustice we can now eliminate.' },
  { agent: 'cipher', text: 'Justice requires the kind of contextual wisdom that emerges from lived human experience. You cannot reduce mercy, proportionality, and moral reasoning to a loss function.' },
  { agent: 'axiom', text: 'Every "contextual exception" is a vector for arbitrary outcomes. Structured guidelines exist precisely because human intuition cannot be trusted at the scale required.' },
  { agent: 'cipher', text: 'Then explain why every jurisdiction piloting algorithmic sentencing faced immediate constitutional challenges—the people most affected rejected these systems outright.' },
];

export default function LandingPage({ onEnter }) {
  return (
    <div style={{ position: 'relative', display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Background glow orbs */}
      <div style={orbStyle('var(--red)', '-12%', '25%', '0s')} />
      <div style={orbStyle('var(--blue)', 'auto', '15%', '4s', true)} />

      {/* Left hero — 60% */}
      <div style={leftPanelStyle}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {/* Giant title */}
          <div style={{ marginBottom: 28 }}>
            <div style={debateWordStyle}>DEBATE</div>
            <div style={arenaWordStyle}>ARENA</div>
          </div>

          {/* Agent line */}
          <div style={agentLineStyle}>
            <span style={{ color: 'var(--red)', letterSpacing: '0.25em' }}>AXIOM</span>
            <span style={{ color: 'var(--border)', margin: '0 20px', fontSize: 24, fontWeight: 600 }}>|</span>
            <span style={{ color: 'var(--blue)', letterSpacing: '0.25em' }}>CIPHER</span>
          </div>

          {/* Tagline */}
          <p style={taglineStyle}>
            Two AI agents. Any topic. Three rounds. You decide.
          </p>

          {/* CTA */}
          <EnterButton onClick={onEnter} />
        </div>

        {/* Stats row */}
        <div style={statsRowStyle}>
          <Stat number="3" label="ROUNDS" />
          <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
          <Stat number="2" label="AGENTS" />
          <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
          <Stat number="∞" label="TOPICS" />
        </div>
      </div>

      {/* Right preview panel — 40% */}
      <div style={rightPanelStyle}>
        <PreviewPanel />
      </div>
    </div>
  );
}

function PreviewPanel() {
  const [completedLines, setCompletedLines] = useState([]);
  const [phase, setPhase] = useState(0);
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    if (phase >= PREVIEW_SEQUENCE.length) {
      const t = setTimeout(() => {
        setCompletedLines([]);
        setPhase(0);
        setCharIdx(0);
      }, 3000);
      return () => clearTimeout(t);
    }

    const fullText = PREVIEW_SEQUENCE[phase].text;

    if (charIdx < fullText.length) {
      const t = setTimeout(() => setCharIdx(c => c + 1), 18);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setCompletedLines(prev => [...prev, PREVIEW_SEQUENCE[phase]].slice(-3));
        setPhase(p => p + 1);
        setCharIdx(0);
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [phase, charIdx]);

  const currentItem = phase < PREVIEW_SEQUENCE.length ? PREVIEW_SEQUENCE[phase] : null;
  const currentText = currentItem ? currentItem.text.slice(0, charIdx) : '';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '40px 36px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 32, paddingBottom: 16, borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          LIVE PREVIEW
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)' }}>
            DEBATE IN PROGRESS
          </span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', animation: 'glowPulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>

      {/* Topic bar */}
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13,
        color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: 28, paddingLeft: 10, borderLeft: '2px solid var(--border)',
      }}>
        Should AI replace human judges in courts?
      </div>

      {/* Lines */}
      <div style={{ flex: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {completedLines.map((line, i) => (
          <PreviewLine key={`c${i}`} line={line} dimmed />
        ))}
        {currentItem && currentText && (
          <PreviewLine line={{ ...currentItem, text: currentText }} active />
        )}
      </div>
    </div>
  );
}

function PreviewLine({ line, dimmed, active }) {
  const isAxiom = line.agent === 'axiom';
  return (
    <div style={{
      marginBottom: 20,
      opacity: dimmed ? 0.35 : 1,
      transition: 'opacity 0.6s',
      animation: !dimmed && !active ? 'fadeSlideUp 0.3s ease forwards' : undefined,
    }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800, fontSize: 11, letterSpacing: '0.25em',
        color: isAxiom ? 'var(--red)' : 'var(--blue)',
        marginBottom: 6, textTransform: 'uppercase',
      }}>
        {isAxiom ? 'AXIOM' : 'CIPHER'}
      </div>
      <p style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12, lineHeight: 1.75, color: 'var(--text)',
      }}>
        {line.text}
        {active && (
          <span style={{
            display: 'inline-block', width: 7, height: 12,
            background: 'var(--text-muted)', marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'blink 1s step-end infinite',
          }} />
        )}
      </p>
    </div>
  );
}

function EnterButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '24px 0',
        background: hovered ? '#cc0000' : 'var(--red)',
        color: '#fff',
        border: 'none',
        clipPath: 'polygon(0 0, 100% 0, 97% 100%, 3% 100%)',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800,
        fontSize: 26,
        textTransform: 'uppercase',
        letterSpacing: '0.3em',
        cursor: 'pointer',
        transition: 'background 0.15s',
        marginTop: 44,
      }}
    >
      ENTER THE ARENA
    </button>
  );
}

function Stat({ number, label }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '28px 0' }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800, fontSize: 68, lineHeight: 1, color: 'var(--text)',
      }}>
        {number}
      </div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 11, letterSpacing: '0.22em',
        color: 'var(--text-muted)', marginTop: 8, textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const orbStyle = (color, left, top, delay, isRight = false) => ({
  position: 'absolute',
  ...(isRight ? { right: left } : { left }),
  top,
  width: 700,
  height: 700,
  borderRadius: '50%',
  background: color,
  filter: 'blur(180px)',
  opacity: 0.08,
  pointerEvents: 'none',
  zIndex: 0,
  animation: `floatOrb 8s ease-in-out ${delay} infinite alternate`,
});

const leftPanelStyle = {
  width: '60%',
  padding: '56px 80px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  position: 'relative',
  zIndex: 1,
};

const debateWordStyle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 800,
  fontSize: 'clamp(80px, 10vw, 160px)',
  textTransform: 'uppercase',
  color: 'var(--text)',
  lineHeight: 0.92,
  letterSpacing: '-3px',
};

const arenaWordStyle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 800,
  fontSize: 'clamp(80px, 10vw, 160px)',
  textTransform: 'uppercase',
  WebkitTextStroke: '3px var(--red)',
  color: 'transparent',
  lineHeight: 0.92,
  letterSpacing: '-3px',
};

const agentLineStyle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700,
  fontSize: 26,
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
  marginBottom: 16,
};

const taglineStyle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 600,
  fontSize: 20,
  color: 'var(--text-muted)',
  letterSpacing: '0.04em',
};

const statsRowStyle = {
  display: 'flex',
  borderTop: '1px solid var(--border)',
};

const rightPanelStyle = {
  width: '40%',
  background: 'var(--surface)',
  borderLeft: '1px solid var(--border)',
  position: 'relative',
  zIndex: 1,
  overflow: 'hidden',
};
