const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);scripts.forEach(s=>new vm.Script(s));
let seed=39817;const randomMath=Object.create(Math);randomMath.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const context=vm.createContext({Math:randomMath,Date});
vm.runInContext(['const BANK =','const Trainer =','const Exam ='].map(key=>scripts.find(s=>s.includes(key))).join('\n')+'\nglobalThis.E=Exam;globalThis.T=Trainer;globalThis.B=BANK;',context);
const {E,T,B}=context;
for(let round=0;round<30;round++){
 const data=E.fresh();E.start(data);assert.equal(data.active.items.length,15);assert.equal(new Set(data.active.items.map(q=>q.id)).size,15);
 const groups={};for(const q of data.active.items){groups[B.find(c=>c.id===q.id).group]=(groups[B.find(c=>c.id===q.id).group]||0)+1;assert(q.variant>=0&&q.variant<5);assert.equal(new Set(q.order).size,4);assert.equal(q.selected,null)}assert.equal(Object.keys(groups).length,6);assert(Object.values(groups).every(n=>n===2||n===3));assert.equal(Object.values(groups).filter(n=>n===3).length,3);
}
// Every attainable correct-answer count maps to floor(correct / 3), with no early result.
for(let correct=0;correct<=15;correct++){
 const data=E.fresh();E.start(data);assert.equal(E.advance(data),null);assert.equal(data.active.index,0);assert.equal(E.select(data,-1),false);assert.equal(E.select(data,4),false);
 for(let i=0;i<15;i++){assert(E.select(data,i<correct?0:1));const step=E.advance(data);if(i<14){assert.equal(step.done,false);assert.equal(step.result,undefined);assert.equal(data.results.length,0)}else{assert.equal(step.done,true);assert.equal(step.result.correct,correct);assert.equal(step.result.score,Math.floor(correct/3));assert.equal(step.result.total,15)}}
 assert.equal(data.active,null);assert.equal(data.results.length,1);assert.equal(E.advance(data),null);assert.equal(E.select(data,0),false);
}
// Answers can change before submission; reload preserves exact questions, choices and position.
let data=E.fresh();E.start(data);E.select(data,0);E.select(data,2);E.advance(data);E.select(data,3);
const restored=E.restore(JSON.parse(JSON.stringify(data)));assert.equal(JSON.stringify(restored),JSON.stringify(data));
const invalid=JSON.parse(JSON.stringify(data));invalid.active.items[0].order=[0,0,2,3];assert.equal(E.restore(invalid).active,null);assert.equal(E.restore(null).active,null);
const learning=T.fresh(),learningBefore=JSON.stringify(learning);E.start(data);for(let i=0;i<15;i++){E.select(data,0);E.advance(data)}assert.equal(JSON.stringify(learning),learningBefore);E.start(data);assert.equal(data.results.length,1);
// Inspect real question/result templates: selection never reveals correctness or a running score.
context.localStorage={getItem:()=>null,setItem(){}};context.document={addEventListener(){}};
vm.runInContext(scripts.at(-1).replace(/if\(chosenSide\)\{applySide\(chosenSide\);home\(\)\}else\{sideChoice\(\)\}/,'')+`\nglobalThis.testExamMarkup=(selected)=>{examState=Exam.fresh();Exam.start(examState);if(selected!==null)Exam.select(examState,selected);let output='';shell=html=>output=html;examQuestion();return output};globalThis.testResultMarkup=()=>{let output='';shell=html=>output=html;examResult({score:4,correct:14,total:15});return output};globalThis.testInvitation=(done)=>{state=Trainer.fresh();if(done)BANK.forEach(c=>Trainer.progress(state,c.id).streak=5);state.scope='all';let output='';shell=html=>output=html;completed();return output};`,context);
for(const selection of [null,0,1,2,3]){const markup=context.testExamMarkup(selection);for(const hint of ['feedback','answer.correct','answer wrong','class="answer-concept"','data-star-id=','device-drawing','Верно.','Разберём','exam-result-score','exam-result-star'])assert(!markup.includes(hint),hint);assert.equal((markup.match(/data-exam-answer=/g)||[]).length,4);if(selection!==null)assert.equal((markup.match(/aria-pressed="true"/g)||[]).length,1);else assert(markup.includes('id="exam-next" disabled'))}
assert(context.testResultMarkup().includes('14 из 15'));assert(context.testResultMarkup().includes('4</b>'));assert(!context.testResultMarkup().includes('data-exam-answer='));assert(context.testInvitation(true).includes('Пройти тест'));assert(!context.testInvitation(false).includes('Пройти тест'));
console.log('PASS: 15 distinct concepts, all six sections, all 16 score outcomes, no early scores or answer feedback, resume/restart, separate learning state and completion invitation.');
