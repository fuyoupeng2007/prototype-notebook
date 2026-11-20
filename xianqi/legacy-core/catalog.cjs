(function(root){
 'use strict';
 const sources={
  labor:{title:'中华人民共和国劳动争议调解仲裁法',issuer:'全国人大常委会',version:'2007年12月29日通过',effective:'2008年5月1日起施行',url:'https://chinajob.mohrss.gov.cn/c/2022-07-15/356212.shtml'},
  laborRules:{title:'劳动人事争议仲裁办案规则',issuer:'人力资源社会保障部',version:'人社部令第33号',effective:'2017年7月1日起施行；第八十条区分工作日与自然日',url:'https://www.mohrss.gov.cn/wap/zc/zcwj/201705/t20170525_271415.html',alternate:'https://www.shanghai.gov.cn/rcjygj/20250606/8f80874d90574693ac63c58af67a2dcd.html'},
  consumer:{title:'市场监督管理投诉举报处理办法',issuer:'国家市场监督管理总局',version:'总局令第121号；2025年12月30日公布',effective:'2026年4月15日起施行，替代2019年暂行办法',url:'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2026/art_e4d03a20c0fd49769e408c7bf3791ff5.html'},
  disclosure:{title:'中华人民共和国政府信息公开条例',issuer:'国务院',version:'国务院令第711号修订',effective:'2019年5月15日起施行',url:'https://www.nia.gov.cn/n794014/n1050181/n1074664/n1074671/c932100/content.html'},
  aid:{title:'办理法律援助案件程序规定',issuer:'司法部',version:'司法部令第148号；2023年修订',effective:'2023年9月1日起施行；第四十四条规定起算与末日顺延',url:'https://www.moj.gov.cn/pub/sfbgw/jgsz/jgszjgtj/ggflfwglj/ggflfwgljtjxw/202307/t20230721_483090.html',alternate:'https://policy.mofcom.gov.cn/claw/clawContent.shtml?id=97304'},
  assistance:{title:'中华人民共和国社会救助法',issuer:'全国人大常委会',version:'2026年4月30日通过',effective:'2026年7月1日起施行；具体低保办理时限还须核对当地规则',url:'https://mzj.sjz.gov.cn/columns/db9a6c71-2591-48e4-9c94-9d0b08c5d1bd/202605/09/c747f069-4eca-42da-9ad3-792325e0f9ca.html'},
  subsistence:{title:'最低生活保障审核确认办法',issuer:'民政部',version:'民发〔2021〕57号',effective:'2021年7月1日起施行；地方可下放审核权限，须核对当地现行指南',url:'https://www.cnjx.gov.cn/Jczwgk/show/2714716.html'},
  calendar2026:{title:'国务院办公厅关于2026年部分节假日安排的通知',issuer:'国务院办公厅',version:'国办发明电〔2025〕7号',effective:'2026年度全国放假调休安排',url:'https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm'},
  calendar2027:{title:'国务院办公厅关于2027年部分节假日安排的通知',issuer:'国务院办公厅',version:'国办发明电〔2026〕10号；2026年11月5日公布',effective:'2027年度全国放假调休安排',url:'https://chinajob.mohrss.gov.cn/h5/c/2026-11-09/635850.shtml',alternate:'https://wjw.shanxi.gov.cn/xwzx/szyw/202611/t20261106_10254662.shtml'}
 };
 const mat=(id,title,desc,source)=>({id,title,desc,source});
 const receipt=mat('receipt','收件回执与办理通知','保存收件、补正、受理、延期及结果通知的日期和存放位置。','记录建议；具体形式按当地指南');
 const commonDates={submitted:'办理方实际收到材料',accepted:'正式受理日期',decision:'结果作出日期',received:'结果收到日期'};
 const commonMaterials=[mat('application','申请内容与诉求','写清具体事项、事实和希望得到的处理。','记录建议'),receipt,mat('evidence','支持事项的材料','核对受理地指南或合同要求，只记录准备状态。','当地指南 / 合同另核')];
 const scenarios={
  work:{title:'工伤认定与鉴定',short:'工伤办理',icon:'✚',category:'劳动权益',mode:'rules',desc:'受伤以后，认定、鉴定与送达分别记清。',actor:'社会保险行政部门 / 劳动能力鉴定委员会',tip:'认定和鉴定是不同程序；提交回执不等于受理。非本人原因耽误、法定中止、地方口径需要另核。'},
  labor:{title:'劳动争议仲裁',short:'劳动仲裁',icon:'⚖',category:'劳动权益',mode:'rules',desc:'欠薪、辞退等争议，跟进受理与裁决。',actor:'有管辖权的劳动人事争议仲裁委员会',tip:'本模板跟踪已提交的仲裁申请。仲裁时效通常为一年，但起点、中断及拖欠报酬例外不同，不自动推算失权。收到裁决后请核对终局性质和权益告知。',dates:{submitted:'仲裁委收到申请',reviewed:'不予受理决定日期（仅不受理时填）',accepted:'仲裁正式受理日期',decision:'裁决作出日期',received:'裁决收到日期'},extension:{max:15,label:'已核实书面延期天数（自然日，最多15天）'},materials:[mat('application','仲裁申请书与副本','列明请求、事实理由，按被申请人数准备副本。','《劳动争议调解仲裁法》第二十八条'),mat('relationship','劳动关系与争议证据','合同、工资流水、考勤、解除通知等，按实际争议整理。','举证准备建议，不是统一必交清单'),receipt],rules:[
   {id:'laborReview',title:'受理或不予受理决定',anchor:'submitted',finish:'accepted',days:5,unit:'workdays',source:'labor',article:'第二十九条；办案规则第八十条',quote:'劳动争议仲裁委员会收到仲裁申请之日起五日内，认为符合受理条件的，应当受理，并通知申请人。',action:'核对实际收件日、材料是否符合要求，索取书面决定；五日按工作日计算。'},
   {id:'laborAward',title:'仲裁审理与裁决',anchor:'accepted',finish:'decision',days:45,extend:true,source:'labor',article:'第四十三条；办案规则第八十条',quote:'仲裁庭裁决劳动争议案件，应当自劳动争议仲裁委员会受理仲裁申请之日起四十五日内结束。',action:'复杂案件经批准可延长，最长15日，并书面通知。中止、重新计算、调解等特殊情形须核实，不从提交日起算。'}]},
  consumer:{title:'消费投诉与调解',short:'消费投诉',icon:'▣',category:'日常生活',mode:'rules',desc:'网购退款、预付消费争议，跟进12315投诉。',actor:'具有处理权限的市场监督管理部门',tip:'用于生活消费纠纷的投诉调解；举报违法线索走另一程序。60日是调解终止条件之一，不保证退款或赔偿。2026年4月15日前收件不套用本版新规则。',effective:'2026-04-15',dates:{submitted:'有处理权限部门收到投诉',reviewed:'不予受理决定日期（仅不受理时填）',accepted:'投诉受理日期',decision:'调解达成 / 终止日期',received:'结果告知收到日期'},materials:[mat('identity','投诉人与被投诉人信息','真实姓名、联系地址、商家名称及地址。','本办法第十条'),mat('evidence','消费事实与具体诉求','订单、付款、合同、沟通记录；明确退款或其他具体诉求。','本办法第十条'),receipt],rules:[
   {id:'consumerReview',title:'决定是否受理并告知',anchor:'submitted',finish:'accepted',days:7,unit:'workdays',source:'consumer',article:'第十五条',quote:'具有本办法规定的处理权限的市场监督管理部门，应当自收到投诉之日起七个工作日内作出受理或者不予受理的决定，并告知投诉人。',action:'以有处理权限部门的收件日期为准；平台提交时间不当然等于该日期。'},
   {id:'consumerMediation',title:'调解进展与60日节点',anchor:'accepted',finish:'decision',days:60,source:'consumer',article:'第二十二条、第二十三条第五项',quote:'自投诉受理之日起六十日内投诉人和被投诉人未能达成调解协议的，终止调解。',action:'调解需双方同意；鉴定、检测所需时间不计入调解期限。若已达成协议，记录日期；若未达成，核实终止通知和后续解决渠道。'}]},
  disclosure:{title:'政府信息公开申请',short:'信息公开',icon:'▤',category:'公共服务',mode:'rules',desc:'已存在的政府信息，申请后何时应答复。',actor:'收到申请且依法负责公开的行政机关',tip:'本程序用于申请获取政府信息，不代替投诉、举报或要求机关新制作分析报告。补正后收到补正申请之日起算；征求第三方和其他机关意见时间不计。',dates:{submitted:'行政机关收到申请',completed:'行政机关收到补正申请',decision:'答复作出 / 提供日期',received:'实际收到答复日期'},extension:{max:20,label:'经批准并已告知的延期天数（工作日，最多20天）'},materials:[mat('application','信息公开申请','明确申请人信息、所需信息名称或可检索特征、获取方式。','《政府信息公开条例》第二十九条'),mat('identity','身份与代理信息','按机关公开的申请指南准备，不录入证件号码。','该机关申请指南'),receipt],rules:[
   {id:'disclosureReply',title:'政府信息公开答复',anchor:'submitted',finish:'decision',days:20,unit:'workdays',extend:true,source:'disclosure',article:'第三十条、第三十三条',quote:'行政机关不能当场答复的，应当自收到申请之日起20个工作日内予以答复。',action:'延期须负责人同意并告知，最多再延20个工作日。记录通知实际天数；有补正时以收到补正申请日期重新核对。'}]},
  aid:{title:'法律援助申请',short:'法律援助',icon:'♡',category:'公益援助',mode:'rules',desc:'申请免费法律帮助，跟进审查与人员指派。',actor:'有管辖权的法律援助机构',tip:'适用本人申请代理、刑事辩护法律援助的通常流程。不是所有人、所有事项都符合条件；咨询、值班律师及刑事通知辩护程序另核。',dates:{submitted:'法律援助机构收到申请',decision:'是否给予援助决定日期',assigned:'给予援助后的人员指派日期'},materials:[mat('application','申请表与有效身份证明','代为申请的，还应提交有代理权的证明。','《程序规定》第十一条'),mat('financial','经济困难状况说明 / 免核查依据','特殊法定条件可能无需提交经济困难说明，向机构核实。','《程序规定》第十一条及法律援助法相关规定'),mat('evidence','与援助事项有关的材料','合同、通知、争议证据等，按事项准备。','《程序规定》第十一条'),receipt],rules:[
   {id:'aidReview',title:'审查并作出援助决定',anchor:'submitted',finish:'decision',days:7,source:'aid',article:'第十七条',quote:'法律援助机构应当自收到法律援助申请之日起七日内进行审查，作出是否给予法律援助的决定。',action:'补充材料、作出说明和异地协作核查时间不计入。发生这些情形时，停止简单推算，记录机构核实的期限。'},
   {id:'aidAssign',title:'给予援助后指派人员',anchor:'decision',finish:'assigned',days:3,source:'aid',article:'第二十四条',quote:'法律援助机构应当自作出给予法律援助决定之日起三日内依法指派律师事务所、基层法律服务所安排本所律师或者基层法律服务工作者，或者安排本机构具有律师资格或者法律职业资格的工作人员承办法律援助案件。',action:'仅在决定给予援助时启动。核对指派通知、承办人员和联系渠道。'}]},
  subsistence:{title:'最低生活保障申请',short:'低保申请',icon:'⌂',category:'公益援助',mode:'local',desc:'家庭遇到生活困难，跟进受理、核查和确认。',actor:'乡镇 / 街道及县级社会救助管理部门（权限下放地另核）',tip:'2026年7月施行的社会救助法规定申请、核查与确认程序。2021年办法的30/45工作日只在核实当地仍采用该口径后启用，其他地区请记录当地明确期限。',dates:{submitted:'申请材料收到日期',accepted:'正式受理日期',decision:'审核确认决定日期',received:'确认 / 不予确认通知收到日期'},extension:{max:15,label:'已核实特殊情形增加的工作日（最多15天）'},materials:[mat('application','低保申请与家庭情况','按受理地要求说明共同生活家庭成员及困难情况。','《社会救助法》第三十七条、第四十条'),mat('financial','收入、财产、刚性支出核查材料','同意依法核查；可通过信息共享核实的情况，不应重复要求提供。','《社会救助法》第四十条、第六十二条'),receipt],rules:[
   {id:'subsistenceDecision',title:'低保审核确认',anchor:'accepted',finish:'decision',days:30,unit:'workdays',extend:true,source:'subsistence',article:'第二十二条（须核对当地现行口径）',quote:'最低生活保障审核确认工作应当自受理之日起30个工作日之内完成；特殊情况下，可以延长至45个工作日。',action:'先核对本地是否仍采用这一起点和期限。收件不是正式受理；不将受理日期自动替换为申请日期。'}]},
  medical:{title:'医保报销与待遇办理',short:'医保报销',icon:'＋',category:'公共服务',mode:'manual',desc:'异地就医、零星报销，按参保地指南记进度。',actor:'参保地医保经办机构（请按当地指南核实）',tip:'不同地区、险种、报销方式和材料审查的期限不同。本模板提供通用记录步骤，不设全国统一到账日。',dates:commonDates,materials:[mat('application','当地报销申请清单','核对票据、费用明细、病历等实际要求；不上传文件。','参保地医保办事指南'),receipt]},
  housing:{title:'租房押金与退租交接',short:'租房押金',icon:'▥',category:'日常生活',mode:'manual',desc:'合同约定何时退押金，每次沟通都有记录。',actor:'出租人 / 租赁企业 / 约定的争议处理方',tip:'依具体合同记录交房、结算、退还押金约定。通用记录步骤不等于法定行政流程，也不预设押金必须在固定天数内返还。',dates:{submitted:'提出退租 / 押金请求',accepted:'对方确认收到请求',decision:'结算 / 处理结果确认',received:'实际收到退款 / 处理结果'},materials:[mat('contract','合同与押金付款凭证','核对退租条件、押金扣除和返还约定。','合同条款，需自行核实'),mat('handover','交房与结算记录','交房照片、水电账单、物品确认和沟通记录。','留证建议'),receipt]},
  provident:{title:'住房公积金提取',short:'公积金提取',icon:'◇',category:'公共服务',mode:'manual',desc:'租房、离职等提取事项，核对当地办理承诺。',actor:'缴存地住房公积金管理中心',tip:'提取条件、线上线下流程、承诺办结与实际到账需分别核实。本模板只记录当地确认的日期。',dates:commonDates,materials:[mat('application','提取条件与对应材料','按缴存地官方指南核对提取类型、材料和账户要求。','当地住房公积金管理中心指南'),receipt]},
  custom:{title:'其他办事 / 自定义流程',short:'自定义事项',icon:'…',category:'更多事项',mode:'manual',desc:'校园办事、社区申请等，用自己的节点接着办。',actor:'按真实通知填写办理方',tip:'自行命名节点并记录起算、完成和明确期限。通知期限、合同约定、自设提醒分开标注；本模板不提供自动法律认定。',dates:commonDates,materials:commonMaterials}
 };
 const manualRules=[{id:'manualReview',title:'收件与材料核对',anchor:'submitted',finish:'accepted'},{id:'manualProcess',title:'办理与结果确认',anchor:'accepted',finish:'decision'},{id:'manualResult',title:'结果收到 / 后续落实',anchor:'decision',finish:'received'}];
 for(const s of Object.values(scenarios))if(s.mode==='manual')s.rules=manualRules.map(r=>({...r,manual:true,article:'通用记录步骤，由你按实际调整',quote:'此步骤为记录模板，不代表法定流程或全国统一时限。',action:'按当地指南、合同或书面通知核对办理方、完成条件和期限；未确认时先留空。'}));
scenarios.work.materials=[
 {id:'application',title:'工伤认定申请表',desc:'按受理地表格填写事故时间、地点、原因、伤害程度等基本情况。',source:'《工伤保险条例》第十八条'},
 {id:'relationship',title:'劳动关系证明',desc:'劳动、聘用合同，或能够证明事实劳动关系的其他材料。',source:'《工伤保险条例》第十八条'},
 {id:'diagnosis',title:'诊断证明 / 职业病诊断证明',desc:'提供医疗诊断证明，或依法出具的职业病诊断、鉴定证明书。',source:'《工伤保险条例》第十八条'},
 {id:'receipt',title:'收件、补正与受理凭证',desc:'保存收到申请、补正通知、全部补正材料收到日期和正式受理通知。这些是时间线依据。',source:'《工伤认定办法》第八条'},
 {id:'identity',title:'鉴定申请表与有效身份证明',desc:'申请劳动能力鉴定时，按要求提供申请表及身份证或社保卡等有效身份证明原件。',source:'《劳动能力鉴定管理办法》第九条'},
 {id:'medical',title:'鉴定所需的完整病历',desc:'有效诊断证明，以及按规定复制的检查、检验报告等。能通过信息共享获取的材料，不应重复提交。',source:'《劳动能力鉴定管理办法》第九条'},
 {id:'recognition-copy',title:'认定文书与当地补充要求',desc:'具体身份、认定文书、特殊事故证明等，按当地办事指南和书面补正通知核对。',source:'地区要求：需向受理机构确认'}
];
scenarios.work.materials.push(mat('decision-record','工伤认定决定书与送达凭证','核对文书结果、作出日期、实际收到日期和权益告知；保留原始文书。','《工伤认定办法》第二十二条（送达）；核对内容为记录建议'));
 const api={sources,scenarios,commonDates};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.XianqiCatalog=api;
})(globalThis);
