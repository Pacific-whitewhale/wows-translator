# Contributing Phrases

Thank you for helping expand the WoWS Translator phrase library! This guide explains how to contribute new phrase entries.

## Phrase Entry Format

Each entry in `phrases.json` follows this structure:

```json
{
  "phrase": "original chat text",
  "aliases": ["alternative wordings...​"],
  "keywords": ["search keywords...​"],
  "surface_meaning": "What it literally says",
  "real_meaning": "What they really mean",
  "salt_score": 0,
  "blame_score": 0,
  "reply": "Recommended comeback",
  "tags": ["category", "mood"]
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `phrase` | string | The original chat phrase (keep original casing for display) |
| `aliases` | string[] | Alternative ways players might type this |
| `keywords` | string[] | Search keywords that should trigger this match |
| `surface_meaning` | string | Literal translation — what a new player would read |
| `real_meaning` | string | The true intent — what the player actually means |
| `salt_score` | number (0–100) | How salty/angry the message is |
| `blame_score` | number (0–100) | How much the message shifts blame onto others |
| `reply` | string | A suitable (or humorously unsuitable) recommended comeback |
| `tags` | string[] | Categories: 甩锅, 抱怨, 指令, 自嘲, 举报, 结束语, etc. |

## Guidelines

### Choosing a Good Phrase

- Phrases should be commonly seen in World of Warships chat
- Include both English and Chinese variants
- Prioritize meme potential — the translator is meant to be entertaining

### Writing Aliases

- Include common typos and abbreviations
- Include the phrase with and without punctuation
- Think about what a frustrated player might actually type

### Writing Keywords

- Include all important words that should trigger this match
- Include translations of key terms (e.g., both `support` and `支援`)
- Keywords should be specific enough to avoid false matches

### Scoring Salt & Blame

- **Salt (0–100)**: How angry/upset the message suggests the player is
  - 0–30: Calm, factual, or genuinely asking
  - 30–60: Mildly annoyed
  - 60–85: Clearly tilted
  - 85–100: Maximum sodium levels
- **Blame (0–100)**: How much the message deflects responsibility
  - 0–20: Self-deprecating or accepting
  - 20–60: Neutral observation
  - 60–90: Pointing fingers
  - 90–100: Pure deflection

### Writing Replies

- Replies should be funny but not genuinely toxic
- Self-deprecating humor is preferred over attacking others
- Chinese replies can use 网络用语 and internet slang
- See [tone_guide.md](tone_guide.md) for detailed tone guidelines

## Pull Request Process

1. Fork the repository
2. Add your phrase entry/entries to `data/phrases.json`
3. Make sure the JSON is valid (`npm test` or use a JSON validator)
4. Add a brief description of what you added
5. Submit a pull request

## Example Entry

Here is the entry for "no support":

```json
{
  "phrase": "no support",
  "aliases": ["no help", "team no support", "where support", "where is support", "no supp"],
  "keywords": ["support", "help", "team"],
  "surface_meaning": "缺少队友支援。",
  "real_meaning": "我冲到了一个没人能救的位置，但我希望你看到并质疑团队而不是我。",
  "salt_score": 82,
  "blame_score": 90,
  "reply": "支援在路上，只是路比较远。",
  "tags": ["甩锅", "支援", "抱怨"]
}
```

This entry can be matched by input like: `no support`, `no supp`, `where support??`, `team no help`, `where is support`.

Thank you for contributing!
