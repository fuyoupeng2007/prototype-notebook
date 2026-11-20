/* Local, deterministic analysis. No model or network calls. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LabEngine=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const G=9.80665;
  const REQUIRED=['length_m','cycles','elapsed_s','angle_deg','repeat_id'];
  function csvLines(text){
    if(typeof text!=='string'||text.length>150000)throw Error('CSV 必须是文字，且不超过 150,000 字符。');
    const lines=[];let row=[],field='',quoted=false;
    const input=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++}else if(!quoted&&field.trim())throw Error('CSV 引号位置不正确，请使用标准逗号分隔格式。');else quoted=!quoted}else if(c===','&&!quoted){row.push(field.trim());field=''}else if(c==='\n'&&!quoted){row.push(field.trim());if(row.some(Boolean))lines.push(row);row=[];field=''}else field+=c;}
    if(quoted)throw Error('CSV 中有未闭合的双引号。');row.push(field.trim());if(row.some(Boolean))lines.push(row);return lines;
  }
  function validateRow(r,i){
    const num=(k)=>{const v=r[k];if((typeof v!=='number'&&typeof v!=='string')||String(v).trim()===''||!Number.isFinite(Number(v)))throw Error(`第 ${i+2} 行 ${k} 不是有效数字。`);return Number(v)};
    const length_m=num('length_m'),cycles=num('cycles'),elapsed_s=num('elapsed_s'),angle_deg=num('angle_deg');
    if(length_m<=0||length_m>100)throw Error(`第 ${i+2} 行 length_m 必须大于 0 且不超过 100 米。请核对单位。`);
    if(!Number.isInteger(cycles)||cycles<1||cycles>10000)throw Error(`第 ${i+2} 行 cycles 必须是 1–10,000 的整数，代表完整周期数。`);
    if(elapsed_s<=0||elapsed_s>1000000)throw Error(`第 ${i+2} 行 elapsed_s 必须为合理的正秒数。`);
    if(angle_deg<0||angle_deg>=90)throw Error(`第 ${i+2} 行 angle_deg 应在 0（含）至 90（不含）度之间。`);
    if(typeof r.repeat_id!=='string'||!r.repeat_id.trim())throw Error(`第 ${i+2} 行 repeat_id 不能为空。`);
    return {length_m,cycles,elapsed_s,angle_deg,repeat_id:r.repeat_id.slice(0,120),sourceIndex:r.sourceIndex??i,period:elapsed_s/cycles,squaredPeriod:(elapsed_s/cycles)**2};
  }
  function parseCSV(text){const lines=csvLines(text);if(lines.length<2)throw Error('CSV 需要一行列名和至少一行数据。');const header=lines[0];if(new Set(header).size!==header.length)throw Error('CSV 列名重复。');const missing=REQUIRED.filter(x=>!header.includes(x));if(missing.length)throw Error('缺少列：'+missing.join(', ')+'。请使用下方模板。');if(lines.length>501)throw Error('此原型最多分析 500 条测量。');return lines.slice(1).map((line,i)=>{if(line.length!==header.length)throw Error(`第 ${i+2} 行列数不一致，请检查逗号与引号。`);const row={};header.forEach((h,j)=>row[h]=line[j]);return validateRow(row,i)});}
  function fit(input){
    if(!Array.isArray(input)||input.length<3)throw Error('拟合至少需要 3 条有效测量和 3 个不同摆长。');
    const rows=input.map(validateRow),n=rows.length;
    if(new Set(rows.map(r=>r.length_m)).size<3)throw Error('拟合至少需要 3 个不同摆长；重复测同一长度不能替代长度覆盖。');
    const meanX=rows.reduce((s,r)=>s+r.length_m,0)/n,meanY=rows.reduce((s,r)=>s+r.squaredPeriod,0)/n;
    const Sxx=rows.reduce((s,r)=>s+(r.length_m-meanX)**2,0),Sxy=rows.reduce((s,r)=>s+(r.length_m-meanX)*(r.squaredPeriod-meanY),0);
    if(Sxx<1e-16)throw Error('摆长范围过小，无法稳定拟合。请扩大测量范围。');
    const slope=Sxy/Sxx,intercept=meanY-slope*meanX;
    const points=rows.map(r=>({...r,predicted:slope*r.length_m+intercept,residual:r.squaredPeriod-(slope*r.length_m+intercept)}));
    const sse=points.reduce((s,r)=>s+r.residual**2,0),sst=rows.reduce((s,r)=>s+(r.squaredPeriod-meanY)**2,0),r2=sst>1e-20?1-sse/sst:null,rmse=Math.sqrt(sse/n),residualStd=Math.sqrt(sse/(n-2));
    const slopeSE=residualStd/Math.sqrt(Sxx),interceptSE=residualStd*Math.sqrt(1/n+meanX**2/Sxx);
    const warnings=[];
    if(rows.some(r=>r.angle_deg>10))warnings.push('有摆角超过 10° 的记录。当前使用小角度模型，幅角效应可能不可忽略。');
    if(rows.some(r=>r.period<.1||r.period>30))warnings.push('有单周期时长偏离此桌面场景的常见范围，请核对秒/毫秒、周期计数和单位。');
    if(slope<=0)warnings.push('拟合斜率非正，不能由此计算有物理意义的 g。请先检查数据与模型。');
    if(rows.length<5)warnings.push('样本少于 5 条，残差与参数估计很不稳定，应增加测量。');
    const influence=points.map((r,i)=>{let maxChange=null;try{const keep=points.filter((_,j)=>i!==j);if(keep.length>=3&&new Set(keep.map(p=>p.length_m)).size>=3){const mx=keep.reduce((s,p)=>s+p.length_m,0)/keep.length,my=keep.reduce((s,p)=>s+p.squaredPeriod,0)/keep.length,xx=keep.reduce((s,p)=>s+(p.length_m-mx)**2,0),xy=keep.reduce((s,p)=>s+(p.length_m-mx)*(p.squaredPeriod-my),0),a=xy/xx;maxChange=Math.abs(a-slope)}}catch{}return {sourceIndex:r.sourceIndex,repeat_id:r.repeat_id,slopeChange:maxChange}}).sort((a,b)=>(b.slopeChange??-1)-(a.slopeChange??-1));
    return {n,slope,intercept,g:slope>0?4*Math.PI**2/slope:null,r2,rmse,residualStd,slopeSE,interceptSE,points,influence,warnings,formula:'T² = aL + b; g = 4π²/a',assumptions:'小摆角、完整周期、长度为悬点至质心距离；计时/长度校准正确；不把拟合优度当作因果证据。'};
  }
  function period(length,g=G){if(!Number.isFinite(length)||length<=0||!Number.isFinite(g)||g<=0)throw Error('摆长与 g 必须是正数。');return 2*Math.PI*Math.sqrt(length/g)}
  function predictions(options={}){const length=Number(options.length??.6),offset=Number(options.offset??.035),timer=Number(options.timer??.45),tolerance=Number(options.tolerance??.15);if(length<=0||offset<0||length+offset<=0||!Number.isFinite(timer)||!Number.isFinite(length)||!Number.isFinite(offset)||tolerance<=0||!Number.isFinite(tolerance))throw Error('复测假设参数不正确。');const base=period(length);return {length,offset,timer,tolerance,g:G,cycles:[5,20],basePeriod:base,lengthHypothesis:[5,20].map(n=>({cycles:n,elapsed:n*period(length+offset),period:period(length+offset)})),timerHypothesis:[5,20].map(n=>({cycles:n,elapsed:n*base+timer,period:base+timer/n})),notes:'两个模型都是公开参数的假设示例，不是对原始测量自动拟合出的根因。使用相同的小摆角并保持测量方法一致。'};}
  function compareRetest(observations,options={}){const p=predictions(options),obs=[Number(observations[0]),Number(observations[1])];if(obs.some(x=>!Number.isFinite(x)||x<=0))throw Error('请输入 5 周期与 20 周期两次完整计时，单位为秒。');const calc=pred=>{const residuals=obs.map((v,i)=>v-pred[i].elapsed);return {residuals,rmse:Math.sqrt(residuals.reduce((s,x)=>s+x*x,0)/2),compatible:residuals.every(x=>Math.abs(x)<=p.tolerance)}};const length=calc(p.lengthHypothesis),timer=calc(p.timerHypothesis);let verdict,detail;
    if(length.compatible&&!timer.compatible){verdict='这组复测更支持“长度偏差示例”';detail='只有长度偏差示例的两次预测都落在设定容差内。请复量悬点到质心距离；这仍不能排除其他解释。'}
    else if(timer.compatible&&!length.compatible){verdict='这组复测更支持“固定计时偏差示例”';detail='只有固定计时偏差示例的两次预测都落在设定容差内。建议改用视频计时，并检查启动/停止操作。'}
    else if(length.compatible&&timer.compatible){verdict='证据还不够区分这两个解释';detail='两个示例都落在容差内。请增加重复测量或缩小经校准的计时容差，不能仅因某个误差更小就断言根因。'}
    else{verdict='两个示例都不能充分解释这组复测';detail='至少一次计时超出各自的设定容差。请检查计数、摆角和单位，也可能需要新的解释；不要强行选择根因。'}
    return {observations:obs,observedPeriods:obs.map((x,i)=>x/p.cycles[i]),periodDifference:obs[0]/5-obs[1]/20,length,timer,verdict,detail,predictions:p};
  }
  function example(kind='normal'){const lengths=[.25,.35,.45,.6,.75,.9],noise=[-.018,.023,-.013,.009,-.020,.017];const rows=lengths.map((L,i)=>{const t=10*period(L+(kind==='offset'?.035:0))+noise[i]+(kind==='outlier'&&i===3?1.4:0);return {length_m:L,cycles:10,elapsed_s:Number(t.toFixed(4)),angle_deg:5,repeat_id:'S'+String(i+1).padStart(2,'0')}});return REQUIRED.join(',')+'\n'+rows.map(r=>REQUIRED.map(k=>r[k]).join(',')).join('\n');}
  return {G,REQUIRED,parseCSV,fit,period,predictions,compareRetest,example};
});
