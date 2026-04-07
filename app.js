// ============================================================
// おうち当番 - Main Application
// ============================================================

// --- Constants ---
const CHORES = ['ゴミ出し', '食事作り', '食器洗い', '風呂掃除', 'トイレ掃除', '床掃除・掃除機', '飲み物・日用品買い出し'];

const GARBAGE_COLORS = {
  'もやすごみ': 'burn', '燃やすごみ': 'burn', '可燃ごみ': 'burn', '可燃': 'burn',
  '不燃ごみ': 'nonburn', '燃やさないごみ': 'nonburn', '不燃': 'nonburn',
  '資源': 'resource', '資源ごみ': 'resource',
  'びん': 'bottle', 'ビン': 'bottle',
  'プラ資源': 'plastic', 'プラスチック': 'plastic', '容器包装プラスチック': 'plastic',
  '缶・ペット': 'can', '缶': 'can', 'ペットボトル': 'can', 'かん': 'can',
  'ペット': 'can'
};

const CORS_PROXIES = [
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url='
];

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const SUGGEST_TEXTS = ['今週の分担を提案して', '最近サボりがちな家事は？', '来週の調整案を出して'];

// --- State ---
let settings = {
  memberA: '', memberB: '',
  emailA: '', emailB: '',
  spreadsheetId: '', sheetsApiKey: '', claudeApiKey: '', gasWebAppUrl: '',
  startDate: ''
};
let state = {
  schedule: [],
  points: { A: { skip: 0, done: 0 }, B: { skip: 0, done: 0 } },
  currentWeekOffset: 0,
  chatHistory: [],
  chatSending: false
};

// --- Settings persistence ---
function loadSettings() {
  try {
    const saved = localStorage.getItem('ouchi_settings');
    if (saved) Object.assign(settings, JSON.parse(saved));
  } catch (e) { /* ignore */ }
}

function saveSettingsToLocal() {
  localStorage.setItem('ouchi_settings', JSON.stringify(settings));
}

function loadSchedule() {
  try {
    const saved = localStorage.getItem('ouchi_schedule');
    if (saved) state.schedule = JSON.parse(saved);
  } catch (e) { state.schedule = []; }
}

function saveSchedule() {
  localStorage.setItem('ouchi_schedule', JSON.stringify(state.schedule));
}

function loadPoints() {
  try {
    const saved = localStorage.getItem('ouchi_points');
    if (saved) state.points = JSON.parse(saved);
  } catch (e) { /* ignore */ }
}

function savePoints() {
  localStorage.setItem('ouchi_points', JSON.stringify(state.points));
}

// --- Date helpers ---
function today() {
  const d = new Date();
  return fmtDate(d);
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return dt;
}

function weekNumber(dateStr, startDateStr) {
  const d = parseDate(dateStr);
  const s = parseDate(startDateStr);
  const diff = Math.floor((d - s) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

// --- Tab switching ---
function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + tabId);
  const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');

  switch (tabId) {
    case 'today': renderToday(); break;
    case 'calendar': renderCalendar(); break;
    case 'points': renderPoints(); break;
    case 'settings': renderSettings(); break;
    case 'chat': renderChat(); break;
  }
}

// --- Google Sheets API ---
async function sheetsGet(sheetName, range) {
  if (!settings.spreadsheetId || !settings.sheetsApiKey) return null;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${settings.spreadsheetId}/values/${encodeURIComponent(sheetName)}!${range}?key=${settings.sheetsApiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.values || [];
  } catch (e) {
    console.error('Sheets GET error:', e);
    return null;
  }
}

async function gasPost(action, data) {
  if (!settings.gasWebAppUrl) return null;
  try {
    const res = await fetch(settings.gasWebAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, data })
    });
    return await res.json();
  } catch (e) {
    console.error('GAS POST error:', e);
    return null;
  }
}

async function syncFromSheets() {
  const rows = await sheetsGet('当番表', 'A2:E500');
  if (rows && rows.length > 0) {
    state.schedule = rows.map(r => ({
      date: r[0] || '', chore: r[1] || '', member: r[2] || '',
      done: Number(r[3]) || 0, skip: Number(r[4]) || 0
    }));
    saveSchedule();
  }
  const pts = await sheetsGet('ポイント', 'A2:C10');
  if (pts && pts.length > 0) {
    pts.forEach(r => {
      if (r[0] === settings.memberA) {
        state.points.A = { skip: Number(r[1]) || 0, done: Number(r[2]) || 0 };
      } else if (r[0] === settings.memberB) {
        state.points.B = { skip: Number(r[1]) || 0, done: Number(r[2]) || 0 };
      }
    });
    savePoints();
  }
}

// --- Garbage scraping ---
async function fetchGarbagePage(year, month) {
  const targetUrl = `https://www.nishi.or.jp/homepage/gomicalendar/calendar.html?date=${year}-${month}&id=257`;
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(targetUrl));
      if (res.ok) return await res.text();
    } catch (e) { continue; }
  }
  return null;
}

function parseGarbageHTML(html, year, month) {
  const days = {};
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Look for calendar cells - try multiple selectors for robustness
    const cells = doc.querySelectorAll('td[class*="calendar"], td[class*="day"], .calendarDay, .calendar td');
    if (cells.length > 0) {
      cells.forEach(cell => {
        const dayEl = cell.querySelector('.day, .date, span');
        const dayNum = dayEl ? parseInt(dayEl.textContent.trim()) : parseInt(cell.textContent.trim());
        if (!dayNum || isNaN(dayNum) || dayNum < 1 || dayNum > 31) return;
        const types = [];
        const text = cell.textContent.replace(String(dayNum), '').trim();
        Object.keys(GARBAGE_COLORS).forEach(key => {
          if (text.includes(key)) types.push(key);
        });
        // Also check for specific elements
        cell.querySelectorAll('.gomi, .garbage, span, p, div').forEach(el => {
          const t = el.textContent.trim();
          if (t && GARBAGE_COLORS[t]) types.push(t);
        });
        if (types.length > 0) {
          days[dayNum] = [...new Set(types)];
        }
      });
    }
    // Fallback: try parsing table rows
    if (Object.keys(days).length === 0) {
      const rows = doc.querySelectorAll('table tr');
      rows.forEach(row => {
        const tds = row.querySelectorAll('td');
        tds.forEach(td => {
          const text = td.innerHTML;
          const dayMatch = text.match(/(\d{1,2})/);
          if (dayMatch) {
            const dayNum = parseInt(dayMatch[1]);
            if (dayNum >= 1 && dayNum <= 31) {
              const types = [];
              Object.keys(GARBAGE_COLORS).forEach(key => {
                if (text.includes(key)) types.push(key);
              });
              if (types.length > 0) {
                days[dayNum] = [...new Set(types)];
              }
            }
          }
        });
      });
    }
  } catch (e) {
    console.error('Parse error:', e);
  }
  return days;
}

async function refreshGarbageCache() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const cacheKey = `garbage_${year}_${month}`;
  if (localStorage.getItem(cacheKey)) return;

  const html = await fetchGarbagePage(year, month);
  if (html) {
    const days = parseGarbageHTML(html, year, month);
    localStorage.setItem(cacheKey, JSON.stringify(days));
  }
  // Also fetch next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextKey = `garbage_${nextYear}_${nextMonth}`;
  if (!localStorage.getItem(nextKey)) {
    const html2 = await fetchGarbagePage(nextYear, nextMonth);
    if (html2) {
      const days2 = parseGarbageHTML(html2, nextYear, nextMonth);
      localStorage.setItem(nextKey, JSON.stringify(days2));
    }
  }
}

function getGarbageForDate(dateStr) {
  const d = parseDate(dateStr);
  const key = `garbage_${d.getFullYear()}_${d.getMonth() + 1}`;
  try {
    const cache = JSON.parse(localStorage.getItem(key) || '{}');
    return cache[d.getDate()] || [];
  } catch (e) { return []; }
}

function renderGarbageTags(types) {
  if (!types || types.length === 0) return '<p class="no-garbage">今日はゴミなし</p>';
  return types.map(t => {
    const cls = GARBAGE_COLORS[t] || 'burn';
    return `<span class="garbage-tag ${cls}">${t}</span>`;
  }).join('');
}

// --- Chore rotation ---
function generateSchedule(startDateStr, weeks) {
  const rows = [];
  const start = parseDate(startDateStr);
  const monday = getMonday(start);
  const pointDiff = state.points.A.skip - state.points.B.skip;

  for (let w = 0; w < weeks; w++) {
    const weekStart = addDays(monday, w * 7);
    const isOdd = w % 2 === 0;
    let aCount, bCount;

    if (Math.abs(pointDiff) >= 3) {
      if (pointDiff > 0) { aCount = 3; bCount = 4; }
      else { aCount = 4; bCount = 3; }
    } else {
      aCount = isOdd ? 4 : 3;
      bCount = isOdd ? 3 : 4;
    }

    const shuffled = [...CHORES];
    const aChores = shuffled.slice(0, aCount);
    const bChores = shuffled.slice(aCount);

    for (let d = 0; d < 7; d++) {
      const date = fmtDate(addDays(weekStart, d));
      aChores.forEach(c => rows.push({ date, chore: c, member: settings.memberA, done: 0, skip: 0 }));
      bChores.forEach(c => rows.push({ date, chore: c, member: settings.memberB, done: 0, skip: 0 }));
    }
  }
  return rows;
}

function calculatePointsFromSchedule() {
  const pts = { A: { skip: 0, done: 0 }, B: { skip: 0, done: 0 } };
  state.schedule.forEach(row => {
    const key = row.member === settings.memberA ? 'A' : 'B';
    if (row.skip) pts[key].skip++;
    if (row.done) pts[key].done++;
  });
  return pts;
}

// --- Notifications ---
function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    showTodayNotification();
  }
}

function showTodayNotification() {
  const todayStr = today();
  const myChores = state.schedule.filter(r => r.date === todayStr && !r.done && !r.skip);
  if (myChores.length === 0) return;
  const names = myChores.map(r => r.chore).join('・');
  new Notification('おうち当番', { body: `今日の担当: ${names}`, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="%234A90D9"/><text x="32" y="44" font-size="36" text-anchor="middle" fill="white">🏠</text></svg>' });
}

// --- Claude AI Chat ---
function buildSystemPrompt() {
  const hist = state.schedule.filter(r => {
    const d = parseDate(r.date);
    const fourWeeksAgo = addDays(new Date(), -28);
    return d >= fourWeeksAgo;
  }).map(r => `${r.date} ${r.chore} → ${r.member} ${r.done ? '✓完了' : r.skip ? '△スキップ' : '未'}`)
    .join('\n');

  const todayStr = today();
  const weekPlan = state.schedule.filter(r => {
    const d = parseDate(r.date);
    const mon = getMonday(new Date());
    const sun = addDays(mon, 6);
    return d >= mon && d <= sun;
  }).map(r => `${r.chore}: ${r.member}`).join('\n');

  const uniqueWeekPlan = [...new Set(weekPlan.split('\n'))].join('\n');

  return `あなたは家事分担をサポートするアシスタントです。
以下のデータをもとに、2人の家族の家事分担について親しみやすく提案・相談に乗ってください。

【家族情報】
メンバー: ${settings.memberA}, ${settings.memberB}

【過去4週間の履歴】
${hist || 'データなし'}

【現在のスキップポイント】
${settings.memberA}: ${state.points.A.skip}pt / ${settings.memberB}: ${state.points.B.skip}pt

【今週の担当案】
${uniqueWeekPlan || 'データなし'}

履歴から得意・不得意のパターンを読み取り、無理なく続けられる分担を提案してください。`;
}

async function sendToClaude(userMessage) {
  if (!settings.claudeApiKey) {
    return '設定画面でClaude APIキーを入力してください。';
  }
  state.chatHistory.push({ role: 'user', content: userMessage });

  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': settings.claudeApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: state.chatHistory
      })
    });
    const data = await res.json();
    const reply = data.content?.[0]?.text || data.error?.message || 'エラーが発生しました';
    state.chatHistory.push({ role: 'assistant', content: reply });
    return reply;
  } catch (e) {
    const errMsg = 'API接続エラー: ' + e.message;
    state.chatHistory.push({ role: 'assistant', content: errMsg });
    return errMsg;
  }
}

// ============================================================
// UI Rendering
// ============================================================

function renderToday() {
  const el = document.getElementById('today-content');
  const d = new Date();
  const todayStr = today();
  const dayName = DAY_NAMES[d.getDay()];
  const garbage = getGarbageForDate(todayStr);
  const myChores = state.schedule.filter(r => r.date === todayStr);

  let notifBanner = '';
  if ('Notification' in window && Notification.permission === 'default') {
    notifBanner = '<div class="notif-banner" data-action="enable-notif">🔔 通知を有効にする</div>';
  }

  el.innerHTML = `
    ${notifBanner}
    <div class="card">
      <div class="date-display">${d.getMonth() + 1}月${d.getDate()}日（${dayName}）</div>
      <div class="date-sub">${d.getFullYear()}年</div>
    </div>
    <p class="section-title">ゴミ</p>
    <div class="card">${renderGarbageTags(garbage)}</div>
    <p class="section-title">今日の家事</p>
    <div class="card">
      ${myChores.length === 0 ? '<p class="no-garbage">今日の当番はありません。設定から生成してください。</p>' :
        myChores.map(r => {
          let cls = '';
          let btns = '';
          if (r.done) { cls = 'chore-done'; btns = '<span style="color:var(--color-success)">✓ 完了</span>'; }
          else if (r.skip) { cls = 'chore-skipped'; btns = '<span style="color:var(--color-warning)">△ スキップ</span>'; }
          else {
            btns = `
              <button class="btn btn-complete" data-action="complete" data-date="${r.date}" data-chore="${r.chore}">完了</button>
              <button class="btn btn-skip" data-action="skip" data-date="${r.date}" data-chore="${r.chore}">スキップ</button>
            `;
          }
          return `<div class="chore-item ${cls}">
            <div>
              <div class="chore-name">${r.chore}</div>
              <div class="date-sub">${r.member}</div>
            </div>
            <div class="chore-actions">${btns}</div>
          </div>`;
        }).join('')
      }
    </div>
  `;
}

function renderCalendar() {
  const el = document.getElementById('calendar-content');
  const now = new Date();
  const baseMonday = getMonday(now);
  const weekMonday = addDays(baseMonday, state.currentWeekOffset * 7);
  const weekSunday = addDays(weekMonday, 6);

  const monthLabel = `${weekMonday.getFullYear()}年${weekMonday.getMonth() + 1}月`;

  let headers = '';
  DAY_NAMES.forEach((n, i) => {
    const startIdx = 1; // Monday start
    const idx = (startIdx + i) % 7;
    const name = DAY_NAMES[idx];
    headers += `<div class="week-header">${name}</div>`;
  });

  let cells = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekMonday, i);
    const dateStr = fmtDate(d);
    const isToday = dateStr === today();
    const dayOfWeek = d.getDay();
    let numCls = '';
    if (dayOfWeek === 0) numCls = 'sun';
    else if (dayOfWeek === 6) numCls = 'sat';

    const garbage = getGarbageForDate(dateStr);
    cells += `<div class="day-cell ${isToday ? 'today' : ''}">
      <div class="day-num ${numCls}">${d.getDate()}</div>
      ${garbage.map(t => {
        const cls = GARBAGE_COLORS[t] || 'burn';
        return `<span class="garbage-tag ${cls}">${t}</span>`;
      }).join('')}
    </div>`;
  }

  el.innerHTML = `
    <div class="calendar-nav">
      <button data-action="prev-week">◀ 前週</button>
      <span class="current-period">${monthLabel}</span>
      <button data-action="next-week">次週 ▶</button>
    </div>
    <div class="week-grid">
      ${headers}
      ${cells}
    </div>
    <div style="margin-top:12px; text-align:center;">
      <button class="btn btn-secondary" data-action="prev-month" style="width:auto; display:inline-block; padding:8px 16px;">◀ 前月</button>
      <button class="btn btn-secondary" data-action="this-week" style="width:auto; display:inline-block; padding:8px 16px; margin:0 8px;">今週</button>
      <button class="btn btn-secondary" data-action="next-month" style="width:auto; display:inline-block; padding:8px 16px;">次月 ▶</button>
    </div>
  `;
}

function renderPoints() {
  const el = document.getElementById('points-content');
  const diff = Math.abs(state.points.A.skip - state.points.B.skip);
  let alert = '';
  if (diff >= 3) {
    const more = state.points.A.skip > state.points.B.skip ? settings.memberA : settings.memberB;
    alert = `<div class="point-alert">⚠ ${more}のスキップが多いため、翌週の担当を自動調整します</div>`;
  }

  // 過去2週間の履歴
  const twoWeeksAgo = addDays(new Date(), -14);
  const history = state.schedule.filter(r => {
    const d = parseDate(r.date);
    return d >= twoWeeksAgo && (r.done || r.skip);
  }).sort((a, b) => b.date.localeCompare(a.date));

  el.innerHTML = `
    <p class="section-title">スキップポイント</p>
    <div class="points-row">
      <div class="point-card">
        <div class="member-name">${settings.memberA || 'メンバーA'}</div>
        <div class="point-value">${state.points.A.skip}</div>
        <div class="point-label">スキップpt</div>
        <div style="margin-top:8px; font-size:13px; color:var(--color-success)">完了: ${state.points.A.done}</div>
      </div>
      <div class="point-card">
        <div class="member-name">${settings.memberB || 'メンバーB'}</div>
        <div class="point-value">${state.points.B.skip}</div>
        <div class="point-label">スキップpt</div>
        <div style="margin-top:8px; font-size:13px; color:var(--color-success)">完了: ${state.points.B.done}</div>
      </div>
    </div>
    ${alert}
    <p class="section-title">過去2週間の履歴</p>
    ${history.length === 0 ? '<p class="empty-state">履歴がありません</p>' :
      history.map(r => {
        const status = r.done ? 'done' : 'skipped';
        const label = r.done ? '✓ 完了' : '△ スキップ';
        const d = parseDate(r.date);
        return `<div class="history-item ${status}">
          <div>
            <div>${r.chore}</div>
            <div class="history-date">${d.getMonth()+1}/${d.getDate()} ${r.member}</div>
          </div>
          <div>${label}</div>
        </div>`;
      }).join('')
    }
  `;
}

function renderSettings() {
  const el = document.getElementById('settings-content');
  el.innerHTML = `
    <div class="card">
      <div class="form-section-title">メンバー設定</div>
      <div class="form-group">
        <label>メンバーA の名前</label>
        <input type="text" id="set-memberA" value="${settings.memberA}" placeholder="例: たろう">
      </div>
      <div class="form-group">
        <label>メンバーB の名前</label>
        <input type="text" id="set-memberB" value="${settings.memberB}" placeholder="例: はなこ">
      </div>
      <div class="form-group">
        <label>メンバーA のメールアドレス</label>
        <input type="email" id="set-emailA" value="${settings.emailA}" placeholder="example@gmail.com">
      </div>
      <div class="form-group">
        <label>メンバーB のメールアドレス</label>
        <input type="email" id="set-emailB" value="${settings.emailB}" placeholder="example@gmail.com">
      </div>

      <div class="form-section-title">API設定</div>
      <div class="form-group">
        <label>スプレッドシートID</label>
        <input type="text" id="set-spreadsheetId" value="${settings.spreadsheetId}" placeholder="スプレッドシートURLから取得">
      </div>
      <div class="form-group">
        <label>Google Sheets APIキー</label>
        <input type="text" id="set-sheetsApiKey" value="${settings.sheetsApiKey}" placeholder="AIza...">
      </div>
      <div class="form-group">
        <label>GAS Web App URL</label>
        <input type="text" id="set-gasWebAppUrl" value="${settings.gasWebAppUrl}" placeholder="https://script.google.com/macros/s/...">
      </div>
      <div class="form-group">
        <label>Claude APIキー</label>
        <input type="text" id="set-claudeApiKey" value="${settings.claudeApiKey}" placeholder="sk-ant-...">
      </div>

      <div class="form-section-title">当番設定</div>
      <div class="form-group">
        <label>当番開始日</label>
        <input type="date" id="set-startDate" value="${settings.startDate}">
      </div>

      <button class="btn btn-primary" data-action="save-settings">保存</button>
      <div class="save-msg" id="save-msg">保存しました</div>

      <button class="btn btn-secondary" data-action="generate-schedule" style="margin-top:16px;">4週間分の当番を生成</button>
      <div class="save-msg" id="gen-msg">生成しました</div>
    </div>
  `;
}

function renderChat() {
  const el = document.getElementById('chat-content');
  const msgs = state.chatHistory.map(m => {
    const cls = m.role === 'user' ? 'user' : 'ai';
    return `<div class="chat-bubble ${cls}">${escapeHTML(m.content)}</div>`;
  }).join('');

  const loading = state.chatSending ? '<div class="chat-loading"><span></span><span></span><span></span></div>' : '';

  el.innerHTML = `
    <div class="chat-messages" id="chat-messages">
      ${msgs.length === 0 ? '<div class="empty-state">家事の分担について何でも聞いてください</div>' : ''}
      ${msgs}
      ${loading}
    </div>
    <div class="chat-suggest">
      ${SUGGEST_TEXTS.map(t => `<button class="suggest-btn" data-action="suggest" data-text="${t}">${t}</button>`).join('')}
    </div>
    <div class="chat-input-area">
      <input type="text" id="chat-input" placeholder="メッセージを入力..." ${state.chatSending ? 'disabled' : ''}>
      <button class="chat-send-btn" data-action="send-chat" ${state.chatSending ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
      </button>
    </div>
  `;

  const msgContainer = document.getElementById('chat-messages');
  if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// Event Handlers
// ============================================================

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  switch (action) {
    case 'complete':
    case 'skip': {
      const { date, chore } = btn.dataset;
      const field = action === 'complete' ? 'done' : 'skip';
      const row = state.schedule.find(r => r.date === date && r.chore === chore);
      if (row) {
        row[field] = 1;
        if (action === 'skip') {
          const key = row.member === settings.memberA ? 'A' : 'B';
          state.points[key].skip++;
          savePoints();
        }
        if (action === 'complete') {
          const key = row.member === settings.memberA ? 'A' : 'B';
          state.points[key].done++;
          savePoints();
        }
        saveSchedule();
        gasPost('updateChore', { date, chore, field });
        renderToday();
      }
      break;
    }

    case 'save-settings': {
      settings.memberA = document.getElementById('set-memberA').value.trim();
      settings.memberB = document.getElementById('set-memberB').value.trim();
      settings.emailA = document.getElementById('set-emailA').value.trim();
      settings.emailB = document.getElementById('set-emailB').value.trim();
      settings.spreadsheetId = document.getElementById('set-spreadsheetId').value.trim();
      settings.sheetsApiKey = document.getElementById('set-sheetsApiKey').value.trim();
      settings.gasWebAppUrl = document.getElementById('set-gasWebAppUrl').value.trim();
      settings.claudeApiKey = document.getElementById('set-claudeApiKey').value.trim();
      settings.startDate = document.getElementById('set-startDate').value;
      saveSettingsToLocal();
      // Save to GAS
      gasPost('saveSettings', {
        memberA: { name: settings.memberA, email: settings.emailA },
        memberB: { name: settings.memberB, email: settings.emailB }
      });
      const msg = document.getElementById('save-msg');
      if (msg) { msg.classList.add('show'); setTimeout(() => msg.classList.remove('show'), 2000); }
      break;
    }

    case 'generate-schedule': {
      if (!settings.startDate) {
        alert('当番開始日を設定してください');
        return;
      }
      if (!settings.memberA || !settings.memberB) {
        alert('メンバー名を設定してください');
        return;
      }
      const rows = generateSchedule(settings.startDate, 4);
      state.schedule = rows;
      saveSchedule();
      // Recalculate points
      state.points = calculatePointsFromSchedule();
      savePoints();
      // Send to GAS
      const gasRows = rows.map(r => [r.date, r.chore, r.member, r.done, r.skip]);
      gasPost('generateSchedule', { rows: gasRows });
      const msg = document.getElementById('gen-msg');
      if (msg) { msg.classList.add('show'); setTimeout(() => msg.classList.remove('show'), 2000); }
      break;
    }

    case 'send-chat': {
      const input = document.getElementById('chat-input');
      if (!input || !input.value.trim()) return;
      const text = input.value.trim();
      state.chatSending = true;
      renderChat();
      const reply = await sendToClaude(text);
      state.chatSending = false;
      renderChat();
      break;
    }

    case 'suggest': {
      const input = document.getElementById('chat-input');
      if (input) input.value = btn.dataset.text;
      break;
    }

    case 'enable-notif': {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') showTodayNotification();
        renderToday();
      }
      break;
    }

    case 'prev-week':
      state.currentWeekOffset--;
      renderCalendar();
      break;
    case 'next-week':
      state.currentWeekOffset++;
      renderCalendar();
      break;
    case 'this-week':
      state.currentWeekOffset = 0;
      renderCalendar();
      break;
    case 'prev-month':
      state.currentWeekOffset -= 4;
      renderCalendar();
      break;
    case 'next-month':
      state.currentWeekOffset += 4;
      renderCalendar();
      break;
  }
});

// Enter key for chat
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'chat-input') {
    e.preventDefault();
    document.querySelector('[data-action="send-chat"]')?.click();
  }
});

// Bottom nav
document.querySelector('.bottom-nav')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-btn');
  if (btn) switchTab(btn.dataset.tab);
});

// ============================================================
// Initialization
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  loadSchedule();
  loadPoints();

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.log('SW registration failed:', e));
  }

  // First launch
  if (!localStorage.getItem('ouchi_settings')) {
    switchTab('settings');
  } else {
    switchTab('today');
    // Background sync
    syncFromSheets().catch(() => {});
    refreshGarbageCache().catch(() => {});
    initNotifications();
  }
});
