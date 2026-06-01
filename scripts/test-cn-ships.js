const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'));
const ai = config.ai;

// Replicate main.js ship knowledge builder
const shipsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ships.json'), 'utf-8'));
const cnNames = shipsData.chinese_names?.mappings || {};
const cnStr = Object.entries(cnNames).map(([k, v]) => `${k}=${v}`).join(', ');

const SYSTEM_PROMPT = `You are a sarcastic "slang decoder" for the game World of Warships. Players type short complaints/commands in battle chat (English or Chinese).

Chinese players often use Chinese ship names. Key mappings: ${cnStr}

Return ONLY a JSON object (no markdown) with: phrase, surface_meaning(CN,10-20chars,mention ship), real_meaning(CN,20-50chars,humorous), salt_score(0-100), blame_score(0-100), reply(CN,10-30chars,witty), tags(CN array).`;

async function test(phrase) {
  console.log(`\n📝 "${phrase}"`);
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
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Given this chat phrase: "${phrase}"\n\nReturn ONLY a JSON object.` }
      ]
    })
  });
  const data = await resp.json();
  const raw = data.choices[0].message.content.trim();
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const r = JSON.parse(json);
  console.log(`   表面: ${r.surface_meaning}`);
  console.log(`   真实: ${r.real_meaning}`);
  console.log(`   暴躁: ${r.salt_score}  甩锅: ${r.blame_score}`);
  console.log(`   回复: ${r.reply}`);
}

(async () => {
  await test('无比怎么还不上');
  await test('大猴蹲家半天了');
  console.log('\n✅ Done');
})().catch(e => console.error('❌', e.message));
