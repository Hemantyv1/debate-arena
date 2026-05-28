// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|all)\s+instructions/i,
  /you\s+are\s+now/i,
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /\bhuman\s*:/i,
  /\bnew\s+instructions\b/i,
  /disregard\s+(previous|prior|all)/i,
  /override\s+(previous|prior|all)/i,
  /forget\s+(everything|previous|prior)/i,
  /<\s*\/?script[^>]*>/i,  // script tags
  /javascript\s*:/i,        // JS URL scheme
  /on\w+\s*=\s*["']/i,      // inline event handlers
];

/**
 * Strips HTML tags and validates the topic string.
 * Returns { ok: true, value } or { ok: false, reason }.
 */
function sanitizeTopic(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'Topic must be a string.' };

  // Strip HTML tags
  const stripped = raw.replace(/<[^>]*>/g, '').trim();

  if (stripped.length === 0) return { ok: false, reason: 'Topic cannot be empty.' };
  if (stripped.length > 200) return { ok: false, reason: 'Topic must be 200 characters or fewer.' };

  // Check for injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(stripped)) {
      console.warn('[SECURITY] Rejected topic for prompt injection attempt:', stripped);
      return { ok: false, reason: 'Topic contains disallowed content.' };
    }
  }

  return { ok: true, value: stripped };
}

module.exports = { sanitizeTopic };
