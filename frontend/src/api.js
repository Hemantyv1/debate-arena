export const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const startDebate = (topic, mode = 'quick') =>
  apiFetch('/api/debate/start', { method: 'POST', body: JSON.stringify({ topic, mode }) });

export const getDebate = (id) =>
  apiFetch(`/api/debate/${id}`);

export const vote = (id, agent) =>
  apiFetch(`/api/debate/${id}/vote`, { method: 'POST', body: JSON.stringify({ agent }) });

export const getLeaderboard = () =>
  apiFetch('/api/leaderboard');

/**
 * Open an SSE stream for a debate round.
 * Returns an EventSource. Caller is responsible for closing it.
 */
export const getTodayCount = () =>
  apiFetch('/api/leaderboard/today').then(d => d.count);

export function openRoundStream(debateId, roundNumber) {
  const url = `${BASE}/api/debate/${debateId}/round?round=${roundNumber}`;
  return new EventSource(url);
}

export const postReaction = (id, roundNumber, agent, emoji) =>
  apiFetch(`/api/debate/${id}/react`, { method: 'POST', body: JSON.stringify({ roundNumber, agent, emoji }) });

export const getReactions = (id) =>
  apiFetch(`/api/debate/${id}/reactions`);

// Spectator tracking
export const joinSpectators = (id) =>
  apiFetch(`/api/debate/${id}/spectators/join`, { method: 'POST' });

export const leaveSpectators = (id) =>
  apiFetch(`/api/debate/${id}/spectators/leave`, { method: 'POST' });

export const getSpectators = (id) =>
  apiFetch(`/api/debate/${id}/spectators`);

// Per-round voting
export const postRoundVote = (id, round, agent) =>
  apiFetch(`/api/debate/${id}/round-vote`, { method: 'POST', body: JSON.stringify({ round, agent }) });

export const getRoundVotes = (id) =>
  apiFetch(`/api/debate/${id}/round-votes`);

// Replay transcript
export const getTranscript = (id) =>
  apiFetch(`/api/debate/${id}/transcript`);
