(() => {
 const params=new URLSearchParams(location.search);
 if(params.get('view')==='cluster-delivery'&&typeof window.mountClusterDelivery==='function'){window.mountClusterDelivery();return;}
 const D=window.ROOM_BUILDOUT_DATA,M=window.ROOM_CLUSTER_MODEL,V=window.BUILDOUT_VIEW,Details=window.BUILDOUT_DETAILS,A=window.BUILDOUT_ACTIONS,Store=window.BUILDOUT_STORE,SOP=window.BUILDOUT_SOP;
 const state={phase:['all',...M.PHASES].includes(params.get('phase'))?params.get('phase'):'present',area:'',type:'',tenant:'',query:'',sort:'date',timelineExpanded:false};
 const filters=()=>({area:state.area,type:state.type,tenant:state.tenant,query:state.query});
 const select=(key,label,values)=>`<label class="selwrap"><span class="flab">${label}</span><select class="filt" data-filter="${key}" aria-label="${label}"><option value="">全部${label}</option>${values.map(([v,text])=>`<option value="${esc(v)}">${esc(text)}</option>`).join('')}</select></label>`;
 function filterHTML(){return `<div class="filterbar rb-filterbar">${select('area','区域',[['cn','中国'],['overseas','非中']])}${select('type','集群类型',[...new Set(A.allClusters().map(c=>c.type))].map(x=>[x,x]))}${select('tenant','业务',[...new Set(A.allRooms().flatMap(r=>r.tenants))].map(x=>[x,x]))}<label class="rb-search"><span class="mat mat-sm">search</span><input type="search" aria-label="搜索机房或集群" placeholder="搜索机房 / 集群 / VDC / 负责人" autocomplete="off" /></label><button type="button" class="btn btn-ghost btn-sm" data-reset>重置</button><span class="rb-filter-scope">内场 · 新建</span></div>`;}
 function updateURL(){const p=new URLSearchParams(location.search);p.set('phase',state.phase);history.replaceState(null,'',location.pathname+'?'+p.toString());}
 const scopedRooms=()=>M.selectRooms(A.allRooms(),A.allClusters(),filters());
 function renderData(){
  const scoped=scopedRooms(),t=M.totals(scoped);
  document.querySelector('#rb-kpis').innerHTML=computeKpiStrip([
   {label:'新建机房',value:t.rooms,unit:'个',detail:`中国 ${scoped.filter(r=>r.area==='cn').length} · 非中 ${scoped.filter(r=>r.area!=='cn').length}`,tone:'info',icon:'foundation'},
   {label:'已录入集群',value:t.recorded,unit:'个',detail:`${t.unplannedRooms} 个机房计划总数待确认`,tone:'violet',icon:'dns'},
   {label:'已交付集群',value:t.delivered,unit:'个',detail:'完成集群全部 6 个环节',tone:'ok',icon:'task_alt'},
   {label:'阻塞集群',value:t.blocked,unit:'个',detail:`${t.building} 个集群正在建设 · 示例`,tone:t.blocked?'warn':'ok',icon:'pending_actions'}
  ]);
  document.querySelector('#rb-phases').innerHTML=V.phaseCards(scoped,state);
  document.querySelector('#rb-timeline').innerHTML=V.timeline(scoped,state);
  renderHierarchy(scoped);
 }
 function renderHierarchy(scoped){document.querySelector('#rb-hierarchy').innerHTML=V.hierarchy(scoped||scopedRooms(),state);}
 function reset(){Details.close();Object.assign(state,{phase:'all',area:'',type:'',tenant:'',query:'',sort:'date'});document.querySelectorAll('[data-filter]').forEach(el=>el.value='');document.querySelector('.rb-search input').value='';updateURL();renderData();}
 function openRequestForm(){
  const has=!!document.querySelector('#rb-request-modal');
  if(!has){
    const modal=document.createElement('div');modal.id='rb-request-modal';modal.className='rb-modal-root';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','rb-request-title');
    modal.innerHTML=`<div class="rb-modal-backdrop" data-close-form></div><form class="rb-modal-card rb-modal-card-wide" id="rb-request-form"><div class="rb-modal-head"><b id="rb-request-title">登记机房建设需求</b><button type="button" class="btn btn-ghost btn-sm" data-close-form aria-label="关闭"><span class="mat mat-sm">close</span></button></div><p class="rb-modal-desc">登记后将出现在「机房建设时间线」与「机房建设清单」中。以下为「确认机房信息」阶段内容，机房项目名为必填，其余可先登记、稍后在机房详情中继续补全。填写「预计启动时间」与「机房部署时间」后，时间线将按两者绘制为一个建设时间段。</p><div class="rb-modal-scroll"><fieldset class="rb-form-set"><legend>机房项目</legend><div class="rb-form-grid"><label class="rb-field span-2"><span>机房项目名 <i>*</i></span><input name="name" required maxlength="40" placeholder="例如：Seed 乌兰察布新区机房" autocomplete="off" /></label><label class="rb-field"><span>区域</span><select name="area"><option value="cn">中国</option><option value="overseas">非中</option></select></label><label class="rb-field"><span>业务方</span><input name="business-side" maxlength="30" placeholder="如 Seed / Flow / AML" autocomplete="off" /></label></div></fieldset><fieldset class="rb-form-set"><legend>关键时间</legend><div class="rb-form-grid"><label class="rb-field"><span>预计启动时间</span><input type="date" name="ko-plan" /><small class="rb-field-hint">时间线起点</small></label><label class="rb-field"><span>预计完成 · 机房部署时间</span><input type="date" name="deploy-estimate" /><small class="rb-field-hint">时间线终点</small></label><label class="rb-field span-2"><span>机器到付时间</span><input type="date" name="gpu-arrival" /></label></div></fieldset><fieldset class="rb-form-set"><legend>PoC 对接人</legend><div class="rb-form-grid"><label class="rb-field"><span>机房 PoC</span><input name="poc-room" maxlength="20" placeholder="填写对接人姓名" autocomplete="off" /></label><label class="rb-field"><span>项目 PoC</span><input name="poc-project" maxlength="20" placeholder="填写对接人姓名" autocomplete="off" /></label><label class="rb-field"><span>预算 PoC</span><input name="poc-budget" maxlength="20" placeholder="填写对接人姓名" autocomplete="off" /></label><label class="rb-field"><span>BKE &amp; TCE PoC</span><input name="poc-bke-tce" maxlength="20" placeholder="填写对接人姓名" autocomplete="off" /></label><label class="rb-field span-2"><span>业务 PoC</span><input name="poc-business" maxlength="20" placeholder="填写对接人姓名" autocomplete="off" /></label></div></fieldset></div><p class="rb-modal-error" id="rb-request-error" hidden></p><div class="rb-modal-actions"><span class="rb-modal-persist"><span class="mat mat-sm">save</span>保存在本浏览器</span><button type="button" class="btn btn-ghost btn-sm" data-close-form>取消</button><button type="submit" class="btn btn-soft btn-sm"><span class="mat mat-sm">add</span>登记需求</button></div></form>`;
    document.body.append(modal);
    modal.addEventListener('click',e=>{if(e.target.closest('[data-close-form]'))closeRequestForm();});
    modal.querySelector('#rb-request-form').addEventListener('submit',e=>{
      e.preventDefault();
      const form=e.currentTarget,fd=new FormData(form),name=String(fd.get('name')||'').trim();
      const err=modal.querySelector('#rb-request-error');
      if(!name){err.textContent='请填写机房项目名';err.hidden=false;return;}
      if(A.allRooms().some(r=>r.name===name)){err.textContent='已存在同名机房 / 需求登记';err.hidden=false;return;}
      const fields={};SOP.requestItemIds.forEach(id=>{const v=String(fd.get(id)||'').trim();if(v)fields[id]=v;});
      Store.add(name,{area:fd.get('area'),fields});
      form.reset();closeRequestForm();
      state.phase='all';updateURL();renderData();
    });
  }
  document.querySelector('#rb-request-modal').classList.add('open');
  document.body.classList.add('rb-modal-open');
  setTimeout(()=>document.querySelector('#rb-request-modal input[name="name"]')?.focus(),0);
 }
 function closeRequestForm(){const m=document.querySelector('#rb-request-modal');m?.classList.remove('open');document.body.classList.remove('rb-modal-open');}
 document.querySelector('#main').innerHTML=computePageShell({view:'room-buildout',group:'交付与准入',title:'机房建设',description:'登记机房建设需求，跟踪机房六阶段进度、机房部署环境项与集群交付排期。',showDataStatus:true,dataStatus:'示例数据',tools:'<button type="button" class="btn btn-soft btn-sm" data-request-add><span class="mat mat-sm">add</span>登记机房建设需求</button><button type="button" class="btn btn-ghost btn-sm" data-show-sources><span class="mat mat-sm">description</span>参考与口径</button>',filter:filterHTML(),body:`<div class="cmp space-y-4"><div class="rb-demo-banner"><span class="mat mat-sm">info</span><span>原型演示：可登记机房建设需求并手动维护建设阶段与环境项状态；示例日期、进度、耗时及负责人分配非实时建设状态。</span><button type="button" data-show-sources>查看数据说明</button></div><div id="rb-kpis"></div><div id="rb-phases"></div>${computeSection({title:'机房建设时间线',icon:'timeline',meta:'<span class="csys-section-meta">全阶段排期 · 中国与非中 · 含登记需求</span>',body:'<div id="rb-timeline"></div>'})}${computeSection({title:'机房建设清单',icon:'account_tree',meta:'<span class="csys-section-meta">机房六阶段 · 环境项 · 集群在机房详情中查看与登记</span>',body:'<div id="rb-hierarchy"></div>'})}<p class="rb-data-note">内场新建 · 机房六阶段进度由机房详情阶段登记自动同步 · 集群在机房详情中登记与跟踪 · 示例基准 ${D.asOf} · <button type="button" class="rb-name-button" data-show-sources>来源、时效与缺口</button></p></div>`});
 document.querySelector('#main').addEventListener('click',e=>{
  const phase=e.target.closest('[data-phase]');if(phase){state.phase=phase.dataset.phase;updateURL();renderData();return;}
  if(e.target.closest('[data-sort-reset]')){state.sort='date';document.querySelector('[data-sort]').value='date';renderHierarchy();return;}
  if(e.target.closest('[data-timeline-expand]')){state.timelineExpanded=!state.timelineExpanded;document.querySelector('#rb-timeline').innerHTML=V.timeline(scopedRooms(),state);return;}
  if(e.target.closest('[data-request-add]')){openRequestForm();return;}
  const room=e.target.closest('[data-room]');if(room){Details.open(room.dataset.room);return;}
  const cluster=e.target.closest('[data-cluster]');if(cluster){const c=A.findCluster(cluster.dataset.cluster);if(c)Details.open(c.roomId,c.id);return;}
  if(e.target.closest('[data-show-sources]')){Details.sources();return;}
  if(e.target.closest('[data-reset]'))reset();
 });
 document.querySelector('#main').addEventListener('change',e=>{
  if(e.target.matches('[data-filter]')){state[e.target.dataset.filter]=e.target.value;renderData();}
  if(e.target.matches('[data-sort]')){state.sort=e.target.value;renderHierarchy();}
 });
 document.querySelector('.rb-search input').addEventListener('input',e=>{state.query=e.target.value;renderData();});
 // 动作层（抽屉里改阶段 / 环境项）变更后，同步刷新页面列表与时间线；详情抽屉自行重渲染。
 window.addEventListener('room-buildout-changed',renderData);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeRequestForm();});
 // 页面壳保留生产视觉，其他功能在独立原型中显示为不可用。
 document.querySelectorAll('#compute-sidebar-nav button:not([data-view="room-buildout"]):not([data-view="cluster-delivery"]),.topbar-tools button,.scene-switch-btn').forEach(b=>{b.disabled=true;b.title='此独立原型仅展示交付与准入相关页面';});
 renderData();
})();
