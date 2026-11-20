/* 交付前哨：有限规则提取与可复算预检。无需模型，也不替用户提交文件。 */
(() => {
'use strict';
const EXT_LABEL={pdf:'PDF 报告',zip:'ZIP 源码包',mp4:'MP4 演示视频',docx:'DOCX 文档',txt:'TXT 文字材料',md:'Markdown 材料'};
const MB=1000*1000;
const round=n=>Math.round(n*100)/100;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceLines=text=>String(text||'').split(/\r?\n/).map((text,i)=>({line:i+1,text:text.trim()})).filter(x=>x.text);
const extOf=name=>String(name||'').split('.').pop().toLowerCase();
const fmtBytes=n=>n>=MB?`${round(n/MB)} MB`:`${Math.ceil(n/1000)} KB`;
const fmtSeconds=n=>n===null||!Number.isFinite(n)?'未读取':`${round(n)} 秒`;
function parseDeadline(text){
 const m=text.match(/(20\d{2})\s*[-年/.]\s*(\d{1,2})\s*[-月/.]\s*(\d{1,2})\s*日?\s*(\d{1,2})\s*[:：]\s*(\d{2})/);
 if(!m)return null;
 const [y,mo,d,h,mi]=m.slice(1).map(Number);
 if(mo<1||mo>12||d<1||d>31||h>23||mi>59)return null;
 const value=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')} ${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`;
 const timestamp=Date.parse(value.replace(' ','T')+':00+08:00');
 const time=new Date(timestamp+8*3600000);
 if(time.getUTCFullYear()!==y||time.getUTCMonth()+1!==mo||time.getUTCDate()!==d)return null;
 return {value,timestamp,timeZone:'Asia/Shanghai'};
}
function extract(text,sourceId='N1'){
 const rules=[],unparsed=[];
 for(const line of sourceLines(text)){
  const t=line.text,source={id:sourceId,line:line.line,quote:t};let recognized=false;
  const found=[...new Set((t.match(/\b(?:PDF|ZIP|MP4|DOCX|TXT|MD)\b/gi)||[]).map(x=>x.toLowerCase()))];
  if(found.length===1){
   const ext=found[0];
   const conditionText=t.replace(/不得超过|不超过/g,'');
   if(/(?:不接受|不允许|禁止|不能|不得|无需|不需|不必|不用|可不|免交|取消)/.test(conditionText)){
    unparsed.push({id:`${sourceId}-${line.line}-negative`,source,reason:'含否定或取消条件，不能安全解释为必交；请人工确认。'});
   }else if(/(?:或者|二选一|任选|择一|至少|不少于|大于|以上|≥|>|可选|可以|建议|推荐|可提交|可使用|可用|选交|选做)/.test(t)){
    unparsed.push({id:`${sourceId}-${line.line}-ambiguous`,source,reason:'含替代选项、下限或复杂条件，本地提取仅支持单一格式与上限。'});
   }else{
    const rule={key:`file:${ext}`,type:'file',ext,label:EXT_LABEL[ext],required:true,sources:{required:source}};
    const size=t.match(/(?:不超过|不得超过|最多|小于等于|≤|<=|上限(?:为)?|限制(?:为)?)\s*(\d+(?:\.\d+)?)\s*MB\b/i);
    const duration=t.match(/(?:不超过|不得超过|最多|小于等于|≤|<=|上限(?:为)?|改为)\s*(\d+(?:\.\d+)?)\s*(分钟|秒|min\b|s\b)/i);
    if(size&&+size[1]>0){rule.maxMB=+size[1];rule.sources.maxMB=source}
    if(duration&&+duration[1]>0&&ext==='mp4'){rule.maxSeconds=+duration[1]*(/分钟|min/i.test(duration[2])?60:1);rule.sources.maxSeconds=source}
    rules.push(rule);recognized=true;
    if((/\bMB\b/i.test(t)&&(!size||+size[1]<=0))||((/时长|分钟|秒/.test(t))&&(!duration||+duration[1]<=0||ext!=='mp4'))){
     unparsed.push({id:`${sourceId}-${line.line}-number`,source,reason:'格式已提取，但数值条件未能确定；请核对该行全部要求。'});
    }
   }
   recognized=true;
  }else if(found.length>1){
   recognized=true;unparsed.push({id:`${sourceId}-${line.line}-multi`,source,reason:'同一行含多种格式，无法确定是并列还是可选；请拆为一行一种必交格式再解析。'});
  }
  if(/截止|截稿|提交期限/.test(t)){
   recognized=true;const date=parseDeadline(t);
   if(date)rules.push({key:'deadline',type:'deadline',label:'本地预检截止提醒',...date,sources:{value:source}});
   else unparsed.push({id:`${sourceId}-${line.line}-date`,source,reason:'未识别完整年月日和时分；请使用 YYYY-MM-DD HH:mm，并核对时区。'});
  }
  if(/匿名|(?:不得|不能|不允许)(?:出现|包含|含有|含).*(?:姓名|学校|学号|个人信息)/.test(t)){
   recognized=true;
   if(/不(?:必|需|用|要求).*匿名|无需.*匿名|取消.*匿名/.test(t))unparsed.push({id:`${sourceId}-${line.line}-anon`,source,reason:'含匿名要求的取消或否定，本地引擎无法安全覆盖；请人工确认。'});
   else rules.push({key:'anonymity',type:'anonymity',label:'交付物匿名核对',required:true,sources:{required:source}});
  }
  const unsupported=/命名|命名为|页数|\d+\s*页|分辨率|帧率|文件夹|目录结构|至少包含|必须包含|需要包含|应包含|须包含|内容包括|(?:报告|文档|视频|代码)(?:中|需|要).*?(?:包含|包括)/.test(t);
  if(unsupported)unparsed.push({id:`${sourceId}-${line.line}-content`,source,reason:'内容、页数、命名或结构要求尚无自动验证器，必须人工复核。'});
  else if(!recognized&&/(?:必须|务必|须|需要|不超过|不得|严禁|改为|调整为|提交要求)/.test(t)&&t.length>8){
   if(!/^(?:课程设计|课程作业|作业|项目|实验).*?提交要求[：:]?[。.]?$/.test(t))
    unparsed.push({id:`${sourceId}-${line.line}-other`,source,reason:'未解析的要求或适用范围；请人工确认。'});
  }
 }
 // Conflicting rules within one notice must not silently choose the last occurrence.
 const merged=[];
 for(const rule of rules){
  const prev=merged.find(x=>x.key===rule.key);
  if(!prev){merged.push(rule);continue}
  const fields=rule.type==='file'?['maxMB','maxSeconds']:rule.type==='deadline'?['value']:[];
  if(fields.some(k=>rule[k]!==undefined&&prev[k]!==undefined&&rule[k]!==prev[k])){
   unparsed.push({id:`${sourceId}-${Object.values(rule.sources)[0].line}-conflict`,source:Object.values(rule.sources)[0],reason:'同一通知对同项给出不同值；自动规则保留首次值，请先修改或人工澄清。'});
  }else{Object.assign(prev,rule,{sources:{...prev.sources,...rule.sources}})}
 }
 return {rules:merged,unparsed};
}
function mergeRules(current,incoming){
 const list=current.map(x=>({...x,sources:{...x.sources}}));
 for(const rule of incoming){const i=list.findIndex(x=>x.key===rule.key);if(i<0)list.push({...rule,sources:{...rule.sources}});else list[i]={...list[i],...rule,sources:{...list[i].sources,...rule.sources}}}
 return list;
}
function ruleText(r){
 if(r.type==='file')return `必交 .${r.ext.toUpperCase()}${r.maxMB!==undefined?` · 单个 ≤ ${r.maxMB} MB`:''}${r.maxSeconds!==undefined?` · 时长 ≤ ${r.maxSeconds} 秒`:''}`;
 if(r.type==='deadline')return `${r.value}（北京时间）`;
 return '逐个核对文件名及内容中的指定敏感词';
}
function diffRules(current,incoming){
 return incoming.map(r=>{const old=current.find(x=>x.key===r.key),next=old?mergeRules([old],[r])[0]:r;return {key:r.key,label:r.label,kind:old?'修改':'新增',before:old?ruleText(old):'当前无此要求',after:ruleText(next),sources:r.sources}}).filter(x=>x.before!==x.after);
}
function cleanWords(text){return [...new Set(String(text||'').split(/[,，、;；\n]/).map(x=>x.trim()).filter(Boolean))].slice(0,20)}
function check(rules,files,options={}){
 const items=[],words=Array.isArray(options.words)?options.words:cleanWords(options.words),manual=options.confirmed||{};
 const add=(id,status,title,detail,rule,evidence='')=>items.push({id,status,title,detail,ruleKey:rule?.key||null,evidence,sources:rule?Object.values(rule.sources||{}):[]});
 for(const r of rules){
  if(r.type==='file'){
   const matched=files.filter(f=>extOf(f.name)===r.ext);
   add(`${r.key}:exists`,matched.length?'pass':'fail',`${r.label} · 是否齐全`,matched.length?`找到 ${matched.length} 个 .${r.ext} 文件。这里只核对扩展名，未验证二进制内容完整性。`:`缺少 .${r.ext} 文件；文件名不同但格式正确也可以匹配。`,r,matched.map(f=>f.name).join('、'));
   for(const f of matched){
    if(r.maxMB!==undefined)add(`${r.key}:size:${f.id}`,f.size<=r.maxMB*MB?'pass':'fail',`${f.name} · 文件大小`,`${fmtBytes(f.size)} / 上限 ${r.maxMB} MB（1 MB = 1,000,000 字节）`,r,`size=${f.size} bytes`);
    if(r.maxSeconds!==undefined){
     const readable=Number.isFinite(f.duration)&&f.duration>=0;
     add(`${r.key}:duration:${f.id}`,readable?(f.duration<=r.maxSeconds?'pass':'fail'):'review',`${f.name} · 视频时长`,readable?`${f.example?'示例预设时长':'浏览器实测时长'} ${fmtSeconds(f.duration)} / 上限 ${r.maxSeconds} 秒`:'浏览器未能读取视频时长，请使用播放器人工核对；文件可能损坏或编码不受支持。',r,readable?`duration=${f.duration} s; ${f.example?'示例元数据':'HTMLMediaElement.loadedmetadata'}`:'duration unavailable');
    }
   }
  }else if(r.type==='deadline'){
   const now=Number.isFinite(options.now)?options.now:Date.now();
   add('deadline:clock',now<=r.timestamp?'info':'fail','截止时间 · 本机时钟提醒',now<=r.timestamp?`当前未超过 ${r.value}（北京时间）。这不是平台已提交的证明。`:`本机时钟已超过 ${r.value}（北京时间）。请向课程平台核实实际状态。`,r,`checkedAt=${new Date(now).toISOString()}`);
  }else if(r.type==='anonymity'){
   if(!files.length)add('anonymous:no-files','review','匿名要求 · 尚无文件','请先选择交付文件，再逐项核对。',r);
   if(!words.length)add('anonymous:no-words','review','匿名要求 · 敏感词尚未指定','输入要检查的确切姓名、学校或其他敏感词；没有指定词时不会把匿名性判为通过。',r);
   for(const f of files){
    const nameHits=words.filter(w=>f.name.includes(w));
    const textReadable=typeof f.textContent==='string';
    const bodyHits=textReadable?words.filter(w=>f.textContent.includes(w)):[];
    const hits=[...new Set([...nameHits,...bodyHits])];
    if(hits.length)add(`anonymous:file:${f.id}`,'fail',`${f.name} · 匿名核对`,`在${nameHits.length?'文件名':''}${nameHits.length&&bodyHits.length?'和':''}${bodyHits.length?'文字内容':''}中命中：${hits.join('、')}。`,r,`精确字符串匹配；${f.example?'示例内容':'实际文件'}`);
    else if(words.length&&textReadable)add(`anonymous:file:${f.id}`,'pass',`${f.name} · 指定词检查`,`文件名与可读取文本中未命中指定词。不代表已识别所有个人信息。`,r,`checked terms=${words.length}; ${f.example?'示例内容':'UTF-8 文字内容'}`);
    else add(`anonymous:file:${f.id}`,'review',`${f.name} · 内容需人工核对`,`${words.length?'文件名未命中指定词；':''}${textReadable?'未指定词，无法自动检查。':'PDF、DOCX、ZIP 内部、视频画面和音轨等内容未解析。'}请人工检查后确认。`,r,`${f.example?'示例数据':'实际文件'}；${f.textStatus||'内容未读取'}`);
   }
  }
 }
 for(const u of options.unparsed||[]){add(`unparsed:${u.id}`,'review','原文未解析要求',`${u.source.id} 第 ${u.source.line} 行：${u.source.quote} — ${u.reason}`,null);items[items.length-1].sources=[u.source]}
 if(!rules.length&&!options.unparsed?.length)add('empty-rules','review','尚无生效规则','请先粘贴通知并解析，再核对规则。',null);
 if(!files.length)add('empty-files','review','尚未载入提交包','上传真实文件，或明确选择示例提交包。',null);
 for(const item of items){if(item.status==='review'&&manual[item.id]){item.status='human';item.confirmedAt=manual[item.id]}}
 const summary={pass:0,fail:0,review:0,human:0,info:0};for(const item of items)summary[item.status]++;
 return {items,summary};
}
const Engine={extract,mergeRules,diffRules,check,parseDeadline,cleanWords,ruleText,extOf};
if(typeof module!=='undefined'&&module.exports)module.exports=Engine;
if(typeof window!=='undefined')window.DeliveryEngine=Engine;
if(typeof document==='undefined')return;

const SAMPLE_BASE='课程设计提交要求\n报告：必须提交 PDF 文件，单个不超过 10 MB。\n源码：必须提交 ZIP 文件，单个不超过 30 MB。\n演示：必须提交 MP4 视频，时长不超过 180 秒，单个不超过 50 MB。\n截止：2027-01-15 18:00（北京时间）。\n报告需要包含方法、结果和讨论。';
const SAMPLE_UPDATE='课程设计补充通知\n演示视频：仍为 MP4，时长改为不超过 120 秒，单个不超过 40 MB。\n所有交付物须匿名，不得出现姓名和学校。\n截止改为：2027-01-14 18:00（北京时间）。';
const $=selector=>document.querySelector(selector);
const KEY='delivery-outpost-v1';
function defaultState(){const extraction=extract(SAMPLE_BASE,'N1');return {version:1,counter:1,baseDraft:SAMPLE_BASE,updateDraft:SAMPLE_UPDATE,activeBase:SAMPLE_BASE,sourceHistory:[{id:'N1',title:'内置示例 · 初始通知',text:SAMPLE_BASE}],rules:extraction.rules,unparsed:extraction.unparsed,words:'张三，示范大学',applied:[],tab:'base'}}
let state=defaultState(),files=[],mode='none',result=null,stale=false,reading=false,pending=null,resultFilter='all',token=0,toastTimer;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&saved.schema===1&&Array.isArray(saved.rules)&&Array.isArray(saved.sourceHistory)&&saved.rules.every(r=>r&&typeof r.key==='string'&&r.sources)&&typeof saved.baseDraft==='string'&&typeof saved.updateDraft==='string')state={...defaultState(),...saved,tab:'base'}}catch{}
let dirty=state.baseDraft!==state.activeBase;
function persist(){try{localStorage.setItem(KEY,JSON.stringify({...state,schema:1}))}catch{toast('当前浏览器未能保存规则；你仍可运行检查并导出证据。')}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3300)}
function invalidate(reason){stale=!!result;state.confirmed={};if(result)result.invalidReason=reason;persist()}
function sourcesFor(rule){return [...new Map(Object.values(rule.sources||{}).map(s=>[s.id+':'+s.line,s])).values()]}
function sourceRefs(rule){return sourcesFor(rule).map(s=>`<button class="source-view" data-source="${esc(s.id)}" data-line="${s.line}">${esc(s.id)} · L${s.line} ↗</button>`).join('　')}
function render(){
 const sum=result&&!stale?result.summary:null,unresolved=state.unparsed.length;
 $('#app').innerHTML=`<header class="topbar"><div class="brand"><span class="logo">✓</span>交付前哨<small>HAND IN, WITH PROOF.</small></div><div class="top-meta"><span>方向 01 / 学习交付</span><a href="../index.html">← 返回三个方向</a></div></header><main class="main"><section class="intro"><div><div class="kicker">FROM REQUIREMENTS TO CHECKABLE EVIDENCE</div><h1>都做完了，<em>真的交得上吗？</em></h1><p>老师改了要求，报告、源码和视频却还停在上一版。把通知变成验收规则，检查手边的真实文件，给每个结果留一份依据。</p></div><div class="intro-art" aria-hidden="true"><div class="art-page"><b>老师通知</b><i></i><i></i><i></i></div>→<div class="art-page ok">✓</div></div></section><section class="guide"><div class="guide-copy"><b>一分钟看懂检查流程</b>一键体验问题包，再比较补充通知。也可以直接选择自己的真实文件。</div><div class="toolbar"><button class="btn small yellow" id="start-demo" ${dirty?'disabled':''}>一键体验问题包 →</button><button class="btn small secondary" id="load-bad">仅载入示例包</button><button class="btn small secondary" id="load-good">替换为合格示例</button></div></section><nav class="phasebar" aria-label="检查步骤"><button class="phase done" data-jump="#source-section"><span class="phase-number">01</span><div><b>看清老师原话</b><small>引用可追溯，变更先确认</small></div></button><button class="phase ${pending?'current':'done'}" data-jump="#rules-section"><span class="phase-number">02</span><div><b>核对生效规则</b><small>当前 V${state.version} · ${state.rules.length} 项自动规则</small></div></button><button class="phase ${result?'current':''}" data-jump="#check-section"><span class="phase-number">03</span><div><b>检查这一次交付</b><small>${sum?`${sum.fail} 项不合格 · ${sum.review} 项待复核`:'真实文件 / 明示示例，两种模式'}</small></div></button></nav><div id="next-action" class="next-action" aria-live="polite">${nextStepView()}</div><div class="workspace"><section class="panel source-panel" id="source-section" tabindex="-1"><div class="panel-head"><div><div class="section-kicker">01 / SOURCE</div><h2>老师的原话</h2></div><button class="btn text" id="reset-demo">重置演示</button></div><div class="tabs" role="tablist" aria-label="通知编辑器"><button role="tab" aria-selected="${state.tab==='base'}" class="${state.tab==='base'?'active':''}" id="base-tab">初始通知</button><button role="tab" aria-selected="${state.tab==='update'}" class="${state.tab==='update'?'active':''}" id="update-tab">后续变更 <span aria-hidden="true">↗</span></button></div><label class="field-label" for="notice-input">${state.tab==='base'?'粘贴课程要求，也可以直接用示例':'粘贴补充通知，先比较再决定是否生效'}</label><textarea class="field" id="notice-input" maxlength="10000" spellcheck="false">${esc(state.tab==='base'?state.baseDraft:state.updateDraft)}</textarea><p class="note">一行一种格式；支持 PDF / ZIP / MP4 等明确格式、MB 上限、视频时长上限、完整截止时间和匿名提示。当前为有限规则提取。</p><button class="btn full ${state.tab==='base'?'':'yellow'}" id="parse-notice">${state.tab==='base'?'核对原文后，生成生效规则':'分析这条变更，比较影响'}</button><div id="parse-message" role="status">${dirty?'<div class="notice amber">初始通知已编辑，旧规则暂未更新。请重新解析后再检查。</div>':''}</div>${pending?pendingView():''}<details class="mini-details"><summary>当前编辑内容的原句编号</summary>${sourceLines(state.tab==='base'?state.baseDraft:state.updateDraft).map(s=>`<div class="source-line"><b>L${s.line}</b>${esc(s.text)}</div>`).join('')}</details><div class="source-tip">新通知不自动等于新规则。你需要先核对发布者、适用班级和覆盖关系，再确认变化。</div></section><section class="panel rules-panel" id="rules-section" tabindex="-1"><div class="panel-head"><div><div class="section-kicker">02 / ACTIVE RULES</div><h2>当前生效规则 <span class="small-count">V${state.version}</span></h2></div><button class="btn text" id="ai-explain">可选 AI 解释</button></div><div class="badge gray">${state.applied.length?'用户已确认覆盖关系':'初始示例规则，可自行修改'}</div>${pending?'<div class="notice amber">有变更尚未确认。下方检查仍使用当前版本。</div>':''}<div class="rule-list">${state.rules.map(r=>`<article class="rule-card"><div class="rule-top"><h3>${esc(r.label)}</h3><span class="rule-type">${r.type==='file'?'FILE':r.type==='deadline'?'CLOCK':'REVIEW'}</span></div><div class="rule-value">${esc(ruleText(r))}</div><div>${sourceRefs(r)}</div>${r.type==='anonymity'?'<div class="rule-sub">只检查你指定的确切敏感词，二进制内容需要人审。</div>':''}</article>`).join('')||'<div class="file-empty">当前没有可自动执行的规则。</div>'}</div><div class="divider"></div><h3>还有 ${unresolved} 句要求不能自动验收</h3><p class="note">${unresolved?'内容、结构或歧义要求会作为人工确认项出现在检查结果中。':'未发现其他明确要求；这并不保证本地引擎理解了整份通知。'}</p><details class="mini-details"><summary>查看未解析原句与原因</summary>${state.unparsed.map(u=>`<div class="source-line"><b>${esc(u.source.id)} · L${u.source.line}</b>${esc(u.source.quote)}<div class="note">${esc(u.reason)}</div></div>`).join('')||'<p>当前无记录</p>'}</details><div class="notice">规则只做可验证的预检。截止以本机时钟提示；通过检查不代表已上传到课程平台。</div></section><section class="panel check-panel" id="check-section" tabindex="-1"><div class="panel-head"><div><div class="section-kicker">03 / DELIVERY CHECK</div><h2>检查交付物</h2></div><span class="badge ${mode==='example'?'yellow':mode==='real'?'green':'gray'}">${mode==='example'?'示例数据模式':mode==='real'?'实际文件模式':'尚未载入'}</span></div><div class="checks-layout"><div class="check-input"><label class="file-zone" id="drop-zone" for="file-input"><span aria-hidden="true">↥</span><strong>选择真实文件，或拖放到这里</strong><small>选择后替换整个提交包，不与示例混用。<br>只在本机读取，不上传文件。</small><input id="file-input" type="file" multiple aria-label="选择真实提交文件"></label><div class="file-mode"><span>${mode==='example'?'以下文件及元数据均为示例预设':mode==='real'?'本次从电脑选择的实际文件':'也可以使用页面上方的示例提交包'}</span><span>${files.length} 个文件</span></div><div class="files">${files.length?files.map(fileView).join(''):'<div class="file-empty">还没有交付物。<br>从上方示例包开始，马上看到检查结果。</div>'}</div>${mode==='example'?'<p class="note">示例包不包含真正二进制文件；大小、时长和文字为演示预设，不冒充实测。</p>':''}<label for="sensitive-words" class="field-label">需要核对的确切敏感词</label><input class="field inline" id="sensitive-words" maxlength="500" value="${esc(state.words)}" placeholder="例如：张三，某某大学"><p class="note">用逗号分隔；只有生效规则包含匿名要求时才执行匹配。文本支持 UTF-8 TXT / MD（≤ 1 MB）；PDF、DOCX、ZIP 内部及视频内容未解析。</p><div class="run-row"><button class="btn" id="run-check" ${reading||dirty?'disabled':''}>${reading?'正在读取文件…':result?'按当前规则重新检查':'运行交付预检'}　→</button><button class="btn secondary" id="export-evidence" ${!result||stale||dirty?'disabled':''}>导出 JSON</button><button class="btn secondary" id="export-report" ${!result||stale||dirty?'disabled':''}>保存中文报告</button></div><p class="export-note">刷新后需重新选择真实文件。中文报告可离线阅读、打印或另存 PDF；JSON 保留完整证据。两者均不含所选文件正文。</p></div><div class="check-results" id="result-section" tabindex="-1"><div class="result-heading"><h3>本轮检查结果</h3><span>自动检查 / 人工确认分开记录</span></div>${resultView()}</div></div></section></div><footer class="footer"><span>交付前哨 / 把“做完了”，变成有依据的交付。</span><details><summary>能力边界与移动端方向</summary><p>本地已实现有限语法提取、规则差异、文件元数据校验与人工复核；未调用大模型。可选 AI 仅解释当前证据，不替代规则和人工判断。手机端拟通过用户主动分享通知、端侧 OCR 和附件选择接入；本版未实现 OCR、后台读取聊天或自动提交。</p><p>场景痛点来自设计推演，尚未做用户访谈；产品差异在于来源→变更→实际附件→验收证据的连贯交互，不宣称首创。</p></details></footer></main>`;
 bind();
}
function pendingView(){return `<section class="pending" aria-label="待确认变更"><h3>${pending.diffs.length} 项规则变化 · 尚未生效</h3>${pending.diffs.map(d=>`<div class="diff-item"><b>${esc(d.kind)} / ${esc(d.label)}</b><div class="diff-from">${esc(d.before)}</div><div class="diff-to">→ ${esc(d.after)}</div></div>`).join('')||'<p class="note">没有识别到可自动应用的规则变化；新增原句仍可能需要人工复核。</p>'}${pending.extraction.unparsed.length?`<p class="note">另外有 ${pending.extraction.unparsed.length} 句未解析要求，将保留为人工复核项。</p>`:''}<label class="confirm"><input type="checkbox" id="confirm-scope">我确认发布者和适用范围，并同意按上方变化覆盖当前规则。没有展示的旧约束仍保留。</label><div class="toolbar"><button class="btn yellow small" id="apply-change" disabled>确认这些变化，生效为 V${state.version+1}</button><button class="btn text" id="cancel-change">暂不应用</button></div></section>`}
function fileView(f){return `<div class="file-row"><div class="file-icon">${esc(extOf(f.name).toUpperCase().slice(0,4))}</div><div class="file-info"><b>${esc(f.name)}</b><small>${fmtBytes(f.size)}${Number.isFinite(f.duration)?` · ${f.example?'示例':'实测'} ${fmtSeconds(f.duration)}`:f.durationStatus==='loading'?' · 时长读取中':f.durationStatus==='unreadable'?' · 时长需复核':''}</small></div><button class="file-remove" data-remove="${esc(f.id)}" aria-label="移除 ${esc(f.name)}">×</button></div>`}
function resultView(){
 if(!result)return '<div class="result-blank">先核对规则，再检查交付。<br>通过项与人工确认项会明确分开。</div>';
 const s=result.summary,status=s.fail?'fail':s.review?'review':'pass',title=s.fail?`${s.fail} 项未通过，需要处理`:s.review?'自动检查完成，仍需人工核对':'本轮预检完成，请到平台正式提交';
 const filtered=result.items.filter(x=>resultFilter==='all'||(resultFilter==='attention'&&(x.status==='fail'||x.status==='review'))||x.status===resultFilter);
 return `${stale?`<div class="notice red" role="alert">上次结果已失效：${esc(result.invalidReason||'规则或交付包已变化')}。请重新检查，旧结果不能导出。</div>`:''}<div class="${stale?'stale-results':''}"><div class="result-summary ${status}"><div><b>${title}</b><small>规则 V${result.version} · ${result.mode==='example'?'示例数据':'实际文件'} · ${new Date(result.at).toLocaleTimeString('zh-CN')}</small></div><span class="count">${s.fail?'!':s.review?'?':'✓'}</span></div><div class="legend"><span><i class="tiny-dot"></i>通过 ${s.pass}</span><span><i class="tiny-dot fail"></i>失败 ${s.fail}</span><span><i class="tiny-dot review"></i>待复核 ${s.review}</span><span><i class="tiny-dot human"></i>人工确认 ${s.human}</span></div><div class="filter" aria-label="结果筛选"><button data-filter="all" class="${resultFilter==='all'?'active':''}">全部 ${result.items.length}</button><button data-filter="attention" class="${resultFilter==='attention'?'active':''}">待处理 ${s.fail+s.review}</button><button data-filter="fail" class="${resultFilter==='fail'?'active':''}">失败 ${s.fail}</button><button data-filter="review" class="${resultFilter==='review'?'active':''}">待复核 ${s.review}</button></div><div class="result-list">${filtered.map(itemView).join('')||'<div class="file-empty">没有未处理项目。</div>'}</div></div>`;
}
function itemView(item){const icon={pass:'✓',fail:'×',review:'?',human:'人',info:'i'}[item.status];return `<article class="result-item"><div class="result-top"><span class="status-icon ${item.status}">${icon}</span><div><div class="result-title">${esc(item.title)}</div><p class="result-detail">${esc(item.detail)}</p>${item.evidence?`<div class="result-evidence">${esc(item.evidence)}</div>`:''}${item.sources?.length?`<div>${[...new Map(item.sources.map(s=>[s.id+':'+s.line,s])).values()].map(s=>`<button class="source-view" data-source="${esc(s.id)}" data-line="${s.line}">依据 ${esc(s.id)} · L${s.line} ↗</button>`).join('　')}</div>`:''}</div></div>${item.status==='review'||item.status==='human'?`<label class="confirm"><input type="checkbox" data-manual="${esc(item.id)}" ${item.status==='human'?'checked':''} ${stale?'disabled':''}>${item.status==='human'?'已记录人工确认（不是自动通过）':'我已人工核对这一项，并确认符合要求'}</label>`:''}</article>`}
function bind(){
 $('#start-demo').onclick=()=>{loadExample(false);run()};$('#load-bad').onclick=()=>loadExample(false);$('#load-good').onclick=()=>loadExample(true);$('#reset-demo').onclick=reset;
 $('#base-tab').onclick=()=>{state.tab='base';render()};$('#update-tab').onclick=()=>{state.tab='update';render()};
 $('#notice-input').addEventListener('input',e=>{if(state.tab==='base'){state.baseDraft=e.target.value;dirty=state.baseDraft!==state.activeBase;$('#run-check').disabled=reading||dirty;$('#parse-message').innerHTML=dirty?'<div class="notice amber">初始通知已编辑，旧规则暂未更新。请重新解析后再检查。</div>':'';if(dirty)invalidate('初始通知已编辑，需重新生成规则');$('#start-demo').disabled=dirty;refreshResultArea()}else{state.updateDraft=e.target.value;if(pending){pending=null;$('.pending')?.remove();$('.rules-panel .notice.amber')?.remove()}}persist();refreshNextStep()});
 $('#parse-notice').onclick=parseNotice;
 $('#confirm-scope')?.addEventListener('change',e=>{$('#apply-change').disabled=!e.target.checked});$('#apply-change')?.addEventListener('click',applyChange);$('#cancel-change')?.addEventListener('click',()=>{pending=null;render();toast('未应用变更，当前规则保持原版本。')});
 $('#sensitive-words').addEventListener('input',e=>{state.words=e.target.value;invalidate('敏感词已改变');refreshResultArea();persist()});
 $('#file-input').addEventListener('change',e=>{readFiles([...e.target.files])});
 const zone=$('#drop-zone');zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragover')});zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragover');readFiles([...e.dataTransfer.files])});
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{token++;reading=false;files=files.filter(f=>f.id!==b.dataset.remove);if(!files.length)mode='none';invalidate('提交文件已移除');render()});
 $('#run-check').onclick=()=>run();$('#export-evidence').onclick=exportEvidence;$('#export-report').onclick=exportReport;bindFlowControls();$('#ai-explain').onclick=()=>{if(window.askStudioAI)window.askStudioAI('delivery',{rules:state.rules,unparsed:state.unparsed,currentVersion:state.version,result:result&&!stale?result.items:null,files:files.map(publicFile),mode});else toast('可选模型解释未加载；本地检查仍可正常使用。')};
 document.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>showSource(b.dataset.source,+b.dataset.line));
 bindResultControls();
}
function bindResultControls(){
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{resultFilter=b.dataset.filter;render();jumpTo('#result-section')});
 document.querySelectorAll('[data-manual]').forEach(input=>input.onchange=()=>{if(stale)return;state.confirmed=state.confirmed||{};if(input.checked)state.confirmed[input.dataset.manual]=new Date().toISOString();else delete state.confirmed[input.dataset.manual];run(false)});
 $('.check-results').querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>showSource(b.dataset.source,+b.dataset.line));
}
function parseNotice(){
 const text=(state.tab==='base'?state.baseDraft:state.updateDraft).trim();
 if(!text)return toast('请先粘贴通知正文。');
 const id='N'+(state.counter+1),extraction=extract(text,id);
 if(!extraction.rules.length&&!extraction.unparsed.length)return toast('未识别到明确要求。试试一行写一个“必须提交 PDF，不超过 10 MB”。');
 if(state.tab==='base'){
  state.counter++;state.version++;state.rules=extraction.rules;state.unparsed=extraction.unparsed;state.activeBase=state.baseDraft;
  state.sourceHistory.push({id,title:'用户核对 · 初始通知',text});state.applied=[];pending=null;dirty=false;invalidate('初始通知已重新解析，规则版本已变化');render();toast(`已生成 V${state.version} 规则；请核对未解析要求。`);
 }else{pending={id,text,extraction,diffs:diffRules(state.rules,extraction.rules)};render();toast('比较已完成。请先确认适用范围，变更才会生效。')}
}
function applyChange(){
 if(!pending||!$('#confirm-scope')?.checked)return;
 const p=pending;state.rules=mergeRules(state.rules,p.extraction.rules);state.unparsed=[...state.unparsed,...p.extraction.unparsed];state.counter++;state.version++;
 state.sourceHistory.push({id:p.id,title:'用户确认 · 补充通知',text:p.text});state.applied.push({sourceId:p.id,at:new Date().toISOString(),diffs:p.diffs,confirmation:'用户确认发布者、适用范围与覆盖关系'});
 pending=null;invalidate('补充通知已确认并生效');render();toast(`规则已更新为 V${state.version}；上一轮结果失效，请重新检查。`);
}
function loadExample(good){
 token++;reading=false;mode='example';
 files=good?[
  {id:'ex-report',name:'报告.pdf',size:5*MB,type:'application/pdf'},
  {id:'ex-code',name:'源码.zip',size:20*MB,type:'application/zip'},
  {id:'ex-video',name:'演示.mp4',size:35*MB,type:'video/mp4',duration:105,durationStatus:'example'},
  {id:'ex-note',name:'说明.txt',size:800,type:'text/plain',textContent:'项目说明：这是匿名课程设计，包含方法、结果与讨论索引。',textStatus:'示例预设文本'}
 ]:[
  {id:'ex-report',name:'报告-张三.pdf',size:12*MB,type:'application/pdf'},
  {id:'ex-code',name:'源码.rar',size:18*MB,type:'application/x-rar-compressed'},
  {id:'ex-video',name:'演示.mp4',size:45*MB,type:'video/mp4',duration:190,durationStatus:'example'},
  {id:'ex-note',name:'说明.txt',size:900,type:'text/plain',textContent:'姓名：张三。学校：示范大学。项目说明：课程设计提交资料。',textStatus:'示例预设文本'}
 ];
 files=files.map(f=>({...f,example:true,textStatus:f.textStatus||'示例二进制内容未解析'}));invalidate(good?'已替换为合格格式的示例包':'已载入有问题的示例包');render();toast(good?'已替换示例。自动项应可通过，内容仍需人工核对。':'已载入示例数据，点击“运行交付预检”看缺口。');
}
function publicFile(f){return {id:f.id,name:f.name,size:f.size,type:f.type,lastModified:f.lastModified??null,duration:Number.isFinite(f.duration)?f.duration:null,durationStatus:f.durationStatus||'not-video',textStatus:f.textStatus||'not-read',example:!!f.example}}
async function videoDuration(file){return new Promise(resolve=>{
 const video=document.createElement('video'),url=URL.createObjectURL(file);let done=false;
 const finish=value=>{if(done)return;done=true;clearTimeout(timer);video.removeAttribute('src');video.load();URL.revokeObjectURL(url);resolve(value)};
 const timer=setTimeout(()=>finish(null),7000);video.preload='metadata';video.onloadedmetadata=()=>finish(Number.isFinite(video.duration)&&video.duration>=0?video.duration:null);video.onerror=()=>finish(null);video.src=url;
})}
async function readFiles(list){
 if(!list.length)return;
 if(list.length>30)return toast('一次最多选择 30 个文件，请先整理提交包。');
 const readToken=++token;reading=true;mode='real';
 files=list.map((file,i)=>({id:'real-'+Date.now().toString(36)+'-'+i,name:file.name,size:file.size,type:file.type,lastModified:file.lastModified,example:false,textStatus:'内容未解析',durationStatus:extOf(file.name)==='mp4'?'loading':'not-video'}));
 invalidate('已选择新的实际文件');render();
 const metadata=await Promise.all(list.map(async(file,i)=>{
  const data={...files[i]},ext=extOf(file.name);
  if(ext==='mp4'){data.duration=await videoDuration(file);data.durationStatus=Number.isFinite(data.duration)?'measured':'unreadable'}
  if(['txt','md'].includes(ext)){
   if(file.size<=MB){try{data.textContent=await file.text();data.textStatus=data.textContent.includes('\uFFFD')?'UTF-8 解码可能异常，需人工复核':'UTF-8 文本已读取';if(data.textContent.includes('\uFFFD'))delete data.textContent}catch{data.textStatus='文本读取失败'}}else data.textStatus='文字文件超过 1 MB，未读取正文';
  }
  return data;
 }));
 if(readToken!==token)return;
 files=metadata;reading=false;render();toast('真实文件已载入。现在可以运行交付预检。');
}
function run(showToast=true){
 if(reading)return toast('视频元数据仍在读取，请稍候。');if(dirty)return toast('初始通知已修改，请先重新解析。');
 const at=Date.now();result={...check(state.rules,files,{words:state.words,unparsed:state.unparsed,confirmed:state.confirmed,now:at}),version:state.version,at,mode,noticePending:!!pending};stale=false;render();
 if(showToast){jumpTo('#result-section');toast(result.summary.fail?`发现 ${result.summary.fail} 项未通过，请按结果修正。`:`自动项检查完成，另有 ${result.summary.review} 项需人工复核。`);}
}
function exportEvidence(){
 if(!result||stale||dirty||reading)return toast('请先按当前规则重新检查。');
 const evidence={schema:'delivery-outpost-evidence/v1',exportedAt:new Date().toISOString(),mode:result.mode==='example'?'example-not-real-files':'actual-files-local-metadata',ruleVersion:state.version,notificationSources:state.sourceHistory,rules:state.rules,unparsed:state.unparsed,confirmedRuleChanges:state.applied,files:files.map(publicFile),findings:result.items,summary:result.summary,checkedAt:new Date(result.at).toISOString(),pendingChangeNotApplied:!!pending,manualConfirmations:Object.entries(state.confirmed||{}).map(([id,at])=>({id,at})),limits:['这是本地预检记录，不是课程平台提交回执。','扩展名与元数据检查不证明文件内容真实完整。','PDF、DOCX、ZIP 内部、视频画面与音轨未解析；人工确认单列。','JSON 不包含所选文件二进制内容；示例模式的数据不是真实附件。']};
 const url=URL.createObjectURL(new Blob([JSON.stringify(evidence,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`交付前哨-${mode==='example'?'示例':'实际'}-V${state.version}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('验收证据已导出；人工确认与自动通过分别记录。');
}

function jumpTo(selector){const target=$(selector);if(!target)return;target.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});target.focus({preventScroll:true})}
function nextStepView(){
 let title,detail,button;
 if(dirty){title='通知刚改过，先重新生成规则';detail='上一轮检查已失效，避免把旧要求的通过结果用于新材料。';button='<button class="btn small" data-jump="#source-section">去核对通知 →</button>'}
 else if(pending){title=`${pending.diffs.length} 项变更待确认`;detail='先核对发布者和适用范围，确认后旧结果会失效，再重新检查。';button='<button class="btn small yellow" data-jump=".pending">核对这条变更 →</button>'}
 else if(reading){title='正在本机读取文件元数据';detail='视频时长读取完成后才能运行；文件不会上传。';button=''}
 else if(stale){title='规则或材料发生了变化，请重新检查';detail='旧结果保留供对照，但暂时不能保存报告或导出证据。';button='<button class="btn small" data-flow="run">重新检查 →</button>'}
 else if(!files.length){title='从一份示例开始，或带上自己的文件';detail='内置示例不是真实附件，实际文件模式会读取电脑上所选文件的元数据。';button='<button class="btn small secondary" data-jump="#check-section">选择真实文件 →</button>'}
 else if(!result){title=`已载入 ${files.length} 个文件，现在可以检查`;detail='核对规则无误后运行预检，失败与内容待人审会分别展示。';button='<button class="btn small" data-flow="run">运行交付预检 →</button>'}
 else if(result.summary.fail){title=`先处理 ${result.summary.fail} 项失败`;detail='按具体文件与原文依据修正；换文件、改要求后都需要重新检查。';button='<button class="btn small" data-flow="attention">查看待处理 →</button>'}
 else if(result.summary.review){title=`自动检查失败为零，仍有 ${result.summary.review} 项待人审`;detail='请核对未解析内容后逐项确认，人工确认会单独记录。';button='<button class="btn small" data-flow="attention">查看待复核 →</button>'}
 else{title='本轮预检完成，保存一份可读报告';detail='报告保留这次检查的版本与证据，正式提交仍需到课程平台完成。';button='<button class="btn small" data-flow="report">保存中文报告 →</button>'}
 return `<div><b>${title}</b><p>${detail}</p></div>${button}`;
}
function bindFlowControls(){
 document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jumpTo(b.dataset.jump));
 document.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>{if(b.dataset.flow==='run')run();else if(b.dataset.flow==='report')exportReport();else{resultFilter='attention';render();jumpTo('#result-section')}});
}
function refreshNextStep(){ $('#next-action').innerHTML=nextStepView();bindFlowControls() }
function refreshResultArea(){
 $('#export-evidence').disabled=$('#export-report').disabled=!result||stale||dirty||reading;
 $('#result-section').innerHTML='<div class="result-heading"><h3>本轮检查结果</h3><span>自动检查 / 人工确认分开记录</span></div>'+resultView();
 bindResultControls();refreshNextStep();
}
function exportReport(){
 if(!result||stale||dirty||reading)return toast('请先按当前规则重新检查。');
 const summary=result.summary,labels={pass:'自动通过',fail:'失败',review:'待人工复核',human:'已人工确认',info:'提示'};
 const formatTime=value=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（北京时间）';
 const sourceLink=source=>`<a href="#source-${esc(source.id)}-${source.line}">${esc(source.id)} · 第 ${source.line} 行</a>`;
 const fileRows=files.map(f=>`<tr><td>${esc(f.name)}</td><td>${esc(fmtBytes(f.size))}</td><td>${Number.isFinite(f.duration)?esc(fmtSeconds(f.duration))+(f.example?'（示例预设）':'（浏览器实测）'):'未读取 / 不适用'}</td><td>${esc(f.textStatus||'内容未解析')}</td></tr>`).join('')||'<tr><td colspan="4">尚无文件</td></tr>';
 const ruleRows=state.rules.map(r=>`<tr><td>${esc(r.label)}</td><td>${esc(ruleText(r))}</td><td>${sourcesFor(r).map(sourceLink).join('<br>')}</td></tr>`).join('');
 const findings=result.items.map(item=>{
  const evidence=item.evidence?`<p class="note">证据：${esc(item.evidence)}</p>`:'';
  const confirmation=item.confirmedAt?`<p class="note">人工确认时间：${esc(formatTime(item.confirmedAt))}；这是使用者声明，不是自动验证。</p>`:'';
  return `<section class="finding"><span class="tag ${esc(item.status)}">${labels[item.status]||esc(item.status)}</span><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p>${evidence}${confirmation}<p class="note">${(item.sources||[]).map(sourceLink).join('　')}</p></section>`;
 }).join('');
 const sources=state.sourceHistory.map(source=>{
  const lines=sourceLines(source.text).map(line=>`<div class="source-line" id="source-${esc(source.id)}-${line.line}"><b>第 ${line.line} 行：</b>${esc(line.text)}</div>`).join('');
  return `<section><h3>${esc(source.id)} · ${esc(source.title)}</h3>${lines}</section>`;
 }).join('');
 const changes=state.applied.length?'<h3>已确认覆盖关系</h3>'+state.applied.map(change=>`<p>${esc(change.sourceId)} · ${esc(formatTime(change.at))} · ${esc(change.confirmation)}</p>`).join(''):'<p class="note">本次尚无补充通知覆盖记录。</p>';
 const style=`*{box-sizing:border-box}body{font:14px/1.8 'Microsoft YaHei',system-ui,sans-serif;color:#21304a;max-width:1000px;margin:30px auto;padding:0 22px}h1{font-size:28px}h2{font-size:19px;margin-top:34px}h3{font-size:15px}.meta,.notice{padding:16px;background:#f0f4fa;border:1px solid #dce3ed;border-radius:8px}.notice{background:#fff7e2}table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:11px;border:1px solid #dce3ed;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f0f4fa}a{color:#2a4d82}.tag{font-size:11px;font-weight:bold}.fail{color:#a63d36}.review{color:#916319}.human{color:#456b99}.pass{color:#24734f}.finding{padding:15px 0;border-bottom:1px solid #dce3ed;break-inside:avoid}.finding p{margin:5px 0;overflow-wrap:anywhere}.source-line{padding:8px;border-bottom:1px solid #e3e8ef;overflow-wrap:anywhere}.source-line:target{background:#fff0ba}.actions{margin:20px 0}button{font:inherit;border:0;border-radius:6px;padding:10px 18px;background:#172640;color:white;cursor:pointer}.note{font-size:12px;color:#6b788d}.scroll{overflow-x:auto}footer{margin:30px 0;font-size:12px;color:#6b788d}@media print{body{margin:0;max-width:none}.actions{display:none}a{color:inherit;text-decoration:none}.scroll{overflow:visible}thead{display:table-header-group}h2{break-after:avoid}}`;
 const report=[
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>交付前哨 · V${state.version} 验收报告</title><style>${style}</style></head><body><h1>交付前哨 · 本轮验收报告</h1>`,
  `<div class="meta"><b>规则版本 V${state.version} · ${result.mode==='example'?'示例数据模式（不是真实附件）':'实际文件模式'}</b><br>检查时间：${esc(formatTime(result.at))}<br>自动通过 ${summary.pass} 项 / 失败 ${summary.fail} 项 / 待复核 ${summary.review} 项 / 已人工确认 ${summary.human} 项</div>`,
  `<p class="notice">这是本地预检记录，不是课程平台提交回执。扩展名和元数据检查不证明文件内容完整；未解析内容与人工确认单独记录。${pending?'当前另有一条尚未确认的补充通知，本报告只依据已生效规则。':''}</p>`,
  '<div class="actions"><button onclick="window.print()">打印 / 另存 PDF</button></div>',
  `<h2>本次交付物</h2><div class="scroll"><table><thead><tr><th>文件名</th><th>大小</th><th>时长</th><th>读取范围</th></tr></thead><tbody>${fileRows}</tbody></table></div>`,
  `<h2>生效规则与来源</h2><div class="scroll"><table><thead><tr><th>规则</th><th>当前约束</th><th>原文依据</th></tr></thead><tbody>${ruleRows}</tbody></table></div>`,
  `<h2>逐项结果</h2>${findings}<h2>通知原文与变更记录</h2>${sources}${changes}`,
  `<footer>导出时间：${esc(formatTime(Date.now()))}。本报告不包含所选文件正文、二进制内容或 API Key。对程序可复核的完整结构化记录，请同时保存原型中的 JSON 证据。</footer></body></html>`
 ].join('');
 const url=URL.createObjectURL(new Blob([report],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`交付前哨-${mode==='example'?'示例':'实际'}-V${state.version}-中文验收报告.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('中文验收报告已保存，打开后可打印或另存 PDF。');
}

function showSource(id,line){const src=state.sourceHistory.find(s=>s.id===id);if(!src)return toast('来源记录未找到，请重新解析通知。');const dlg=$('#source-dialog');dlg.innerHTML=`<div class="dialog-head"><h2>回到老师的原话</h2><button class="close" aria-label="关闭原文">×</button></div><p class="note">${esc(src.title)} · ${esc(src.id)}。原文仅用于核对，不自动证明发布者身份。</p>${sourceLines(src.text).map(s=>`<div class="source-line ${s.line===line?'source-highlight':''}" ${s.line===line?'id="source-target"':''}><b>${esc(src.id)} · L${s.line}</b>${esc(s.text)}</div>`).join('')}`;dlg.showModal();dlg.querySelector('.close').onclick=()=>dlg.close();setTimeout(()=>dlg.querySelector('#source-target')?.scrollIntoView({block:'nearest'}),80)}
function reset(){if(files.length||result){const dlg=$('#source-dialog');dlg.innerHTML='<div class="dialog-head"><h2>重置本页演示？</h2><button class="close" aria-label="关闭">×</button></div><p class="note">将恢复内置通知、规则与示例敏感词，并清空本页的当前文件选择和检查结果。电脑上的文件不会被修改。</p><div class="toolbar"><button class="btn yellow" id="do-reset">确认重置本页</button><button class="btn secondary" id="cancel-reset">取消</button></div>';dlg.showModal();dlg.querySelector('.close').onclick=()=>dlg.close();$('#cancel-reset').onclick=()=>dlg.close();$('#do-reset').onclick=()=>{dlg.close();doReset()}}else doReset()}
function doReset(){token++;state=defaultState();pending=null;files=[];mode='none';result=null;stale=false;dirty=false;reading=false;resultFilter='all';persist();render();toast('已恢复课程示例，可以从头体验。')}
render();
})();
