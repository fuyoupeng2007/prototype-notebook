(function (root) {
  'use strict';
  const DAY = 86400000;
  function parse(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
    const [y,m,d]=s.split('-').map(Number), t=Date.UTC(y,m-1,d);
    return new Date(t).toISOString().slice(0,10)===s ? t : null;
  }
  const iso=t=>new Date(t).toISOString().slice(0,10);
  const addDays=(s,n)=>parse(s)===null?null:iso(parse(s)+n*DAY);
  function addYear(s) { if(parse(s)===null)return null; const [y,m,d]=s.split('-').map(Number); return iso(Date.UTC(y+1,m-1,Math.min(d,new Date(Date.UTC(y+1,m,0)).getUTCDate()))); }
  const diff=(a,b)=>(parse(a)-parse(b))/DAY;
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const sources={
    regulation:{title:'工伤保险条例',issuer:'国务院',version:'国务院令第375号；2010年国务院令第586号修订',effective:'修订文本自2011年1月1日起施行',url:'https://xzfg.moj.gov.cn/front/law/detail?LawID=610'},
    recognition:{title:'工伤认定办法',issuer:'人力资源和社会保障部',version:'人力资源和社会保障部令第8号',effective:'2011年1月1日起施行',url:'https://www.mohrss.gov.cn/gsbxs/zhengcewenjian/201101/t20110107_82865.html',alternate:'https://www.gsjn.gov.cn/zfxxgk/zfbmxxgk/rsj/fdzdgknr/lzyj/art/2022/art_00b282d2acd74c2882fa8221c88be591.html'},
    appraisal:{title:'劳动能力鉴定管理办法',issuer:'人力资源社会保障部、国家卫生健康委',version:'人力资源社会保障部、国家卫生健康委令第55号',effective:'2025年7月1日起施行',url:'https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzdfzwgz/202511/t20251113_527963.html',alternate:'https://www.gov.cn/gongbao/2025/issue_12106/202506/content_7028414.html'},
    hubei:{title:'湖北省劳动能力鉴定管理办法',issuer:'湖北省人力资源社会保障厅、省卫生健康委员会',version:'省厅官网2026年5月29日发布文本（适用与过渡条款请核对原文）',effective:'仅在选择湖北参考口径时使用',url:'https://rst.hubei.gov.cn/zfxxgk/zc/gfxwj/202605/t20260529_5946575.shtml'},
    exception:{title:'最高人民法院关于审理工伤保险行政案件若干问题的规定',issuer:'最高人民法院',version:'法释〔2014〕9号',effective:'2014年9月1日起施行',url:'https://www.court.gov.cn/fabu/xiangqing/6775.html'}
  };
  const rules=[
    {id:'employer',title:'单位提出工伤认定申请',actor:'用人单位',anchor:'injury',finish:'submitted',days:30,source:'regulation',article:'第十七条第一款',quote:'所在单位应当自事故伤害发生之日或者被诊断、鉴定为职业病之日起30日内，向统筹地区社会保险行政部门提出工伤认定申请。',action:'请单位确认是否申报，索取提交回执。特殊情况经同意可延长，不能仅凭参考日期认定单位违法。'},
    {id:'personal',title:'本人、近亲属或工会申请',actor:'职工本人 / 近亲属 / 工会',anchor:'injury',finish:'submitted',year:true,source:'regulation',article:'第十七条第二款',quote:'用人单位未按前款规定提出工伤认定申请的，工伤职工或者其近亲属、工会组织在事故伤害发生之日或者被诊断、鉴定为职业病之日起1年内，可以直接向用人单位所在地统筹地区社会保险行政部门提出工伤认定申请。',action:'单位未按规定申请时，请尽快咨询受理地人社部门。存在非本人原因耽误的时间时，应核实能否扣除，参考日期经过不等于权利自动消灭。'},
    {id:'review',title:'审核材料与受理',actor:'受理地社会保险行政部门',anchor:'submitted',finish:'accepted',days:15,source:'recognition',article:'第八条',quote:'社会保险行政部门收到工伤认定申请后，应当在15日内对申请人提交的材料进行审核，材料完整的，作出受理或者不予受理的决定；材料不完整的，应当以书面形式一次性告知申请人需要补正的全部材料。',action:'询问收到材料的日期、是否完整，以及有无补正通知。提交回执不等于受理通知。补正后的审核以收到全部补正材料为起点核实。'},
    {id:'recognition',title:'作出工伤认定决定',actor:'社会保险行政部门',anchor:'accepted',finish:'decision',days:60,source:'regulation',article:'第二十条',quote:'社会保险行政部门应当自受理工伤认定申请之日起60日内作出工伤认定的决定。',action:'用受理通知核对起算日期。事实清楚、权利义务明确时为15日；等待有权机关结论的法定中止期间需另行核对。'},
    {id:'delivery',title:'工伤认定决定送达',actor:'社会保险行政部门',anchor:'decision',finish:'received',days:20,source:'recognition',article:'第二十二条',quote:'社会保险行政部门应当自工伤认定决定作出之日起20日内，将《认定工伤决定书》或者《不予认定工伤决定书》送达受伤害职工（或者其近亲属）和用人单位，并抄送社会保险经办机构。',action:'核对决定作出日期与实际送达日期，保留签收或电子送达凭证。送达方式和法律效果需结合具体事实。'},
    {id:'appraisal',title:'作出劳动能力鉴定结论',actor:'设区市劳动能力鉴定委员会',anchor:'appraisalApplied',finish:'appraisalDecision',days:60,source:'appraisal',article:'第十条第二款',quote:'申请人提供材料完整的，劳动能力鉴定委员会应当及时组织鉴定，并在收到劳动能力鉴定申请之日起60日内作出劳动能力鉴定结论。伤病情复杂、涉及医疗卫生专业较多的，作出劳动能力鉴定结论的期限可以延长30日。',action:'伤情相对稳定且存在残疾、影响劳动能力时，向劳动能力鉴定委员会申请。完整材料的收到日期与受理日期可能不同；复杂伤情延长须核对通知。'},
    {id:'appraisalDelivery',title:'劳动能力鉴定结论送达',actor:'劳动能力鉴定委员会',anchor:'appraisalDecision',finish:'appraisalReceived',days:15,source:'appraisal',article:'第十七条',quote:'劳动能力鉴定委员会应当自作出鉴定结论之日起15日内将劳动能力鉴定结论及时送达被鉴定人及其用人单位，并抄送人力资源社会保障行政部门和社会保险经办机构。',action:'保留鉴定结论的实际签收日期。2025年施行的新办法规定结论送达为15日，请勿沿用旧20日口径。'},
    {id:'reappraisal',title:'不服初次鉴定：再次鉴定申请',actor:'职工 / 用人单位 → 省级劳动能力鉴定委员会',anchor:'appraisalReceived',finish:'reappraisalApplied',days:15,source:'regulation',article:'第二十六条',quote:'申请鉴定的单位或者个人对设区的市级劳动能力鉴定委员会作出的鉴定结论不服的，可以在收到该鉴定结论之日起15日内向省、自治区、直辖市劳动能力鉴定委员会提出再次鉴定申请。',action:'仅在不服设区市初次鉴定结论、希望再次鉴定时适用。它与不服工伤认定决定的行政救济不是同一个程序。'}
  ];
  const dateLabels={injury:'事故发生 / 职业病诊断日期',submitted:'人社部门收到首次申请',completed:'收到全部补正材料',accepted:'认定受理通知日期',decision:'认定决定作出日期',received:'认定决定送达日期',appraisalApplied:'鉴定完整材料收到日期',appraisalAccepted:'鉴定受理文书日期（湖北）',appraisalDecision:'鉴定结论作出日期',appraisalReceived:'鉴定结论送达日期',reappraisalApplied:'再次鉴定申请提交日期'};
  function validate(c,now=today()) {
    const errors=[]; let prev=null,prevName='';
    const keys=['injury','submitted','completed','accepted','decision','received','appraisalApplied','appraisalAccepted','appraisalDecision','appraisalReceived','reappraisalApplied'];
    for(const k of keys){const s=c[k];if(!s)continue;if(parse(s)===null){errors.push(dateLabels[k]+'格式不正确');continue;}if(s>now)errors.push(dateLabels[k]+'不能是未来日期');if(prev&&s<prev)errors.push(dateLabels[k]+'不能早于'+prevName);prev=s;prevName=dateLabels[k];}
    if(c.pauseStart&&(!c.accepted||c.pauseStart<c.accepted))errors.push('中止开始不能早于认定受理日期');
    if(c.pauseStart&&(parse(c.pauseStart)===null||c.pauseStart>now))errors.push('中止开始日期不正确');
    if(c.pauseEnd&&(!c.pauseStart||parse(c.pauseEnd)===null||c.pauseEnd<c.pauseStart||c.pauseEnd>now))errors.push('恢复日期须在中止开始之后且不晚于今天');
    if(c.pauseStart&&!c.pauseEvidence)errors.push('请记录中止通知的文号或日期依据');
    if(c.decision&&c.pauseStart&&!c.pauseEnd)errors.push('已记录认定决定，请先核实中止是否已恢复');
    for(const id of Object.keys(c.overrides||{})){const o=c.overrides[id];if(!rules.some(r=>r.id===id)||!o||parse(o.date)===null||!String(o.reason||'').trim())errors.push('机关期限须填写有效日期和通知依据');}
    return errors;
  }
  function timeline(c,now=today()){
    return rules.map(rule=>{
      const r={...rule};let anchor=c[r.anchor],hasOverride=false;
      if(r.id==='review'&&c.completed)anchor=c.completed;
      if(r.id==='recognition'&&c.simple) {r.days=15;r.source='recognition';r.article='第二十一条';r.quote='社会保险行政部门对于事实清楚、权利义务明确的工伤认定申请，应当自受理工伤认定申请之日起15日内作出工伤认定决定。';}
      if(r.id==='appraisal'){
        if(c.region==='hubei'){anchor=c.appraisalAccepted;r.source='hubei';r.article='第十四条';r.quote='劳动能力鉴定委员会应当自受理劳动能力鉴定申请之日起六十日内作出劳动能力鉴定结论。伤病情复杂、涉及医疗卫生专业较多的，作出劳动能力鉴定结论的期限可以延长三十日。';}
        if(c.appraisalExtended)r.days=90;
      }
      let due=anchor?(r.year?addYear(anchor):addDays(anchor,r.days)):null;
      if(r.id==='recognition'&&due&&c.pauseStart&&c.pauseEnd)due=addDays(due,diff(c.pauseEnd,c.pauseStart));
      const override=c.overrides?.[r.id];if(override){due=override.date;hasOverride=true;}
      let state='waiting',label='等待起算信息'; const finish=c[r.finish];
      if(finish){state='done';label='已记录完成';}
      else if(r.id==='reappraisal'&&!c.dispute){state='optional';label='按需申请';}
      else if(r.id==='review'&&c.needsSupplement&&!c.completed){state='confirm';label='补正中 · 需确认';due=null;}
      else if(r.id==='recognition'&&c.pauseStart&&!c.pauseEnd&&anchor){state='paused';label='已记录中止';due=null;}
      else if(anchor&&due){const left=diff(due,now);state=left<0?'late':left===0?'today':left<=Math.max(3,Math.ceil((r.year?365:r.days)*.2))?'soon':'active';label=state==='late'?'超过参考日':state==='today'?'今天到参考日':state==='soon'?'临近参考日':'参考计时中';}
      return {...r,anchor,due,state,label,finished:finish,hasOverride,left:due?diff(due,now):null};
    });
  }
  function primary(c,now=today()){const a=timeline(c,now).filter(x=>['active','soon','today','late','confirm','paused'].includes(x.state));return a.find(x=>x.id!=='employer'&&x.id!=='personal')||a.find(x=>x.id==='employer'&&x.left>=0)||a.find(x=>x.id==='personal')||a[0]||null;}
  function normalize(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('进度数据不是有效对象');
    const c={id:cryptoId(),name:'我的工伤事项',role:'family',region:'national',materials:{},notes:[],overrides:{}};
    const strings=['name','role','region','agency','caseNumber','contact','localUrl','injury','submitted','completed','accepted','decision','received','appraisalApplied','appraisalAccepted','appraisalDecision','appraisalReceived','reappraisalApplied','pauseStart','pauseEnd','pauseEvidence'];
    strings.forEach(k=>{if(typeof input[k]==='string')c[k]=input[k].slice(0,500);});
    ['simple','needsSupplement','appraisalExtended','dispute'].forEach(k=>c[k]=input[k]===true);
    for(const r of rules){const o=input.overrides?.[r.id];if(o)c.overrides[r.id]={date:String(o.date||'').slice(0,10),reason:String(o.reason||'').slice(0,500)};}
    if(input.materials&&typeof input.materials==='object')for(const [k,v]of Object.entries(input.materials)){if(/^[a-z0-9_-]{1,40}$/.test(k)&&['todo','ready','other'].includes(v))c.materials[k]=v;}
    if(Array.isArray(input.notes))c.notes=input.notes.slice(-100).filter(x=>x&&typeof x.text==='string').map(x=>({date:parse(x.date)!==null?x.date:today(),text:x.text.slice(0,1500)}));
    const e=validate(c);if(e.length)throw Error(e.join('；'));return c;
  }
  function cryptoId(){return globalThis.crypto?.randomUUID?.()||'case-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
  function encode(c){const bytes=new TextEncoder().encode(JSON.stringify({version:1,data:c}));let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return 'XQ1.'+btoa(binary);}
  function decode(code){if(typeof code!=='string'||code.length>2000000||!code.startsWith('XQ1.'))throw Error('请粘贴以 XQ1. 开头的完整进度码（不超过2MB）');let o;try{o=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.slice(4).trim()),x=>x.charCodeAt(0))));}catch{throw Error('进度码不完整或已损坏');}if(o.version!==1)throw Error('暂不支持此版本进度码');return normalize(o.data);}
  const api={parse,iso,addDays,addYear,diff,today,sources,rules,dateLabels,validate,timeline,primary,normalize,encode,decode,cryptoId};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Xianqi=api;
})(globalThis);
