'use strict';
// Drive actual app handlers in an isolated DOM stub; no production test hooks.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const E=require('./engine.js'),V=require('./evidence.js');
const source=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
function app(){
 const elements=new Map(),store=new Map(),downloads=[];
 function el(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',open:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},focus(){},scrollIntoView(){},click(){}});return elements.get(id);}
 const document={querySelector:el,querySelectorAll:()=>[],createElement:()=>el('download')};
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 class BlobStub{constructor(parts){this.text=parts.join('');}}
 vm.runInNewContext(source,{window:{CounterEngine:E,CounterEvidence:V,scrollTo(){}},document,localStorage,Blob:BlobStub,URL:{createObjectURL:b=>{downloads.push(b.text);return'blob:fixture';},revokeObjectURL(){}},setTimeout:()=>0,clearTimeout(){},console});
 function calculate(){for(const [id,value]of Object.entries({'#coin-values':'1, 3, 4','#coin-target':'6','#coin-prediction':'3','#coin-upper':'30','#coin-search-prediction':'yes'}))el(id).value=value;el('#coin-form').onsubmit({preventDefault(){}});}
 function records(){return JSON.parse(store.get('counter-lab-evidence-v1')||'[]');}
 async function importData(data){el('#open-evidence').onclick();const file={size:JSON.stringify(data).length,text:async()=>JSON.stringify(data)};await el('#import-evidence').onchange({target:{files:[file],value:'file.json'}});}
 function save(text){el('#learning-revision').value=text;el('#learning-next').value='再改条件验证。';el('#save-learning').onclick();}
 return{el,downloads,calculate,records,importData,save};
}
(async()=>{
 const a=app();a.calculate();a.el('#open-evidence').onclick();a.el('#export-records').onclick();const backup=JSON.parse(a.downloads[0]);await a.importData(backup);a.save('回导后写下的新理解。');
 assert.equal(a.records().length,1);
 assert.equal(a.records()[0].learning.revision,'回导后写下的新理解。','原样回导去重后保存的理解必须进入实际records');
 console.log('PASS 完整备份原样回导后，当前证据保存写入保留对象');

 const b=app();b.calculate();const original=b.records()[0];const incoming=Array.from({length:20},(_,i)=>({...original,id:'different-'+i}));await b.importData({engine:E.VERSION,records:incoming});b.save('不能假装持久化的理解');
 assert.ok(/20|重新验证/.test(b.el('#learning-error').textContent));
 assert.equal(b.records().length,20);assert.ok(!b.records().some(r=>r.learning?.revision==='不能假装持久化的理解'));
 console.log('PASS 当前证据被20份上限挤出时，拒绝虚假保存并明确说明');

 const c=app();c.calculate();const old=c.records()[0];const collision=Array.from({length:20},(_,i)=>({...old,id:i===0?old.id:'other-'+i,params:{coins:[1,3,4],amount:7},prediction:{minimumCoins:2}}));await c.importData({engine:E.VERSION,records:collision});c.save('旧金额6的理解');
 assert.ok(/20|重新验证/.test(c.el('#learning-error').textContent));
 assert.ok(c.records().every(r=>r.params.amount===7&&r.learning.revision!=='旧金额6的理解'));
 console.log('PASS 同id但不同参数的导入不会把旧计算绑定到新证据');

 const d=app();d.calculate();d.el('#coin-upper').value='5';d.el('#coin-search-prediction').value='no';d.el('#search-coins').onclick();
 assert.ok(d.el('#experiment').innerHTML.includes('最新证据：'));
 assert.ok(d.el('#experiment').innerHTML.includes('最新中文报告'));
 assert.ok(d.el('#experiment').innerHTML.includes('导出最新 JSON'));
 console.log('PASS 多张结果卡片的共享操作明确标明最新证据');
 console.log('Completed 4 app state regression groups.');
})().catch(error=>{console.error(error);process.exitCode=1;});
