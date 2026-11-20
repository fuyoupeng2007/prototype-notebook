'use strict';

const tasks = {
  photo: {name: '把一张照片按原图发给家人', steps: [
    {screen: '家人聊天', tip: '先点“＋ 更多”，打开可以发送的内容。', target: 'plus', options: [['voice', '◖ 语音消息'], ['plus', '＋ 更多'], ['emoji', '☺ 表情']]},
    {screen: '发送什么', tip: '点“相册”，找到要发送的照片。', target: 'album', options: [['album', '▧ 相册'], ['camera', '◎ 拍摄'], ['location', '⌖ 位置']]},
    {screen: '选择照片', tip: '点“选中这张照片”，确认要发送的那张。', target: 'photo', options: [['photo', '✓ 选中这张照片'], ['cancel', '暂时不选']]},
    {screen: '发送前确认', tip: '先点“原图”，让照片保留清晰度。', target: 'original', options: [['original', '○ 原图'], ['send', '直接发送'], ['cancel', '取消']]},
    {screen: '发送前确认', tip: '已经勾选原图。现在点“发送”，完成练习。', target: 'send', options: [['send', '↗ 发送'], ['cancel', '取消']]}
  ]},
  font: {name: '把手机文字调大', steps: [
    {screen: '手机桌面', tip: '先点“设置”。', target: 'settings', options: [['settings', '⚙ 设置'], ['store', '应用商店'], ['gallery', '相册']]},
    {screen: '设置', tip: '点“显示与亮度”。', target: 'display', options: [['display', '显示与亮度'], ['sound', '声音'], ['network', '网络']]},
    {screen: '显示与亮度', tip: '点“字体大小”。', target: 'font', options: [['font', '字体大小'], ['brightness', '屏幕亮度'], ['dark', '深色模式']]},
    {screen: '字体大小', tip: '点“大号字体”，把字调大一级。', target: 'large', options: [['small', '小号字体'], ['normal', '默认字体'], ['large', '大号字体']]},
    {screen: '确认字体', tip: '预览文字已经变大。点“应用”保存模拟设置。', target: 'apply', options: [['apply', '✓ 应用'], ['cancel', '取消']]}
  ]},
  bus: {name: '查看附近公交的到站信息', steps: [
    {screen: '手机桌面', tip: '先点“地图”。', target: 'map', options: [['map', '⌖ 地图'], ['camera', '相机'], ['music', '音乐']]},
    {screen: '地图', tip: '点“公交”，切换出行方式。', target: 'bus', options: [['bus', '▤ 公交'], ['drive', '驾车'], ['walk', '步行']]},
    {screen: '附近公交', tip: '点“春风路站”，查看这座模拟车站。', target: 'stop', options: [['stop', '春风路站'], ['other', '青年路站']]},
    {screen: '春风路站', tip: '点“12路 · 开往图书馆”，查看这一方向。', target: 'line', options: [['line', '12路 · 开往图书馆'], ['reverse', '12路 · 开往体育馆']]},
    {screen: '车辆信息', tip: '这里显示“约5分钟到站”。点“我看懂了”完成练习。', target: 'done', options: [['done', '✓ 我看懂了'], ['other', '换一个方向']]}
  ]}
};

const STORE_KEY = 'three-guide-v2';
const MAX_ROUNDS = 50;
const MAX_EVENTS = 500;
const modes = ['teach', 'practice'];
const validTask = key => typeof key === 'string' && Object.hasOwn(tasks, key);
const nowISO = () => new Date().toISOString();
const freshId = () => globalThis.crypto?.randomUUID?.() || 'round-' + Date.now() + '-' + Math.random().toString(36).slice(2);
const integer = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
const validDate = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
const validEvents = list => Array.isArray(list) && list.length <= MAX_EVENTS && list.every(e => e && integer(e.step, 5) && typeof e.action === 'string' && e.action.length <= 300 && validDate(e.at));
const validElapsed = ms => typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 && ms <= 365 * 86400000;

function newRound(task = 'photo', mode = 'teach', variant = 0) {
  return {id: freshId(), task, mode, index: 0, wrong: false, completedSteps: [], mistakes: 0, hints: 0, history: [], showHint: false, startedAt: nowISO(), elapsedMs: 0, archived: false, layoutVariant: variant};
}

function validRound(r) {
  return r && typeof r === 'object' && typeof r.id === 'string' && r.id.length <= 100 && validTask(r.task) && modes.includes(r.mode) &&
    integer(r.index, tasks[r.task].steps.length) && typeof r.wrong === 'boolean' && typeof r.showHint === 'boolean' &&
    typeof r.archived === 'boolean' && integer(r.layoutVariant, 1000000) && validDate(r.startedAt) && validElapsed(r.elapsedMs) &&
    integer(r.mistakes, 100000) && integer(r.hints, 100000) && Array.isArray(r.completedSteps) &&
    r.completedSteps.length <= tasks[r.task].steps.length && new Set(r.completedSteps).size === r.completedSteps.length &&
    r.completedSteps.every(i => integer(i, tasks[r.task].steps.length - 1)) && validEvents(r.history) &&
    (!r.archived || (r.index === tasks[r.task].steps.length && validDate(r.endedAt))) &&
    (r.index !== tasks[r.task].steps.length || (r.completedSteps.length === tasks[r.task].steps.length && r.archived && !r.wrong));
}

function validSummary(r) {
  return r && typeof r === 'object' && typeof r.id === 'string' && r.id.length <= 100 && validTask(r.task) && modes.includes(r.mode) &&
    ['completed', 'stopped'].includes(r.status) && validDate(r.startedAt) && validDate(r.endedAt) && validElapsed(r.elapsedMs) &&
    integer(r.correct, 5) && integer(r.mistakes, 100000) && integer(r.hints, 100000) && validEvents(r.history) &&
    (r.status !== 'completed' || r.correct === tasks[r.task].steps.length);
}

function restore() {
  const clean = {version: 2, active: newRound(), rounds: [], preferences: {largeText: false}};
  try {
    const text = localStorage.getItem(STORE_KEY);
    if (text !== null) {
      const saved = JSON.parse(text);
      if (!saved || saved.version !== 2 || typeof saved !== 'object') throw Error('invalid-state');
      const seen = new Set();
      clean.rounds = Array.isArray(saved.rounds) ? saved.rounds.filter(r => {
        if (!validSummary(r) || seen.has(r.id)) return false;
        seen.add(r.id); return true;
      }).slice(0, MAX_ROUNDS) : [];
      if (typeof saved.preferences?.largeText === 'boolean') clean.preferences.largeText = saved.preferences.largeText;
      if (validRound(saved.active)) clean.active = saved.active;
      else queueMicrotask(() => toast('当前练习存档无法读取，已开始新一轮；有效的历史记录仍保留。'));
      return clean;
    }
    // v1 did not retain ended rounds. Migrate only a valid unfinished task; do not invent past results.
    const old = JSON.parse(localStorage.getItem('three-guide-v1') || 'null');
    if (old && validTask(old.task) && modes.includes(old.mode) && integer(old.index, 4) && typeof old.wrong === 'boolean' && integer(old.mistakes, 100000) && integer(old.hints, 100000)) {
      clean.active = {...newRound(old.task, old.mode), index: old.index, wrong: old.wrong, completedSteps: Array.from({length: old.index}, (_, i) => i), mistakes: old.mistakes, hints: old.hints};
    }
  } catch {
    queueMicrotask(() => toast('练习存档无法读取，已安全恢复为新一轮。'));
  }
  return clean;
}

let app = restore();
let s = app.active;
let lastTick = performance.now();
let wasVisible = document.visibilityState === 'visible';
let lastSavedAt = performance.now();

function clock() {
  const current = performance.now();
  if (wasVisible && !s.archived) s.elapsedMs += Math.max(0, current - lastTick);
  lastTick = current;
  wasVisible = document.visibilityState === 'visible';
}

function persist() {saveJSON(STORE_KEY, app); lastSavedAt = performance.now();}
function formatDuration(ms) {const t = Math.floor(ms / 1000); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');}
function log(action) {
  s.history.push({step: Math.min(s.index + 1, tasks[s.task].steps.length), action, at: nowISO()});
  if (s.history.length > MAX_EVENTS) s.history.shift();
}
function summary(status) {
  return {id: s.id, task: s.task, mode: s.mode, status, startedAt: s.startedAt, endedAt: s.endedAt || nowISO(), elapsedMs: Math.round(s.elapsedMs), correct: s.completedSteps.length, mistakes: s.mistakes, hints: s.hints, history: s.history.map(e => ({...e}))};
}
function archive(status) {
  if (app.rounds.some(r => r.id === s.id)) return;
  app.rounds.unshift(summary(status)); app.rounds = app.rounds.slice(0, MAX_ROUNDS);
}
function optionsFor(step) {
  if (s.mode === 'teach') return step.options;
  // Non-zero rotation moves every button while preserving labels and the task's meaning.
  const offset = 1 + ((s.layoutVariant + s.index) % (step.options.length - 1));
  return step.options.slice(offset).concat(step.options.slice(0, offset));
}
function renderHistory() {
  const completed = app.rounds.filter(r => r.status === 'completed');
  const independent = completed.filter(r => r.mode === 'practice' && r.mistakes === 0 && r.hints === 0);
  $('#history-summary').textContent = `已完成 ${completed.length} 轮，其中 ${independent.length} 轮独立完成且未点错、未求助。当前这轮${s.archived ? '已计入记录' : '尚未结束'}。`;
  $('#round-history').innerHTML = app.rounds.length ? app.rounds.map(r => {
    const date = new Date(r.endedAt).toLocaleString('zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
    const exact = r.status === 'completed' && r.mode === 'practice' && r.mistakes === 0 && r.hints === 0;
    return `<article class="guide-history-row"><div><span class="pill ${exact ? 'independent' : ''}">${r.status === 'completed' ? (r.mode === 'teach' ? '带练完成' : exact ? '独立完成' : '复练完成') : '中途结束'}</span><h4>${escapeHTML(tasks[r.task].name)}</h4><p>${escapeHTML(date)} · ${formatDuration(r.elapsedMs)} · 走通 ${r.correct}/5 步 · 点错 ${r.mistakes} 次 · 求助 ${r.hints} 次</p></div><details><summary>查看过程</summary><ol>${r.history.map(e => `<li>第${e.step}步 · ${escapeHTML(e.action)}</li>`).join('') || '<li>没有操作记录</li>'}</ol></details></article>`;
  }).join('') : '<p class="empty">还没有结束的练习。完成后，记录会留在这里。</p>';
}
function focusScreen() {$('#screen-title').focus({preventScroll: true});}

function render() {
  const task = tasks[s.task], step = task.steps[s.index], done = !step;
  document.body.classList.toggle('guide-large', app.preferences.largeText);
  $('#large-text').checked = app.preferences.largeText; $('#task').value = s.task;
  for (const mode of modes) {$('#' + mode).classList.toggle('active', s.mode === mode); $('#' + mode).setAttribute('aria-pressed', String(s.mode === mode));}
  $('#mode-note').textContent = s.mode === 'teach' ? '带练：先读一句指引，再点绿色边框里的按钮。' : '复练：按钮位置会变化，请按文字找。默认不显示下一步答案，需要时可主动求助。';
  $('#steps').innerHTML = task.steps.map((x, i) => `<div class="step-line ${i === s.index ? 'current' : ''}" ${i === s.index ? 'aria-current="step"' : ''}><i>${i < s.index ? '✓' : i + 1}</i>${escapeHTML(s.mode === 'practice' ? '第 ' + (i + 1) + ' 步' : x.screen)}</div>`).join('');
  $('#progress-bar').style.width = (s.index / task.steps.length * 100) + '%'; $('.progress').setAttribute('aria-valuenow', String(s.index));
  $('#correct-count').textContent = s.completedSteps.length; $('#round-duration').textContent = formatDuration(s.elapsedMs);
  $('#mistake-count').textContent = `点错 ${s.mistakes} 次 · 主动求助 ${s.hints} 次`;
  $('#back').disabled = done || (s.index === 0 && !s.wrong); $('#hint').disabled = done || s.showHint || s.wrong; $('#read').disabled = done;
  $('#device-back').disabled = $('#back').disabled; $('#device-hint').disabled = $('#hint').disabled;
  $('#device-instruction').textContent = done ? '这轮已经完成，结果保存在下方。' : s.wrong ? '先返回刚才的页面，再继续。' : s.mode === 'teach' || s.showHint ? step.tip : '按目标自己找下一步，需要时可请求提示。';
  $('#coach-title').textContent = done ? '这轮练习完成了' : s.wrong ? '先回到刚才那一页' : s.mode === 'practice' && !s.showHint ? '这次，请你自己试试' : '现在只做这一步';
  renderHistory();
  if (done) {
    $('#screen-title').textContent = '练习完成';
    $('#phone').innerHTML = `<div class="phone-done">✓<span>你亲手做到了</span></div><p class="small guide-complete-name">${escapeHTML(task.name)}</p><button class="phone-option" id="again">再练一次</button>`;
    $('#instruction').textContent = '这件事，你已经走通了。'; $('#feedback').className = 'hint good';
    $('#feedback').textContent = s.mode === 'practice' && s.mistakes === 0 && s.hints === 0 ? '本轮独立完成，没有点错，也没有请求提示。' : '看看哪一步还不熟悉，再试一遍。';
    $('#learning-result').innerHTML = `<div class="result-card"><b>${s.mode === 'teach' ? '带练完成，建议独立复练' : '独立复练记录'}</b><p>走通 ${s.completedSteps.length}/5 步，用时 ${formatDuration(s.elapsedMs)}；点错 ${s.mistakes} 次，求助 ${s.hints} 次。本轮已经保存。</p></div><button class="btn secondary full" id="start-practice">换个按钮位置，独立试一次</button>`;
    $('#again').onclick = () => reset(s.mode); $('#start-practice').onclick = () => reset('practice'); return;
  }
  $('#learning-result').innerHTML = '';
  if (s.wrong) {
    $('#screen-title').textContent = '走到了其他页面';
    $('#phone').innerHTML = '<div class="phone-photo">↶</div><p class="small">这不是当前目标要去的地方。</p><button class="phone-option recovery" id="recover">← 返回刚才那一页</button>';
    $('#instruction').textContent = '没关系，先点“返回刚才那一页”。'; $('#feedback').className = 'hint warning';
    $('#feedback').textContent = '先回到原来的页面，再继续找。点错已经记入这轮记录，帮助你找到需要再练的地方。';
    $('#recover').onclick = () => {clock(); s.wrong = false; log('返回错误分支'); persist(); render(); focusScreen();}; return;
  }
  $('#screen-title').textContent = step.screen;
  const highlight = s.mode === 'teach' || s.showHint;
  $('#phone').innerHTML = (s.task === 'photo' && s.index >= 2 ? '<div class="phone-photo" aria-label="模拟照片">▧</div>' : '') +
    (s.task === 'bus' && s.index === 4 ? '<div class="result-card"><b>约5分钟到站</b><p>演示数据，不是真实公交信息</p></div>' : '') +
    (s.task === 'font' && s.index === 4 ? '<p class="guide-font-preview">看得更清楚了</p>' : '') +
    optionsFor(step).map(([id, label]) => `<button class="phone-option ${highlight && id === step.target ? 'target' : ''}" data-choice="${id}">${escapeHTML(label)}</button>`).join('');
  $('#instruction').textContent = highlight ? step.tip : '目标：' + task.name + '。请自己找下一步。'; $('#feedback').className = 'hint';
  $('#feedback').textContent = highlight ? (s.showHint ? '这一步已提供提示；继续完成后，下一步会恢复独立尝试。' : '每次只做一步。操作结果会决定下一步提示。') : '本轮没有目标高亮。需要帮助时可点“我找不到”，求助会单独记录。';
  $$('[data-choice]').forEach(el => el.onclick = () => {
    clock();
    if (el.dataset.choice === step.target) {
      log('正确：' + el.textContent);
      if (!s.completedSteps.includes(s.index)) s.completedSteps.push(s.index);
      s.index++; s.showHint = false;
      if (s.index === task.steps.length) {s.endedAt = nowISO(); s.archived = true; archive('completed');}
    } else {log('点错：' + el.textContent); s.mistakes++; s.wrong = true;}
    persist(); render(); focusScreen();
  });
}

function reset(mode = s.mode, task = s.task) {
  clock(); if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (!s.archived && (s.history.length || s.index)) archive('stopped');
  s = newRound(task, mode, app.rounds.length % 1000000); app.active = s; persist(); render();
}
$('#task').onchange = () => reset('teach', $('#task').value);
$('#teach').onclick = () => {if (s.mode !== 'teach' || s.archived) reset('teach');};
$('#practice').onclick = () => {if (s.mode !== 'practice' || s.archived) reset('practice');};
$('#restart').onclick = () => reset();
$('#hint').onclick = () => {if (s.archived || s.wrong || s.showHint) return; clock(); s.hints++; s.showHint = true; log('主动请求提示'); persist(); render();};
$('#back').onclick = () => {
  if (s.archived) return; clock();
  if (s.wrong) s.wrong = false; else if (s.index > 0) s.index--; else return;
  s.showHint = false; log('主动返回'); persist(); render(); focusScreen();
};
$('#large-text').onchange = () => {app.preferences.largeText = $('#large-text').checked; persist(); render();};
$('#device-hint').onclick = () => $('#hint').click();
$('#device-back').onclick = () => $('#back').click();
$('#read').onclick = () => {if (!s.archived) speak($('#instruction').textContent);};
$('#export').onclick = () => {clock(); persist(); download('爸妈跟着点-本轮记录.json', JSON.stringify({...summary(s.archived ? 'completed' : 'in-progress'), taskName: tasks[s.task].name, completed: s.archived, notice: '模拟任务记录；计时仅包含页面可见时间。重复走同一步不增加走通步骤数量。'}, null, 2), 'application/json');};
$('#export-history').onclick = () => {clock(); persist(); download('爸妈跟着点-全部练习记录.json', JSON.stringify({version: 2, exportedAt: nowISO(), rounds: app.rounds, current: s.archived ? null : summary('in-progress'), notice: '最多保留50轮；练习结果不等于真实应用中的长期学习效果。'}, null, 2), 'application/json');};
document.addEventListener('visibilitychange', () => {clock(); persist();});
window.addEventListener('pagehide', () => {clock(); persist();});
setInterval(() => {clock(); $('#round-duration').textContent = formatDuration(s.elapsedMs); if (!s.archived && performance.now() - lastSavedAt >= 5000) persist();}, 1000);
persist(); render();
