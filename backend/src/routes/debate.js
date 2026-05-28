const express = require('express');
const rateLimit = require('express-rate-limit');
const { validate: isUUID } = require('uuid');

const supabase = require('../lib/supabase');
const { streamArgument } = require('../lib/claude');
const { sanitizeTopic } = require('../lib/sanitize');

const router = express.Router();

// In-memory spectator tracking
const debateSpectators = new Map();
setInterval(() => {
  for (const [id, count] of debateSpectators.entries()) {
    if (count <= 0) debateSpectators.delete(id);
  }
}, 60_000);

function truncateQuick(text) {
  if (!text || text.length <= 300) return text;
  const sub = text.slice(0, 300);
  const lastPeriod = sub.lastIndexOf('. ');
  if (lastPeriod > 0) return text.slice(0, lastPeriod + 1);
  const eol = sub.lastIndexOf('.');
  if (eol > 0) return text.slice(0, eol + 1);
  return sub;
}

// ── Per-route rate limiters ───────────────────────────────────────────────────
const startLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many debates started. Try again in an hour.' },
});

const reactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many reactions. Slow down.' },
});

const voteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many votes. Try again in an hour.' },
});

const roundLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many round requests. Try again in an hour.' },
});

// ── POST /api/debate/start ────────────────────────────────────────────────────
router.post('/start', startLimiter, async (req, res) => {
  const result = sanitizeTopic(req.body?.topic);
  if (!result.ok) return res.status(400).json({ error: result.reason });

  const mode = req.body?.mode === 'deep' ? 'deep' : 'quick';

  try {
    let insertResult = await supabase
      .from('debates')
      .insert({ topic: result.value, status: 'pending', red_votes: 0, blue_votes: 0, mode })
      .select('id')
      .single();

    // Fall back to insert without mode if the column doesn't exist yet
    if (insertResult.error && (insertResult.error.code === '42703' || String(insertResult.error.message).includes('mode'))) {
      insertResult = await supabase
        .from('debates')
        .insert({ topic: result.value, status: 'pending', red_votes: 0, blue_votes: 0 })
        .select('id')
        .single();
    }

    const { data, error } = insertResult;
    if (error) throw error;

    return res.status(201).json({ id: data.id, topic: result.value });
  } catch (err) {
    console.error('[debate/start]', err);
    return res.status(500).json({ error: 'Failed to create debate.' });
  }
});

// ── GET /api/debate/:id/round — SSE streaming ────────────────────────────────
router.get('/:id/round', roundLimiter, async (req, res) => {
  const { id } = req.params;

  // Validate UUID before touching Supabase
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid debate ID.' });

  const roundNumber = parseInt(req.query.round, 10);
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > 3) {
    return res.status(400).json({ error: 'round must be an integer between 1 and 3.' });
  }

  // Fetch the debate and any prior rounds
  let debate, priorRounds;
  try {
    const [debateRes, roundsRes] = await Promise.all([
      supabase.from('debates').select('*').eq('id', id).single(),
      supabase.from('rounds').select('*').eq('debate_id', id).order('round_number'),
    ]);
    if (debateRes.error) throw debateRes.error;
    if (roundsRes.error) throw roundsRes.error;
    debate = debateRes.data;
    priorRounds = roundsRes.data;
  } catch (err) {
    console.error('[debate/round fetch]', err);
    return res.status(500).json({ error: 'Failed to load debate.' });
  }

  if (!debate) return res.status(404).json({ error: 'Debate not found.' });

  // ── SSE setup ────────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Kill zombie connections after 60 seconds
  const timeout = setTimeout(() => {
    send('error', { message: 'Stream timed out.' });
    res.end();
  }, 60_000);

  req.on('close', () => clearTimeout(timeout));

  // Build prior-argument list for Claude context
  const priorArguments = [];
  for (const r of priorRounds) {
    if (r.red_argument) priorArguments.push(r.red_argument);
    if (r.blue_argument) priorArguments.push(r.blue_argument);
  }

  let redArg = '';
  let blueArg = '';

  try {
    const debateMode = debate.mode || 'quick';

    // Stream Red's argument
    send('side', { side: 'red' });
    redArg = await streamArgument({
      side: 'red',
      topic: debate.topic,
      roundNumber,
      mode: debateMode,
      priorArguments,
      onChunk: (chunk) => send('chunk', { side: 'red', text: chunk }),
    });
    if (debateMode === 'quick') redArg = truncateQuick(redArg);

    // 3-second countdown before CIPHER responds
    for (let count = 3; count >= 1; count--) {
      send('countdown', { count });
      await new Promise(r => setTimeout(r, 1000));
    }

    // Stream Blue's argument
    send('side', { side: 'blue' });
    blueArg = await streamArgument({
      side: 'blue',
      topic: debate.topic,
      roundNumber,
      mode: debateMode,
      priorArguments: [...priorArguments, redArg],
      onChunk: (chunk) => send('chunk', { side: 'blue', text: chunk }),
    });
    if (debateMode === 'quick') blueArg = truncateQuick(blueArg);

    // Persist round to Supabase
    const { error: upsertErr } = await supabase.from('rounds').upsert(
      {
        debate_id: id,
        round_number: roundNumber,
        red_argument: redArg,
        blue_argument: blueArg,
      },
      { onConflict: 'debate_id,round_number' }
    );
    if (upsertErr) throw upsertErr;

    // Update debate status
    const newStatus = roundNumber === 3 ? 'completed' : 'in_progress';
    await supabase.from('debates').update({ status: newStatus }).eq('id', id);

    send('done', { roundNumber, red: redArg, blue: blueArg });
  } catch (err) {
    console.error('[debate/round stream]', err);
    send('error', { message: 'Stream failed.' });
  } finally {
    clearTimeout(timeout);
    res.end();
  }
});

// ── POST /api/debate/:id/vote ─────────────────────────────────────────────────
router.post('/:id/vote', voteLimiter, async (req, res) => {
  const { id } = req.params;

  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid debate ID.' });

  const { agent } = req.body;
  if (agent !== 'red' && agent !== 'blue') {
    return res.status(400).json({ error: 'agent must be exactly "red" or "blue".' });
  }

  try {
    const { data, error } = await supabase.rpc('increment_vote', {
      p_debate_id: id,
      p_agent: agent,
    });

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Debate not found.' });

    return res.json({ red_votes: data[0].red_votes, blue_votes: data[0].blue_votes });
  } catch (err) {
    console.error('[debate/vote]', err);
    return res.status(500).json({ error: 'Failed to record vote.' });
  }
});

// ── GET /api/debate/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid debate ID.' });

  try {
    const [debateRes, roundsRes] = await Promise.all([
      supabase.from('debates').select('*').eq('id', id).single(),
      supabase.from('rounds').select('*').eq('debate_id', id).order('round_number'),
    ]);

    if (debateRes.error) throw debateRes.error;
    if (!debateRes.data) return res.status(404).json({ error: 'Debate not found.' });

    return res.json({ debate: debateRes.data, rounds: roundsRes.data || [] });
  } catch (err) {
    console.error('[debate/get]', err);
    return res.status(500).json({ error: 'Failed to load debate.' });
  }
});

// ── POST /api/debate/:id/react ────────────────────────────────────────────────
router.post('/:id/react', reactLimiter, async (req, res) => {
  const { id } = req.params;
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid debate ID.' });

  const { roundNumber, agent, emoji } = req.body;
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > 3) {
    return res.status(400).json({ error: 'Invalid roundNumber.' });
  }
  if (agent !== 'red' && agent !== 'blue') {
    return res.status(400).json({ error: 'agent must be "red" or "blue".' });
  }
  const VALID_EMOJIS = ['🔥', '💀', '🤯', '👏'];
  if (!VALID_EMOJIS.includes(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji.' });
  }

  try {
    const { error } = await supabase.rpc('increment_reaction', {
      p_debate_id: id,
      p_round: roundNumber,
      p_agent: agent,
      p_emoji: emoji,
    });
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error('[debate/react]', err);
    return res.status(500).json({ error: 'Failed to record reaction.' });
  }
});

// ── GET /api/debate/:id/reactions ─────────────────────────────────────────────
router.get('/:id/reactions', async (req, res) => {
  const { id } = req.params;
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid debate ID.' });

  try {
    const { data, error } = await supabase
      .from('reactions')
      .select('round_number, agent, emoji, count')
      .eq('debate_id', id);
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('[debate/reactions]', err);
    return res.status(500).json({ error: 'Failed to load reactions.' });
  }
});

// ── GET /api/debate/:id/spectators ───────────────────────────────────────────
router.get('/:id/spectators', (req, res) => {
  const { id } = req.params;
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid debate ID.' });
  res.json({ count: debateSpectators.get(id) || 0 });
});

// ── POST /api/debate/:id/spectators/join ──────────────────────────────────────
router.post('/:id/spectators/join', (req, res) => {
  const { id } = req.params;
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid debate ID.' });
  const next = (debateSpectators.get(id) || 0) + 1;
  debateSpectators.set(id, next);
  res.json({ count: next });
});

// ── POST /api/debate/:id/spectators/leave ─────────────────────────────────────
router.post('/:id/spectators/leave', (req, res) => {
  const { id } = req.params;
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid debate ID.' });
  const next = Math.max(0, (debateSpectators.get(id) || 0) - 1);
  debateSpectators.set(id, next);
  res.json({ count: next });
});

// ── Per-round vote rate limiter ───────────────────────────────────────────────
const roundVoteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 9,
  message: { error: 'Too many round votes. Try again later.' },
});

// ── POST /api/debate/:id/round-vote ──────────────────────────────────────────
/*
  Run this SQL in Supabase before using per-round votes:

  CREATE TABLE IF NOT EXISTS votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    agent TEXT NOT NULL CHECK (agent IN ('AXIOM', 'CIPHER')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS votes_debate_id_idx ON votes(debate_id);
  ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Anyone can read votes" ON votes FOR SELECT USING (true);
  CREATE POLICY "Anyone can insert votes" ON votes FOR INSERT WITH CHECK (true);
*/
router.post('/:id/round-vote', roundVoteLimiter, async (req, res) => {
  const { id } = req.params;
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid debate ID.' });

  const { round, agent } = req.body;
  if (!Number.isInteger(round) || round < 1 || round > 3) {
    return res.status(400).json({ error: 'round must be 1-3.' });
  }
  if (agent !== 'AXIOM' && agent !== 'CIPHER') {
    return res.status(400).json({ error: 'agent must be AXIOM or CIPHER.' });
  }

  try {
    const { error } = await supabase.from('votes').insert({ debate_id: id, round_number: round, agent });
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error('[debate/round-vote]', err);
    return res.status(500).json({ error: 'Failed to record round vote.' });
  }
});

// ── GET /api/debate/:id/round-votes ──────────────────────────────────────────
router.get('/:id/round-votes', async (req, res) => {
  const { id } = req.params;
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid debate ID.' });

  try {
    const { data, error } = await supabase
      .from('votes')
      .select('round_number, agent')
      .eq('debate_id', id);
    if (error) throw error;

    const result = [1, 2, 3].map(r => {
      const rv = (data || []).filter(v => v.round_number === r);
      return { round: r, axiom: rv.filter(v => v.agent === 'AXIOM').length, cipher: rv.filter(v => v.agent === 'CIPHER').length };
    });
    return res.json(result);
  } catch (err) {
    console.error('[debate/round-votes]', err);
    return res.status(500).json({ error: 'Failed to load round votes.' });
  }
});

// ── GET /api/debate/:id/transcript ───────────────────────────────────────────
router.get('/:id/transcript', async (req, res) => {
  const { id } = req.params;
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid debate ID.' });

  try {
    const [debateRes, roundsRes] = await Promise.all([
      supabase.from('debates').select('topic, mode, red_votes, blue_votes').eq('id', id).single(),
      supabase.from('rounds').select('round_number, red_argument, blue_argument, created_at').eq('debate_id', id).order('round_number'),
    ]);
    if (debateRes.error) throw debateRes.error;
    if (!debateRes.data) return res.status(404).json({ error: 'Debate not found.' });

    return res.json({
      topic: debateRes.data.topic,
      mode: debateRes.data.mode || 'quick',
      red_votes: debateRes.data.red_votes || 0,
      blue_votes: debateRes.data.blue_votes || 0,
      rounds: (roundsRes.data || []).map(r => ({
        round_number: r.round_number,
        axiom_argument: r.red_argument,
        cipher_argument: r.blue_argument,
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[debate/transcript]', err);
    return res.status(500).json({ error: 'Failed to load transcript.' });
  }
});

module.exports = router;
