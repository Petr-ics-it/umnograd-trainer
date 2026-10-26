const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const script of scripts)new vm.Script(script);
let seed=712683;const randomMath=Object.create(Math);randomMath.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(const removed of ['magicEnergy','celebrateEnergy','energy-celebration','magic-energy','energized'])assert(!html.includes(removed),removed+' must be removed');
const context=vm.createContext({Math:randomMath,Date});
vm.runInContext(scripts.find(s=>s.includes('const BANK ='))+'\n'+scripts.find(s=>s.includes('const Trainer ='))+'\n'+scripts.find(s=>s.includes('const Exam ='))+'\nglobalThis.T=Trainer;globalThis.B=BANK;',context);
const {T,B}=context,group=id=>B.find(c=>c.id===id).group;
function next(s){const r=T.next(s,true);assert(r.question);return r.question}
function answer(s,id,correct){s.current={id,variant:0,order:[0,1,2,3],answered:false};return T.answer(s,correct?0:1)}
let s=T.fresh();for(let i=0;i<4;i++)answer(s,'cpu',true);
assert.equal(s.progress.cpu.streak,4);assert.equal(answer(s,'cpu',false).rayDelta,-1);assert.equal(s.progress.cpu.streak,3);assert.equal(T.answer(s,0),null);
for(let i=0;i<8;i++)answer(s,'cpu',false);assert.equal(s.progress.cpu.streak,0);
for(let i=0;i<5;i++)answer(s,'ram',true);answer(s,'cpu',false);assert.equal(s.progress.ram.streak,5);
// A chapter title is awarded only on the final missing star, and is derived for old saves.
s=T.fresh();let chapterAwards=0;
for(const c of B.filter(c=>c.group==='hardware'))for(let i=0;i<5;i++){const a=answer(s,c.id,true);if(a.earnedChapter){chapterAwards++;assert.equal(a.earnedChapter,'hardware');assert.equal(c.id,'io');assert.equal(i,4)}}
assert.equal(chapterAwards,1);assert(T.chapterMastered(s,'hardware'));assert(!T.chapterMastered(s,'software'));assert(!T.chapterMastered(s,'missing'));assert.equal(T.answer(s,0),null);
assert(T.chapterMastered(T.upgrade(JSON.parse(JSON.stringify(s))),'hardware'));
// Exact half-focus mixes are shuffled, and cover multiple concepts in an entire section.
s=T.fresh();let focus;const ids=[],groups=[];
for(let block=0;block<20;block++){let focused=0;for(let i=0;i<20;i++){const q=next(s);focus??=s.focusGroup;assert.equal(s.focusGroup,focus);ids.push(q.id);groups.push(group(q.id));if(group(q.id)===focus)focused++;T.answer(s,1)}assert.equal(focused,10)}
assert.equal(new Set(ids.filter(id=>group(id)===focus)).size,4);assert.equal(new Set(groups).size,6);
assert(groups.some((g,i)=>i&&g===focus&&groups[i-1]===focus));
assert(groups.some((g,i)=>i&&g!==focus&&groups[i-1]!==focus));
// Restricting practice to one manually selected section never asks outside it.
s=T.fresh();s.scope='files';for(let i=0;i<25;i++){const r=T.next(s,true);if(r.done)break;assert.equal(group(r.question.id),'files');T.answer(s,0)}
// Both perfect and mixed-error runs finish; mastered concepts are never asked again.
for(const mistakes of [false,true]){s=T.fresh();let done=false;for(let i=0;i<500;i++){const r=T.next(s,true);if(r.done){done=true;break}assert(T.progress(s,r.question.id).streak<5);T.answer(s,mistakes&&i%9===4?1:0)}assert(done);assert.equal(T.totals(s).mastered,24);assert.equal(T.journey(s).percent,100);assert.equal(s.attempts.filter(a=>a.earnedStar).length,24);assert.equal(s.attempts.filter(a=>a.earnedChapter).length,6);assert.equal(new Set(s.attempts.filter(a=>a.earnedChapter).map(a=>a.earnedChapter)).size,6);if(!mistakes)for(const c of B)assert.equal(new Set(s.attempts.filter(a=>a.id===c.id).map(a=>a.variant)).size,5)}
// Scheduling survives a reload, and the previous concept scheduler migrates without losing rays.
s=T.fresh();next(s);T.answer(s,0);const restored=T.upgrade(JSON.parse(JSON.stringify(s)));assert.equal(restored.focusGroup,s.focusGroup);assert.equal(JSON.stringify(restored.topicMix),JSON.stringify(s.topicMix));
const legacy={version:2,scheduleVersion:1,focusConcept:'cpu',focusNext:true,step:3,scope:'all',progress:{cpu:{streak:3,seen:3,errors:0,due:8}},attempts:[],current:null};T.upgrade(legacy);assert.equal(legacy.progress.cpu.streak,3);assert.equal(legacy.progress.cpu.due,4);assert.equal(legacy.scheduleVersion,2);assert.equal(legacy.focusConcept,undefined);assert.equal(legacy.focusGroup,null);
legacy.version=1;legacy.progress.cpu.streak=3;T.upgrade(legacy);assert.equal(legacy.progress.cpu.streak,5);
s=T.fresh();for(const c of B)T.progress(s,c.id).streak=5;s.progress.cpu.streak=3;s.progress.cpu.due=8;assert(T.next(s).question);assert.equal(s.step,8);
// The DOM before answering must not identify a concept, its ray count or a star position.
context.localStorage={getItem:()=>null,setItem(){}};context.document={addEventListener(){}};
vm.runInContext(scripts.at(-1).replace(/if\(chosenSide\)\{applySide\(chosenSide\);home\(\)\}else\{sideChoice\(\)\}/,'')+`\nglobalThis.renderQuestion=(id,answered)=>{state=Trainer.fresh();state.current={id,variant:0,order:[0,1,2,3],answered,selected:answered?0:null};let output='';shell=html=>output=html;quiz();return output};globalThis.neutralMap=()=>starMap();`,context);
for(const c of B){const before=context.renderQuestion(c.id,false),after=context.renderQuestion(c.id,true);for(const leak of ['data-star-id=','concept-label','class="answer-concept"','ray-progress','aria-current="step"','class="device-drawing"'])assert(!before.includes(leak),c.id+' leaks '+leak);assert.equal((after.match(/data-star-id=/g)||[]).length,24);assert(after.includes('class="answer-concept"'));assert(after.includes('data-star-id="'+c.id+'" aria-current="step"'))}
vm.runInContext(`globalThis.renderCourse=(complete)=>{state=Trainer.fresh();for(const c of BANK.filter(c=>c.group==='hardware'))Trainer.progress(state,c.id).streak=complete?5:4;let output='';shell=html=>output=html;home();return output};`,context);
assert(context.renderCourse(true).includes('Грандмастер механизмов'));assert(context.renderCourse(true).includes('chapter-mastered'));assert(!context.renderCourse(false).includes('Грандмастер механизмов'));assert(!context.renderCourse(true).includes('Капитан программ'));
const neutral=context.neutralMap();assert(!neutral.includes('aria-current="step"'));assert(!neutral.includes('undefined'));
// The title dialog continues directly into a question, including after a separately selected chapter.
context.clearInterval=()=>{};context.window={scrollTo(){}};
vm.runInContext(`globalThis.titleFlow=(allDone)=>{state=Trainer.fresh();for(const c of BANK.filter(c=>allDone||c.group==='hardware'))Trainer.progress(state,c.id).streak=5;state.scope='hardware';closeChapterReward=()=>{};save=()=>{};quiz=()=>{};completed=()=>{};continueChapter();return {scope:state.scope,page,question:state.current}};`,context);
const continued=context.titleFlow(false);assert.equal(continued.scope,'all');assert.equal(continued.page,'quiz');assert(continued.question);assert.notEqual(group(continued.question.id),'hardware');
const finished=context.titleFlow(true);assert.equal(finished.page,'done');assert.equal(finished.question,null);
console.log('PASS: shuffled 50/50 section mixing, coverage of all four focal concepts, one-ray penalty, mastery, chapter titles, saved-state migration, no concept/star hints before answering.');
