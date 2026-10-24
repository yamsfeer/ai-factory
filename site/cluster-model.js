/* stage = 已完成的阶段数；room 与 cluster 生命周期分别记录。 */
(() => {
  const STAGES = ['确认需求','资源准备+机器重装','BKE创建','人工补齐','交付前检查','后置通知'];
  const PHASES = ['past','present','future'];
  const PHASE_LABEL = {past:'过去 · 已交付',present:'现在 · 在建',future:'未来 · 规划'};
  const clusterStatus = c => c.stage >= 6 ? 'delivered' : c.phase === 'future' ? 'planned' : c.blocker ? 'blocked' : c.phase === 'present' ? 'building' : 'pending';
  const clusterPhase = c => c.stage >= 6 ? 'past' : c.phase === 'future' ? 'future' : 'present';
  /* 机房六阶段：手动 stage 优先；示例数据未显式给阶段时，由时间阶段兜底推导。 */
  const roomStage = r => Number.isInteger(r.stage) ? Math.max(0, Math.min(6, r.stage)) : r.phase === 'past' ? 6 : r.phase === 'present' ? 4 : 0;
  const roomPhase = r => roomStage(r) >= 6 ? 'past' : roomStage(r) > 0 ? 'present' : 'future';
  /* 六阶段状态：待处理 / 进行中 / 已完成 / 不适用。详情侧拉登记写入；未登记时按当前进度兜底。 */
  const ROOM_STAGE_STATUS = ['todo','doing','done','skip'];
  const roomStageStatus = (r,i) => {
    const v = r.stageStatus?.[i];
    if (ROOM_STAGE_STATUS.includes(v)) return v;
    const cur = roomStage(r);
    return i < cur ? 'done' : (i === cur && cur < 6 ? 'doing' : 'todo');
  };
  /* 进度统计：completed 为已完成 / 不适用数量，current 为当前推进阶段（全部完成则 6）。 */
  function roomStageProgress(r) {
    const stages = r.stageStatus || {};
    const counts = {todo:0,doing:0,done:0,skip:0};
    for (let i = 0; i < 6; i++) counts[roomStageStatus(r,i)]++;
    let current = 6;
    for (let i = 0; i < 6; i++) { const st = stages[i]; if (st !== 'done' && st !== 'skip') { current = i; break; } }
    return {counts,current,completed:counts.done + counts.skip,done:counts.done,doing:counts.doing,todo:counts.todo,skip:counts.skip};
  }
  const roomStatus = r => roomPhase(r) === 'past' ? 'delivered' : roomPhase(r) === 'future' ? 'planned' : r.blocker ? 'blocked' : 'building';
  /* 合并示例机房与用户登记的需求；同名需求去重，保留先登记的一条。 */
  function mergeRequests(rooms, requestRooms = []) {
    const names = new Set(rooms.map(r => r.name));
    const seen = new Set();
    const extras = [];
    for (const r of requestRooms) {
      if (names.has(r.name) || seen.has(r.name)) continue;
      seen.add(r.name); extras.push(r);
    }
    return extras.length ? [...extras, ...rooms] : rooms;
  }
  function day(d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return null;
    const n=Date.parse(d+'T00:00:00Z');
    return Number.isFinite(n) && new Date(n).toISOString().slice(0,10) === d ? n : null;
  }
  function daysBetween(a,b) { const x=day(a),y=day(b); return x===null || y===null || y<x ? null : (y-x)/86400000; }
  function clusterDuration(c,asOf) {
    const actual=clusterPhase(c)==='future' ? null : c.actualDays ?? daysBetween(c.start,c.delivered || asOf);
    const sla=c.slaDays ?? null;
    return {sla,actual,over:actual===null || sla===null ? null : actual-sla};
  }
  function roomDuration(r) {
    const planned=daysBetween(r.ko,r.target),actual=daysBetween(r.ko,r.delivered);
    return {planned,actual,over:planned===null || actual===null ? null : actual-planned};
  }
  const textMatch=(object,q)=>Object.values(object).filter(v=>typeof v==='string'||Array.isArray(v)).join(' ').toLowerCase().includes(q);
  function roomSummary(room,clusters,filters={}) {
    const all=clusters.filter(c=>c.roomId===room.id);
    let scoped=all.filter(c=>(!filters.tenant||c.tenant===filters.tenant)&&(!filters.type||c.type===filters.type));
    const query=(filters.query||'').trim().toLowerCase();
    if (query && !textMatch(room,query)) scoped=scoped.filter(c=>textMatch(c,query));
    const narrowed=filters.tenant||filters.type||(query&&!textMatch(room,query));
    const planned=room.planCount==null ? null : narrowed ? scoped.length : room.planCount;
    const count=status=>scoped.filter(c=>clusterStatus(c)===status).length;
    const delivered=count('delivered'),blocked=count('blocked'),building=count('building'),pending=count('pending'),future=count('planned');
    return {clusters:scoped,matched:scoped.length,total:all.length,planned,delivered,blocked,building,pending,future,pct:planned>0?Math.round(delivered/planned*100):null,status:roomStatus(room),narrowed:Boolean(narrowed)};
  }
  function selectRooms(rooms,clusters,filters={}) {
    const q=(filters.query||'').trim().toLowerCase();
    return rooms.filter(r=>r.org==='internal'&&r.action==='build')
      .filter(r=>!filters.area||r.area===filters.area)
      .filter(r=>!filters.line||r.line===filters.line)
      .map(r=>({...r,summary:roomSummary(r,clusters,filters)}))
      .filter(r=>(!filters.type||r.summary.matched>0)&&(!filters.tenant||r.tenants.includes(filters.tenant)||r.summary.matched>0))
      .filter(r=>!q||textMatch(r,q)||r.summary.matched>0);
  }
  const phaseGroups = rooms => PHASES.map(phase=>({phase,label:PHASE_LABEL[phase],rooms:rooms.filter(r=>roomPhase(r)===phase)}));
  function totals(rooms) {
    const t={rooms:rooms.length,past:0,present:0,future:0,planned:0,delivered:0,blocked:0,building:0,pending:0,unplannedRooms:0,recorded:0};
    for(const r of rooms){t[roomPhase(r)]++; const s=r.summary;t.recorded+=s.matched;if(s.planned===null)t.unplannedRooms++;else t.planned+=s.planned;for(const k of ['delivered','blocked','building','pending'])t[k]+=s[k];}
    const durations=rooms.filter(r=>roomPhase(r)==='past').map(roomDuration).map(d=>d.actual).filter(x=>x!==null);
    t.avgRoomDays=durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null;
    return t;
  }
  function timelineMonths(rooms) {
    const dates=rooms.flatMap(r=>[r.ko,r.target,r.delivered]).filter(d=>day(d)!==null);
    if(!dates.length)return [];
    const idx=d=>+d.slice(0,4)*12 + +d.slice(5,7)-1;
    const min=Math.min(...dates.map(idx)),max=Math.max(...dates.map(idx));
    return Array.from({length:max-min+1},(_,i)=>{const n=min+i;return {key:`${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`,idx:n,label:`${Math.floor(n/12)}/${String(n%12+1).padStart(2,'0')}`};});
  }
  function timelineBounds(months) {
    if(!months.length)return null;
    const last=months.at(-1).idx;
    return [day(months[0].key+'-01'),Date.UTC(Math.floor((last+1)/12),(last+1)%12,1)];
  }
  function timelinePosition(date,months) {
    const d=day(date),bounds=timelineBounds(months);
    return d===null||!bounds?null:(d-bounds[0])/(bounds[1]-bounds[0])*100;
  }
  function timelineBar(room,months) {
    const end=room.delivered||room.target;
    if(!room.ko&&!end)return null;
    const bounds=timelineBounds(months);if(!bounds)return null;
    if(!room.ko){const left=timelinePosition(end,months);return left===null?null:{left,width:0,milestone:true,openEnd:true};}
    const left=timelinePosition(room.ko,months),right=timelinePosition(end||room.ko,months);
    if(left===null||right===null||right<left)return null;
    return {left,width:Math.min(100-left,(right-left)+86400000/(bounds[1]-bounds[0])*100),milestone:!end,openEnd:!end};
  }
  globalThis.ROOM_CLUSTER_MODEL={STAGES,PHASES,PHASE_LABEL,ROOM_STAGE_STATUS,clusterStatus,clusterPhase,roomStage,roomStageStatus,roomStageProgress,roomPhase,roomStatus,roomSummary,roomDuration,clusterDuration,selectRooms,mergeRequests,phaseGroups,totals,timelineMonths,timelineBar,timelinePosition,daysBetween};
})();
