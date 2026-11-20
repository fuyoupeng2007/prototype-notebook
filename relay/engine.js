(function(root){
 'use strict';
 const pad=n=>String(n).padStart(2,'0');
 function day(base,offset){const d=new Date(base+'T12:00:00');d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
 function parse(text,base='2026-11-10'){
  const dateMatch=text.match(/(20\d{2})[-年/.](\d{1,2})[-月/.](\d{1,2})日?/);
  const short=text.match(/(?<!\d)(\d{1,2})月(\d{1,2})日?/);
  let date=dateMatch?`${dateMatch[1]}-${pad(dateMatch[2])}-${pad(dateMatch[3])}`:short?`${base.slice(0,4)}-${pad(short[1])}-${pad(short[2])}`:/后天/.test(text)?day(base,2):/明天|明日/.test(text)?day(base,1):/今天|今日/.test(text)?base:'';
  let matches=[...text.matchAll(/(?:(上午|下午|晚上|中午|早上)\s*)?(\d{1,2})(?:[:：](\d{2})|点(?:(\d{1,2})分?|半)?)/g)];
  let tm=matches.at(-1),time='';
  if(tm){let h=+tm[2],m=tm[3]?+tm[3]:tm[4]?+tm[4]:tm[0].includes('半')?30:0;if(/下午|晚上|中午/.test(tm[1]||'')&&h<12)h+=12;if(h<24&&m<60)time=`${pad(h)}:${pad(m)}`;}
  const kinds=[['面试','面试'],['取件|快递','取件'],['答辩','答辩'],['会议|开会','会议'],['高铁|车次|列车','乘车'],['看房|租房','看房'],['复诊|挂号','就诊'],['聚餐|吃饭','聚餐'],['交材料|提交|报名','提交材料']];
  const kind=kinds.find(([re])=>new RegExp(re).test(text))?.[1]||'日常安排';
  const titleMatch=text.match(/(?:事项|标题)[：:]\s*([^\n，。；;]+)/);
  const loc=text.match(/(?:地点|地址|位置|改到)[：:]\s*([^\n，。；;]+)/);
  const checklist=[];for(const name of ['身份证','学生证','简历','电脑','手机','充电器','雨伞','取件码','材料','门禁卡'])if(text.includes(name))checklist.push(name);
  return {title:titleMatch?titleMatch[1].trim():kind,kind,date,time,location:loc?loc[1].trim():'',duration:kind==='乘车'?90:kind==='取件'?15:60,checklist,change:/改为|改到|调整为|变更|延期|提前|改期/.test(text),cancel:/取消|作废/.test(text),evidence:{date:dateMatch?.[0]||short?.[0]||text.match(/后天|明天|明日|今天|今日/)?.[0]||'',time:tm?.[0]||'',location:loc?.[0]||''},text};
 }
 function conflicts(item,events){if(!item.date||!item.time||item.cancel)return [];const a=Date.parse(`${item.date}T${item.time}:00+08:00`);return events.filter(e=>e.id!==item.targetId&&e.id!==item.id&&e.date&&e.time).filter(e=>{const b=Date.parse(`${e.date}T${e.time}:00+08:00`);return a<b+e.duration*60000&&b<a+item.duration*60000});}
 function escapeICS(s){return String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')}
 function ics(events){const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Relay//Life Handoff//ZH','CALSCALE:GREGORIAN'];for(const e of events){let start=new Date(`${e.date}T${e.time}:00+08:00`),end=new Date(start.getTime()+e.duration*60000);const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');lines.push('BEGIN:VEVENT',`UID:${escapeICS(e.id)}@relay.local`,'DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(start),'DTEND:'+stamp(end),'SUMMARY:'+escapeICS(e.title),'LOCATION:'+escapeICS(e.location),'DESCRIPTION:'+escapeICS('来源：'+e.source+'\n'+e.text),'BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:Relay 行程提醒','END:VALARM','END:VEVENT')}lines.push('END:VCALENDAR');return lines.join('\r\n')+'\r\n';}
 const api={parse,conflicts,ics,day};if(typeof module!=='undefined')module.exports=api;root.RelayEngine=api;
})(typeof window!=='undefined'?window:globalThis);
