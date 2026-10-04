# EmotiCare AI — Safety & Crisis Architecture

## 1. Safety-First AI Pipeline

The conversational pipeline enforces a strict hierarchical processing sequence where **safety checks execute before any LLM generation**:

```
USER INPUT
    │
    ▼
[ STAGE 1: SAFETY TRIAGE & CRISIS SCANNER ]
    │  ├─ Imminent Crisis (suicide, self-harm, severe abuse)
    │  ├─ Clinical Boundary (diagnosis request, medication request)
    │  └─ Safe / General Wellness Query
    │
    ├─ If IMMINENT CRISIS:
    │     ► Immediately halt generation
    │     ► Inject empathetic stabilizing response
    │     ► Surface Tele-MANAS (14416) & Emergency (112) helplines
    │     ► Surface Safety Plan quick access trigger
    │
    ▼
[ STAGE 2: EMOTION & INTENT UNDERSTANDING ]
    │
    ▼
[ STAGE 3: DIGITAL TWIN PERSONALIZATION & OCEAN ADAPTATION ]
    │
    ▼
[ STAGE 4: AUTHORIZED KNOWLEDGE & MEMORY RETRIEVAL ]
    │
    ▼
[ STAGE 5: RESPONSE GENERATION ]
    │
    ▼
[ STAGE 6: SAFETY CRITIC & POST-PROCESSING ]
    │  ├─ Verify no medical claims made
    │  ├─ Verify no prescriptive medication advice
    │  └─ Verify empathetic tone and language fidelity
    │
    ▼
DELIVERY TO USER (STREAMING AUDIO + VISEMES + TEXT)
```

---

## 2. Non-Clinical Companion Guarantee

EmotiCare AI strictly refuses to act as a diagnostic or medical system:
1. **No Diagnostic Labeling**: The companion will never state *"You have depression"*, *"You have ADHD"*, or *"You are bipolar"*.
2. **Refusal Template**: When asked to diagnose symptoms or interpret clinical scales, the companion responds:
   > *"I cannot provide a clinical diagnosis or medical evaluation. I am an emotional wellness companion here to listen, support, and help you reflect. If you are experiencing persistent distress, please speak with a qualified mental health professional."*
3. **No Medication Advice**: The companion never prescribes, adjusts dosages, or recommends pharmaceutical compounds.

---

## 3. Verified Helplines & Crisis Integration

EmotiCare AI is integrated with India's official National Tele-Mental Health Programme:
- **Tele-MANAS**: `14416` (Toll-Free, 24/7, Multilingual across 20+ languages)
- **National Emergency Number**: `112`
- **KIRAN Mental Health Helpline**: `1800-599-0019`
- **NIMHANS Psychosocial Support**: `080-46110007`
- **Vandrevala Foundation**: `9999 666 555`
- **Childline India**: `1098`
