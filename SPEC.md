# SPEC.md: AI Digital Mental Twin (Product Spec, v1)

**Initiative:** MANAS TWIN - Computational Emotion & Digital Twin Research.
**Lab:** Intelligent Systems & Mental Health Computing Lab, Department of Computer Science & Engineering.

## 1. Purpose
A web app where students and working professionals talk (type first, voice later) to a friendly cartoon mascot that gives empathetic, personalized emotional support, tracks mood over time, notices early signs of rising stress, and points to professional help when needed. It is **wellness support, not therapy or diagnosis**, and it says so.

## 2. Principles (apply to every decision)
1. **Safety first:** every message is safety-checked before any reply is generated.
2. **Consent and privacy:** each data type is opt-in, deletable, and stored minimally.
3. **Honest AI:** always clear it is an AI; never diagnoses, never gives medication advice.
4. **Adapt, don't mimic:** match the user's language, pace and length, but never copy hopeless or hostile tone.
5. **Small and reliable beats big and shaky.**

## 3. Users
Students (exam stress, loneliness, sleep) and early-career professionals (workload, burnout). Languages in v1: **English and Tamil** (Tamil script and Tanglish). Age policy: **18+ only for v1** (decision needed from the team and guide).

## 4. Scope by version

| Version | Includes |
|---|---|
| **v1 (build first)** | Sign-up/login, consent toggles, onboarding, default mascot (3 expressions), streaming text chat, **safety layer**, daily mood check-in, simple mood dashboard (7-day), Help & Safety page, privacy (delete my data), English + Tamil |
| **v2** | Voice input and output (Sarvam), photo-to-mascot (attribute-based, photo deleted after), more expressions and lip-sync, breathing and grounding exercises, more languages (Hindi, Telugu, Malayalam, Kannada) |
| **v3** | Typing-speed and speaking-pace style adaptation, Digital Mental Twin trends and early-warning indicator, long-term memory page, reminders, safety plan and trusted contact, user testing and polish |
| **Later** | Voice cloning (with consent), wearables, counselor booking, institution view, native app wrapper |

## 5. v1 screens
1. **Welcome:** mascot, one-line promise, "Get started."
2. **Sign up / Log in:** email or Google.
3. **About you:** nickname, age group, student or professional, language, goals.
4. **Consent:** separate toggles (chat storage, mood tracking), plain-language text, AI disclaimer.
5. **Home / Chat:** mascot on top, message list with captions, text box, mood check-in shortcut, always-visible Help button.
6. **Mood check-in:** 5 emoji + optional tags (exams, work, sleep, people) + optional note.
7. **Dashboard:** today's mood, 7-day timeline, top tags, gentle summary sentence.
8. **Help & Safety:** Tele-MANAS 14416 (free, 24/7), emergency 112, "talk to someone you trust," plus a short list of coping tools.
9. **Settings and privacy:** language, text size, dark mode, export, delete account.

## 6. Core flow (every message)
User message → **safety check** (keyword layer + AI risk rating) → if high risk: fixed vetted crisis message, normal mode paused → else build prompt (profile, language, recent context) → LLM returns structured JSON (`reply`, `emotion`, `risk_level`, `topic_tags`, `expression`) → stream reply → save mood data (if consented) → mascot expression updates.

## 7. Data (v1 tables)
`users`, `consents`, `sessions`, `messages` (text, language, emotion, risk_level), `mood_daily` (checkin, tags), `safety_events` (level, action; no unnecessary content). Row-level security: users read only their own rows.

## 8. Tech (v1)
React + Vite + Tailwind PWA · FastAPI + WebSocket · Supabase (Postgres, Auth) · one LLM API (chosen by running the test cases) · Sentry · GitHub · Vercel + Render/Railway.

## 9. "Done" for v1
- A new user can sign up, consent, chat in English and Tamil, check in mood, see the dashboard, and delete everything.
- No reply is ever generated before the safety check finishes.
- The scripted test set (TEST_CASES.md) runs automatically; **all crisis cases (T22–T28, T30) pass every run**, and no "must not" behavior appears.
- First reply starts streaming in about 2 seconds on a normal connection.
- Accessibility basics pass (contrast, labels, keyboard use, text size).
- No secrets in the repo; privacy policy and disclaimer visible.

## 10. Decisions needed from the team
Age policy (18+ vs. parental consent) · which LLM (after testing) · who is the counselor advisor · the mascot's name and pronouns · which two languages to perfect first.
