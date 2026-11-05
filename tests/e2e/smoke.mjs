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
  await page.getByText('試用題庫').first().waitFor();
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

  console.log('讀圖總複習');
  await page.getByRole('link', { name: '複習', exact: true }).click();
  await page.waitForURL(/review$/);
  await page.locator('.review-card').first().waitFor();
  const cards = await page.locator('.review-card').count();
  check(cards === 13, `總複習列出全部 13 個類型（${cards}）`);
  check((await page.locator('.review-card svg').count()) === 13, '13 個類型都有代表圖');
  await page.getByRole('radio', { name: '寒帶' }).check({ force: true });
  check((await page.locator('.review-card').count()) === 2, '分組篩選：寒帶 2 類');
  await page.screenshot({ path: `${SHOTS}/review-390.png`, fullPage: true });

  console.log('世界氣候地圖');
  await page.getByRole('link', { name: '地圖', exact: true }).click();
  await page.waitForURL(/map$/);
  await page.waitForTimeout(1500);
  const mbox = await page.locator('svg.overlay').boundingBox();
  await page.mouse.click(mbox.x + ((10 + 180) * 4 / 1440) * mbox.width, mbox.y + ((84 - 23) * 4 / 576) * mbox.height);
  check((await page.locator('.info-head').innerText()).includes('熱帶沙漠'), '地圖點撒哈拉顯示熱帶沙漠氣候');
  await page.getByRole('button', { name: '只看寒帶' }).click();
  check((await page.locator('.legend-group .legend-item:not(.off)').count()) === 2, '只看寒帶後只勾選 2 類');
  await page.getByRole('button', { name: '全選' }).click();
  await page.locator('.legend-item', { hasText: '暖流' }).click();
  check((await page.locator('.current.warm').count()) >= 5, '開啟暖流圖層');
  await page.locator('.legend-item', { hasText: '暖流' }).click();

  console.log('資料來源頁');
  await page.goto(`${BASE}sources`);
  const srcText = await page.locator('main').innerText();
  check(srcText.includes('非營利') && srcText.includes('0253808') && srcText.includes('翰林'), '資料來源頁含非營利聲明、NCEI 與翰林出處');
  await page.screenshot({ path: `${SHOTS}/sources-390.png`, fullPage: true });

  console.log('完整作答流程');
  await page.goto(`${BASE}practice/setup`);
  await page.getByText('5 題', { exact: true }).click();
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/practice\/(?!setup)/);
  await page.screenshot({ path: `${SHOTS}/question-390.png`, fullPage: true });
  await answerCurrent();
  check((await page.locator('.result-banner').count()) === 1, '提交後顯示解析');
  // 成因題的地點在題目上方已顯示，其他題型在解析中顯示
  const isCause = (await page.locator('.cause.main').count()) === 1;
  const isLoc = (await page.locator('.location-choice').count()) === 1;
  check(isCause || isLoc || (await page.locator('.where .station-info').count()) >= 1, '提交後顯示測站城市與位置');
  check((await page.locator(isCause ? '.cause-layout svg.locator' : isLoc ? '.location-choice svg.locator' : '.where svg.locator').count()) === 1, '提交後顯示位置小地圖');
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

  console.log('看圖找地點、成因題');
  await page.goto(`${BASE}practice/setup`);
  await page.getByText('看圖找地點', { exact: true }).click();
  await page.getByText('5 題', { exact: true }).click();
  await page.locator('button[type=submit]').click();
  const give1 = page.getByRole('button', { name: '放棄並開始新練習' });
  if (await give1.isVisible().catch(() => false)) await give1.click();
  await page.waitForURL(/practice\/(?!setup)/);
  await page.locator('.location-choice').waitFor();
  // 直接點小地圖上的地點
  await page.locator('.location-choice .pt').nth(2).dispatchEvent('click');
  await page.locator('.location-choice .option.selected').waitFor({ timeout: 3000 }).catch(() => undefined);
  check((await page.locator('.location-choice .option.selected').count()) === 1, '點小地圖上的地點即選取');
  await page.getByRole('button', { name: '提交答案' }).click();
  await page.locator('.result-banner').waitFor();
  check((await page.locator('.location-choice .option').filter({ hasText: '｜' }).count()) === 4 && (await page.locator('.result-banner').innerText()).includes('地點'), '看圖找地點：作答後選項顯示四個城市');
  await page.screenshot({ path: `${SHOTS}/location-390.png`, fullPage: true });

  await page.goto(`${BASE}practice/setup`);
  await page.getByText('成因題（延伸）', { exact: true }).click();
  await page.getByText('5 題', { exact: true }).click();
  await page.locator('button[type=submit]').click();
  const give2 = page.getByRole('button', { name: '放棄並開始新練習' });
  if (await give2.isVisible().catch(() => false)) await give2.click();
  await page.waitForURL(/practice\/(?!setup)/);
  await page.locator('.cause-layout').waitFor();
  check((await page.locator('.q-title').innerText()).includes('為什麼'), '成因題題幹包含「為什麼」');
  await page.locator('.option').first().click();
  await page.getByRole('button', { name: '提交答案' }).click();
  await page.locator('.cause.main').waitFor();
  check(true, '成因題解析顯示主要原因');
  await page.screenshot({ path: `${SHOTS}/cause-390.png`, fullPage: true });

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
  for (const path of ['', 'learn', 'review', 'map', 'practice/setup', 'mistakes', 'settings', 'data', 'sources']) {
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
  await dp.getByText('試用題庫').first().waitFor();
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
