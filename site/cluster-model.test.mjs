import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
new Function('globalThis', fs.readFileSync(new URL('./cluster-model.js',import.meta.url),'utf8'))(globalThis);
const M=globalThis.ROOM_CLUSTER_MODEL;
const rooms=[
 {id:'a',org:'internal',action:'build',phase:'present',stage:2,name:'WLBY',vdc:'wlby',area:'cn',region:'North5',line:'混合',tenants:['Seed','TCE'],poc:'A',planCount:3,ko:'2026-10-01',target:'2026-10-30'},
 {id:'b',org:'internal',action:'build',phase:'future',stage:0,name:'芬兰',area:'overseas',line:'训练',tenants:['Seed'],poc:'B',planCount:null,ko:null,target:null},
 {id:'v',org:'volcano',action:'build',phase:'past',tenants:[]},
 {id:'d',org:'internal',action:'decom',phase:'present',tenants:[]},
];
const clusters=[
 {id:'a/core',roomId:'a',name:'core-wlby',vdc:'wlby',tenant:'TCE',type:'通用',stage:6,phase:'past',slaDays:3,actualDays:4},
 {id:'a/train',roomId:'a',name:'train-wlby',tenant:'Seed',type:'训练',stage:3,phase:'present',blocker:'控制器未就绪',start:'2026-10-13',slaDays:4},
 {id:'a/infer',roomId:'a',name:'infer-wlby',tenant:'TCE',type:'推理',stage:5,phase:'present',start:'2026-10-15',slaDays:3},
 {id:'b/p',roomId:'b',name:'规划训练集群（示例）',tenant:'Seed',type:'训练',stage:0,phase:'future',slaDays:null},
];
test('只纳入内场新建，on火山基础设施不改变内场归属',()=>{
 assert.deepEqual(M.selectRooms(rooms,clusters).map(r=>r.id),['a','b']);
 assert.equal(M.selectRooms([{...rooms[0],name:'内场 on 火山'}],clusters).length,1);
});
test('机房生命周期独立于子集群，即使全部子集群交付仍需机房验收',()=>{
 const r={...rooms[0],planCount:1}; const s=M.roomSummary(r,[clusters[0]]);
 assert.equal(s.status,'building'); assert.equal(s.delivered,1);
  assert.equal(M.roomSummary({...r,phase:'past',stage:6},[clusters[0]]).status,'delivered');
});
test('集群完成需要全部六阶段，后置通知进行中不算已交付',()=>{
 assert.equal(M.STAGES.length,6); assert.equal(M.clusterStatus(clusters[2]),'building');
 assert.equal(M.clusterStatus(clusters[0]),'delivered');
 assert.equal(M.clusterStatus(clusters[1]),'blocked');
 assert.equal(M.clusterPhase(clusters[0]),'past'); assert.equal(M.clusterPhase(clusters[3]),'future');
});
test('按业务/类型筛选保留父机房，只统计匹配子集群，未知计划不变成0',()=>{
 const selected=M.selectRooms(rooms,clusters,{type:'训练'});
 assert.deepEqual(selected.map(r=>r.id),['a','b']);
 assert.equal(selected[0].summary.matched,1);
 assert.equal(selected[0].summary.planned,1);
 assert.equal(selected[1].summary.planned,null); assert.equal(selected[1].summary.pct,null);
});
test('父/子搜索保留层级上下文，未匹配返回空',()=>{
 const child=M.selectRooms(rooms,clusters,{query:'core-wlby'});
 assert.equal(child.length,1); assert.equal(child[0].summary.clusters.length,1);
 assert.equal(M.selectRooms(rooms,clusters,{query:'NO-MATCH'}).length,0);
 assert.equal(M.selectRooms(rooms,clusters,{query:'WLBY'}).length,1);
});
test('进行中累计耗时按示例基准日，未来未开始不计算耗时',()=>{
 assert.deepEqual(M.clusterDuration(clusters[0],'2026-10-18'),{sla:3,actual:4,over:1});
 assert.equal(M.clusterDuration(clusters[1],'2026-10-18').actual,5);
 assert.equal(M.clusterDuration(clusters[3],'2026-10-18').actual,null);
});
test('时间线用精确自然日，不把未来交付日当作启动日',()=>{
 const months=M.timelineMonths([{ko:'2026-10-01',target:'2026-10-31'}]);
 const bar=M.timelineBar({ko:'2026-10-01',target:'2026-10-31'},months);
 assert.equal(bar.left,0); assert.equal(bar.width,100);
 assert.equal(M.timelineBar({ko:null,target:'2026-10-31'},months).milestone,true);
 assert.equal(M.timelineBar({ko:null,target:null},months),null);
 assert.equal(M.timelinePosition('2026-10-16',months),15/31*100);
});

test('演示数据的已交付集群日期与累计耗时一致，未来计划保留未知名称/VDC',()=>{
 const window={};new Function('window',fs.readFileSync(new URL('./data.js',import.meta.url),'utf8'))(window);
 const D=window.ROOM_BUILDOUT_DATA;
 for(const c of D.clusters){
  assert.ok(D.rooms.some(r=>r.id===c.roomId));
  if(M.clusterPhase(c)==='past')assert.equal(M.daysBetween(c.start,c.delivered),c.actualDays,c.id);
  if(c.identitySource==='demo'){assert.equal(c.nameConfirmed,false);assert.ok(c.name.includes('示例'));}
 }
});
