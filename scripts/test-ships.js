const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'));
const ai = config.ai;

// Load ships and build ship knowledge (same logic as main.js)
let shipKnowledge = '';
const shipsPath = path.join(__dirname, '..', 'data', 'ships.json');
const shipsData = JSON.parse(fs.readFileSync(shipsPath, 'utf-8'));
const abbrs = shipsData.famous_abbreviations?.mappings || {};
const nations = [];
for (const [key, val] of Object.entries(shipsData)) {
  if (key === 'famous_abbreviations') continue;
  const types = [];
  if (val.destroyers?.length) types.push(`DD:${val.destroyers.slice(0, 20).join(',')}`);
  if (val.cruisers?.length) types.push(`CA/CL:${val.cruisers.slice(0, 20).join(',')}`);
  if (val.battleships?.length) types.push(`BB:${val.battleships.slice(0, 15).join(',')}`);
  if (val.aircraft_carriers?.length) types.push(`CV:${val.aircraft_carriers.slice(0, 8).join(',')}`);
  if (val.submarines?.length) types.push(`SS:${val.submarines.slice(0, 5).join(',')}`);
  if (types.length) nations.push(`${val.prefix}(${val.name_cn}): ${types.join('; ')}`);
}
const abbrStr = Object.entries(abbrs).map(([k, v]) => `${k}=${v}`).join(', ');
shipKnowledge = `\n\nShip name knowledge (recognize these in chat):\n${nations.join('\n')}\n\nCommon abbreviations: ${abbrStr}`;

const SYSTEM_PROMPT_BASE = `You are a sarcastic "slang decoder" for the game World of Warships. Players type short complaints/commands in battle chat (English or Chinese). Your job: reveal what they REALLY mean — usually passive-aggressive blame-shifting or salt.

Players often mention specific ship names or abbreviations (e.g., "Shima", "Yammy", "GK"). Recognize these in the input and tailor your translation accordingly.

Return ONLY a JSON object (no markdown, no backticks, no other text) with exactly these fields:
- "phrase": the original input
- "surface_meaning": literal/dictionary meaning, in Chinese, 10-20 characters — mention the ship name if relevant
- "real_meaning": the humorous TRUE meaning — expose the salt, blame, or cope, in Chinese, 20-50 characters
- "salt_score": saltiness 0-100 (integer)
- "blame_score": blame-shifting tendency 0-100 (integer)
- "reply": a witty comeback the player can paste into chat, in Chinese, 10-30 characters
- "tags": array of 2-4 Chinese tags like ["甩锅","抱怨","嘲讽"]`;

const fullPrompt = SYSTEM_PROMPT_BASE + shipKnowledge;

async function test(phrase) {
  console.log(`\n📝 Input: "${phrase}"`);
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ai.apiKey}`
    },
    body: JSON.stringify({
      model: ai.model,
      max_tokens: 2048,
      temperature: 0.7,
      messages: [
        { role: 'system', content: fullPrompt },
        { role: 'user', content: `Given this chat phrase: "${phrase}"\n\nReturn ONLY a JSON object (no markdown, no backticks) with exactly the fields specified above.` }
      ]
    })
  });
  const data = await resp.json();
  const raw = data.choices[0].message.content.trim();
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const r = JSON.parse(json);
  console.log(`   表面: ${r.surface_meaning}`);
  console.log(`   真实: ${r.real_meaning}`);
  console.log(`   盐分: ${r.salt_score}  甩锅: ${r.blame_score}`);
  console.log(`   回复: ${r.reply}`);
  console.log(`   标签: ${r.tags?.join(', ')}`);
}

(async () => {
  await test('our Shima no spot whole game');
  await test('Yamato why camping in base');
  console.log('\n✅ All tests passed!');
})().catch(e => console.error('❌', e.message));
