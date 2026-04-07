/**
 * おうち当番 - Google Apps Script
 *
 * このスクリプトは以下の機能を提供します:
 * 1. Web App として doPost/doGet でフロントエンドからのリクエストを処理
 * 2. 毎朝7時のトリガーで当日の担当家事をメール通知
 *
 * デプロイ方法:
 * 1. Google Apps Script エディタで新しいプロジェクトを作成
 * 2. このコードを貼り付け
 * 3. デプロイ > 新しいデプロイ > ウェブアプリ
 *    - 実行ユーザー: 自分
 *    - アクセス: 全員
 * 4. トリガーを追加: sendDailyEmail を毎日 午前7時〜8時 に設定
 */

// ============================================================
// 設定
// ============================================================

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === '当番表') {
      sheet.getRange('A1:E1').setValues([['日付', '家事名', '担当者', '完了', 'スキップ']]);
    } else if (name === 'ポイント') {
      sheet.getRange('A1:C1').setValues([['メンバー名', 'スキップポイント累計', '完了数累計']]);
    } else if (name === '設定') {
      sheet.getRange('A1:C1').setValues([['メンバー名', 'メールアドレス', '通知時刻']]);
    }
  }
  return sheet;
}

// ============================================================
// Web App エンドポイント
// ============================================================

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var data = payload.data;
    var result;

    switch (action) {
      case 'updateChore':
        result = updateChore(data);
        break;
      case 'generateSchedule':
        result = generateScheduleRows(data);
        break;
      case 'saveSettings':
        result = saveSettingsToSheet(data);
        break;
      case 'updatePoints':
        result = updatePoints(data);
        break;
      default:
        result = { error: '不明なアクション: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var action = e.parameter.action || 'getAll';
    var result;

    switch (action) {
      case 'getSchedule':
        result = getScheduleData();
        break;
      case 'getPoints':
        result = getPointsData();
        break;
      case 'getSettings':
        result = getSettingsData();
        break;
      case 'getAll':
        result = {
          schedule: getScheduleData(),
          points: getPointsData(),
          settings: getSettingsData()
        };
        break;
      default:
        result = { error: '不明なアクション: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// データ取得
// ============================================================

function getScheduleData() {
  var sheet = getSheet('当番表');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  return data.map(function(row) {
    return {
      date: formatDate(row[0]),
      chore: row[1],
      member: row[2],
      done: row[3] ? 1 : 0,
      skip: row[4] ? 1 : 0
    };
  });
}

function getPointsData() {
  var sheet = getSheet('ポイント');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  return data.map(function(row) {
    return {
      member: row[0],
      skipPoints: Number(row[1]) || 0,
      doneCount: Number(row[2]) || 0
    };
  });
}

function getSettingsData() {
  var sheet = getSheet('設定');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  return data.map(function(row) {
    return {
      member: row[0],
      email: row[1],
      notifyTime: row[2]
    };
  });
}

// ============================================================
// データ更新
// ============================================================

function updateChore(data) {
  var sheet = getSheet('当番表');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { error: '当番表にデータがありません' };

  var values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  for (var i = 0; i < values.length; i++) {
    var rowDate = formatDate(values[i][0]);
    if (rowDate === data.date && values[i][1] === data.chore) {
      var rowNum = i + 2;
      if (data.field === 'done') {
        sheet.getRange(rowNum, 4).setValue(1);
      } else if (data.field === 'skip') {
        sheet.getRange(rowNum, 5).setValue(1);
        // スキップポイントを加算
        addSkipPoint(values[i][2]);
      }
      return { success: true, row: rowNum };
    }
  }

  return { error: '該当する行が見つかりません' };
}

function addSkipPoint(memberName) {
  var sheet = getSheet('ポイント');
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    sheet.getRange(2, 1, 1, 3).setValues([[memberName, 1, 0]]);
    return;
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === memberName) {
      sheet.getRange(i + 2, 2).setValue((Number(data[i][1]) || 0) + 1);
      return;
    }
  }

  // メンバーが見つからない場合、新しい行を追加
  sheet.getRange(lastRow + 1, 1, 1, 3).setValues([[memberName, 1, 0]]);
}

function addDoneCount(memberName) {
  var sheet = getSheet('ポイント');
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    sheet.getRange(2, 1, 1, 3).setValues([[memberName, 0, 1]]);
    return;
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === memberName) {
      sheet.getRange(i + 2, 3).setValue((Number(data[i][2]) || 0) + 1);
      return;
    }
  }

  sheet.getRange(lastRow + 1, 1, 1, 3).setValues([[memberName, 0, 1]]);
}

function updatePoints(data) {
  var sheet = getSheet('ポイント');
  var lastRow = sheet.getLastRow();

  // ヘッダーしかない場合
  if (lastRow <= 1) {
    var rows = [];
    if (data.memberA) rows.push([data.memberA.name, data.memberA.skip || 0, data.memberA.done || 0]);
    if (data.memberB) rows.push([data.memberB.name, data.memberB.skip || 0, data.memberB.done || 0]);
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    }
    return { success: true };
  }

  // 既存データを更新
  var values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  if (data.memberA) {
    var found = false;
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === data.memberA.name) {
        sheet.getRange(i + 2, 2).setValue(data.memberA.skip || 0);
        sheet.getRange(i + 2, 3).setValue(data.memberA.done || 0);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.getRange(lastRow + 1, 1, 1, 3).setValues([[data.memberA.name, data.memberA.skip || 0, data.memberA.done || 0]]);
      lastRow++;
    }
  }

  if (data.memberB) {
    var found2 = false;
    var vals2 = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
    for (var j = 0; j < vals2.length; j++) {
      if (vals2[j][0] === data.memberB.name) {
        sheet.getRange(j + 2, 2).setValue(data.memberB.skip || 0);
        sheet.getRange(j + 2, 3).setValue(data.memberB.done || 0);
        found2 = true;
        break;
      }
    }
    if (!found2) {
      var lr = sheet.getLastRow();
      sheet.getRange(lr + 1, 1, 1, 3).setValues([[data.memberB.name, data.memberB.skip || 0, data.memberB.done || 0]]);
    }
  }

  return { success: true };
}

function generateScheduleRows(data) {
  var sheet = getSheet('当番表');
  var rows = data.rows; // [[date, chore, member, 0, 0], ...]

  // 既存データをクリア（ヘッダー以外）
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 5).clearContent();
  }

  // 新しいデータを書き込み
  if (rows && rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }

  return { success: true, rowCount: rows ? rows.length : 0 };
}

function saveSettingsToSheet(data) {
  var sheet = getSheet('設定');

  // 既存データをクリア（ヘッダー以外）
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 3).clearContent();
  }

  var rows = [];
  if (data.memberA) {
    rows.push([data.memberA.name || '', data.memberA.email || '', '07:00']);
  }
  if (data.memberB) {
    rows.push([data.memberB.name || '', data.memberB.email || '', '07:00']);
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }

  return { success: true };
}

// ============================================================
// メール通知（毎朝7時トリガー）
// ============================================================

function sendDailyEmail() {
  var today = new Date();
  var todayStr = formatDate(today);

  var schedule = getScheduleData();
  var settings = getSettingsData();

  if (settings.length === 0) {
    Logger.log('設定が見つかりません');
    return;
  }

  // メンバーごとの今日の担当を取得
  var memberChores = {};
  schedule.forEach(function(row) {
    if (row.date === todayStr && !row.done && !row.skip) {
      if (!memberChores[row.member]) {
        memberChores[row.member] = [];
      }
      memberChores[row.member].push(row.chore);
    }
  });

  // 各メンバーにメール送信
  settings.forEach(function(s) {
    if (!s.email || !s.member) return;

    var chores = memberChores[s.member] || [];
    if (chores.length === 0) return;

    var subject = '今日の担当: ' + chores.join('・');
    var body = s.member + 'さん、おはようございます！\n\n';
    body += '今日の担当家事:\n';
    chores.forEach(function(c) {
      body += '  ・' + c + '\n';
    });
    body += '\nおうち当番アプリで完了を記録してくださいね。';

    try {
      MailApp.sendEmail({
        to: s.email,
        subject: subject,
        body: body
      });
      Logger.log(s.member + ' にメールを送信しました');
    } catch (err) {
      Logger.log('メール送信エラー (' + s.member + '): ' + err.message);
    }
  });
}

// ============================================================
// ユーティリティ
// ============================================================

function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') {
    // すでにYYYY-MM-DD形式の場合
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    date = new Date(date);
  }
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';

  var y = date.getFullYear();
  var m = ('0' + (date.getMonth() + 1)).slice(-2);
  var d = ('0' + date.getDate()).slice(-2);
  return y + '-' + m + '-' + d;
}

// ============================================================
// 初期セットアップ用（手動実行）
// ============================================================

function setupSheets() {
  getSheet('当番表');
  getSheet('ポイント');
  getSheet('設定');
  Logger.log('シートの初期化が完了しました');
}
