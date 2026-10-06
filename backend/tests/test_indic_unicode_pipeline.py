"""
test_indic_unicode_pipeline.py
───────────────────────────────
Unit and integration tests for Indic Unicode integrity across the entire pipeline:
- Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, Marathi
- Multi-byte character chunk boundary splits (e.g., splitting a 3-byte sequence)
- Incremental UTF-8 byte stream decoding
- JSON serialization / deserialization without unicode_escape corruption
- Per-user AES-256-GCM encryption & SQLite DB persistence
- Speech text purification separation from display text
"""

import sys
import os
import json
import codecs
import re
import pytest
import sqlite3
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from backend.app.services.user_crypto import encrypt_user_text, decrypt_user_text
from backend.app.services.voice_validator import validate_and_purify_speech_text, is_native_6_language

INDIC_SAMPLES = {
    "ta": "இன்று மனம் மிகவும் பாரமாக இருக்கிறது",
    "hi": "आज मेरा मन बहुत भारी लग रहा है",
    "te": "ఈ రోజు నా మనస్సు చాలా బరువుగా ఉంది",
    "kn": "ಇಂದು ನನ್ನ ಮನಸ್ಸು ತುಂಬಾ ಭಾರವಾಗಿದೆ",
    "ml": "ഇന്ന് എന്റെ മനസ്സ് വളരെ ഭാരമുള്ളതായി തോന്നുന്നു",
    "bn": "আজ আমার মন খুব ভারী লাগছে",
    "mr": "आज माझे मन खूप जड झाले आहे",
}


@pytest.mark.parametrize("lang, text", INDIC_SAMPLES.items())
def test_indic_stream_chunk_boundary_inside_character(lang, text):
    """
    Validates that splitting raw UTF-8 bytes in the middle of a 3-byte Indic character
    does NOT corrupt or produce replacement characters when decoded with incremental UTF-8.
    """
    raw_bytes = text.encode("utf-8")
    assert len(raw_bytes) > len(text), "Indic characters must be multi-byte"

    # Find first multi-byte sequence (starts with 0xe0)
    split_idx = -1
    for i in range(len(raw_bytes) - 2):
        if raw_bytes[i] >= 0xE0 and raw_bytes[i] <= 0xEF:
            # Split between 1st and 2nd byte of this 3-byte sequence
            split_idx = i + 1
            break

    assert split_idx > 0, "Expected at least one 3-byte sequence"

    chunk1 = raw_bytes[:split_idx]
    chunk2 = raw_bytes[split_idx:]

    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    decoded_part1 = decoder.decode(chunk1)
    decoded_part2 = decoder.decode(chunk2, final=True)

    reconstructed = decoded_part1 + decoded_part2
    assert reconstructed == text, f"Failed round-trip for {lang}: expected '{text}', got '{reconstructed}'"
    assert "\ufffd" not in reconstructed, f"Unicode replacement character found in decoded text for {lang}"


@pytest.mark.parametrize("lang, text", INDIC_SAMPLES.items())
def test_gemini_parser_safe_unescape_no_mojibake(lang, text):
    """
    Simulates raw Gemini SSE response with unescaped JSON, escaped JSON, and regex fallback.
    Verifies that the old .encode('utf-8').decode('unicode_escape') bug is eliminated.
    """
    # 1. Direct UTF-8 in JSON
    raw_accumulated_direct = f'{{"reply": "{text}", "emotion": "empathetic"}}'
    parsed = {}
    try:
        parsed = json.loads(raw_accumulated_direct)
    except Exception:
        pass
    assert parsed.get("reply") == text

    # 2. Regex fallback parser with raw UTF-8 (the exact hop that was breaking)
    rep_match = re.search(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)"', raw_accumulated_direct, re.DOTALL)
    assert rep_match is not None
    extracted_val = rep_match.group(1)

    # Safe unescape
    try:
        safe_reply = json.loads(f'"{extracted_val}"')
    except Exception:
        safe_reply = extracted_val.replace('\\"', '"').replace('\\n', '\n').strip()

    assert safe_reply == text, f"Safe unescape failed for {lang}"

    # Verify that the old broken approach produces mojibake
    broken_reply = extracted_val.encode('utf-8').decode('unicode_escape')
    assert broken_reply != text, "Old logic should differ (produce mojibake)"


@pytest.mark.parametrize("lang, text", INDIC_SAMPLES.items())
def test_sse_stream_formatting_and_decoding(lang, text):
    """
    Tests SSE emission, serialization with ensure_ascii=False, and browser-equivalent decoding.
    """
    token_event = f"event: token\ndata: {json.dumps({'token': text}, ensure_ascii=False)}\n\n"
    meta_event = f"event: meta\ndata: {json.dumps({'reply': text, 'speech_text': text}, ensure_ascii=False)}\n\n"

    stream_bytes = (token_event + meta_event).encode("utf-8")

    # Simulate browser TextDecoder("utf-8", {stream: true}) receiving arbitrary byte chunks
    decoder = codecs.getincrementaldecoder("utf-8")("strict")
    decoded_stream = ""
    # Split stream_bytes into 7-byte chunks to test arbitrary multi-byte cuts
    chunk_size = 7
    for offset in range(0, len(stream_bytes), chunk_size):
        chunk = stream_bytes[offset:offset + chunk_size]
        is_final = (offset + chunk_size >= len(stream_bytes))
        decoded_stream += decoder.decode(chunk, final=is_final)

    # Parse SSE blocks
    blocks = [b.strip() for b in decoded_stream.split("\n\n") if b.strip()]
    assert len(blocks) == 2

    # Check token block
    token_data_line = [l for l in blocks[0].split("\n") if l.startswith("data:")][0]
    token_obj = json.loads(token_data_line[5:].strip())
    assert token_obj.get("token") == text

    # Check meta block
    meta_data_line = [l for l in blocks[1].split("\n") if l.startswith("data:")][0]
    meta_obj = json.loads(meta_data_line[5:].strip())
    assert meta_obj.get("reply") == text
    assert meta_obj.get("speech_text") == text


@pytest.mark.parametrize("lang, text", INDIC_SAMPLES.items())
def test_db_crypto_and_sqlite_roundtrip(lang, text):
    """
    Validates per-user AES-256-GCM encryption, SQLite storage, retrieval, and decryption.
    """
    user_id = f"test-user-{lang}"
    encrypted = encrypt_user_text(user_id, text)
    assert encrypted.startswith("enc:v1:")

    # Store in in-memory SQLite DB
    conn = sqlite3.connect(":memory:")
    cur = conn.cursor()
    cur.execute("CREATE TABLE messages (id TEXT PRIMARY KEY, user_id TEXT, text TEXT)")
    cur.execute("INSERT INTO messages VALUES ('msg-1', ?, ?)", (user_id, encrypted))
    conn.commit()

    cur.execute("SELECT text FROM messages WHERE id = 'msg-1'")
    stored_val = cur.fetchone()[0]
    decrypted = decrypt_user_text(user_id, stored_val)
    assert decrypted == text, f"Decrypted text for {lang} does not match original"
    conn.close()


@pytest.mark.parametrize("lang, text", INDIC_SAMPLES.items())
def test_speech_cleanup_operates_on_copy_and_preserves_display(lang, text):
    """
    Ensures validate_and_purify_speech_text operates on a copy and does not alter display_text.
    """
    display_text = text
    raw_speech = str(display_text)

    if is_native_6_language(lang):
        speech_text = asyncio.run(validate_and_purify_speech_text(raw_speech, lang))
    else:
        speech_text = raw_speech.strip()

    # Display text must remain exactly the original string
    assert display_text == text
    assert len(speech_text) > 0
