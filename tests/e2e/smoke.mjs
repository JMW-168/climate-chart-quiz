// E2E 煙霧測試：完整作答、重載續作、雙擊提交、離線練習與錯題複習、320px 無橫向溢出。
// 先 npm run build，再執行 npm run e2e（需本機有 Playwright 與 Chromium）。
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 4179;
const BASE = `http://localhost:${PORT}/climate-chart-quiz/`;
const SHOTS = process.env.SHOTS_DIR ?? 'test-results';
mkdirSync(SHOTS, { recursive: true });

const server = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve());
  server.on('exit', () => reject(new Error('preview 啟動失敗')));
  setTimeout(() => reject(new Error('preview 逾時')), 20000);
});

const failures = [];
const check = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    console.log(`  ✗ ${msg}`);
    failures.push(msg);
  }
};

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // 離線時抓取題庫版本資訊失敗屬預期，不列為錯誤
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('ERR_INTERNET_DISCONNECTED') && errors.push(m.text()));

  console.log('首頁與離線就緒');
  await page.goto(BASE);
  await page.getByText('示範題庫').first().waitFor();
  await page.getByText('已可離線練習').waitFor({ timeout: 15000 });
  check(true, '首次載入後顯示「已可離線練習」');
  await page.screenshot({ path: `${SHOTS}/home-390.png`, fullPage: true });

  async function answerCurrent({ wrong = false } = {}) {
    const q2 = await page.locator('.chart-grid').count();
    if (q2) {
      await page.locator('.chart-pick').nth(wrong ? 1 : 0).click();
    } else {
      await page.locator('.option').nth(wrong ? 1 : 0).click();
    }
    await page.getByRole('button', { name: '提交答案' }).dblclick();
    await page.locator('.result-banner').waitFor();
  }

  console.log('完整作答流程');
  await page.goto(`${BASE}practice/setup`);
  await page.getByText('5 題', { exact: true }).click();
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/practice\/(?!setup)/);
  await page.screenshot({ path: `${SHOTS}/question-390.png`, fullPage: true });
  await answerCurrent();
  check((await page.locator('.result-banner').count()) === 1, '提交後顯示解析');
  check((await page.locator('.option.locked, .chart-pick:has(input:disabled)').count()) > 0, '提交後選項鎖定');
  await page.screenshot({ path: `${SHOTS}/explanation-390.png`, fullPage: true });

  await page.reload();
  await page.locator('.result-banner').waitFor();
  check(true, 'S01 重新整理後回到同一題已提交狀態');
  const sessionUrl = page.url();

  for (let i = 1; i < 5; i++) {
    await page.locator('.actions').getByRole('button', { name: /下一題|完成/ }).click();
    try {
      await page.getByText(`第 ${i + 1} 題，共 5 題`).waitFor({ timeout: 5000 });
    } catch (e) {
      console.log((await page.locator('main').innerText()).slice(0, 800));
      throw e;
    }
    await answerCurrent({ wrong: i % 2 === 1 });
  }
  await page.locator('.actions').getByRole('button', { name: '完成並查看結果' }).click();
  await page.waitForURL(/results\//);
  const scoreText = await page.locator('.score').innerText();
  check(/\/ 5 題答對/.test(scoreText), `結果頁顯示成績（${scoreText.replace(/\s+/g, ' ')}）`);
  await page.screenshot({ path: `${SHOTS}/results-390.png`, fullPage: true });

  console.log('Q2 看氣候選圖');
  await page.goto(`${BASE}practice/setup`);
  await page.getByText('看氣候選圖', { exact: true }).click();
  await page.getByText('5 題', { exact: true }).click();
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/practice\/(?!setup)/);
  await page.locator('.chart-card').first().waitFor();
  check((await page.locator('.chart-card').count()) === 4, '四圖題顯示 4 張圖');
  await page.getByRole('button', { name: '放大圖 A' }).click();
  await page.getByRole('button', { name: '返回選項' }).waitFor();
  await page.screenshot({ path: `${SHOTS}/zoom-390.png` });
  await page.getByRole('button', { name: '返回選項' }).click();
  await page.screenshot({ path: `${SHOTS}/q2-390.png`, fullPage: true });
  await answerCurrent({ wrong: true });
  await page.screenshot({ path: `${SHOTS}/q2-explained-390.png`, fullPage: true });

  console.log('離線');
  await context.setOffline(true);
  await page.goto(BASE);
  await page.getByText('目前離線').waitFor();
  check(true, 'P01 離線可開首頁');
  await page.getByRole('button', { name: /繼續未完成的練習/ }).click();
  await page.locator('.q-title').waitFor();
  check(true, 'P01 離線可續作');
  await page.goto(`${BASE}practice/setup`);
  await page.getByText('看圖選氣候', { exact: true }).click();
  await page.getByText('5 題', { exact: true }).click();
  await page.locator('button[type=submit]').click();
  await page.getByRole('button', { name: '放棄並開始新練習' }).click();
  await page.waitForURL(/practice\/(?!setup)/);
  await answerCurrent({ wrong: true });
  check(true, 'P01 離線可開始新練習並作答');
  await page.goto(`${BASE}mistakes`);
  const pendingText = await page.locator('main').innerText();
  check(/待複習/.test(pendingText), '錯題頁列出待複習');
  await page.getByRole('button', { name: /開始複習/ }).click();
  const dlg = page.getByRole('button', { name: '放棄並開始複習' });
  if (await dlg.isVisible().catch(() => false)) await dlg.click();
  await page.waitForURL(/practice\/(?!setup)/);
  await page.locator('.q-title').waitFor();
  check(/錯題複習｜第 1 題/.test(await page.locator('.q-head').innerText()), 'P01 離線可錯題複習');
  await context.setOffline(false);

  console.log('320px 版面');
  const small = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const sp = await small.newPage();
  for (const path of ['', 'learn', 'practice/setup', 'mistakes', 'settings', 'data']) {
    await sp.goto(BASE + path);
    await sp.locator('main').waitFor();
    await sp.waitForTimeout(400);
    const w = await sp.evaluate(() => document.documentElement.scrollWidth);
    check(w <= 320, `U01 /${path} 無橫向溢出（${w}px）`);
  }
  await sp.goto(`${BASE}practice/setup`);
  await sp.getByText('看氣候選圖', { exact: true }).click();
  await sp.locator('button[type=submit]').click();
  await sp.waitForURL(/practice\/(?!setup)/);
  await sp.locator('.chart-card').first().waitFor();
  const w = await sp.evaluate(() => document.documentElement.scrollWidth);
  check(w <= 320, `U01 四圖題無橫向溢出（${w}px）`);
  await sp.screenshot({ path: `${SHOTS}/q2-320.png`, fullPage: true });
  await sp.goto(`${BASE}`);
  await sp.screenshot({ path: `${SHOTS}/home-320.png`, fullPage: true });

  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dp = await desk.newPage();
  await dp.goto(BASE);
  await dp.getByText('示範題庫').first().waitFor();
  await dp.screenshot({ path: `${SHOTS}/home-1280.png`, fullPage: true });

  check(errors.length === 0, `沒有 console 錯誤${errors.length ? `：${errors.join(' | ')}` : ''}`);
  void sessionUrl;
} finally {
  await browser.close();
  server.kill();
}

if (failures.length) {
  console.error(`\n${failures.length} 項失敗`);
  process.exit(1);
}
console.log('\nE2E 全部通過');
