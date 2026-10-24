/**
 * 端到端冒烟：覆盖两个页面的主路径与真实落库。
 * 运行：先 npm run dev（或 npm start），再 node scripts/e2e.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const WEB = process.argv[2] ?? 'http://127.0.0.1:5173';
const API = process.env.API_URL ?? 'http://127.0.0.1:9000';
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const OPERATOR = encodeURIComponent('E2E');

async function req(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'x-operator': OPERATOR, ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('409')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(e.message));
const results = [];
const step = async (name, fn) => {
  await fn();
  results.push(name);
  console.log('✓', name);
};

const createdRoomIds = [];
const createdClusterIds = [];

try {
  await step('机房建设页渲染', async () => {
    await page.goto(`${WEB}/room-buildout`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.csys-kpi').count(), 4);
    assert.ok((await page.locator('.rb-room-group').count()) >= 1);
    assert.ok((await page.locator('.rb-org-chip').count()) >= 4);
  });

  await step('筛选与搜索', async () => {
    await page.locator('.rb-filterbar .rb-search input').fill('wlby');
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.rb-room-group').count(), 1);
    assert.match(await page.locator('.rb-room-group').innerText(), /WLBY/);
    await page.locator('.rb-filterbar .rb-search input').fill('zzzz-no-result');
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.rb-room-group').count(), 0);
    await page.locator('button', { hasText: '重置' }).first().click();
    await page.waitForTimeout(500);
  });

  await step('机房抽屉可打开', async () => {
    await page.locator('.rb-room-group .btn', { hasText: '机房详情' }).first().click();
    await page.waitForTimeout(600);
    assert.ok(await page.locator('.rb-drawer').isVisible());
    assert.ok((await page.locator('.rb-stage-card').count()) === 6);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  await step('登记机房 → 出现在清单 → 服务端可查', async () => {
    await page.locator('button', { hasText: '登记机房建设需求' }).first().click();
    await page.waitForTimeout(400);
    const name = `E2E 机房 ${Date.now().toString(36)}`;
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="ko-plan"]').fill('2026-12-01');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(900);
    const rooms = await req('/api/rooms?query=' + encodeURIComponent('E2E'));
    const room = rooms.find((r) => r.name === name);
    assert.ok(room, '新机房未出现在 API');
    createdRoomIds.push(room.id);
    assert.equal(room.startDate, '2026-12-01');
    assert.equal(room.envItems.length, 13);
  });

  await step('阶段状态落库', async () => {
    const roomId = createdRoomIds[0];
    const room = (await req(`/api/rooms/${roomId}`)).room;
    await page.goto(`${WEB}/room-buildout?phase=all&query=${encodeURIComponent(room.name)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.locator('.rb-room-group .btn', { hasText: '机房详情' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('.rb-stage-card').nth(1).click();
    await page.waitForTimeout(400);
    await page.locator('.rb-sp-status-btn', { hasText: '进行中' }).click();
    await page.waitForTimeout(700);
    const after = await req(`/api/rooms/${roomId}`);
    assert.equal(after.room.stages[1].status, 'doing');
    assert.equal(after.room.currentStage, 0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  await step('环境项状态轮转落库', async () => {
    const roomId = createdRoomIds[0];
    const before = await req(`/api/rooms/${roomId}`);
    const roomName = before.room.name;
    await page.goto(`${WEB}/room-buildout?phase=all&query=${encodeURIComponent(roomName)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.locator('.rb-room-group .btn', { hasText: '机房详情' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('.rb-stage-card').nth(3).click();
    await page.waitForTimeout(400);
    await page.locator('.rb-env-block').first().click();
    await page.waitForTimeout(600);
    const after = await req(`/api/rooms/${roomId}`);
    const changed = after.room.envItems.find((item, index) => item.status !== before.room.envItems[index].status);
    assert.ok(changed, '环境项状态没有变化');
    await page.keyboard.press('Escape');
  });

  await step('集群交付页渲染与来源筛选', async () => {
    await page.goto(`${WEB}/cluster-delivery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const rows = await page.locator('.cd-cluster-row:not(.cd-cluster-head)').count();
    assert.ok(rows >= 20, `集群行数 ${rows}`);
    const total = await req('/api/clusters');
    const newFirst = total.filter((c) => c.origin === 'new-first').length;
    await page.locator('.cd-source button', { hasText: '新机房首批' }).click();
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.cd-cluster-row:not(.cd-cluster-head)').count(), newFirst);
    await page.locator('.cd-source button', { hasText: '全部' }).click();
    await page.waitForTimeout(400);
  });

  await step('集群抽屉与子项勾选落库', async () => {
    const clusters = await req('/api/clusters');
    const target = clusters.find((c) => c.status === 'building') ?? clusters[0];
    await page.goto(`${WEB}/cluster-delivery?query=${encodeURIComponent(target.name)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.locator('.cd-cluster-row:not(.cd-cluster-head)').first().click();
    await page.waitForTimeout(700);
    assert.ok(await page.locator('.cd-drawer').isVisible());
    const before = await req(`/api/clusters/${target.id}`);
    const stage = before.cluster.delivery.find((s) => s.status === 'todo' || s.status === 'doing');
    const key = Object.keys(stage.checks)[0];
    const beforeValue = stage.checks[key];
    await page.locator('.cd-drawer input[type="checkbox"]:not([disabled])').first().click();
    await page.waitForTimeout(700);
    const after = await req(`/api/clusters/${target.id}`);
    const changed = after.cluster.delivery.flatMap((s) => Object.entries(s.checks)).filter(([k, v]) => {
      const prev = before.cluster.delivery.flatMap((s) => Object.entries(s.checks)).find(([pk]) => pk === k);
      return prev && prev[1] !== v;
    });
    assert.ok(changed.length > 0, '勾选没有落库');
    for (const [k, v] of changed) {
      const stageIndex = after.cluster.delivery.findIndex((s) => k in s.checks);
      await req(`/api/clusters/${target.id}/delivery/${stageIndex}/checks`, { method: 'PATCH', body: JSON.stringify({ key: k, value: !v }) });
    }
    await page.keyboard.press('Escape');
  });

  await step('CSV 导出带 BOM 与来源列', async () => {
    const res = await fetch(`${API}/api/export/clusters.csv`);
    const buf = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual([...buf.slice(0, 3)], [0xef, 0xbb, 0xbf], 'CSV 缺少 UTF-8 BOM');
    const text = new TextDecoder('utf-8').decode(buf);
    assert.ok(text.split('\n')[0].includes('交付来源'));
  });

  await step('清理测试数据', async () => {
    for (const id of createdRoomIds) await req(`/api/rooms/${id}`, { method: 'DELETE' });
    const rooms = await req('/api/rooms');
    assert.equal(rooms.length, 20);
  });

  assert.deepEqual(errors, [], `控制台错误：${errors.join(' | ')}`);
  console.log(`\nE2E 通过：${results.length} 步，0 console error`);
} finally {
  for (const id of createdRoomIds) {
    await req(`/api/rooms/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  for (const id of createdClusterIds) {
    await req(`/api/clusters/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  await browser.close();
}
