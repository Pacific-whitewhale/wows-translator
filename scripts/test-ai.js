// Quick test: verify AI translation API works
// Run: node scripts/test-ai.js
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.json');
if (!fs.existsSync(configPath)) {
  console.log('ERROR: config.json not found');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const ai = config.ai;
console.log(`Provider: ${ai.provider}`);
console.log(`Model: ${ai.model}`);
console.log(`API Key: ${ai.apiKey.slice(0, 15)}...`);

const testPhrase = process.argv[2] || 'why no one push';

async function testDeepSeek() {
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ai.apiKey}`
    },
    body: JSON.stringify({
      model: ai.model,
      max_tokens: 400,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are a sarcastic "slang decoder" for the game World of Warships. Players type short complaints/commands in battle chat (English or Chinese). Your job: reveal what they REALLY mean — usually passive-aggressive blame-shifting or salt.

Return ONLY a JSON object (no markdown, no backticks, no other text) with exactly these fields:
- "phrase": the original input
- "surface_meaning": literal/dictionary meaning, in Chinese, 10-20 characters
- "real_meaning": the humorous TRUE meaning, in Chinese, 20-50 characters
- "salt_score": saltiness 0-100 (integer)
- "blame_score": blame-shifting tendency 0-100 (integer)
- "reply": a witty comeback, in Chinese, 10-30 characters
- "tags": array of 2-4 Chinese tags like ["甩锅","抱怨","嘲讽"]`
        },
        { role: 'user', content: `Given this chat phrase: "${testPhrase}"\n\nReturn ONLY a JSON object (no markdown, no backticks) with exactly the fields specified above.` }
      ]
    })
  });

  console.log(`HTTP status: ${resp.status}`);
  if (!resp.ok) {
    const err = await resp.text();
    console.log('ERROR response:', err.slice(0, 500));
    process.exit(1);
  }

  const data = await resp.json();
  const raw = data.choices[0].message.content.trim();
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const result = JSON.parse(json);

  console.log('\n✅ AI translation works!');
  console.log('──────────────────────────────────────');
  console.log('Input:        ', testPhrase);
  console.log('Surface:      ', result.surface_meaning);
  console.log('Real meaning: ', result.real_meaning);
  console.log('Salt:         ', result.salt_score, '/ 100');
  console.log('Blame:        ', result.blame_score, '/ 100');
  console.log('Reply:        ', result.reply);
  console.log('Tags:         ', result.tags);
  console.log('──────────────────────────────────────');
}

async function testAnthropic() {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ai.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ai.model,
      max_tokens: 400,
      messages: [{ role: 'user', content: `You are a sarcastic slang decoder for World of Warships. Given this chat phrase: "${testPhrase}", return ONLY a JSON object (no markdown) with fields: phrase, surface_meaning (CN), real_meaning (CN, humorous), salt_score (0-100), blame_score (0-100), reply (CN, witty), tags (2-4 CN tags).` }]
    })
  });

  console.log(`HTTP status: ${resp.status}`);
  if (!resp.ok) {
    const err = await resp.text();
    console.log('ERROR response:', err.slice(0, 500));
    process.exit(1);
  }

  const data = await resp.json();
  const raw = data.content[0].text.trim();
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const result = JSON.parse(json);

  console.log('\n✅ AI translation works!');
  console.log('──────────────────────────────────────');
  console.log('Input:        ', testPhrase);
  console.log('Surface:      ', result.surface_meaning);
  console.log('Real meaning: ', result.real_meaning);
  console.log('Salt:         ', result.salt_score, '/ 100');
  console.log('Blame:        ', result.blame_score, '/ 100');
  console.log('Reply:        ', result.reply);
  console.log('Tags:         ', result.tags);
  console.log('──────────────────────────────────────');
}

const fn = ai.provider === 'anthropic' ? testAnthropic : testDeepSeek;
fn().catch(e => {
  console.log('ERROR:', e.message);
  process.exit(1);
});
