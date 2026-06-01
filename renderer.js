// ============================================================
// WoWS Translator — renderer.js
// Exact specification per project document section 6–11
// ============================================================

let phrases = [];
let truths = [];
let classDialogues = [];
let currentResult = null;
let isAILoading = false;

// 渲染进程级 AI 缓存，避免重复 IPC 调用
const aiCache = new Map();

// -----------------------------------------------------------
// 6.1 loadData
// -----------------------------------------------------------
async function loadData() {
  try {
    const [pRes, tRes, cdRes] = await Promise.all([
      fetch('./data/phrases.json'),
      fetch('./data/truths.json'),
      fetch('./data/class_dialogues.json')
    ]);
    phrases = await pRes.json();
    truths = await tRes.json();
    classDialogues = await cdRes.json();
  } catch (err) {
    console.error('Failed to load data files:', err);
    phrases = [];
    truths = [];
    classDialogues = [];
  }
}

// -----------------------------------------------------------
// 8.1 normalizeText
// -----------------------------------------------------------
function normalizeText(text) {
  if (!text) return '';
  let t = text.toLowerCase().trim();
  // collapse whitespace
  t = t.replace(/\s+/g, ' ');
  // remove punctuation (keep basic letters, digits, spaces, CJK)
  t = t.replace(/[^\w\s一-鿿぀-ゟ゠-ヿ]/g, '');
  t = t.trim();
  t = expandAbbreviations(t);
  t = normalizeChineseExpressions(t);
  return t;
}

// -----------------------------------------------------------
// 8.1 expandAbbreviations
// -----------------------------------------------------------
function expandAbbreviations(text) {
  const map = {
    'supp':   'support',
    'pls':    'please',
    'plz':    'please',
    'bb':     'battleship',
    'dd':     'destroyer',
    'cv':     'carrier',
    'cap':    'capture',
    'camping':'camp',
    'spotting':'spot'
  };
  // replace whole-word abbreviations only
  let words = text.split(' ');
  words = words.map(w => (map.hasOwnProperty(w) ? map[w] : w));
  return words.join(' ');
}

// -----------------------------------------------------------
// 8.1 normalizeChineseExpressions
// -----------------------------------------------------------
function normalizeChineseExpressions(text) {
  const map = [
    [/咋/g, '为什么'],
    [/为啥/g, '为什么'],
    [/为啥子/g, '为什么'],
    [/没一个/g, '没人'],
    [/没人了/g, '没人'],
    [/没支援/g, '没有支援'],
    [/没帮助/g, '没有支援'],
    [/抓我/g, '一直抓我'],
    [/一直抓我/g, '一直抓我']
  ];
  for (const [pattern, replacement] of map) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

// -----------------------------------------------------------
// 8.2 tokenizeText
// -----------------------------------------------------------
function tokenizeText(text) {
  if (!text) return [];
  const tokens = [];

  // English tokens: split by space
  const enTokens = text.match(/[a-zA-Z]+/g);
  if (enTokens) {
    tokens.push(...enTokens.map(t => t.toLowerCase()));
  }

  // Chinese tokens: extract keywords
  const chineseKeywords = [
    '战舰', '巡洋', '驱逐', '航母', '潜艇',
    '支援', '帮助', '占领', '抓', '没人', '没有支援',
    '匹配', '公平', '一直抓我', '雷达', '为什么不',
    '没人帮', '没帮助', '前压', '拖刀', '甩锅', '队友',
    '占领点', '点位', '后退', '进攻', '防守', '防空',
    '鱼雷', '炮击', '隐蔽', '发现', '侦察', '点亮',
    '侦查', '点亮', '烟雾', '修理', '回血',
    '转舵', '加速', '减速', '停船', '倒船'
  ];

  for (const kw of chineseKeywords) {
    if (text.includes(kw)) {
      tokens.push(kw);
    }
  }

  // Also add any CJK bigrams as potential tokens
  const cjkChars = text.match(/[一-鿿぀-ゟ゠-ヿ]{2,}/g);
  if (cjkChars) {
    for (const chunk of cjkChars) {
      if (!tokens.includes(chunk)) {
        tokens.push(chunk);
      }
    }
  }

  return [...new Set(tokens)];
}

// -----------------------------------------------------------
// 8.3 levenshteinDistance
// -----------------------------------------------------------
function levenshteinDistance(a, b) {
  if (!a) return (b || '').length;
  if (!b) return (a || '').length;
  const m = a.length;
  const n = b.length;
  // Use single-row DP for memory efficiency
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// -----------------------------------------------------------
// 8.3 normalizedLevenshteinSimilarity
// -----------------------------------------------------------
function normalizedLevenshteinSimilarity(a, b) {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return 1.0 - dist / maxLen;
}

// -----------------------------------------------------------
// 8.3 tokenJaccardSimilarity
// -----------------------------------------------------------
function tokenJaccardSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0.0 : intersection / union;
}

// -----------------------------------------------------------
// 8.3 keywordOverlapScore
// -----------------------------------------------------------
function keywordOverlapScore(inputTokens, phraseItem) {
  if (!inputTokens || inputTokens.length === 0) return 0.0;
  if (!phraseItem) return 0.0;

  // Collect all candidate strings from the phrase
  const candidates = [];
  if (phraseItem.phrase) candidates.push(phraseItem.phrase);
  if (phraseItem.aliases && Array.isArray(phraseItem.aliases)) {
    candidates.push(...phraseItem.aliases);
  }
  if (phraseItem.keywords && Array.isArray(phraseItem.keywords)) {
    candidates.push(...phraseItem.keywords);
  }
  if (phraseItem.tags && Array.isArray(phraseItem.tags)) {
    candidates.push(...phraseItem.tags);
  }

  if (candidates.length === 0) return 0.0;

  // Tokenize all candidate strings
  const allCandidateTokens = new Set();
  for (const c of candidates) {
    const toks = tokenizeText(c);
    for (const t of toks) {
      allCandidateTokens.add(t);
    }
  }

  if (allCandidateTokens.size === 0) return 0.0;

  let overlap = 0;
  for (const t of inputTokens) {
    if (allCandidateTokens.has(t)) overlap++;
  }

  return Math.min(1.0, overlap / Math.max(inputTokens.length, 1));
}

// -----------------------------------------------------------
// 8.3 scorePhraseMatch
// -----------------------------------------------------------
function scorePhraseMatch(input, phraseItem) {
  if (!input || !phraseItem) return { score: 0.0, match_type: 'none' };

  const normalizedInput = input;
  const phrase = (phraseItem.phrase || '').toLowerCase().trim();
  const aliases = (phraseItem.aliases || []).map(a => a.toLowerCase().trim());
  const allNames = [phrase, ...aliases];

  // 1. Exact phrase match — score 1.0
  if (normalizedInput === phrase) {
    return { score: 1.0, match_type: 'exact' };
  }

  // 2. Exact alias match — score 0.98
  for (const alias of aliases) {
    if (normalizedInput === alias) {
      return { score: 0.98, match_type: 'alias' };
    }
  }

  // 3. Contains match (input contains phrase, or phrase contains input) — score 0.85
  for (const name of allNames) {
    if (name && (normalizedInput.includes(name) || name.includes(normalizedInput))) {
      return { score: 0.85, match_type: 'contains' };
    }
  }

  // 4. Keyword match
  const inputTokens = tokenizeText(normalizedInput);
  const kwScore = keywordOverlapScore(inputTokens, phraseItem);
  if (kwScore >= 0.7) {
    return { score: kwScore * 0.85, match_type: 'keyword' };
  }

  // 5. Fuzzy composite: Levenshtein + Jaccard + Keyword (weighted)
  let bestLevenshtein = 0.0;
  let bestJaccard = 0.0;

  for (const name of allNames) {
    if (!name) continue;
    const levScore = normalizedLevenshteinSimilarity(normalizedInput, name);
    if (levScore > bestLevenshtein) bestLevenshtein = levScore;

    const nameTokens = tokenizeText(name);
    const jacScore = tokenJaccardSimilarity(inputTokens, nameTokens);
    if (jacScore > bestJaccard) bestJaccard = jacScore;
  }

  let fuzzyScore = bestLevenshtein * 0.45 + bestJaccard * 0.35 + kwScore * 0.20;

  // Detect isolated common words (team, help, spot) — require exact/contains only
  const isolatedCommonWords = ['team', 'help', 'spot', 'push', 'noob', 'report', 'gg'];
  const words = normalizedInput.split(/\s+/);
  if (words.length === 1 && isolatedCommonWords.includes(words[0])) {
    // Already didn't match exact/contains, so return low score
    fuzzyScore = Math.min(fuzzyScore, 0.30);
  }

  return { score: fuzzyScore, match_type: 'fuzzy' };
}

// -----------------------------------------------------------
// 6.1 findBestLocalMatch
// -----------------------------------------------------------
function findBestLocalMatch(input) {
  if (!input || input.trim() === '') {
    return { item: null, score: 0.0, match_type: 'fallback' };
  }

  const normalizedInput = normalizeText(input);
  if (!normalizedInput) {
    return { item: null, score: 0.0, match_type: 'fallback' };
  }

  let bestItem = null;
  let bestScore = -1;
  let bestType = 'none';

  for (const phraseItem of phrases) {
    const { score, match_type } = scorePhraseMatch(normalizedInput, phraseItem);
    if (score > bestScore) {
      bestScore = score;
      bestItem = phraseItem;
      bestType = match_type;
    }
  }

  // Apply thresholds from 8.4
  if (bestScore >= 0.90) {
    return { item: bestItem, score: bestScore, match_type: bestType };
  } else if (bestScore >= 0.72) {
    // fuzzy match
    const finalType = bestType === 'fuzzy' ? 'fuzzy' : bestType;
    return { item: bestItem, score: bestScore, match_type: finalType };
  } else if (bestScore >= 0.58) {
    // low confidence — keep the match but flag it
    return { item: bestItem, score: bestScore, match_type: 'fuzzy_low' };
  }

  return { item: null, score: bestScore, match_type: 'fallback' };
}

// -----------------------------------------------------------
// 6.1 translatePhrase  (async — AI fallback on miss)
// -----------------------------------------------------------
async function translatePhrase(input) {
  const match = findBestLocalMatch(input);

  if (match.match_type !== 'fallback' && match.item) {
    const item = match.item;
    return {
      phrase: item.phrase,
      surface_meaning: item.surface_meaning || '',
      real_meaning: item.real_meaning || '',
      salt_score: item.salt_score || 0,
      blame_score: item.blame_score || 0,
      reply: item.reply || '',
      tags: item.tags || [],
      match_type: match.match_type,
      confidence: Math.round(match.score * 100),
      is_low_confidence: match.match_type === 'fuzzy_low'
    };
  }

  // ── 本地未命中 → 尝试 AI ────────────────────────────
  const cacheKey = input.trim();
  if (aiCache.has(cacheKey)) {
    const cached = aiCache.get(cacheKey);
    return { ...cached, match_type: 'ai', confidence: cached.confidence || 85 };
  }

  if (window.electronAPI && window.electronAPI.aiTranslate) {
    try {
      const aiResp = await window.electronAPI.aiTranslate(cacheKey);

      if (aiResp.result) {
        const r = aiResp.result;
        const aiResult = {
          phrase: r.phrase || cacheKey,
          surface_meaning: r.surface_meaning || '',
          real_meaning: r.real_meaning || '',
          salt_score: typeof r.salt_score === 'number' ? r.salt_score : 50,
          blame_score: typeof r.blame_score === 'number' ? r.blame_score : 50,
          reply: r.reply || '',
          tags: r.tags || [],
          match_type: 'ai',
          confidence: 80,
          is_low_confidence: false
        };
        aiCache.set(cacheKey, aiResult);
        return aiResult;
      }

      // AI 不可用（no_config / api_error / timeout）→ 兜底
      console.log('[AI] Unavailable:', aiResp.error, aiResp.detail || '');
    } catch (e) {
      console.log('[AI] Exception:', e.message);
    }
  }

  // ── 最终兜底 ─────────────────────────────────────────
  return fallbackResult(input);
}

// -----------------------------------------------------------
// 7. fallbackResult
// -----------------------------------------------------------
function fallbackResult(text) {
  return {
    phrase: '',
    surface_meaning: '这是一个尚未收录的游戏用语。',
    real_meaning: '系统暂时无法翻译，但不代表你的血压不会因此升高。',
    salt_score: 66,
    blame_score: 100,
    reply: '收到，先喝口水再开下一局。',
    tags: [],
    match_type: 'fallback',
    confidence: 0,
    is_low_confidence: false
  };
}

// -----------------------------------------------------------
// renderTranslation
// -----------------------------------------------------------
function showAILoading() {
  isAILoading = true;
  const placeholder = document.getElementById('result-placeholder');
  const content = document.getElementById('result-content');
  placeholder.style.display = 'block';
  placeholder.innerHTML = '<span class="ai-loading">🤖 AI 分析中<span class="dots"></span></span>';
  content.style.display = 'none';
}

function renderTranslation(result) {
  isAILoading = false;
  currentResult = result;

  const placeholder = document.getElementById('result-placeholder');
  const content = document.getElementById('result-content');

  if (!result) {
    placeholder.style.display = 'block';
    placeholder.textContent = '翻译结果会显示在这里...';
    content.style.display = 'none';
    return;
  }

  placeholder.style.display = 'none';
  content.style.display = 'flex';

  document.getElementById('surface-meaning').textContent = result.surface_meaning || '';
  document.getElementById('real-meaning').textContent = result.real_meaning || '';
  document.getElementById('salt-score').textContent = (result.salt_score || 0) + ' / 100';
  document.getElementById('blame-score').textContent = (result.blame_score || 0) + ' / 100';
  document.getElementById('reply').textContent = result.reply || '';

  // Match info display per section 11
  const matchInfoEl = document.getElementById('match-info');
  const matchTypeMap = {
    'exact':    '内置词库 · 精确匹配 · 100%',
    'alias':    '内置词库 · 别名匹配 · 98%',
    'contains': '内置词库 · 包含匹配 · 85%',
    'fuzzy':    '内置词库 · 模糊匹配 · ' + (result.confidence || 0) + '%',
    'fuzzy_low':'内置词库 · 低置信度匹配 · ' + (result.confidence || 0) + '%（该结果可能不完全准确）',
    'fallback': '未命中词库 · 默认回复',
    'ai':       '🤖 AI 智能分析 · 80%',
    'random':   '内置词库 · 随机换词 · 100%'
  };

  matchInfoEl.textContent = matchTypeMap[result.match_type] || ('匹配 · ' + (result.confidence || 0) + '%');
}

// -----------------------------------------------------------
// getRandomItem
// -----------------------------------------------------------
function getRandomItem(list) {
  if (!list || list.length === 0) return null;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

// -----------------------------------------------------------
// copyResult
// -----------------------------------------------------------
function copyResult() {
  if (!currentResult) {
    showCopyToast('没有可复制的结果');
    return;
  }
  const lines = [
    '【表面含义】' + currentResult.surface_meaning,
    '【真实含义】' + currentResult.real_meaning,
    '暴躁值：' + (currentResult.salt_score || 0) + ' / 100',
    '甩锅指数：' + (currentResult.blame_score || 0) + ' / 100',
    '推荐回复：' + currentResult.reply
  ];
  const text = lines.join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showCopyToast('已复制！');
  }).catch(() => {
    showCopyToast('复制失败，请重试');
  });
}

function showCopyToast(msg) {
  let toast = document.getElementById('copy-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copy-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      color: #fff;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      pointer-events: none;
      transition: opacity 0.3s ease;
      z-index: 100;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
  }, 1500);
}

// -----------------------------------------------------------
// Event Handlers
// -----------------------------------------------------------

async function handleTranslate() {
  const input = document.getElementById('input-text').value;
  if (!input || !input.trim()) return;

  // 先快速走本地匹配
  const localMatch = findBestLocalMatch(input);
  if (localMatch.match_type !== 'fallback' && localMatch.item) {
    const item = localMatch.item;
    renderTranslation({
      phrase: item.phrase,
      surface_meaning: item.surface_meaning || '',
      real_meaning: item.real_meaning || '',
      salt_score: item.salt_score || 0,
      blame_score: item.blame_score || 0,
      reply: item.reply || '',
      tags: item.tags || [],
      match_type: localMatch.match_type,
      confidence: Math.round(localMatch.score * 100),
      is_low_confidence: localMatch.match_type === 'fuzzy_low'
    });
    return;
  }

  // 本地未命中 → 显示加载 → 调 AI
  showAILoading();
  const result = await translatePhrase(input);
  if (isAILoading) {
    renderTranslation(result);
  }
}

function handleRandomPhrase() {
  if (phrases.length === 0) return;
  const item = getRandomItem(phrases);
  document.getElementById('input-text').value = item.phrase;
  const result = {
    phrase: item.phrase,
    surface_meaning: item.surface_meaning || '',
    real_meaning: item.real_meaning || '',
    salt_score: item.salt_score || 0,
    blame_score: item.blame_score || 0,
    reply: item.reply || '',
    tags: item.tags || [],
    match_type: 'random',
    confidence: 100,
    is_low_confidence: false
  };
  renderTranslation(result);
}

function handleTruth() {
  if (truths.length === 0) return;
  const truth = getRandomItem(truths);
  const result = {
    phrase: '',
    surface_meaning: '战舰世界人生哲理',
    real_meaning: truth,
    salt_score: Math.floor(Math.random() * 40 + 30),
    blame_score: Math.floor(Math.random() * 50 + 20),
    reply: '说得好，下一局。',
    tags: ['哲理', '真相'],
    match_type: 'random',
    confidence: 100,
    is_low_confidence: false
  };
  renderTranslation(result);
}

// -----------------------------------------------------------
// Init
// -----------------------------------------------------------
async function init() {
  await loadData();

  // Button events
  document.getElementById('btn-translate').addEventListener('click', handleTranslate);
  document.getElementById('btn-random-phrase').addEventListener('click', handleRandomPhrase);
  document.getElementById('btn-truth').addEventListener('click', handleTruth);
  document.getElementById('btn-copy').addEventListener('click', copyResult);
  document.getElementById('btn-minimize').addEventListener('click', () => {
    window.electronAPI && window.electronAPI.minimizeWindow();
  });
  document.getElementById('btn-close').addEventListener('click', () => {
    window.electronAPI && window.electronAPI.closeWindow();
  });

  // Enter key to translate
  document.getElementById('input-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTranslate();
    }
  });
}

init();
