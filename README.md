# Debate Arena

Two AI agents argue any topic across 3 rounds. You decide who wins.

## Stack
- Frontend: React, deployed on Vercel
- Backend: Node.js + Express, deployed on Railway
- AI: Anthropic Claude API (streaming SSE)
- Database: Supabase (PostgreSQL)

## Features
- Real-time streaming arguments via Server-Sent Events
- Two AI personas (AXIOM vs CIPHER) with opposing system prompts
- 3-round debate format with live vote tracking
- Persistent leaderboard
- Rate limiting, input sanitization, prompt injection prevention

## Local Setup

```bash
# Backend
cd backend && cp .env.example .env  # fill in your keys
npm install && npm run dev

# Frontend
cd frontend && npm install && npm start
```

## Live Demo

- Frontend: https://debate-arena-i28s.vercel.app
- Backend: https://debate-arena-production-a239.up.railway.app
