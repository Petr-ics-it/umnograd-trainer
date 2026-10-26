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
// Countdown is tied to the original start and is unaffected by long inactivity or reload.
const epoch=Date.parse('2026-01-01T10:00:00Z');
data=E.fresh();E.start(data,epoch);E.select(data,0,epoch+1000);E.advance(data,epoch+2000);assert.equal(E.remaining(data,epoch+300000),E.TIME_LIMIT-300000);
const timedReload=E.restore(JSON.parse(JSON.stringify(data)),epoch+17*60000);assert(timedReload.active);assert.equal(timedReload.active.startedAt,new Date(epoch).toISOString());assert.equal(E.remaining(timedReload,epoch+17*60000),13*60000);assert(E.select(timedReload,0,epoch+17*60000));
// At exactly 30 minutes, grade submitted answers plus the current selected answer; blanks earn nothing.
data=E.fresh();E.start(data,epoch);for(let i=0;i<5;i++){E.select(data,i===2?1:0,epoch+1000*(i+1));E.advance(data,epoch+1000*(i+1))}E.select(data,0,epoch+10000);
assert.equal(E.remaining(data,epoch+E.TIME_LIMIT-1),1);assert.equal(E.timeout(data,epoch+E.TIME_LIMIT-1),null);assert.equal(E.select(data,1,epoch+E.TIME_LIMIT),false);
const atDeadline=E.advance(data,epoch+E.TIME_LIMIT);assert(atDeadline.done);assert(atDeadline.result.timedOut);assert.equal(atDeadline.result.correct,5);assert.equal(atDeadline.result.answered,6);assert.equal(atDeadline.result.unanswered,9);assert.equal(atDeadline.result.score,1);assert.equal(atDeadline.result.durationMs,E.TIME_LIMIT);assert.equal(atDeadline.result.completedAt,new Date(epoch+E.TIME_LIMIT).toISOString());assert.equal(E.timeout(data,epoch+E.TIME_LIMIT+1),null);assert.equal(data.results.length,1);
// Returning hours later finalizes once, records exactly 30:00 and survives another reload.
data=E.fresh();E.start(data,epoch);E.select(data,0,epoch+1000);const late=E.restore(JSON.parse(JSON.stringify(data)),epoch+10*E.TIME_LIMIT);assert.equal(late.active,null);assert.equal(late.results.length,1);assert.equal(late.results[0].durationMs,E.TIME_LIMIT);assert.equal(late.results[0].correct,1);assert.equal(E.restore(JSON.parse(JSON.stringify(late)),epoch+11*E.TIME_LIMIT).results.length,1);
data=E.fresh();E.start(data,epoch);const empty=E.timeout(data,epoch+E.TIME_LIMIT);assert.equal(empty.correct,0);assert.equal(empty.unanswered,15);assert.equal(empty.score,0);
// A fully selected final answer is counted even if the final button was not clicked before expiry.
data=E.fresh();E.start(data,epoch);for(let i=0;i<14;i++){E.select(data,0,epoch+1000*i);E.advance(data,epoch+1000*i)}E.select(data,0,epoch+20000);assert.equal(E.timeout(data,epoch+E.TIME_LIMIT).score,5);assert.equal(E.records(data).length,1);
// Only timed five-point results within the limit enter records; fastest comes first.
function timedRun(data,correct,duration,start){E.start(data,start);for(let i=0;i<15;i++){const at=start+Math.floor(duration*(i+1)/15);assert(E.select(data,i<correct?0:1,at));const next=E.advance(data,at);if(i===14)return next.result}}
data=E.fresh();const slow=timedRun(data,15,180000,epoch),lower=timedRun(data,14,60000,epoch+300000),fast=timedRun(data,15,120000,epoch+600000);assert.equal(slow.durationMs,180000);assert.equal(fast.durationMs,120000);assert.equal(E.records(data).length,2);assert.equal(E.records(data)[0].id,fast.id);assert(!E.records(data).some(r=>r.id===lower.id));
data.results.push({...slow,id:'old-long-result',durationMs:E.TIME_LIMIT+1000});assert.equal(E.records(data).length,2);
const oldResult={id:'legacy',correct:15,total:15,score:5,startedAt:new Date(epoch).toISOString(),completedAt:new Date(epoch+1000).toISOString()};const old=E.restore({version:1,active:null,results:[oldResult]},epoch+2000);assert.equal(old.results.length,1);assert.equal(old.results[0].durationMs,null);assert.equal(E.records(old).length,0);
const previous=E.fresh();E.start(previous,epoch);previous.active.timingVersion=1;previous.active.expired=true;previous.active.lastActivityAt=new Date(epoch).toISOString();const migrated=E.restore(previous,epoch+17*60000);assert(migrated.active);assert.equal(migrated.active.expired,undefined);assert.equal(E.remaining(migrated,epoch+17*60000),13*60000);
// Inspect real question/result templates: selection never reveals correctness or a running score.
context.localStorage={getItem:()=>null,setItem(){}};context.document={addEventListener(){}};context.window={addEventListener(){}};
vm.runInContext(scripts.at(-1).replace(/if\(chosenSide\)\{applySide\(chosenSide\);home\(\)\}else\{sideChoice\(\)\}/,'')+`\nglobalThis.testExamMarkup=(selected)=>{examState=Exam.fresh();Exam.start(examState);if(selected!==null)Exam.select(examState,selected);let output='';shell=html=>output=html;examQuestion();return output};globalThis.testResultMarkup=()=>{let output='';shell=html=>output=html;examResult({score:4,correct:14,total:15});return output};globalThis.testInvitation=(done)=>{state=Trainer.fresh();if(done)BANK.forEach(c=>Trainer.progress(state,c.id).streak=5);state.scope='all';let output='';shell=html=>output=html;completed();return output};`,context);
for(const selection of [null,0,1,2,3]){const markup=context.testExamMarkup(selection);for(const hint of ['feedback','answer.correct','answer wrong','class="answer-concept"','data-star-id=','device-drawing','Верно.','Разберём','exam-result-score','exam-result-star'])assert(!markup.includes(hint),hint);assert.equal((markup.match(/data-exam-answer=/g)||[]).length,4);if(selection!==null)assert.equal((markup.match(/aria-pressed="true"/g)||[]).length,1);else assert(markup.includes('id="exam-next" disabled'))}
assert(context.testResultMarkup().includes('14 из 15'));assert(context.testResultMarkup().includes('4</b>'));assert(!context.testResultMarkup().includes('data-exam-answer='));assert(context.testInvitation(true).includes('Пройти тест'));assert(!context.testInvitation(false).includes('Пройти тест'));
context.clearInterval=()=>{};context.window.scrollTo=()=>{};
vm.runInContext(`globalThis.timeoutExamMarkup=()=>{examState=Exam.fresh();Exam.start(examState,Date.now()-Exam.TIME_LIMIT-1000);examState.active.items[0].selected=0;let output='';shell=html=>output=html;examQuestion();return output};globalThis.timedResultMarkup=()=>{examState=Exam.fresh();const r={id:'timed',correct:15,total:15,score:5,timed:true,durationMs:165000,startedAt:'2026-01-01T10:00:00Z',completedAt:'2026-01-01T10:02:45Z'};examState.results.push(r);let output='';shell=html=>output=html;examResult(r);return output};`,context);
const timeoutUI=context.timeoutExamMarkup();assert(timeoutUI.includes('30 минут истекли'));assert(timeoutUI.includes('30:00'));assert(timeoutUI.includes('Без ответа: 14'));assert(!timeoutUI.includes('data-exam-answer='));assert(context.timedResultMarkup().includes('2:45'));assert(context.timedResultMarkup().includes('Лучшее время на 5 баллов'));
assert(!html.includes('IDLE_LIMIT'));assert(!html.includes('15 минут без ответов'));assert(!html.includes('exam-resume-idle'));
console.log('PASS: 15 distinct concepts, all six sections, all 16 score outcomes, no early scores or answer feedback, 30-minute deadline, late-return auto-grading, unanswered questions, five-point records, legacy migration, separate learning state and completion invitation.');
