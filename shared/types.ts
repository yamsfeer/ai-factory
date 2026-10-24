/** 领域类型。术语见 GLOSSARY.md。 */

export type Area = 'cn' | 'overseas';
export type StageStatus = 'todo' | 'doing' | 'done' | 'skip';
export type EnvStatus = 'pending' | 'doing' | 'done' | 'skip';
export type Phase = 'past' | 'present' | 'future';
export type RoomStatus = 'delivered' | 'building' | 'blocked' | 'planned';
export type ClusterStatus = RoomStatus | 'pending';
export type FieldType = 'date' | 'person' | 'text' | 'check' | 'env';

export interface StageFieldDef {
  id: string;
  label: string;
  type: FieldType;
  desc?: string;
  placeholder?: string;
  wide?: boolean;
}

export interface RoomStageDef {
  key: string;
  name: string;
  meaning: string;
  panelTitle: string;
  panelHint: string;
  items: StageFieldDef[];
}

export interface ClusterStageDef {
  key: string;
  name: string;
  short: string;
  desc: string;
  baseline: number;
  subItems: { key: string; name: string; detail?: string[]; link?: boolean }[];
}

export interface EnvTemplateItem {
  key: string;
  name: string;
  category: string;
  scenes: string[];
}

export interface BuildoutStage {
  index: number;
  status: StageStatus;
  fields: Record<string, string>;
}

export interface DeliveryStage {
  index: number;
  status: StageStatus;
  checks: Record<string, boolean>;
}

export interface EnvItem {
  key: string;
  name: string;
  category: string;
  status: EnvStatus;
  custom: boolean;
  sort: number;
}

export interface Room {
  id: string;
  name: string;
  area: Area;
  region: string;
  vdc: string | null;
  line: string;
  tenants: string[];
  owner: string;
  planCount: number | null;
  note: string;
  blocker: string;
  stages: BuildoutStage[];
  envItems: EnvItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ClusterRisk {
  level: 'warn' | 'err';
  short: string;
  text: string;
}

export interface Cluster {
  id: string;
  roomId: string;
  batchId: string | null;
  name: string;
  group: string | null;
  type: string;
  tenant: string;
  owner: string;
  vdc: string | null;
  startDate: string | null;
  planEndDate: string | null;
  deliveredDate: string | null;
  slaDays: number | null;
  delivery: DeliveryStage[];
  blocker: string;
  next: string;
  risk: ClusterRisk | null;
  origin: string;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  roomId: string;
  type: string;
  startDate: string | null;
  endDate: string | null;
  planCount: number;
  owner: string;
  origin: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  operator: string;
  entity: 'room' | 'cluster' | 'env' | 'batch';
  entityId: string;
  action: string;
  detail: Record<string, unknown> | null;
}

/** 服务端返回的派生视图。 */
export interface RoomView extends Room {
  currentStage: number;
  phase: Phase;
  status: RoomStatus;
  startDate: string | null;
  targetDate: string | null;
  deliveredDate: string | null;
  duration: { planned: number | null; actual: number | null; over: number | null };
  stageProgress: {
    counts: Record<StageStatus, number>;
    completed: number;
    current: number;
  };
  summary: RoomSummaryCounts;
}

export interface RoomSummaryCounts {
  recorded: number;
  planned: number | null;
  delivered: number;
  blocked: number;
  building: number;
  pending: number;
  plannedClusters: number;
  pct: number | null;
  narrowed: boolean;
}

export interface ClusterView extends Cluster {
  phase: Phase;
  status: ClusterStatus;
  stageIndex: number;
  duration: { sla: number | null; actual: number | null; over: number | null };
  roomName: string;
  batchType: string | null;
}

export interface BatchView extends Batch {
  roomName: string;
  members: ClusterView[];
  recorded: number;
  delivered: number;
  blocked: number;
  pct: number | null;
  state: Phase;
}

export interface StageDefinitionPayload {
  room: RoomStageDef[];
  cluster: ClusterStageDef[];
  envTemplates: EnvTemplateItem[];
}

export interface BootstrapPayload {
  today: string;
  stages: StageDefinitionPayload;
  options: {
    areas: { value: Area; label: string }[];
    lines: string[];
    types: string[];
    tenants: string[];
    owners: string[];
  };
  operator: string;
}

export interface RoomDetailPayload {
  room: RoomView;
  clusters: ClusterView[];
  audit: AuditEntry[];
  risk: { level: 'warn' | 'err'; text: string } | null;
}

export interface ApiError {
  error: { code: string; message: string };
}
