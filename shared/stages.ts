import type { ClusterStageDef, EnvTemplateItem, RoomStageDef } from './types.ts';

/** 机房建设六阶段。定义来自原型 sop-data.js，属于产品知识，不入库。 */
export const ROOM_STAGES: RoomStageDef[] = [
  {
    key: 'confirm',
    name: '确认机房信息',
    meaning: '对齐业务诉求与关键时间、PoC 与业务方，形成机房建设的基本盘。',
    panelTitle: '机房信息',
    panelHint: '确定机器到付时间、机房部署时间、各环节 PoC 与业务方',
    items: [
      { id: 'ko-plan', label: '预计启动时间', type: 'date', desc: '机房项目预计启动的日期，会作为时间线的起点展示为时间段' },
      { id: 'gpu-arrival', label: '机器到付时间', type: 'date', desc: '业务方 GPU 机器预计到付时间，决定部署窗口' },
      { id: 'deploy-estimate', label: '机房部署时间', type: 'date', desc: '初步规划的机房部署时间，会同步到建设时间线' },
      { id: 'poc-room', label: '机房 PoC', type: 'person', desc: '机房资源 / 基建侧对接人' },
      { id: 'poc-project', label: '项目 PoC', type: 'person', desc: '项目统筹与进度对接人' },
      { id: 'poc-budget', label: '预算 PoC', type: 'person', desc: '预算编制与提交对接人' },
      { id: 'poc-bke-tce', label: 'BKE & TCE PoC', type: 'person', desc: 'BKE 集群与 TCE 微服务侧对接人' },
      { id: 'poc-business', label: '业务 PoC', type: 'person', desc: '业务需求与进场验收对接人' },
      { id: 'business-side', label: '业务方', type: 'text', desc: '提出需求的业务方 / 团队，如 Seed、Flow' },
    ],
  },
  {
    key: 'budget',
    name: '机房预算提交 & 3V创建',
    meaning: '完成预算立项与 3V 创建，回填机器到付时间。',
    panelTitle: '预算与 3V',
    panelHint: '记录预算提交、3V 创建结果与机房机器到付时间',
    items: [
      { id: 'budget-submit', label: '机房预算提交', type: 'date', desc: '预算单提交时间，可在备注中补充单号' },
      { id: 'v3-create', label: '3V 创建', type: 'text', wide: true, placeholder: '3V 单号 / 链接，创建完成后回填', desc: '3V 创建结果，回填单号或文档链接' },
      { id: 'machine-arrival', label: '机房机器到付时间', type: 'date', desc: '机房机器实际到付时间（区别于确认信息阶段的机器到付时间）' },
    ],
  },
  {
    key: 'ko',
    name: '机房 KO',
    meaning: '召开 KickOff 完成项目启动，确认进场安排。',
    panelTitle: '机房 KO',
    panelHint: '记录 KO 会议与机房进场时间',
    items: [
      { id: 'ko-meeting', label: '项目 KickOff 会议', type: 'date', desc: 'KO 会议召开时间' },
      { id: 'site-entry', label: '机房进场时间', type: 'date', desc: '施工 / 部署团队实际进场时间' },
    ],
  },
  {
    key: 'deploy',
    name: '机房部署',
    meaning: '逐项落实机房环境项并记录集群，环境项与集群状态独立跟踪。',
    panelTitle: '机房环境项',
    panelHint: '点击方块切换状态：待处理 → 进行中 → 已完成 → 不适用',
    items: [
      { id: 'env-record', label: '记录环境项', type: 'env', desc: '在下方环境项方块中逐项维护待处理 / 进行中 / 已完成 / 不适用' },
      { id: 'cluster-record', label: '记录集群', type: 'text', wide: true, placeholder: '如 Core ×1、训练 ×3；随后在机房建设清单中录入集群', desc: '填写集群规划，随后在清单的机房内集群中正式录入' },
    ],
  },
  {
    key: 'check',
    name: '机房检查',
    meaning: '对照环境项与验收清单完成交付前检查。',
    panelTitle: '交付前检查',
    panelHint: '核验环境项完成情况并完成交付前检查',
    items: [
      { id: 'env-verify', label: '环境项核验', type: 'check', desc: '确认 13 个环境项均已完成或显式 skip' },
      { id: 'pre-delivery-check', label: '交付前检查', type: 'date', desc: '完成交付前检查的时间' },
    ],
  },
  {
    key: 'done',
    name: '完成',
    meaning: '验收通过，完成数据同步、业务交付与项目结项。',
    panelTitle: '验收与结项',
    panelHint: '完成验收结项，并确认数据同步与下游业务交付',
    items: [
      { id: 'acceptance', label: '验收与结项', type: 'date', desc: '机房验收通过、项目结项时间' },
      { id: 'downstream', label: '数据同步与下游业务交付', type: 'check', desc: '确认内场数据同步完成、下游业务已交付' },
    ],
  },
];

/** 集群交付六环节。来自《集群管理设计》rev246。 */
export const CLUSTER_STAGES: ClusterStageDef[] = [
  {
    key: 'demand',
    name: '确认需求',
    short: '需求',
    baseline: 2,
    desc: '当其他人提交需求后，需要 SRE 确认需求，补充信息',
    subItems: [
      { key: 'scene', name: '确认业务场景、集群组、project 类型、训练 / 推理等方向' },
      { key: 'copy', name: '选择可 copy 的历史集群' },
      { key: 'nodelevel', name: '新建集群组要设计 nodelevel' },
    ],
  },
  {
    key: 'resource',
    name: '资源准备 + 机器重装',
    short: '资源',
    baseline: 5,
    desc: '找 k8s 控制面机器，把机器调转 & 重装',
    subItems: [
      { key: 'list', name: '准备机器 list、规格' },
      { key: 'move', name: '调转' },
      { key: 'reinstall', name: '重装' },
      { key: 'offline', name: '机器不足时，下线合适的机器' },
    ],
  },
  {
    key: 'bke',
    name: 'BKE 创建',
    short: 'BKE',
    baseline: 8,
    desc: '提单创建 k8s 集群（bke 流程）',
    subItems: [
      {
        key: 'issues',
        name: '处理流程中的非常规问题',
        detail: ['tce_cluster 状态未 ready', '主机加锁', 'TLB 异常', 'KVops 创建集群等待完成', '异常 Seed CRDs'],
      },
    ],
  },
  {
    key: 'manual',
    name: '人工补齐',
    short: '补齐',
    baseline: 12,
    desc: '未自动化的步骤，需要人工处理',
    subItems: [
      { key: 'app', name: '应用更新、应用异常修复' },
      { key: 'collie', name: '同步 collie 配置' },
      { key: 'association', name: '补 association 属性' },
      { key: 'planning', name: 'planning 配置和重启' },
      { key: 'localdisk', name: 'Apply local-disk-manager CR' },
      { key: 'exitcode', name: '退出码配置' },
    ],
  },
  {
    key: 'check',
    name: '交付前检查',
    short: '检查',
    baseline: 2,
    desc: '需要检查集群上下游是否 OK，可参考 TCE Checklist',
    subItems: [{ key: 'checklist', name: 'TCE Checklist', link: true }],
  },
  {
    key: 'notify',
    name: '后置通知',
    short: '通知',
    baseline: 1,
    desc: '利用飞书通知各方确认「新集群」',
    subItems: [{ key: 'notify', name: '通知业务同步进场' }],
  },
];

/** 机房部署阶段的 13 个环境项模板。 */
export const ENV_TEMPLATES: EnvTemplateItem[] = [
  { key: 'bke-meta', name: 'BKE Meta', category: 'Basic', scenes: ['*'] },
  { key: 'core-cluster', name: 'Core 集群', category: 'Basic', scenes: ['*'] },
  { key: 'tce-cluster', name: 'TCE 微服务集群', category: 'Basic', scenes: ['*'] },
  { key: 'tlb-npd-riskctl', name: 'TLB - NPD RiskCtl Server', category: '域名', scenes: ['Seed 训练'] },
  { key: 'tlb-gpu-tide', name: 'TLB - GPU Tide', category: '域名', scenes: ['Seed 训练'] },
  { key: 'tlb-godel-stream', name: 'TLB - Godel Stream', category: '域名', scenes: ['Seed 训练', 'Engine 训练'] },
  { key: 'tlb-primus', name: 'TLB - Primus', category: '域名', scenes: ['Engine 训练'] },
  { key: 'tlb-history-api', name: 'TLB - History Server API', category: '域名', scenes: ['Engine 训练'] },
  { key: 'exit-code-link', name: '退出码链路', category: '其他', scenes: ['Basic'] },
  { key: 'history-log-proxy', name: 'History Log Proxy', category: '其他', scenes: ['Seed 训练'] },
  { key: 'npd-report-link', name: 'NPD 上报链路', category: '故障链路', scenes: ['Basic'] },
  { key: 'kelemetry', name: 'Kelemetry', category: '其他', scenes: ['Basic'] },
  { key: 'karl', name: 'Karl', category: 'Karl', scenes: ['Seed 训练', 'Flow 推理'] },
];

export const STAGE_STATUS_LABEL: Record<string, string> = {
  todo: '待处理',
  doing: '进行中',
  done: '已完成',
  skip: '不适用',
};

export const ENV_STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  doing: '进行中',
  done: '已完成',
  skip: '不适用',
};

export const PHASE_LABEL: Record<string, string> = {
  past: '过去 · 已交付',
  present: '现在 · 在建',
  future: '未来 · 规划',
};
