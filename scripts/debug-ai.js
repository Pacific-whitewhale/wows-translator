const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'));
const ai = config.ai;

const SYSTEM_PROMPT = `You are a sarcastic "slang decoder" for the game World of Warships. Players type short complaints/commands in battle chat (English or Chinese). Your job: reveal what they REALLY mean — usually passive-aggressive blame-shifting or salt.

Return ONLY a JSON object (no markdown, no backticks, no other text) with exactly these fields:
- "phrase": the original input
- "surface_meaning": literal/dictionary meaning, in Chinese, 10-20 characters
- "real_meaning": the humorous TRUE meaning — expose the salt, blame, or cope, in Chinese, 20-50 characters
- "salt_score": saltiness 0-100 (integer)
- "blame_score": blame-shifting tendency 0-100 (integer)
- "reply": a witty comeback the player can paste into chat, in Chinese, 10-30 characters
- "tags": array of 2-4 Chinese tags like ["甩锅","抱怨","嘲讽"]`;

const testPhrase = 'why no one push';

async function test() {
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
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Given this chat phrase: "${testPhrase}"\n\nReturn ONLY a JSON object (no markdown, no backticks) with exactly the fields specified above.` }
      ]
    })
  });

  console.log('Status:', resp.status);
  const data = await resp.json();

  if (!resp.ok) {
    console.log('ERROR:', JSON.stringify(data, null, 2).slice(0, 500));
    return;
  }

  console.log('Model:', data.model);
  console.log('Tokens:', data.usage);
  console.log('');

  const msg = data.choices[0].message;
  console.log('--- reasoning_content (first 200 chars) ---');
  console.log((msg.reasoning_content || '(none)').slice(0, 200));
  console.log('');
  console.log('--- content ---');
  console.log(msg.content);
  console.log('');

  // Try to parse
  const raw = msg.content.trim();
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    const result = JSON.parse(json);
    console.log('✅ Parsed successfully!');
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('❌ JSON parse error:', e.message);
    console.log('Raw JSON string:');
    console.log(json);
  }
}

test().catch(e => console.error('Fatal:', e));
