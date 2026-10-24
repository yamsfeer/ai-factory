import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.ts';
import type { DB } from './db.ts';

let app: FastifyInstance;
let db: DB;

beforeAll(async () => {
  const built = await buildApp({ dbPath: ':memory:', today: '2026-10-24' });
  app = built.app;
  db = built.db;
});

afterAll(async () => {
  await app.close();
});

const op = { 'x-operator': encodeURIComponent('测试员') };

describe('读接口', () => {
  it('bootstrap 返回六阶段定义与环境项模板', async () => {
    const res = await app.inject({ url: '/api/bootstrap' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.today).toBe('2026-10-24');
    expect(body.stages.room).toHaveLength(6);
    expect(body.stages.cluster).toHaveLength(6);
    expect(body.stages.envTemplates).toHaveLength(13);
    expect(body.options.types).toContain('训练');
  });

  it('机房列表按阶段过滤并带派生汇总', async () => {
    const res = await app.inject({ url: '/api/rooms?phase=present' });
    expect(res.statusCode).toBe(200);
    const rooms = res.json();
    expect(rooms.length).toBeGreaterThan(0);
    for (const room of rooms) {
      expect(room.phase).toBe('present');
      expect(room.summary.recorded).toBeGreaterThanOrEqual(room.summary.delivered);
    }
  });

  it('机房详情包含集群与风险提示', async () => {
    const res = await app.inject({ url: '/api/rooms/wlby' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.room.name).toContain('WLBY');
    expect(body.clusters.length).toBeGreaterThan(0);
    expect(body.risk.level).toBe('warn');
  });

  it('不存在的机房返回 404 错误体', async () => {
    const res = await app.inject({ url: '/api/rooms/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('room_not_found');
  });
});

describe('机房写接口', () => {
  it('创建机房写入阶段、环境项与操作日志', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: op,
      payload: { name: '测试新建机房', area: 'overseas', fields: { 'ko-plan': '2026-12-01', 'deploy-estimate': '2027-01-01' } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.room.phase).toBe('future');
    expect(body.room.envItems).toHaveLength(13);
    expect(body.room.stages[0].fields['ko-plan']).toBe('2026-12-01');
    expect(body.audit[0].operator).toBe('测试员');

    const dup = await app.inject({ method: 'POST', url: '/api/rooms', headers: op, payload: { name: '测试新建机房' } });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('duplicate_room_name');
  });

  it('重名在更新时同样被拒绝', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/rooms/wlby', headers: op, payload: { name: 'AML YX 机房' } });
    expect(res.statusCode).toBe(409);
  });

  it('改阶段状态后当前阶段随之变化', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/rooms/hhdh/stages/1', headers: op, payload: { status: 'done' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.room.stages[1].status).toBe('done');
    expect(body.room.currentStage).toBe(2);
  });

  it('六个阶段全部完成后自动补验收日期', async () => {
    for (const index of [2, 3, 4, 5]) {
      const res = await app.inject({ method: 'PUT', url: `/api/rooms/hhdh/stages/${index}`, headers: op, payload: { status: 'done' } });
      expect(res.statusCode).toBe(200);
    }
    const detail = await app.inject({ url: '/api/rooms/hhdh' });
    const body = detail.json();
    expect(body.room.deliveredDate).toBe('2026-10-24');
    expect(body.room.phase).toBe('past');
    // 重新打开任一环节，交付日期必须清空
    await app.inject({ method: 'PUT', url: '/api/rooms/hhdh/stages/2', headers: op, payload: { status: 'doing' } });
    const reopened = await app.inject({ url: '/api/rooms/hhdh' });
    expect(reopened.json().room.deliveredDate).toBeNull();
    expect(reopened.json().room.phase).toBe('present');
  });

  it('子项写入后可按日期推导启动时间', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/rooms/my1a/stages/0/fields', headers: op, payload: { itemId: 'ko-plan', value: '2026-11-11' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().room.startDate).toBe('2026-11-11');
  });

  it('阶段登记 meta 可写入并读回', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/rooms/syd2a/stages/3/meta', headers: op, payload: { key: 'owner', value: '曲强' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().room.stages[3].meta.owner).toBe('曲强');
    const cleared = await app.inject({ method: 'PATCH', url: '/api/rooms/syd2a/stages/3/meta', headers: op, payload: { key: 'owner', value: '' } });
    expect(cleared.json().room.stages[3].meta.owner).toBeUndefined();
  });

  it('非法状态与不存在的子项返回 400', async () => {
    const bad = await app.inject({ method: 'PUT', url: '/api/rooms/wlby/stages/0', headers: op, payload: { status: 'nope' } });
    expect(bad.statusCode).toBe(400);
    const badItem = await app.inject({ method: 'PATCH', url: '/api/rooms/wlby/stages/0/fields', headers: op, payload: { itemId: 'not-exist', value: 'x' } });
    expect(badItem.statusCode).toBe(400);
  });

  it('环境项状态可轮转，模板项不可删除', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/rooms/syd2a/env/kelemetry', headers: op, payload: { status: 'done' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().room.envItems.find((i: any) => i.key === 'kelemetry').status).toBe('done');
    const del = await app.inject({ method: 'DELETE', url: '/api/rooms/syd2a/env/kelemetry', headers: op });
    expect(del.statusCode).toBe(400);
  });

  it('自定义环境项可增可删', async () => {
    const add = await app.inject({ method: 'POST', url: '/api/rooms/syd2a/env', headers: op, payload: { name: '自定义项', category: '其他' } });
    expect(add.statusCode).toBe(201);
    const key = add.json().room.envItems.find((i: any) => i.name === '自定义项').key;
    const del = await app.inject({ method: 'DELETE', url: `/api/rooms/syd2a/env/${key}`, headers: op });
    expect(del.statusCode).toBe(200);
    expect(del.json().room.envItems.some((i: any) => i.key === key)).toBe(false);
  });
});

describe('集群写接口', () => {
  it('登记集群后出现在机房与列表接口', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/rooms/syd2a/clusters', headers: op, payload: { name: 'test-cluster-syd2a', type: '训练', tenant: 'Seed', owner: '测试员' } });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.clusters.some((c: any) => c.name === 'test-cluster-syd2a')).toBe(true);
    const list = await app.inject({ url: '/api/clusters?roomId=syd2a' });
    expect(list.json().some((c: any) => c.name === 'test-cluster-syd2a')).toBe(true);
  });

  it('推进六个环节后自动标记交付日期', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/rooms/wlby/clusters', headers: op, payload: { name: 'test-delivery-flow', type: '推理', tenant: 'TCE', owner: '测试员' } });
    const id = created.json().clusters.find((c: any) => c.name === 'test-delivery-flow').id;
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({ method: 'PUT', url: `/api/clusters/${id}/delivery/${i}`, headers: op, payload: { status: 'done' } });
      expect(res.statusCode).toBe(200);
    }
    const detail = await app.inject({ url: `/api/clusters/${id}` });
    const cluster = detail.json().cluster;
    expect(cluster.status).toBe('delivered');
    expect(cluster.phase).toBe('past');
    expect(cluster.deliveredDate).toBe('2026-10-24');
  });

  it('勾选子项会把待处理环节推进为进行中', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/rooms/wlby/clusters', headers: op, payload: { name: 'test-check-flow', type: '训练', tenant: 'Seed', owner: '测试员' } });
    const id = created.json().clusters.find((c: any) => c.name === 'test-check-flow').id;
    const res = await app.inject({ method: 'PATCH', url: `/api/clusters/${id}/delivery/0/checks`, headers: op, payload: { key: 'scene', value: true } });
    expect(res.statusCode).toBe(200);
    expect(res.json().cluster.delivery[0].status).toBe('doing');
    expect(res.json().cluster.delivery[0].checks.scene).toBe(true);
  });

  it('更新集群后可写入阻塞与风险', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/clusters/wlby-panda', headers: op, payload: { blocker: '新的阻塞', risk: { level: 'err', short: '网络', text: '网络未就绪' } } });
    expect(res.statusCode).toBe(200);
    expect(res.json().cluster.blocker).toBe('新的阻塞');
    expect(res.json().cluster.risk.level).toBe('err');
  });

  it('重命名集群会拒绝同机房重名', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/clusters/wlby-core', headers: op, payload: { name: 'phlox-wlby' } });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('duplicate_cluster_name');
  });

  it('非法日期被拒绝', async () => {
    const stage = await app.inject({ method: 'PATCH', url: '/api/rooms/wlby/stages/0/fields', headers: op, payload: { itemId: 'ko-plan', value: '2026-13-45' } });
    expect(stage.statusCode).toBe(400);
    const cluster = await app.inject({ method: 'PATCH', url: '/api/clusters/wlby-core', headers: op, payload: { startDate: '2026-02-31' } });
    expect(cluster.statusCode).toBe(400);
  });

  it('audit limit 非法时返回 400', async () => {
    const res = await app.inject({ url: '/api/audit?limit=abc' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_limit');
  });

  it('删除机房级联删除集群', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/rooms', headers: op, payload: { name: '待删除机房' } });
    const roomId = created.json().room.id;
    await app.inject({ method: 'POST', url: `/api/rooms/${roomId}/clusters`, headers: op, payload: { name: 'cascade-me' } });
    const del = await app.inject({ method: 'DELETE', url: `/api/rooms/${roomId}`, headers: op });
    expect(del.statusCode).toBe(200);
    const clusters = await app.inject({ url: '/api/clusters' });
    expect(clusters.json().some((c: any) => c.name === 'cascade-me')).toBe(false);
  });
});

describe('批次与导出', () => {
  it('批次返回成员与派生进度', async () => {
    const res = await app.inject({ url: '/api/batches?roomId=wlby' });
    expect(res.statusCode).toBe(200);
    const batches = res.json();
    expect(batches.length).toBeGreaterThan(0);
    const withMembers = batches.find((b: any) => b.recorded > 0);
    expect(withMembers.members.length).toBe(withMembers.recorded);
  });

  it('CSV 带 BOM 与表头', async () => {
    const res = await app.inject({ url: '/api/export/clusters.csv?area=cn' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body.charCodeAt(0)).toBe(0xfeff);
    expect(res.body).toContain('机房,集群,集群组');
  });
});
