/**
 * 端到端验收：覆盖两个页面的全部模块功能。
 * 运行：API_URL=http://host:port node scripts/e2e.mjs http://host:port
 * 依赖：正在运行的应用（dev 或生产），以及 playwright-core + 本机 Chromium。
 */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const WEB = process.argv[2] ?? 'http://127.0.0.1:5173';
const API = process.env.API_URL ?? WEB;
const EXE = process.env.CHROMIUM_PATH ?? process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const OPERATOR = encodeURIComponent('E2E');

async function req(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'x-operator': OPERATOR, ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    const error = new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${text.slice(0, 200)}`);
    error.status = res.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
page.on('console', (m) => {
  const text = m.text();
  if (m.type() === 'error' && !text.includes('409') && !text.includes('Failed to load resource')) consoleErrors.push(text);
});
page.on('pageerror', (e) => consoleErrors.push(e.message));

const createdRoomIds = [];
const createdClusterIds = [];
const results = [];
let failed = null;

const sleep = (ms) => page.waitForTimeout(ms);
const step = async (name, fn) => {
  try {
    await fn();
    results.push(name);
    console.log(`✓ ${name}`);
  } catch (error) {
    failed = name;
    console.error(`✗ ${name}`);
    throw error;
  }
};
const waitCount = async (selector, count, timeout = 8000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if ((await page.locator(selector).count()) === count) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`等待 ${selector} = ${count} 超时，当前 ${await page.locator(selector).count()}`);
};
const expectRoomRows = (count) => waitCount('.rb-room-group', count);
const expectClusterRows = (count) => waitCount('.cd-cluster-row:not(.cd-cluster-head)', count);
const closeDrawers = async () => {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await sleep(120);
  }
};
const openRoom = async (name) => {
  await page.goto(`${WEB}/room-buildout?phase=all&query=${encodeURIComponent(name)}`, { waitUntil: 'networkidle' });
  await sleep(500);
  await page.locator('.rb-room-group .btn', { hasText: '机房详情' }).first().click();
  await sleep(600);
  assert.ok(await page.locator('.rb-drawer').isVisible(), '机房抽屉未打开');
};

try {
  // ---------------- 机房建设页 ----------------
  await step('机房页：渲染 KPI、阶段卡、清单', async () => {
    await page.goto(`${WEB}/room-buildout`, { waitUntil: 'networkidle' });
    await sleep(700);
    assert.equal(await page.locator('.csys-kpi').count(), 4);
    assert.equal(await page.locator('.rb-phase-card').count(), 3);
    assert.ok((await page.locator('.rb-room-group').count()) >= 1);
  });

  await step('机房页：过去 / 现在 / 未来 / 全部 切换', async () => {
    const rooms = await req('/api/rooms');
    for (const [label, key] of [['过去', 'past'], ['未来', 'future'], ['全部', 'all']]) {
      await page.locator('.rb-org-chip', { hasText: label }).first().click();
      await sleep(500);
      const expected = key === 'all' ? rooms.length : rooms.filter((r) => r.phase === key).length;
      await expectRoomRows(expected);
      assert.ok(page.url().includes(`phase=${key}`));
    }
  });

  await step('机房页：区域 / 类型 / 业务筛选与重置', async () => {
    const selects = page.locator('.rb-filterbar select');
    assert.equal(await selects.count(), 3);
    const overseas = await req('/api/rooms?phase=all&area=overseas');
    await selects.nth(0).selectOption('overseas');
    await expectRoomRows(overseas.length);
    const flow = await req('/api/rooms?phase=all&area=overseas&tenant=Flow');
    await selects.nth(2).selectOption('Flow');
    await expectRoomRows(flow.length);
    await page.locator('.rb-filterbar button', { hasText: '重置' }).click();
    await sleep(500);
    await page.locator('.rb-org-chip', { hasText: '全部' }).first().click();
    await sleep(400);
    assert.ok(page.url().includes('phase=all'));
  });

  await step('机房页：搜索命中 / 空态 / 重置', async () => {
    const search = page.locator('.rb-filterbar .rb-search input');
    await search.fill('wlby');
    await expectRoomRows(1);
    assert.match(await page.locator('.rb-room-group').first().innerText(), /WLBY/);
    await search.fill('zzzz-no-result');
    await expectRoomRows(0);
    await page.locator('button', { hasText: '重置筛选' }).first().click();
    await sleep(500);
  });

  await step('机房页：时间线展开 / 收起', async () => {
    await page.goto(`${WEB}/room-buildout?phase=all`, { waitUntil: 'networkidle' });
    await sleep(500);
    const before = await page.locator('.rb-tl-row').count();
    await page.locator('button', { hasText: '展开完整时间线' }).first().click();
    await sleep(500);
    const after = await page.locator('.rb-tl-row').count();
    assert.ok(after > before, `时间线行数未增加：${before} → ${after}`);
    assert.match(await page.locator('button', { hasText: '收起时间线' }).first().innerText(), /收起/);
    await page.locator('button', { hasText: '收起时间线' }).first().click();
    await sleep(400);
  });

  await step('机房页：排序与恢复默认', async () => {
    const sort = page.locator('select[data-sort], .rb-list-actions select').first();
    await sort.selectOption('owner');
    await sleep(500);
    assert.ok(await page.locator('.rb-room-group').count() > 0);
    await page.locator('button', { hasText: '恢复默认排序' }).click();
    await sleep(400);
  });

  await step('机房抽屉：概览与六阶段卡', async () => {
    await page.goto(`${WEB}/room-buildout?phase=present`, { waitUntil: 'networkidle' });
    await sleep(500);
    await page.locator('.rb-room-group .btn', { hasText: '机房详情' }).first().click();
    await sleep(600);
    assert.equal(await page.locator('.rb-stage-card').count(), 6);
    assert.ok(await page.locator('.rb-cluster-nav').isVisible());
    assert.ok(await page.locator('.rb-cluster-detail').isVisible());
    await closeDrawers();
  });

  // ---------------- 机房：新建与全部写路径 ----------------
  const roomName = `E2E 验收机房 ${Date.now().toString(36)}`;
  await step('登记机房：必填校验 → 重名报错 → 创建成功', async () => {
    await page.locator('button', { hasText: '登记机房建设需求' }).first().click();
    await sleep(400);
    await page.locator('button[type="submit"]', { hasText: '登记需求' }).click();
    await sleep(400);
    assert.ok((await page.locator('.rb-modal-error, [role="alert"]').first().innerText()).length > 0, '未显示必填错误');
    await page.locator('input[name="name"]').fill('Seed WLBY 机房');
    await page.locator('input[name="ko-plan"]').fill('2026-12-01');
    await page.locator('button[type="submit"]', { hasText: '登记需求' }).click();
    await sleep(700);
    assert.match(await page.locator('.rb-modal-error').first().innerText(), /同名/);
    await page.locator('input[name="name"]').fill(roomName);
    await page.locator('input[name="deploy-estimate"]').fill('2027-01-15');
    await page.locator('input[name="business-side"]').fill('Seed');
    await page.locator('input[name="poc-room"]').fill('曲强');
    await page.locator('button[type="submit"]', { hasText: '登记需求' }).click();
    await sleep(900);
    const rooms = await req('/api/rooms?query=' + encodeURIComponent(roomName));
    const room = rooms.find((r) => r.name === roomName);
    assert.ok(room, '新机房未创建');
    createdRoomIds.push(room.id);
    assert.equal(room.startDate, '2026-12-01');
    assert.equal(room.targetDate, '2027-01-15');
  });

  await step('机房抽屉：阶段子项与阶段登记落库（刷新后仍在）', async () => {
    const roomId = createdRoomIds[0];
    await openRoom(roomName);
    await page.locator('.rb-stage-card').nth(1).click();
    await sleep(500);
    const field = page.locator('[data-field="v3-create"]');
    await field.fill('3V-E2E-001');
    await field.press('Tab');
    await sleep(700);
    const meta = page.locator('[data-meta="owner"]');
    await meta.fill('E2E 负责人');
    await meta.press('Tab');
    await sleep(700);
    const detail = await req(`/api/rooms/${roomId}`);
    assert.equal(detail.room.stages[1].fields['v3-create'], '3V-E2E-001');
    assert.equal(detail.room.stages[1].meta.owner, 'E2E 负责人');
    await closeDrawers();
    await openRoom(roomName);
    await page.locator('.rb-stage-card').nth(1).click();
    await sleep(500);
    assert.equal(await page.locator('[data-field="v3-create"]').inputValue(), '3V-E2E-001');
    await closeDrawers();
  });

  await step('机房抽屉：阶段状态四态切换', async () => {
    const roomId = createdRoomIds[0];
    await openRoom(roomName);
    await page.locator('.rb-stage-card').nth(2).click();
    await sleep(400);
    await page.locator('.rb-sp-status-btn', { hasText: '不适用' }).click();
    await sleep(700);
    const detail = await req(`/api/rooms/${roomId}`);
    assert.equal(detail.room.stages[2].status, 'skip');
    await closeDrawers();
  });

  await step('机房抽屉：环境项轮转 + 自定义增删', async () => {
    const roomId = createdRoomIds[0];
    await openRoom(roomName);
    await page.locator('.rb-stage-card').nth(3).click();
    await sleep(500);
    const before = (await req(`/api/rooms/${roomId}`)).room.envItems.length;
    assert.equal(await page.locator('.rb-env-block').count(), before);
    const first = page.locator('.rb-env-block').first();
    const beforeClass = await first.getAttribute('class');
    await first.click();
    await sleep(600);
    assert.notEqual(await first.getAttribute('class'), beforeClass);
    await page.locator('.rb-env-add input').nth(0).fill('E2E 自定义环境项');
    await page.locator('.rb-env-add input').nth(1).fill('其他');
    await page.locator('.rb-env-add button', { hasText: '添加' }).click();
    await sleep(700);
    const added = await req(`/api/rooms/${roomId}`);
    const custom = added.room.envItems.find((i) => i.name === 'E2E 自定义环境项');
    assert.ok(custom, '自定义环境项未创建');
    assert.equal(added.room.envItems.length, before + 1);
    await closeDrawers();
  });

  await step('机房抽屉：登记集群 → 编辑 → 删除', async () => {
    const roomId = createdRoomIds[0];
    await openRoom(roomName);
    await page.locator('.rb-cluster-add').click();
    await sleep(400);
    await page.locator('[data-cf="name"]').fill('e2e-cluster');
    await page.locator('.rb-cluster-form label', { hasText: '集群负责人' }).locator('input').fill('张三');
    await page.locator('.rb-cluster-form button', { hasText: '登记集群' }).click();
    await sleep(800);
    let detail = await req(`/api/rooms/${roomId}`);
    const cluster = detail.clusters.find((c) => c.name === 'e2e-cluster');
    assert.ok(cluster, '集群未创建');
    createdClusterIds.push(cluster.id);
    await page.locator(`[data-cluster-row="${cluster.id}"]`).click();
    await sleep(500);
    await page.locator('button', { hasText: '编辑集群' }).click();
    await sleep(300);
    await page.locator('.rbd-panel label', { hasText: '集群负责人' }).locator('input').fill('李四');
    await page.locator('button', { hasText: '保存修改' }).click();
    await sleep(700);
    detail = await req(`/api/rooms/${roomId}`);
    assert.equal(detail.clusters.find((c) => c.id === cluster.id).owner, '李四');
    await page.locator('button', { hasText: '删除集群' }).click();
    await sleep(300);
    await page.locator('button', { hasText: '确认删除' }).click();
    await sleep(800);
    detail = await req(`/api/rooms/${roomId}`);
    assert.equal(detail.clusters.some((c) => c.id === cluster.id), false);
    createdClusterIds.pop();
    await closeDrawers();
  });

  await step('机房抽屉：编辑机房与删除机房', async () => {
    const roomId = createdRoomIds[0];
    await openRoom(roomName);
    await page.locator('button', { hasText: '编辑机房' }).click();
    await sleep(300);
    const blocker = page.locator('textarea').last();
    await blocker.fill('E2E 阻塞说明');
    await blocker.press('Tab');
    await sleep(600);
    await page.locator('button', { hasText: '保存' }).last().click();
    await sleep(700);
    let detail = await req(`/api/rooms/${roomId}`);
    assert.match(detail.room.blocker, /E2E 阻塞说明/);
    await page.locator('button', { hasText: '删除机房' }).click();
    await sleep(300);
    await page.locator('button', { hasText: '确认删除' }).click();
    await sleep(800);
    const rooms = await req('/api/rooms');
    assert.equal(rooms.some((r) => r.id === roomId), false);
    createdRoomIds.pop();
    await closeDrawers();
  });

  // ---------------- 集群交付页 ----------------
  await step('交付页：渲染 KPI、时间线、清单', async () => {
    await page.goto(`${WEB}/cluster-delivery`, { waitUntil: 'networkidle' });
    await sleep(800);
    assert.equal(await page.locator('.cd-summary-card').count(), 3);
    assert.ok((await page.locator('.cd-cluster-row:not(.cd-cluster-head)').count()) >= 20);
    assert.ok((await page.locator('.cd-tl-row').count()) >= 4);
  });

  await step('交付页：来源分段 / 类型 / 搜索 / 空态 / 重置', async () => {
    const clusters = await req('/api/clusters');
    const newFirst = clusters.filter((c) => c.origin === 'new-first').length;
    await page.locator('.cd-source button', { hasText: '新机房首批' }).click();
    await expectClusterRows(newFirst);
    await page.locator('.cd-source button', { hasText: '全部' }).click();
    await sleep(400);
    const infer = await req('/api/clusters?type=' + encodeURIComponent('推理'));
    await page.locator('.cd-filterbar select').nth(2).selectOption('推理');
    await expectClusterRows(infer.length);
    await page.locator('.cd-search input').fill('candy');
    await expectClusterRows(infer.filter((c) => c.name.toLowerCase().includes('candy')).length);
    await page.goto(`${WEB}/cluster-delivery?type=${encodeURIComponent('推理')}&query=zzzz`, { waitUntil: 'networkidle' });
    await expectClusterRows(0);
    await page.locator('button', { hasText: '重置' }).first().click();
    await sleep(600);
  });

  await step('交付页：时间线展开 / 收起', async () => {
    const before = await page.locator('.cd-tl-row').count();
    await page.locator('button', { hasText: '展开完整时间线' }).click();
    await sleep(500);
    const after = await page.locator('.cd-tl-row').count();
    assert.ok(after > before);
    await page.locator('button', { hasText: '收起时间线' }).click();
    await sleep(400);
  });

  await step('登记集群：必填校验 → 提交成功', async () => {
    await page.locator('[data-cd-register]').click();
    await sleep(500);
    await page.locator('.cd-form button[type="submit"]').click();
    await sleep(500);
    assert.ok(await page.locator('.cd-form-error, [role="alert"]').first().isVisible(), '未显示必填错误');
    const name = `e2e-delivery-${Date.now().toString(36)}`;
    await page.locator('.cd-form input[name="name"]').fill(name);
    await page.locator('.cd-form select[name="type"]').selectOption('推理');
    await page.locator('.cd-form input[name="tenant"]').fill('Seed');
    await page.locator('.cd-form input[name="owner"]').fill('王五');
    await page.locator('.cd-form button[type="submit"]').click();
    await sleep(900);
    const clusters = await req('/api/clusters?query=' + encodeURIComponent(name));
    const cluster = clusters.find((c) => c.name === name);
    assert.ok(cluster, '登记集群未创建');
    createdClusterIds.push(cluster.id);
  });

  await step('集群抽屉：子项勾选、阶段推进、编辑、删除', async () => {
    const id = createdClusterIds.at(-1);
    await page.goto(`${WEB}/cluster-delivery?query=${encodeURIComponent('e2e-delivery')}`, { waitUntil: 'networkidle' });
    await sleep(600);
    await page.locator('.cd-cluster-row:not(.cd-cluster-head)').first().click();
    await sleep(700);
    assert.ok(await page.locator('.cd-drawer').isVisible());
    const before = await req(`/api/clusters/${id}`);
    await page.locator('.cd-drawer input[type="checkbox"]:not([disabled])').first().click();
    await sleep(700);
    const after = await req(`/api/clusters/${id}`);
    const changed = after.cluster.delivery.some((s, i) => Object.entries(s.checks).some(([k, v]) => v !== before.cluster.delivery[i].checks[k]));
    assert.ok(changed, '子项勾选未落库');
    await page.locator('.cd-stage-edit-btn').first().click();
    await sleep(300);
    await page.locator('.cd-stage-edit-panel select').first().selectOption('done');
    await page.locator('.cd-stage-edit-panel button', { hasText: '保存' }).click();
    await sleep(700);
    const advanced = await req(`/api/clusters/${id}`);
    assert.equal(advanced.cluster.delivery[0].status, 'done');
    await page.locator('button[aria-label="编辑集群"]').click();
    await sleep(300);
    await page.locator('.cd-form label', { hasText: '负责人' }).locator('input').first().fill('赵六');
    await page.locator('.cd-form button[type="submit"]').click();
    await sleep(700);
    assert.equal((await req(`/api/clusters/${id}`)).cluster.owner, '赵六');
    // 删除入口在编辑面板内，重新打开编辑
    await page.locator('button[aria-label="编辑集群"]').click();
    await sleep(400);
    await page.locator('.delivery-danger-text').scrollIntoViewIfNeeded();
    await page.locator('.delivery-danger-text').click();
    await sleep(300);
    await page.locator('button', { hasText: '确认删除' }).click();
    await sleep(800);
    const all = await req('/api/clusters');
    assert.equal(all.some((c) => c.id === id), false);
    createdClusterIds.pop();
    await closeDrawers();
  });

  await step('CSV 导出：BOM、表头、筛选生效', async () => {
    const all = await fetch(`${API}/api/export/clusters.csv`);
    const allBuf = new Uint8Array(await all.arrayBuffer());
    assert.deepEqual([...allBuf.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    const allText = new TextDecoder().decode(allBuf);
    assert.match(allText.split('\n')[0], /交付来源/);
    const filtered = await fetch(`${API}/api/export/clusters.csv?type=${encodeURIComponent('推理')}`);
    const filteredText = new TextDecoder().decode(new Uint8Array(await filtered.arrayBuffer()));
    assert.ok(filteredText.trim().split('\r\n').length < allText.trim().split('\r\n').length);
  });

  await step('操作人：修改后持久化', async () => {
    await page.goto(`${WEB}/room-buildout`, { waitUntil: 'networkidle' });
    await sleep(500);
    await page.locator('.af-operator .topbar-user__trigger').click();
    await sleep(300);
    await page.locator('.af-operator input').fill('验收人');
    await page.locator('.af-operator button', { hasText: '保存' }).click();
    await sleep(400);
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(500);
    assert.equal(await page.evaluate(() => localStorage.getItem('af.operator')), '验收人');
    await page.evaluate(() => localStorage.setItem('af.operator', '本'));
  });

  assert.deepEqual(consoleErrors, [], `控制台错误：${consoleErrors.join(' | ')}`);
  const finalRooms = await req('/api/rooms');
  const finalClusters = await req('/api/clusters');
  assert.equal(finalRooms.length, 20, '机房数量未复原');
  assert.equal(finalClusters.length, 29, '集群数量未复原');
  console.log(`\nE2E 通过：${results.length} 步，0 console error，数据已复原（20 机房 / 29 集群）`);
} catch (error) {
  console.error(`\n失败步骤：${failed}\n`, error.message);
  try {
    console.error('URL:', page.url());
    console.error('rows:', await page.locator('.rb-room-group').count(), await page.locator('.cd-cluster-row:not(.cd-cluster-head)').count());
    console.error('text:', (await page.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n/g, ' | '));
    await page.screenshot({ path: '/tmp/e2e-fail.png', fullPage: false });
  } catch {}
  process.exitCode = 1;
} finally {
  for (const id of createdClusterIds) await req(`/api/clusters/${id}`, { method: 'DELETE' }).catch(() => {});
  for (const id of createdRoomIds) await req(`/api/rooms/${id}`, { method: 'DELETE' }).catch(() => {});
  await browser.close();
}
