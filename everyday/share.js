'use strict';

const samples = {
  parcel: '快递一直没送到，想问问怎么处理。\n收件人：林小夏\n电话：13800001234\n地址：示例市春风路18号2栋301室\n取件码：6-2801\n订单号：DEMO20261111001',
  event: '请问活动报名成功了吗？\n姓名：周小禾\n手机：+86 139 0000 5678\n邮箱：demo@example.com\n证件号：110101199001010000\n活动：周末读书会',
  repair: '这台电脑想预约上门维修。\n联系人：陈小树\n电话：137-0000-9876\n地址：示例市青年路25号508室\n工单号：FIX20261111002\n故障：屏幕闪烁，不能正常开机。'
};
const LIMIT = 6000;
let state = { text: samples.parcel, sample: 'parcel', audience: 'public', purpose: 'discuss', manuals: [], decisions: {}, fileName: '' };
let findings = [], hiddenRanges = [], output = '', undoStack = [], lastEditAt = 0, changeLabel = '';
const snapshot = () => JSON.parse(JSON.stringify(state));
const contextKey = () => state.audience + '|' + state.purpose;
const overlaps = (a, b) => a.start < b.end && b.start < a.end;

function mutate(label, fn, coalesceText = false) {
  const now = Date.now();
  if (!coalesceText || now - lastEditAt > 800 || undoStack.at(-1)?.label !== '编辑正文') {
    undoStack.push({ state: snapshot(), label });
    if (undoStack.length > 25) undoStack.shift();
  }
  fn();
  lastEditAt = coalesceText ? now : 0;
  changeLabel = label;
  render();
}

function scanText(text) {
  // Fullwidth digits have the same UTF-16 width, so offsets still refer to the original.
  const normalized = text.replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xFF10)).replace(/＋/g, '+');
  const hits = [];
  function add(type, start, end, manual = false) {
    if (end <= start) return;
    const value = text.slice(start, end);
    if (!hits.some(h => h.type === type && h.start === start && h.end === end)) hits.push({ type, value, start, end, manual });
  }
  function match(type, regex) {
    for (const m of normalized.matchAll(regex)) add(type, m.index, m.index + m[0].length);
  }
  match('证件号', /(?<!\d)\d{17}[\dXx](?!\d)/g);
  match('手机号', /(?<![\d+])(?:\+?86[ \t\u00a0\u3000-]*)?1[3-9](?:[ \t\u00a0\u3000-]*\d){9}(?!\d)/g);
  match('邮箱', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);

  const types = { '收件人': '姓名', '姓名': '姓名', '联系人': '姓名', '收货地址': '详细地址', '地址': '详细地址', '住址': '详细地址', '取件码': '取件码', '提货码': '取件码', '订单号': '订单编号', '工单号': '订单编号', '身份证号码': '证件号', '身份证号': '证件号', '证件号码': '证件号', '证件号': '证件号', '护照号': '证件号', '联系电话': '手机号', '手机号码': '手机号', '手机号': '手机号', '手机': '手机号', '电话': '手机号', '电子邮箱': '邮箱', '邮箱': '邮箱' };
  const labels = [...normalized.matchAll(/(收货地址|身份证号码|身份证号|证件号码|证件号|护照号|联系电话|手机号码|手机号|电子邮箱|收件人|联系人|提货码|取件码|订单号|工单号|姓名|地址|住址|手机|电话|邮箱)[ \t]*[：:][ \t]*/g)];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i], type = types[label[1]], start = label.index + label[0].length;
    let end = labels[i + 1]?.index ?? text.length;
    const newline = text.indexOf('\n', start);
    if (newline !== -1) end = Math.min(end, newline);
    // An address can contain commas; cutting it there can leave a door number behind.
    if (type !== '详细地址') {
      const separator = text.slice(start, end).search(/[，,。；;\r]/);
      if (separator !== -1) end = start + separator;
    }
    while (end > start && /[ \t\r，,。；;]$/.test(text.slice(start, end))) end--;
    const value = normalized.slice(start, end).trim();
    if (!value) continue;
    if (type === '手机号') {
      const digits = value.replace(/[+ \t-]/g, '');
      if (!/^(?:86)?1[3-9]\d{9}$/.test(digits) && !/^0\d{9,12}$/.test(digits)) continue;
    }
    if (type === '邮箱' && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) continue;
    if (type === '证件号' && !/^[A-Z0-9][A-Z0-9 \t-]{4,29}$/i.test(value)) continue;
    if (type === '取件码' && !/^[A-Z0-9][A-Z0-9 -]{1,29}$/i.test(value)) continue;
    if (type === '订单编号' && !/^[A-Z0-9][A-Z0-9-]{2,59}$/i.test(value)) continue;
    add(type, start, end);
  }

  for (const value of state.manuals) {
    let start = text.indexOf(value);
    while (start !== -1) {
      add('手动标记', start, start + value.length, true);
      start = text.indexOf(value, start + 1);
    }
  }
  // Collapse automatic matches of the same type, retaining full +86 prefixes and labels.
  const automatic = hits.filter(h => !h.manual).sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const chosen = [];
  for (const h of automatic) if (!chosen.some(x => x.type === h.type && overlaps(x, h))) chosen.push(h);
  chosen.push(...hits.filter(h => h.manual));
  chosen.sort((a, b) => a.start - b.start || b.end - a.end || Number(a.manual) - Number(b.manual));
  const counts = new Map();
  for (const h of chosen) {
    // Decisions survive an edit before the same field, but never transfer to a changed value.
    const base = h.type + '|' + h.value;
    const occurrence = (counts.get(base) || 0) + 1;
    counts.set(base, occurrence);
    h.id = base + '|' + occurrence;
  }
  return chosen;
}

function suggested(f) {
  if (f.manual || f.type === '证件号') return true;
  if (state.audience === 'public') return true;
  if (state.audience === 'service' && state.purpose === 'deliver') return !['姓名', '手机号', '详细地址', '订单编号'].includes(f.type);
  if (state.audience === 'family' && state.purpose === 'collect') return !['姓名', '取件码'].includes(f.type);
  return true;
}
function decision(f) {
  if (f.manual) return true;
  const overrides = state.decisions[contextKey()] || {};
  return Object.hasOwn(overrides, f.id) ? overrides[f.id] : suggested(f);
}
function reason(f, hidden) {
  if (f.manual) return '你手动标记的词句，在每个对象下都遮盖。';
  const overrides = state.decisions[contextKey()] || {};
  if (Object.hasOwn(overrides, f.id)) return hidden ? '你在当前对象和用途下选择了遮盖。' : '你在当前对象和用途下选择了保留。';
  if (f.type === '证件号') return '这些示例用途不需要完整证件号，建议遮盖。';
  if (hidden) return '当前接收对象和用途不需要这项信息。';
  return state.purpose === 'collect' ? '代取物品可能需要；只应发给可信代取人。' : '联系或上门处理可能需要，请核对接收方。';
}

function buildOutput() {
  hiddenRanges = [];
  for (const f of findings.filter(decision)) {
    const last = hiddenRanges.at(-1);
    if (last && overlaps(last, f)) {
      last.end = Math.max(last.end, f.end);
      if (!last.types.includes(f.type)) last.types.push(f.type);
    } else hiddenRanges.push({ start: f.start, end: f.end, types: [f.type] });
  }
  let last = 0;
  output = '';
  for (const range of hiddenRanges) {
    const label = range.types.includes('手动标记') && range.types.length > 1 ? range.types.filter(t => t !== '手动标记').join(' / ') : range.types.join(' / ');
    output += state.text.slice(last, range.start) + '[' + label + '已隐藏]';
    last = range.end;
  }
  output += state.text.slice(last);
}

function outputCoverage(f) {
  const length = hiddenRanges.reduce((sum, r) => sum + Math.max(0, Math.min(r.end, f.end) - Math.max(r.start, f.start)), 0);
  return length === f.end - f.start ? 'fully_hidden' : length > 0 ? 'partially_hidden' : 'retained';
}

function render() {
  for (const [id, value] of [['raw', state.text], ['sample', state.sample], ['audience', state.audience], ['purpose', state.purpose]]) if ($('#' + id).value !== value) $('#' + id).value = value;
  findings = scanText(state.text);
  buildOutput();
  const hidden = findings.filter(decision);
  const retained = findings.filter(f => outputCoverage(f) === 'retained');
  const partial = findings.filter(f => outputCoverage(f) === 'partially_hidden');
  const covered = findings.filter(f => !decision(f) && outputCoverage(f) === 'fully_hidden');
  $('#char-count').textContent = state.text.length + ' / ' + LIMIT;
  $('#file-note').textContent = state.fileName ? state.fileName + ' · 仅在本页' : 'UTF-8 · 最多 6000 字';
  $('#policy').textContent = state.audience === 'public' ? '公开分享：保留事情经过，默认遮盖检测到的个人信息。' : state.audience === 'service' && state.purpose === 'deliver' ? '联系或上门处理：保留必要的联系与地址信息，取件码、证件号仍遮盖。' : state.audience === 'family' && state.purpose === 'collect' ? '亲友代取：保留姓名和取件码，其余检测信息默认遮盖。' : '当前用途以说明事情为主，检测到的个人信息默认遮盖。';
  const overrideCount = findings.filter(f => Object.hasOwn(state.decisions[contextKey()] || {}, f.id)).length;
  $('#context-note').textContent = overrideCount ? '当前用途有 ' + overrideCount + ' 项手动决定；切换对象后单独记，切回可恢复。' : '勾选表示遮盖。调整只属于当前对象和用途，不会带到其他对象。';
  $('#findings').innerHTML = findings.length ? findings.map((f, i) => {
    const isHidden = decision(f), otherCover = covered.includes(f), partialCover = partial.includes(f);
    return `<div class="finding ${isHidden ? 'is-hidden' : 'is-retained'}"><input id="field-${i}" type="checkbox" data-i="${i}" ${isHidden ? 'checked' : ''} ${f.manual ? 'disabled' : ''} aria-label="遮盖${escapeHTML(f.type)}${i + 1}"><div><label for="field-${i}" class="share-field-title">${escapeHTML(f.type)} <span class="tiny-tag">${isHidden ? '遮盖' : partialCover ? '部分保留' : otherCover ? '已被其他范围遮盖' : '保留'}</span></label><p class="share-field-value">${escapeHTML(f.value)}</p><p>${escapeHTML(partialCover ? '只遮盖了其中标记的片段，其余内容仍会出现在输出中；勾选可遮盖整项。' : otherCover ? '整项已包含在其他遮盖范围内；移除对应词句后可恢复。' : reason(f, isHidden))}</p></div><button class="share-link share-locate" data-locate="${i}" aria-label="在原文定位第${i + 1}项${escapeHTML(f.type)}">定位</button></div>`;
  }).join('') : '<p class="empty">未检测到已支持的字段。仍可能含个人信息，可选中文字或添加手动词句。</p>';
  $('#manual-list').innerHTML = state.manuals.map((word, i) => `<span class="share-manual-chip"><span>${escapeHTML(word)}</span><button data-remove="${i}" aria-label="移除手动词句${escapeHTML(word)}">×</button></span>`).join('');
  $('#preview').textContent = output || '放入内容后，这里会显示处理后的文本。';
  $('#preview').classList.toggle('is-empty', !state.text);
  $('#hidden-count').textContent = hidden.length;
  $('#retained-count').textContent = retained.length;
  $('#partial-count').textContent = partial.length;
  const keptSummary = retained.length ? '完整保留：' + [...new Set(retained.map(f => f.type))].join('、') + '。' : '';
  const partialSummary = partial.length ? '部分保留：' + [...new Set(partial.map(f => f.type))].join('、') + '，未遮盖片段仍在输出中。' : '';
  $('#preserved').textContent = keptSummary || partialSummary ? keptSummary + partialSummary + '请确认这些信息确实需要。' : findings.length ? '检测到的字段已遮盖。未识别的个人信息仍需你复核。' : '检测范围有限，请阅读完整预览后再导出。';
  $('#preserved').classList.toggle('has-retained', retained.length + partial.length > 0);
  $('#export').disabled = $('#receipt').disabled = !state.text.trim();
  $('#hide-all').disabled = !findings.some(f => !decision(f));
  $('#undo').disabled = !undoStack.length;
  $('#undo').title = undoStack.length ? '撤销：' + undoStack.at(-1).label : '还没有可撤销的调整';
  $('#change-note').textContent = changeLabel ? '最近操作：' + changeLabel + ' · 本页调整可撤销' : '';
  $$('[data-i]').forEach(el => el.onchange = () => {
    const i = Number(el.dataset.i), f = findings[i], checked = el.checked;
    mutate(checked ? '遮盖' + f.type : '保留' + f.type, () => { (state.decisions[contextKey()] ||= {})[f.id] = checked; });
    $('#field-' + i)?.focus({ preventScroll: true });
  });
  $$('[data-locate]').forEach(el => el.onclick = () => {
    const f = findings[Number(el.dataset.locate)];
    $('#raw').focus(); $('#raw').setSelectionRange(f.start, f.end);
    toast('已在原文中选中这项信息。');
  });
  $$('[data-remove]').forEach(el => el.onclick = () => mutate('移除手动遮盖词句', () => state.manuals.splice(Number(el.dataset.remove), 1)));
}

function addManual(value) {
  value = value.trim();
  if (!value) return toast('先选中文字，或输入想遮盖的词句。');
  if (value.length > 200) return toast('一次最多标记 200 字，请缩小选择范围。');
  if (!state.text.includes(value)) return toast('原文没有这个词句，请核对后添加。');
  if (state.manuals.includes(value)) return toast('这个词句已在手动遮盖范围内。');
  mutate('加入手动遮盖词句', () => state.manuals.push(value));
  $('#manual').value = '';
  toast('词句每次出现的位置都已遮盖，可在下方移除或撤销。');
}

$('#raw').oninput = () => mutate('编辑正文', () => { state.text = $('#raw').value; state.fileName = ''; }, true);
$('#audience').onchange = () => mutate('切换接收对象', () => state.audience = $('#audience').value);
$('#purpose').onchange = () => mutate('切换分享用途', () => state.purpose = $('#purpose').value);
$('#sample').onchange = () => mutate('切换示例', () => { state.sample = $('#sample').value; state.text = samples[state.sample]; state.manuals = []; state.decisions = {}; state.fileName = ''; });
$('#scan').onclick = () => { render(); toast('已按当前对象和用途重新检查，保留你的手动决定。'); };
$('#reset-policy').onclick = () => mutate('恢复当前用途建议', () => { delete state.decisions[contextKey()]; });
$('#hide-all').onclick = () => mutate('全部遮盖', () => { const decisions = state.decisions[contextKey()] ||= {}; for (const f of findings) if (!f.manual) decisions[f.id] = true; });
$('#add-manual').onclick = () => addManual($('#manual').value);
$('#manual').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); addManual($('#manual').value); } };
$('#mark-selection').onclick = () => addManual($('#raw').value.slice($('#raw').selectionStart, $('#raw').selectionEnd));
$('#undo').onclick = () => { const previous = undoStack.pop(); if (!previous) return; state = previous.state; changeLabel = '已撤销：' + previous.label; lastEditAt = 0; render(); };
$('#clear').onclick = () => {
  state = { text: '', sample: 'parcel', audience: 'public', purpose: 'discuss', manuals: [], decisions: {}, fileName: '' };
  undoStack = []; lastEditAt = 0; changeLabel = ''; $('#manual').value = ''; $('#text-file').value = ''; render(); $('#raw').focus(); toast('正文与本页撤销记录已清空。');
};
$('#import-file').onclick = () => $('#text-file').click();
$('#text-file').onchange = async () => {
  const file = $('#text-file').files[0];
  if (!file) return;
  try {
    if (!/\.txt$/i.test(file.name)) throw Error('请选择 .txt 文件。');
    if (file.size > 64000) throw Error('文件过大，请导入最多 6000 字的文本。');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (text.length > LIMIT) throw Error('超过 6000 字；请先缩短文本，内容不会被静默截断。');
    mutate('导入文本文件', () => { state.text = text; state.manuals = []; state.decisions = {}; state.fileName = file.name; });
    toast('已导入本页并完成检查，没有上传文件。');
  } catch (error) { toast(error instanceof TypeError ? '不是有效的 UTF-8 文本，请另存为 UTF-8 后重试。' : error.message); }
  finally { $('#text-file').value = ''; }
};
$('#export').onclick = () => { render(); download('发前检查-分享文本.txt', output); toast('已导出上方预览文本，没有发送给任何人。'); };
$('#receipt').onclick = () => download('发前检查-检查单.json', JSON.stringify({
  version: 2, audience: $('#audience').selectedOptions[0].text, purpose: $('#purpose').selectedOptions[0].text,
  fields: findings.map(f => ({ type: f.type, hidden: decision(f), outputCoverage: outputCoverage(f) })),
  hiddenRangeCount: hiddenRanges.length,
  notice: '此单不含正文、字段原值或手动词句。规则检测不保证覆盖全部个人信息。'
}, null, 2), 'application/json');
render();
