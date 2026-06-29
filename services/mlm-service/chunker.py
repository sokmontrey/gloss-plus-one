"""
Split long text into sentence chunks so each fits within the model's 512-token limit.
Returns chunks with their start offset in the original text so callers can adjust
token offsets back to original coordinates.
"""

import re


def chunk_text(text: str, max_chars: int = 2000) -> list[tuple[str, int]]:
    """
    Split text on sentence boundaries (.!?) and return (chunk_text, start_offset) pairs.
    Chunks are kept small enough that tokenization won't exceed 512 tokens in practice.
    max_chars is a conservative character budget per chunk.
    """
    if not text:
        return []

    # Split on sentence-ending punctuation followed by whitespace
    sentence_ends = [m.end() for m in re.finditer(r"[.!?]\s+", text)]

    chunks: list[tuple[str, int]] = []
    prev = 0

    for end in sentence_ends:
        segment = text[prev:end].rstrip()
        if not segment:
            prev = end
            continue

        # If segment is still huge, split further at max_chars boundary (hard cut)
        while len(segment) > max_chars:
            chunks.append((segment[:max_chars], prev))
            segment = segment[max_chars:]
            prev += max_chars

        chunks.append((segment, prev))
        prev = end

    # Trailing text with no sentence-ending punctuation
    tail = text[prev:].strip()
    if tail:
        while len(tail) > max_chars:
            chunks.append((tail[:max_chars], prev))
            tail = tail[max_chars:]
            prev += max_chars
        if tail:
            chunks.append((tail, prev))

    return chunks
