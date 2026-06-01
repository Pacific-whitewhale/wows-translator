const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// ── AI 配置 ──────────────────────────────────────────────
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

// AI 翻译结果缓存（主进程级，重启清空）
const aiCache = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 560,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    // Windows 下 'screen-saver' 是最高窗口层级，可覆盖全屏游戏
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // 强制使用 screen-saver 级别，确保覆盖全屏游戏
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

// ── AI 翻译 IPC ──────────────────────────────────────────
ipcMain.handle('ai-translate', async (_event, text) => {
  // 检查配置
  if (!aiConfig || !aiConfig.apiKey || aiConfig.apiKey === 'sk-ant-your-key-here') {
    return { error: 'no_config' };
  }

  // 检查缓存
  const cacheKey = text.trim();
  if (aiCache.has(cacheKey)) {
    return { result: aiCache.get(cacheKey) };
  }

  const prompt = `You are a sarcastic "slang decoder" for the game World of Warships. Players type short complaints/commands in battle chat (English or Chinese). Your job: reveal what they REALLY mean — usually passive-aggressive blame-shifting or salt.

Given this chat phrase: "${text}"

Return ONLY a JSON object (no markdown, no backticks, no other text) with exactly these fields:
- "phrase": the original input
- "surface_meaning": literal/dictionary meaning, in Chinese, 10-20 characters
- "real_meaning": the humorous TRUE meaning — expose the salt, blame, or cope, in Chinese, 20-50 characters
- "salt_score": saltiness 0-100 (integer)
- "blame_score": blame-shifting tendency 0-100 (integer)
- "reply": a witty comeback the player can paste into chat, in Chinese, 10-30 characters
- "tags": array of 2-4 Chinese tags like ["甩锅","抱怨","嘲讽"]`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const provider = aiConfig.provider || 'anthropic';

    if (provider === 'anthropic') {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
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
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => '');
        clearTimeout(timeout);
        return { error: 'api_error', detail: `${resp.status}: ${errBody.slice(0, 200)}` };
      }

      const data = await resp.json();
      clearTimeout(timeout);

      const raw = data.content[0].text.trim();
      // 容错：去掉可能的 markdown 代码块包裹
      const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const result = JSON.parse(json);

      // 存入缓存
      aiCache.set(cacheKey, result);
      return { result };
    }

    // 可扩展其他 provider（OpenAI / DeepSeek 等）
    return { error: 'unknown_provider' };
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
  if (mainWindow === null) {
    createWindow();
  }
});
