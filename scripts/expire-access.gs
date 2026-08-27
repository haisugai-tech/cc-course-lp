/**
 * CC講座 視聴期限管理スクリプト
 *
 * 「CC講座_受講者管理」スプレッドシートに紐づく Apps Script として貼り付けて使う。
 *
 * 機能:
 *  - 毎日1回の時間主導型トリガー（例: 午前3時）で dailyExpireCheck を実行する。
 *  - F列（視聴期限日）が今日以前 かつ H列が「有効」の行について、
 *    教材フォルダの閲覧権限を削除し、G列に削除日・H列に「終了」を記入する。
 *  - 期限3日前の受講者へ「まもなく視聴期限です」というリマインドメールを送る。
 *  - 実行結果（削除件数と対象者）を管理者へメール通知する。
 *
 * セットアップ:
 *  1. プロジェクトの設定 → スクリプト プロパティ に以下を登録する（コードに直書きしない）。
 *     - FOLDER_ID   : CC講座_教材 フォルダのID
 *     - ADMIN_EMAIL : 管理者の通知先メールアドレス
 *  2. dailyExpireCheck を一度手動実行して権限を承認する。
 *  3. トリガーで dailyExpireCheck を「時間主導型・日付ベース・午前3時〜4時」に設定する。
 *
 * 列構成（1行目はヘッダー）:
 *  A:氏名  B:Gmailアドレス  C:申込日  D:入金確認日  E:権限付与日
 *  F:視聴期限日  G:権限削除日  H:状態(有効/終了)  I:紹介者  J:備考
 */

var COL = {
  NAME: 1,      // A
  EMAIL: 2,     // B
  GRANTED: 5,   // E
  EXPIRES: 6,   // F
  REVOKED: 7,   // G
  STATUS: 8     // H
};

var STATUS_ACTIVE = '有効';
var STATUS_ENDED = '終了';
var REMIND_DAYS_BEFORE = 3;

function dailyExpireCheck() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('FOLDER_ID');
  var adminEmail = props.getProperty('ADMIN_EMAIL');
  if (!folderId || !adminEmail) {
    throw new Error('スクリプトプロパティ FOLDER_ID / ADMIN_EMAIL を設定してください。');
  }

  var folder = DriveApp.getFolderById(folderId);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var today = startOfDay_(new Date());
  var data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();

  var revoked = [];
  var reminded = [];
  var errors = [];

  for (var i = 0; i < data.length; i++) {
    var row = i + 2; // 実際のシート行番号
    var name = data[i][COL.NAME - 1];
    var email = String(data[i][COL.EMAIL - 1] || '').trim();
    var expires = data[i][COL.EXPIRES - 1];
    var status = String(data[i][COL.STATUS - 1] || '').trim();

    if (status !== STATUS_ACTIVE || !email || !(expires instanceof Date)) continue;

    var expireDay = startOfDay_(expires);
    var diffDays = Math.round((expireDay.getTime() - today.getTime()) / 86400000);

    try {
      if (diffDays <= 0) {
        // 期限到来: 閲覧権限を削除
        try {
          folder.removeViewer(email);
        } catch (e) {
          // すでに権限がない場合もあるため、記録して続行する
          errors.push(row + '行目 ' + email + ': removeViewer失敗 (' + e.message + ')');
        }
        sheet.getRange(row, COL.REVOKED).setValue(new Date());
        sheet.getRange(row, COL.STATUS).setValue(STATUS_ENDED);
        revoked.push(name + ' <' + email + '>（期限: ' + formatDate_(expireDay) + '）');
      } else if (diffDays === REMIND_DAYS_BEFORE) {
        // 期限3日前: リマインドメール
        sendReminder_(email, name, expireDay);
        reminded.push(name + ' <' + email + '>（期限: ' + formatDate_(expireDay) + '）');
      }
    } catch (e) {
      errors.push(row + '行目 ' + email + ': ' + e.message);
    }
  }

  notifyAdmin_(adminEmail, revoked, reminded, errors);
}

function sendReminder_(email, name, expireDay) {
  var subject = '【CC講座】まもなく視聴期限です（' + formatDate_(expireDay) + 'まで）';
  var body =
    (name ? name + ' 様\n\n' : '') +
    'Claude Code講座をご受講いただきありがとうございます。\n\n' +
    '教材の視聴期限が ' + formatDate_(expireDay) + ' に到来します。\n' +
    '期限を過ぎますと教材フォルダの閲覧権限が削除され、視聴できなくなります。\n' +
    'お見逃しの章がないか、期限までにご確認ください。\n\n' +
    '※視聴期間の延長は行っておりません。あらかじめご了承ください。\n\n' +
    '株式会社ジリーナ';
  MailApp.sendEmail(email, subject, body);
}

function notifyAdmin_(adminEmail, revoked, reminded, errors) {
  if (revoked.length === 0 && reminded.length === 0 && errors.length === 0) return;

  var lines = ['CC講座 視聴期限チェックの実行結果（' + formatDate_(new Date()) + '）', ''];
  lines.push('■ 権限削除: ' + revoked.length + '件');
  revoked.forEach(function (s) { lines.push('  - ' + s); });
  lines.push('');
  lines.push('■ リマインド送信: ' + reminded.length + '件');
  reminded.forEach(function (s) { lines.push('  - ' + s); });
  if (errors.length > 0) {
    lines.push('');
    lines.push('■ エラー: ' + errors.length + '件');
    errors.forEach(function (s) { lines.push('  - ' + s); });
  }
  MailApp.sendEmail(adminEmail, '【CC講座】視聴期限チェック結果（削除' + revoked.length + '件）', lines.join('\n'));
}

function startOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy年M月d日');
}
