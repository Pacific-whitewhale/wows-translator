# Fuzzy Matching Algorithm

This document explains the multi-stage fuzzy matching pipeline used by WoWS Translator to match user input against the built-in phrase dictionary.

## Pipeline Overview

```
User Input → Normalize → Exact Phrase → Exact Alias → Contains → Keyword → Fuzzy Composite → Threshold Gate → Result
```

## 1. Normalization (`normalizeText`)

The input is preprocessed to maximize matching chances:

### English
- Convert to lowercase
- Trim leading/trailing whitespace
- Collapse multiple spaces into one
- Remove punctuation (keep letters, digits, spaces, CJK characters)

### Abbreviation Expansion (`expandAbbreviations`)
- `supp` → `support`
- `pls` / `plz` → `please`
- `bb` → `battleship`
- `dd` → `destroyer`
- `cv` → `carrier`
- `cap` → `capture`
- `camping` → `camp`
- `spotting` → `spot`

### Chinese Normalization (`normalizeChineseExpressions`)
- `咋` / `为啥` / `为啥子` → `为什么`
- `没一个` / `没人了` → `没人`
- `没支援` / `没帮助` → `没有支援`
- `抓我` / `一直抓我` → `一直抓我`

## 2. Exact Matching

The normalized input is compared against:
1. The `phrase` field of each entry — if identical, **exact match** (score = 1.0)
2. Each entry in the `aliases` array — if identical, **alias match** (score = 0.98)

## 3. Contains Matching

If the normalized input contains the phrase (or vice versa), or contains any alias, this is a **contains match** (score = 0.85).

## 4. Keyword Matching

The input is tokenized and compared against the phrase's `keywords` and `tags` arrays. The overlap ratio determines the keyword score.

## 5. Fuzzy Composite Score

For cases that don't match exactly/contains, a composite score is calculated:

```
composite = Levenshtein × 0.45 + Jaccard × 0.35 + Keyword × 0.20
```

### Levenshtein Distance
Edit distance between two strings — how many single-character edits (insert, delete, substitute) are needed to transform one into the other.

**Normalized**: `1 - distance / max(a.length, b.length)`

### Jaccard Token Similarity
Token-level overlap measure:

```
Jaccard = |intersection(A, B)| / |union(A, B)|
```

Where A and B are token sets obtained via `tokenizeText()`.

### Keyword Overlap
Token overlap between user input tokens and all of the phrase's text fields (phrase, aliases, keywords, tags).

## 6. Threshold Gating

| Score Range | Level | Behavior |
|-------------|-------|----------|
| ≥ 0.90 | Confident | Show full result |
| 0.72–0.89 | Fuzzy | Show full result with confidence % |
| 0.58–0.71 | Low Confidence | Show result with accuracy warning |
| < 0.58 | Fallback | Show default meme reply |

## 7. Edge Cases

### Isolated Common Words
Single-word inputs that match common game terms (`team`, `help`, `spot`, `push`, `noob`, `report`, `gg`) are restricted to exact/contains matching only — they won't fuzzy-match to unrelated phrases.

### `gg` Handling
`gg` is treated as an exact-match phrase with its own entry (not a generic abbreviation).

### `bb?` Handling
After removing the `?` character, `bb` is expanded to `battleship`, which then matches against phrases with `battleship` in their keywords (e.g., "bb push").

### `hello world` → Fallback
Completely unrelated input that doesn't match any phrase returns the default fallback reply.

## 8. Match Type Display

| Match Type | Display Text |
|------------|-------------|
| `exact` | 内置词库 · 精确匹配 · 100% |
| `alias` | 内置词库 · 别名匹配 · 98% |
| `contains` | 内置词库 · 包含匹配 · 85% |
| `fuzzy` | 内置词库 · 模糊匹配 · XX% |
| `fuzzy_low` | 内置词库 · 低置信度匹配 · XX%（该结果可能不完全准确） |
| `fallback` | 未命中词库 · 默认回复 |
| `random` | 内置词库 · 随机换词 · 100% |
