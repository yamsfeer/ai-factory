/* 机房是一级信息实体；集群只在父机房下展示。 */
(() => {
 const D=window.ROOM_BUILDOUT_DATA,M=window.ROOM_CLUSTER_MODEL,SOP=window.BUILDOUT_SOP;
 const phaseMeta={past:['过去','已交付','ok'],present:['现在','建设中','info'],future:['未来','规划中','violet']};
 const statuses={delivered:['已交付','ok'],building:['建设中','info'],blocked:['有阻塞','warn'],pending:['待开始','neutral'],planned:['规划中','violet']};
 const chip=(label,tone='neutral')=>`<span class="chip chip-${tone}">${esc(label)}</span>`;
 const badge=status=>chip(...statuses[status]);
 const date=d=>d||'待确认';
 const area=r=>r.area==='cn'?'中国':'非中';
  const stage=(object,kind)=>{const list=kind==='room'?SOP.room:SOP.cluster;const idx=kind==='room'?M.roomStage(object):object.stage;return idx>=list.length?'已完成':list[idx]?.name||'待确认';};
  const STAGE_STATUS_LABEL={todo:'待处理',doing:'进行中',done:'已完成',skip:'不适用'};
  /* 只读阶段进度：状态由机房详情中的阶段登记写入，清单不提供修改入口。 */
  const stageTrack=(room)=>{
    const p=M.roomStageProgress(room),idx=M.roomStage(room);
    const segs=SOP.room.map((s,i)=>{const st=M.roomStageStatus(room,i);return `<span class="rb-stage-seg st-${st}" title="${esc((i+1)+'. '+s.name+' · '+STAGE_STATUS_LABEL[st])}"><i></i><em>${i+1}</em></span>`;}).join('');
    const curLabel=idx>=6?'6 / 6 环节完成':`当前：${stage(room,'room')}`;
    const curStatus=idx>=6?'done':M.roomStageStatus(room,idx);
    return `<div class="rb-stage-track-wrap"><div class="rb-stage-track" aria-hidden="true">${segs}</div><div class="rb-stage-track-foot"><span class="rb-current-stage">${esc(curLabel)} · <em class="st-${curStatus}">${STAGE_STATUS_LABEL[curStatus]}</em></span><span class="rb-stage-sync" title="阶段状态在机房详情的阶段登记中人工确认"><span class="mat mat-sm">sync</span>自动同步</span></div></div>`;
  };
 const days=d=>d==null?'—':`${d} 天`;
 const ref=(url,label)=>`<a class="rb-reference" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span class="mat mat-sm">open_in_new</span></a>`;
  function miniSteps(object,kind) {
   const steps=kind==='room'?SOP.room:SOP.cluster;
   const idx=kind==='room'?M.roomStage(object):object.stage;
   const planned=kind==='room'?M.roomPhase(object)==='future':object.phase==='future';
   const cls=(i)=>kind==='room'?`st-${M.roomStageStatus(object,i)}`:(i<idx?'done':i===idx&&!planned?'current':'');
   const mark=(i)=>kind==='room'?(M.roomStageStatus(object,i)==='done'?'✓':M.roomStageStatus(object,i)==='skip'?'–':i+1):(i<idx?'✓':i+1);
   return `<div class="rb-mini-steps ${kind}" aria-label="${kind==='room'?'机房':'集群'}建设阶段">${steps.map((s,i)=>`<span class="${cls(i)}" title="${esc(s.name)}${kind==='room'?' · '+STAGE_STATUS_LABEL[M.roomStageStatus(object,i)]:''}"><i>${mark(i)}</i>${kind==='cluster'?`<b>${s.name}</b>`:''}</span>`).join('')}</div>`;
  }
 function progress(room) {
  const s=room.summary;
  if(s.planned===null)return `<b>${s.matched} 个已录入</b><small>计划总数待确认</small>`;
  return `<b>${s.delivered} / ${s.planned} 已交付</b><div class="rb-small-track"><i style="width:${s.pct||0}%"></i></div>${s.narrowed?'<small>当前筛选子集群</small>':''}`;
 }
  function roomGroup(room,state) {
   const p=M.roomPhase(room);
  const elapsed=p==='past'?M.daysBetween(room.ko,room.delivered):p==='present'?M.daysBetween(room.ko,D.asOf):null;
  return `<article class="rb-room-group" data-room-group="${esc(room.id)}" data-screen-label="${esc(room.name)}">
   <div class="rb-room-row-scroll" role="region" aria-label="${esc(room.name)}机房建设信息" tabindex="0">
    <div class="rb-group-head rb-room-row">
     <div class="rb-room-identity">
      <span class="rb-room-icon"><span class="mat">foundation</span></span>
       <div><div class="rb-room-name-line"><button type="button" class="rb-name-button rb-room-name" data-room="${esc(room.id)}" title="${esc(room.name)}">${esc(room.name)}</button>${room.userRequest?chip('需求登记','violet'):''}</div>
        <div class="rb-room-location" title="${esc(room.region+' · VDC '+(room.vdc||'待确认')+' · '+room.line+' · '+room.tenants.join(' / '))}"><span>${area(room)} · VDC ${esc(room.vdc||'待确认')}</span><span>${esc(room.region)}</span><span>${esc(room.line)}${room.tenants.length?' · '+esc(room.tenants.join(' / ')):''}</span></div>
       </div>
     </div>
      <div class="rb-room-facts">
        <div class="rb-room-sop"><small>机房建设 · 六阶段进度</small>${miniSteps(room,'room')}${stageTrack(room)}</div>
      <div><small>机房负责人</small><b>${esc(room.poc||'待确认')}</b></div>
      <div><small>${p==='future'?'预计启动':'启动时间'}</small><b>${date(room.ko)}</b></div>
      <div><small>${p==='past'?'实际完成':'预计完成'}</small><b>${date(p==='past'?room.delivered:room.target)}</b><small>${elapsed===null?(p==='future'?'尚未启动':'耗时待确认'):`${p==='past'?'总耗时':'已推进'} ${elapsed} 天`}</small></div>
      <div class="rb-cluster-count"><small>集群交付</small>${progress(room)}</div>
     </div>
     <div class="rb-room-title-actions">
      ${room.blocker?`<button type="button" class="rb-room-status-link" data-room="${esc(room.id)}" title="${esc(room.blocker)}" aria-label="查看机房阻塞：${esc(room.blocker)}">${badge(M.roomStatus(room))}</button>`:badge(M.roomStatus(room))}
      <button type="button" class="btn btn-ghost btn-sm" data-room="${esc(room.id)}">机房详情<span class="mat mat-sm">chevron_right</span></button>
     </div>
    </div>
   </div>
  </article>`;
 }
 function hierarchy(scoped,state) {
   let selected=scoped.filter(r=>state.phase==='all'||M.roomPhase(r)===state.phase);
   selected.sort((a,b)=>state.sort==='name'?a.name.localeCompare(b.name,'zh'):state.sort==='owner'?a.poc.localeCompare(b.poc,'zh'):(M.roomPhase(a)==='past'?a.delivered:M.roomPhase(a)==='future'?a.ko||'9999':a.target||'9999').localeCompare(M.roomPhase(b)==='past'?b.delivered:M.roomPhase(b)==='future'?b.ko||'9999':b.target||'9999'));
  const phaseButtons=[['all','全部机房'],...Object.entries(phaseMeta).map(([k,v])=>[k,`${v[0]} · ${v[1]}`])];
  return `<div class="rb-hierarchy-toolbar"><div class="rb-org-chips">${phaseButtons.map(([key,label])=>`<button class="rb-org-chip ${state.phase===key?'active':''}" type="button" data-phase="${key}" aria-pressed="${state.phase===key}">${label}<span class="rb-status-count">${key==='all'?scoped.length:scoped.filter(r=>M.roomPhase(r)===key).length}</span></button>`).join('')}</div><div class="rb-list-actions"><select aria-label="机房排序" data-sort><option value="date"${state.sort==='date'?' selected':''}>按关键日期</option><option value="name"${state.sort==='name'?' selected':''}>按机房名称</option><option value="owner"${state.sort==='owner'?' selected':''}>按负责人</option></select><button type="button" class="btn btn-ghost btn-sm" data-sort-reset>恢复默认排序</button></div></div>
   <div class="rb-hierarchy-meta"><b>${selected.length} 个机房</b><span>机房行：建设进度与排期</span><span class="rb-hint-inline"><span class="mat mat-sm">open_in_new</span>机房内集群请在「机房详情」中查看与登记</span></div>
   <div class="rb-room-groups">${selected.length?selected.map(r=>roomGroup(r,state)).join(''):`<div class="rb-empty"><span class="mat">search_off</span><b>当前筛选下没有机房</b><p>尝试切换阶段或清除搜索与筛选条件。</p><button type="button" class="btn btn-soft btn-sm" data-reset>重置筛选</button></div>`}</div>`;
 }
 function timeline(scoped,state) {
  const months=M.timelineMonths(scoped),today=M.timelinePosition(D.asOf,months);
  const legend=`<div class="rb-timeline-tools"><div class="rb-tl-legend">${Object.entries(phaseMeta).map(([,v])=>`<span class="legend-item"><span class="legend-swatch tone-${v[2]}"></span>${v[0]} · ${v[1]}</span>`).join('')}<span class="legend-item"><span class="rb-tl-today-key"></span>示例基准 ${D.asOf}</span></div><button class="btn btn-ghost btn-sm" type="button" data-timeline-expand>${state.timelineExpanded?'收起时间线':'展开完整时间线'}<span class="mat mat-sm">${state.timelineExpanded?'unfold_less':'unfold_more'}</span></button></div>`;
  if(!scoped.length)return '<div class="rb-empty-inline">当前筛选无可展示机房</div>';
  const scale=months.length?months.map((m,i)=>{const left=M.timelinePosition(m.key+'-01',months),next=i===months.length-1?100:M.timelinePosition(months[i+1].key+'-01',months);return `<span style="left:${left}%;width:${next-left}%">${m.label}</span>`;}).join(''):'';
  const rows=M.phaseGroups(scoped).filter(g=>g.rooms.length).map(g=>`<div class="rb-tl-phase-label tone-${phaseMeta[g.phase][2]}">${M.PHASE_LABEL[g.phase]} · ${g.rooms.length} 个机房${!state.timelineExpanded&&g.rooms.length>2?" · 预览 2 个":""}</div>`+(state.timelineExpanded?g.rooms:g.rooms.slice(0,2)).map(r=>{
   const rp=M.roomPhase(r);
    const bar=M.timelineBar(r,months),label=rp==='past'?`已交付 ${date(r.delivered)}`:rp==='future'?'预计启动 '+(r.ko?date(r.ko):'待定')+(r.target?' · 目标 '+date(r.target):''):`目标 ${date(r.target)} · 当前 ${stage(r,'room')}`;
    return `<div class="rb-tl-row"><button type="button" class="rb-tl-name rb-name-button" data-room="${r.id}" title="${esc(r.name)}">${esc(r.name)}${r.userRequest?'<span class="rb-tl-req"></span>':''}<small>${esc(r.poc)} · ${area(r)}</small></button><div class="rb-tl-track" style="--months:${months.length||1}">${bar?`<button type="button" data-room="${r.id}" class="rb-tl-bar tone-${phaseMeta[rp][2]} ${bar.milestone?'milestone':''}" style="left:${bar.left}%;width:${bar.width}%" aria-label="${esc(r.name+' '+label)}" title="${esc(label)}"></button>${bar.openEnd?`<span class="rb-tl-open-hint" style="left:${bar.left}%">仅完成节点 · 补预计启动即显示时间段</span>`:''}`:r.ko||r.target?'<span class="rb-tl-unknown">缺少预计启动时间 · 仅有完成节点</span>':'<span class="rb-tl-unknown">排期待确认 · 阶段在机房详情登记</span>'}</div><span class="rb-tl-end" title="${esc(label)}">${rp==='past'?date(r.delivered):rp==='future'?r.ko?date(r.ko):date(r.target||'待定'):`${date(r.target)}`}</span></div>`;
  }).join('')).join('');
  return `${legend}<div class="rb-timeline-scroll ${state.timelineExpanded?'full':''}"><div class="rb-timeline-inner"><div class="rb-tl-header"><b>机房 / 负责人</b><div class="rb-tl-scale-new">${scale}</div><b>完成 / 预计启动</b></div><div class="rb-tl-body">${today!==null&&today>=0&&today<=100?`<span class="rb-tl-today" style="left:calc(var(--rb-tl-label) + (100% - var(--rb-tl-label) - var(--rb-tl-end)) * ${today/100})"></span>`:''}${rows}</div></div></div><p class="rb-data-note">横条为启动 → 完成 / 目标；菱形为仅有目标日期的里程碑。时间线默认各阶段预览最多 2 个机房，展开后查看全部；随区域、业务与搜索联动。</p>`;
 }
 function phaseCards(scoped,state) {
  return `<div class="rb-phase-grid">${M.phaseGroups(scoped).map(g=>{const t=M.totals(g.rooms),[time,label,tone]=phaseMeta[g.phase];return `<button type="button" class="rb-phase-card tone-${tone} ${state.phase===g.phase?'active':''}" data-phase="${g.phase}" aria-pressed="${state.phase===g.phase}"><div class="rb-phase-card-head"><span class="rb-phase-mark tone-${tone}"><span class="mat">${g.phase==='past'?'task_alt':g.phase==='present'?'pending_actions':'event_upcoming'}</span></span><div><b>${time} · ${label}机房</b><small>${g.phase==='past'?'何时交付 · 谁负责':g.phase==='present'?'当前进度 · 目标时间 · 阻塞':'何时启动 · 计划建什么'}</small></div><strong>${g.rooms.length}<small>个机房</small></strong></div><div class="rb-phase-card-stats">${g.phase==='past'?`<span><b>${t.delivered}</b> 集群已交付</span><span>机房平均 <b>${days(t.avgRoomDays)}</b></span>`:g.phase==='present'?`<span><b>${t.building}</b> 集群在建</span><span class="rb-blocked-count"><b>${t.blocked}</b> 集群阻塞</span>`:`<span><b>${t.recorded}</b> 集群规划已录入</span><span><b>${t.unplannedRooms}</b> 机房计划待补充</span>`}</div></button>`;}).join('')}</div>`;
 }
 window.BUILDOUT_VIEW={phaseMeta,statuses,chip,badge,date,area,stage,days,ref,miniSteps,progress,hierarchy,timeline,phaseCards};
})();
