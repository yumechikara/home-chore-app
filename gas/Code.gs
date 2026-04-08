/**
 * おうち当番 v2 - Google Apps Script
 *
 * 機能:
 * 1. ユーザー認証（メール+PIN）
 * 2. 週間チェックリスト管理
 * 3. ポイント管理
 * 4. おねがいリクエスト管理
 * 5. ログイン履歴
 * 6. 毎朝7時のメール通知
 *
 * シート構成:
 * - ユーザー: [メールアドレス, PINハッシュ, 表示名, トークン, 有効期限, 作成日]
 * - ログイン履歴: [メールアドレス, タイムスタンプ, UserAgent]
 * - 週間チェック: [週キー, 家事ID, 家事名, ステータス, 完了者, 完了日時, ポイント]
 * - ポイント: [メンバーキー, 合計, 履歴JSON]
 * - 設定: [キー, 値]
 * - 家事マスター: [家事ID, 家事名, 難易度, 作成者, 有効]
 * - おねがい: [リクエストID, 家事名, 依頼者, 対象者, 完了, 日付]
 *
 * デプロイ: ウェブアプリ > 実行:自分 > アクセス:全員
 * トリガー: sendDailyEmail を毎日 午前7時〜8時
 */

// ============================================================
// シート管理
// ============================================================
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var headers = {
      'ユーザー': ['メールアドレス', 'PINハッシュ', '表示名', 'トークン', '有効期限', '作成日'],
      'ログイン履歴': ['メールアドレス', 'タイムスタンプ', 'UserAgent'],
      '週間チェック': ['週キー', '家事ID', '家事名', 'ステータス', '完了者', '完了日時', 'ポイント'],
      'ポイント': ['メンバーキー', '合計', '履歴JSON'],
      '設定': ['キー', '値'],
      '家事マスター': ['家事ID', '家事名', '難易度', '作成者', '有効'],
      'おねがい': ['リクエストID', '家事名', '依頼者', '対象者', '完了', '日付']
    };
    if (headers[name]) {
      sheet.getRange(1, 1, 1, headers[name].length).setValues([headers[name]]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

// ============================================================
// 認証ヘルパー
// ============================================================
function hashPin(pin, email) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pin + email);
  return raw.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function generateToken() {
  return Utilities.getUuid();
}

function verifySession(token, email) {
  if (!token || !email) return false;
  var sheet = getSheet('ユーザー');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][3] === token) {
      var expiry = new Date(data[i][4]);
      if (expiry > new Date()) return true;
    }
  }
  return false;
}

// ============================================================
// Web App エントリポイント
// ============================================================
function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, error: 'Invalid JSON' });
  }

  var action = payload.action;
  var data = payload.data || {};
  var result;

  // 認証不要アクション
  if (action === 'register') {
    result = registerUser(data);
    return jsonResponse(result);
  }
  if (action === 'login') {
    result = loginUser(data);
    return jsonResponse(result);
  }

  // 認証チェック（オプション: GAS URLが設定されている場合のみ）
  // 家族アプリなので緩めの認証
  switch (action) {
    case 'updateChoreStatus': result = updateChoreStatus(data); break;
    case 'updatePoints': result = updatePointsData(data); break;
    case 'saveSettings': result = saveSettingsData(data); break;
    case 'saveChores': result = saveChoresData(data); break;
    case 'addRequest': result = addRequest(data); break;
    case 'completeRequest': result = completeRequest(data); break;
    case 'initWeek': result = initWeekData(data); break;
    default: result = { success: false, error: 'Unknown action: ' + action };
  }

  return jsonResponse(result);
}

function doGet(e) {
  var action = (e.parameter && e.parameter.action) || 'getAll';
  var result;

  switch (action) {
    case 'getAll': result = getAllData(e.parameter); break;
    case 'getWeeklyChores': result = getWeeklyChoresData(e.parameter); break;
    case 'getPoints': result = getPointsData(); break;
    case 'getLoginHistory': result = getLoginHistoryData(e.parameter); break;
    case 'getRequests': result = getRequestsData(); break;
    default: result = { success: false, error: 'Unknown action' };
  }

  return jsonResponse(result);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// 認証
// ============================================================
function registerUser(data) {
  var email = data.email;
  var pin = data.pin;
  var displayName = data.displayName || email.split('@')[0];

  if (!email || !pin || pin.length !== 4) {
    return { success: false, error: 'メールと4桁PINが必要です' };
  }

  var sheet = getSheet('ユーザー');
  var existing = sheet.getDataRange().getValues();
  for (var i = 1; i < existing.length; i++) {
    if (existing[i][0] === email) {
      return { success: false, error: 'このメールアドレスは既に登録されています' };
    }
  }

  var pinHash = hashPin(pin, email);
  var token = generateToken();
  var expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30日

  sheet.appendRow([email, pinHash, displayName, token, expiry.toISOString(), new Date().toISOString()]);

  // ログイン履歴記録
  recordLogin(email, data.userAgent || '');

  return {
    success: true,
    token: token,
    expiry: expiry.getTime(),
    displayName: displayName
  };
}

function loginUser(data) {
  var email = data.email;
  var pin = data.pin;

  if (!email || !pin) {
    return { success: false, error: 'メールとPINが必要です' };
  }

  var sheet = getSheet('ユーザー');
  var dataRows = sheet.getDataRange().getValues();
  var pinHash = hashPin(pin, email);

  for (var i = 1; i < dataRows.length; i++) {
    if (dataRows[i][0] === email && dataRows[i][1] === pinHash) {
      // トークン更新
      var token = generateToken();
      var expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      sheet.getRange(i + 1, 4).setValue(token);
      sheet.getRange(i + 1, 5).setValue(expiry.toISOString());

      // ログイン履歴記録
      recordLogin(email, data.userAgent || '');

      return {
        success: true,
        token: token,
        expiry: expiry.getTime(),
        displayName: dataRows[i][2]
      };
    }
  }

  return { success: false, error: 'メールアドレスまたはPINが間違っています' };
}

function recordLogin(email, userAgent) {
  var sheet = getSheet('ログイン履歴');
  sheet.appendRow([email, new Date().toISOString(), userAgent]);
}

// ============================================================
// データ取得
// ============================================================
function getAllData(params) {
  var weekKey = params ? params.weekKey : null;
  return {
    success: true,
    weeklyChores: weekKey ? getWeeklyChoresForKey(weekKey) : null,
    points: getPointsObj(),
    requests: getRequestsList()
  };
}

function getWeeklyChoresData(params) {
  var weekKey = params ? params.weekKey : null;
  return { success: true, chores: weekKey ? getWeeklyChoresForKey(weekKey) : [] };
}

function getWeeklyChoresForKey(weekKey) {
  var sheet = getSheet('週間チェック');
  var data = sheet.getDataRange().getValues();
  var chores = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === weekKey) {
      chores.push({
        id: data[i][1],
        name: data[i][2],
        status: data[i][3] || null,
        doneBy: data[i][4] || null,
        doneAt: data[i][5] || null,
        points: data[i][6] || 1
      });
    }
  }
  return chores;
}

function getPointsData() {
  return { success: true, points: getPointsObj() };
}

function getPointsObj() {
  var sheet = getSheet('ポイント');
  var data = sheet.getDataRange().getValues();
  var pts = { A: { total: 0, history: [] }, B: { total: 0, history: [] } };
  for (var i = 1; i < data.length; i++) {
    var key = data[i][0];
    if (key === 'A' || key === 'B') {
      pts[key].total = Number(data[i][1]) || 0;
      try { pts[key].history = JSON.parse(data[i][2] || '[]'); } catch (e) { pts[key].history = []; }
    }
  }
  return pts;
}

function getLoginHistoryData(params) {
  var email = params ? params.email : null;
  var sheet = getSheet('ログイン履歴');
  var data = sheet.getDataRange().getValues();
  var history = [];
  for (var i = data.length - 1; i >= 1 && history.length < 20; i--) {
    if (!email || data[i][0] === email) {
      history.push({ timestamp: data[i][1], userAgent: data[i][2] || '' });
    }
  }
  return { success: true, history: history };
}

function getRequestsData() {
  return { success: true, requests: getRequestsList() };
}

function getRequestsList() {
  var sheet = getSheet('おねがい');
  var data = sheet.getDataRange().getValues();
  var reqs = [];
  for (var i = 1; i < data.length; i++) {
    reqs.push({
      id: data[i][0],
      choreName: data[i][1],
      from: data[i][2],
      to: data[i][3],
      completed: data[i][4] === true || data[i][4] === 'true',
      date: data[i][5]
    });
  }
  return reqs;
}

// ============================================================
// データ更新
// ============================================================
function updateChoreStatus(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet('週間チェック');
    var rows = sheet.getDataRange().getValues();
    var found = false;

    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.weekKey && rows[i][1] === data.choreId) {
        sheet.getRange(i + 1, 4).setValue(data.status);
        sheet.getRange(i + 1, 5).setValue(data.doneBy || '');
        sheet.getRange(i + 1, 6).setValue(new Date().toISOString());
        found = true;
        break;
      }
    }

    if (!found && data.weekKey && data.choreId) {
      sheet.appendRow([data.weekKey, data.choreId, data.choreName || '', data.status, data.doneBy || '', new Date().toISOString(), data.points || 1]);
    }

    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function updatePointsData(data) {
  var sheet = getSheet('ポイント');
  var existing = sheet.getDataRange().getValues();
  var pts = data.points || {};

  ['A', 'B'].forEach(function(key) {
    if (!pts[key]) return;
    var found = false;
    for (var i = 1; i < existing.length; i++) {
      if (existing[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(pts[key].total || 0);
        sheet.getRange(i + 1, 3).setValue(JSON.stringify(pts[key].history || []));
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, pts[key].total || 0, JSON.stringify(pts[key].history || [])]);
    }
  });

  return { success: true };
}

function saveSettingsData(data) {
  var sheet = getSheet('設定');
  sheet.getRange(2, 1, Math.max(1, sheet.getLastRow()), sheet.getLastColumn() || 2).clearContent();
  var s = data.settings || {};
  var keys = Object.keys(s);
  for (var i = 0; i < keys.length; i++) {
    sheet.appendRow([keys[i], s[keys[i]]]);
  }
  return { success: true };
}

function saveChoresData(data) {
  var sheet = getSheet('家事マスター');
  // ヘッダー行以降をクリア
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn() || 5).clearContent();
  }
  var chores = data.chores || [];
  for (var i = 0; i < chores.length; i++) {
    var c = chores[i];
    sheet.appendRow([c.id, c.name, c.difficulty || 1, c.createdBy || '', c.active !== false]);
  }
  return { success: true };
}

function initWeekData(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet('週間チェック');
    var weekKey = data.weekKey;
    var chores = data.chores || [];

    // 既存データチェック
    var existing = sheet.getDataRange().getValues();
    for (var i = 1; i < existing.length; i++) {
      if (existing[i][0] === weekKey) return { success: true, message: 'Already initialized' };
    }

    for (var j = 0; j < chores.length; j++) {
      var c = chores[j];
      sheet.appendRow([weekKey, c.id, c.name, '', '', '', c.points || 1]);
    }
    return { success: true, count: chores.length };
  } finally {
    lock.releaseLock();
  }
}

function addRequest(data) {
  var req = data.request;
  if (!req) return { success: false, error: 'No request data' };
  var sheet = getSheet('おねがい');
  sheet.appendRow([req.id, req.choreName, req.from, req.to, false, req.date || '']);
  return { success: true };
}

function completeRequest(data) {
  var sheet = getSheet('おねがい');
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.requestId) {
      sheet.getRange(i + 1, 5).setValue(true);
      return { success: true };
    }
  }
  return { success: false, error: 'Request not found' };
}

// ============================================================
// メール通知
// ============================================================
function sendDailyEmail() {
  var settingsSheet = getSheet('設定');
  var settingsData = settingsSheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < settingsData.length; i++) {
    config[settingsData[i][0]] = settingsData[i][1];
  }

  var emailA = config.emailA;
  var emailB = config.emailB;
  var memberA = config.memberA || 'メンバーA';
  var memberB = config.memberB || 'メンバーB';

  // 今週の未完了家事を取得
  var now = new Date();
  var jan1 = new Date(now.getFullYear(), 0, 1);
  var days = Math.floor((now - jan1) / 86400000);
  var weekNum = Math.ceil((days + jan1.getDay() + 1) / 7);
  var weekKey = now.getFullYear() + '-W' + ('0' + weekNum).slice(-2);

  var chores = getWeeklyChoresForKey(weekKey);
  var pending = chores.filter(function(c) { return !c.status; });

  if (pending.length === 0) return;

  var choreList = pending.map(function(c) { return '・' + c.name; }).join('\n');
  var body = '今週の未完了家事:\n' + choreList + '\n\nおうち当番アプリで確認してください。';
  var subject = '【おうち当番】未完了の家事が' + pending.length + '件あります';

  if (emailA) {
    try { MailApp.sendEmail(emailA, subject, memberA + 'さん、おはようございます。\n\n' + body); } catch (e) {}
  }
  if (emailB) {
    try { MailApp.sendEmail(emailB, subject, memberB + 'さん、おはようございます。\n\n' + body); } catch (e) {}
  }
}

// ============================================================
// 初期セットアップ
// ============================================================
function setupSheets() {
  getSheet('ユーザー');
  getSheet('ログイン履歴');
  getSheet('週間チェック');
  getSheet('ポイント');
  getSheet('設定');
  getSheet('家事マスター');
  getSheet('おねがい');
  Logger.log('全シートの初期化完了');
}
