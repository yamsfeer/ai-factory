/* 机房概览与集群详情共享抽屉；流程定义集中在 sop-data.js。 */
(() => {
  const D=window.ROOM_BUILDOUT_DATA,M=window.ROOM_CLUSTER_MODEL,V=window.BUILDOUT_VIEW,SOP=window.BUILDOUT_SOP,A=window.BUILDOUT_ACTIONS;
  let previousFocus=null,currentRoom='',currentCluster='',sourceMode=false,stagePanel=-1,clusterForm=false;
  const fact=(label,value)=>`<div><small>${esc(label)}</small><b>${esc(value??'待确认')}</b></div>`;
  const sourceFor=room=>D.sources.find(s=>s.id===room.source);
  const STAGE_STATUS_LABEL={todo:'待处理',doing:'进行中',done:'已完成',skip:'不适用'};
  const ENV_STATUS_LABEL_CN={pending:'待处理',doing:'进行中',done:'已完成',skip:'不适用'};
  function envBlock(room,item) {
    const status=A.envStatus(room,item.id),scenes=item.scenes.join('')==='*'?'全场景':item.scenes.join(' / ');
    return `<button type="button" class="rb-env-block st-${status}" data-env-item="${esc(item.id)}" title="${esc(item.category)} · ${esc(scenes)}：点击切换状态"><span class="rb-env-top"><i class="rb-env-dot" aria-hidden="true"></i><em>${ENV_STATUS_LABEL_CN[status]}</em></span><b>${esc(item.name)}</b><small><span>${esc(item.category)}</span><span>${esc(scenes)}</span></small></button>`;
  }
  function allEnvItems(room){return [...SOP.envItems,...A.customEnv(room)];}
  function envBlocks(room,opts={}) {
    const items=allEnvItems(room);
    const cats=['Basic','域名','其他','故障链路','Karl'];[...new Set(items.map(x=>x.category))].forEach(c=>{if(!cats.includes(c))cats.push(c);});
    const groups=cats.map(cat=>({cat,items:items.filter(x=>x.category===cat)})).filter(g=>g.items.length);
    const counts=A.ENV_ORDER.reduce((acc,k)=>(acc[k]=items.filter(x=>A.envStatus(room,x.id)===k).length,acc),{});
    return `<div class="rb-env-wrap"><div class="rb-env-legend"><b>${opts.title||'机房环境项'}</b><span>点击方块切换 待处理 → 进行中 → 已完成 → 不适用</span><span class="rb-env-counts">${A.ENV_ORDER.map(k=>`<span class="lg st-${k}"><i></i>${ENV_STATUS_LABEL_CN[k]} <b>${counts[k]}</b></span>`).join('')}</span></div>${groups.map(g=>`<div class="rb-env-cat"><span class="rb-env-cat-name">${esc(g.cat)}</span><div class="rb-env-grid">${g.items.map(it=>envBlock(room,it)).join('')}</div></div>`).join('')}${opts.add?envAddRow():''}</div>`;
  }
  function envAddRow(){
    return `<div class="rb-env-add"><input type="text" data-envadd="name" maxlength="40" placeholder="环境项名称，如 TLB - XX" /><input type="text" data-envadd="category" maxlength="12" placeholder="分类，如 域名" /><input type="text" data-envadd="scene" maxlength="30" placeholder="场景，如 Seed 训练" /><button type="button" class="btn btn-soft btn-sm" data-envadd-submit><span class="mat mat-sm">add</span>添加</button></div>`;
  }
  function filledCount(room,items){const real=items.filter(it=>it.type!=='env');return real.filter(it=>A.fieldValue(room,it.id)).length;}
  function realCount(stage){return stage.items.filter(it=>it.type!=='env').length;}
  function stageSummary(room,s,i){
    const parts=[];
    const owner=A.stageMetaValue(room,i,'owner');if(owner)parts.push('负责人 '+owner);
    parts.push(filledCount(room,s.items)+'/'+realCount(s)+' 项已填');
    return parts.join(' · ');
  }
  function roomSop(room) {
    return `<div class="rb-stage-heading"><b>机房建设阶段</b><span>点击任一阶段，侧拉登记进展与子项</span></div>
    <ol class="rb-stage-list rb-stage-cards">${SOP.room.map((s,i)=>{const st=A.stageStatus(room,i),filled=filledCount(room,s.items),total=realCount(s);
    return `<li class="stg-${st}"><button type="button" class="rb-stage-card" data-stage-panel="${i}"><span class="rb-stage-mark">${st==='done'?'✓':i+1}</span><span class="rb-stage-card-main"><span class="rb-stage-card-top"><b>${esc(s.name)}</b><em class="rb-stage-pill st-${st}">${STAGE_STATUS_LABEL[st]}</em></span><small>${esc(s.meaning)}</small><small class="rb-stage-card-meta">${esc(stageSummary(room,s,i))}</small></span><span class="rb-stage-card-go ${filled===total?'all':''}"><span class="mat">chevron_right</span></span></button></li>`;}).join('')}</ol>`;
  }
  function sopHTML(object,kind) {
   if(kind==='room')return roomSop(object);
   const list=SOP.cluster,planned=object.phase==='future';
   return `<div class="rb-stage-heading"><b>集群建设阶段</b><span>${Math.min(object.stage,list.length)} / ${list.length} 环节完成 · 示例</span></div>
    <ol class="rb-stage-list">${list.map((s,i)=>{const done=i<object.stage,active=i===object.stage&&!planned,status=done?'已完成':active?(object.blocker?'有阻塞':'进行中'):'待开始';return `<li class="${done?'done':active?(object.blocker?'blocked':'current'):''}"><span class="rb-stage-mark">${done?'✓':i+1}</span><div><b>${esc(s.name)}</b><small>${esc(s.meaning)}</small><details class="rb-sop-items"${active?' open':''}><summary>${s.items.length} 个子项 · 查看明细</summary><ul>${s.items.map(item=>`<li>${s.url?V.ref(s.url,item):esc(item)}</li>`).join('')}</ul></details></div><span class="rb-stage-state">${status}</span></li>`;}).join('')}</ol>`;
  }
  function roomContent(room) {   const s=M.roomSummary(room,A.allClusters()),d=M.roomDuration(room),rp=M.roomPhase(room),F=id=>A.fieldValue(room,id);
   const facts=room.userRequest
    ? `${fact('区域',V.area(room))}${fact('业务方',F('business-side')||'待确认')}${fact('机房 PoC',F('poc-room')||'待确认')}${fact('项目 PoC',F('poc-project')||'待确认')}${fact('预算 PoC',F('poc-budget')||'待确认')}${fact('BKE & TCE PoC',F('poc-bke-tce')||'待确认')}${fact('业务 PoC',F('poc-business')||'待确认')}${fact('机器到付时间',V.date(F('gpu-arrival')||null))}${fact('机房部署时间',V.date(F('deploy-estimate')||null))}${fact('计划集群',s.matched?('已录入 '+s.matched):'总数待确认')}`
    : `${fact('Region / VDC',room.region+' / '+(room.vdc||'待确认'))}${fact('机房负责人',room.poc)}${fact('建设方向 / 业务',(room.tenants&&room.tenants.length)?room.line+' / '+room.tenants.join(' / '):room.line)}${fact('计划集群',s.planned===null?'总数待确认 · 已录入 '+s.matched:s.planned+' 个')}${fact(rp==='future'?'预计启动':'启动时间',V.date(room.ko))}${fact(rp==='past'?'实际完成':'预计完成',V.date(rp==='past'?room.delivered:room.target))}${fact('机房耗时',rp==='future'?'未启动':rp==='past'?V.days(d.actual):V.days(M.daysBetween(room.ko,D.asOf)))}${fact('集群交付',`${s.delivered} 个已交付 · ${s.blocked} 个阻塞`)}`;
   return `<section class="rb-cluster-detail"><div class="rb-cluster-detail-head"><div><span class="rb-eyebrow">机房建设 · 内场 · ${V.area(room)}${room.userRequest?' · 需求登记':''}</span><h3>${esc(room.name)}</h3></div>${V.badge(M.roomStatus(room))}</div>
   <div class="rb-cluster-facts">${facts}</div>
   ${sopHTML(room,'room')}
   <div class="rb-next-action ${room.blocker?'blocked':''}"><span class="mat mat-sm">${room.blocker?'error_outline':'arrow_forward'}</span><div><b>${room.blocker?'机房阻塞':'下一步'}</b><p>${esc(room.blocker||(rp==='past'?'完成交付归档，保留验收记录':rp==='future'?'在上方手动维护建设阶段，补充启动时间、机房资源与集群建设计划':`推进${V.stage(room,'room')}，跟踪机房内集群交付`))}</p></div></div>
   ${room.userRequest?`<div class="rb-request-note"><span class="mat mat-sm">how_to_reg</span><div><b>机房建设需求登记</b><p>${room.createdAt?'登记于 '+new Date(room.createdAt).toLocaleDateString('zh-CN')+' · ':''}点击上方任一阶段，可在右侧面板登记阶段状态、子项内容、负责人、计划 / 完成时间与备注；机房部署阶段还可维护环境项。内容保存在本浏览器。</p></div><button type="button" class="btn btn-ghost btn-sm" data-delete-request="${esc(room.id)}"><span class="mat mat-sm">delete</span>删除登记</button></div>`:''}
   ${room.note?`<p class="rb-data-note">${esc(room.note)}</p>`:''}
   <div class="rb-detail-links">${sourceFor(room)?V.ref(sourceFor(room).url,'机房参考资料'):''}</div><p class="rb-data-note">机房六阶段（确认机房信息 → 机房预算提交 & 3V创建 → 机房 KO → 机房部署 → 机房检查 → 完成）按本轮要求归并；点击阶段卡片可侧拉登记进展，阶段状态（待处理 / 进行中 / 已完成 / 不适用）会自动推进机房当前进度，同步清单与时间线；机房部署阶段含环境项方块（待处理 / 进行中 / 已完成 / 不适用）并支持自定义添加。日期、负责人等为原型示例；机房交付独立验收，集群全部完成不自动表示机房已交付。</p></section>`;
  }
 function clusterContent(c,room) {
  const d=M.clusterDuration(c,D.asOf);
  return `<section class="rb-cluster-detail"><div class="rb-cluster-detail-head"><div><span class="rb-eyebrow">${esc(room.name)} › 集群建设</span><h3>${esc(c.name)}</h3></div>${V.badge(M.clusterStatus(c))}</div>
   <div class="rb-cluster-facts">${fact('所属机房',room.name)}${fact('VDC / 集群组',(c.vdc||'待确认')+' / '+(c.group||'待确认'))}${fact('集群负责人',c.owner)}${fact('类型 / 业务',c.type+' / '+c.tenant)}${fact('启动时间',V.date(c.start))}${fact(M.clusterPhase(c)==='past'?'实际交付':'预计交付',V.date(M.clusterPhase(c)==='past'?c.delivered:c.target))}${fact('累计耗时',M.clusterPhase(c)==='future'?'未启动':V.days(d.actual))}${fact('SLA（示例）',V.days(d.sla))}</div>
   ${sopHTML(c,'cluster')}
   <div class="rb-next-action ${c.blocker?'blocked':''}"><span class="mat mat-sm">${c.blocker?'error_outline':'arrow_forward'}</span><div><b>${c.blocker?'当前阻塞':'下一步'}</b><p>${esc(c.blocker||c.next)}</p>${c.blocker?`<small>${esc(c.next)}</small>`:''}</div></div>
   <div class="rb-detail-links">${V.ref(D.sources.find(s=>s.id==='cluster-sop').url,'六阶段 SOP 原文')}${sourceFor(room)?V.ref(sourceFor(room).url,'搭建记录'):''}</div><p class="rb-data-note">六阶段名称、说明与子项来自《集群管理设计》rev246；子项展开只展示规范内容，不代表已核验执行。集群阶段、日期、耗时与阻塞为演示。</p></section>`;
 }
  function stageField(room,it){
    const val=A.fieldValue(room,it.id);
    if(it.type==='date')return `<input type="date" data-field="${esc(it.id)}" value="${esc(val)}" />`;
    if(it.type==='check')return `<label class="rb-sp-check"><input type="checkbox" data-field="${esc(it.id)}" ${val==='1'?'checked':''} /><span>${val==='1'?'已确认':'待确认'}</span></label>`;
    return `<input type="text" maxlength="160" data-field="${esc(it.id)}" value="${esc(val)}" placeholder="${esc(it.placeholder||'填写后自动保存')}" />`;
  }
  function stageItemsSection(room,s){
    const rows=s.items.filter(it=>it.type!=='env').map(it=>{
      const filled=!!A.fieldValue(room,it.id);
      return `<label class="rb-sp-field ${it.wide?'span-2':''} ${filled?'is-filled':''}"><span>${esc(it.label)}</span><small class="rb-sp-desc">${esc(it.desc)}</small>${stageField(room,it)}</label>`;
    }).join('');
    return `<section class="rb-sp-section"><div class="rb-sp-section-head"><b>${esc(s.panelTitle||s.name)}</b><span>${esc(s.panelHint||'')}</span></div><div class="rb-sp-grid">${rows}</div></section>`;
  }
  function stageClusterCards(room){
    const list=A.allClusters().filter(c=>c.roomId===room.id);
    const addBtn=`<button type="button" class="btn btn-ghost btn-sm" data-cluster-add><span class="mat mat-sm">add</span>登记集群</button>`;
    if(!list.length)return `<div class="rb-sp-clusters-empty"><p class="rb-data-note">暂无已录入集群，可登记该机房下需要建设的集群。</p>${addBtn}</div>`;
    return `<div class="rb-sp-clusters">${list.map(c=>`<div class="rb-sp-cluster"><b>${esc(c.name)}</b><span class="rb-cluster-dot ${M.clusterStatus(c)}"></span><small>${esc(c.type)} · ${esc(V.stage(c,'cluster'))}</small></div>`).join('')}</div>${addBtn}`;
  }
  /* 登记机房内集群：名称必填，同机房内不可重名；登记后可继续在集群详情维护六阶段。 */
  function clusterFormHTML(room){
    const types=['训练','推理','存储','通用','控制面'];
    return `<section class="rb-cluster-detail"><div class="rb-cluster-detail-head"><div><span class="rb-eyebrow">${esc(room.name)} › 机房内集群</span><h3>登记集群</h3></div></div>
     <p class="rb-data-note">登记后出现在左側「机房内集群」中，并计入该机房的集群交付数；集群名称必填，其余可稍后在集群详情中补充。内容保存在本浏览器。</p>
     <div class="rb-cluster-form rb-sp-section">
      <div class="rb-sp-grid">
       <label class="rb-sp-field span-2"><span>集群名称 <i>*</i></span><small class="rb-sp-desc">用于清单与详情展示，如 Core ×1</small><input type="text" maxlength="40" data-cf="name" placeholder="例如：Core ×1" autocomplete="off" /></label>
       <label class="rb-sp-field"><span>VDC</span><input type="text" maxlength="20" data-cf="vdc" placeholder="如 vdc-01" autocomplete="off" /></label>
       <label class="rb-sp-field"><span>集群组</span><input type="text" maxlength="30" data-cf="group" placeholder="如 Seed 训练组" autocomplete="off" /></label>
       <label class="rb-sp-field"><span>集群类型</span><select data-cf="type">${types.map(t=>`<option value="${t}">${t}</option>`).join('')}</select></label>
       <label class="rb-sp-field"><span>业务方</span><input type="text" maxlength="30" data-cf="tenant" placeholder="如 Seed" autocomplete="off" /></label>
       <label class="rb-sp-field"><span>集群负责人</span><input type="text" maxlength="20" data-cf="owner" placeholder="填写负责人姓名" autocomplete="off" /></label>
       <label class="rb-sp-field"><span>预计启动</span><input type="date" data-cf="start" /></label>
       <label class="rb-sp-field span-2"><span>预计交付</span><input type="date" data-cf="target" /></label>
      </div>
      <p class="rb-modal-error" data-cf-error hidden></p>
      <div class="rb-cluster-form-foot"><button type="button" class="btn btn-primary btn-sm" data-cluster-submit><span class="mat mat-sm">add</span>登记集群</button><button type="button" class="btn btn-ghost btn-sm" data-cluster-cancel>取消</button><span>登记后可在集群详情中维护六阶段</span></div>
     </div>
    </section>`;
  }
  function stagePanelHTML(room){
    const i=stagePanel;if(i<0)return '';
    const s=SOP.room[i],st=A.stageStatus(room,i);
    const meta=(k)=>A.stageMetaValue(room,i,k);
    return `<div class="rb-stage-panel" role="dialog" aria-modal="false" aria-label="${esc(s.name)}登记">
      <div class="rb-sp-head"><div><b>${esc(s.name)}</b><span>${esc(room.name)} › 阶段登记 · 人工确认</span></div><button type="button" class="btn btn-ghost btn-sm" data-stage-panel-close aria-label="关闭阶段登记"><span class="mat mat-sm">close</span></button></div>
      <div class="rb-sp-body">
        <section class="rb-sp-section"><div class="rb-sp-section-head"><b>阶段状态</b><span>人工确认当前进展</span></div><div class="rb-sp-status">${['todo','doing','done','skip'].map(k=>`<button type="button" class="rb-sp-status-btn ${k===st?'active':''} st-${k}" data-stage-status="${k}">${STAGE_STATUS_LABEL[k]}</button>`).join('')}</div></section>
        ${stageItemsSection(room,s)}
        ${s.env?`<section class="rb-sp-section">${envBlocks(room,{title:'机房环境项',add:true})}</section><section class="rb-sp-section"><div class="rb-sp-section-head"><b>业务集群</b><span>该机房下涉及建设的集群 · ${A.allClusters().filter(c=>c.roomId===room.id).length} 个</span></div>${stageClusterCards(room)}</section>`:''}
        <section class="rb-sp-section"><div class="rb-sp-section-head"><b>阶段登记</b><span>人工填写并保存</span></div>
          <div class="rb-sp-grid">
            <label class="rb-sp-field"><span>阶段负责人</span><input type="text" maxlength="20" data-meta="owner" value="${esc(meta('owner'))}" placeholder="填写负责人姓名" /></label>
            <label class="rb-sp-field"><span>计划时间</span><input type="date" data-meta="plan" value="${esc(meta('plan'))}" /></label>
            <label class="rb-sp-field"><span>完成时间</span><input type="date" data-meta="done" value="${esc(meta('done'))}" /></label>
            <label class="rb-sp-field span-2"><span>备注</span><textarea rows="3" maxlength="300" data-meta="note" placeholder="补充单号、会议纪要链接或其他说明">${esc(meta('note'))}</textarea></label>
          </div>
        </section>
      </div>
      <div class="rb-sp-foot"><button type="button" class="btn btn-primary btn-sm" data-stage-panel-close><span class="mat mat-sm">check</span>保存登记</button><span>保存后同步到机房建设清单与时间线</span></div>
    </div>`;
  }
  function renderRoom() {
   const r=A.findRoom(currentRoom);if(!r)return;
   const clusters=A.allClusters().filter(c=>c.roomId===r.id),c=clusters.find(c=>c.id===currentCluster);
   document.querySelector('#rb-drawer-title').textContent=clusterForm?'登记集群':c?c.name:r.name;
   document.querySelector('#rb-drawer-sub').textContent=`内场 · ${V.area(r)} · ${r.name}${clusterForm?' › 登记集群':c?' › 集群详情':' › 机房概览'}`;
    document.querySelector('#rb-drawer-body').innerHTML=`<div class="rb-cluster-layout"><nav class="rb-cluster-nav" aria-label="机房与集群详情"><button type="button" class="rb-cluster-select ${!c&&!clusterForm?'active':''}" data-detail-room aria-pressed="${!c&&!clusterForm}"><b>机房概览</b><small>六阶段 SOP · 环境项 · 排期</small></button><div class="rb-cluster-nav-head">机房内集群 <span>${clusters.length}</span><button type="button" class="rb-cluster-add" data-cluster-add aria-label="登记集群"><span class="mat mat-sm">add</span>登记</button></div>${clusters.map(x=>`<button type="button" class="rb-cluster-select ${c?.id===x.id?'active':''}" data-detail-cluster="${esc(x.id)}" aria-pressed="${c?.id===x.id}"><span class="rb-cluster-select-top"><b>${esc(x.name)}</b><span class="rb-cluster-dot ${M.clusterStatus(x)}"></span></span><small>${esc(x.type)} · ${esc(V.stage(x,'cluster'))}${x.userRequest?' · 登记':''}</small></button>`).join('')}${!clusters.length?'<p class="rb-data-note rb-nav-empty">集群计划待补充，可点上方「登记」补充</p>':''}</nav><div id="rb-detail-content">${clusterForm?clusterFormHTML(r):c?clusterContent(c,r):roomContent(r)}</div></div>`;
    let mount=document.querySelector('#rb-stage-panel-mount');
    if(!mount){mount=document.createElement('div');mount.id='rb-stage-panel-mount';document.querySelector('#rb-drawer').appendChild(mount);}
    mount.innerHTML=(!c&&!clusterForm&&stagePanel>=0)?stagePanelHTML(r):'';
 }
 function ensure() {
  if(document.querySelector('#rb-drawer'))return;
  const backdrop=document.createElement('div');backdrop.id='rb-drawer-backdrop';backdrop.className='drawer-backdrop';backdrop.addEventListener('click',close);
  const drawer=document.createElement('aside');drawer.id='rb-drawer';drawer.className='drawer rb-drawer rb-cluster-drawer';drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-hidden','true');drawer.setAttribute('aria-labelledby','rb-drawer-title');drawer.inert=true;
  drawer.innerHTML='<div class="rb-drawer-head"><div class="rb-drawer-title"><b id="rb-drawer-title"></b><span id="rb-drawer-sub"></span></div><button type="button" class="btn btn-ghost btn-sm" id="rb-drawer-close" aria-label="关闭详情"><span class="mat mat-sm">close</span></button></div><div class="rb-drawer-body" id="rb-drawer-body"></div>';
  drawer.querySelector('#rb-drawer-close').addEventListener('click',close);
  drawer.addEventListener('click',e=>{
   const b=e.target.closest('[data-detail-cluster]');
   if(b){currentCluster=b.dataset.detailCluster;renderRoom();drawer.querySelector(`[data-detail-cluster="${CSS.escape(currentCluster)}"]`).focus({preventScroll:true});}
   if(e.target.closest('[data-detail-room]')){currentCluster='';renderRoom();drawer.querySelector('[data-detail-room]').focus({preventScroll:true});}
    const stageOpen=e.target.closest('[data-stage-panel]');
    if(stageOpen){stagePanel=+stageOpen.dataset.stagePanel;clusterForm=false;renderRoom();return;}
    if(e.target.closest('[data-cluster-add]')){clusterForm=true;stagePanel=-1;currentCluster='';renderRoom();setTimeout(()=>document.querySelector('#rb-detail-content [data-cf="name"]')?.focus({preventScroll:true}),0);return;}
    if(e.target.closest('[data-cluster-cancel]')){clusterForm=false;renderRoom();return;}
    if(e.target.closest('[data-cluster-submit]')){
      const scope=document.querySelector('#rb-detail-content'),val=k=>String(scope.querySelector(`[data-cf="${k}"]`)?.value||'').trim();
      const err=scope.querySelector('[data-cf-error]'),name=val('name');
      if(!name){err.textContent='请填写集群名称';err.hidden=false;scope.querySelector('[data-cf="name"]').focus();return;}
      if(A.allClusters().some(x=>x.roomId===currentRoom&&x.name===name)){err.textContent='该机房下已存在同名集群';err.hidden=false;return;}
      const created=A.addCluster(currentRoom,{name,vdc:val('vdc'),group:val('group'),type:val('type'),tenant:val('tenant'),owner:val('owner'),start:val('start'),target:val('target')});
      clusterForm=false;currentCluster=created?created.id:'';renderRoom();return;
    }
    if(e.target.closest('[data-stage-panel-close]')){stagePanel=-1;renderRoom();return;}
    const stageStatusBtn=e.target.closest('[data-stage-status]');
    if(stageStatusBtn){A.setStageStatus(currentRoom,stagePanel,stageStatusBtn.dataset.stageStatus);renderRoom();return;}
    const envAdd=e.target.closest('[data-envadd-submit]');
    if(envAdd){
      const wrap=envAdd.closest('.rb-env-add');
      A.addEnvItem(currentRoom,{name:wrap.querySelector('[data-envadd="name"]').value,category:wrap.querySelector('[data-envadd="category"]').value,scene:wrap.querySelector('[data-envadd="scene"]').value});
      renderRoom();return;
    }
    const env=e.target.closest('[data-env-item]');
    if(env){A.cycleEnv(currentRoom,env.dataset.envItem);renderRoom();return;}
   const del=e.target.closest('[data-delete-request]');
   if(del){A.removeRequest(del.dataset.deleteRequest);close();return;}
   });
   drawer.addEventListener('change',e=>{
   const meta=e.target.closest('[data-meta]');
   if(meta){
    A.setStageMeta(currentRoom,stagePanel,meta.dataset.meta,meta.value);renderRoom();return;
   }
   const field=e.target.closest('[data-field]');
   if(field){
    const el=field,value=el.type==='checkbox'?(el.checked?'1':''):el.value;
    A.setField(currentRoom,el.dataset.field,value);renderRoom();return;
   }
   });
  document.body.append(backdrop,drawer);
  document.addEventListener('keydown',e=>{
   if(!drawer.classList.contains('open'))return;
    if(e.key==='Escape'){e.preventDefault();if(stagePanel>=0){stagePanel=-1;renderRoom();}else close();}
    if(e.key==='Tab'){const items=[...drawer.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.disabled&&!el.closest('details:not([open]) ul')),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
 }
 function activate(){ensure();const drawer=document.querySelector('#rb-drawer');if(!drawer.classList.contains('open'))previousFocus=document.activeElement;drawer.inert=false;drawer.setAttribute('aria-hidden','false');drawer.classList.add('open');document.querySelector('#rb-drawer-backdrop').classList.add('open');for(const el of document.querySelectorAll('#main,#app-sidebar,.app-header'))el.inert=true;document.body.classList.add('rb-modal-open');document.querySelector('#rb-drawer-close').focus({preventScroll:true});}
  function open(roomId,clusterId=''){sourceMode=false;currentRoom=roomId;currentCluster=clusterId;stagePanel=-1;clusterForm=false;activate();renderRoom();}
 function close(){const drawer=document.querySelector('#rb-drawer');drawer?.classList.remove('open');drawer?.setAttribute('aria-hidden','true');if(drawer)drawer.inert=true;document.querySelector('#rb-drawer-backdrop')?.classList.remove('open');for(const el of document.querySelectorAll('#main,#app-sidebar,.app-header'))el.inert=false;document.body.classList.remove('rb-modal-open');currentRoom='';currentCluster='';stagePanel=-1;clusterForm=false;sourceMode=false;if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;}
 function sources(){sourceMode=true;activate();document.querySelector('#rb-drawer-title').textContent='参考与口径';document.querySelector('#rb-drawer-sub').textContent='独立原型 · 资料核对 2026-10-18';document.querySelector('#rb-drawer-body').innerHTML=`<div class="rb-source-explanation"><h3>范围与层级</h3><p>仅展示内场新建机房，覆盖中国与非中；排除火山归属项目与裁撤项目。依据 FY26 清单内场分组，“on 火山”指基础设施底座，仍保留相应内场项目。机房是一级实体，下挂集群，二者分别跟踪流程与交付。</p><h3>阶段与进度</h3><p>机房流程（本轮截图）：确认机房信息 → 机房预算提交 & 3V创建 → 机房 KO → 机房部署 → 机房检查 → 完成，支持手动维护当前阶段；机房部署阶段含 13 个环境项方块，状态 pending / doing / done / skip。集群流程：确认需求 → 资源准备+机器重装 → BKE创建 → 人工补齐 → 交付前检查 → 后置通知。机房的 3 环节完成数、集群的 6 环节完成数与集群交付数分别展示，均不代表工期完成百分比。</p><h3>计划数量与筛选</h3><p>有明确计划的机房显示已交付 / 计划总数；未知计划显示“计划总数待确认”。业务、集群类型与子集群搜索只聚合匹配的子集群；机房详情保留完整机房信息。Core 按一个集群计数，控制面服务不重复计数。</p><h3>来源与新鲜度</h3><p>本次用户明确范围与机房六阶段 SOP（含机房部署环境项清单）是本轮设计依据。集群六阶段规范于 2026-10-18 读取，rev246（外部文档 / T6）。机房名与集群标识复用 2026-10-12 原型参考快照（派生原型 / T4）；FY26 内场分组于 2026-10-18 核对 rev1482。原型属于示例产物，不定义团队长期口径。</p><h3>示例数据与缺口</h3><p>所有状态、起止日期、预计日期、耗时、SLA、阻塞及负责人分配为演示，不代表实时建设进展或交付承诺。规划集群占位明确标为示例，正式名称、VDC、组名、POC 与数量缺失时保留待确认。流程转录置信度高；生产状态未核验。未连接生产系统，不会实际创建集群、重装机器、发通知或修改工单。</p><h3>参考资料</h3>${D.sources.map(s=>`<div class="rb-source-row">${V.ref(s.url,s.title)}<small>rev ${s.revision}${s.readAt?' · '+s.readAt:''}</small></div>`).join('')}</div>`;}
 window.BUILDOUT_DETAILS={open,close,sources};
})();
