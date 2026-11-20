'use strict';
const assert = require('node:assert/strict');
const V = require('./evidence.js');
const base = {
  id: 'old-coin-record', engine: 'counter-engine-1.0', module: 'coins',
  title: '旧版找零记录', created: '2026-11-11T08:00:00.000Z',
  params: { coins: [1, 3, 4], amount: 6 }, prediction: { minimumCoins: 3 },
  result: { greedy: { count: 999 }, optimal: { count: 999 } }
};
let n = 0;
function test(name, fn) { fn(); n++; console.log('PASS ' + name); }
test('旧版单份证据兼容，结果按参数重算', () => {
  const r = V.prepareImport(base)[0];
  assert.equal(r.result.greedy.count, 3);
  assert.equal(r.result.optimal.count, 2);
  assert.equal(r.learning.revision, '');
});
test('最多20份备份全部重算，保留预测和理解记录', () => {
  const r = V.prepareImport({ engine: base.engine, records: Array.from({ length: 20 }, (_, i) => ({
    ...base, id: 'r' + i, learning: { revision: '只验证了有限金额，不能推广到所有金额。', nextTest: '改成1、2、4再搜索。' }
  })) });
  assert.equal(r.length, 20);
  assert.equal(r[19].learning.nextTest, '改成1、2、4再搜索。');
  assert.equal(r[19].prediction.minimumCoins, 3);
});
test('混合坏记录整批拒绝且不修改输入', () => {
  const input = { engine: base.engine, records: [base, { ...base, params: { coins: [3,4], amount: 6 } }] };
  const before = JSON.stringify(input);
  assert.throws(() => V.prepareImport(input), /第 2 份/);
  assert.equal(JSON.stringify(input), before);
});
test('拒绝版本、空备份、超限备份、矛盾模式与非法初值', () => {
  assert.throws(() => V.prepareImport({ ...base, engine: 'other' }), /版本/);
  assert.throws(() => V.prepareImport({ engine: base.engine, records: [] }));
  assert.throws(() => V.prepareImport({ engine: base.engine, records: Array(21).fill(base) }));
  assert.throws(() => V.prepareImport({ ...base, params: { coins: [1], amount: 6, upper: 10 } }));
  assert.throws(() => V.prepareImport({ ...base, module: 'threads', params: { initialX: 7, locked: false }, prediction: { outcomes: 'has1' } }));
});
test('路径与两种并发记录均使用真实引擎重算', () => {
  const path = V.prepareImport({ ...base, module:'paths', params:{a:1,b:10,c:4}, prediction:{shortestDistance:11} })[0];
  assert.equal(path.result.greedy.weight,11); assert.equal(path.result.optimal.weight,4);
  const threads = V.prepareImport({ ...base, module:'threads', params:{locked:false,initialX:0,schedule:['AR','BR','AW','BW']}, prediction:{finalX:2} })[0];
  assert.equal(threads.result.x,1);
  const enumeration = V.prepareImport({ ...base, module:'threads', params:{locked:true,initialX:0}, prediction:{outcomes:'all2'} })[0];
  assert.equal(enumeration.result.total,2); assert.equal(enumeration.result.counts[2],2);
});
test('两类有限域搜索也能从旧备份重算', () => {
  const coin = V.prepareImport({...base,params:{coins:[1,3,4],upper:30},prediction:{findsCounterexample:true}})[0];
  assert.equal(coin.result.witness.amount,6); assert.equal(coin.result.checked,6);
  const path = V.prepareImport({...base,module:'paths',params:{bound:12},prediction:{findsCounterexample:true}})[0];
  assert.deepEqual([path.result.witness.a,path.result.witness.b,path.result.witness.c],[1,2,2]);
  assert.equal(path.result.checked,14);
});
test('拒绝数字伪装、继承属性模块名与超长理解记录', () => {
  assert.throws(() => V.prepareImport({...base,params:{coins:[1,3,4],amount:true}}));
  assert.throws(() => V.prepareImport({...base,params:{coins:['1',3,4],amount:6}}));
  assert.throws(() => V.prepareImport({...base,module:'constructor'}));
  assert.throws(() => V.prepareImport({...base,learning:{revision:'a'.repeat(1201)}}));
});
test('报告包含计算结果、个人修正与边界，并转义文字', () => {
  const html = V.reportHTML({ ...base, learning:{revision:'<script>错误</script>',nextTest:'扩大金额范围。'} });
  assert.ok(html.includes('贪心 3 枚 / 最优 2 枚'));
  assert.ok(html.includes('&lt;script&gt;错误&lt;/script&gt;'));
  assert.ok(html.includes('未自动评分'));
  assert.ok(!html.includes('<script>错误</script>'));
});
console.log('Completed ' + n + ' evidence groups.');
