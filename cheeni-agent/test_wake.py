"""Quick sanity test for _wake_match phonetic matching."""
from voice.wakeword import build_wake_words, _wake_match

words = build_wake_words("Sam")
print(f"Total wake words: {len(words)}")
print(f"'sharma' in wake words: {'sharma' in words}")
print()

phrases = [
    "sharma you able to",        # user said "Hello Sam, are you able to?"
    "hello sam",
    "hey sam",
    "hey shyam",
    "shama please",
    "virat kohli",               # false-positive check
    "saharsa shahar",            # should NOT fire ('sa' boundary check)
    "sab kuch ho gaya",          # 'sab' as bare word should fire
    "abe saharsa shahar",        # should NOT fire
    "kya kar raha hai batao",    # should NOT fire
]

print(f"{'Phrase':<35} -> Match")
print("-" * 55)
for p in phrases:
    result = _wake_match(p, words)
    marker = "FIRES!" if result else "no match"
    print(f"{p!r:<35} -> {result!r} [{marker}]")
