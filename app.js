// ============================================================
// おうち当番 v2 - Main Application
// ============================================================

// --- Constants ---
const APP_VERSION = '1.0.0';
const DEFAULT_CHORES = [
  { id: 'c1', name: 'ゴミ出し', difficulty: 2 },
  { id: 'c2', name: '食事作り', difficulty: 3 },
  { id: 'c3', name: '食器洗い', difficulty: 2 },
  { id: 'c4', name: '風呂掃除', difficulty: 2 },
  { id: 'c5', name: 'トイレ掃除', difficulty: 2 },
  { id: 'c6', name: '床掃除・掃除機', difficulty: 2 },
  { id: 'c7', name: '飲み物・日用品買い出し', difficulty: 1 }
];

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
  return auth ? auth.displayName || auth.email : '';
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
    if (c && c.length) return c;
  } catch {}
  return DEFAULT_CHORES.map(c => ({ ...c, createdBy: 'system', active: true }));
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

function initWeekIfNeeded(weekKey) {
  let chores = loadWeeklyChores(weekKey);
  if (chores) return chores;
  const choreList = loadChores().filter(c => c.active);
  chores = choreList.map(c => ({
    id: c.id, name: c.name, difficulty: c.difficulty || 1,
    status: null, doneBy: null, doneAt: null, date: null, points: c.difficulty || 1
  }));
  // Pull carry-overs from previous week
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
// Auth Handlers
// ============================================================
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
  if (result && result.error) return result;
  // GAS通信失敗 → ローカルモードにフォールバック
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
  if (result && result.error) return result;
  // GAS通信失敗 → ローカルモードにフォールバック
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
  const garbage = getGarbageForDate(todayStr);
  const weekKey = getWeekKey(d);
  const chores = initWeekIfNeeded(weekKey);
  const myName = getDisplayName();
  const syncTime = state.lastSync ? state.lastSync.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '-';

  const requests = loadRequests().filter(r => !r.completed);
  const requestHtml = requests.length > 0 ? requests.map(r =>
    `<div class="request-badge">
      <span class="badge-icon">🎰</span>
      <span>${r.from}から: <strong>${r.choreName}</strong>をお願い！</span>
      <button class="btn btn-complete" data-action="complete-request" data-request-id="${r.id}">完了</button>
    </div>`
  ).join('') : '';

  el.innerHTML = `
    <div class="today-date">${d.getMonth() + 1}月${d.getDate()}日</div>
    <div class="today-day">${d.getFullYear()}年 ${dayName}曜日</div>
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
    <p class="section-title">今週の家事チェックリスト</p>
    <div class="card">
      ${chores.length === 0 ? '<p class="empty-state">家事が登録されていません。設定から追加してください。</p>' :
        chores.map(c => {
          const badge = c.status ? `<span class="status-badge ${c.status}">${STATUS_LABELS[c.status]}${c.doneBy ? ' (' + c.doneBy + ')' : ''}</span>` : '';
          const carryBadge = c.carryOver ? '<span class="carry-badge">持ち越し</span>' : '';
          const actions = !c.status ? `
            <div class="chore-actions">
              <button class="btn btn-complete" data-action="quick-done" data-chore-id="${c.id}" data-week="${weekKey}">やった</button>
              <button class="btn btn-skip" data-action="open-status-modal" data-chore-id="${c.id}" data-week="${weekKey}">...</button>
            </div>` : '';
          return `<div class="chore-item ${c.status ? 'chore-' + c.status : ''}">
            <div class="chore-info">
              <div class="chore-name">${c.name}${carryBadge}</div>
              <div class="chore-difficulty">${difficultyStars(c.difficulty)} (${c.difficulty}pt)</div>
              ${badge}
            </div>
            ${actions}
          </div>`;
        }).join('')
      }
    </div>
  `;

  // Async weather load
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

  el.innerHTML = navHtml + daysHtml;
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
  const otherKey = myKey === 'A' ? 'B' : 'A';
  const myPts = pts[myKey]?.total || 0;
  const canSpin = myPts >= 10;

  const requests = loadRequests().filter(r => !r.completed);
  const requestHtml = requests.length > 0 ? `
    <p class="section-title">おねがいされた家事</p>
    ${requests.map(r => `<div class="request-badge">
      <span class="badge-icon">🎰</span>
      <span>${r.from}さんから: <strong>${r.choreName}</strong></span>
    </div>`).join('')}` : '';

  el.innerHTML = `
    <div class="points-row">
      <div class="point-card">
        <div class="member-name">${nameA}</div>
        <div class="point-value">${pts.A?.total || 0}</div>
        <div class="point-label">ポイント</div>
        <div class="progress-bar"><div class="fill" style="width:${Math.min(100, ((pts.A?.total || 0) % 10) * 10)}%"></div></div>
      </div>
      <div class="point-card">
        <div class="member-name">${nameB}</div>
        <div class="point-value">${pts.B?.total || 0}</div>
        <div class="point-label">ポイント</div>
        <div class="progress-bar"><div class="fill" style="width:${Math.min(100, ((pts.B?.total || 0) % 10) * 10)}%"></div></div>
      </div>
    </div>
    ${canSpin ? `<div class="roulette-trigger">
      <button class="btn" data-action="open-roulette">🎰 ルーレットを回す！</button>
      <p style="font-size:12px;color:var(--color-text-sub);margin-top:4px;">10ポイント消費で相手に家事をおねがいできます</p>
    </div>` : ''}
    ${requestHtml}
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
      <input type="text" value="${c.name}" data-field="name" data-idx="${i}">
      <select data-field="difficulty" data-idx="${i}">
        ${[1,2,3,4,5].map(n => `<option value="${n}" ${c.difficulty === n ? 'selected' : ''}>${'★'.repeat(n)}</option>`).join('')}
      </select>
      <button class="btn-del" data-action="delete-chore" data-idx="${i}">✕</button>
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

      <div class="form-section-title">外部サービス連携</div>
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

      <button class="btn btn-primary btn-block" data-action="save-settings" style="margin-top:16px;">設定を保存</button>
    </div>

    <div class="card settings-card">
      <div class="form-section-title" style="border-top:none;margin-top:0;padding-top:0;">家事リスト管理</div>
      <div id="chore-editor">${choreEditorHtml}</div>
      <button class="btn btn-secondary btn-block" data-action="add-chore" style="margin-top:8px;">+ 新しい家事を追加</button>
      <button class="btn btn-primary btn-block" data-action="save-chores" style="margin-top:8px;">家事リストを保存</button>
    </div>

    <div class="card settings-card">
      <button class="btn btn-skip btn-block" data-action="enable-notif">通知を有効にする</button>
    </div>

    <details class="login-history-section">
      <summary>ログイン履歴</summary>
      <div id="login-history-list" class="login-history-list">
        <p class="empty-state">読み込み中...</p>
      </div>
    </details>

    <div style="margin-top:24px;">
      <button class="btn btn-danger btn-block" data-action="logout">ログアウト</button>
    </div>
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
function openRoulette() {
  const modal = document.getElementById('roulette-modal');
  modal.classList.remove('hidden');
  const container = document.getElementById('roulette-container');
  const chores = loadChores().filter(c => c.active);
  if (chores.length === 0) { container.innerHTML = '<p>家事が登録されていません</p>'; return; }

  const sliceAngle = 360 / chores.length;
  const colors = ['#FFB5C5', '#FFDAB9', '#E6F1FB', '#EAF3DE', '#FBEAF0', '#E1F5EE', '#EEEDFE', '#FAEEDA'];

  let wheelHtml = '<div class="roulette-wheel" id="roulette-wheel">';
  chores.forEach((c, i) => {
    const angle = sliceAngle * i;
    const bg = colors[i % colors.length];
    wheelHtml += `<div class="roulette-slice" style="transform:rotate(${angle}deg);background:${bg};">${c.name}</div>`;
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
  const chores = loadChores().filter(c => c.active);
  if (!chores.length) return;
  const spinBtn = document.getElementById('spin-btn');
  spinBtn.disabled = true;

  const wheel = document.getElementById('roulette-wheel');
  const randomIdx = Math.floor(Math.random() * chores.length);
  const sliceAngle = 360 / chores.length;
  const targetAngle = 360 * 5 + (360 - sliceAngle * randomIdx - sliceAngle / 2);
  wheel.style.transform = `rotate(${targetAngle}deg)`;

  setTimeout(() => {
    const selected = chores[randomIdx];
    document.getElementById('roulette-result').textContent = `「${selected.name}」に決定！`;

    // Deduct points and create request
    const pts = loadPoints();
    const myName = getDisplayName();
    const myKey = myName === settings.memberB ? 'B' : 'A';
    const otherName = myKey === 'A' ? (settings.memberB || 'B') : (settings.memberA || 'A');
    pts[myKey].total -= 10;
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
    new Notification('おうち当番', { body: `未完了の家事が${pending.length}件あります`, icon: './manifest.json' });
  }
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
      chores.push({ id: 'c_' + Date.now(), name: '新しい家事', difficulty: 1, createdBy: getDisplayName(), active: true });
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
    case 'save-chores': {
      const chores = loadChores();
      document.querySelectorAll('.chore-editor-item').forEach(item => {
        const idx = parseInt(item.getAttribute('data-idx'));
        if (idx >= 0 && idx < chores.length) {
          chores[idx].name = item.querySelector('input[data-field="name"]')?.value?.trim() || chores[idx].name;
          chores[idx].difficulty = parseInt(item.querySelector('select[data-field="difficulty"]')?.value) || 1;
        }
      });
      saveChores(chores);
      gasPost('saveChores', { chores });
      alert('家事リストを保存しました');
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
  const hasSettings = settings.memberA || settings.memberB;
  switchTab(hasSettings ? 'today' : 'settings');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  syncFromGAS();
  refreshGarbageCache();
  checkAndNotify();
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
