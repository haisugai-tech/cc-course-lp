/**
 * CC講座 申込フォーム再構築スクリプト
 *
 * 既存の申込フォーム（URLは変えない）に紐づく Apps Script として貼り付けて使う。
 * rebuildForm() を実行すると、既存の設問をすべて削除し、正しい構成で作り直す。
 *
 * 使い方:
 *  1. 申込フォームを編集モードで開き、「⋮ → スクリプトエディタ」を開く。
 *  2. このファイルの内容を貼り付けて保存する。
 *  3. rebuildForm を選んで実行し、権限承認ダイアログを通す。
 *  4. 実行ログの公開URLが、LPに記載のフォームURLと一致することを目視確認する。
 *
 * 注意:
 *  - 回答が1件以上ある場合は何もせず中断する（設問削除で過去回答との対応が失われるため）。
 *  - 「回答のコピーを回答者に送信」は Apps Script の API では設定できないため、
 *    実行後にフォームの「設定 → 回答 → 回答のコピーを回答者に送信: 常に表示」を手動で設定すること。
 */

function rebuildForm() {
  var form = FormApp.getActiveForm();

  // ガード: 既存回答がある場合は中断（回答は削除しない前提のため）
  var responseCount = form.getResponses().length;
  if (responseCount > 0) {
    Logger.log('中断しました: このフォームには既に ' + responseCount + ' 件の回答があります。');
    Logger.log('設問を削除すると過去回答との対応が失われるため、何も変更していません。');
    return;
  }

  // ---- 既存の設問をすべて削除（逆順で回さないとインデックスがずれて消し漏れる）----
  var items = form.getItems();
  for (var i = items.length - 1; i >= 0; i--) {
    form.deleteItem(i);
  }

  // ---- フォーム全体の設定 ----
  form.setTitle('Claude Code講座 お申込みフォーム');

  form.setDescription(
    'Claude Codeを使って米国株の自動売買ソフトを作る講座のお申込みフォームです。\n' +
    'お申込みの前に、講座ページの内容を必ずご確認ください。\n' +
    '\n' +
    '【受講条件】\n' +
    '・受講料：300,000円（税込）／お支払いは銀行振込の一括のみです\n' +
    '・視聴期間：教材アクセス権の付与日から6ヶ月間です\n' +
    '・本講座は動画教材の提供のみで、個別の質問対応・サポートは含まれません\n' +
    '・お申込み後の返品・返金は一切承っておりません\n' +
    '\n' +
    '【個人情報の取り扱いについて】\n' +
    'ご入力いただいた個人情報は、株式会社ジリーナが本講座に関するご連絡、\n' +
    '受講手続き、教材の提供のためにのみ利用します。ご本人の同意なく第三者に提供することはありません。\n' +
    '\n' +
    '【教材の提供方法について】\n' +
    '教材はGoogleドライブでの限定共有により提供します。ご入力いただいたGoogleアカウントに\n' +
    '閲覧権限を付与しますので、お間違いのないようご記入ください。'
  );

  // メールアドレスを収集する（回答者のGoogleアカウントを記録）
  // 新しいAPI（setEmailCollectionType）があればそちらを使い、無い環境では旧APIにフォールバックする
  if (typeof form.setEmailCollectionType === 'function') {
    form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED);
  } else {
    form.setCollectEmail(true);
  }

  form.setAllowResponseEdits(false); // 回答の編集を許可しない（同意内容の書き換え防止）
  form.setProgressBar(false);        // 1ページなので進行状況バーは不要
  form.setAcceptingResponses(true);

  form.setConfirmationMessage(
    'お申込みありがとうございます。\n' +
    '\n' +
    '3営業日以内に、お振込先とお支払い期日を記載した案内メールをお送りします。\n' +
    'お支払い期日は、案内メール送付日から7日以内です。\n' +
    '\n' +
    'ご入金を確認しましたら、3営業日以内に、ご記入いただいたGoogleアカウントへ\n' +
    '教材フォルダの閲覧権限を付与し、メールにてご連絡します。\n' +
    '視聴期間は、この権限を付与した日から6ヶ月間です。\n' +
    '\n' +
    '株式会社ジリーナ'
  );

  // ---- 設問 ----
  var emailValidation = FormApp.createTextValidation()
    .requireTextIsEmail()
    .setHelpText('メールアドレスの形式でご入力ください。')
    .build();

  // 1. お名前（必須）
  form.addTextItem()
    .setTitle('お名前')
    .setRequired(true);

  // 2. Googleアカウント（Gmailアドレス）（必須・メール形式）
  form.addTextItem()
    .setTitle('Googleアカウント（Gmailアドレス）')
    .setHelpText('教材フォルダの閲覧権限を付与するアカウントです。Googleドライブにログインできるアドレスをご記入ください。')
    .setRequired(true)
    .setValidation(emailValidation);

  // 3. 連絡先メールアドレス（任意・メール形式）
  form.addTextItem()
    .setTitle('連絡先メールアドレス')
    .setHelpText('上記のGoogleアカウントと同じ場合は空欄で構いません。')
    .setRequired(false)
    .setValidation(emailValidation);

  // 4. 電話番号（任意）
  form.addTextItem()
    .setTitle('電話番号')
    .setHelpText('お申込み内容の確認が必要な場合のみご連絡します。')
    .setRequired(false);

  // 5. 簡単な自己紹介（任意・段落）
  form.addParagraphTextItem()
    .setTitle('簡単な自己紹介')
    .setHelpText('差し支えなければ、現在のお仕事やPCの使用状況などをお聞かせください。')
    .setRequired(false);

  // 6. 確認事項への同意（必須・チェック1つで全項目に同意）
  form.addCheckboxItem()
    .setTitle('以下のすべてに同意いただける場合のみ、チェックを入れてお進みください')
    .setHelpText(
      '・教材はGoogleドライブの限定共有で提供され、視聴期間はアクセス権付与日から6ヶ月間であること\n' +
      '・期間経過後は閲覧権限が削除され、視聴できなくなること\n' +
      '・お申込み後の返品・返金は一切できないこと\n' +
      '・本講座は動画教材の提供のみで、個別の質問対応・サポートは含まれないこと\n' +
      '・動画・コード・資料を第三者と共有、複製、再配布、転売しないこと\n' +
      '・アカウントの共有や権限の又貸しが確認された場合、受講資格の取消しと受講料相当額の違約金請求があり得ること\n' +
      '・本講座は教育講座であり、投資助言・運用代行ではないこと\n' +
      '・投資の最終判断と結果はすべて受講者自身の責任であること'
    )
    .setChoiceValues(['視聴期間6ヶ月（アクセス権付与日から）・返金不可・サポートなし・複製および第三者への再配布の禁止を含む、上記のすべてに同意します'])
    .setRequired(true);

  // ---- 実行結果の出力 ----
  Logger.log('フォームの再構築が完了しました。');
  Logger.log('編集URL: ' + form.getEditUrl());
  Logger.log('公開URL: ' + form.getPublishedUrl());
  Logger.log('公開URLが LP 記載のフォームURLと一致することを確認してください。');
  Logger.log('【手動設定が1つ残っています】「設定 → 回答 → 回答のコピーを回答者に送信: 常に表示」を有効にしてください（APIでは設定できません）。');
}
