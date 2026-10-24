/* 机房建设需求登记：仅保存在浏览器本地（localStorage），不写入生产系统。
   fields 以机房子项 id 为键保存填写内容（日期 / 负责人 / 文本 / 勾选）。 */
(() => {
  const KEY='room-buildout-requests-v2';
  const CLUSTER_KEY='room-buildout-clusters-v1';
  const uid=()=>'req-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  const clampStage=n=>Math.max(0,Math.min(6,Math.trunc(n)||0));
  const STAGE_KEYS=['todo','doing','done','skip'];
  /* 六个阶段的状态（待处理 / 进行中 / 已完成 / 不适用）决定机房当前进度：
     从第一阶段起，第一个未完成（非 done / skip）的阶段即当前阶段；全部完成则为 6。 */
  function deriveStage(stageStatus) {
    for(let i=0;i<6;i++){const st=stageStatus?.[i];if(st!=='done'&&st!=='skip')return i;}
    return 6;
  }
  function load() {
    try { const list=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(list)?list:[]; }
    catch { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY,JSON.stringify(list)); } catch { /* 隐私模式等场景静默降级 */ }
  }
  function toRoom(req) {
    const fields=req.fields||{};
    // 映射为视图层通用的机房实体：登记后处于第一阶段，排期与负责人取自登记内容，其余待确认。
    return {
      id:req.id,name:req.name,vdc:null,area:req.area||'cn',region:'待确认',line:'待确认',
      tenants:fields['business-side']?[fields['business-side']]:[],
      poc:fields['poc-room']||'待确认',
      phase:'future',ko:fields['ko-plan']||null,target:fields['deploy-estimate']||null,delivered:null,
      planCount:null,source:null,org:'internal',action:'build',stage:deriveStage(req.stageStatus),blocker:'',
      demo:true,userRequest:true,createdAt:req.createdAt,envStatus:req.envStatus||{},fields,
      stageStatus:req.stageStatus||{},stageMeta:req.stageMeta||{},customEnv:Array.isArray(req.customEnv)?req.customEnv:[],
      note:'机房建设需求登记'
    };
  }
  function list() { return load(); }
  /* ===== 机房内集群登记：按机房归档，同样只存本浏览器 ===== */
  function loadClusters() {
    try { const list=JSON.parse(localStorage.getItem(CLUSTER_KEY)||'[]'); return Array.isArray(list)?list:[]; }
    catch { return []; }
  }
  function saveClusters(list) {
    try { localStorage.setItem(CLUSTER_KEY,JSON.stringify(list)); } catch { /* 隐私模式等场景静默降级 */ }
  }
  function toCluster(req) {
    const stage=Number.isInteger(req.stage)?Math.max(0,Math.min(6,req.stage)):0;
    return {
      id:req.id,roomId:req.roomId,name:req.name,
      vdc:req.vdc||null,group:req.group||null,type:req.type||'训练',tenant:req.tenant||'待确认',owner:req.owner||'待确认',
      phase:req.target?'future':'future',start:req.start||null,target:req.target||null,delivered:null,
      stage,blocker:'',next:'推进集群六阶段建设',demo:true,userRequest:true,createdAt:req.createdAt
    };
  }
  function clusters() { return loadClusters().map(toCluster); }
  function addCluster(roomId,opts={}) {
    const req={id:'clu-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),roomId,
      name:String(opts.name||'').trim(),vdc:opts.vdc||'',group:opts.group||'',type:opts.type||'训练',
      tenant:opts.tenant||'',owner:opts.owner||'',start:opts.start||'',target:opts.target||'',
      stage:0,createdAt:new Date().toISOString()};
    const all=loadClusters();all.unshift(req);saveClusters(all);return toCluster(req);
  }
  function removeCluster(id) { saveClusters(loadClusters().filter(c=>c.id!==id)); }
  function setClusterStage(id,stage) {
    const next=Math.max(0,Math.min(6,Math.trunc(stage)||0));
    saveClusters(loadClusters().map(c=>c.id===id?{...c,stage:next}:c));
  }
  function hasCluster(id) { return loadClusters().some(c=>c.id===id); }
  function rooms() { return load().map(toRoom); }
  function add(name,opts={}) {
    const req={
      id:uid(),name:String(name||'').trim(),area:opts.area||'cn',
      fields:opts.fields&&typeof opts.fields==='object'?opts.fields:{},
      createdAt:new Date().toISOString()
    };
    const all=load();all.unshift(req);save(all);return req;
  }
  function remove(id) { save(load().filter(r=>r.id!==id)); }
  function update(id,patch) { save(load().map(r=>r.id===id?{...r,...patch}:r)); }
  function has(id) { return load().some(r=>r.id===id); }
  globalThis.BUILDOUT_STORE={list,rooms,add,remove,update,has,clusters,addCluster,removeCluster,setClusterStage,hasCluster};
})();
