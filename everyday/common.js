'use strict';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500)}
function download(name,text,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function saveJSON(key,data){try{localStorage.setItem(key,JSON.stringify(data));return true}catch{toast('浏览器存储不可用；本次进度仅在当前页面保留。');return false}}
function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
function speak(text){if(!('speechSynthesis' in window))return toast('此浏览器未提供朗读功能。');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=.85;const voice=speechSynthesis.getVoices().find(v=>v.localService&&/^zh[-_]CN/i.test(v.lang))||speechSynthesis.getVoices().find(v=>v.localService&&/^zh/i.test(v.lang));if(voice)u.voice=voice;u.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))toast('本机朗读不可用，请阅读文字提示。')};speechSynthesis.speak(u)}
// Keep keyboard navigation visible when page content is long.
const mainContent=document.querySelector('main');if(mainContent){mainContent.id=mainContent.id||'main-content';mainContent.tabIndex=-1;const skip=document.createElement('a');skip.className='skip-link';skip.href='#'+mainContent.id;skip.textContent='跳到主要内容';document.body.prepend(skip)}
window.addEventListener('pagehide',()=>{if('speechSynthesis' in window)speechSynthesis.cancel()});
