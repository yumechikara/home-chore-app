// ============================================================
// おうち当番 v2 - Main Application
// ============================================================

// --- Constants ---
const APP_VERSION = '1.5.0';
const CHANGELOG = [
  { version: '1.5.0', date: '2026-04-10', changes: [
    '西宮市公式ゴミカレンダー PDF の自動取得・閲覧機能を追加',
    'ゴミ暦タブから PDF を直接開けるように',
    'オフラインでも PDF を閲覧可能（初回取得後）',
    'GitHub Actions で月1回 PDF を自動更新'
  ]},
  { version: '1.4.3', date: '2026-04-10', changes: [
    '家事リスト管理の曜日チェックボックスがカードからはみ出す不具合を修正'
  ]},
  { version: '1.4.2', date: '2026-04-10', changes: [
    'デプロイワークフローを修正（auto-merge 完了後に自動デプロイされるように変更）'
  ]},
  { version: '1.4.1', date: '2026-04-10', changes: [
    'ログインフォームで「通信エラー」が表示される不具合を修正',
    'GASサーバーからの技術的エラー時は自動的にローカルモードへフォールバック'
  ]},
  { version: '1.4.0', date: '2026-04-09', changes: [
    'ポイントを綱引きゲージに変更（2人の差を1本バーで可視化）',
    'ルーレット条件変更（10pt差以上でリード側が回せる）'
  ]},
  { version: '1.3.0', date: '2026-04-08', changes: [
    '家事の頻度設定（毎日/週1/隔週/月1）',
    '家事の実施曜日指定',
    'デフォルト担当者の設定',
    '買い物メモ（共有リスト）',
    '連続達成バッジ（ストリーク）',
    '月間レポート（完了率・ポイント推移）',
    'ルーレット景品カスタマイズ',
    'リマインダー通知の強化',
    '家事の並び替え（上下ボタン）',
    '完了写真の記録'
  ]},
  { version: '1.2.0', date: '2026-04-08', changes: [
    'アップデート履歴ページを追加',
    '家事チェックリストの表示名を修正（メール→メンバー名）',
    'ルーレットの表示バグ修正（全家事がパイ形で表示）',
    '設定画面にバージョン表示追加'
  ]},
  { version: '1.1.0', date: '2026-04-08', changes: [
    '招待コード機能を追加',
    'ログイン後は「今日」タブで開始するように変更',
    '外部サービス連携をプルダウン表示に変更'
  ]},
  { version: '1.0.0', date: '2026-04-08', changes: [
    '天気・環境情報カードを追加（8項目）',
    '新規登録・ログインの通信エラーをフォールバックで修正',
    'バージョン表示を追加'
  ]}
];
const FREQUENCY_LABELS = { daily: '毎日', weekly: '週1回', biweekly: '隔週', monthly: '月1回' };
const DEFAULT_CHORES = [
  { id: 'c1', name: 'ゴミ出し', difficulty: 2, frequency: 'daily', days: [1,4], assignee: '' },
  { id: 'c2', name: '食事作り', difficulty: 3, frequency: 'daily', days: [], assignee: '' },
  { id: 'c3', name: '食器洗い', difficulty: 2, frequency: 'daily', days: [], assignee: '' },
  { id: 'c4', name: '風呂掃除', difficulty: 2, frequency: 'weekly', days: [], assignee: '' },
  { id: 'c5', name: 'トイレ掃除', difficulty: 2, frequency: 'weekly', days: [], assignee: '' },
  { id: 'c6', name: '床掃除・掃除機', difficulty: 2, frequency: 'weekly', days: [], assignee: '' },
  { id: 'c7', name: '飲み物・日用品買い出し', difficulty: 1, frequency: 'weekly', days: [], assignee: '' }
];
const DEFAULT_PRIZES = ['マッサージ券', '好きなご飯リクエスト権', '家事1回パス券', 'おやつ買ってきて券'];

const GARBAGE_COLORS = {
  'もやすごみ': 'burn', '燃やすごみ': 'burn', '可燃ごみ': 'burn', '可燃': 'burn',
  '不燃ごみ': 'nonburn', '燃やさないごみ': 'nonburn', '不燃': 'nonburn',
  'その他不燃ごみ': 'nonburn',
  '資源': 'resource', '資源ごみ': 'resource', '紙資源': 'resource',
  'びん': 'bottle', 'ビン': 'bottle',
  'プラ資源': 'plastic', 'プラスチック': 'plastic', '容器包装プラスチック': 'plastic',
  'プラスチック資源': 'plastic',
  '缶・ペット': 'can', '缶': 'can', 'ペットボトル': 'can', 'かん': 'can',
  'ペット': 'can', '缶・ペットボトル': 'can'
};

const CORS_PROXIES = [
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url='
];

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const SUGGEST_TEXTS = ['今週の分担を提案して', '最近サボりがちな家事は？', '来週の調整案を出して'];

const STATUS_LABELS = {
  done: '✓ やった',
  not_done: '✗ やらなかった',
  carry_over: '→ 持ち越し',
  other: '… その他'
};

// --- Weather Constants ---
const WEATHER_CODES = {
  0: ['☀️', '快晴'], 1: ['🌤', '晴れ'], 2: ['⛅', '曇りがち'], 3: ['☁️', '曇り'],
  45: ['🌫', '霧'], 48: ['🌫', '霧氷'], 51: ['🌦', '小雨'], 53: ['🌧', '雨'],
  55: ['🌧', '強い雨'], 56: ['🌨', '着氷性の霧雨'], 57: ['🌨', '着氷性の雨'],
  61: ['🌧', '小雨'], 63: ['🌧', '雨'], 65: ['🌧', '大雨'],
  71: ['🌨', '小雪'], 73: ['🌨', '雪'], 75: ['🌨', '大雪'],
  77: ['🌨', '霧雪'], 80: ['🌦', 'にわか雨'], 81: ['🌧', 'にわか雨'],
  82: ['🌧', '激しいにわか雨'], 85: ['🌨', 'にわか雪'], 86: ['🌨', '激しいにわか雪'],
  95: ['⛈', '雷雨'], 96: ['⛈', '雹を伴う雷雨'], 99: ['⛈', '激しい雷雨']
};
const PM25_LEVELS = [
  { max: 12, label: '良好', color: '#3B6D11', bg: '#EAF3DE' },
  { max: 35, label: '普通', color: '#854F0B', bg: '#FAEEDA' },
  { max: 55, label: 'やや悪い', color: '#B45309', bg: '#FEF3C7' },
  { max: 150, label: '悪い', color: '#C53030', bg: '#FEE2E2' },
  { max: Infinity, label: '非常に悪い', color: '#7B341E', bg: '#FED7D7' }
];
const UV_LEVELS = [
  { max: 2, label: '弱い', color: '#3B6D11' },
  { max: 5, label: '中程度', color: '#854F0B' },
  { max: 7, label: '強い', color: '#B45309' },
  { max: 10, label: '非常に強い', color: '#C53030' },
  { max: Infinity, label: '極端', color: '#7B341E' }
];
const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// --- State ---
let settings = {};
let state = {
  currentTab: 'today',
  currentWeekOffset: 0,
  chatHistory: [],
  chatLoading: false,
  lastSync: null,
  selectedChoreId: null,
  selectedWeekKey: null
};

// ============================================================
// Auth Functions
// ============================================================
function loadAuth() {
  try { return JSON.parse(localStorage.getItem('ouchi_auth') || 'null'); } catch { return null; }
}
function saveAuth(auth) { localStorage.setItem('ouchi_auth', JSON.stringify(auth)); }
function clearAuth() { localStorage.removeItem('ouchi_auth'); }
function isAuthenticated() {
  const auth = loadAuth();
  if (!auth || !auth.token) return false;
  if (auth.expiry && Date.now() > auth.expiry) { clearAuth(); return false; }
  return true;
}
function getDisplayName() {
  const auth = loadAuth();
  if (!auth) return '';
  const email = auth.email;
  if (settings.emailA && email === settings.emailA && settings.memberA) return settings.memberA;
  if (settings.emailB && email === settings.emailB && settings.memberB) return settings.memberB;
  return auth.displayName || email;
}

// ============================================================
// Settings & Storage
// ============================================================
function defaultSettings() {
  return {
    memberA: '', memberB: '',
    emailA: '', emailB: '',
    spreadsheetId: '', sheetsApiKey: '',
    claudeApiKey: '', gasWebAppUrl: '',
    garbageAreaId: '155',
    weatherLat: '34.7333', weatherLon: '135.3417'
  };
}
function loadSettings() {
  try { settings = { ...defaultSettings(), ...JSON.parse(localStorage.getItem('ouchi_settings') || '{}') }; }
  catch { settings = defaultSettings(); }
}
function saveSettingsToLocal() { localStorage.setItem('ouchi_settings', JSON.stringify(settings)); }

function loadChores() {
  try {
    const c = JSON.parse(localStorage.getItem('ouchi_chores'));
    if (c && c.length) return c.map(ch => ({
      frequency: 'weekly', days: [], assignee: '', ...ch
    }));
  } catch {}
  return DEFAULT_CHORES.map(c => ({ ...c, createdBy: 'system', active: true }));
}
function loadShoppingMemo() {
  try { return JSON.parse(localStorage.getItem('ouchi_shopping')) || []; } catch { return []; }
}
function saveShoppingMemo(items) { localStorage.setItem('ouchi_shopping', JSON.stringify(items)); }
function loadPrizes() {
  try { const p = JSON.parse(localStorage.getItem('ouchi_prizes')); if (p && p.length) return p; } catch {}
  return [...DEFAULT_PRIZES];
}
function savePrizes(p) { localStorage.setItem('ouchi_prizes', JSON.stringify(p)); }
function loadPhotos() {
  try { return JSON.parse(localStorage.getItem('ouchi_photos')) || {}; } catch { return {}; }
}
function savePhoto(choreId, weekKey, dataUrl) {
  const photos = loadPhotos();
  photos[`${weekKey}_${choreId}`] = dataUrl;
  localStorage.setItem('ouchi_photos', JSON.stringify(photos));
}
function saveChores(chores) { localStorage.setItem('ouchi_chores', JSON.stringify(chores)); }

function loadPoints() {
  try { return JSON.parse(localStorage.getItem('ouchi_points')) || { A: { total: 0, history: [] }, B: { total: 0, history: [] } }; }
  catch { return { A: { total: 0, history: [] }, B: { total: 0, history: [] } }; }
}
function savePoints(pts) { localStorage.setItem('ouchi_points', JSON.stringify(pts)); }

function loadRequests() {
  try { return JSON.parse(localStorage.getItem('ouchi_requests')) || []; } catch { return []; }
}
function saveRequests(reqs) { localStorage.setItem('ouchi_requests', JSON.stringify(reqs)); }

// ============================================================
// Week Management
// ============================================================
function getWeekKey(d) {
  const date = new Date(d);
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - jan1) / 86400000);
  const weekNum = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekMonday(offset) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function loadWeeklyChores(weekKey) {
  try {
    const data = JSON.parse(localStorage.getItem('ouchi_weekly_' + weekKey));
    if (data && data.chores) return data.chores;
  } catch {}
  return null;
}

function saveWeeklyChores(weekKey, chores) {
  localStorage.setItem('ouchi_weekly_' + weekKey, JSON.stringify({ weekKey, chores }));
}

function shouldShowChoreThisWeek(chore, weekKey) {
  const freq = chore.frequency || 'weekly';
  if (freq === 'daily' || freq === 'weekly') return true;
  if (freq === 'monthly') {
    const weekNum = parseInt(weekKey.split('-W')[1]);
    return weekNum % 4 === 1;
  }
  if (freq === 'biweekly') {
    const weekNum = parseInt(weekKey.split('-W')[1]);
    return weekNum % 2 === 0;
  }
  return true;
}

function initWeekIfNeeded(weekKey) {
  let chores = loadWeeklyChores(weekKey);
  if (chores) return chores;
  const choreList = loadChores().filter(c => c.active && shouldShowChoreThisWeek(c, weekKey));
  chores = choreList.map(c => ({
    id: c.id, name: c.name, difficulty: c.difficulty || 1,
    frequency: c.frequency || 'weekly', days: c.days || [], assignee: c.assignee || '',
    status: null, doneBy: null, doneAt: null, date: null, points: c.difficulty || 1
  }));
  const prevMonday = getWeekMonday(state.currentWeekOffset - 1);
  const prevKey = getWeekKey(prevMonday);
  const prevChores = loadWeeklyChores(prevKey);
  if (prevChores) {
    prevChores.filter(c => c.status === 'carry_over').forEach(pc => {
      const existing = chores.find(c => c.id === pc.id);
      if (existing) existing.carryOver = true;
    });
  }
  saveWeeklyChores(weekKey, chores);
  return chores;
}

function getStreak() {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 30; i++) {
    d.setDate(d.getDate() - (i === 0 ? 0 : 1));
    const wk = getWeekKey(d);
    const chores = loadWeeklyChores(wk);
    if (!chores) break;
    const dayChores = chores.filter(c => c.date === formatDate(d));
    if (dayChores.length > 0 && dayChores.every(c => c.status === 'done')) { streak++; }
    else if (dayChores.length > 0) break;
  }
  return streak;
}

// ============================================================
// GAS Communication
// ============================================================
async function gasPost(action, data) {
  if (!settings.gasWebAppUrl) return null;
  const auth = loadAuth();
  try {
    const res = await fetch(settings.gasWebAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, data, token: auth?.token, email: auth?.email })
    });
    return await res.json();
  } catch (e) { console.error('GAS error:', e); return null; }
}

async function gasGet(action, params) {
  if (!settings.gasWebAppUrl) return null;
  const auth = loadAuth();
  const url = new URL(settings.gasWebAppUrl);
  url.searchParams.set('action', action);
  if (auth) { url.searchParams.set('email', auth.email); url.searchParams.set('token', auth.token); }
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const res = await fetch(url.toString());
    return await res.json();
  } catch (e) { console.error('GAS GET error:', e); return null; }
}

async function syncFromGAS() {
  if (!settings.gasWebAppUrl) return;
  const weekKey = getWeekKey(getWeekMonday(state.currentWeekOffset));
  const result = await gasGet('getAll', { weekKey });
  if (result) {
    if (result.weeklyChores) saveWeeklyChores(weekKey, result.weeklyChores);
    if (result.points) savePoints(result.points);
    if (result.requests) saveRequests(result.requests);
    state.lastSync = new Date();
  }
}

// ============================================================
// Invite Code
// ============================================================
function generateInviteCode() {
  const data = {
    g: settings.gasWebAppUrl || '',
    a: settings.memberA || '',
    b: settings.memberB || '',
    ea: settings.emailA || '',
    eb: settings.emailB || '',
    ga: settings.garbageAreaId || '155',
    wl: settings.weatherLat || '34.7333',
    wn: settings.weatherLon || '135.3417',
    si: settings.spreadsheetId || '',
    sk: settings.sheetsApiKey || '',
    ck: settings.claudeApiKey || ''
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

function applyInviteCode(code) {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const d = JSON.parse(json);
    if (d.g) settings.gasWebAppUrl = d.g;
    if (d.a) settings.memberA = d.a;
    if (d.b) settings.memberB = d.b;
    if (d.ea) settings.emailA = d.ea;
    if (d.eb) settings.emailB = d.eb;
    if (d.ga) settings.garbageAreaId = d.ga;
    if (d.wl) settings.weatherLat = d.wl;
    if (d.wn) settings.weatherLon = d.wn;
    if (d.si) settings.spreadsheetId = d.si;
    if (d.sk) settings.sheetsApiKey = d.sk;
    if (d.ck) settings.claudeApiKey = d.ck;
    saveSettingsToLocal();
    return { success: true };
  } catch (e) {
    return { success: false, error: '招待コードが正しくありません' };
  }
}

// ============================================================
// Auth Handlers
// ============================================================
// GASから返ってきたエラー文字列がユーザー起因(PIN違い・未登録など)か判定する。
// ユーザー起因ならそのまま表示、それ以外(通信/サーバー内部)はローカルモードへフォールバック。
function isAuthUserError(msg) {
  if (!msg || typeof msg !== 'string') return false;
  return /PIN|pin|未登録|登録済|既に|存在しません|見つかりません|not ?found|invalid|unauthorized/i.test(msg);
}

async function handleLogin(email, pin) {
  if (!settings.gasWebAppUrl) {
    const auth = { email, displayName: email.split('@')[0], token: 'local_' + Date.now(), expiry: Date.now() + 30 * 86400000 };
    saveAuth(auth);
    return { success: true };
  }
  const result = await gasPost('login', { email, pin, userAgent: navigator.userAgent });
  if (result && result.success) {
    saveAuth({ email, displayName: result.displayName, token: result.token, expiry: result.expiry });
    if (result.settings) { settings = { ...settings, ...result.settings }; saveSettingsToLocal(); }
    return result;
  }
  // ユーザー起因のエラーのみ表示
  if (result && result.error && isAuthUserError(result.error)) return result;
  // GAS通信失敗 / サーバー内部エラー → ローカルモードにフォールバック
  const auth = { email, displayName: email.split('@')[0], token: 'local_' + Date.now(), expiry: Date.now() + 30 * 86400000 };
  saveAuth(auth);
  return { success: true, warning: 'サーバーに接続できないためローカルモードでログインしました' };
}

async function handleRegister(email, displayName, pin) {
  if (!settings.gasWebAppUrl) {
    const auth = { email, displayName, token: 'local_' + Date.now(), expiry: Date.now() + 30 * 86400000 };
    saveAuth(auth);
    return { success: true };
  }
  const result = await gasPost('register', { email, displayName, pin, userAgent: navigator.userAgent });
  if (result && result.success) {
    saveAuth({ email, displayName, token: result.token, expiry: result.expiry });
    return result;
  }
  if (result && result.error && isAuthUserError(result.error)) return result;
  // GAS通信失敗 / サーバー内部エラー → ローカルモードにフォールバック
  const auth = { email, displayName, token: 'local_' + Date.now(), expiry: Date.now() + 30 * 86400000 };
  saveAuth(auth);
  return { success: true, warning: 'サーバーに接続できないためローカルモードで登録しました' };
}

// ============================================================
// Garbage Schedule
// ============================================================
async function fetchGarbagePage(year, month) {
  const areaId = settings.garbageAreaId || '155';
  const targetUrl = `https://www.nishi.or.jp/homepage/gomicalendar/calendar.html?date=${year}-${month}&id=${areaId}`;
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(targetUrl));
      if (res.ok) return await res.text();
    } catch (e) { continue; }
  }
  return null;
}

function parseGarbageHTML(html) {
  const days = {};
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const cells = doc.querySelectorAll('td[class*="calendar"], td[class*="day"], .calendarDay, .calendar td, td');
    cells.forEach(cell => {
      const dayEl = cell.querySelector('.day, .date, span');
      const dayNum = dayEl ? parseInt(dayEl.textContent.trim()) : parseInt(cell.textContent.trim());
      if (!dayNum || isNaN(dayNum) || dayNum < 1 || dayNum > 31) return;
      const types = [];
      const text = cell.textContent.replace(String(dayNum), '').trim();
      Object.keys(GARBAGE_COLORS).forEach(key => {
        if (text.includes(key)) types.push(key);
      });
      cell.querySelectorAll('.gomi, .garbage, span, p, div').forEach(el => {
        const t = el.textContent.trim();
        if (t && GARBAGE_COLORS[t]) types.push(t);
      });
      if (types.length > 0) days[dayNum] = [...new Set(types)];
    });
    if (Object.keys(days).length === 0) {
      const rows = doc.querySelectorAll('table tr');
      rows.forEach(row => {
        row.querySelectorAll('td').forEach(td => {
          const text = td.innerHTML;
          const dayMatch = text.match(/(\d{1,2})/);
          if (dayMatch) {
            const dn = parseInt(dayMatch[1]);
            if (dn >= 1 && dn <= 31) {
              const types = [];
              Object.keys(GARBAGE_COLORS).forEach(key => { if (text.includes(key)) types.push(key); });
              if (types.length > 0) days[dn] = [...new Set(types)];
            }
          }
        });
      });
    }
  } catch (e) { console.error('Parse error:', e); }
  return days;
}

async function refreshGarbageCache() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fetchMonth = async (y, m) => {
    const key = `garbage_${y}_${m}`;
    if (localStorage.getItem(key)) return;
    const html = await fetchGarbagePage(y, m);
    if (html) {
      const days = parseGarbageHTML(html);
      if (Object.keys(days).length > 0) localStorage.setItem(key, JSON.stringify(days));
    }
  };
  await fetchMonth(year, month);
  const nextM = month === 12 ? 1 : month + 1;
  const nextY = month === 12 ? year + 1 : year;
  await fetchMonth(nextY, nextM);
}

function getGarbageForDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const key = `garbage_${d.getFullYear()}_${d.getMonth() + 1}`;
  try {
    const cache = JSON.parse(localStorage.getItem(key) || '{}');
    if (cache[d.getDate()] && cache[d.getDate()].length > 0) return cache[d.getDate()];
  } catch {}
  return [];
}

function renderGarbageTags(types) {
  if (!types || types.length === 0) return '<span class="no-garbage">ゴミなし</span>';
  return types.map(t => {
    const cls = GARBAGE_COLORS[t] || '';
    return `<span class="garbage-tag ${cls}">${t}</span>`;
  }).join('');
}

// ============================================================
// Tab Switching
// ============================================================
function switchTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  renderTab(tabId);
}

function renderTab(tabId) {
  switch (tabId) {
    case 'today': renderToday(); break;
    case 'calendar': renderCalendar(); break;
    case 'points': renderPoints(); break;
    case 'settings': renderSettings(); break;
    case 'chat': renderChat(); break;
  }
}

// ============================================================
// Helpers
// ============================================================
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(d) {
  if (typeof d === 'string') return d;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function difficultyStars(n) {
  return '★'.repeat(n || 1) + '☆'.repeat(Math.max(0, 5 - (n || 1)));
}

function parseUserAgent(ua) {
  if (!ua) return 'Unknown';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Other';
}

// ============================================================
// Weather & Environment
// ============================================================
async function fetchWeatherData() {
  // Check cache
  try {
    const cached = JSON.parse(localStorage.getItem('ouchi_weather'));
    if (cached && (Date.now() - cached.timestamp) < WEATHER_CACHE_TTL) return cached.data;
  } catch {}

  const lat = settings.weatherLat || '34.7333';
  const lon = settings.weatherLon || '135.3417';

  try {
    const [weatherRes, airRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,weather_code,uv_index&daily=precipitation_probability_max&timezone=Asia/Tokyo&forecast_days=1`),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5&timezone=Asia/Tokyo`)
    ]);

    const weather = await weatherRes.json();
    const air = await airRes.json();

    const data = {
      temp: weather.current?.temperature_2m,
      humidity: weather.current?.relative_humidity_2m,
      pressure: Math.round(weather.current?.surface_pressure || 0),
      windSpeed: weather.current?.wind_speed_10m,
      weatherCode: weather.current?.weather_code,
      uvIndex: weather.current?.uv_index,
      precipProb: weather.daily?.precipitation_probability_max?.[0],
      pm25: air.current?.pm2_5
    };

    localStorage.setItem('ouchi_weather', JSON.stringify({ data, timestamp: Date.now() }));
    return data;
  } catch (e) {
    console.error('Weather fetch error:', e);
    // Return stale cache if available
    try {
      const stale = JSON.parse(localStorage.getItem('ouchi_weather'));
      if (stale?.data) { stale.data._stale = true; return stale.data; }
    } catch {}
    return null;
  }
}

function getPM25Level(val) {
  if (val == null) return { label: '-', color: '#666', bg: '#F0F0F0' };
  return PM25_LEVELS.find(l => val <= l.max) || PM25_LEVELS[PM25_LEVELS.length - 1];
}

function getUVLevel(val) {
  if (val == null) return { label: '-', color: '#666' };
  return UV_LEVELS.find(l => val <= l.max) || UV_LEVELS[UV_LEVELS.length - 1];
}

function renderWeatherCard(data) {
  if (!data) return '<div class="weather-card weather-loading">天気情報を取得できませんでした</div>';
  const wc = WEATHER_CODES[data.weatherCode] || ['🌡', '不明'];
  const pm = getPM25Level(data.pm25);
  const uv = getUVLevel(data.uvIndex);
  const stale = data._stale ? ' <span class="carry-badge">古い情報</span>' : '';

  return `<div class="weather-card">
    <div class="weather-main">
      <span class="weather-icon">${wc[0]}</span>
      <div>
        <div class="weather-temp">${data.temp != null ? data.temp + '℃' : '-'}</div>
        <div class="weather-desc">${wc[1]}${stale}</div>
      </div>
    </div>
    <div class="weather-grid">
      <div class="weather-item"><span class="wi-label">💧 湿度:</span><span class="wi-value">${data.humidity != null ? data.humidity + '%' : '-'}</span></div>
      <div class="weather-item"><span class="wi-label">🌡 気圧:</span><span class="wi-value">${data.pressure ? data.pressure + 'hPa' : '-'}</span></div>
      <div class="weather-item"><span class="wi-label">🌬 風速:</span><span class="wi-value">${data.windSpeed != null ? data.windSpeed + 'm/s' : '-'}</span></div>
      <div class="weather-item"><span class="wi-label">☔ 降水:</span><span class="wi-value">${data.precipProb != null ? data.precipProb + '%' : '-'}</span></div>
      <div class="weather-item"><span class="wi-label">🫁 PM2.5:</span><span class="wi-value">${data.pm25 != null ? data.pm25 : '-'} <span class="pm25-badge" style="background:${pm.bg};color:${pm.color}">${pm.label}</span></span></div>
      <div class="weather-item"><span class="wi-label">🔆 UV:</span><span class="wi-value">${data.uvIndex != null ? data.uvIndex : '-'} <span style="color:${uv.color};font-weight:700">${uv.label}</span></span></div>
    </div>
  </div>`;
}


// ============================================================
// Render: Today Tab
// ============================================================
function renderToday() {
  const el = document.getElementById('today-content');
  const d = new Date();
  const todayStr = today();
  const dayName = DAY_NAMES[d.getDay()];
  const dayIdx = d.getDay();
  const garbage = getGarbageForDate(todayStr);
  const weekKey = getWeekKey(d);
  const allChores = initWeekIfNeeded(weekKey);
  // Filter: daily chores show by day-of-week, weekly+ show all
  const chores = allChores.filter(c => {
    if (c.frequency === 'daily' && c.days && c.days.length > 0) return c.days.includes(dayIdx);
    return true;
  });
  const syncTime = state.lastSync ? state.lastSync.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '-';
  const streak = getStreak();
  const streakHtml = streak > 0 ? `<div class="streak-badge">${streak}日連続達成!</div>` : '';
  const photos = loadPhotos();

  const requests = loadRequests().filter(r => !r.completed);
  const requestHtml = requests.length > 0 ? requests.map(r =>
    `<div class="request-badge">
      <span class="badge-icon">🎰</span>
      <span>${r.from}から: <strong>${r.choreName}</strong>をお願い！</span>
      <button class="btn btn-complete" data-action="complete-request" data-request-id="${r.id}">完了</button>
    </div>`
  ).join('') : '';

  // Shopping memo
  const memo = loadShoppingMemo();
  const memoHtml = `
    <p class="section-title">買い物メモ</p>
    <div class="card shopping-memo">
      <div id="memo-list">${memo.map((m, i) =>
        `<div class="memo-item ${m.done ? 'memo-done' : ''}">
          <label><input type="checkbox" data-action="toggle-memo" data-idx="${i}" ${m.done ? 'checked' : ''}> ${m.text}</label>
          <button class="btn-del" data-action="delete-memo" data-idx="${i}">✕</button>
        </div>`
      ).join('') || '<p class="empty-state">メモなし</p>'}</div>
      <div class="memo-add-row">
        <input type="text" id="memo-input" placeholder="追加...">
        <button class="btn btn-complete" data-action="add-memo">+</button>
      </div>
    </div>`;

  el.innerHTML = `
    <div class="today-date">${d.getMonth() + 1}月${d.getDate()}日</div>
    <div class="today-day">${d.getFullYear()}年 ${dayName}曜日</div>
    ${streakHtml}
    <div id="weather-area"><div class="weather-card weather-loading">天気情報を読み込み中...</div></div>
    <p class="section-title">ゴミ出し</p>
    <div class="card">
      <div class="garbage-tags">${renderGarbageTags(garbage)}</div>
    </div>
    ${requestHtml}
    <div class="sync-bar">
      <span>最終同期: ${syncTime}</span>
      <button data-action="sync-now">更新</button>
    </div>
    <p class="section-title">今日の家事</p>
    <div class="card">
      ${chores.length === 0 ? '<p class="empty-state">今日の家事はありません</p>' :
        chores.map(c => {
          const badge = c.status ? `<span class="status-badge ${c.status}">${STATUS_LABELS[c.status]}${c.doneBy ? ' (' + c.doneBy + ')' : ''}</span>` : '';
          const carryBadge = c.carryOver ? '<span class="carry-badge">持ち越し</span>' : '';
          const freqBadge = `<span class="freq-badge freq-${c.frequency || 'weekly'}">${FREQUENCY_LABELS[c.frequency || 'weekly']}</span>`;
          const assigneeBadge = c.assignee ? `<span class="assignee-badge">${c.assignee}</span>` : '';
          const photoKey = `${weekKey}_${c.id}`;
          const hasPhoto = photos[photoKey];
          const photoBtn = c.status === 'done' ? `<button class="btn-photo ${hasPhoto ? 'has-photo' : ''}" data-action="take-photo" data-chore-id="${c.id}" data-week="${weekKey}">${hasPhoto ? '写真あり' : '写真'}</button>` : '';
          const actions = !c.status ? `
            <div class="chore-actions">
              <button class="btn btn-complete" data-action="quick-done" data-chore-id="${c.id}" data-week="${weekKey}">やった</button>
              <button class="btn btn-skip" data-action="open-status-modal" data-chore-id="${c.id}" data-week="${weekKey}">...</button>
            </div>` : '';
          return `<div class="chore-item ${c.status ? 'chore-' + c.status : ''}">
            <div class="chore-info">
              <div class="chore-name">${c.name} ${freqBadge}${assigneeBadge}${carryBadge}</div>
              <div class="chore-difficulty">${difficultyStars(c.difficulty)} (${c.difficulty}pt) ${photoBtn}</div>
              ${badge}
            </div>
            ${actions}
          </div>`;
        }).join('')
      }
    </div>
    ${memoHtml}
  `;

  fetchWeatherData().then(data => {
    const area = document.getElementById('weather-area');
    if (area) area.innerHTML = renderWeatherCard(data);
  });
}

// ============================================================
// Render: Calendar Tab
// ============================================================
function renderCalendar() {
  const el = document.getElementById('calendar-content');
  const monday = getWeekMonday(state.currentWeekOffset);
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  const todayStr = today();

  const navHtml = `<div class="calendar-nav">
    <button data-action="prev-month">◀◀</button>
    <button data-action="prev-week">◀</button>
    <span class="calendar-title">${monday.getMonth() + 1}月${monday.getDate()}日〜${sun.getDate()}日</span>
    <button data-action="next-week">▶</button>
    <button data-action="next-month">▶▶</button>
  </div>
  <div style="text-align:center;margin-bottom:8px;">
    <button class="btn btn-secondary" data-action="this-week" style="font-size:12px;padding:4px 12px;">今週に戻る</button>
  </div>`;

  let daysHtml = '<div class="week-grid">';
  DAY_NAMES.forEach(n => daysHtml += `<div class="day-header">${n}</div>`);
  for (let i = -1; i < 6; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const ds = formatDate(day);
    const isToday = ds === todayStr;
    const garbage = getGarbageForDate(ds);
    daysHtml += `<div class="day-cell ${isToday ? 'today' : ''}">
      <div class="day-num">${day.getDate()}</div>
      ${garbage.map(t => `<span class="garbage-tag ${GARBAGE_COLORS[t] || ''}">${t}</span>`).join('')}
    </div>`;
  }
  daysHtml += '</div>';

  const pdfHtml = `
    <div class="garbage-pdf-section">
      <a href="./assets/garbage-calendar.pdf" target="_blank" rel="noopener" class="btn btn-secondary btn-block">
        📄 市の公式ゴミカレンダー PDF を見る（西宮市 2026年版）
      </a>
      <p class="form-hint">年末年始の特例や出し方ルールの詳細はこちら</p>
    </div>
  `;

  el.innerHTML = navHtml + daysHtml + pdfHtml;
}

// ============================================================
// Render: Points Tab
// ============================================================
function renderPoints() {
  const el = document.getElementById('points-content');
  const pts = loadPoints();
  const nameA = settings.memberA || 'メンバーA';
  const nameB = settings.memberB || 'メンバーB';
  const myName = getDisplayName();
  const myKey = myName === settings.memberB ? 'B' : 'A';

  const ptsA = pts.A?.total || 0;
  const ptsB = pts.B?.total || 0;
  const diff = ptsA - ptsB;
  const absDiff = Math.abs(diff);
  const leader = diff > 0 ? 'A' : diff < 0 ? 'B' : null;
  const canSpin = absDiff >= 10 && leader === myKey;

  const MAX_VISUAL_DIFF = 30;
  const fillPercent = Math.min(50, (absDiff / MAX_VISUAL_DIFF) * 50);
  const fillLeft = diff >= 0 ? (50 - fillPercent) : 50;
  const fillClass = diff > 0 ? 'tow-fill-a' : diff < 0 ? 'tow-fill-b' : '';

  const requests = loadRequests().filter(r => !r.completed);
  const requestHtml = requests.length > 0 ? `
    <p class="section-title">おねがいされた家事</p>
    ${requests.map(r => `<div class="request-badge">
      <span class="badge-icon">🎰</span>
      <span>${r.from}さんから: <strong>${r.choreName}</strong></span>
    </div>`).join('')}` : '';

  el.innerHTML = `
    <div class="tow-gauge-wrapper">
      <div class="tow-labels-row">
        <div class="tow-label tow-label-a">
          <span class="tow-name">${nameA}</span>
          <span class="tow-total">${ptsA}pt</span>
        </div>
        <div class="tow-label tow-label-b">
          <span class="tow-name">${nameB}</span>
          <span class="tow-total">${ptsB}pt</span>
        </div>
      </div>
      <div class="tow-gauge">
        <div class="tow-threshold tow-threshold-left"></div>
        <div class="tow-threshold tow-threshold-right"></div>
        <div class="tow-center-line"></div>
        <div class="tow-fill ${fillClass}" style="left:${fillLeft}%;width:${fillPercent}%"></div>
      </div>
      <div class="tow-diff">${absDiff === 0 ? '引き分け' : (diff > 0 ? `\u2190 ${absDiff}pt\u5DEE` : `${absDiff}pt\u5DEE \u2192`)}</div>
    </div>
    ${canSpin ? `<div class="roulette-trigger">
      <button class="btn" data-action="open-roulette">🎰 ルーレットを回す！</button>
      <p style="font-size:12px;color:var(--color-text-sub);margin-top:4px;">10ポイント差を消費して相手に家事をおねがいできます</p>
    </div>` : ''}
    ${requestHtml}
    <p class="section-title">月間レポート</p>
    <div class="card">
      ${(() => {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        let totalTasks = 0, doneTasks = 0;
        const dailyData = [];
        for (let day = 1; day <= now.getDate(); day++) {
          const dd = new Date(now.getFullYear(), now.getMonth(), day);
          const wk = getWeekKey(dd);
          const wc = loadWeeklyChores(wk);
          if (wc) {
            const ds = formatDate(dd);
            const dayChores = wc.filter(c => c.date === ds);
            totalTasks += dayChores.length;
            const done = dayChores.filter(c => c.status === 'done').length;
            doneTasks += done;
            dailyData.push({ day, done, total: dayChores.length });
          }
        }
        const rate = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
        const ptsA = (pts.A?.history || []).filter(h => h.type === 'earned' && h.date?.startsWith(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)).reduce((s,h) => s + h.points, 0);
        const ptsB = (pts.B?.history || []).filter(h => h.type === 'earned' && h.date?.startsWith(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)).reduce((s,h) => s + h.points, 0);
        const maxPts = Math.max(ptsA, ptsB, 1);
        return `<div class="monthly-rate">今月の完了率: <strong>${rate}%</strong></div>
          <div class="monthly-bars">
            <div class="monthly-bar-row"><span>${nameA}</span><div class="monthly-bar"><div class="monthly-fill" style="width:${ptsA/maxPts*100}%">${ptsA}pt</div></div></div>
            <div class="monthly-bar-row"><span>${nameB}</span><div class="monthly-bar"><div class="monthly-fill fill-b" style="width:${ptsB/maxPts*100}%">${ptsB}pt</div></div></div>
          </div>`;
      })()}
    </div>
    <p class="section-title">ポイント履歴</p>
    <div class="card">
      ${[...(pts.A?.history || []), ...(pts.B?.history || [])].sort((a, b) => b.date > a.date ? 1 : -1).slice(0, 20).map(h =>
        `<div class="point-history-item">
          <span>${h.date} ${h.choreName}</span>
          <span class="pts ${h.type === 'spent' ? 'spent' : ''}">${h.type === 'spent' ? '-' : '+'}${h.points}pt</span>
        </div>`
      ).join('') || '<p class="empty-state">まだ履歴はありません</p>'}
    </div>
  `;
}

// ============================================================
// Render: Settings Tab
// ============================================================
function renderSettings() {
  const el = document.getElementById('settings-content');
  const auth = loadAuth();
  const chores = loadChores();

  const choreEditorHtml = chores.map((c, i) => `
    <div class="chore-editor-item" data-idx="${i}">
      <div class="chore-editor-row1">
        <input type="text" value="${c.name}" data-field="name" data-idx="${i}" class="chore-name-input">
        <div class="chore-editor-btns">
          ${i > 0 ? `<button class="btn-move" data-action="move-chore-up" data-idx="${i}">▲</button>` : ''}
          ${i < chores.length - 1 ? `<button class="btn-move" data-action="move-chore-down" data-idx="${i}">▼</button>` : ''}
          <button class="btn-del" data-action="delete-chore" data-idx="${i}">✕</button>
        </div>
      </div>
      <div class="chore-editor-row2">
        <select data-field="difficulty" data-idx="${i}">
          ${[1,2,3,4,5].map(n => `<option value="${n}" ${c.difficulty === n ? 'selected' : ''}>${'★'.repeat(n)}</option>`).join('')}
        </select>
        <select data-field="frequency" data-idx="${i}">
          ${Object.entries(FREQUENCY_LABELS).map(([k,v]) => `<option value="${k}" ${(c.frequency||'weekly') === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <select data-field="assignee" data-idx="${i}">
          <option value="" ${!c.assignee ? 'selected' : ''}>担当なし</option>
          ${settings.memberA ? `<option value="${settings.memberA}" ${c.assignee === settings.memberA ? 'selected' : ''}>${settings.memberA}</option>` : ''}
          ${settings.memberB ? `<option value="${settings.memberB}" ${c.assignee === settings.memberB ? 'selected' : ''}>${settings.memberB}</option>` : ''}
        </select>
      </div>
      <div class="chore-editor-row3">
        <label class="day-label">曜日:</label>
        ${DAY_NAMES.map((dn, di) => `<label class="day-check"><input type="checkbox" data-field="day" data-idx="${i}" data-day="${di}" ${(c.days||[]).includes(di) ? 'checked' : ''}>${dn}</label>`).join('')}
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="settings-user">
      ログイン中: <strong>${auth?.email || 'ローカルモード'}</strong>
    </div>
    <div class="card settings-card">
      <div class="form-section-title">メンバー設定</div>
      <div class="form-group">
        <label>メンバーA 名前</label>
        <input type="text" id="set-memberA" value="${settings.memberA}" placeholder="例: たろう">
      </div>
      <div class="form-group">
        <label>メンバーB 名前</label>
        <input type="text" id="set-memberB" value="${settings.memberB}" placeholder="例: はなこ">
      </div>
      <div class="form-group">
        <label>メンバーA メール</label>
        <input type="email" id="set-emailA" value="${settings.emailA}" placeholder="a@example.com">
      </div>
      <div class="form-group">
        <label>メンバーB メール</label>
        <input type="email" id="set-emailB" value="${settings.emailB}" placeholder="b@example.com">
      </div>

      <div class="form-section-title">ゴミカレンダー設定</div>
      <div class="form-group">
        <label>地区ID（西宮市ゴミカレンダー）</label>
        <input type="text" id="set-garbageAreaId" value="${settings.garbageAreaId || '155'}" placeholder="155">
        <p class="form-hint">小松南町1〜3丁目 = 155</p>
      </div>

      <div class="form-section-title">天気・環境情報</div>
      <div class="form-group">
        <label>緯度</label>
        <input type="text" id="set-weatherLat" value="${settings.weatherLat || '34.7333'}" placeholder="34.7333">
      </div>
      <div class="form-group">
        <label>経度</label>
        <input type="text" id="set-weatherLon" value="${settings.weatherLon || '135.3417'}" placeholder="135.3417">
        <p class="form-hint">西宮市 = 34.7333, 135.3417（APIキー不要）</p>
      </div>

      <div class="form-section-title">招待コード</div>
      <div class="form-group">
        <button class="btn btn-secondary btn-block" data-action="generate-invite">招待コードを発行</button>
        <div id="invite-code-output" class="invite-code-output" style="display:none;"></div>
      </div>
      <div class="form-group">
        <label>招待コードを入力（相手から受け取ったコード）</label>
        <textarea id="invite-code-input" rows="2" placeholder="招待コードを貼り付け"></textarea>
        <button class="btn btn-primary btn-block" data-action="apply-invite" style="margin-top:6px;">コードを適用</button>
        <div id="invite-apply-result"></div>
      </div>

      <button class="btn btn-primary btn-block" data-action="save-settings" style="margin-top:16px;">設定を保存</button>
    </div>

    <div class="card settings-card">
      <div class="form-section-title" style="border-top:none;margin-top:0;padding-top:0;">家事リスト管理</div>
      <div id="chore-editor">${choreEditorHtml}</div>
      <button class="btn btn-secondary btn-block" data-action="add-chore" style="margin-top:8px;">+ 新しい家事を追加</button>
      <button class="btn btn-primary btn-block" data-action="save-chores" style="margin-top:8px;">家事リストを保存</button>
    </div>

    <div class="card settings-card">
      <div class="form-section-title" style="border-top:none;margin-top:0;padding-top:0;">ルーレット景品</div>
      <div id="prize-editor">${loadPrizes().map((p, i) => `
        <div class="prize-editor-item">
          <input type="text" value="${p}" data-prize-idx="${i}">
          <button class="btn-del" data-action="delete-prize" data-idx="${i}">✕</button>
        </div>`).join('')}
      </div>
      <button class="btn btn-secondary btn-block" data-action="add-prize" style="margin-top:6px;">+ 景品を追加</button>
      <button class="btn btn-primary btn-block" data-action="save-prizes" style="margin-top:6px;">景品を保存</button>
      <p class="form-hint">家事の他に、ルーレットに景品を追加できます</p>
    </div>

    <div class="card settings-card">
      <button class="btn btn-skip btn-block" data-action="enable-notif">リマインダー通知を有効にする</button>
      <p class="form-hint">毎晩、未完了の家事があれば通知します</p>
    </div>

    <details class="login-history-section">
      <summary>ログイン履歴</summary>
      <div id="login-history-list" class="login-history-list">
        <p class="empty-state">読み込み中...</p>
      </div>
    </details>

    <details class="login-history-section">
      <summary>外部サービス連携</summary>
      <div class="external-services-inner">
        <div class="form-group">
          <label>GAS Web App URL</label>
          <input type="url" id="set-gasWebAppUrl" value="${settings.gasWebAppUrl}" placeholder="https://script.google.com/macros/s/.../exec">
        </div>
        <div class="form-group">
          <label>スプレッドシートID</label>
          <input type="text" id="set-spreadsheetId" value="${settings.spreadsheetId}" placeholder="1ABC...xyz">
        </div>
        <div class="form-group">
          <label>Sheets API キー</label>
          <input type="text" id="set-sheetsApiKey" value="${settings.sheetsApiKey}" placeholder="AIza...">
        </div>
        <div class="form-group">
          <label>Claude API キー</label>
          <input type="password" id="set-claudeApiKey" value="${settings.claudeApiKey}" placeholder="sk-ant-...">
        </div>
        <button class="btn btn-primary btn-block" data-action="save-settings" style="margin-top:8px;">保存</button>
      </div>
    </details>

    <div style="margin-top:24px;">
      <button class="btn btn-danger btn-block" data-action="logout">ログアウト</button>
    </div>
    <p class="login-version" style="margin-top:12px;">v${APP_VERSION} <a href="#" data-action="show-changelog" style="color:var(--color-primary);">更新履歴</a></p>
  `;

  // Lazy-load login history on toggle
  const details = el.querySelector('.login-history-section');
  if (details) {
    details.addEventListener('toggle', async () => {
      if (!details.open) return;
      const listEl = document.getElementById('login-history-list');
      const result = await gasGet('getLoginHistory', { email: auth?.email });
      if (result && result.history) {
        listEl.innerHTML = result.history.map(h => `
          <div class="login-history-item">
            <span>${new Date(h.timestamp).toLocaleString('ja-JP')}</span>
            <span class="login-history-device">${parseUserAgent(h.userAgent)}</span>
          </div>
        `).join('') || '<p class="empty-state">履歴はありません</p>';
      } else {
        listEl.innerHTML = '<p class="empty-state">GAS未設定、またはデータなし</p>';
      }
    });
  }
}


// ============================================================
// Render: Chat Tab
// ============================================================
function renderChat() {
  const el = document.getElementById('chat-content');
  const messages = state.chatHistory.map(m =>
    `<div class="chat-bubble ${m.role === 'user' ? 'user' : 'ai'}">${m.content}</div>`
  ).join('');
  const loading = state.chatLoading ? '<div class="chat-loading"><span></span><span></span><span></span></div>' : '';
  const suggests = state.chatHistory.length === 0 ?
    `<div class="chat-suggest">${SUGGEST_TEXTS.map(t => `<button data-action="suggest" data-text="${t}">${t}</button>`).join('')}</div>` : '';

  el.innerHTML = `
    <div class="chat-messages" id="chat-messages">${messages}${loading}</div>
    ${suggests}
    <div class="chat-input-row">
      <input type="text" id="chat-input" placeholder="質問を入力..." autocomplete="off">
      <button data-action="send-chat">送信</button>
    </div>
  `;
  const msgEl = document.getElementById('chat-messages');
  if (msgEl) msgEl.scrollTop = msgEl.scrollHeight;
}

function buildSystemPrompt() {
  const weekKey = getWeekKey(new Date());
  const chores = loadWeeklyChores(weekKey) || [];
  const pts = loadPoints();
  return `あなたは家族の家事管理アシスタントです。2人家族（${settings.memberA || 'A'}と${settings.memberB || 'B'}）の家事分担を手伝います。
今週の家事状況:
${chores.map(c => `- ${c.name}: ${c.status ? STATUS_LABELS[c.status] + (c.doneBy ? '(' + c.doneBy + ')' : '') : '未着手'}`).join('\n')}
ポイント: ${settings.memberA || 'A'}=${pts.A?.total || 0}pt, ${settings.memberB || 'B'}=${pts.B?.total || 0}pt
簡潔に日本語で答えてください。`;
}

async function sendChatMessage(text) {
  if (!text.trim() || state.chatLoading) return;
  state.chatHistory.push({ role: 'user', content: text });
  state.chatLoading = true;
  renderChat();

  if (!settings.claudeApiKey) {
    state.chatHistory.push({ role: 'assistant', content: 'Claude APIキーが設定されていません。設定タブから入力してください。' });
    state.chatLoading = false;
    renderChat();
    return;
  }

  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.claudeApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: state.chatHistory.filter(m => m.role === 'user' || m.role === 'assistant').slice(-10).map(m => ({ role: m.role, content: m.content }))
      })
    });
    const data = await res.json();
    const reply = data.content?.[0]?.text || 'エラーが発生しました';
    state.chatHistory.push({ role: 'assistant', content: reply });
  } catch (e) {
    state.chatHistory.push({ role: 'assistant', content: '通信エラー: ' + e.message });
  }
  state.chatLoading = false;
  renderChat();
}

// ============================================================
// Render: Login Screen
// ============================================================
function renderLoginScreen(mode) {
  const form = document.getElementById('login-form');
  if (!form) return;
  const isRegister = mode === 'register';

  form.innerHTML = `
    ${isRegister ? `<div class="form-group">
      <label>表示名</label>
      <input type="text" id="auth-name" placeholder="例: たろう" autocomplete="name">
    </div>` : ''}
    <div class="form-group">
      <label>メールアドレス</label>
      <input type="email" id="auth-email" placeholder="your@email.com" autocomplete="email">
    </div>
    <div class="form-group">
      <label>PIN（4桁）</label>
      <input type="password" id="auth-pin" class="pin-input" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="••••" autocomplete="current-password">
    </div>
    ${isRegister ? `<div class="form-group">
      <label>PIN確認</label>
      <input type="password" id="auth-pin-confirm" class="pin-input" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="••••">
    </div>` : ''}
    <div class="login-error" id="login-error"></div>
    <button class="login-btn" data-action="${isRegister ? 'do-register' : 'do-login'}" id="login-submit">
      ${isRegister ? '新規登録' : 'ログイン'}
    </button>
    <button class="login-link" data-action="${isRegister ? 'show-login' : 'show-register'}">
      ${isRegister ? 'ログインに戻る' : '新規登録はこちら'}
    </button>
    <p class="login-info">GAS Web App URLが未設定の場合はローカルモードで動作します。<br>設定からGAS URLを入力するとクロスデバイス同期が有効になります。</p>
    <p class="login-version">v${APP_VERSION}</p>
  `;
}

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  renderLoginScreen('login');
}

function hideLoginScreen() {
  document.getElementById('login-screen').classList.add('hidden');
}

// ============================================================
// Roulette
// ============================================================
function makeWedgeClipPath(angleDeg) {
  const pts = ['50% 50%', '50% 0%'];
  const steps = Math.max(2, Math.ceil(angleDeg / 10));
  for (let s = 0; s <= steps; s++) {
    const a = (angleDeg * s / steps - 90) * Math.PI / 180;
    pts.push(`${(50 + 50 * Math.cos(a)).toFixed(1)}% ${(50 + 50 * Math.sin(a)).toFixed(1)}%`);
  }
  return `polygon(${pts.join(', ')})`;
}

function openRoulette() {
  const modal = document.getElementById('roulette-modal');
  modal.classList.remove('hidden');
  const container = document.getElementById('roulette-container');
  const choreItems = loadChores().filter(c => c.active).map(c => ({ name: c.name, type: 'chore' }));
  const prizeItems = loadPrizes().map(p => ({ name: p, type: 'prize' }));
  const items = [...choreItems, ...prizeItems];
  if (items.length === 0) { container.innerHTML = '<p>項目がありません</p>'; return; }
  // Store items for spinRoulette
  state.rouletteItems = items;

  const sliceAngle = 360 / items.length;
  const colors = ['#FFB5C5', '#FFDAB9', '#E6F1FB', '#EAF3DE', '#FBEAF0', '#E1F5EE', '#EEEDFE', '#FAEEDA'];
  const clipPath = makeWedgeClipPath(sliceAngle);

  let wheelHtml = '<div class="roulette-wheel" id="roulette-wheel">';
  items.forEach((item, i) => {
    const angle = sliceAngle * i;
    const halfAngle = sliceAngle / 2;
    const bg = colors[i % colors.length];
    wheelHtml += `<div class="roulette-slice" style="transform:rotate(${angle}deg);background:${bg};clip-path:${clipPath};"><span class="roulette-label" style="transform:rotate(${halfAngle}deg)">${item.name}</span></div>`;
  });
  wheelHtml += '</div>';

  container.innerHTML = `
    <div class="roulette-pointer"></div>
    ${wheelHtml}
    <div class="roulette-result" id="roulette-result"></div>
    <div class="roulette-actions">
      <button class="btn btn-primary" data-action="spin-roulette" id="spin-btn">回す！</button>
    </div>
  `;
}

function spinRoulette() {
  const items = state.rouletteItems || [];
  if (!items.length) return;
  const spinBtn = document.getElementById('spin-btn');
  spinBtn.disabled = true;

  const wheel = document.getElementById('roulette-wheel');
  const randomIdx = Math.floor(Math.random() * items.length);
  const sliceAngle = 360 / items.length;
  const targetAngle = 360 * 5 + (360 - sliceAngle * randomIdx - sliceAngle / 2);
  wheel.style.transform = `rotate(${targetAngle}deg)`;

  setTimeout(() => {
    const selected = items[randomIdx];
    document.getElementById('roulette-result').textContent = `「${selected.name}」に決定！`;

    // Deduct points and create request
    const pts = loadPoints();
    const myName = getDisplayName();
    const myKey = myName === settings.memberB ? 'B' : 'A';
    const otherName = myKey === 'A' ? (settings.memberB || 'B') : (settings.memberA || 'A');
    pts[myKey].total = Math.max(0, pts[myKey].total - 10);
    pts[myKey].history.push({ date: today(), choreName: selected.name, points: 10, type: 'spent', by: myName });
    savePoints(pts);

    const reqs = loadRequests();
    reqs.push({ id: 'req_' + Date.now(), choreName: selected.name, from: myName, to: otherName, completed: false, date: today() });
    saveRequests(reqs);

    // Sync to GAS
    gasPost('updatePoints', { points: pts });
    gasPost('addRequest', { request: reqs[reqs.length - 1] });

    spinBtn.textContent = '閉じる';
    spinBtn.disabled = false;
    spinBtn.setAttribute('data-action', 'close-roulette');
  }, 4500);
}

// ============================================================
// Notifications
// ============================================================
function initNotifications() {
  if (!('Notification' in window) || Notification.permission === 'granted') return;
}
function requestNotificationPermission() {
  if ('Notification' in window) Notification.requestPermission();
}
function checkAndNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const weekKey = getWeekKey(new Date());
  const chores = loadWeeklyChores(weekKey);
  if (!chores) return;
  const pending = chores.filter(c => !c.status);
  if (pending.length > 0) {
    const names = pending.slice(0, 3).map(c => c.name).join('、');
    const more = pending.length > 3 ? `他${pending.length - 3}件` : '';
    new Notification('おうち当番リマインダー', {
      body: `未完了: ${names}${more}`,
      tag: 'ouchi-reminder'
    });
  }
}
function scheduleReminder() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);
  if (now > target) target.setDate(target.getDate() + 1);
  const ms = target - now;
  setTimeout(() => { checkAndNotify(); scheduleReminder(); }, ms);
}

// ============================================================
// Event Handlers
// ============================================================
document.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.getAttribute('data-action');

  switch (action) {
    // --- Auth ---
    case 'do-login': {
      const email = document.getElementById('auth-email')?.value?.trim();
      const pin = document.getElementById('auth-pin')?.value?.trim();
      const errEl = document.getElementById('login-error');
      if (!email || !pin || pin.length !== 4) { errEl.textContent = 'メールと4桁PINを入力してください'; return; }
      target.disabled = true;
      target.textContent = 'ログイン中...';
      const result = await handleLogin(email, pin);
      if (result.success) {
        hideLoginScreen(); initApp();
        if (result.warning) setTimeout(() => alert(result.warning), 300);
      }
      else { errEl.textContent = result.error || 'ログインに失敗しました'; target.disabled = false; target.textContent = 'ログイン'; }
      break;
    }
    case 'do-register': {
      const email = document.getElementById('auth-email')?.value?.trim();
      const name = document.getElementById('auth-name')?.value?.trim();
      const pin = document.getElementById('auth-pin')?.value?.trim();
      const pinConfirm = document.getElementById('auth-pin-confirm')?.value?.trim();
      const errEl = document.getElementById('login-error');
      if (!email || !name || !pin || pin.length !== 4) { errEl.textContent = '全ての項目を入力してください'; return; }
      if (pin !== pinConfirm) { errEl.textContent = 'PINが一致しません'; return; }
      target.disabled = true;
      target.textContent = '登録中...';
      const result = await handleRegister(email, name, pin);
      if (result.success) {
        hideLoginScreen(); initApp();
        if (result.warning) setTimeout(() => alert(result.warning), 300);
      }
      else { errEl.textContent = result.error || '登録に失敗しました'; target.disabled = false; target.textContent = '新規登録'; }
      break;
    }
    case 'show-login': renderLoginScreen('login'); break;
    case 'show-register': renderLoginScreen('register'); break;
    case 'logout': clearAuth(); showLoginScreen(); break;

    // --- Invite Code ---
    case 'generate-invite': {
      const code = generateInviteCode();
      const out = document.getElementById('invite-code-output');
      if (out) {
        out.style.display = 'block';
        out.innerHTML = `<p class="form-hint" style="margin-bottom:4px;">このコードを相手に送ってください:</p>
          <textarea class="invite-code-text" readonly rows="3">${code}</textarea>
          <button class="btn btn-secondary btn-block" data-action="copy-invite" style="margin-top:4px;">コピー</button>`;
      }
      break;
    }
    case 'copy-invite': {
      const textarea = document.querySelector('.invite-code-text');
      if (textarea) {
        navigator.clipboard.writeText(textarea.value).then(() => {
          target.textContent = 'コピーしました!';
          setTimeout(() => { target.textContent = 'コピー'; }, 2000);
        });
      }
      break;
    }
    case 'apply-invite': {
      const code = document.getElementById('invite-code-input')?.value;
      const resultEl = document.getElementById('invite-apply-result');
      if (!code?.trim()) { resultEl.textContent = 'コードを入力してください'; return; }
      const result = applyInviteCode(code);
      if (result.success) {
        resultEl.innerHTML = '<span style="color:#3B6D11">設定を適用しました!</span>';
        syncFromGAS();
        setTimeout(() => renderSettings(), 500);
      } else {
        resultEl.innerHTML = `<span style="color:#C53030">${result.error}</span>`;
      }
      break;
    }

    // --- Chore Status ---
    case 'quick-done': {
      const choreId = target.getAttribute('data-chore-id');
      const weekKey = target.getAttribute('data-week');
      const chores = loadWeeklyChores(weekKey);
      if (!chores) break;
      const chore = chores.find(c => c.id === choreId);
      if (!chore) break;
      chore.status = 'done';
      chore.doneBy = getDisplayName();
      chore.doneAt = new Date().toISOString();
      chore.date = today();
      saveWeeklyChores(weekKey, chores);
      // Add points
      const pts = loadPoints();
      const myKey = getDisplayName() === settings.memberB ? 'B' : 'A';
      pts[myKey].total = (pts[myKey].total || 0) + (chore.difficulty || 1);
      pts[myKey].history.push({ date: today(), choreName: chore.name, points: chore.difficulty || 1, type: 'earned', by: getDisplayName() });
      savePoints(pts);
      gasPost('updateChoreStatus', { weekKey, choreId, status: 'done', doneBy: getDisplayName() });
      gasPost('updatePoints', { points: pts });
      renderToday();
      break;
    }
    case 'open-status-modal': {
      state.selectedChoreId = target.getAttribute('data-chore-id');
      state.selectedWeekKey = target.getAttribute('data-week');
      document.getElementById('status-modal').classList.remove('hidden');
      break;
    }
    case 'set-status': {
      const status = target.getAttribute('data-status');
      const weekKey = state.selectedWeekKey;
      const choreId = state.selectedChoreId;
      if (!weekKey || !choreId) break;
      const chores = loadWeeklyChores(weekKey);
      if (!chores) break;
      const chore = chores.find(c => c.id === choreId);
      if (!chore) break;
      chore.status = status;
      chore.doneBy = getDisplayName();
      chore.doneAt = new Date().toISOString();
      chore.date = today();
      saveWeeklyChores(weekKey, chores);
      if (status === 'done') {
        const pts = loadPoints();
        const myKey = getDisplayName() === settings.memberB ? 'B' : 'A';
        pts[myKey].total = (pts[myKey].total || 0) + (chore.difficulty || 1);
        pts[myKey].history.push({ date: today(), choreName: chore.name, points: chore.difficulty || 1, type: 'earned', by: getDisplayName() });
        savePoints(pts);
        gasPost('updatePoints', { points: pts });
      }
      gasPost('updateChoreStatus', { weekKey, choreId, status, doneBy: getDisplayName() });
      document.getElementById('status-modal').classList.add('hidden');
      state.selectedChoreId = null;
      state.selectedWeekKey = null;
      renderToday();
      break;
    }
    case 'close-modal':
      document.getElementById('status-modal').classList.add('hidden');
      break;

    // --- Roulette ---
    case 'open-roulette': openRoulette(); break;
    case 'spin-roulette': spinRoulette(); break;
    case 'close-roulette':
      document.getElementById('roulette-modal').classList.add('hidden');
      renderPoints();
      break;
    case 'show-changelog': {
      const modal = document.getElementById('changelog-modal');
      modal.classList.remove('hidden');
      document.getElementById('changelog-content').innerHTML = CHANGELOG.map(v =>
        `<div class="changelog-entry">
          <div class="changelog-version">v${v.version} <span class="changelog-date">${v.date}</span></div>
          <ul>${v.changes.map(c => `<li>${c}</li>`).join('')}</ul>
        </div>`
      ).join('');
      break;
    }
    case 'close-changelog':
      document.getElementById('changelog-modal').classList.add('hidden');
      break;

    // --- Request ---
    case 'complete-request': {
      const reqId = target.getAttribute('data-request-id');
      const reqs = loadRequests();
      const req = reqs.find(r => r.id === reqId);
      if (req) { req.completed = true; saveRequests(reqs); gasPost('completeRequest', { requestId: reqId }); }
      renderToday();
      break;
    }

    // --- Settings ---
    case 'save-settings': {
      settings.memberA = document.getElementById('set-memberA')?.value?.trim() || '';
      settings.memberB = document.getElementById('set-memberB')?.value?.trim() || '';
      settings.emailA = document.getElementById('set-emailA')?.value?.trim() || '';
      settings.emailB = document.getElementById('set-emailB')?.value?.trim() || '';
      settings.garbageAreaId = document.getElementById('set-garbageAreaId')?.value?.trim() || '155';
      settings.weatherLat = document.getElementById('set-weatherLat')?.value?.trim() || '34.7333';
      settings.weatherLon = document.getElementById('set-weatherLon')?.value?.trim() || '135.3417';
      settings.gasWebAppUrl = document.getElementById('set-gasWebAppUrl')?.value?.trim() || '';
      settings.spreadsheetId = document.getElementById('set-spreadsheetId')?.value?.trim() || '';
      settings.sheetsApiKey = document.getElementById('set-sheetsApiKey')?.value?.trim() || '';
      settings.claudeApiKey = document.getElementById('set-claudeApiKey')?.value?.trim() || '';
      saveSettingsToLocal();
      gasPost('saveSettings', { settings });
      // Clear caches when settings change
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('garbage_')) localStorage.removeItem(key);
      }
      localStorage.removeItem('ouchi_weather');
      refreshGarbageCache();
      alert('設定を保存しました');
      break;
    }
    case 'add-chore': {
      const chores = loadChores();
      chores.push({ id: 'c_' + Date.now(), name: '新しい家事', difficulty: 1, frequency: 'weekly', days: [], assignee: '', createdBy: getDisplayName(), active: true });
      saveChores(chores);
      renderSettings();
      break;
    }
    case 'delete-chore': {
      const idx = parseInt(target.getAttribute('data-idx'));
      const chores = loadChores();
      if (idx >= 0 && idx < chores.length) { chores.splice(idx, 1); saveChores(chores); renderSettings(); }
      break;
    }
    case 'move-chore-up': {
      const idx = parseInt(target.getAttribute('data-idx'));
      const chores = loadChores();
      if (idx > 0) { [chores[idx - 1], chores[idx]] = [chores[idx], chores[idx - 1]]; saveChores(chores); renderSettings(); }
      break;
    }
    case 'move-chore-down': {
      const idx = parseInt(target.getAttribute('data-idx'));
      const chores = loadChores();
      if (idx < chores.length - 1) { [chores[idx], chores[idx + 1]] = [chores[idx + 1], chores[idx]]; saveChores(chores); renderSettings(); }
      break;
    }
    case 'save-chores': {
      const chores = loadChores();
      document.querySelectorAll('.chore-editor-item').forEach(item => {
        const idx = parseInt(item.getAttribute('data-idx'));
        if (idx >= 0 && idx < chores.length) {
          chores[idx].name = item.querySelector('input[data-field="name"]')?.value?.trim() || chores[idx].name;
          chores[idx].difficulty = parseInt(item.querySelector('select[data-field="difficulty"]')?.value) || 1;
          chores[idx].frequency = item.querySelector('select[data-field="frequency"]')?.value || 'weekly';
          chores[idx].assignee = item.querySelector('select[data-field="assignee"]')?.value || '';
          const days = [];
          item.querySelectorAll('input[data-field="day"]:checked').forEach(cb => days.push(parseInt(cb.getAttribute('data-day'))));
          chores[idx].days = days;
        }
      });
      saveChores(chores);
      gasPost('saveChores', { chores });
      alert('家事リストを保存しました');
      break;
    }
    // --- Prize ---
    case 'add-prize': {
      const prizes = loadPrizes();
      prizes.push('新しい景品');
      savePrizes(prizes);
      renderSettings();
      break;
    }
    case 'delete-prize': {
      const idx = parseInt(target.getAttribute('data-idx'));
      const prizes = loadPrizes();
      if (idx >= 0) { prizes.splice(idx, 1); savePrizes(prizes); renderSettings(); }
      break;
    }
    case 'save-prizes': {
      const prizes = [];
      document.querySelectorAll('.prize-editor-item input').forEach(inp => {
        const v = inp.value.trim();
        if (v) prizes.push(v);
      });
      savePrizes(prizes);
      alert('景品を保存しました');
      break;
    }
    // --- Shopping Memo ---
    case 'add-memo': {
      const input = document.getElementById('memo-input');
      const text = input?.value?.trim();
      if (!text) return;
      const memo = loadShoppingMemo();
      memo.push({ text, done: false });
      saveShoppingMemo(memo);
      renderToday();
      break;
    }
    case 'toggle-memo': {
      const idx = parseInt(target.getAttribute('data-idx'));
      const memo = loadShoppingMemo();
      if (memo[idx]) { memo[idx].done = !memo[idx].done; saveShoppingMemo(memo); }
      break;
    }
    case 'delete-memo': {
      const idx = parseInt(target.getAttribute('data-idx'));
      const memo = loadShoppingMemo();
      memo.splice(idx, 1);
      saveShoppingMemo(memo);
      renderToday();
      break;
    }
    // --- Photo ---
    case 'take-photo': {
      const choreId = target.getAttribute('data-chore-id');
      const weekKey = target.getAttribute('data-week');
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxW = 200;
            const scale = maxW / img.width;
            canvas.width = maxW;
            canvas.height = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            savePhoto(choreId, weekKey, canvas.toDataURL('image/jpeg', 0.5));
            renderToday();
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      };
      input.click();
      break;
    }
    case 'enable-notif': requestNotificationPermission(); break;

    // --- Calendar Navigation ---
    case 'prev-week': state.currentWeekOffset--; renderCalendar(); break;
    case 'next-week': state.currentWeekOffset++; renderCalendar(); break;
    case 'this-week': state.currentWeekOffset = 0; renderCalendar(); break;
    case 'prev-month': state.currentWeekOffset -= 4; renderCalendar(); break;
    case 'next-month': state.currentWeekOffset += 4; renderCalendar(); break;

    // --- Chat ---
    case 'send-chat': {
      const input = document.getElementById('chat-input');
      if (input) { sendChatMessage(input.value); input.value = ''; }
      break;
    }
    case 'suggest': {
      const input = document.getElementById('chat-input');
      if (input) { input.value = target.getAttribute('data-text'); sendChatMessage(input.value); input.value = ''; }
      break;
    }

    // --- Sync ---
    case 'sync-now': {
      await syncFromGAS();
      renderToday();
      break;
    }
  }
});

// Keyboard: Enter to send chat
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'chat-input') {
    e.preventDefault();
    sendChatMessage(e.target.value);
    e.target.value = '';
  }
});

// Bottom nav
document.querySelector('.bottom-nav')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-btn');
  if (btn) switchTab(btn.getAttribute('data-tab'));
});

// ============================================================
// Initialization
// ============================================================
function initApp() {
  loadSettings();
  switchTab('today');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  syncFromGAS();
  refreshGarbageCache();
  checkAndNotify();
  scheduleReminder();
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  if (isAuthenticated()) {
    hideLoginScreen();
    initApp();
  } else {
    showLoginScreen();
  }
});
