(function(root){
 'use strict';
 const E=typeof module!=='undefined'&&module.exports?require('./engine-v2.cjs'):root.Xianqi;
 const scenes={
 work:{title:'工作中受伤了',subtitle:'工伤认定、劳动能力鉴定',icon:'briefcase-medical',color:'green',prompt:'发生了什么？先按自己的话说一说。',placeholder:'例如：我10月在武汉的工地上班时受伤，没有劳动合同，公司还没帮我申报。我现在不知道该找谁、需要什么材料。',subject:'单位名称（不知道全称可先留空）',concern:'你现在最想解决什么？',needs:['先申请工伤认定','确认现在办到哪了','准备劳动能力鉴定','帮家人接着办理'],stages:[['unstarted','还没有申请','刚发生事情，或还在整理材料'],['submitted','已经交了申请','还没收到正式受理通知'],['accepted','已经正式受理','有受理通知，等待认定结果'],['recognized','已有认定结果','准备鉴定，或核对后续办理'],['appraisal','已经申请鉴定','等待劳动能力鉴定结论'],['appraised','收到鉴定结论','核对结论与后续事项']],dateStages:{unstarted:['injury'],submitted:['injury','submitted','completed'],accepted:['injury','submitted','accepted'],recognized:['injury','accepted','decision','received'],appraisal:['injury','decision','received','appraisalApplied','appraisalAccepted'],appraised:['injury','decision','appraisalApplied','appraisalDecision','appraisalReceived']},route:['整理材料','提交申请','受理与认定','劳动能力鉴定']},
 labor:{title:'工资没拿到 / 被辞退',subtitle:'劳动争议仲裁',icon:'scale',color:'amber',prompt:'说说你与单位遇到的争议。',placeholder:'例如：单位拖欠两个月工资，我有工资转账记录，想申请劳动仲裁，还没有提交材料。',subject:'发生争议的单位',needs:['追索工资','解除 / 辞退争议','确认受理或裁决进度','整理争议材料']},
 consumer:{title:'买东西遇到纠纷',subtitle:'退款、预付消费、12315投诉',icon:'shopping-bag',color:'coral',prompt:'买了什么，遇到什么问题？',placeholder:'例如：买了课程后商家停业，我付了3000元，想退费。已经向12315提交，但不清楚有没有被市场监管部门受理。',subject:'商家 / 平台名称',needs:['退款 / 退费','联系投诉处理方','确认调解进展','整理消费证据']},
 disclosure:{title:'想申请政府公开信息',subtitle:'政府信息公开申请',icon:'file-search',color:'blue',prompt:'你想获取什么已存在的政府信息？',placeholder:'例如：我想申请查看某份已经形成的行政文件，已向有关机关寄出申请，想知道应当何时答复。',subject:'想申请的文件 / 信息',needs:['准备公开申请','核对收件与补正','等待答复','确认延期与期限']},
 aid:{title:'需要免费的法律帮助',subtitle:'法律援助申请',icon:'heart-handshake',color:'violet',prompt:'你需要哪方面的法律帮助？',placeholder:'例如：我遇到劳动纠纷，家庭经济困难，想了解法律援助申请需要哪些材料，以及申请后怎么跟进。',subject:'涉及的法律事项',needs:['准备法律援助申请','核对申请审查进度','联系已指派的承办人员','为亲友寻求帮助']},
 subsistence:{title:'家庭生活遇到困难',subtitle:'最低生活保障申请',icon:'house',color:'teal',prompt:'说说目前的生活困难和申请情况。',placeholder:'例如：家里收入减少，基本生活有困难，想向街道申请低保，但还不清楚需要准备什么。无需填写证件号码。',subject:'申请的乡镇 / 街道（选填）',needs:['准备低保申请','核对当地条件与材料','跟进核查进度','确认审核结果']},
 medical:{title:'医保报销办到哪了',subtitle:'医保报销与待遇办理',icon:'cross',color:'blue',prompt:'你在哪参保，现在卡在哪一步？',placeholder:'例如：我在武汉参保，异地住院后需要报销，材料已经交给窗口，但还没有收到结果。',subject:'参保地与报销类型',needs:['准备报销材料','确认材料是否收到','核对当地承诺期限','跟进结果 / 到账']},
 housing:{title:'退租了，押金还没退',subtitle:'租房押金与交接记录',icon:'key-round',color:'amber',prompt:'合同怎么约定，退租后发生了什么？',placeholder:'例如：已经交房，房东还没退押金。合同约定交房后退还，我想把交接和沟通记录整理清楚。',subject:'房东 / 租赁企业（选填）',needs:['核对合同退还约定','整理交房与结算凭证','记录联系与答复','设置再次联系提醒']},
 provident:{title:'想提取住房公积金',subtitle:'按缴存地指南办理',icon:'landmark',color:'teal',prompt:'在哪缴存，因为什么事情提取？',placeholder:'例如：我想办理租房公积金提取，已在线申请，希望核实材料和当地的办理期限。',subject:'缴存地 / 提取类型',needs:['核对提取条件','准备当地要求的材料','跟进办理进度','核对结果 / 到账']},
 custom:{title:'其他事情，也能接着办',subtitle:'校园、社区与自定义事项',icon:'layout-grid',color:'slate',prompt:'你正在办什么事，想解决什么？',placeholder:'例如：我在办理学校的某项申请，需要先交材料，再等审核，希望记清楚每一步由谁处理。',subject:'事情的名称',needs:['先把流程理清','整理材料','记录承诺与联系时间','交给家人或他人接着办']}
 };
 function stages(c){if(c.scenario==='work')return scenes.work.stages;if(E.getScenario(c).mode==='manual')return [['unstarted','还在准备','先核实具体要求'],['submitted','已交材料 / 提出请求','核实实际收件与下一步'],['accepted','办理中 / 对方已确认','核对当地或约定期限'],['finished','已收到结果','整理结果与后续安排']];if(c.scenario==='aid')return [['unstarted','还没有申请','先核对援助条件和材料'],['submitted','已经提出申请','等待审查决定'],['accepted','决定给予援助','核对人员指派情况'],['finished','已有后续结果','整理承办与沟通记录']];if(c.scenario==='disclosure')return [['unstarted','还在准备申请','先明确想获取的信息'],['submitted','机关已收到申请','核对补正与答复期限'],['finished','已收到答复','记录结果与送达日期']];return [['unstarted','还在准备','尚未向有权办理方提交'],['submitted','已经交了材料','核实实际收件和是否受理'],['accepted','已经正式受理','等待处理 / 审核结果'],['finished','已经有结果','记录结果与下一步']];}
 function inferStage(c){if(c.scenario==='work'){if(c.appraisalReceived)return 'appraised';if(c.appraisalApplied||c.appraisalAccepted)return 'appraisal';if(c.decision)return 'recognized';if(c.accepted)return 'accepted';if(c.submitted)return 'submitted';}else {if(c.received||c.assigned||c.decision)return c.scenario==='aid'&&c.aidGranted&&!c.assigned?'accepted':'finished';if(c.accepted)return 'accepted';if(c.submitted)return 'submitted';}return stages(c).some(([id])=>id===c.intake?.stage)?c.intake.stage:'unstarted';}
 function extract(text,scenario,now=E.today()){
  const values={},evidence={},issues=[];text=String(text||'').slice(0,2400);
  function set(key,value,quote){values[key]=value;evidence[key]=quote;}
  const city=text.match(/(?:在|到|是|位于|地点[为是：:]?)[\s]*((?:湖北省?|湖南省?|广东省?|浙江省?|江苏省?|四川省?)?(?:武汉|北京|上海|深圳|广州|杭州|南京|成都|长沙|苏州|郑州|重庆|天津|西安|合肥|南昌|福州|济南|青岛|宜昌|襄阳|黄石|荆州|荆门|孝感|咸宁|随州|恩施)(?:市)?)/);if(city)set('city',city[1],city[0]);
  if(scenario==='work'){
   if(/(?:没|没有|未)签.{0,5}(?:劳动)?合同|没有劳动合同/.test(text))set('relationship','没有书面劳动合同',text.match(/(?:没|没有|未)签.{0,5}(?:劳动)?合同|没有劳动合同/)[0]);else if(/(?:有|签了|已签订)劳动合同/.test(text))set('relationship','有劳动合同','原文提到有劳动合同');
   if(/上下班途中|下班路上|上班路上/.test(text))set('accidentType','上下班途中','原文提到通勤途中');else if(/工作时|上班时|干活时|工地|车间/.test(text))set('accidentType','工作过程中','原文提到工作现场 / 工作时');
   if(/仍在治疗|还在治疗|住院/.test(text))set('treatment','仍在治疗','原文提到治疗 / 住院');
   if(/(?:还没|尚未|没有|未)(?:有)?(?:提交|申报|申请)|还没.{0,4}申报/.test(text))set('stage','unstarted','原文提到尚未申报');
   else if(/(?:已经|已)正式受理|已受理|收到(?:了)?(?:正式)?受理通知/.test(text)&&!/(?:没|未|尚未|还没)(?:有)?(?:被|收到)?(?:正式)?受理|(?:没|未|尚未|还没)(?:有)?收到.{0,3}受理通知/.test(text))set('stage','accepted','原文提到正式受理，仍需核对文书日期');
   else if(/已经.{0,4}(?:提交|申请)|已提交|交了申请/.test(text))set('stage','submitted','原文提到提交，未推定正式受理');
  }
  const re=/(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})[日号]?/g;const matches=[...text.matchAll(re)];
  const injuryCandidates=[];
  for(let i=0;i<matches.length;i++){const m=matches[i],date=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`,after=text.slice(m.index+m[0].length,Math.min(matches[i+1]?.index??text.length,m.index+m[0].length+32)).split(/[，,。；;\n]/)[0],before=text.slice(Math.max(0,m.index-12),m.index).split(/[，,。；;\n]/).pop(),context=before+m[0]+after;if(E.parse(date)===null||date>now){issues.push('描述中的日期“'+m[0]+'”无效或尚未发生，请核对。');continue;}
   if(scenario==='work'&&/(受伤|事故|摔伤|砸伤|工伤|职业病诊断)/.test(after+before)&&!/(认定决定|受理通知|提交申请)/.test(after.slice(0,8)))injuryCandidates.push({date,context});
  }
  if(new Set(injuryCandidates.map(v=>v.date)).size===1)set('injury',injuryCandidates[0].date,injuryCandidates[0].context);
  else if(injuryCandidates.length>1)issues.push('描述里有多个不同的受伤日期，未自动选择；请按实际事故或诊断凭证核对。');
  if(/\d{1,2}月\d{1,2}[日号]/.test(text)&&!matches.length)issues.push('你提到了月日，但没有明确年份；请在下一步确认日期。');
  if(/受理|提交|申报/.test(text))issues.push('提交或受理的具体日期，请按收件回执和受理通知填写，未从文字自动推定。');
  return {values,evidence,issues};
 }
 function dateKeys(c){const stage=inferStage(c);if(c.scenario==='work')return scenes.work.dateStages[stage]||['injury'];if(E.getScenario(c).mode==='manual')return [];const keys=Object.keys(E.dateFields(c)).filter(k=>k!=='reviewed');if(stage==='unstarted')return [];if(stage==='submitted')return keys.filter(k=>['submitted','completed'].includes(k));if(c.scenario==='aid'&&stage==='accepted')return ['submitted','decision'];if(stage==='accepted')return keys.filter(k=>['submitted','accepted'].includes(k));return keys;}
 function facts(c){const i=c.intake||{},fields=[['所在地区',i.city],['当前诉求',i.concern],['单位 / 对方 / 事项',i.employer||i.subject],...(c.scenario==='work'?[['工作关系材料',i.relationship],['受伤情形',i.accidentType],['治疗情况',i.treatment],['工伤认定结果',i.recognitionResult]]:[['涉及金额',i.amount],['具体诉求',i.request],['事件发生日期',i.eventDate]]),...Object.entries(E.dateFields(c)).filter(([k])=>c[k]).map(([k,label])=>[label,c[k]]),['经办机构',c.agency],['回执 / 案号',c.caseNumber]];return fields.filter(([,v])=>v);}
 function missing(c){const a=[],i=c.intake||{},stage=inferStage(c);if(!i.city)a.push({key:'city',title:'在哪个地区办理',why:'用于向当地核实办理方和办事指南。'});if(c.scenario==='work'){if(!c.injury)a.push({key:'injury',title:'事故发生 / 职业病诊断日期',why:'没有这个日期，无法给出申请期限参考。'});if(!i.relationship)a.push({key:'relationship',title:'证明劳动关系的材料',why:'有无书面合同都要按实际证据核对，不自动认定劳动关系。'});}
  if(['submitted','accepted'].includes(stage)&&!c.submitted&&E.getScenario(c).mode!=='manual')a.push({key:'submitted',title:'有权办理方实际收件日期',why:'平台提交、寄出和机关收件可能不是同一天。'});
  if(c.scenario==='work'&&stage==='accepted'&&!c.accepted)a.push({key:'accepted',title:'正式受理通知日期',why:'不能根据“已经提交”替代受理日期。'});
  if(!c.agency)a.push({key:'agency',title:'实际负责的办理方',why:'按当地指南或通知核实名称和联系渠道。'});return a;
 }
 function focus(c){const rows=E.timeline(c),stage=inferStage(c);if(c.scenario==='work'){if(stage==='recognized'&&c.intake?.recognitionResult!=='认定为工伤'){const r=rows.find(r=>r.id==='delivery');return {...r,due:null,left:null,state:'confirm',label:'先核对认定结果和权益告知',action:'仔细核对认定决定写明的结果、实际送达日期和权益告知。不予认定或对认定决定有异议时，先向受理地人社部门、工会或法律援助机构核实可用程序及期限，不直接进入劳动能力鉴定。'};}const id={submitted:'review',accepted:'recognition',recognized:'appraisal',appraisal:'appraisal',appraised:c.dispute?'reappraisal':'appraisalDelivery'}[stage];if(id)return rows.find(r=>r.id===id);}else if(stage==='accepted'){const id={labor:'laborAward',consumer:'consumerMediation',subsistence:'subsistenceDecision',aid:'aidAssign',disclosure:'disclosureReply'}[c.scenario];if(id)return rows.find(r=>r.id===id);}return E.primary(c)||rows.find(r=>!['done','optional'].includes(r.state))||rows[rows.length-1];}
 const api={scenes,stages,inferStage,extract,dateKeys,facts,missing,focus};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.XianqiJourney=api;
})(globalThis);
