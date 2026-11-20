/* The explanation layer is optional; settings stay in the local server process. */
(() => {
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const guide=new URL('guide.html',document.currentScript.src).href;
let busy=false;
const css=`#studio-ai{box-sizing:border-box;border:1px solid #dce1e7;border-radius:18px;padding:26px;max-width:660px;width:calc(100% - 32px);color:#253040;box-shadow:0 20px 90px #0003;font:14px/1.8 'Microsoft YaHei',system-ui;max-height:88vh;overflow:auto}#studio-ai::backdrop{background:#17232a66}#studio-ai *{box-sizing:border-box}#studio-ai h2{font-size:21px;margin:0}#studio-ai h3{font-size:14px;margin:20px 0 6px}#studio-ai .ai-head{display:flex;align-items:center;justify-content:space-between;gap:15px}#studio-ai button{font:inherit;cursor:pointer}#studio-ai .ai-close{border:0;border-radius:50%;width:32px;height:32px;flex-shrink:0;background:#eef1f2}#studio-ai .ai-btn{padding:10px 16px;background:#26384b;color:white;border:0;border-radius:8px}#studio-ai .ai-secondary{background:#edf1f2;color:#26384b}#studio-ai .ai-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}#studio-ai .ai-note{font-size:12px;color:#72808d}#studio-ai .ai-card{background:#f2f5f1;border:1px solid #dce3dc;border-radius:10px;padding:15px;margin:16px 0;overflow-wrap:anywhere}#studio-ai label{display:block;font-size:12px;margin:14px 0 5px}#studio-ai input{width:100%;font:14px/1.6 'Microsoft YaHei',system-ui;padding:10px 12px;border:1px solid #cbd4da;border-radius:7px;color:#253040;background:white}#studio-ai :focus-visible{outline:3px solid #9cbca5;outline-offset:2px}#studio-ai pre{white-space:pre-wrap;max-height:200px;overflow:auto;font-size:11px;overflow-wrap:anywhere}#studio-ai .ai-error{color:#a33e3a;font-size:12px}#studio-ai [disabled]{opacity:.55;cursor:wait}`;
function dialog(title){
 let dlg=document.getElementById('studio-ai');
 if(!dlg){const style=document.createElement('style');style.textContent=css;document.head.append(style);dlg=document.createElement('dialog');dlg.id='studio-ai';document.body.append(dlg)}
 dlg.setAttribute('aria-labelledby','studio-ai-title');
 dlg.innerHTML=`<div class="ai-head"><h2 id="studio-ai-title">${escape(title)}</h2><button class="ai-close" id="ai-close" aria-label="关闭模型窗口">×</button></div><div id="ai-body"><p role="status">正在读取本机配置…</p></div>`;
 if(!dlg.open)dlg.showModal();
 dlg.querySelector('#ai-close').onclick=()=>dlg.close();
 return dlg.querySelector('#ai-body');
}
async function status(){
 const response=await fetch('/api/status',{signal:AbortSignal.timeout(4000)});
 if(!response.ok)throw Error('本机服务未响应');
 return response.json();
}
function offline(out){
 out.innerHTML=`<div class="ai-card"><b>核心功能可以直接离线玩。</b><p>模型解释需要本机服务。请在解压目录双击 <strong>启动三个原型.cmd</strong>，在自动打开的页面中进入「模型设置」。</p></div><p class="ai-note">启动后可在页面填写服务地址、模型和密钥，无需修改代码或环境变量。页面配置只在这次服务运行期间保存。</p><a href="${escape(guide)}">查看启动说明 ↗</a>`;
}
function settings(out,config,onDone){
 out.innerHTML=`<p>填写兼容 Chat Completions 的服务。保存配置不会发送学习资料，也不会调用模型。</p>${config.configured?`<div class="ai-card"><b>当前配置：${escape(config.model)}</b><br>${escape(config.base_url||'')}<br><span class="ai-note">已配置不代表服务已验证可用；下一次主动发送时才会调用。</span></div>`:''}<form id="ai-config-form"><label for="ai-base">API 基础地址（通常以 /v1 结尾）</label><input id="ai-base" type="url" required placeholder="https://你的服务地址/v1" value="${escape(config.base_url||'')}" autocomplete="off"><label for="ai-model">模型名称</label><input id="ai-model" required maxlength="200" placeholder="服务商提供的模型名称" value="${escape(config.model||'')}" autocomplete="off"><label for="ai-key">API Key（本机 HTTP 模型可留空）</label><input id="ai-key" type="password" maxlength="4096" autocomplete="off" spellcheck="false" placeholder="远程服务需填写；修改配置时请重新输入"><p class="ai-note">密钥只交给本机服务，不写入网页存储或磁盘，接口也不会返回密钥。重启后页面配置失效；环境变量配置仍可使用。</p><p id="ai-config-error" class="ai-error" role="alert"></p><div class="ai-actions"><button class="ai-btn" id="ai-save" type="submit">保存到本次运行</button>${config.configured?'<button class="ai-btn ai-secondary" id="ai-clear" type="button">清除当前配置</button>':''}${onDone&&config.configured?'<button class="ai-btn ai-secondary" id="ai-back" type="button">返回解释</button>':''}</div></form>`;
 out.querySelector('#ai-config-form').onsubmit=async event=>{
  event.preventDefault();const button=out.querySelector('#ai-save');button.disabled=true;
  const payload={base_url:out.querySelector('#ai-base').value.trim(),model:out.querySelector('#ai-model').value.trim(),api_key:out.querySelector('#ai-key').value.trim()};
  try{const response=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw Error(data.error||'未保存');out.querySelector('#ai-key').value='';saved(out,data,onDone)}catch(error){out.querySelector('#ai-config-error').textContent=error.message;button.disabled=false}finally{payload.api_key=''}
 };
 out.querySelector('#ai-clear')?.addEventListener('click',async()=>{
  try{const response=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"clear":true}'});const data=await response.json();if(!response.ok)throw Error(data.error||'清除失败');settings(out,data,onDone);document.dispatchEvent(new CustomEvent('studio-model-configured',{detail:{configured:false,model:''}}))}catch(error){out.querySelector('#ai-config-error').textContent=error.message}
 });
 out.querySelector('#ai-back')?.addEventListener('click',()=>onDone(config));
}
function saved(out,config,onDone){
 document.dispatchEvent(new CustomEvent('studio-model-configured',{detail:{configured:config.configured,model:config.model}}));
 out.innerHTML=`<div class="ai-card"><b>配置已保存在本次服务运行中。</b><p>${escape(config.model)} · ${escape(config.base_url)}</p><span class="ai-note">尚未调用模型。解释前仍需检查数据并点击发送。</span></div><div class="ai-actions"><button id="ai-config-done" class="ai-btn">${onDone?'返回，查看待发送数据':'完成设置'}</button></div>`;
 out.querySelector('#ai-config-done').onclick=()=>onDone?onDone(config):document.getElementById('studio-ai').close();
}
function explain(out,config,kind,payload){
 if(!config.configured){settings(out,config,updated=>explain(out,updated,kind,payload));return}
 out.innerHTML=`<div class="ai-card"><b>模型：${escape(config.model)}</b><br><span class="ai-note">${escape(config.base_url||'本机网关')} · 实际连通性将在发送时确认</span></div><p>将发送当前页面的输入与计算证据，请先核对。原始附件不会随此请求上传。</p><details><summary>查看本次将发送的数据</summary><pre>${escape(JSON.stringify(payload,null,2))}</pre></details><div class="ai-actions"><button id="ai-send" class="ai-btn">发送这些数据，生成解释</button><button id="ai-settings" class="ai-btn ai-secondary">修改模型设置</button></div>`;
 out.querySelector('#ai-settings').onclick=()=>settings(out,config,updated=>explain(out,updated,kind,payload));
 out.querySelector('#ai-send').onclick=async()=>{
  busy=true;out.innerHTML='<p role="status">正在生成解释，最长约 45 秒…</p><p class="ai-note">本地计算结果已经保留。</p>';
  try{const response=await fetch('/api/assist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,payload}),signal:AbortSignal.timeout(50000)});const data=await response.json();if(!response.ok)throw Error(data.error||'服务错误');if(!['observations','suggestions','uncertainties'].every(k=>Array.isArray(data[k])))throw Error('模型返回格式不正确');out.innerHTML=[['observations','模型归纳的观察'],['suggestions','建议下一步'],['uncertainties','仍需确认']].map(([key,label])=>`<h3>${label}</h3><ul>${data[key].map(item=>`<li>${escape(item)}</li>`).join('')||'<li>模型未提供此项。</li>'}</ul>`).join('')+'<p class="ai-note">这是模型建议，请结合原文和本地计算结果核对。</p>'}
  catch(error){out.innerHTML=`<p class="ai-error" role="alert">本次未获得模型解释：${escape(error.message)}</p><p>本地计算结果保留，可以继续操作。</p><div class="ai-actions"><button id="ai-retry" class="ai-btn">返回数据预览</button></div>`;out.querySelector('#ai-retry').onclick=()=>explain(out,config,kind,payload)}
  finally{busy=false}
 };
}
window.openStudioSettings=async()=>{
 if(busy)return;const out=dialog('模型设置');if(location.protocol==='file:'){offline(out);return}
 try{settings(out,await status(),null)}catch{offline(out)}
};
window.askStudioAI=async(kind,payload)=>{
 if(busy)return;const out=dialog('可选：让模型解释证据');if(location.protocol==='file:'){offline(out);return}
 try{explain(out,await status(),kind,payload)}catch{offline(out)}
};
})();
