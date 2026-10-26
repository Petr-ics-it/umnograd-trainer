const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const script of scripts)new vm.Script(script);
const context=vm.createContext({Math,Date});
vm.runInContext(scripts.find(s=>s.includes('const BANK ='))+'\n'+scripts.find(s=>s.includes('const Trainer ='))+'\nglobalThis.T=Trainer;globalThis.B=BANK;',context);
const {T,B}=context;
function next(s){const r=T.next(s,true);assert(r.question);return r.question}
function answer(s,id,correct){s.current={id,variant:0,order:[0,1,2,3],answered:false};return T.answer(s,correct?0:1)}
let s=T.fresh();for(let i=0;i<4;i++)answer(s,'cpu',true);
assert.equal(s.progress.cpu.streak,4);assert.equal(answer(s,'cpu',false).rayDelta,-1);assert.equal(s.progress.cpu.streak,3);
assert.equal(s.progress.cpu.errors,1);assert.equal(T.totals(s).errors,1);assert.equal(T.answer(s,0),null);
for(let i=0;i<8;i++)answer(s,'cpu',false);assert.equal(s.progress.cpu.streak,0);
for(let i=0;i<5;i++)answer(s,'ram',true);answer(s,'cpu',false);assert.equal(s.progress.ram.streak,5);
// One focal concept gets every other question; the first star is attainable in nine answers.
s=T.fresh();const seen=[];for(let i=0;i<9;i++){seen.push(next(s).id);T.answer(s,0)}
assert.equal(seen.filter(id=>id==='cpu').length,5);assert(seen.every((id,i)=>i%2===0?id==='cpu':id!=='cpu'));assert.equal(new Set(seen.filter(id=>id!=='cpu')).size,4);assert.equal(T.totals(s).mastered,1);
assert.equal(s.attempts.filter(a=>a.earnedStar).length,1);assert.notEqual(next(s).id,'cpu');
// A mistake removes one ray without throwing the concept out of the focus rotation.
s=T.fresh();for(let i=0;i<8;i++){const q=next(s);T.answer(s,i===4?1:0)}assert.equal(s.focusConcept,'cpu');assert.equal(s.progress.cpu.streak,2);assert.equal(next(s).id,'cpu');
// Scoped sessions use only their own concepts, and partial progress gets priority.
s=T.fresh();s.scope='files';T.progress(s,'extension').streak=3;assert.equal(next(s).id,'extension');
for(let i=0;i<10;i++){T.answer(s,0);const r=T.next(s,true);if(r.done)break;assert.equal(B.find(c=>c.id===r.question.id).group,'files')}
// Completion, mixed success, distinct variants, saved scheduling state and legacy migration.
for(const mistakes of [false,true]){s=T.fresh();let done=false;for(let i=0;i<500;i++){const r=T.next(s,true);if(r.done){done=true;break}T.answer(s,mistakes&&i%9===4?1:0)}assert(done);assert.equal(T.totals(s).mastered,24);assert.equal(T.journey(s).percent,100);assert.equal(s.attempts.filter(a=>a.earnedStar).length,24)}
s=T.fresh();const variants=[];for(let i=0;i<9;i++){const q=next(s);if(q.id==='cpu')variants.push(q.variant);T.answer(s,0)}assert.equal(new Set(variants).size,5);
s=T.fresh();next(s);T.answer(s,0);const restored=T.upgrade(JSON.parse(JSON.stringify(s)));assert.equal(restored.focusConcept,s.focusConcept);assert.equal(restored.focusNext,s.focusNext);assert.notEqual(next(restored).id,'cpu');
const legacy={version:2,step:3,scope:'all',progress:{cpu:{streak:3,seen:3,errors:0,due:8}},attempts:[],current:null};T.upgrade(legacy);assert.equal(legacy.progress.cpu.streak,3);assert.equal(legacy.progress.cpu.due,4);assert.equal(legacy.scheduleVersion,1);
legacy.version=1;legacy.progress.cpu.streak=3;T.upgrade(legacy);assert.equal(legacy.progress.cpu.streak,5);
s=T.fresh();for(const c of B)T.progress(s,c.id).streak=5;s.progress.cpu.streak=3;s.progress.cpu.due=8;assert(T.next(s).question);assert.equal(s.step,8);
context.localStorage={getItem:()=>null,setItem(){}};context.document={addEventListener(){}};
vm.runInContext(scripts.at(-1).replace(/if\(chosenSide\)\{applySide\(chosenSide\);home\(\)\}else\{sideChoice\(\)\}/,'')+`\nstate=Trainer.fresh();Trainer.progress(state,'cpu').streak=3;Trainer.progress(state,'ram').streak=2;globalThis.mapHTML=starMap('ram');`,context);
assert.equal((context.mapHTML.match(/data-star-id=/g)||[]).length,24);assert(context.mapHTML.includes('Процессор: 3 из 5 лучей'));assert(context.mapHTML.includes('data-star-id="ram" aria-current="step"'));assert(context.mapHTML.includes('Оперативная память · 2/5'));
console.log('PASS: one-ray penalty, zero floor, completed stars, 50/50 focus, first star at answer 9, topic scope, mixed-answer completion, variants and saved-state migration.');
