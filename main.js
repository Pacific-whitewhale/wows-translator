const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// AI config
let aiConfig = null;
try {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    aiConfig = raw.ai || null;
  }
} catch (e) {
  console.error('[AI] Failed to load config.json:', e.message);
}

// AI cache (main-process level, cleared on restart)
const aiCache = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 560,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // Force screen-saver level to stay above fullscreen games
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

// ── System prompt for AI translation ────────────────────
const SYSTEM_PROMPT = `You are a sarcastic "slang decoder" for the game World of Warships. Players type short complaints/commands in battle chat (English or Chinese). Your job: reveal what they REALLY mean — usually passive-aggressive blame-shifting or salt.

Return ONLY a JSON object (no markdown, no backticks, no other text) with exactly these fields:
- "phrase": the original input
- "surface_meaning": literal/dictionary meaning, in Chinese, 10-20 characters
- "real_meaning": the humorous TRUE meaning — expose the salt, blame, or cope, in Chinese, 20-50 characters
- "salt_score": saltiness 0-100 (integer)
- "blame_score": blame-shifting tendency 0-100 (integer)
- "reply": a witty comeback the player can paste into chat, in Chinese, 10-30 characters
- "tags": array of 2-4 Chinese tags like ["甩锅","抱怨","嘲讽"]`;

// ── AI translate IPC ────────────────────────────────────
ipcMain.handle('ai-translate', async (_event, text) => {
  if (!aiConfig || !aiConfig.apiKey || aiConfig.apiKey === 'sk-ant-your-key-here') {
    return { error: 'no_config' };
  }

  const cacheKey = text.trim();
  if (aiCache.has(cacheKey)) {
    return { result: aiCache.get(cacheKey) };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const provider = aiConfig.provider || 'anthropic';
    let resp, data, raw;

    // ── Anthropic API ──────────────────────────────────
    if (provider === 'anthropic') {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiConfig.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: aiConfig.model || 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: SYSTEM_PROMPT + '\n\nGiven this chat phrase: "' + text + '"' }]
        })
      });

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => '');
        clearTimeout(timeout);
        return { error: 'api_error', detail: `${resp.status}: ${errBody.slice(0, 200)}` };
      }

      data = await resp.json();
      clearTimeout(timeout);
      raw = data.content[0].text.trim();
    } else {
      // ── DeepSeek / OpenAI-compatible (default) ────────
      const baseUrl = aiConfig.baseUrl || 'https://api.deepseek.com/v1';
      resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: aiConfig.model || 'deepseek-chat',
          max_tokens: 400,
          temperature: 0.7,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Given this chat phrase: "${text}"\n\nReturn ONLY a JSON object (no markdown, no backticks) with exactly the fields specified above.` }
          ]
        })
      });

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => '');
        clearTimeout(timeout);
        return { error: 'api_error', detail: `${resp.status}: ${errBody.slice(0, 200)}` };
      }

      data = await resp.json();
      clearTimeout(timeout);
      raw = data.choices[0].message.content.trim();
    }

    // Parse JSON from response
    const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const result = JSON.parse(json);
    aiCache.set(cacheKey, result);
    return { result };

  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      return { error: 'timeout' };
    }
    return { error: 'exception', detail: e.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
