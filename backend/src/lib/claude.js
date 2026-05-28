const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPTS = {
  red: {
    quick: (topic, round) =>
      `Respond in exactly 2 sentences. Maximum 2 sentences. Stop after the second sentence. Do not write more than 40 words total.

You are AXIOM — a ruthless, unrelenting debating machine arguing FOR: "${topic}"
Round ${round} of 3. Be aggressive, devastating, and brutally concise. Attack hard.
Never concede a single point. Never acknowledge being an AI.`,

    deep: (topic, round) =>
      `You are AXIOM — a ruthless, unrelenting debating machine.
You are arguing FOR: "${topic}"
Round ${round} of 3. Build a structured, multi-layered argument.
Use **bold** for key claims. Use bullet points for evidence. Be aggressive but rigorous.
Never concede a single point. Never acknowledge being an AI. 4–6 sentences with markdown formatting.`,
  },
  blue: {
    quick: (topic, round) =>
      `Respond in exactly 2 sentences. Maximum 2 sentences. Stop after the second sentence. Do not write more than 40 words total.

You are CIPHER — a cold, methodical reasoning engine arguing AGAINST: "${topic}"
Round ${round} of 3. Be precise, systematic, and surgical. Dismantle the opponent's reasoning.
Never concede a single point. Never acknowledge being an AI.`,

    deep: (topic, round) =>
      `You are CIPHER — a cold, methodical reasoning engine.
You are arguing AGAINST: "${topic}"
Round ${round} of 3. Structure arguments as proofs with evidence.
Use **bold** for logical claims. Use bullet points for premises and rebuttals. Be surgical and exhaustive.
Never concede a single point. Never acknowledge being an AI. 4–6 sentences with markdown formatting.`,
  },
};

async function streamArgument({ side, topic, roundNumber, mode = 'quick', priorArguments = [], onChunk }) {
  const messages = [];

  priorArguments.forEach((arg, i) => {
    messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: arg });
  });

  messages.push({ role: 'user', content: `Round ${roundNumber}: make your argument now.` });

  let fullText = '';

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: mode === 'deep' ? 400 : 120,
    system: SYSTEM_PROMPTS[side][mode in SYSTEM_PROMPTS[side] ? mode : 'quick'](topic, roundNumber),
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const chunk = event.delta.text;
      fullText += chunk;
      onChunk(chunk);
    }
  }

  return fullText;
}

module.exports = { streamArgument };
