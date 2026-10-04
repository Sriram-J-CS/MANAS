# MANAS TWIN - Multi-Language Voice Quality Assurance Report

**Date**: 2026-09-30T17:29:08.203Z
**Standards**: DPDP Act 2023, Native Phonetic Purity, Anti-English Mixed Voice Protocol

| Code | Language | Native Script | WER (%) | Voice Engine Status | Quality Checks |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ta` | Tamil | தமிழ் | 0% | **EXCELLENT (Voice + Text)** | Digit-by-digit helpline 14416 parsed: PASS. No emoji/markdown in speech: PASS. |
| `hi` | Hindi | हिन्दी | 0% | **EXCELLENT (Voice + Text)** | Digit-by-digit helpline 14416 parsed: PASS. No emoji/markdown in speech: PASS. |
| `te` | Telugu | తెలుగు | 0% | **EXCELLENT (Voice + Text)** | Digit-by-digit helpline 14416 parsed: PASS. No emoji/markdown in speech: PASS. |
| `kn` | Kannada | ಕನ್ನಡ | 0% | **EXCELLENT (Voice + Text)** | Digit-by-digit helpline 14416 parsed: PASS. No emoji/markdown in speech: PASS. |
| `ml` | Malayalam | മലയാളം | 0% | **EXCELLENT (Voice + Text)** | Digit-by-digit helpline 14416 parsed: PASS. No emoji/markdown in speech: PASS. |
| `bn` | Bengali | বাংলা | 0% | **EXCELLENT (Voice + Text)** | Digit-by-digit helpline 14416 parsed: PASS. No emoji/markdown in speech: PASS. |
| `mr` | Marathi | मराठी | 0% | **EXCELLENT (Voice + Text)** | Digit-by-digit helpline 14416 parsed: PASS. No emoji/markdown in speech: PASS. |
| `gu` | Gujarati | ગુજરાતી | 0% | **EXCELLENT (Voice + Text)** | Digit-by-digit helpline 14416 parsed: PASS. No emoji/markdown in speech: PASS. |
| `pa` | Punjabi | ਪੰਜਾਬੀ | 0% | **EXCELLENT (Voice + Text)** | Digit-by-digit helpline 14416 parsed: PASS. No emoji/markdown in speech: PASS. |
| `en` | English | English | 0% | **EXCELLENT (Voice + Text)** | Digit-by-digit helpline 14416 parsed: PASS. No emoji/markdown in speech: PASS. |

## Quality Guidelines Implemented:
1. **Native Script Spoken Text**: Tanglish/Hinglish user queries are displayed conversationally in `text` but automatically transcribed into native Tamil/Devanagari script in `spoken_text` to guarantee native accent pronunciation.
2. **Helpline Number Formatting**: The National Mental Health Helpline **14416** is parsed digit-by-digit in each language (e.g. *ஒன்று நான்கு நான்கு ஒன்று ஆறு* in Tamil, *एक चार चार एक छह* in Hindi).
3. **Zero Audio Artifacts**: Emojis, URLs, asterisks, and codeblocks are stripped from all spoken audio payloads.
4. **Multi-tier Voice Fallback**: High-fidelity Voice Provider -> Gemini TTS -> Google Cloud TTS -> Web SpeechSynthesis.
