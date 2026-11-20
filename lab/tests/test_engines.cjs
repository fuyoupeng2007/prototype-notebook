/* Run from any directory: node tests/test_engines.cjs */
const assert=require('node:assert/strict');
const D=require('../delivery/app.js');
const L=require('../lab/engine.js');
const C=require('../counterexample/engine.js');
let assertions=0;
function check(label,fn){fn();assertions++;console.log('PASS '+label)}
check('贪心找零的真实反例：1/3/4，金额6',()=>{
 assert.equal(C.greedy([1,3,4],6).count,3);assert.equal(C.dp([1,3,4],6).count,2);
 const result=C.searchCoins([1,3,4],30);assert.equal(result.witness.amount,6);assert.equal(result.checked,6);
});
check('改变面额后重新搜索，而非固定返回反例',()=>{
 const result=C.searchCoins([1,2,4],60);assert.equal(result.found,false);assert.equal(result.checked,60);
 assert.equal(C.dp([1,5,10],18).count,5);assert.throws(()=>C.normalizeCoins('3,4'));
 assert.throws(()=>C.searchCoins([1,3],201));
});
check('最近邻不是最短路径；图搜索有明确范围',()=>{
 const r=C.nearestPath(1,10,4);assert.equal(r.greedy.weight,11);assert.equal(r.optimal.weight,4);
 const found=C.searchGraph(12);assert.equal(found.checked,14);assert.deepEqual([found.witness.a,found.witness.b,found.witness.c],[1,2,2]);
 assert.equal(C.nearestPath(3,1,2).greedy.weight,2);
});
check('六个合法并发时序与互斥后的两个时序',()=>{
 assert.equal(C.enumerate().total,6);assert.deepEqual(C.enumerate().counts,{'1':4,'2':2});
 assert.equal(C.simulate(['AR','BR','AW','BW']).x,1);assert.equal(C.simulate(['AR','AW','BR','BW']).x,2);
 assert.deepEqual(C.enumerate(true).counts,{'2':2});assert.throws(()=>C.simulate(['AW']));assert.throws(()=>C.simulate(['AR','BR'],true));
});
check('无噪声单摆数据能恢复已知斜率和g',()=>{
 const g=9.81;
 const rows=[.2,.4,.6,.8,1].map((length_m,i)=>({length_m,cycles:10,elapsed_s:10*2*Math.PI*Math.sqrt(length_m/g),angle_deg:5,repeat_id:'x'+i}));
 const fit=L.fit(rows);assert.ok(Math.abs(fit.g-g)<1e-10);assert.ok(Math.abs(fit.intercept)<1e-12);assert.ok(Math.abs(fit.r2-1)<1e-12);
});
check('固定长度偏差表现为非零截距，不强迫过原点',()=>{
 const rows=[.2,.4,.6,.8,1].map((length_m,i)=>({length_m,cycles:10,elapsed_s:10*L.period(length_m+.035),angle_deg:5,repeat_id:'x'+i}));
 const fit=L.fit(rows);assert.ok(Math.abs(fit.g-L.G)<1e-10);assert.ok(Math.abs(fit.intercept-(4*Math.PI**2/L.G*.035))<1e-12);
});
check('坏单位/周期、重复长度和空值不能进入计算',()=>{
 assert.throws(()=>L.parseCSV('length_m,cycles,elapsed_s,angle_deg,repeat_id\n-1,10,20,5,a'));
 assert.throws(()=>L.parseCSV('length_m,cycles,elapsed_s,angle_deg,repeat_id\n1,0,20,5,a'));
 assert.throws(()=>L.parseCSV('length_m,cycles,elapsed_s,angle_deg,repeat_id\n1,10,,5,a'));
 const rows=L.parseCSV(L.example('normal'));assert.throws(()=>L.fit(rows.map(r=>({...r,length_m:1}))));
});
check('复测可区分示例，也能承认两者皆不兼容',()=>{
 const p=L.predictions({length:.6,offset:.035,timer:.45,tolerance:.05});
 const r=L.compareRetest(p.timerHypothesis.map(x=>x.elapsed),{length:.6,offset:.035,timer:.45,tolerance:.05});
 assert.equal(r.timer.compatible,true);assert.equal(r.length.compatible,false);
 const neither=L.compareRetest([99,99],{tolerance:.05});assert.equal(neither.timer.compatible,false);assert.equal(neither.length.compatible,false);
});
check('通知来源与版本约束真实关联',()=>{
 const old=D.extract('必须提交 PDF，单个不超过 10 MB。\n必须提交 ZIP。\n必须提交 MP4，时长不超过 180 秒。','N1');
 const update=D.extract('必须提交 MP4，时长不超过 120 秒。\n所有材料须匿名。','N2');
 assert.equal(old.rules.find(r=>r.ext==='mp4').maxSeconds,180);
 const merged=D.mergeRules(old.rules,update.rules);assert.equal(merged.find(r=>r.ext==='mp4').maxSeconds,120);
 assert.equal(merged.find(r=>r.ext==='mp4').sources.maxSeconds.id,'N2');assert.equal(D.diffRules(old.rules,update.rules).length,2);
});
check('真实元数据失败与PDF内容待复核保持区分',()=>{
 const rules=D.extract('必须提交 PDF，不超过 10 MB。\n必须提交 ZIP。\n必须提交 MP4，时长不超过 120 秒。\n交付物须匿名。').rules;
 const files=[{id:'p',name:'报告.pdf',size:1000},{id:'v',name:'demo.mp4',size:1000,duration:190},{id:'t',name:'说明.txt',size:100,textContent:'姓名：张三'}];
 const result=D.check(rules,files,{words:['张三']});
 assert.ok(result.items.some(x=>x.ruleKey==='file:zip'&&x.status==='fail'));
 assert.ok(result.items.some(x=>x.id.includes('duration')&&x.status==='fail'));
 assert.ok(result.items.some(x=>x.id==='anonymous:file:p'&&x.status==='review'));
 assert.ok(result.items.some(x=>x.id==='anonymous:file:t'&&x.status==='fail'));
});
check('否定、可选和无效日期要求不被擅自推断',()=>{
 assert.equal(D.extract('无需提交 PDF。').rules.length,0);assert.ok(D.extract('无需提交 PDF。').unparsed.length);
 assert.equal(D.extract('PDF 或者 ZIP 任选一种。').rules.length,0);
 assert.equal(D.parseDeadline('截止 2027-02-30 18:00'),null);
 assert.equal(D.parseDeadline('截止 2027-01-15 18:00').timeZone,'Asia/Shanghai');
});
console.log(`Completed ${assertions} groups of domain assertions.`);
