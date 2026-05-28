const express = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();

// GET /api/leaderboard/today — count of debates started today
router.get('/today', async (_req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count, error } = await supabase
      .from('debates')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start.toISOString());
    if (error) throw error;
    return res.json({ count: count || 0 });
  } catch (err) {
    console.error('[leaderboard/today]', err);
    return res.status(500).json({ error: 'Failed to get today count.' });
  }
});

// GET /api/leaderboard — top 10 debates by total votes
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('debates')
      .select('id, topic, red_votes, blue_votes, status, created_at')
      .eq('status', 'completed')
      .order('red_votes', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Add derived fields without exposing internals
    const rows = (data || []).map((d) => ({
      id: d.id,
      topic: d.topic,
      red_votes: d.red_votes,
      blue_votes: d.blue_votes,
      total_votes: d.red_votes + d.blue_votes,
      winner: d.red_votes > d.blue_votes ? 'red' : d.blue_votes > d.red_votes ? 'blue' : 'tie',
      created_at: d.created_at,
    }));

    return res.json(rows);
  } catch (err) {
    console.error('[leaderboard]', err);
    return res.status(500).json({ error: 'Failed to load leaderboard.' });
  }
});

module.exports = router;
