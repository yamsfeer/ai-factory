/* 机房建设交互动作：示例机房改动仅存内存；用户登记的需求（含阶段 / 环境项状态）持久化到 localStorage。 */
(() => {
  const D=window.ROOM_BUILDOUT_DATA,M=window.ROOM_CLUSTER_MODEL,Store=window.BUILDOUT_STORE;
  const ENV_ORDER=['pending','doing','done','skip'];
  const changed=()=>window.dispatchEvent(new CustomEvent('room-buildout-changed'));
  const requestRooms=()=>Store?Store.rooms():[];
  const allRooms=()=>M.mergeRequests(D.rooms,requestRooms());
  const allClusters=()=>[...D.clusters,...(Store&&Store.clusters?Store.clusters():[])];
  function findRoom(id) { return D.rooms.find(r=>r.id===id)||requestRooms().find(r=>r.id===id)||null; }
  function findCluster(id) { return allClusters().find(c=>c.id===id)||null; }
  function findRequest(id) { return Store?Store.list().find(r=>r.id===id):null; }
  const STAGE_STATUS=['todo','doing','done','skip'];
  function stageStatus(room,i) { return M.roomStageStatus(room,i); }
  function setStageStatus(id,i,status) {
    if(!STAGE_STATUS.includes(status))return;
    const room=findRoom(id);if(!room)return;
    const idx=Math.max(0,Math.min(5,Math.trunc(i)));
    if(room.userRequest&&findRequest(id)){
      const map={...(findRequest(id).stageStatus||{})};
      if(status==='todo')delete map[idx];else map[idx]=status;
      Store.update(id,{stageStatus:map,stage:M.roomStageProgress({...findRequest(id),stageStatus:map}).current});
    } else {
      room.stageStatus={...(room.stageStatus||{})};
      if(status==='todo')delete room.stageStatus[idx];else room.stageStatus[idx]=status;
      room.stage=M.roomStageProgress(room).current;
      changed();
    }
  }
  function deriveStageLocal(map){for(let i=0;i<6;i++){const st=map?.[i];if(st!=='done'&&st!=='skip')return i;}return 6;}
  function stageMetaValue(room,i,key) { return room.stageMeta?.[i]?.[key] ?? ''; }
  function setStageMeta(id,i,key,value) {
    const room=findRoom(id);if(!room)return;
    const idx=Math.max(0,Math.min(5,Math.trunc(i))),v=String(value??'').trim();
    if(room.userRequest&&findRequest(id)){
      const meta=JSON.parse(JSON.stringify(findRequest(id).stageMeta||{}));
      meta[idx]=meta[idx]||{};
      if(v==='')delete meta[idx][key];else meta[idx][key]=v;
      if(!Object.keys(meta[idx]).length)delete meta[idx];
      Store.update(id,{stageMeta:meta});
    } else {
      room.stageMeta=JSON.parse(JSON.stringify(room.stageMeta||{}));
      room.stageMeta[idx]=room.stageMeta[idx]||{};
      if(v==='')delete room.stageMeta[idx][key];else room.stageMeta[idx][key]=v;
    }
    changed();
  }
  function customEnv(room){return Array.isArray(room.customEnv)?room.customEnv:[];}
  function addEnvItem(id,input) {
    const room=findRoom(id);if(!room)return;
    const name=String(input?.name||'').trim();if(!name)return;
    const item={id:'custom-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name,category:String(input.category||'其他').trim()||'其他',scenes:[String(input.scene||'').trim()||'Basic']};
    if(room.userRequest&&findRequest(id))Store.update(id,{customEnv:[...customEnv(room),item]});
    else {room.customEnv=[...customEnv(room),item];}
    changed();
  }
  function setStage(id,stage) {
    const next=Math.max(0,Math.min(6,Math.trunc(stage)||0));
    const room=findRoom(id);if(!room)return;
    if(room.userRequest&&findRequest(id))Store.update(id,{stage:next});
    else room.stage=next;
    changed();
  }
  function envStatus(room,itemId) {
    const v=room.envStatus?.[itemId];
    return ENV_ORDER.includes(v)?v:'pending';
  }
  function cycleEnv(id,itemId) {
    const room=findRoom(id);if(!room)return;
    const cur=envStatus(room,itemId),next=ENV_ORDER[(ENV_ORDER.indexOf(cur)+1)%ENV_ORDER.length];
    if(room.userRequest&&findRequest(id)){
      const req=findRequest(id),envStatusMap={...(req.envStatus||{})};
      if(next==='pending')delete envStatusMap[itemId];else envStatusMap[itemId]=next;
      Store.update(id,{envStatus:envStatusMap});
    } else {
      room.envStatus={...(room.envStatus||{})};
      if(next==='pending')delete room.envStatus[itemId];else room.envStatus[itemId]=next;
    }
    changed();
  }
  function fieldValue(room,itemId) {
    return room.fields?.[itemId] ?? '';
  }
  function setField(id,itemId,value) {
    const room=findRoom(id);if(!room)return;
    const v=String(value??'').trim();
    if(room.userRequest&&findRequest(id)){
      const fields={...(findRequest(id).fields||{})};
      if(v==='')delete fields[itemId];else fields[itemId]=v;
      Store.update(id,{fields});
    } else {
      room.fields={...(room.fields||{})};
      if(v==='')delete room.fields[itemId];else room.fields[itemId]=v;
    }
    changed();
  }
  function removeRequest(id) {
    if(!Store||!Store.has(id))return;
    Store.remove(id);changed();
  }
  function addCluster(roomId,opts) {
    if(!Store||!Store.addCluster)return null;
    const c=Store.addCluster(roomId,opts);changed();return c;
  }
  globalThis.BUILDOUT_ACTIONS={ENV_ORDER,STAGE_STATUS,allRooms,allClusters,findRoom,findCluster,setStage,envStatus,cycleEnv,fieldValue,setField,stageStatus,setStageStatus,stageMetaValue,setStageMeta,customEnv,addEnvItem,addCluster,removeRequest};
})();
