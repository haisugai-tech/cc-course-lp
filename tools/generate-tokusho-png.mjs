// 特定商取引法に基づく表記の画像を再生成するスクリプト
// 使い方: tools/ ディレクトリで `npm i playwright-core` 後、リポジトリルートから
//   node tools/generate-tokusho-png.mjs
// PCにインストール済みの Google Chrome を使用する（Chromiumのダウンロード不要）。
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, 'tokusho-src.html');
const outDir = path.join(here, '..', 'assets');
const out = path.join(outDir, 'tokusho.png');

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: 880, height: 800 },
  deviceScaleFactor: 2,
});
await page.goto('file://' + src.replace(/\\/g, '/'));
await page.waitForLoadState('networkidle');
const sheet = page.locator('#sheet');
await sheet.screenshot({ path: out });
await browser.close();
console.log('written:', out);
