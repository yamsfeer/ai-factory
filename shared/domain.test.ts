import { describe, expect, it } from 'vitest';
import {
  clusterStageIndex,
  clusterPhase,
  clusterStatus,
  currentStageOf,
  daysBetween,
  roomDeliveredDate,
  roomPhase,
  roomStartDate,
  roomStatus,
  roomTargetDate,
  summarizeRoom,
  timelineBar,
  timelineMonths,
  timelinePosition,
} from './domain.ts';
import type { Cluster, Room } from './types.ts';

const room = (over: Partial<Room> = {}): Room => ({
  id: 'r1',
  name: '测试机房',
  area: 'cn',
  region: 'China-North',
  vdc: null,
  line: '训练',
  tenants: ['Seed'],
  owner: '张三',
  planCount: 2,
  note: '',
  blocker: '',
  stages: Array.from({ length: 6 }, (_, index) => ({ index, status: 'todo' as const, fields: {} })),
  envItems: [],
  createdAt: '',
  updatedAt: '',
  ...over,
});

const cluster = (over: Partial<Cluster> = {}): Cluster => ({
  id: 'c1',
  roomId: 'r1',
  batchId: null,
  name: 'core-r1',
  group: 'Core',
  type: '通用',
  tenant: 'Seed',
  owner: '张三',
  vdc: null,
  startDate: '2026-10-01',
  planEndDate: '2026-10-10',
  deliveredDate: null,
  slaDays: 5,
  delivery: Array.from({ length: 6 }, (_, index) => ({ index, status: 'todo' as const, checks: {} })),
  blocker: '',
  next: '',
  risk: null,
  origin: 'manual',
  createdAt: '',
  updatedAt: '',
  ...over,
});

const withStatuses = (statuses: ('todo' | 'doing' | 'done' | 'skip')[]) => {
  const base = room();
  return { ...base, stages: base.stages.map((s, i) => ({ ...s, status: statuses[i] ?? 'todo' })) };
};

describe('机房阶段推导', () => {
  it('当前阶段是第一个未完成且不适用的阶段', () => {
    expect(currentStageOf(withStatuses(['done', 'doing', 'todo', 'todo', 'todo', 'todo']))).toBe(1);
    expect(currentStageOf(withStatuses(['done', 'skip', 'done', 'todo', 'todo', 'todo']))).toBe(3);
  });

  it('全部完成或跳过时当前阶段为 6', () => {
    expect(currentStageOf(withStatuses(['done', 'done', 'done', 'done', 'done', 'done']))).toBe(6);
    expect(currentStageOf(withStatuses(['done', 'skip', 'done', 'done', 'skip', 'done']))).toBe(6);
  });

  it('日期来自阶段子项，不单独存储', () => {
    const r = withStatuses(['done', 'done', 'done', 'done', 'done', 'done']);
    r.stages[0].fields['ko-plan'] = '2026-02-01';
    r.stages[0].fields['deploy-estimate'] = '2026-03-01';
    r.stages[5].fields['acceptance'] = '2026-03-05';
    expect(roomStartDate(r)).toBe('2026-02-01');
    expect(roomTargetDate(r)).toBe('2026-03-01');
    expect(roomDeliveredDate(r)).toBe('2026-03-05');
  });
});

describe('阶段（过去/现在/未来）推导', () => {
  it('全部完成是过去，未开始且未到启动日是未来', () => {
    const done = withStatuses(['done', 'done', 'done', 'done', 'done', 'done']);
    expect(roomPhase(done, '2026-10-24')).toBe('past');
    const future = withStatuses(['todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
    future.stages[0].fields['ko-plan'] = '2026-12-01';
    expect(roomPhase(future, '2026-10-24')).toBe('future');
    expect(roomPhase(future, '2027-01-01')).toBe('present');
  });

  it('没有启动日期视为规划中；启动日期已过视为在建', () => {
    const undated = withStatuses(['todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
    expect(roomPhase(undated, '2026-10-24')).toBe('future');
    const started = withStatuses(['todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
    started.stages[0].fields['ko-plan'] = '2026-09-01';
    expect(roomPhase(started, '2026-10-24')).toBe('present');
  });

  it('有阻塞的在建机房状态为 blocked', () => {
    const r = withStatuses(['done', 'doing', 'todo', 'todo', 'todo', 'todo']);
    r.blocker = '等电力';
    expect(roomStatus(r, '2026-10-24')).toBe('blocked');
  });
});

describe('阻塞优先于阶段', () => {
  it('未来的阻塞实体状态是有阻塞', () => {
    const r = withStatuses(['todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
    r.stages[0].fields['ko-plan'] = '2027-03-01';
    r.blocker = '等电力';
    expect(roomPhase(r, '2026-10-24')).toBe('future');
    expect(roomStatus(r, '2026-10-24')).toBe('blocked');
  });
});

describe('集群派生', () => {
  it('六个环节全部完成才算已交付', () => {
    const done = cluster({ delivery: Array.from({ length: 6 }, (_, index) => ({ index, status: 'done' as const, checks: {} })), deliveredDate: '2026-10-09' });
    expect(clusterStageIndex(done)).toBe(6);
    expect(clusterPhase(done, '2026-10-24')).toBe('past');
    expect(clusterStatus(done, '2026-10-24')).toBe('delivered');
  });

  it('未开始且开始日期在未来是规划中', () => {
    const planned = cluster({ startDate: '2026-11-05', planEndDate: '2026-12-01' });
    expect(clusterPhase(planned, '2026-10-24')).toBe('future');
    expect(clusterStatus(planned, '2026-10-24')).toBe('planned');
  });

  it('第一个环节进行中时状态是在建而不是待启动', () => {
    const c = cluster({ startDate: '2026-10-01', delivery: [{ index: 0, status: 'doing', checks: {} }, ...Array.from({ length: 5 }, (_, i) => ({ index: i + 1, status: 'todo' as const, checks: {} }))] });
    expect(clusterStatus(c, '2026-10-24')).toBe('building');
  });

  it('有阻塞时状态优先显示为 blocked', () => {
    const blocked = cluster({ delivery: [{ index: 0, status: 'done', checks: {} }, ...Array.from({ length: 5 }, (_, i) => ({ index: i + 1, status: 'todo' as const, checks: {} }))], blocker: 'databus' });
    expect(clusterStatus(blocked, '2026-10-24')).toBe('blocked');
  });
});

describe('耗时与统计', () => {
  it('按自然日计算耗时与超期', () => {
    expect(daysBetween('2026-10-01', '2026-10-10')).toBe(9);
    expect(daysBetween('2026-10-10', '2026-10-01')).toBeNull();
  });

  it('计划集群数缺失时百分比为空', () => {
    const r = room({ planCount: null });
    const summary = summarizeRoom(r, [cluster()], '2026-10-24');
    expect(summary.planned).toBeNull();
    expect(summary.pct).toBeNull();
    expect(summary.recorded).toBe(1);
  });

  it('已交付数与计划数算出百分比', () => {
    const r = room({ planCount: 4 });
    const done = cluster({ delivery: Array.from({ length: 6 }, (_, index) => ({ index, status: 'done' as const, checks: {} })), deliveredDate: '2026-10-09' });
    const summary = summarizeRoom(r, [done, cluster({ id: 'c2' })], '2026-10-24');
    expect(summary.recorded).toBe(2);
    expect(summary.delivered).toBe(1);
    expect(summary.pct).toBe(25);
  });
});

describe('时间线几何', () => {
  it('月份轴跨年连续', () => {
    const months = timelineMonths(['2026-11-01', '2027-02-01']);
    expect(months.map((m) => m.label)).toEqual(['2026/11', '2026/12', '2027/01', '2027/02']);
  });

  it('位置按整月边界计算', () => {
    const months = timelineMonths(['2026-01-01', '2026-12-31']);
    expect(months).toHaveLength(12);
    expect(timelinePosition('2026-01-01', months)).toBeCloseTo(0, 5);
    expect(timelinePosition('2027-01-01', months)).toBeCloseTo(100, 5);
  });

  it('只有结束日期时是里程碑，没有日期时为空', () => {
    const months = timelineMonths(['2026-10-01', '2026-12-01']);
    const milestone = timelineBar(null, '2026-11-01', months);
    expect(milestone?.milestone).toBe(true);
    expect(milestone?.width).toBe(0);
    expect(timelineBar(null, null, months)).toBeNull();
  });
});
