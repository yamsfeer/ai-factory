import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type {
  Batch,
  BuildoutStage,
  Cluster,
  ClusterView,
  DeliveryStage,
  EnvItem,
  Room,
  RoomView,
} from '../../shared/types.ts';
import { buildSeed } from '../../shared/seed.ts';
import { todayISO, toClusterView, toRoomView } from '../../shared/domain.ts';

export type DB = DatabaseSync;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  area TEXT NOT NULL,
  region TEXT NOT NULL,
  vdc TEXT,
  line TEXT NOT NULL,
  tenants TEXT NOT NULL,
  owner TEXT NOT NULL,
  plan_count INTEGER,
  note TEXT NOT NULL DEFAULT '',
  blocker TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_stages (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  stage_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  fields TEXT NOT NULL,
  PRIMARY KEY (room_id, stage_index)
);

CREATE TABLE IF NOT EXISTS room_env_items (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  custom INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, key)
);

CREATE TABLE IF NOT EXISTS clusters (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  batch_id TEXT,
  name TEXT NOT NULL,
  group_name TEXT,
  type TEXT NOT NULL,
  tenant TEXT NOT NULL,
  owner TEXT NOT NULL,
  vdc TEXT,
  start_date TEXT,
  plan_end_date TEXT,
  delivered_date TEXT,
  sla_days INTEGER,
  blocker TEXT NOT NULL DEFAULT '',
  next TEXT NOT NULL DEFAULT '',
  risk TEXT,
  origin TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_stages (
  cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  stage_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  checks TEXT NOT NULL,
  PRIMARY KEY (cluster_id, stage_index)
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  plan_count INTEGER NOT NULL,
  owner TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  operator TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_clusters_room ON clusters(room_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
`;

export function openDb(file: string): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

export function isSeeded(db: DB): boolean {
  const row = db.prepare('SELECT COUNT(*) AS n FROM rooms').get() as { n: number };
  return row.n > 0;
}

export function seedDb(db: DB, force = false): void {
  if (isSeeded(db)) {
    if (!force) return;
    db.exec('DELETE FROM audit_log; DELETE FROM delivery_stages; DELETE FROM clusters; DELETE FROM room_env_items; DELETE FROM room_stages; DELETE FROM batches; DELETE FROM rooms;');
  }
  const { rooms, clusters, batches } = buildSeed();
  insertSeed(db, rooms, clusters, batches);
}

function insertSeed(db: DB, rooms: Room[], clusters: Cluster[], batches: Batch[]) {
  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    const insertRoom = db.prepare('INSERT INTO rooms (id,name,area,region,vdc,line,tenants,owner,plan_count,note,blocker,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const insertStage = db.prepare('INSERT INTO room_stages (room_id,stage_index,status,fields) VALUES (?,?,?,?)');
    const insertEnv = db.prepare('INSERT INTO room_env_items (room_id,key,name,category,status,custom,sort) VALUES (?,?,?,?,?,?,?)');
    for (const room of rooms) {
      insertRoom.run(room.id, room.name, room.area, room.region, room.vdc, room.line, JSON.stringify(room.tenants), room.owner, room.planCount, room.note, room.blocker, now, now);
      for (const stage of room.stages) insertStage.run(room.id, stage.index, stage.status, JSON.stringify(stage.fields));
      for (const item of room.envItems) insertEnv.run(room.id, item.key, item.name, item.category, item.status, item.custom ? 1 : 0, item.sort);
    }
    for (const batch of batches) {
      db.prepare('INSERT INTO batches (id,room_id,type,start_date,end_date,plan_count,owner,origin) VALUES (?,?,?,?,?,?,?,?)')
        .run(batch.id, batch.roomId, batch.type, batch.startDate, batch.endDate, batch.planCount, batch.owner, batch.origin);
    }
    const insertCluster = db.prepare('INSERT INTO clusters (id,room_id,batch_id,name,group_name,type,tenant,owner,vdc,start_date,plan_end_date,delivered_date,sla_days,blocker,next,risk,origin,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const insertDelivery = db.prepare('INSERT INTO delivery_stages (cluster_id,stage_index,status,checks) VALUES (?,?,?,?)');
    for (const cluster of clusters) {
      insertCluster.run(cluster.id, cluster.roomId, cluster.batchId, cluster.name, cluster.group, cluster.type, cluster.tenant, cluster.owner, cluster.vdc, cluster.startDate, cluster.planEndDate, cluster.deliveredDate, cluster.slaDays, cluster.blocker, cluster.next, cluster.risk ? JSON.stringify(cluster.risk) : null, cluster.origin, now, now);
      for (const stage of cluster.delivery) insertDelivery.run(cluster.id, stage.index, stage.status, JSON.stringify(stage.checks));
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export function loadRooms(db: DB): Room[] {
  const rows = db.prepare('SELECT * FROM rooms ORDER BY created_at ASC, id ASC').all() as any[];
  const stageRows = db.prepare('SELECT * FROM room_stages ORDER BY room_id, stage_index').all() as any[];
  const envRows = db.prepare('SELECT * FROM room_env_items ORDER BY room_id, sort, key').all() as any[];
  const stagesByRoom = new Map<string, BuildoutStage[]>();
  for (const row of stageRows) {
    const list = stagesByRoom.get(row.room_id) ?? [];
    list.push({ index: row.stage_index, status: row.status, fields: parseJson(row.fields, {}) });
    stagesByRoom.set(row.room_id, list);
  }
  const envByRoom = new Map<string, EnvItem[]>();
  for (const row of envRows) {
    const list = envByRoom.get(row.room_id) ?? [];
    list.push({ key: row.key, name: row.name, category: row.category, status: row.status, custom: Boolean(row.custom), sort: row.sort });
    envByRoom.set(row.room_id, list);
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    area: row.area,
    region: row.region,
    vdc: row.vdc,
    line: row.line,
    tenants: parseJson<string[]>(row.tenants, []),
    owner: row.owner,
    planCount: row.plan_count,
    note: row.note,
    blocker: row.blocker,
    stages: stagesByRoom.get(row.id) ?? [],
    envItems: envByRoom.get(row.id) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function loadClusters(db: DB): Cluster[] {
  const rows = db.prepare('SELECT * FROM clusters ORDER BY created_at ASC, id ASC').all() as any[];
  const stageRows = db.prepare('SELECT * FROM delivery_stages ORDER BY cluster_id, stage_index').all() as any[];
  const byCluster = new Map<string, DeliveryStage[]>();
  for (const row of stageRows) {
    const list = byCluster.get(row.cluster_id) ?? [];
    list.push({ index: row.stage_index, status: row.status, checks: parseJson(row.checks, {}) });
    byCluster.set(row.cluster_id, list);
  }
  return rows.map((row) => ({
    id: row.id,
    roomId: row.room_id,
    batchId: row.batch_id,
    name: row.name,
    group: row.group_name,
    type: row.type,
    tenant: row.tenant,
    owner: row.owner,
    vdc: row.vdc,
    startDate: row.start_date,
    planEndDate: row.plan_end_date,
    deliveredDate: row.delivered_date,
    slaDays: row.sla_days,
    delivery: byCluster.get(row.id) ?? [],
    blocker: row.blocker,
    next: row.next,
    risk: parseJson(row.risk, null),
    origin: row.origin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function loadBatches(db: DB): Batch[] {
  const rows = db.prepare('SELECT * FROM batches ORDER BY start_date, id').all() as any[];
  return rows.map((row) => ({
    id: row.id,
    roomId: row.room_id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    planCount: row.plan_count,
    owner: row.owner,
    origin: row.origin,
  }));
}

export function roomViews(db: DB, today = todayISO()): RoomView[] {
  const clusters = loadClusters(db);
  return loadRooms(db).map((room) => toRoomView(room, clusters, today));
}

export function clusterViews(db: DB, today = todayISO()): ClusterView[] {
  const rooms = loadRooms(db);
  const nameById = new Map(rooms.map((r) => [r.id, r.name]));
  return loadClusters(db).map((cluster) => toClusterView(cluster, nameById.get(cluster.roomId) ?? '未知机房', today));
}

export function writeAudit(db: DB, operator: string, entity: string, entityId: string, action: string, detail: unknown = null) {
  db.prepare('INSERT INTO audit_log (at, operator, entity, entity_id, action, detail) VALUES (?,?,?,?,?,?)')
    .run(new Date().toISOString(), operator, entity, entityId, action, JSON.stringify(detail));
}

export function listAudit(db: DB, entity?: string, entityId?: string, limit = 20) {
  const where: string[] = [];
  const args: unknown[] = [];
  if (entity) { where.push('entity = ?'); args.push(entity); }
  if (entityId) { where.push('entity_id = ?'); args.push(entityId); }
  const sql = `SELECT * FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`;
  const rows = db.prepare(sql).all(...(args as any[]), limit) as any[];
  return rows.map((row) => ({
    id: row.id,
    at: row.at,
    operator: row.operator,
    entity: row.entity,
    entityId: row.entity_id,
    action: row.action,
    detail: parseJson(row.detail, null),
  }));
}
