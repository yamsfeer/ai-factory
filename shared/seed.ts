import type { Area, Batch, BuildoutStage, Cluster, DeliveryStage, EnvItem, EnvStatus, Room, StageStatus } from './types.ts';
import { CLUSTER_STAGES, ENV_TEMPLATES, ROOM_STAGES } from './stages.ts';

/** 确定性 seed：不随机，任何机器、任何时候生成同一份数据。日期围绕 2026-10 编排。 */

const addDays = (date: string, n: number) => {
  const t = Date.parse(date + 'T00:00:00Z') + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
};

const envStatuses = (progress: number, total: number): EnvStatus[] =>
  Array.from({ length: total }, (_, i) => {
    if (progress >= 6) return i === total - 1 ? 'skip' : 'done';
    if (progress <= 0) return 'pending';
    if (i < progress + 2) return 'done';
    if (i < progress + 5) return 'doing';
    return 'pending';
  });

function buildEnvItems(progress: number): EnvItem[] {
  const statuses = envStatuses(progress, ENV_TEMPLATES.length);
  return ENV_TEMPLATES.map((tpl, i) => ({
    key: tpl.key,
    name: tpl.name,
    category: tpl.category,
    status: statuses[i],
    custom: false,
    sort: i,
  }));
}

const stageStatusFor = (index: number, progress: number): StageStatus => {
  if (progress >= 6) return 'done';
  if (index < progress) return 'done';
  if (index === progress && progress > 0) return 'doing';
  return 'todo';
};

function buildStages(spec: RoomSpec): BuildoutStage[] {
  const progress = spec.progress;
  return ROOM_STAGES.map((def, index) => {
    const fields: Record<string, string> = {};
    if (index === 0 && spec.start) {
      fields['ko-plan'] = spec.start;
      fields['gpu-arrival'] = addDays(spec.start, 2);
      if (spec.target) fields['deploy-estimate'] = spec.target;
      fields['poc-room'] = spec.owner;
      fields['poc-project'] = spec.owner;
      fields['poc-budget'] = '程武飞';
      fields['poc-bke-tce'] = spec.owner;
      fields['poc-business'] = spec.tenants[0] ?? '待确认';
      fields['business-side'] = spec.tenants.join(' / ');
    }
    if (index === 1 && spec.start) {
      fields['budget-submit'] = addDays(spec.start, -4);
      fields['v3-create'] = `3V-${spec.id.toUpperCase().slice(0, 6)}-001`;
      fields['machine-arrival'] = addDays(spec.start, 4);
    }
    if (index === 2 && spec.start) {
      fields['ko-meeting'] = spec.start;
      fields['site-entry'] = addDays(spec.start, 1);
    }
    if (index === 3) fields['cluster-record'] = 'Core ×1、训练 ×2、推理 ×1（示例规划）';
    if (index === 4 && spec.delivered) fields['pre-delivery-check'] = addDays(spec.delivered, -2);
    if (index === 5) {
      if (spec.delivered) fields['acceptance'] = spec.delivered;
      fields['downstream'] = '1';
    }
    return { index, status: stageStatusFor(index, progress), fields };
  });
}

interface RoomSpec {
  id: string;
  name: string;
  area: Area;
  region: string;
  vdc: string | null;
  line: string;
  tenants: string[];
  owner: string;
  planCount: number | null;
  progress: number;
  start: string | null;
  target: string | null;
  delivered: string | null;
  blocker?: string;
  note?: string;
}

const ROOM_SPECS: RoomSpec[] = [
  { id: 'yx', name: 'AML YX 机房', area: 'cn', region: 'China-North3', vdc: 'yx', line: '混合', tenants: ['AML', 'TCE'], owner: '于子晨', planCount: 7, progress: 6, start: '2026-02-10', target: '2026-04-20', delivered: '2026-04-23' },
  { id: 'hhhl', name: 'Seed 呼和和林 HHHL', area: 'cn', region: 'China-North', vdc: null, line: '训练', tenants: ['Seed'], owner: '王剑', planCount: null, progress: 6, start: '2026-04-01', target: '2026-05-10', delivered: '2026-05-08' },
  { id: 'zhaochuan', name: 'AML 赵川机房', area: 'cn', region: 'China-North', vdc: null, line: '训练', tenants: ['AML'], owner: '于子晨', planCount: null, progress: 6, start: '2026-03-05', target: '2026-04-10', delivered: '2026-04-12' },
  { id: 'hb6', name: '华北6 大金融 / 消金 / 追光专区', area: 'cn', region: 'China-North6', vdc: null, line: '微服务', tenants: ['财经支付'], owner: '张洋', planCount: null, progress: 6, start: '2026-06-01', target: '2026-08-15', delivered: '2026-08-18' },
  { id: 'id4a', name: 'Flow 印尼 id4a 机房', area: 'overseas', region: 'NonTT', vdc: 'id4a', line: '微服务', tenants: ['Flow'], owner: '沈竹筠', planCount: null, progress: 6, start: '2026-07-10', target: '2026-08-10', delivered: '2026-08-08' },
  { id: 'stone-usw', name: 'Stone 美西 AWS H100', area: 'overseas', region: 'NonTT', vdc: null, line: '训练', tenants: ['Stone'], owner: '关程华宸', planCount: null, progress: 6, start: '2026-04-01', target: '2026-05-01', delivered: '2026-04-28' },
  { id: 'seed-jp', name: 'Seed 日本训练机房', area: 'overseas', region: 'NonTT', vdc: null, line: '训练', tenants: ['Seed'], owner: '檀浩', planCount: null, progress: 6, start: '2026-05-06', target: '2026-06-06', delivered: '2026-06-03' },
  { id: 'hlge', name: 'Seed 和林格尔 HLGE', area: 'cn', region: 'China-North', vdc: null, line: '训练', tenants: ['Seed'], owner: '井诚', planCount: null, progress: 6, start: '2026-03-10', target: '2026-04-24', delivered: '2026-04-24' },
  { id: 'wlby', name: 'Seed WLBY 机房', area: 'cn', region: 'China-North5', vdc: 'wlby', line: '混合', tenants: ['Seed', 'TCE'], owner: '曲强', planCount: 6, progress: 2, start: '2026-09-20', target: '2026-10-18', delivered: null, blocker: '部分集群组件待补齐，影响机房整体验收' },
  { id: 'syd2a', name: '悉尼 syd2a 机房', area: 'overseas', region: 'Australia-SouthEastBD', vdc: 'syd2a', line: '混合', tenants: ['Seed', 'TCE'], owner: '曲强', planCount: 4, progress: 4, start: '2026-09-18', target: '2026-10-08', delivered: null },
  { id: 'hhdh', name: '内蒙呼和浩特东河 HHDH', area: 'cn', region: 'China-North5', vdc: null, line: '推理', tenants: ['Flow'], owner: '彭康熙', planCount: 4, progress: 1, start: '2026-10-09', target: '2026-12-10', delivered: null, note: '内场项目（云底座：火山）' },
  { id: 'my1a', name: 'Flow 马来 my1a/b/c 机房', area: 'overseas', region: 'NonTT', vdc: null, line: '微服务', tenants: ['Flow'], owner: '张洋', planCount: null, progress: 2, start: '2026-09-01', target: '2026-10-30', delivered: null, note: '仅 Dola & Lark 微服务，无 GPU 机器' },
  { id: 'seed-hk', name: 'Seed 香港机房', area: 'overseas', region: 'NonTT', vdc: null, line: '推理', tenants: ['Seed'], owner: '刘伟', planCount: null, progress: 1, start: '2026-09-25', target: '2026-12-31', delivered: null },
  { id: 'wuhan', name: 'Seed 武汉机房（新建 VDC）', area: 'cn', region: 'China-Central', vdc: null, line: '训练', tenants: ['Seed'], owner: '彭康熙', planCount: null, progress: 0, start: '2026-11-02', target: '2026-12-31', delivered: null, note: '3V 待建，正在梳理机房资源' },
  { id: 'wlqq', name: '内蒙乌兰前旗 WLQQ', area: 'cn', region: '火山华北5AZC', vdc: null, line: '推理', tenants: ['Flow'], owner: '井诚 / 韩亮', planCount: null, progress: 0, start: '2027-02-01', target: '2027-04-01', delivered: null, note: '内场项目（云底座：火山）；FY26 清单提示延期到 FY27' },
  { id: 'kmmh', name: 'Seed 云南专项（VDC kmmh）', area: 'cn', region: 'China-Southwest', vdc: 'kmmh', line: '训练', tenants: ['Seed'], owner: '彭康熙', planCount: null, progress: 0, start: null, target: null, delivered: null, note: '进场时间待定，3V 待建' },
  { id: 'ningxia-az1', name: '宁夏 AZ1 云基地 on 火山', area: 'cn', region: 'China-Northwest', vdc: null, line: '混合', tenants: ['Seed', 'Flow'], owner: '程武飞', planCount: null, progress: 0, start: '2027-02-15', target: '2027-04-01', delivered: null, note: '3V 已创建，预算待提交' },
  { id: 'seed-fi', name: 'Seed 芬兰机房', area: 'overseas', region: 'NonTT', vdc: null, line: '训练', tenants: ['Seed'], owner: '井诚', planCount: null, progress: 0, start: '2026-11-01', target: '2026-11-30', delivered: null, note: '建设排期及集群规划为示例，正式方案待确认' },
  { id: 'id4b', name: 'Flow 印尼 id4b 机房', area: 'overseas', region: 'NonTT', vdc: null, line: '微服务', tenants: ['Flow'], owner: '沈竹筠', planCount: null, progress: 0, start: '2027-05-03', target: '2027-07-01', delivered: null, note: '3V 已建，预算待明确' },
  { id: 'wlyj', name: 'AML 乌兰远景 WLYJ', area: 'cn', region: 'China-North', vdc: null, line: '推理', tenants: ['Engine'], owner: '李其明', planCount: null, progress: 0, start: '2026-11-03', target: '2026-12-10', delivered: null, note: '建设排期及集群规划为示例，正式方案待确认' },
];

interface ClusterSpec {
  id: string;
  roomId: string;
  name: string;
  group: string | null;
  type: string;
  tenant: string;
  owner: string;
  slaDays: number | null;
  stage: number;
  start: string;
  planEnd: string;
  delivered?: string;
  blocker?: string;
  next: string;
  risk?: { level: 'warn' | 'err'; short: string; text: string };
  batchId?: string;
}

const CLUSTER_SPECS: ClusterSpec[] = [
  { id: 'yx-core', roomId: 'yx', name: 'core-yx', group: 'Core', type: '通用', tenant: 'TCE', owner: '曲强', slaDays: 3, stage: 6, start: '2026-04-20', planEnd: '2026-04-20', delivered: '2026-04-23', next: '六阶段流程已完成' },
  { id: 'yx-gaura', roomId: 'yx', name: 'gaura-yx', group: 'Gaura', type: '训练', tenant: 'AML', owner: '于子晨', slaDays: 4, stage: 6, start: '2026-04-19', planEnd: '2026-04-20', delivered: '2026-04-23', next: '六阶段流程已完成' },
  { id: 'yx-foxtrot', roomId: 'yx', name: 'foxtrot-yx', group: 'Foxtrot', type: '训练', tenant: 'AML', owner: '于子晨', slaDays: 4, stage: 6, start: '2026-04-18', planEnd: '2026-04-20', delivered: '2026-04-23', next: '六阶段流程已完成' },
  { id: 'yx-panda', roomId: 'yx', name: 'panda-yx', group: 'Panda', type: '推理', tenant: 'TCE', owner: '于子晨', slaDays: 3, stage: 6, start: '2026-04-20', planEnd: '2026-04-20', delivered: '2026-04-23', next: '六阶段流程已完成' },
  { id: 'yx-visa', roomId: 'yx', name: 'visa-yx', group: 'Visa', type: '通用', tenant: 'TCE', owner: '关程华宸', slaDays: 3, stage: 6, start: '2026-04-19', planEnd: '2026-04-20', delivered: '2026-04-23', next: '六阶段流程已完成' },
  { id: 'yx-phlox', roomId: 'yx', name: 'phlox-yx', group: 'Phlox', type: '微服务', tenant: 'TCE', owner: '曲强', slaDays: 3, stage: 6, start: '2026-04-20', planEnd: '2026-04-20', delivered: '2026-04-23', next: '六阶段流程已完成' },
  { id: 'yx-pansy', roomId: 'yx', name: 'pansy-yx', group: 'Pansy', type: '微服务', tenant: 'TCE', owner: '于子晨', slaDays: 3, stage: 6, start: '2026-04-21', planEnd: '2026-04-20', delivered: '2026-04-23', next: '六阶段流程已完成' },

  { id: 'wlby-core', roomId: 'wlby', name: 'core-wlby', group: 'Core', type: '通用', tenant: 'TCE', owner: '曲强', slaDays: 3, stage: 6, start: '2026-10-06', planEnd: '2026-10-18', delivered: '2026-10-10', next: '六阶段流程已完成', batchId: 'wlby-core-b1' },
  { id: 'wlby-phlox', roomId: 'wlby', name: 'phlox-wlby', group: 'Phlox', type: '微服务', tenant: 'TCE', owner: '曲强', slaDays: 3, stage: 6, start: '2026-10-07', planEnd: '2026-10-18', delivered: '2026-10-10', next: '六阶段流程已完成', batchId: 'wlby-ms-b1' },
  { id: 'wlby-panda', roomId: 'wlby', name: 'panda-wlby', group: 'Panda', type: '推理', tenant: 'TCE', owner: '于子晨', slaDays: 3, stage: 3, start: '2026-10-13', planEnd: '2026-10-28', blocker: 'databus 应用健康检查未通过', next: '处理当前阻塞，完成后继续交付前检查', batchId: 'wlby-infer-b1' },
  { id: 'wlby-visa', roomId: 'wlby', name: 'visa-wlby', group: 'Visa', type: '通用', tenant: 'TCE', owner: '关程华宸', slaDays: 3, stage: 3, start: '2026-10-13', planEnd: '2026-10-28', blocker: 'katalyst-sys-advisor 待恢复', next: '处理当前阻塞，完成后继续交付前检查', batchId: 'wlby-core-b1' },
  { id: 'wlby-cloudnative', roomId: 'wlby', name: 'cloudnative-wlby', group: 'CloudNative', type: '训练', tenant: 'Seed', owner: '曲强', slaDays: 4, stage: 3, start: '2026-10-13', planEnd: '2026-11-05', next: '完成控制器就绪检查', risk: { level: 'warn', short: '控制器就绪', text: '控制器就绪检查未通过，阻塞人工补齐阶段' }, batchId: 'wlby-ms-b1' },
  { id: 'wlby-seed01', roomId: 'wlby', name: 'Seed01（名称待确认）', group: 'Seed01', type: '训练', tenant: 'Seed', owner: '待确认', slaDays: 4, stage: 2, start: '2026-10-13', planEnd: '2026-11-05', next: '完成当前阶段及子项', batchId: 'wlby-infer-b1' },

  { id: 'syd2a-core', roomId: 'syd2a', name: 'core-syd2a', group: 'Core', type: '通用', tenant: 'TCE', owner: '曲强', slaDays: 3, stage: 6, start: '2026-10-07', planEnd: '2026-10-08', delivered: '2026-10-10', next: '六阶段流程已完成', batchId: 'syd2a-b1' },
  { id: 'syd2a-normal01', roomId: 'syd2a', name: 'Normal01', group: 'Normal01', type: '微服务', tenant: 'Seed', owner: '待确认', slaDays: 3, stage: 6, start: '2026-10-08', planEnd: '2026-10-08', delivered: '2026-10-10', next: '六阶段流程已完成', batchId: 'syd2a-b1' },
  { id: 'syd2a-bernard', roomId: 'syd2a', name: 'Bernard-Prod', group: 'Bernard-Prod', type: '推理', tenant: 'TCE', owner: '待确认', slaDays: 3, stage: 6, start: '2026-10-08', planEnd: '2026-10-08', delivered: '2026-10-10', next: '六阶段流程已完成', batchId: 'syd2a-b2' },
  { id: 'syd2a-candy', roomId: 'syd2a', name: 'Candy', group: 'Candy', type: '推理', tenant: 'Seed', owner: '待确认', slaDays: 3, stage: 4, start: '2026-10-13', planEnd: '2026-10-30', next: '完成交付前检查', risk: { level: 'warn', short: '检查待复核', text: '交付前检查发现 2 项待复核，暂不能进入后置通知' }, batchId: 'syd2a-b2' },

  { id: 'hhdh-train01', roomId: 'hhdh', name: 'seed-hhdh-train-01', group: 'Train', type: '训练', tenant: 'Seed', owner: '彭康熙', slaDays: 5, stage: 1, start: '2026-10-09', planEnd: '2026-12-20', next: '跟进机房电力交付；同步完成机器 list 与规格确认', risk: { level: 'warn', short: '电力依赖', text: '等待机房电力就绪（计划 2026-11-20），资源准备与机器重装暂不能关闭' }, batchId: 'hhdh-train-b1' },
  { id: 'hhdh-train02', roomId: 'hhdh', name: 'seed-hhdh-train-02', group: 'Train', type: '训练', tenant: 'Seed', owner: '彭康熙', slaDays: 5, stage: 1, start: '2026-10-09', planEnd: '2026-12-20', next: '与 train-01 合并推进机器调转', risk: { level: 'warn', short: '电力依赖', text: '与 train-01 共用机房电力节点，等待 2026-11-20 就绪' }, batchId: 'hhdh-train-b1' },
  { id: 'hhdh-infer01', roomId: 'hhdh', name: 'seed-hhdh-infer-01', group: 'Infer', type: '推理', tenant: 'Flow', owner: '彭康熙', slaDays: null, stage: 0, start: '2026-11-20', planEnd: '2027-01-15', next: '确认需求、VDC、集群组与负责人', batchId: 'hhdh-infer-b1' },

  { id: 'my1a-ms01', roomId: 'my1a', name: 'dola-my1a-01', group: 'Dola', type: '微服务', tenant: 'Flow', owner: '张洋', slaDays: 4, stage: 2, start: '2026-09-01', planEnd: '2026-10-30', next: '完成 BKE 创建', batchId: 'my1a-ms-b1' },
  { id: 'my1a-ms02', roomId: 'my1a', name: 'lark-my1a-01', group: 'Lark', type: '微服务', tenant: 'Flow', owner: '张洋', slaDays: 4, stage: 2, start: '2026-09-05', planEnd: '2026-10-30', next: '完成 BKE 创建', batchId: 'my1a-ms-b1' },

  { id: 'seed-hk-infer01', roomId: 'seed-hk', name: 'seed-hk-infer-01', group: 'Infer', type: '推理', tenant: 'Seed', owner: '刘伟', slaDays: 3, stage: 1, start: '2026-09-25', planEnd: '2026-12-31', next: '准备机器 list 与规格' },
  { id: 'seed-hk-infer02', roomId: 'seed-hk', name: 'seed-hk-infer-02', group: 'Infer', type: '推理', tenant: 'Seed', owner: '刘伟', slaDays: 3, stage: 6, start: '2026-09-28', planEnd: '2026-10-20', delivered: '2026-10-19', next: '六阶段流程已完成' },

  { id: 'wuhan-train01', roomId: 'wuhan', name: 'seed-wuhan-train-01', group: 'Train', type: '训练', tenant: 'Seed', owner: '彭康熙', slaDays: null, stage: 0, start: '2026-11-02', planEnd: '2027-02-10', next: '确认需求、VDC、集群组与负责人', batchId: 'wuhan-train-b1' },

  { id: 'hlge-core', roomId: 'hlge', name: 'core-hlge', group: 'Core', type: '通用', tenant: 'Seed', owner: '井诚', slaDays: 3, stage: 6, start: '2026-04-20', planEnd: '2026-04-24', delivered: '2026-04-24', next: '六阶段流程已完成' },

  { id: 'seed-fi-train01', roomId: 'seed-fi', name: 'seed-fi-train-01', group: 'Train', type: '训练', tenant: 'Seed', owner: '井诚', slaDays: null, stage: 0, start: '2026-11-01', planEnd: '2026-11-30', next: '确认需求、VDC、集群组与负责人' },

  { id: 'wlyj-infer01', roomId: 'wlyj', name: 'aml-wlyj-infer-01', group: 'Infer', type: '推理', tenant: 'Engine', owner: '李其明', slaDays: 4, stage: 1, start: '2026-11-03', planEnd: '2026-12-10', next: '确认机器到付时间' },

  { id: 'id4b-ms01', roomId: 'id4b', name: 'flow-id4b-ms-01', group: 'Dola', type: '微服务', tenant: 'Flow', owner: '沈竹筠', slaDays: null, stage: 0, start: '2027-05-03', planEnd: '2027-07-01', next: '确认需求、VDC、集群组与负责人' },
];

const BATCHES: Batch[] = [
  { id: 'wlby-core-b1', roomId: 'wlby', type: '通用', startDate: '2026-09-25', endDate: '2026-10-18', planCount: 2, owner: '曲强', origin: 'existing-add' },
  { id: 'wlby-ms-b1', roomId: 'wlby', type: '微服务', startDate: '2026-09-28', endDate: '2026-10-25', planCount: 3, owner: '曲强', origin: 'existing-add' },
  { id: 'wlby-infer-b1', roomId: 'wlby', type: '推理', startDate: '2026-10-10', endDate: '2026-11-05', planCount: 1, owner: '于子晨', origin: 'new-first' },
  { id: 'syd2a-b1', roomId: 'syd2a', type: '混合', startDate: '2026-09-20', endDate: '2026-10-10', planCount: 2, owner: '曲强', origin: 'new-first' },
  { id: 'syd2a-b2', roomId: 'syd2a', type: '推理', startDate: '2026-10-15', endDate: '2026-11-20', planCount: 2, owner: '曲强', origin: 'existing-add' },
  { id: 'hhdh-train-b1', roomId: 'hhdh', type: '训练', startDate: '2026-10-09', endDate: '2026-12-20', planCount: 2, owner: '彭康熙', origin: 'new-first' },
  { id: 'hhdh-infer-b1', roomId: 'hhdh', type: '推理', startDate: '2026-11-20', endDate: '2027-01-15', planCount: 1, owner: '彭康熙', origin: 'new-first' },
  { id: 'my1a-ms-b1', roomId: 'my1a', type: '微服务', startDate: '2026-09-01', endDate: '2026-10-30', planCount: 3, owner: '张洋', origin: 'existing-add' },
  { id: 'wuhan-train-b1', roomId: 'wuhan', type: '训练', startDate: '2026-11-02', endDate: '2027-02-10', planCount: 2, owner: '彭康熙', origin: 'new-first' },
];

function buildDelivery(stage: number, subCounts: number[]): DeliveryStage[] {
  return CLUSTER_STAGES.map((def, index) => {
    const status: StageStatus = stage >= 6 ? 'done' : index < stage ? 'done' : index === stage ? 'doing' : 'todo';
    const checks: Record<string, boolean> = {};
    def.subItems.forEach((item, i) => {
      checks[item.key] = status === 'done' ? true : status === 'doing' ? i < (subCounts[index] ?? 0) : false;
    });
    return { index, status, checks };
  });
}

const SUB_COUNTS = [3, 4, 1, 5, 1, 1];

const NEW_FIRST_ROOMS = new Set(['wlby', 'syd2a', 'hhdh', 'wuhan']);

export function buildSeed(): { rooms: Room[]; clusters: Cluster[]; batches: Batch[] } {
  const now = '2026-10-24T00:00:00.000Z';
  const rooms: Room[] = ROOM_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    area: spec.area,
    region: spec.region,
    vdc: spec.vdc,
    line: spec.line,
    tenants: spec.tenants,
    owner: spec.owner,
    planCount: spec.planCount,
    note: spec.note ?? '',
    blocker: spec.blocker ?? '',
    stages: buildStages(spec),
    envItems: buildEnvItems(spec.progress),
    createdAt: now,
    updatedAt: now,
  }));

  const clusters: Cluster[] = CLUSTER_SPECS.map((spec) => ({
    id: spec.id,
    roomId: spec.roomId,
    batchId: spec.batchId ?? null,
    name: spec.name,
    group: spec.group,
    type: spec.type,
    tenant: spec.tenant,
    owner: spec.owner,
    vdc: spec.id.startsWith('yx') ? 'yx' : spec.roomId === 'syd2a' ? 'syd2a' : null,
    startDate: spec.start,
    planEndDate: spec.planEnd,
    deliveredDate: spec.delivered ?? null,
    slaDays: spec.slaDays,
    delivery: buildDelivery(spec.stage, SUB_COUNTS),
    blocker: spec.blocker ?? '',
    next: spec.next,
    risk: spec.risk ?? null,
    origin: NEW_FIRST_ROOMS.has(spec.roomId) ? 'new-first' : 'existing-add',
    createdAt: now,
    updatedAt: now,
  }));

  return { rooms, clusters, batches: BATCHES };
}
