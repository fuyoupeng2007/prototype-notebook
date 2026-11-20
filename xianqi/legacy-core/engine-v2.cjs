(function(root){
 'use strict';
 const base=typeof module!=='undefined'&&module.exports?require('./engine.cjs'):root.Xianqi;
 const catalog=typeof module!=='undefined'&&module.exports?require('./catalog.cjs'):root.XianqiCatalog;
 const scenarios=catalog.scenarios,sources={...base.sources,...catalog.sources};
 const holidayRanges={2026:[['01-01','01-03'],['02-15','02-23'],['04-04','04-06'],['05-01','05-05'],['06-19','06-21'],['09-25','09-27'],['10-01','10-07']],2027:[['01-01','01-03'],['02-05','02-13'],['04-03','04-05'],['05-01','05-05'],['06-09','06-09'],['09-15','09-15'],['10-01','10-07']]};
 const makeups=new Set(['2026-01-04','2026-02-14','2026-02-28','2026-05-09','2026-09-20','2026-10-10','2027-01-31','2027-02-14','2027-05-08','2027-09-26','2027-10-09']);
 function isWorkday(s){if(base.parse(s)===null)return null;const year=Number(s.slice(0,4));if(!holidayRanges[year])return null;if(makeups.has(s))return true;const md=s.slice(5);if(holidayRanges[year].some(([a,b])=>md>=a&&md<=b))return false;return ![0,6].includes(new Date(base.parse(s)).getUTCDay());}
 function addWorkdays(s,n){if(base.parse(s)===null||!Number.isInteger(n)||n<0||n>366)return null;let day=s;if(isWorkday(s)===null)return null;for(let count=0;count<n;){day=base.addDays(day,1);const work=isWorkday(day);if(work===null)return null;if(work)count++;}return day;}
 const getScenario=c=>{const key=typeof c==='string'?c:c?.scenario||'work';return Object.hasOwn(scenarios,key)?scenarios[key]:undefined;};
 const defaultNodes=s=>(getScenario(s)?.rules||scenarios.custom.rules).map((r,i)=>({id:'node'+(i+1),title:r.title,actor:getScenario(s)?.actor||'',start:'',finish:'',due:'',reason:'',kind:'notice'}));
 const rulesFor=c=>{const s=getScenario(c);if(!s)return [];if((c.scenario||'work')==='work')return base.rules;if(s.mode==='manual')return (c.customNodes||defaultNodes(c)).map(n=>({id:n.id,title:n.title,actor:n.actor||c.agency||s.actor,manual:true,node:n,action:'核对该节点的完成条件、办理方与期限依据。',article:'用户记录',quote:'自定义步骤，未核验法律适用。'}));return s.rules.map(r=>({...r,actor:s.actor}));};
 const dateFields=c=>(c?.scenario||'work')==='work'?base.dateLabels:getScenario(c)?.dates||{};
 const materialsFor=c=>getScenario(c)?.materials||[];
 function validate(c,now=base.today()){
  const s=getScenario(c);if(!s)return ['不支持的场景类型，请选择已提供的模板'];
  const intakeErrors=c.intake?.eventDate&&(base.parse(c.intake.eventDate)===null||c.intake.eventDate>now)?['事件发生日期须有效，且不能是未来日期']:[];
  if((c.scenario||'work')==='work')return [...base.validate(c,now),...intakeErrors];
  const errors=[...intakeErrors];let prev='',prevLabel='';
  for(const [k,label]of Object.entries(dateFields(c))){if(!c[k])continue;if(base.parse(c[k])===null){errors.push(label+'格式不正确');continue;}if(c[k]>now)errors.push(label+'不能是未来日期');if(prev&&c[k]<prev)errors.push(label+'不能早于'+prevLabel);prev=c[k];prevLabel=label;}
  if(c.extensionDays&&(!s.extension||!Number.isInteger(c.extensionDays)||c.extensionDays<0||c.extensionDays>s.extension.max||!c.extensionEvidence))errors.push('延期天数须在规则范围内，并记录书面通知依据');
  if(c.specialTiming&&!c.timingEvidence)errors.push('请记录中止、扣除或重新起算的通知依据');
  if(c.localPolicy&&!c.policyEvidence)errors.push('请记录核实当地30/45工作日口径的依据');
  if(c.rejected&&(!c.reviewed||c.accepted))errors.push('不予受理须记录决定日期，并不能同时填写已受理日期');
  if(c.reviewed&&!c.rejected)errors.push('已填写不予受理决定日期，请核对是否勾选不予受理');
  if(c.scenario==='aid'&&c.assigned&&!c.aidGranted)errors.push('人员指派仅适用于已决定给予援助的事项');
  for(const [id,o]of Object.entries(c.overrides||{})){if(!rulesFor(c).some(r=>r.id===id)||base.parse(o?.date)===null||!String(o?.reason||'').trim())errors.push('明确期限须填写有效日期和通知依据');}
  const nodes=c.customNodes||[];if(nodes.length>12)errors.push('一件事项最多12个自定义节点');const ids=new Set();
  for(const n of nodes){if(!/^[a-zA-Z0-9_-]{1,40}$/.test(n.id)||ids.has(n.id))errors.push('自定义节点编号无效或重复');ids.add(n.id);if(!String(n.title||'').trim())errors.push('请填写节点名称');for(const k of ['start','finish','due'])if(n[k]&&base.parse(n[k])===null)errors.push('节点日期格式不正确');if(n.start>now||n.finish>now)errors.push('节点起算和完成不能是未来日期');if(n.start&&n.finish&&n.finish<n.start)errors.push('节点完成不能早于起算');if(n.due&&(!n.reason||!['notice','contract','reminder'].includes(n.kind)))errors.push('节点期限须选择来源并填写依据');}
  return errors;
 }
 function timeline(c,now=base.today()){
  if((c.scenario||'work')==='work')return base.timeline(c,now).map(r=>({...r,unit:r.year?'year':'days',calculation:r.hasOverride?'采用你记录的通知期限':'起算次日按日历日计算参考日期；末日顺延与特殊扣除另核'}));
  const s=getScenario(c);if(!s)return [];
  return rulesFor(c).map(rule=>{
   const r={...rule};let anchor=r.node?r.node.start:c[r.anchor],finished=r.node?r.node.finish:c[r.finish],due=null,state='waiting',label='等待起算信息',calculation='',blocked='';
   if(['laborReview','consumerReview'].includes(r.id)&&c.rejected)finished=c.reviewed;
   if(c.scenario==='disclosure'&&c.completed)anchor=c.completed;
   const days=(r.days||0)+(r.extend?(c.extensionDays||0):0);
   if(anchor&&r.days)due=r.unit==='workdays'?addWorkdays(anchor,days):base.addDays(anchor,days);
   calculation=r.unit==='workdays'?`起算次日起计${days}个工作日；使用2026—2027全国放假调休表`:`起算次日起计${days}个自然日；末日节假日顺延另核`;
   if(anchor&&r.unit==='workdays'&&!due)blocked='缺少该年度调休日历，请记录明确期限';
   if(s.effective&&c.submitted&&c.submitted<s.effective)blocked='收件早于本版规则施行日期，请核实过渡适用';
   if(c.scenario==='subsistence'&&!c.localPolicy)blocked='请先核实当地现行期限，或记录当地通知日期';
   if(c.specialTiming&&((c.scenario==='labor'&&r.id==='laborAward')||(c.scenario==='consumer'&&r.id==='consumerMediation')||c.scenario==='disclosure'||(c.scenario==='aid'&&r.id==='aidReview')))blocked='已记录特殊计时，须向办理方核实剩余期间';
   if(c.needsSupplement&&['laborReview','aidReview'].includes(r.id))blocked='已记录补正，审查期限需结合实际扣除核实';
   if(c.scenario==='disclosure'&&c.needsSupplement&&!c.completed)blocked='补正中，等待收到补正申请的起算日期';
   if(c.scenario==='aid'&&r.id==='aidAssign'&&!c.aidGranted){state='optional';label='仅给予援助后适用';due=null;}
   if(r.node){due=r.node.due||null;calculation=r.node.kind==='reminder'?'你自行设置的联系提醒，不是办理方期限':r.node.kind==='contract'?'你记录的合同约定日期，未核验条款':'你记录的通知 / 当地指南日期，未核验文书';if(!due)blocked='未记录期限，可根据真实依据补充';}
   let hasOverride=false;const override=c.overrides?.[r.id];
   if(blocked){due=null;state=anchor?'confirm':'waiting';label=blocked;}
   if(override){due=override.date;hasOverride=true;calculation='采用你记录的明确期限；依据：'+override.reason;state='waiting';}
   if(c.scenario==='aid'&&r.id==='aidAssign'&&!c.aidGranted){due=null;state='optional';label='仅给予援助后适用';}
   if(c.rejected&&!['laborReview','consumerReview'].includes(r.id)){due=null;state='optional';label='未受理，不启动后续程序';}
   if(finished){state='done';label='已记录完成';}
   else if(due&&state!=='optional'){const left=base.diff(due,now);state=left<0?'late':left===0?'today':left<=3?'soon':'active';label=left<0?'超过参考日':left===0?'今天到参考日':left<=3?'临近参考日':'参考计时中';}
   return {...r,anchor,finished,due,state,label,hasOverride,left:due?base.diff(due,now):null,calculation,unit:r.unit||'days',days,action:blocked?blocked+'。'+r.action:r.action};
  });
 }
 function primary(c,now=base.today()){if((c.scenario||'work')==='work'){const p=base.primary(c,now);return p?timeline(c,now).find(r=>r.id===p.id):null;}return timeline(c,now).find(r=>['active','soon','today','late','confirm','paused'].includes(r.state))||null;}
 function cleanIntake(input){const result={};if(!input||typeof input!=='object'||Array.isArray(input))return result;for(const key of ['brief','city','employer','relationship','accidentType','treatment','concern','stage','subject','amount','request','eventDate','recognitionResult'])if(typeof input[key]==='string')result[key]=input[key].slice(0,key==='brief'?2400:key==='request'?600:200);result.confirmed=input.confirmed===true;return result;}
 function normalize(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('事项数据不是有效对象');
  const scenario=input.scenario||'work';if(!getScenario(scenario))throw Error('不支持的场景类型');
  if(scenario==='work')return {...base.normalize(input),scenario:'work',intake:cleanIntake(input.intake)};
  const c={...base.normalize({name:input.name,role:input.role,agency:input.agency,caseNumber:input.caseNumber,localUrl:input.localUrl,materials:input.materials,notes:input.notes}),scenario,overrides:{},intake:cleanIntake(input.intake)};
  for(const k of Object.keys(dateFields(c)))if(typeof input[k]==='string')c[k]=input[k].slice(0,10);
  for(const k of ['extensionEvidence','timingEvidence','policyEvidence'])c[k]=typeof input[k]==='string'?input[k].slice(0,500):'';
  for(const k of ['needsSupplement','specialTiming','localPolicy','aidGranted','rejected'])c[k]=input[k]===true;
  c.extensionDays=input.extensionDays===undefined?0:Number(input.extensionDays);
  if(!Number.isFinite(c.extensionDays))throw Error('延期天数无效');
  if(getScenario(c).mode==='manual'){
   c.customNodes=(Array.isArray(input.customNodes)&&input.customNodes.length?input.customNodes:defaultNodes(c)).slice(0,13).map(n=>{const o={};for(const k of ['id','title','actor','start','finish','due','reason','kind'])o[k]=String(n?.[k]||'').slice(0,k==='reason'?500:k==='title'||k==='actor'?100:40);return o;});
  }
  for(const r of rulesFor(c)){const o=input.overrides?.[r.id];if(o)c.overrides[r.id]={date:String(o.date||'').slice(0,10),reason:String(o.reason||'').slice(0,500)};}
  const errors=validate(c);if(errors.length)throw Error(errors.join('；'));return c;
 }
 function encode(c){const bytes=new TextEncoder().encode(JSON.stringify({version:2,data:c}));let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return 'XQ2.'+btoa(binary);}
 function decode(code){if(typeof code!=='string'||code.length>2000000||!/^XQ[12]\./.test(code))throw Error('请使用完整的 XQ1. 或 XQ2. 进度码（不超过2MB）');let o;try{o=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.slice(4).trim()),x=>x.charCodeAt(0))));}catch{throw Error('进度码不完整或已损坏');}if(![1,2].includes(o.version)||code[2]!==String(o.version))throw Error('进度码版本不匹配');return normalize(o.data);}
 const api={...base,sources,scenarios,getScenario,rulesFor,dateFields,materialsFor,defaultNodes,isWorkday,addWorkdays,validate,timeline,primary,normalize,encode,decode};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Xianqi=api;
})(globalThis);
