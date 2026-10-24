import type {
  Cluster,
  ClusterStatus,
  ClusterView,
  Phase,
  Room,
  RoomStageDef,
  RoomStatus,
  RoomSummaryCounts,
  RoomView,
  StageStatus,
} from './types.ts';
import { CLUSTER_STAGES, ROOM_STAGES } from './stages.ts';

export const PHASES: Phase[] = ['past', 'present', 'future'];

export function todayISO(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(now);
}

export function dayUTC(date: string | null | undefined): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const n = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(n) ? n : null;
}

export function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  const x = dayUTC(a);
  const y = dayUTC(b);
  if (x === null || y === null || y < x) return null;
  return Math.round((y - x) / 86400000);
}

export function roomStartDate(room: Room): string | null {
  return room.stages[0]?.fields['ko-plan'] || null;
}
export function roomTargetDate(room: Room): string | null {
  return room.stages[0]?.fields['deploy-estimate'] || null;
}
export function roomDeliveredDate(room: Room): string | null {
  const done = stageStatus(room, 5) === 'done';
  const acceptance = room.stages[5]?.fields['acceptance'];
  return done ? acceptance || null : null;
}

export function stageStatus(room: Room, index: number): StageStatus {
  return room.stages[index]?.status ?? 'todo';
}

/** 当前阶段 = 第一个既非 done 也非 skip 的阶段；全部完成返回 6。 */
export function currentStageOf(room: Room): number {
  for (let i = 0; i < ROOM_STAGES.length; i++) {
    const st = stageStatus(room, i);
    if (st !== 'done' && st !== 'skip') return i;
  }
  return ROOM_STAGES.length;
}

export function roomStageProgress(room: Room) {
  const counts: Record<StageStatus, number> = { todo: 0, doing: 0, done: 0, skip: 0 };
  for (let i = 0; i < ROOM_STAGES.length; i++) counts[stageStatus(room, i)]++;
  return { counts, completed: counts.done + counts.skip, current: currentStageOf(room) };
}

export function roomPhase(room: Room, today: string): Phase {
  const current = currentStageOf(room);
  if (current >= ROOM_STAGES.length) return 'past';
  const start = roomStartDate(room);
  const untouched = current === 0 && stageStatus(room, 0) === 'todo';
  if (untouched && (start === null || start > today)) return 'future';
  return 'present';
}

export function roomStatus(room: Room, today: string): RoomStatus {
  const phase = roomPhase(room, today);
  if (phase === 'past') return 'delivered';
  if (phase === 'future') return 'planned';
  return room.blocker ? 'blocked' : 'building';
}

export function roomDuration(room: Room, today: string) {
  const start = roomStartDate(room);
  const target = roomTargetDate(room);
  const delivered = roomDeliveredDate(room);
  const planned = daysBetween(start, target);
  const actual = delivered ? daysBetween(start, delivered) : daysBetween(start, today);
  return { planned, actual, over: planned === null || actual === null ? null : actual - planned };
}

export function clusterStageIndex(cluster: Cluster): number {
  for (let i = 0; i < CLUSTER_STAGES.length; i++) {
    const st = cluster.delivery[i]?.status ?? 'todo';
    if (st !== 'done' && st !== 'skip') return i;
  }
  return CLUSTER_STAGES.length;
}

export function clusterPhase(cluster: Cluster, today: string): Phase {
  const idx = clusterStageIndex(cluster);
  if (idx >= CLUSTER_STAGES.length) return 'past';
  if (idx === 0 && !cluster.deliveredDate && (cluster.startDate === null || cluster.startDate > today)) return 'future';
  return 'present';
}

export function clusterStatus(cluster: Cluster, today: string): ClusterStatus {
  const phase = clusterPhase(cluster, today);
  if (phase === 'past') return 'delivered';
  if (phase === 'future') return 'planned';
  if (cluster.blocker) return 'blocked';
  if (clusterStageIndex(cluster) === 0 && cluster.startDate && cluster.startDate <= today) return 'pending';
  return 'building';
}

export function clusterDuration(cluster: Cluster, today: string) {
  const sla = cluster.slaDays ?? null;
  const actual = cluster.deliveredDate
    ? daysBetween(cluster.startDate, cluster.deliveredDate)
    : clusterPhase(cluster, today) === 'future'
      ? null
      : daysBetween(cluster.startDate, today);
  return { sla, actual, over: actual === null || sla === null ? null : actual - sla };
}

export function summarizeRoom(room: Room, clusters: Cluster[], today: string) {
  const mine = clusters.filter((c) => c.roomId === room.id);
  const byStatus = (s: ClusterStatus) => mine.filter((c) => clusterStatus(c, today) === s).length;
  const delivered = byStatus('delivered');
  const planned = room.planCount;
  return {
    recorded: mine.length,
    planned,
    delivered,
    blocked: byStatus('blocked'),
    building: mine.filter((c) => {
      const s = clusterStatus(c, today);
      return s === 'building' || s === 'pending';
    }).length,
    pending: byStatus('pending'),
    plannedClusters: byStatus('planned'),
    pct: planned && planned > 0 ? Math.round((delivered / planned) * 100) : null,
    narrowed: false,
  } satisfies RoomSummaryCounts;
}

export function toRoomView(room: Room, clusters: Cluster[], today: string): RoomView {
  const progress = roomStageProgress(room);
  return {
    ...room,
    currentStage: progress.current,
    phase: roomPhase(room, today),
    status: roomStatus(room, today),
    startDate: roomStartDate(room),
    targetDate: roomTargetDate(room),
    deliveredDate: roomDeliveredDate(room),
    duration: roomDuration(room, today),
    stageProgress: { counts: progress.counts, completed: progress.completed, current: progress.current },
    summary: summarizeRoom(room, clusters, today),
  };
}

export function toClusterView(cluster: Cluster, roomName: string, today: string): ClusterView {
  return {
    ...cluster,
    phase: clusterPhase(cluster, today),
    status: clusterStatus(cluster, today),
    stageIndex: clusterStageIndex(cluster),
    duration: clusterDuration(cluster, today),
    roomName,
    batchType: null,
  };
}

/** 时间线：月份刻度与条带定位，逻辑照搬原型 cluster-model.js。 */
export function timelineMonths(dates: (string | null)[]): { key: string; idx: number; label: string }[] {
  const valid = dates.filter((d): d is string => dayUTC(d) !== null);
  if (!valid.length) return [];
  const idx = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
  const min = Math.min(...valid.map(idx));
  const max = Math.max(...valid.map(idx));
  return Array.from({ length: max - min + 1 }, (_, i) => {
    const n = min + i;
    return { key: `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`, idx: n, label: `${Math.floor(n / 12)}/${String((n % 12) + 1).padStart(2, '0')}` };
  });
}

export function timelineBounds(months: { key: string }[]) {
  if (!months.length) return null;
  const first = dayUTC(months[0].key + '-01')!;
  const lastIdx = Number(months.at(-1)!.key.slice(0, 4)) * 12 + Number(months.at(-1)!.key.slice(5, 7)) - 1 + 1;
  const end = Date.UTC(Math.floor(lastIdx / 12), lastIdx % 12, 1);
  return [first, end] as const;
}

export function timelinePosition(date: string | null, months: { key: string }[]): number | null {
  const d = dayUTC(date);
  const bounds = timelineBounds(months);
  if (d === null || !bounds) return null;
  return ((d - bounds[0]) / (bounds[1] - bounds[0])) * 100;
}

export function timelineBar(
  start: string | null,
  end: string | null,
  months: { key: string }[],
): { left: number; width: number; milestone: boolean; openEnd: boolean } | null {
  if (!start && !end) return null;
  const bounds = timelineBounds(months);
  if (!bounds) return null;
  if (!start) {
    const left = timelinePosition(end, months);
    return left === null ? null : { left, width: 0, milestone: true, openEnd: true };
  }
  const left = timelinePosition(start, months);
  const right = timelinePosition(end || start, months);
  if (left === null || right === null || right < left) return null;
  return {
    left,
    width: Math.min(100 - left, right - left + (86400000 / (bounds[1] - bounds[0])) * 100),
    milestone: !end,
    openEnd: !end,
  };
}

export function groupByPhase<T>(items: T[], phaseOf: (item: T) => Phase, labels: Record<Phase, string>) {
  return PHASES.map((phase) => ({ phase, label: labels[phase], items: items.filter((i) => phaseOf(i) === phase) }));
}

export function roomStageName(index: number): string {
  return ROOM_STAGES[index]?.name ?? '已完成';
}

export function stageItemValue(room: Room, stageIndex: number, itemId: string): string {
  return room.stages[stageIndex]?.fields?.[itemId] ?? '';
}

export function roomSearchText(room: Room, clusters: Cluster[]): string {
  const mine = clusters.filter((c) => c.roomId === room.id).map((c) => c.name).join(' ');
  return [room.name, room.vdc ?? '', room.region, room.owner, room.line, ...room.tenants, mine].join(' ').toLowerCase();
}

export function monthLabel(m: { label: string }): string {
  return m.label;
}

export function formatDate(date: string | null | undefined): string {
  return date || '待确认';
}

export function formatDays(days: number | null): string {
  return days === null ? '—' : `${days} 天`;
}

export function clusterStageDefs(): typeof CLUSTER_STAGES {
  return CLUSTER_STAGES;
}

export function roomStageDefs(): RoomStageDef[] {
  return ROOM_STAGES;
}
