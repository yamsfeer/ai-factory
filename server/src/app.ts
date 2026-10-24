import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ClusterView, RoomView } from '../../shared/types.ts';
import { CLUSTER_STAGES, ENV_TEMPLATES, ROOM_STAGES } from '../../shared/stages.ts';
import { todayISO, toClusterView, toRoomView } from '../../shared/domain.ts';
import {
  clusterViews,
  loadBatches,
  loadClusters,
  loadRooms,
  listAudit,
  openDb,
  roomViews,
  seedDb,
  writeAudit,
  type DB,
} from './db.ts';

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const STAGE_STATUS = z.enum(['todo', 'doing', 'done', 'skip']);
const ENV_STATUS = z.enum(['pending', 'doing', 'done', 'skip']);
const AREA = z.enum(['cn', 'overseas']);

const operatorOf = (headers: Record<string, unknown>): string => {
  const raw = headers['x-operator'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || !value.trim()) return '未署名';
  try {
    return decodeURIComponent(value).trim().slice(0, 40) || '未署名';
  } catch {
    return value.trim().slice(0, 40);
  }
};

const isCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const dateString = z.string().refine(isCalendarDate, '日期必须是有效的 YYYY-MM-DD');

function roomDetail(db: DB, id: string, today: string) {
  const room = loadRooms(db).find((r) => r.id === id);
  if (!room) throw new ApiError(404, 'room_not_found', '机房不存在');
  const allClusters = loadClusters(db);
  const view = toRoomView(room, allClusters, today);
  const clusters = allClusters.filter((c) => c.roomId === id).map((c) => toClusterView(c, room.name, today));
  let risk: { level: 'warn' | 'err'; text: string } | null = null;
  const live = clusters.filter((c) => c.phase !== 'future');
  if (view.phase !== 'past' && live.length > 0) {
    risk = { level: 'warn', text: `机房仍在建设中，但已有 ${live.length} 个集群进入交付` };
  }
  return { room: view, clusters, audit: listAudit(db, 'room', id, 20), risk };
}

function clusterDetail(db: DB, id: string, today: string) {
  const cluster = loadClusters(db).find((c) => c.id === id);
  if (!cluster) throw new ApiError(404, 'cluster_not_found', '集群不存在');
  const room = loadRooms(db).find((r) => r.id === cluster.roomId);
  return { cluster: toClusterView(cluster, room?.name ?? '未知机房', today), audit: listAudit(db, 'cluster', id, 20) };
}

function matchesQuery(room: RoomView, clusters: ClusterView[], q: string): boolean {
  const text = [room.name, room.vdc ?? '', room.region, room.owner, room.line, ...room.tenants, ...clusters.map((c) => c.name)].join(' ').toLowerCase();
  return text.includes(q);
}

function filterRooms(db: DB, today: string, params: URLSearchParams): RoomView[] {
  const area = params.get('area') || '';
  const type = params.get('type') || '';
  const tenant = params.get('tenant') || '';
  const rawPhase = params.get('phase') || '';
  const phase = rawPhase === 'all' ? '' : rawPhase;
  const query = (params.get('query') || '').trim().toLowerCase();
  const narrowed = Boolean(type || tenant);
  const allClusters = clusterViews(db, today);
  return roomViews(db, today)
    .map((room) => {
      const mine = allClusters.filter((c) => c.roomId === room.id);
      const scoped = mine.filter((c) => (!type || c.type === type) && (!tenant || c.tenant === tenant));
      if (!narrowed) return { room, mine, scoped };
      const byStatus = (status: string) => scoped.filter((c) => c.status === status).length;
      const delivered = byStatus('delivered');
      const planned = room.summary.planned;
      return {
        room: {
          ...room,
          summary: {
            recorded: scoped.length,
            planned,
            delivered,
            blocked: byStatus('blocked'),
            building: scoped.filter((c) => c.status === 'building' || c.status === 'pending').length,
            pending: byStatus('pending'),
            plannedClusters: byStatus('planned'),
            pct: planned && planned > 0 ? Math.round((delivered / planned) * 100) : null,
            narrowed: true,
          },
        },
        mine,
        scoped,
      };
    })
    .filter(({ room }) => !area || room.area === area)
    .filter(({ room, scoped }) => !narrowed || scoped.length > 0 || (Boolean(tenant) && room.tenants.includes(tenant)))
    .filter(({ room }) => !phase || room.phase === phase)
    .filter(({ room, mine }) => !query || matchesQuery(room, mine, query))
    .map(({ room }) => room);
}

function filterClusters(db: DB, today: string, params: URLSearchParams): ClusterView[] {
  const area = params.get('area') || '';
  const roomId = params.get('roomId') || '';
  const type = params.get('type') || '';
  const tenant = params.get('tenant') || '';
  const status = params.get('status') || '';
  const origin = params.get('origin') || '';
  const query = (params.get('query') || '').trim().toLowerCase();
  const rooms = new Map(loadRooms(db).map((r) => [r.id, r]));
  return clusterViews(db, today)
    .filter((c) => !roomId || c.roomId === roomId)
    .filter((c) => !area || rooms.get(c.roomId)?.area === area)
    .filter((c) => !type || c.type === type)
    .filter((c) => !tenant || c.tenant === tenant || rooms.get(c.roomId)?.tenants.includes(tenant))
    .filter((c) => !status || c.status === status)
    .filter((c) => !origin || origin === 'all' || c.origin === origin)
    .filter((c) => !query || [c.name, c.roomName, c.owner, c.tenant, c.blocker, c.next].join(' ').toLowerCase().includes(query));
}

function batchViews(db: DB, today: string, params: URLSearchParams) {
  const roomId = params.get('roomId') || '';
  const area = params.get('area') || '';
  const type = params.get('type') || '';
  const rooms = new Map(loadRooms(db).map((r) => [r.id, r]));
  const clusters = clusterViews(db, today);
  return loadBatches(db)
    .filter((b) => !roomId || b.roomId === roomId)
    .filter((b) => !area || rooms.get(b.roomId)?.area === area)
    .filter((b) => !type || b.type === type)
    .map((batch) => {
      const members = clusters.filter((c) => c.batchId === batch.id);
      const delivered = members.filter((c) => c.status === 'delivered').length;
      const blocked = members.filter((c) => c.status === 'blocked').length;
      const allPast = members.length > 0 && members.every((c) => c.phase === 'past');
      const future = batch.startDate ? batch.startDate > today : members.every((c) => c.phase === 'future');
      return {
        ...batch,
        roomName: rooms.get(batch.roomId)?.name ?? '未知机房',
        members,
        recorded: members.length,
        delivered,
        blocked,
        pct: batch.planCount > 0 ? Math.round((delivered / batch.planCount) * 100) : null,
        state: allPast ? ('past' as const) : future ? ('future' as const) : ('present' as const),
      };
    });
}

const CSV_HEADERS = ['机房', '集群', '集群组', '类型', '业务方', '负责人', 'VDC', '交付阶段', '状态', '开始日期', '计划完成', '实际交付', '耗时(天)', 'SLA(天)', '超期(天)', '阻塞', '下一步', '交付来源'];
const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export async function buildApp(options: { dbPath?: string; today?: string } = {}): Promise<{ app: FastifyInstance; db: DB }> {
  const db = openDb(options.dbPath ?? process.env.DB_PATH ?? 'data/app.db');
  if (process.env.SEED_ON_START !== '0') seedDb(db);

  const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 });
  const today = () => options.today ?? todayISO();
  // 允许 DELETE / 无 body 的请求携带 application/json（浏览器与 curl 常见）。
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const text = String(body ?? '').trim();
    if (!text) return done(null, {});
    try {
      done(null, JSON.parse(text));
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send({ error: { code: error.code, message: error.message } });
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: { code: 'invalid_payload', message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') } });
    }
    if ((error as any).statusCode === 409) return reply.status(409).send({ error: { code: 'conflict', message: (error as Error).message } });
    return reply.status(500).send({ error: { code: 'internal_error', message: (error as Error).message } });
  });

  app.get('/api/health', async () => ({ ok: true, today: today() }));

  app.get('/api/bootstrap', async (request) => {
    const rooms = loadRooms(db);
    const clusters = loadClusters(db);
    const owners = [...new Set([...rooms.map((r) => r.owner), ...clusters.map((c) => c.owner)].filter(Boolean))].sort();
    return {
      today: today(),
      operator: operatorOf(request.headers as any),
      stages: { room: ROOM_STAGES, cluster: CLUSTER_STAGES, envTemplates: ENV_TEMPLATES },
      options: {
        areas: [
          { value: 'cn', label: '中国' },
          { value: 'overseas', label: '非中' },
        ],
        lines: [...new Set(rooms.map((r) => r.line))],
        types: [...new Set(clusters.map((c) => c.type))],
        tenants: [...new Set([...rooms.flatMap((r) => r.tenants), ...clusters.map((c) => c.tenant)])].sort(),
        owners,
      },
    };
  });

  app.get('/api/rooms', async (request) => {
    const params = new URLSearchParams(request.query as Record<string, string>);
    return filterRooms(db, today(), params);
  });

  app.get('/api/rooms/:id', async (request) => {
    const { id } = request.params as { id: string };
    return roomDetail(db, id, today());
  });

  app.post('/api/rooms', async (request, reply) => {
    const body = z
      .object({
        name: z.string().trim().min(1, '机房项目名必填').max(40),
        area: AREA.default('cn'),
        region: z.string().trim().max(40).optional(),
        vdc: z.string().trim().max(20).nullable().optional(),
        line: z.string().trim().max(10).default('混合'),
        tenants: z.array(z.string().trim().max(20)).default([]),
        owner: z.string().trim().max(20).default('待确认'),
        planCount: z.number().int().min(0).nullable().optional(),
        note: z.string().trim().max(200).default(''),
        fields: z.record(z.string(), z.string()).default({}),
      })
      .safeParse(request.body);
    if (!body.success) throw body.error;
    const input = body.data;
    const dup = db.prepare('SELECT id FROM rooms WHERE name = ?').get(input.name);
    if (dup) throw new ApiError(409, 'duplicate_room_name', '已存在同名机房');
    const id = `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO rooms (id,name,area,region,vdc,line,tenants,owner,plan_count,note,blocker,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, input.name, input.area, input.region ?? '待确认', input.vdc ?? null, input.line, JSON.stringify(input.tenants), input.owner, input.planCount ?? null, input.note, '', now, now);
      const insertStage = db.prepare('INSERT INTO room_stages (room_id,stage_index,status,fields,meta) VALUES (?,?,?,?,?)');
      ROOM_STAGES.forEach((def, index) => {
        const fields: Record<string, string> = {};
        for (const item of def.items) {
          if (index === 0 && input.fields[item.id]) fields[item.id] = input.fields[item.id];
        }
        insertStage.run(id, index, 'todo', JSON.stringify(fields), '{}');
      });
      const insertEnv = db.prepare('INSERT INTO room_env_items (room_id,key,name,category,status,custom,sort) VALUES (?,?,?,?,?,?,?)');
      ENV_TEMPLATES.forEach((tpl, i) => insertEnv.run(id, tpl.key, tpl.name, tpl.category, 'pending', 0, i));
      writeAudit(db, operatorOf(request.headers as any), 'room', id, 'create_room', { name: input.name });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    reply.status(201);
    return roomDetail(db, id, today());
  });

  app.patch('/api/rooms/:id', async (request) => {
    const { id } = request.params as { id: string };
    const existing = loadRooms(db).find((r) => r.id === id);
    if (!existing) throw new ApiError(404, 'room_not_found', '机房不存在');
    const body = z
      .object({
        name: z.string().trim().min(1).max(40).optional(),
        area: AREA.optional(),
        region: z.string().trim().max(40).optional(),
        vdc: z.string().trim().max(20).nullable().optional(),
        line: z.string().trim().max(10).optional(),
        tenants: z.array(z.string().trim().max(20)).optional(),
        owner: z.string().trim().max(20).optional(),
        planCount: z.number().int().min(0).nullable().optional(),
        note: z.string().trim().max(200).optional(),
        blocker: z.string().trim().max(200).optional(),
      })
      .safeParse(request.body);
    if (!body.success) throw body.error;
    if (body.data.name && body.data.name !== existing.name) {
      const dup = db.prepare('SELECT id FROM rooms WHERE name = ? AND id <> ?').get(body.data.name, id);
      if (dup) throw new ApiError(409, 'duplicate_room_name', '已存在同名机房');
    }
    const patch = body.data;
    db.prepare('UPDATE rooms SET name=?, area=?, region=?, vdc=?, line=?, tenants=?, owner=?, plan_count=?, note=?, blocker=?, updated_at=? WHERE id=?')
      .run(
        patch.name ?? existing.name,
        patch.area ?? existing.area,
        patch.region ?? existing.region,
        patch.vdc !== undefined ? patch.vdc : existing.vdc,
        patch.line ?? existing.line,
        JSON.stringify(patch.tenants ?? existing.tenants),
        patch.owner ?? existing.owner,
        patch.planCount !== undefined ? patch.planCount : existing.planCount,
        patch.note ?? existing.note,
        patch.blocker ?? existing.blocker,
        new Date().toISOString(),
        id,
      );
    writeAudit(db, operatorOf(request.headers as any), 'room', id, 'update_room', patch);
    return roomDetail(db, id, today());
  });

  app.delete('/api/rooms/:id', async (request) => {
    const { id } = request.params as { id: string };
    const existing = loadRooms(db).find((r) => r.id === id);
    if (!existing) throw new ApiError(404, 'room_not_found', '机房不存在');
    db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    writeAudit(db, operatorOf(request.headers as any), 'room', id, 'delete_room', { name: existing.name });
    return { ok: true };
  });

  app.put('/api/rooms/:id/stages/:index', async (request) => {
    const { id, index } = request.params as { id: string; index: string };
    const existing = loadRooms(db).find((r) => r.id === id);
    if (!existing) throw new ApiError(404, 'room_not_found', '机房不存在');
    const stageIndex = Number(index);
    if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 5) throw new ApiError(400, 'invalid_stage', '阶段下标必须是 0-5');
    const body = z.object({ status: STAGE_STATUS }).safeParse(request.body);
    if (!body.success) throw body.error;
    const stage = existing.stages.find((s) => s.index === stageIndex);
    const fields = { ...(stage?.fields ?? {}) };
    if (stageIndex === 5 && (body.data.status === 'done' || body.data.status === 'skip') && !fields['acceptance']) fields['acceptance'] = today();
    db.prepare('UPDATE room_stages SET status=?, fields=? WHERE room_id=? AND stage_index=?')
      .run(body.data.status, JSON.stringify(fields), id, stageIndex);
    db.prepare('UPDATE rooms SET updated_at=? WHERE id=?').run(new Date().toISOString(), id);
    writeAudit(db, operatorOf(request.headers as any), 'room', id, 'set_stage_status', { stageIndex, status: body.data.status });
    return roomDetail(db, id, today());
  });

  app.patch('/api/rooms/:id/stages/:index/fields', async (request) => {
    const { id, index } = request.params as { id: string; index: string };
    const existing = loadRooms(db).find((r) => r.id === id);
    if (!existing) throw new ApiError(404, 'room_not_found', '机房不存在');
    const stageIndex = Number(index);
    const def = ROOM_STAGES[stageIndex];
    if (!def) throw new ApiError(400, 'invalid_stage', '阶段不存在');
    const body = z.object({ itemId: z.string(), value: z.string().max(400) }).safeParse(request.body);
    if (!body.success) throw body.error;
    const itemDef = def.items.find((item) => item.id === body.data.itemId);
    if (!itemDef) throw new ApiError(400, 'invalid_item', '该阶段没有这个子项');
    if (itemDef.type === 'date' && body.data.value.trim() && !isCalendarDate(body.data.value.trim())) {
      throw new ApiError(400, 'invalid_date', `${itemDef.label}必须是有效日期（YYYY-MM-DD）`);
    }
    const stage = existing.stages.find((s) => s.index === stageIndex);
    const fields = { ...(stage?.fields ?? {}) };
    if (body.data.value.trim()) fields[body.data.itemId] = body.data.value.trim();
    else delete fields[body.data.itemId];
    db.prepare('UPDATE room_stages SET fields=? WHERE room_id=? AND stage_index=?').run(JSON.stringify(fields), id, stageIndex);
    db.prepare('UPDATE rooms SET updated_at=? WHERE id=?').run(new Date().toISOString(), id);
    writeAudit(db, operatorOf(request.headers as any), 'room', id, 'set_stage_field', { stageIndex, itemId: body.data.itemId, value: body.data.value });
    return roomDetail(db, id, today());
  });

  app.patch('/api/rooms/:id/stages/:index/meta', async (request) => {
    const { id, index } = request.params as { id: string; index: string };
    const existing = loadRooms(db).find((r) => r.id === id);
    if (!existing) throw new ApiError(404, 'room_not_found', '机房不存在');
    const stageIndex = Number(index);
    if (!ROOM_STAGES[stageIndex]) throw new ApiError(400, 'invalid_stage', '阶段不存在');
    const body = z.object({ key: z.enum(['owner', 'plan', 'done', 'note']), value: z.string().max(300) }).safeParse(request.body);
    if (!body.success) throw body.error;
    const stage = existing.stages.find((s) => s.index === stageIndex);
    const meta = { ...(stage?.meta ?? {}) };
    if (body.data.value.trim()) meta[body.data.key] = body.data.value.trim();
    else delete meta[body.data.key];
    db.prepare('UPDATE room_stages SET meta=? WHERE room_id=? AND stage_index=?').run(JSON.stringify(meta), id, stageIndex);
    db.prepare('UPDATE rooms SET updated_at=? WHERE id=?').run(new Date().toISOString(), id);
    writeAudit(db, operatorOf(request.headers as any), 'room', id, 'set_stage_meta', { stageIndex, ...body.data });
    return roomDetail(db, id, today());
  });

  app.put('/api/rooms/:id/env/:key', async (request) => {
    const { id, key } = request.params as { id: string; key: string };
    const existing = loadRooms(db).find((r) => r.id === id);
    if (!existing) throw new ApiError(404, 'room_not_found', '机房不存在');
    const item = existing.envItems.find((e) => e.key === key);
    if (!item) throw new ApiError(404, 'env_item_not_found', '环境项不存在');
    const body = z.object({ status: ENV_STATUS }).safeParse(request.body);
    if (!body.success) throw body.error;
    db.prepare('UPDATE room_env_items SET status=? WHERE room_id=? AND key=?').run(body.data.status, id, key);
    writeAudit(db, operatorOf(request.headers as any), 'env', `${id}:${key}`, 'set_env_status', { status: body.data.status });
    return roomDetail(db, id, today());
  });

  app.post('/api/rooms/:id/env', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = loadRooms(db).find((r) => r.id === id);
    if (!existing) throw new ApiError(404, 'room_not_found', '机房不存在');
    const body = z.object({ name: z.string().trim().min(1).max(60), category: z.string().trim().max(20).default('其他') }).safeParse(request.body);
    if (!body.success) throw body.error;
    const key = `custom-${Date.now().toString(36)}`;
    const sort = existing.envItems.length;
    db.prepare('INSERT INTO room_env_items (room_id,key,name,category,status,custom,sort) VALUES (?,?,?,?,?,?,?)')
      .run(id, key, body.data.name, body.data.category || '其他', 'pending', 1, sort);
    writeAudit(db, operatorOf(request.headers as any), 'env', `${id}:${key}`, 'add_env_item', body.data);
    reply.status(201);
    return roomDetail(db, id, today());
  });

  app.delete('/api/rooms/:id/env/:key', async (request) => {
    const { id, key } = request.params as { id: string; key: string };
    const existing = loadRooms(db).find((r) => r.id === id);
    if (!existing) throw new ApiError(404, 'room_not_found', '机房不存在');
    const item = existing.envItems.find((e) => e.key === key);
    if (!item) throw new ApiError(404, 'env_item_not_found', '环境项不存在');
    if (!item.custom) throw new ApiError(400, 'env_item_not_custom', '模板环境项不能删除，只能修改状态');
    db.prepare('DELETE FROM room_env_items WHERE room_id=? AND key=?').run(id, key);
    writeAudit(db, operatorOf(request.headers as any), 'env', `${id}:${key}`, 'delete_env_item', { name: item.name });
    return roomDetail(db, id, today());
  });

  app.post('/api/rooms/:id/clusters', async (request, reply) => {
    const { id } = request.params as { id: string };
    const room = loadRooms(db).find((r) => r.id === id);
    if (!room) throw new ApiError(404, 'room_not_found', '机房不存在');
    const body = z
      .object({
        name: z.string().trim().min(1).max(60),
        type: z.string().trim().min(1).max(10).default('训练'),
        tenant: z.string().trim().max(20).default('待确认'),
        owner: z.string().trim().max(20).default('待确认'),
        vdc: z.string().trim().max(20).nullable().optional(),
        startDate: dateString.nullable().optional(),
        planEndDate: dateString.nullable().optional(),
        group: z.string().trim().max(30).nullable().optional(),
        slaDays: z.number().int().min(0).nullable().optional(),
        batchId: z.string().trim().nullable().optional(),
        origin: z.enum(['new-first', 'existing-add']).default('new-first'),
      })
      .safeParse(request.body);
    if (!body.success) throw body.error;
    const input = body.data;
    if (loadClusters(db).some((c) => c.roomId === id && c.name === input.name)) throw new ApiError(409, 'duplicate_cluster_name', '该机房下已有同名集群');
    const clusterId = `clu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO clusters (id,room_id,batch_id,name,group_name,type,tenant,owner,vdc,start_date,plan_end_date,delivered_date,sla_days,blocker,next,risk,origin,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(clusterId, id, input.batchId ?? null, input.name, input.group ?? null, input.type, input.tenant, input.owner, input.vdc ?? room.vdc, input.startDate ?? null, input.planEndDate ?? null, null, input.slaDays ?? null, '', '推进集群六阶段建设', null, input.origin, now, now);
      const insertStage = db.prepare('INSERT INTO delivery_stages (cluster_id,stage_index,status,checks) VALUES (?,?,?,?)');
      CLUSTER_STAGES.forEach((def, index) => {
        const checks: Record<string, boolean> = {};
        def.subItems.forEach((item) => (checks[item.key] = false));
        insertStage.run(clusterId, index, 'todo', JSON.stringify(checks));
      });
      writeAudit(db, operatorOf(request.headers as any), 'cluster', clusterId, 'create_cluster', { roomId: id, name: input.name });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    reply.status(201);
    return roomDetail(db, id, today());
  });

  app.get('/api/clusters', async (request) => {
    const params = new URLSearchParams(request.query as Record<string, string>);
    return filterClusters(db, today(), params);
  });

  app.get('/api/clusters/:id', async (request) => {
    const { id } = request.params as { id: string };
    return clusterDetail(db, id, today());
  });

  app.patch('/api/clusters/:id', async (request) => {
    const { id } = request.params as { id: string };
    const existing = loadClusters(db).find((c) => c.id === id);
    if (!existing) throw new ApiError(404, 'cluster_not_found', '集群不存在');
    const body = z
      .object({
        name: z.string().trim().min(1).max(60).optional(),
        type: z.string().trim().max(10).optional(),
        tenant: z.string().trim().max(20).optional(),
        owner: z.string().trim().max(20).optional(),
        vdc: z.string().trim().max(20).nullable().optional(),
        group: z.string().trim().max(30).nullable().optional(),
        startDate: dateString.nullable().optional(),
        planEndDate: dateString.nullable().optional(),
        deliveredDate: dateString.nullable().optional(),
        slaDays: z.number().int().min(0).nullable().optional(),
        blocker: z.string().trim().max(200).optional(),
        next: z.string().trim().max(200).optional(),
        risk: z.object({ level: z.enum(['warn', 'err']), short: z.string().max(20), text: z.string().max(200) }).nullable().optional(),
        batchId: z.string().trim().nullable().optional(),
      })
      .safeParse(request.body);
    if (!body.success) throw body.error;
    const p = body.data;
    if (p.name && p.name !== existing.name) {
      const dup = db.prepare('SELECT id FROM clusters WHERE room_id = ? AND name = ? AND id <> ?').get(existing.roomId, p.name, id);
      if (dup) throw new ApiError(409, 'duplicate_cluster_name', '该机房下已有同名集群');
    }
    db.prepare('UPDATE clusters SET name=?, type=?, tenant=?, owner=?, vdc=?, group_name=?, start_date=?, plan_end_date=?, delivered_date=?, sla_days=?, blocker=?, next=?, risk=?, batch_id=?, updated_at=? WHERE id=?')
      .run(
        p.name ?? existing.name,
        p.type ?? existing.type,
        p.tenant ?? existing.tenant,
        p.owner ?? existing.owner,
        p.vdc !== undefined ? p.vdc : existing.vdc,
        p.group !== undefined ? p.group : existing.group,
        p.startDate !== undefined ? p.startDate : existing.startDate,
        p.planEndDate !== undefined ? p.planEndDate : existing.planEndDate,
        p.deliveredDate !== undefined ? p.deliveredDate : existing.deliveredDate,
        p.slaDays !== undefined ? p.slaDays : existing.slaDays,
        p.blocker ?? existing.blocker,
        p.next ?? existing.next,
        p.risk !== undefined ? (p.risk ? JSON.stringify(p.risk) : null) : existing.risk ? JSON.stringify(existing.risk) : null,
        p.batchId !== undefined ? p.batchId : existing.batchId,
        new Date().toISOString(),
        id,
      );
    writeAudit(db, operatorOf(request.headers as any), 'cluster', id, 'update_cluster', p);
    return clusterDetail(db, id, today());
  });

  app.delete('/api/clusters/:id', async (request) => {
    const { id } = request.params as { id: string };
    const existing = loadClusters(db).find((c) => c.id === id);
    if (!existing) throw new ApiError(404, 'cluster_not_found', '集群不存在');
    db.prepare('DELETE FROM clusters WHERE id=?').run(id);
    writeAudit(db, operatorOf(request.headers as any), 'cluster', id, 'delete_cluster', { name: existing.name });
    return { ok: true };
  });

  app.put('/api/clusters/:id/delivery/:index', async (request) => {
    const { id, index } = request.params as { id: string; index: string };
    const existing = loadClusters(db).find((c) => c.id === id);
    if (!existing) throw new ApiError(404, 'cluster_not_found', '集群不存在');
    const stageIndex = Number(index);
    if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 5) throw new ApiError(400, 'invalid_stage', '环节下标必须是 0-5');
    const body = z.object({ status: STAGE_STATUS }).safeParse(request.body);
    if (!body.success) throw body.error;
    const stage = existing.delivery.find((s) => s.index === stageIndex);
    const checks = { ...(stage?.checks ?? {}) };
    const def = CLUSTER_STAGES[stageIndex];
    if (body.data.status === 'done') def.subItems.forEach((item) => (checks[item.key] = true));
    db.prepare('UPDATE delivery_stages SET status=?, checks=? WHERE cluster_id=? AND stage_index=?')
      .run(body.data.status, JSON.stringify(checks), id, stageIndex);
    const stages = existing.delivery.map((s) => (s.index === stageIndex ? { ...s, status: body.data.status } : s));
    const allDone = stages.every((s) => s.status === 'done' || s.status === 'skip');
    const deliveredDate = allDone ? existing.deliveredDate ?? today() : null;
    db.prepare('UPDATE clusters SET delivered_date=?, updated_at=? WHERE id=?').run(deliveredDate, new Date().toISOString(), id);
    writeAudit(db, operatorOf(request.headers as any), 'cluster', id, 'set_delivery_status', { stageIndex, status: body.data.status });
    return clusterDetail(db, id, today());
  });

  app.patch('/api/clusters/:id/delivery/:index/checks', async (request) => {
    const { id, index } = request.params as { id: string; index: string };
    const existing = loadClusters(db).find((c) => c.id === id);
    if (!existing) throw new ApiError(404, 'cluster_not_found', '集群不存在');
    const stageIndex = Number(index);
    if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 5) throw new ApiError(400, 'invalid_stage', '环节下标必须是 0-5');
    const def = CLUSTER_STAGES[stageIndex];
    const body = z.object({ key: z.string(), value: z.boolean() }).safeParse(request.body);
    if (!body.success) throw body.error;
    if (!def.subItems.some((item) => item.key === body.data.key)) throw new ApiError(400, 'invalid_item', '该环节没有这个子项');
    const stage = existing.delivery.find((s) => s.index === stageIndex);
    const checks = { ...(stage?.checks ?? {}), [body.data.key]: body.data.value };
    const allChecked = def.subItems.every((item) => checks[item.key]);
    let status = stage?.status ?? 'todo';
    if (allChecked && status === 'todo') status = 'doing';
    if (body.data.value && status === 'todo') status = 'doing';
    db.prepare('UPDATE delivery_stages SET status=?, checks=? WHERE cluster_id=? AND stage_index=?').run(status, JSON.stringify(checks), id, stageIndex);
    writeAudit(db, operatorOf(request.headers as any), 'cluster', id, 'set_delivery_check', { stageIndex, key: body.data.key, value: body.data.value });
    return clusterDetail(db, id, today());
  });

  app.get('/api/batches', async (request) => {
    const params = new URLSearchParams(request.query as Record<string, string>);
    return batchViews(db, today(), params);
  });

  app.post('/api/batches', async (request, reply) => {
    const body = z
      .object({
        roomId: z.string(),
        type: z.string().trim().max(10).default('训练'),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        planCount: z.number().int().min(1),
        owner: z.string().trim().max(20).default('待确认'),
        origin: z.string().trim().max(20).default('manual'),
      })
      .safeParse(request.body);
    if (!body.success) throw body.error;
    if (!loadRooms(db).some((r) => r.id === body.data.roomId)) throw new ApiError(404, 'room_not_found', '机房不存在');
    const id = `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    db.prepare('INSERT INTO batches (id,room_id,type,start_date,end_date,plan_count,owner,origin) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, body.data.roomId, body.data.type, body.data.startDate ?? null, body.data.endDate ?? null, body.data.planCount, body.data.owner, body.data.origin);
    writeAudit(db, operatorOf(request.headers as any), 'batch', id, 'create_batch', body.data);
    reply.status(201);
    return batchViews(db, today(), new URLSearchParams({ roomId: body.data.roomId })).find((b) => b.id === id);
  });

  app.patch('/api/batches/:id', async (request) => {
    const { id } = request.params as { id: string };
    const existing = loadBatches(db).find((b) => b.id === id);
    if (!existing) throw new ApiError(404, 'batch_not_found', '批次不存在');
    const body = z
      .object({
        type: z.string().trim().max(10).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        planCount: z.number().int().min(1).optional(),
        owner: z.string().trim().max(20).optional(),
      })
      .safeParse(request.body);
    if (!body.success) throw body.error;
    const p = body.data;
    db.prepare('UPDATE batches SET type=?, start_date=?, end_date=?, plan_count=?, owner=? WHERE id=?')
      .run(p.type ?? existing.type, p.startDate !== undefined ? p.startDate : existing.startDate, p.endDate !== undefined ? p.endDate : existing.endDate, p.planCount ?? existing.planCount, p.owner ?? existing.owner, id);
    writeAudit(db, operatorOf(request.headers as any), 'batch', id, 'update_batch', p);
    return batchViews(db, today(), new URLSearchParams()).find((b) => b.id === id);
  });

  app.get('/api/export/clusters.csv', async (request, reply) => {
    const params = new URLSearchParams(request.query as Record<string, string>);
    const rows = filterClusters(db, today(), params);
    const lines = [CSV_HEADERS.join(',')];
    for (const c of rows) {
      lines.push(
        [
          c.roomName,
          c.name,
          c.group,
          c.type,
          c.tenant,
          c.owner,
          c.vdc,
          c.stageIndex >= CLUSTER_STAGES.length ? '已完成' : CLUSTER_STAGES[c.stageIndex]?.name,
          c.status,
          c.startDate,
          c.planEndDate,
          c.deliveredDate,
          c.duration.actual,
          c.duration.sla,
          c.duration.over,
          c.blocker,
          c.next,
          c.origin === 'new-first' ? '新机房首批' : '存量机房扩容',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    reply.header('content-type', 'text/csv; charset=utf-8');
    reply.header('content-disposition', 'attachment; filename="clusters.csv"');
    return '\uFEFF' + lines.join('\r\n');
  });

  app.get('/api/audit', async (request) => {
    const params = new URLSearchParams(request.query as Record<string, string>);
    const parsed = z.coerce.number().int().min(1).max(200).default(50).safeParse(params.get('limit') ?? 50);
    if (!parsed.success) throw new ApiError(400, 'invalid_limit', 'limit 必须是 1-200 的整数');
    return listAudit(db, params.get('entity') ?? undefined, params.get('entityId') ?? undefined, parsed.data);
  });

  return { app, db };
}
