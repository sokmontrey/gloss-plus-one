"""
Curated phrasal verbs and idioms for the PhraseMatcher.

Add domain-specific phrases here without touching matching logic in splitter.py.

Limitation: PhraseMatcher with LEMMA matches inflected forms ("gave up" matches
"give up") but NOT split phrasal verbs ("give it up", "look him up"). Accept for v1.
"""

PHRASAL_VERBS = [
    "give up",
    "look for",
    "look up",
    "look after",
    "look forward to",
    "pick up",
    "put off",
    "put up with",
    "run into",
    "run out of",
    "take off",
    "take over",
    "turn down",
    "turn on",
    "turn off",
    "get up",
    "get along",
    "get over",
    "go on",
    "go through",
    "come up with",
    "come across",
    "break down",
    "break up",
    "figure out",
    "find out",
    "hang out",
    "show up",
    "work out",
    "set up",
    "set off",
    "carry out",
    "bring up",
    "deal with",
]

IDIOMS = [
    "kick the bucket",
    "piece of cake",
    "break a leg",
    "hit the books",
    "under the weather",
    "once in a while",
]
