"""Which language the call actually happened in.

Script ranges settle it when the transcript is in Sinhala or Tamil letters, but
Gemini Live routinely returns spoken Sinhala as Latin text ("mage report eka
ready da", "puluwanda balanna"), and a pure-script test scores every one of
those as English. So a short list of Sinhala function words — the ones that
carry a sentence and effectively never appear in English — decides those.

The tally rule is deliberately asymmetric: a Sinhala or Tamil turn is strong
evidence, while English turns on these calls are noisy (the caller's own
"okay", "thank you", "report", and every Latinised Sinhala line the word list
misses). So any real Sinhala presence outweighs a plurality of English, and an
empty tally falls back to the house language.
"""

import re

_SINHALA = re.compile(r"[඀-෿]")
_TAMIL = re.compile(r"[஀-௿]")

# Latinised Sinhala markers. Chosen for words that are structural (verbs,
# pronouns, question words) rather than nouns, since nouns are exactly where
# English loanwords live.
_ROMANIZED_SINHALA = re.compile(
    r"\b("
    r"puluwan\w*|baa|bae|nadda|naedda|thiyen\w*|tiyen\w*|kohomada|monawa\w*|"
    r"kau?da|oyage|oyata|oyala\w*|mage|mata|mama|kenek|tikak|dennako?|"
    r"karann\w*|gann\w*|balann\w*|kiyann\w*|denn\w*|enn\w*|yann\w*|"
    r" available da|ready da|sinhalen|hariyata|hondai|hondayi|awada|awa da"
    r")\b",
    re.IGNORECASE,
)


def detect_utterance(text: str) -> str:
    """One turn -> "si" | "ta" | "en"."""
    if not text:
        return "en"
    if _SINHALA.search(text):
        return "si"
    if _TAMIL.search(text):
        return "ta"
    if _ROMANIZED_SINHALA.search(text):
        return "si"
    return "en"


def call_locale(utterances: list[str], default: str = "si") -> str:
    """The language to remember this call in, from everything the caller said."""
    counts = {"si": 0, "ta": 0, "en": 0}
    for line in utterances:
        counts[detect_utterance(line)] += 1
    if counts["si"] and counts["si"] >= counts["ta"]:
        return "si"
    if counts["ta"]:
        return "ta"
    if counts["en"]:
        return "en"
    return default
