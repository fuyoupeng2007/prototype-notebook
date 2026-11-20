/* Evidence is rebuilt from bounded inputs; imported result fields are never trusted. */
(function(root){
'use strict';
const E = root.CounterEngine || require('./engine.js');
const names = {coins:'找零实验', paths:'选路实验', threads:'并发实验'};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const object = v => v && typeof v === 'object' && !Array.isArray(v);
function number(value,min,max,label){if(typeof value!=='number')throw Error(label+'须是数字');return E.integer(value,min,max,label);}
function learning(value){
  if (value === undefined) return {revision:'', nextTest:''};
  if (!object(value)) throw Error('理解记录格式无效');
  const out={};
  for (const [key,max] of [['revision',1200],['nextTest',600]]) {
    if (value[key] !== undefined && typeof value[key] !== 'string') throw Error('理解记录须为文字');
    out[key]=(value[key] || '').trim();
    if (out[key].length > max) throw Error('理解记录超出字数限制');
  }
  if (typeof value.savedAt === 'string' && Number.isFinite(Date.parse(value.savedAt))) out.savedAt=value.savedAt;
  return out;
}
function verifyRecord(rec){
  if (!object(rec) || rec.engine !== E.VERSION || !Object.hasOwn(names,rec.module) || !object(rec.params) || !object(rec.prediction)) throw Error('证据格式或算法版本不匹配');
  const p=rec.params, prediction=rec.prediction;
  let params,pred,result,title,domain;
  if (rec.module === 'coins') {
    if(!Array.isArray(p.coins)||p.coins.some(v=>typeof v!=='number'))throw Error('证据面额须为数字数组');
    const coins=E.normalizeCoins(p.coins);
    if ((p.amount !== undefined) === (p.upper !== undefined)) throw Error('找零证据须指定单个金额或搜索上界，不能同时指定');
    if (p.amount !== undefined) {
      const amount=number(p.amount,1,200,'证据金额'), minimumCoins=number(prediction.minimumCoins,1,200,'证据预测');
      params={coins,amount}; pred={minimumCoins}; result={greedy:E.greedy(coins,amount),optimal:E.dp(coins,amount),prediction:minimumCoins}; title='找零：金额 '+amount;
      domain='正整数面额包含 1，每种不限数量；本次只验证一个目标金额。';
    } else {
      if (typeof prediction.findsCounterexample !== 'boolean') throw Error('范围预测须为布尔值');
      const upper=number(p.upper,1,200,'证据搜索上界'); params={coins,upper}; pred={findsCounterexample:prediction.findsCounterexample};
      result={...E.searchCoins(coins,upper),prediction:prediction.findsCounterexample?'yes':'no'}; title=result.found?'找零反例：金额 '+result.witness.amount:'找零：有限域未找到反例'; domain=result.scope+'；没有反例不构成普遍证明。';
    }
  } else if (rec.module === 'paths') {
    if (p.bound !== undefined) {
      if (['a','b','c'].some(k=>p[k]!==undefined)) throw Error('图搜索范围与单图边权不能混用');
      if (typeof prediction.findsCounterexample !== 'boolean') throw Error('范围预测须为布尔值');
      const bound=number(p.bound,1,12,'图域上界'); params={bound,fixedEdges:['S-A','A-T','S-T']}; pred={findsCounterexample:prediction.findsCounterexample};
      result={...E.searchGraph(bound),prediction:prediction.findsCounterexample?'yes':'no'}; title='选路：三点图族反例搜索'; domain=result.scope+'；不推断其他图结构。';
    } else {
      for(const key of ['a','b','c'])number(p[key],1,50,'证据边权');
      const r=E.nearestPath(p.a,p.b,p.c), shortestDistance=number(prediction.shortestDistance,1,100,'证据预测');
      params={a:r.a,b:r.b,c:r.c}; pred={shortestDistance}; result={...r,prediction:shortestDistance}; title='选路：最近邻 '+r.greedy.weight+' / 最短 '+r.optimal.weight; domain='固定三点三边有向无环图；最近邻不是 Dijkstra，同权时优先直达 T。';
    }
  } else {
    if (typeof p.locked !== 'boolean') throw Error('证据锁模式无效');
    if (p.initialX !== undefined && p.initialX !== 0) throw Error('教学模型只支持初值 x=0');
    if (p.schedule !== undefined) {
      const r=E.simulate(p.schedule,p.locked);
      if (!r.complete) throw Error('时序证据须包含完整四步');
      const finalX=number(prediction.finalX,1,2,'证据预测'); params={locked:p.locked,schedule:r.schedule,initialX:0}; pred={finalX}; result=r; title='并发：'+(p.locked?'互斥':'无锁')+'时序得到 '+r.x;
    } else {
      if (!['all2','has1'].includes(prediction.outcomes)) throw Error('枚举预测无效');
      params={locked:p.locked,initialX:0}; pred={outcomes:prediction.outcomes}; result={...E.enumerate(p.locked),prediction:prediction.outcomes}; title='并发：穷举 '+result.total+' 种合法时序';
    }
    domain=result.model+'；时序数量不是实际运行概率。';
  }
  const sourceId=object(rec.scope)&&typeof rec.scope.importedFrom==='string'?rec.scope.importedFrom:rec.id;
  return {engine:E.VERSION,module:rec.module,title,params,prediction:pred,result,learning:learning(rec.learning),scope:{domain,verification:'只采用校验后的参数与预测，结果全部在本机重新计算。'},sourceId:typeof sourceId==='string'?sourceId.slice(0,128):null,sourceCreated:typeof rec.created==='string'&&Number.isFinite(Date.parse(rec.created))?rec.created:null};
}
function prepareImport(data){
  let input;
  if (object(data) && Object.hasOwn(data,'records')) {
    if (data.engine !== E.VERSION) throw Error('备份算法版本不匹配');
    if (!Array.isArray(data.records) || data.records.length < 1 || data.records.length > 20) throw Error('备份须包含 1–20 份证据');
    input=data.records;
  } else input=[data];
  return input.map((rec,i)=>{try{return verifyRecord(rec);}catch(error){throw Error('第 '+(i+1)+' 份证据：'+error.message+'；本次未导入任何记录。');}});
}
function summary(rec){
  const r=rec.result,p=rec.params;
  if(rec.module==='coins') return p.amount!==undefined?{input:'面额 ['+p.coins.join(', ')+']；金额 '+p.amount, prediction:'最少 '+rec.prediction.minimumCoins+' 枚',result:'贪心 '+r.greedy.count+' 枚 / 最优 '+r.optimal.count+' 枚',trace:r.greedy.trace.map(t=>'第 '+t.step+' 步：取 '+t.coin+'，余额 '+t.remaining)}:{input:'面额 ['+p.coins.join(', ')+']；金额 1–'+p.upper,prediction:rec.prediction.findsCounterexample?'范围内能找到反例':'范围内没有反例',result:r.found?'首个失败金额 '+r.witness.amount+'；贪心 '+r.witness.greedy.count+' 枚 / 最优 '+r.witness.optimal.count+' 枚':'已检查 '+r.checked+' 个金额，未找到反例',trace:['已实际检查 '+r.checked+' 个金额。']};
  if(rec.module==='paths') return p.bound!==undefined?{input:'固定三点图；各边权 1–'+p.bound,prediction:rec.prediction.findsCounterexample?'范围内能找到反例':'范围内没有反例',result:r.found?'首个失败权重 ('+[r.witness.a,r.witness.b,r.witness.c].join(', ')+')':'有限域未找到反例',trace:['按 (a,b,c) 字典序实际检查 '+r.checked+' 组。']}:{input:'S→A='+p.a+'；A→T='+p.b+'；S→T='+p.c,prediction:'最短距离 '+rec.prediction.shortestDistance,result:'最近邻 '+r.greedy.weight+' / 最短 '+r.optimal.weight,trace:r.greedy.trace.map(t=>t.from+'→'+t.to+'，边权 '+t.edge+'，累计 '+t.total)};
  return p.schedule?{input:(p.locked?'互斥':'无锁')+'；'+p.schedule.join(' → '),prediction:'最终 x='+rec.prediction.finalX,result:'实际 x='+r.x,trace:r.trace.map(t=>t.description+'（x: '+t.before+' → '+t.x+'）')}:{input:p.locked?'完整读写使用互斥锁':'读写可以交错',prediction:rec.prediction.outcomes==='all2'?'全部得到 2':'至少一种得到 1',result:'已枚举 '+r.total+' 种：'+Object.entries(r.counts).map(([x,n])=>'x='+x+' 有 '+n+' 种').join('；'),trace:r.all.map(t=>t.schedule.join(' → ')+'：x='+t.x)};
}
function reportHTML(input){
  const rec=verifyRecord(input), view=summary(rec);
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>反例工坊 · '+esc(rec.title)+'</title><style>body{max-width:860px;margin:35px auto;padding:0 24px 50px;color:#292738;font:14px/1.9 system-ui,"Microsoft YaHei",sans-serif}h1{font-size:27px}h2{font-size:18px;margin-top:28px}p{white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd5e5;padding:12px;text-align:left;vertical-align:top}th{width:110px;background:#f4f0fa}.note{font-size:12px;color:#766c81}.learning{background:#f4f0fa;border-radius:10px;padding:15px 20px}li{margin:7px 0}button{padding:10px 16px;background:#6855a7;color:white;border:0;border-radius:7px;cursor:pointer}pre{font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}@media print{button,.raw{display:none}body{margin:0;max-width:none}h2{break-after:avoid}tr,.learning{break-inside:avoid}}@media(max-width:500px){th{width:65px}td,th{padding:9px}}</style><button onclick="window.print()">打印 / 另存为 PDF</button><p class="note">反例工坊 · 本机可复算证据 / '+esc(rec.engine)+'</p><h1>'+esc(rec.title)+'</h1><table><tr><th>输入条件</th><td>'+esc(view.input)+'</td></tr><tr><th>验证前预测</th><td>'+esc(view.prediction)+'</td></tr><tr><th>程序计算</th><td>'+esc(view.result)+'</td></tr></table><h2>计算过程</h2><ol>'+view.trace.slice(0,25).map(t=>'<li>'+esc(t)+'</li>').join('')+'</ol>'+(view.trace.length>25?'<p class="note">此处展示前 25 步，完整轨迹在下方 JSON 中。</p>':'')+'<h2>结论适用边界</h2><p>'+esc(rec.scope.domain)+'</p><p class="note">报告按输入重新计算，不采信导入文件中的结果字段。没有找到反例不等于普遍证明。</p><h2>我的修正规则</h2><div class="learning"><p>'+esc(rec.learning.revision||'尚未记录。')+'</p><b>下一次准备怎样检验？</b><p>'+esc(rec.learning.nextTest||'尚未记录。')+'</p><p class="note">这是个人理解记录，未自动评分，也未认证理解正确。</p></div><details class="raw"><summary>完整计算证据 JSON</summary><pre>'+esc(JSON.stringify(rec,null,2))+'</pre></details></html>';
}
root.CounterEvidence={verifyRecord,prepareImport,learning,reportHTML};
if(typeof module!=='undefined'&&module.exports)module.exports=root.CounterEvidence;
})(typeof window!=='undefined'?window:globalThis);
