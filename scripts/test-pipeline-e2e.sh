#!/usr/bin/env bash
# End-to-end pipeline test — hits all 3 Python services + edge function.
# Usage: bash scripts/test-pipeline-e2e.sh
#
# Requires:
#   - lexicon-service on :8001
#   - mlm-service on :8002
#   - translation-service on :8003
#   - supabase functions serve (edge function on :54321)

set -uo pipefail

ANON_KEY=$(supabase status 2>/dev/null | grep 'Publishable' | awk '{print $NF}')
if [ -z "$ANON_KEY" ]; then
  echo "ERROR: Could not extract publishable key from 'supabase status'"
  exit 1
fi

# Sign in to get a JWT access token
AUTH_RESPONSE=$(curl -s -X POST "http://localhost:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@local.dev","password":"password123"}')

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
if [ -z "$ACCESS_TOKEN" ]; then
  echo "ERROR: Auth failed. Response: $AUTH_RESPONSE"
  exit 1
fi

EDGE_URL="http://localhost:54321/functions/v1/replacement"
LEXICON_URL="http://localhost:8001"
MLM_URL="http://localhost:8002"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass=0
fail=0

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

call_pipeline() {
  local text="$1"
  curl -s -X POST "$EDGE_URL" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"test\",\"text\":\"$text\",\"originalLanguage\":\"en\",\"targetLanguage\":\"fr\"}"
}

call_lexicons() {
  curl -s -X POST "$LEXICON_URL/split" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"$1\"}"
}

call_mlm() {
  curl -s -X POST "$MLM_URL/recoverable_score" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"$1\"}"
}

apply_replacements() {
  # Takes original text + pipeline JSON response, applies edits right-to-left
  local text="$1"
  local json="$2"
  # Sort replacements by start descending so we can apply from end
  local sorted
  sorted=$(echo "$json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
reps = sorted(data.get('replacements', []), key=lambda r: r['start'], reverse=True)
for r in reps:
    print(f\"{r['start']}|{r['end']}|{r['replacement']}\")
")
  local result="$text"
  while IFS='|' read -r start end replacement; do
    [ -z "$start" ] && continue
    result="${result:0:$start}${replacement}${result:$end}"
  done <<< "$sorted"
  echo "$result"
}

# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}═══ Pipeline E2E Tests ═══${NC}"
echo ""

# ── Test 1: Simple sentence ──────────────────────────────────────────────────

echo -e "${YELLOW}Test 1: Simple sentence${NC}"
TEXT1="The cat sat on the mat."
echo "  input: \"$TEXT1\""

RESULT1=$(call_pipeline "$TEXT1")
REPS1=$(echo "$RESULT1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('replacements',[])))")
echo "  replacements: $REPS1"
echo "$RESULT1" | python3 -m json.tool 2>/dev/null | sed 's/^/  /'

APPLIED1=$(apply_replacements "$TEXT1" "$RESULT1")
echo -e "  applied: \"$APPLIED1\""

# Check: no overlapping replacements
OVERLAP1=$(echo "$RESULT1" | python3 -c "
import sys, json
reps = sorted(json.load(sys.stdin).get('replacements',[]), key=lambda r: r['start'])
for i in range(len(reps)-1):
    if reps[i]['end'] > reps[i+1]['start']:
        print(f\"OVERLAP: {reps[i]} vs {reps[i+1]}\")
        sys.exit(1)
print('ok')
")
if [ "$OVERLAP1" = "ok" ]; then
  echo -e "  overlap check: ${GREEN}PASS${NC}"
  ((pass++))
else
  echo -e "  overlap check: ${RED}FAIL — $OVERLAP1${NC}"
  ((fail++))
fi
echo ""

# ── Test 2: Contractions ─────────────────────────────────────────────────────

echo -e "${YELLOW}Test 2: Contractions — known problem area${NC}"
TEXT2="I'll be there and I don't know why."
echo "  input: \"$TEXT2\""

# Show lexicon split to see how contractions are handled
echo "  lexicon split:"
call_lexicons "$TEXT2" | python3 -c "
import sys, json
for lex in json.load(sys.stdin)['lexicons']:
    print(f\"    [{lex['start']:3d}:{lex['end']:3d}] {lex['text']!r:20s} ({lex['type']})\")
"

RESULT2=$(call_pipeline "$TEXT2")
echo "  pipeline output:"
echo "$RESULT2" | python3 -c "
import sys, json
for r in json.load(sys.stdin).get('replacements',[]):
    print(f\"    [{r['start']:3d}:{r['end']:3d}] {r['original']!r:12s} → {r['replacement']!r}\")
"

APPLIED2=$(apply_replacements "$TEXT2" "$RESULT2")
echo -e "  applied: \"$APPLIED2\""

# Flag if contractions like 'll or n't were replaced independently
CONTRACTION_BUG=$(echo "$RESULT2" | python3 -c "
import sys, json
reps = json.load(sys.stdin).get('replacements',[])
bad = [r for r in reps if r['original'] in (\"'ll\", \"n't\", \"'d\", \"'ve\", \"'re\", \"'s\", \"'m\")]
if bad:
    print(f\"BUG: contractions replaced independently: {[r['original'] for r in bad]}\")
    sys.exit(1)
print('ok')
")
if [ "$CONTRACTION_BUG" = "ok" ]; then
  echo -e "  contraction check: ${GREEN}PASS${NC}"
  ((pass++))
else
  echo -e "  contraction check: ${RED}FAIL — $CONTRACTION_BUG${NC}"
  ((fail++))
fi
echo ""

# ── Test 3: Content vs function word scores ──────────────────────────────────

echo -e "${YELLOW}Test 3: MLM scores — content vs function words${NC}"
TEXT3="She drove the red car to work."
echo "  input: \"$TEXT3\""

echo "  MLM token scores:"
call_mlm "$TEXT3" | python3 -c "
import sys, json
tokens = json.load(sys.stdin)['tokens']
for t in sorted(tokens, key=lambda x: -(x['score'] or 0)):
    s = f\"{t['score']:.4f}\" if t['score'] is not None else 'null'
    bar = '█' * int((t['score'] or 0) * 40)
    print(f\"    {t['text']:10s} {s:8s} {bar}\")
"

RESULT3=$(call_pipeline "$TEXT3")
echo "  replacements (threshold=0.8):"
REPS3=$(echo "$RESULT3" | python3 -c "
import sys, json
reps = json.load(sys.stdin).get('replacements',[])
if not reps: print('    (none)')
for r in reps:
    print(f\"    {r['original']!r:12s} → {r['replacement']!r}\")
print(f'  count: {len(reps)}')
")
echo "$REPS3"
echo ""

# ── Test 4: Adjective reordering ─────────────────────────────────────────────

echo -e "${YELLOW}Test 4: Adjective reordering (fr: noun before adj)${NC}"
TEXT4="She bought a red car yesterday."
echo "  input: \"$TEXT4\""

RESULT4=$(call_pipeline "$TEXT4")
echo "  pipeline output:"
echo "$RESULT4" | python3 -c "
import sys, json
reps = json.load(sys.stdin).get('replacements',[])
if not reps: print('    (none — might not pass threshold)')
for r in reps:
    print(f\"    [{r['start']:3d}:{r['end']:3d}] {r['original']!r:12s} → {r['replacement']!r}\")
"

APPLIED4=$(apply_replacements "$TEXT4" "$RESULT4")
echo -e "  applied: \"$APPLIED4\""

# If both "red" and "car" are replaced independently, flag word order issue
ADJ_BUG=$(echo "$RESULT4" | python3 -c "
import sys, json
reps = {r['original']: r['replacement'] for r in json.load(sys.stdin).get('replacements',[])}
if 'red' in reps and 'car' in reps:
    print(f\"WARNING: 'red' and 'car' replaced independently → order may be wrong (en: red car → fr: voiture rouge)\")
    sys.exit(1)
print('ok')
")
if [ "$ADJ_BUG" = "ok" ]; then
  echo -e "  adjective order check: ${GREEN}PASS (or not enough replacements to trigger)${NC}"
  ((pass++))
else
  echo -e "  adjective order check: ${RED}$ADJ_BUG${NC}"
  ((fail++))
fi
echo ""

# ── Test 5: Compound nouns and phrasal verbs ─────────────────────────────────

echo -e "${YELLOW}Test 5: Multi-word units survive pipeline${NC}"
TEXT5="She decided to give up smoking at the coffee shop."
echo "  input: \"$TEXT5\""

echo "  lexicons:"
call_lexicons "$TEXT5" | python3 -c "
import sys, json
for lex in json.load(sys.stdin)['lexicons']:
    marker = ' ◄' if lex['type'] in ('phrase','compound','entity') else ''
    print(f\"    [{lex['start']:3d}:{lex['end']:3d}] {lex['text']!r:20s} ({lex['type']}){marker}\")
"

RESULT5=$(call_pipeline "$TEXT5")
echo "  pipeline output:"
echo "$RESULT5" | python3 -c "
import sys, json
reps = json.load(sys.stdin).get('replacements',[])
if not reps: print('    (none)')
for r in reps:
    print(f\"    [{r['start']:3d}:{r['end']:3d}] {r['original']!r:12s} → {r['replacement']!r}\")
"
echo ""

# ── Test 6: Empty text ───────────────────────────────────────────────────────

echo -e "${YELLOW}Test 6: Empty text${NC}"
RESULT6=$(call_pipeline "")
REPS6=$(echo "$RESULT6" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('replacements',[])))")
if [ "$REPS6" = "0" ]; then
  echo -e "  ${GREEN}PASS — 0 replacements${NC}"
  ((pass++))
else
  echo -e "  ${RED}FAIL — expected 0, got $REPS6${NC}"
  ((fail++))
fi
echo ""

# ── Test 7: Offset integrity ────────────────────────────────────────────────

echo -e "${YELLOW}Test 7: Offset integrity — text[start:end] == original${NC}"
TEXT7="The quick brown fox jumps over the lazy dog."
RESULT7=$(call_pipeline "$TEXT7")
OFFSET_CHECK=$(echo "$RESULT7" | python3 -c "
import sys, json
text = '$TEXT7'
reps = json.load(sys.stdin).get('replacements',[])
for r in reps:
    actual = text[r['start']:r['end']]
    if actual != r['original']:
        print(f\"MISMATCH: text[{r['start']}:{r['end']}]={actual!r} != original={r['original']!r}\")
        sys.exit(1)
print('ok')
")
if [ "$OFFSET_CHECK" = "ok" ]; then
  echo -e "  ${GREEN}PASS${NC}"
  ((pass++))
else
  echo -e "  ${RED}FAIL — $OFFSET_CHECK${NC}"
  ((fail++))
fi
echo ""

# ── Test 8: Longer realistic paragraph ──────────────────────────────────────

echo -e "${YELLOW}Test 8: Realistic paragraph${NC}"
TEXT8="Machine learning will revolutionize education. Students can learn at their own pace while teachers focus on creative mentoring."
echo "  input: \"${TEXT8:0:60}...\""

RESULT8=$(call_pipeline "$TEXT8")
echo "  pipeline output:"
echo "$RESULT8" | python3 -c "
import sys, json
reps = json.load(sys.stdin).get('replacements',[])
if not reps: print('    (none)')
for r in reps:
    print(f\"    [{r['start']:3d}:{r['end']:3d}] {r['original']!r:20s} → {r['replacement']!r}\")
print(f'  total replacements: {len(reps)}')
"

APPLIED8=$(apply_replacements "$TEXT8" "$RESULT8")
echo -e "  applied: \"$APPLIED8\""
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

echo -e "${CYAN}═══ Summary ═══${NC}"
echo -e "  ${GREEN}Passed: $pass${NC}"
echo -e "  ${RED}Failed: $fail${NC}"
echo ""

if [ $fail -gt 0 ]; then
  echo -e "${YELLOW}Known issues to address:${NC}"
  echo "  1. CONTRACTIONS: spaCy splits \"I'll\" → \"I\" + \"'ll\". The MLM scores"
  echo "     \"'ll\" as highly recoverable, so it gets replaced independently."
  echo "     Result: \"I je serai\" instead of replacing the whole word."
  echo "     Fix: merge contraction tokens back into their host word in the"
  echo "     lexicon splitter, or filter them out in the pipeline."
  echo ""
  echo "  2. ADJECTIVE ORDER: French puts adjectives after nouns. If both \"red\""
  echo "     and \"car\" are replaced at their original English offsets, you get"
  echo "     \"rouge voiture\" instead of \"voiture rouge\"."
  echo "     Fix: detect adj+noun pairs and emit a single span replacement."
  echo ""
  echo "  3. THRESHOLD: 0.8 is very high — mostly only function words and"
  echo "     contractions pass. Content words rarely score above 0.3."
  echo "     Consider lowering to 0.3-0.5 for more useful replacements."
fi
