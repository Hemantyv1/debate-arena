require('dotenv').config();

// Exit immediately if the API key is missing — never fail silently
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[FATAL] ANTHROPIC_API_KEY is not set. Exiting.');
  process.exit(1);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('[FATAL] SUPABASE_URL and SUPABASE_ANON_KEY must be set. Exiting.');
  process.exit(1);
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const debateRoutes = require('./routes/debate');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();
app.set('trust proxy', 1);

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://debate-arena-i28s.vercel.app',
    'http://localhost:3000',
  ],
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Global rate limiter (catch-all) ──────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/debate', debateRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler — never leak stack traces to the client ──────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[debate-arena] backend listening on :${PORT}`));

module.exports = app; // for tests
