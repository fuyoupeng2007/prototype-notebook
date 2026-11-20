'use strict';

// Fictional, bounded scenarios. Reading a demo rule is not real-world source verification.
const scenarios = {
  card: {
    materials: [['id', '身份证明', true], ['photo', '证件照片', false]],
    tasks: [
      {id: 'A', name: '校园卡补办', place: '校园服务中心', open: 540, close: 990, duration: 20, requires: ['id', 'photo'], produces: 'card', source: '演示办事指南 · S1', rule: '需身份证明与照片；16:30前完成受理。'},
      {id: 'B', name: '领取借用电脑', place: '设备借用处', open: 600, close: 1020, duration: 15, requires: ['card'], produces: 'device', source: '演示借用说明 · S2', rule: '需要补办后的校园卡；17:00前完成借用。'}
    ],
    travel: {HA: 15, HB: 30, AB: 10, BA: 10, AH: 20, BH: 20}
  },
  repair: {
    materials: [['device', '待修设备', true], ['proof', '购买凭证', false]],
    tasks: [
      {id: 'A', name: '设备送检', place: '维修接待点', open: 600, close: 1005, duration: 30, requires: ['device', 'proof'], produces: 'receipt', source: '演示维修说明 · R1', rule: '需设备与购买凭证；16:45前完成送检。'},
      {id: 'B', name: '借备用设备', place: '校园设备中心', open: 540, close: 1020, duration: 20, requires: ['receipt', 'proof'], produces: 'backup', source: '演示借用说明 · R2', rule: '需要送检凭证和购买凭证；17:00前完成借用。'}
    ],
    travel: {HA: 20, HB: 15, AB: 15, BA: 15, AH: 20, BH: 15}
  },
  library: {
    materials: [['book', '要归还的图书', true], ['id', '借阅证', false]],
    tasks: [
      {id: 'A', name: '归还逾期图书', place: '图书馆服务台', open: 540, close: 1020, duration: 10, requires: ['book', 'id'], produces: 'returned', source: '演示借阅规则 · L1', rule: '需图书与借阅证；归还后解除本场景的借阅限制。'},
      {id: 'B', name: '取预约书', place: '预约取书点', open: 960, close: 1050, duration: 10, requires: ['id', 'returned'], produces: 'newbook', source: '演示预约通知 · L2', rule: '16:00起取书，17:30前完成；需先归还逾期图书。'}
    ],
    travel: {HA: 15, HB: 15, AB: 5, BA: 5, AH: 15, BH: 15}
  }
};
const generatedNames = {card: '补办后的校园卡', receipt: '送检凭证', returned: '归还完成状态'};
let current = 'card';
let results = [];
let dataValid = true;
let sourceChecks = {A: false, B: false};
let durations = {A: 20, B: 15};
let suggestion = null;
let simulation = null;

function time(value) {
  if (!Number.isFinite(value)) return '未排定';
  const day = Math.floor(value / 1440);
  const minute = value % 1440;
  return (day ? '次日 ' : '') + String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
}
function minutes(value) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [hours, minute] = value.split(':').map(Number);
  return hours * 60 + minute;
}
function materialName(id) {
  return scenarios[current].materials.find(row => row[0] === id)?.[1] || generatedNames[id] || id;
}
function inputs() {
  return {
    start: minutes($('#start').value),
    deadline: minutes($('#deadline').value),
    buffer: Number($('#buffer').value),
    inventory: $$('[data-material]').filter(element => element.checked).map(element => element.dataset.material),
    sourceChecks: {...sourceChecks},
    durations: {...durations}
  };
}
function validate(options) {
  if (!Number.isFinite(options.start) || !Number.isFinite(options.deadline) || options.start >= options.deadline) {
    return '请填写有效时间；最晚回来需晚于出发时间。本版只计算同一天。';
  }
  if (!Number.isInteger(options.buffer) || options.buffer < 0 || options.buffer > 20) return '每段额外缓冲需在0至20分钟之间。';
  if (Object.values(options.durations).some(value => !Number.isInteger(value) || value < 1 || value > 240)) {
    return '每项办理耗时请填写1至240之间的整数分钟。';
  }
  return '';
}

// A blocked step never produces a credential or a fictional service time.
function plan(sequence, options) {
  const scenario = scenarios[current];
  const stock = new Set(options.inventory);
  const steps = [];
  const reasons = [];
  let now = options.start;
  let place = 'H';
  let stoppedBy = '';
  let completed = 0;
  for (const id of sequence) {
    const task = scenario.tasks.find(item => item.id === id);
    const missing = task.requires.filter(item => !stock.has(item));
    if (stoppedBy) {
      const message = '前置步骤“' + stoppedBy + '”未完成，后续不排定时间';
      steps.push({id, name: task.name, status: 'not_scheduled', arrival: null, start: null, finish: null, blockers: [message], wait: 0});
      continue;
    }
    if (missing.length) {
      const message = '缺少' + missing.map(materialName).join('、');
      reasons.push(task.name + '：' + message);
      steps.push({id, name: task.name, status: 'blocked', arrival: null, start: null, finish: null, blockers: [message], wait: 0});
      stoppedBy = task.name;
      continue;
    }
    const travel = scenario.travel[place + id] + options.buffer;
    const arrival = now + travel;
    const start = Math.max(arrival, task.open);
    const finish = start + options.durations[id];
    if (finish > task.close) {
      const message = '最早约' + time(finish) + '完成，晚于' + time(task.close) + '结束时间';
      reasons.push(task.name + '：' + message);
      steps.push({id, name: task.name, status: 'blocked', arrival, start: null, finish: null, earliestFinish: finish, wait: 0, blockers: [message]});
      stoppedBy = task.name;
      continue;
    }
    stock.add(task.produces);
    steps.push({id, name: task.name, status: 'scheduled', arrival, start, finish, wait: start - arrival, travel, blockers: []});
    completed++;
    now = finish;
    place = id;
  }
  const returnAt = stoppedBy ? null : now + scenario.travel[place + 'H'] + options.buffer;
  if (returnAt !== null && returnAt > options.deadline) reasons.push('约' + time(returnAt) + '返回，超过' + time(options.deadline) + '最晚回来时间');
  const unchecked = sequence.filter(id => !options.sourceChecks[id]);
  const computedFeasible = reasons.length === 0;
  return {sequence, steps, returnAt, reasons, completed, full: sequence.length === scenario.tasks.length, computedFeasible,
    unchecked, feasible: computedFeasible && unchecked.length === 0,
    status: !computedFeasible ? 'blocked' : unchecked.length ? 'unconfirmed' : 'computed'};
}
function calculate(options) {
  return [['A', 'B'], ['B', 'A'], ['A'], ['B']].map(sequence => plan(sequence, options)).sort((a, b) =>
    Number(b.full && b.computedFeasible) - Number(a.full && a.computedFeasible) ||
    Number(b.computedFeasible) - Number(a.computedFeasible) ||
    b.completed - a.completed || (a.returnAt ?? Infinity) - (b.returnAt ?? Infinity));
}
function badge(result) {
  if (result.status === 'blocked') return '条件不满足';
  if (result.status === 'unconfirmed') return '时间算通 · 规则未确认';
  return '按演示条件可行';
}
function renderPlan(result, main = false) {
  return `<article class="plan ${main ? 'best' : ''}" data-sequence="${result.sequence.join('')}">
    <h4>${result.full ? '两项都办' : '只办一项'} <span class="pill ${result.status}">${badge(result)}</span></h4>
    <div class="route">${result.steps.map(step => `<span>${escapeHTML(step.name)}</span>`).join('<i>→</i>')}</div>
    <ol class="plan-steps">${result.steps.map(step => `<li class="${step.status}"><strong>${escapeHTML(step.name)}</strong>${step.status === 'scheduled' ?
      `<p>${time(step.start)}—${time(step.finish)} 计划办理${step.wait ? ' · 先等' + step.wait + '分钟' : ''}</p>` :
      `<p>${escapeHTML(step.blockers[0])}</p>`}</li>`).join('')}</ol>
    ${result.returnAt !== null ? `<div class="return-line">预计返回 <strong>${time(result.returnAt)}</strong></div>` : '<p class="not-scheduled">前置条件未满足，整趟返回时间不排定。</p>'}
    ${result.reasons.filter(reason => reason.includes('最晚回来')).map(reason => `<p class="plan-issue">${escapeHTML(reason)}</p>`).join('')}
    ${result.unchecked.length ? `<p class="source-pending">${result.unchecked.length}份演示规则尚未确认使用。</p>` : ''}
  </article>`;
}
function renderFacts() {
  const scenario = scenarios[current];
  $('#source-count').textContent = Object.values(sourceChecks).filter(Boolean).length + ' / 2 已确认使用';
  $('#facts').innerHTML = scenario.tasks.map(task => `<div class="fact-card">
    <strong>${escapeHTML(task.name)}</strong><p>${escapeHTML(task.place)} · ${time(task.open)}—${time(task.close)}</p>
    <p>${escapeHTML(task.rule)}</p><span class="source">虚构来源：${escapeHTML(task.source)}</span>
    <label class="toggle source-check"><input type="checkbox" data-source="${task.id}" ${sourceChecks[task.id] ? 'checked' : ''}>已阅读，确认使用这条演示规则</label>
    <label class="duration-label" for="duration-${task.id}">办理耗时估计 / 分钟<input id="duration-${task.id}" data-duration="${task.id}" type="number" min="1" max="240" step="1" value="${durations[task.id]}"></label>
  </div>`).join('');
  $$('[data-source]').forEach(element => element.onchange = () => {
    sourceChecks[element.dataset.source] = element.checked;
    clearSimulation(); render();
  });
  $$('[data-duration]').forEach(element => element.oninput = () => {
    durations[element.dataset.duration] = Number(element.value);
    clearSimulation(); render(false);
  });
  syncVerified();
}
function syncVerified() {
  const count = Object.values(sourceChecks).filter(Boolean).length;
  $('#verified').checked = count === 2;
  $('#verified').indeterminate = count === 1;
}
function render(refreshFacts = true) {
  const actual = inputs();
  const options = simulation ? {...simulation, sourceChecks: {...sourceChecks}, durations: {...durations}} : actual;
  const error = validate(options);
  dataValid = !error;
  $('#buffer-label').textContent = '每段路多留 ' + actual.buffer + ' 分钟';
  $('#export').disabled = $('#fix').disabled = !dataValid;
  if (refreshFacts) renderFacts();
  $('#evaluation-mode').hidden = !simulation;
  if (simulation) $('#evaluation-mode').innerHTML = `<div class="simulation-active"><b>正在看假设结果</b><p>${suggestion.changes.map(escapeHTML).join('；')}。左侧“已有材料”与原出发时间没有改变。</p><button class="btn secondary" id="undo-simulation">← 回到当前条件</button></div>`;
  if (simulation) $('#undo-simulation').onclick = () => {clearSimulation(); render(); toast('已退出假设，恢复当前条件的结果。');};
  if (error) {
    results = [];
    $('#status').innerHTML = `<div class="hint warning"><strong>先补全有效条件</strong><p>${escapeHTML(error)}</p></div>`;
    $('#blockers').innerHTML = '';
    $('#plans').innerHTML = '<p class="empty">条件有效后，在这里比较方案。</p>';
    renderSuggestion();
    return;
  }
  results = calculate(options);
  const complete = results.find(result => result.full && result.computedFeasible);
  const partial = results.find(result => !result.full && result.computedFeasible);
  const route = results.find(result => result.sequence.join('') === 'AB');
  let title, detail, good = false;
  if (complete) {
    good = complete.feasible;
    title = complete.feasible ? '两项按演示条件可行' : '时间排得开，规则还未确认';
    detail = (simulation ? '假设材料准备好后，' : '') + '按 ' + complete.sequence.join(' → ') + ' 办理，预计 ' + time(complete.returnAt) + ' 返回。' +
      (complete.feasible ? '这只是虚构资料下的计算，不是现实办理保证。' : '先确认是否使用这些演示规则；不代表真实机构的办理条件。');
  } else if (partial) {
    title = '整趟未满足条件，只能排出部分事项';
    detail = '有单项的时间安排，但不能算两件事都办成。先解决下面的缺口。';
  } else {
    title = '当前条件下，两项安排排不通';
    detail = '先解决前置条件，后续步骤才会产生有效时间。';
  }
  $('#status').innerHTML = `<div class="trip-status ${good ? 'is-good' : 'is-pending'}"><span>${simulation ? '假设计算' : '当前条件'}</span><h2>${title}</h2><p>${detail}</p></div>`;
  const blockers = route.reasons.map(reason => `<div class="blocker"><span>!</span><p>${escapeHTML(reason)}</p></div>`);
  if (!complete && route.steps.some(step => step.status === 'not_scheduled')) blockers.push('<p class="micro dependency-note">后续凭证依赖上一项成功办理；没有产出，就不继续编排后续时间。</p>');
  if (complete && complete.unchecked.length) blockers.push(`<div class="blocker source-blocker"><span>?</span><p>还有${complete.unchecked.length}份演示规则未确认。展开下方来源，逐项查看要求和办理耗时。</p></div>`);
  if (complete && !complete.unchecked.length) blockers.push('<div class="condition-passed">✓ 材料依赖、营业时间、路途缓冲和返回时限均通过本次示例计算。</div>');
  $('#blockers').innerHTML = blockers.join('');
  const primary = complete || route;
  const alternatives = results.filter(result => result !== primary);
  $('#plans').innerHTML = renderPlan(primary, true) + `<details class="alternatives"><summary>比较另外 ${alternatives.length} 个方案</summary>${alternatives.map(result => renderPlan(result)).join('')}</details>`;
  renderSuggestion();
}
function clearSimulation() {
  suggestion = null;
  simulation = null;
}
function renderSuggestion() {
  const panel = $('#simulation-preview');
  panel.hidden = !suggestion || !!simulation;
  if (panel.hidden) return;
  panel.innerHTML = `<div class="what-if"><span class="pill">假设预览 · 尚未修改结果</span><h4>${suggestion.possible ? (suggestion.changes.length ? '可以试算这组调整' : '材料和时间无需调整') : '这次仍找不到完整安排'}</h4>
    <ul>${suggestion.changes.map(change => `<li>${escapeHTML(change)}</li>`).join('') || '<li>当前材料和时间已满足示例计算。</li>'}</ul>
    <p>${suggestion.possible ? '规则确认状态保持不变；假设不是已经拿到材料。' : '即使补齐材料，按5分钟步长提前出发也无法在给定时限内完成。请调整回来时间或拆成两趟。'}</p>
    ${suggestion.possible && suggestion.changes.length ? '<button class="btn secondary full" id="apply-simulation">只看这组假设的结果</button>' : ''}
    <button class="btn ghost full" id="dismiss-simulation">收起预览</button></div>`;
  if ($('#apply-simulation')) $('#apply-simulation').onclick = () => {
    simulation = {...suggestion.conditions, inventory: [...suggestion.conditions.inventory]};
    render();
    toast('已切到假设结果。手边材料和原出发时间没有改动。');
  };
  $('#dismiss-simulation').onclick = () => {suggestion = null; renderSuggestion();};
}
function makeSuggestion() {
  const actual = inputs();
  const scenario = scenarios[current];
  const inventory = [...new Set([...actual.inventory, ...scenario.materials.map(row => row[0])])];
  const added = inventory.filter(id => !actual.inventory.includes(id));
  let options = {...actual, inventory};
  let found = calculate(options).find(result => result.full && result.computedFeasible);
  if (!found) {
    for (let start = actual.start - 5; start >= 0; start -= 5) {
      const candidate = {...options, start};
      const result = calculate(candidate).find(item => item.full && item.computedFeasible);
      if (result) { options = candidate; found = result; break; }
    }
  }
  const changes = [];
  if (added.length) changes.push('假设备齐：' + added.map(materialName).join('、'));
  if (found && options.start !== actual.start) changes.push('出发时间试改为 ' + time(options.start) + '（原 ' + time(actual.start) + '）');
  suggestion = {possible: !!found, conditions: options, added, changes};
  simulation = null;
  render();
  $('#simulation-preview').scrollIntoView({block: 'nearest', behavior: 'smooth'});
}
function load() {
  const scenario = scenarios[current];
  sourceChecks = {A: false, B: false};
  durations = Object.fromEntries(scenario.tasks.map(task => [task.id, task.duration]));
  clearSimulation();
  $('#materials').innerHTML = scenario.materials.map(([id, label, checked]) => `<label class="check-item"><input type="checkbox" data-material="${id}" ${checked ? 'checked' : ''}>${escapeHTML(label)}</label>`).join('');
  $('#start').value = '15:30';
  $('#deadline').value = '17:00';
  $('#buffer').value = '0';
  $$('[data-material]').forEach(element => element.onchange = () => {clearSimulation(); render();});
  render();
}

$('#scenario').onchange = () => {current = $('#scenario').value; load();};
['#start', '#deadline', '#buffer'].forEach(selector => $(selector).oninput = () => {clearSimulation(); render();});
$('#verified').onchange = () => {
  sourceChecks = {A: $('#verified').checked, B: $('#verified').checked};
  clearSimulation(); render();
};
$('#reset').onclick = load;
$('#fix').onclick = () => {if (dataValid) makeSuggestion();};
$('#export').onclick = () => {
  if (!dataValid) return;
  download('少跑一趟-出发前核对.json', JSON.stringify({
    version: 2,
    scenario: $('#scenario').selectedOptions[0].text,
    mode: simulation ? 'what-if' : 'current',
    actualConditions: inputs(),
    evaluatedConditions: simulation ? {...simulation, sourceChecks: {...sourceChecks}, durations: {...durations}} : inputs(),
    simulatedChanges: simulation ? suggestion.changes : [],
    plans: results,
    notice: '全部来源、地点与规则均为虚构。规则勾选仅表示在演示中确认使用；假设材料不代表实际持有。计算不包含实时交通、排队、节假日或跨日。'
  }, null, 2), 'application/json');
};
load();
