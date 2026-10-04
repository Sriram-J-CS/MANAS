# DESIGN.md: AI Digital Mental Twin

Use this as the single source of truth for look and feel. Paste it into Google Stitch and keep it in the repo root for Antigravity.

## 1. Feeling
Calm, warm, friendly, safe. Never clinical, never childish, never noisy. Think "a kind friend in a quiet room."

## 2. Color tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #FAF7F2 | #121A22 | App background (warm off-white) |
| `--surface` | #FFFFFF | #1B2631 | Cards, chat bubbles, sheets |
| `--text` | #1F2A37 | #E8EEF3 | Main text |
| `--text-muted` | #5B6673 | #A9B6C2 | Secondary text |
| `--primary` | #276E8B | #6FB7D3 | Buttons, links, user bubble |
| `--primary-hover` | #1F5A73 | #8CC6DC | Hover / pressed |
| `--sage` | #5FA88B | #6FBF9F | Calm accents, success, exercises |
| `--lavender` | #A99BE0 | #B7ACEA | Mascot accents, highlights |
| `--help` | #B84A33 | #E07B63 | Help & Safety button only (warm coral, never harsh red) |
| `--border` | #E6E0D6 | #2B3947 | Dividers |

**Mood scale** (always paired with an emoji and a text label, never color alone): 1 `#6C7FB8` (very low), 2 `#8FA7CC` (low), 3 `#B8C4CE` (okay), 4 `#8CCBA9` (good), 5 `#5FB58C` (great).

Rules: text contrast at least 4.5:1 (check with a contrast tool); no pure black or pure white backgrounds in dark mode; gradients only as very soft two-tone backgrounds behind the mascot.

## 3. Typography
- **Headings and body:** Nunito (rounded, friendly). Weights 400, 600, 800.
- **Tamil:** Noto Sans Tamil. **Hindi:** Noto Sans Devanagari. **Telugu/Malayalam/Kannada:** matching Noto Sans families. Always set a full fallback stack.
- Base size 16 px (chat text 17 px). Line height 1.6 (**1.7 for Tamil and other Indic scripts**, which need more room).
- Type scale: 14 / 16 / 18 / 22 / 28 / 36. User can raise text size in Settings up to 150%.
- Optional accessibility toggle: Atkinson Hyperlegible or a dyslexia-friendly font.

## 4. Shape, spacing, depth
- 8 px spacing grid. Screen padding 16 px (mobile), content max width 720 px (chat), 1080 px (dashboard).
- Radius: cards 16 px, sheets and large panels 24 px, buttons and chips fully rounded.
- Shadows: one soft shadow only (`0 4px 16px rgba(31,42,55,0.08)`).
- Touch targets at least 48 px. Primary mic button 72 px (v2), send button 48 px.
- Icons: Lucide, 2 px stroke, rounded.

## 5. Components
- **Chat bubbles:** user = `--primary` with white text, right-aligned; bot = `--surface` with border, left-aligned. Max width 80%. Show captions live while the mascot "speaks."
- **Typing indicator:** three soft dots, slow pulse.
- **Buttons:** primary (filled), secondary (outlined), text button. Help button is always visible in the top bar with the `--help` color and a heart-hand icon.
- **Mood picker:** 5 large emoji buttons with labels beneath.
- **Consent toggles:** large switch, title, one plain sentence, "learn more" link. Nothing pre-checked except what chat needs.
- **Cards:** exercise cards, insight cards ("You've felt lower on Tuesdays this week").
- **Empty and loading states:** always a friendly sentence and the mascot, never a blank screen.

## 6. Motion
- 200 to 300 ms ease-out for transitions. Framer Motion.
- Breathing exercise: circle expands 4 s in, contracts 6 s out, with text cues.
- Mascot idle: blink every 3 to 5 s, slow breathing bob.
- **Respect `prefers-reduced-motion`** (turn off all non-essential animation).
- No confetti, streak-shaming, or urgent red pulses.

## 7. Mascot style guide
- **Look:** flat-vector cartoon, head and shoulders, big friendly eyes, rounded shapes, 3 px outline in `#2B3A4A`, one tone of shading at most, simple hands optional.
- **Personalization (v2):** hair style and color, skin tone, glasses, and clothing color are taken from the user's photo (attribute-based), then the user can edit them. Never photorealistic.
- **Default mascot (v1):** a gender-neutral character with soft teal hoodie and lavender accents. Name and pronouns to be decided by the team.
- **Expressions (v1 uses the first three):** neutral, happy, concerned (calm, soft brows, no smile), then calm, thinking, tired.
- **States:** idle, listening (head tilt), thinking (eyes up), speaking (mouth animated), safety mode (calm concerned face, **no bouncing, no smiling**).
- **Mouth shapes (v2 lip-sync):** closed, small open, wide open, round, teeth-smile.
- **File format:** SVG layers or 1024 x 1024 PNG with transparent background. Names: `mascot_neutral.png`, `mascot_concerned.png`, `mouth_round.png`.

## 8. Screen descriptions (paste into Stitch)

1. **Welcome:** large mascot centered on a soft two-tone lavender-to-cream background, headline "Hi, I'm here to listen," subline "A friendly space to talk and check in with yourself," one primary button "Get started," small text link "I already have an account." Footer note: "This is an AI companion, not a doctor or therapist."
2. **Sign up / Log in:** minimal form, email and "Continue with Google," short privacy line.
3. **About you:** stepper (3 steps), nickname, age group chips, student or professional, language picker (English, தமிழ்), goal chips (exams, work stress, sleep, loneliness, other).
4. **Consent:** list of toggle cards with plain text; a required "I understand this is not medical care" checkbox.
5. **Home / Chat:** mascot in the top third with caption strip; message list; bottom text field with send button; a small mood emoji shortcut; Help button in the top bar. (v2: large mic button.)
6. **Mood check-in:** "How are you feeling right now?" with 5 emoji, tag chips, optional note, "Save."
7. **Dashboard:** today's mood card, 7-day mood line chart with emoji markers, top tags, one gentle insight sentence, a small "Try a 2-minute breathing break" card.
8. **Help & Safety:** calm layout; big card "Talk to someone now" with Tele-MANAS 14416 (free, 24/7) and emergency 112 as tap-to-call buttons; "Reach out to someone you trust" card; short coping tools.
9. **Settings and privacy:** language, text size slider, dark mode, data controls (export, delete), consent toggles.

## 9. Accessibility checklist
Labels on every control · full keyboard use · visible focus ring (3 px `--primary`) · 4.5:1 contrast · text scales to 150% without breaking layout · captions for all mascot speech · never color-only meaning · works one-handed on a 360 px wide phone.

## 10. Prompt for Google Stitch
"Design a mobile-first mental wellness web app with a calm, warm look: warm off-white background (#FAF7F2), teal-blue primary (#276E8B), sage and lavender accents, rounded shapes, Nunito font, and a friendly flat-vector cartoon mascot. Screens: Welcome, Sign up, About you (3-step), Consent (toggle cards), Chat (mascot on top, bubbles, text input, Help button), Mood check-in (5 emoji), Dashboard (7-day mood chart), Help & Safety (tap-to-call cards), Settings. Follow the tokens and components in this DESIGN.md. Include a dark mode."
