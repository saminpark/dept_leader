const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../core.js');
const {DocsClient}=require('../google-docs.js');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../seed.js'),'utf8'),sandbox);
const seed=JSON.parse(JSON.stringify(sandbox.window.FRAND_SEED));
test('14 domains, 62 task templates, 186 subtasks; no fictional completion/owner/date',()=>{
 const s=C.createState(seed);assert.equal(s.areas.length,14);const tasks=C.allTasks(s);assert.equal(tasks.length,62);assert.equal(tasks.flatMap(t=>t.subtasks).length,186);assert.ok(tasks.every(t=>t.status==='todo'&&!t.owner&&!t.due));
});
test('Korean date uses Seoul even around UTC midnight',()=>{assert.equal(C.today('Asia/Seoul',new Date('2026-10-07T16:00:00Z')),'2026-10-08');assert.equal(C.addDays('2026-12-31',1),'2027-01-01');assert.ok(!C.validDate('2026-02-30'));});
test('completed/archived tasks excluded from overdue and denominator',()=>{
 const a=C.createState(seed).areas[0];a.tasks[0].due='2026-10-01';a.tasks[1].due='2026-10-01';C.setStatus(a.tasks[1],'done');a.tasks[2].archived=true;const s=C.stats(a.tasks,'2026-10-08');assert.equal(s.total,3);assert.equal(s.done,1);assert.equal(s.overdue,1);assert.equal(s.percent,33);
});
test('task and subtask transitions',()=>{const t=C.clone(seed.areas[0].tasks[0]);C.setStatus(t,'done');assert.ok(t.subtasks.every(x=>x.done));C.setSubtask(t,t.subtasks[0].id,false);assert.equal(t.status,'doing');C.setSubtask(t,t.subtasks[0].id,true);assert.equal(t.status,'done');C.setStatus(t,'blocked');C.setSubtask(t,t.subtasks[0].id,false);assert.equal(t.status,'blocked');});
test('safe URL and doc IDs reject scripts or lookalike domains',()=>{assert.equal(C.safeUrl('javascript:alert(1)'),'');assert.equal(C.docId('https://docs.google.com.evil.test/document/d/abcdefghijklmno/edit'),'');assert.equal(C.docId('https://docs.google.com/document/d/abcdefghijklmno/edit?tab=x'),'abcdefghijklmno');});
test('import preserves state but ignores arbitrary credentials and pending API writes',()=>{const s=C.createState(seed);s.token='secret';s.pending=[{bogus:true}];s.areas[0].tasks[0].notes='memo';const a=C.validateState(s,seed);assert.equal(a.areas[0].tasks[0].notes,'memo');assert.equal(a.token,undefined);assert.deepEqual(a.pending,[]);const b=C.backup(s);assert.deepEqual(b.pending,[]);});
test('import rejects broken/missing/duplicate areas and tasks',()=>{const s=C.createState(seed);s.areas.pop();assert.throws(()=>C.validateState(s,seed));const d=C.createState(seed);d.areas[0].tasks[1].id=d.areas[0].tasks[0].id;assert.throws(()=>C.validateState(d,seed));});
test('report preserves output owner date notes blockers links and optional privacy filters',()=>{const a=C.clone(seed.areas[0]);a.notes='area memo';const t=a.tasks[0];t.owner='담당';t.due='2026-10-10';t.notes='secret note';t.blocker='need decision';t.links=[{label:'proof',url:'https://example.com/'}];C.setStatus(a.tasks[1],'done');const r=C.buildReport(a,{date:'2026-10-08',requestId:'test1'});assert.equal(r.title,'[사업 전략·우선순위] 2026-10-08');assert.ok(r.text.includes('secret note'));assert.ok(r.text.includes('담당'));assert.ok(r.text.includes('need decision'));assert.ok(r.text.includes(r.marker));const no=C.buildReport(a,{date:'2026-10-08',includeDone:false,includeNotes:false});assert.equal(no.taskCount,3);assert.ok(!no.text.includes('secret note'));assert.ok(!no.text.includes('area memo'));});
test('all Docs updates target the generated tab with UTF-16 indexes',()=>{const a=C.clone(seed.areas[0]);a.tasks[0].title+=' 🧀';const r=C.buildReport(a,{date:'2026-10-08'});const req=C.reportRequests(r,'new-tab');assert.equal(req[0].insertText.endOfSegmentLocation.tabId,'new-tab');for(const q of req.slice(1)){const x=q.updateTextStyle||q.updateParagraphStyle;assert.equal(x.range.tabId,'new-tab');assert.ok(x.range.endIndex<=r.text.length+1);}assert.equal(req[1].updateTextStyle.range.endIndex,r.text.length+1);});
test('same-day tab titles create numbered snapshots',()=>{const base='[영역] 2026-10-08';assert.equal(C.uniqueTabTitle(base,[base,base+' (2)']),base+' (3)');});
function mockGoogle(){
 const doc={documentId:'abcdefghijklmno',title:'Private work log',revisionId:'r1',tabs:[]};
 doc.tabs.push({tabProperties:{tabId:'original',title:'기존 탭'},documentTab:{body:{content:[{paragraph:{elements:[{textRun:{content:'KEEP ME\n'}}]}}]}}});
 let seq=1;let fail='';let mutations=0;const requests=[];
 const fetchImpl=async(url,opts)=>{
  if(opts.method==='GET')return {ok:true,json:async()=>C.clone(doc)};
  const body=JSON.parse(opts.body);requests.push(body);mutations++;
  if(body.writeControl)assert.equal(body.writeControl.requiredRevisionId,doc.revisionId);
  const replies=[];
  for(const q of body.requests||[]){
   if(q.addDocumentTab){const tab={tabProperties:{tabId:'tab'+seq++,title:q.addDocumentTab.tabProperties.title},documentTab:{body:{content:[]}}};doc.tabs.push(tab);replies.push({addDocumentTab:{tabProperties:tab.tabProperties}});}
   if(q.insertText){const t=doc.tabs.find(t=>t.tabProperties.tabId===q.insertText.endOfSegmentLocation.tabId);t.documentTab.body.content=[{paragraph:{elements:[{textRun:{content:q.insertText.text}}]}}];}
  }
  doc.revisionId='r'+(mutations+1);
  if(fail==='create'&&body.requests[0].addDocumentTab){fail='';throw new Error('lost create response');}
  if(fail==='write'&&body.requests[0].insertText){fail='';throw new Error('lost write response');}
  return {ok:true,json:async()=>({replies})};
 };
 return {doc,fetchImpl,requests,setFail:x=>fail=x};
}
test('Google export creates real tab requests, preserves existing content and verifies snapshot',async()=>{const m=mockGoogle(),journal=[];const d=new DocsClient({getToken:()=>'test-only',fetchImpl:m.fetchImpl,onJournal:async p=>journal.push(p)});const r=C.buildReport(seed.areas[0],{date:'2026-10-08',requestId:'req1'});const p=await d.prepare(m.doc.documentId,r);const h=await d.run(p);assert.equal(m.doc.tabs.length,2);assert.equal(C.tabText(m.doc.tabs[0]),'KEEP ME\n');assert.equal(h.tabId,'tab1');assert.equal(journal.at(-1).phase,'complete');assert.ok(C.tabText(m.doc.tabs[1]).includes(r.marker));});
test('lost content response recovers without duplicate tab or repeated insert',async()=>{const m=mockGoogle();const d=new DocsClient({getToken:()=>'test-only',fetchImpl:m.fetchImpl});const p=await d.prepare(m.doc.documentId,C.buildReport(seed.areas[0],{requestId:'req2'}));m.setFail('write');await assert.rejects(()=>d.run(p));const before=m.requests.length;await d.run(p);assert.equal(m.doc.tabs.length,2);assert.equal(m.requests.length,before);});
test('lost create response requires confirmation before reusing a blank tab',async()=>{const m=mockGoogle();const d=new DocsClient({getToken:()=>'test-only',fetchImpl:m.fetchImpl});const p=await d.prepare(m.doc.documentId,C.buildReport(seed.areas[0],{requestId:'req3'}));m.setFail('create');await assert.rejects(()=>d.run(p));assert.equal(p.phase,'creating');await assert.rejects(()=>d.run(p),/빈 탭/);await d.run(p,{allowBlankRecovery:true});assert.equal(m.doc.tabs.length,2);assert.ok(C.tabText(m.doc.tabs[1]).includes(p.report.marker));});
test('nonempty foreign tab is never overwritten during recovery',async()=>{const m=mockGoogle();const d=new DocsClient({getToken:()=>'test-only',fetchImpl:m.fetchImpl});const p=await d.prepare(m.doc.documentId,C.buildReport(seed.areas[0],{requestId:'req4'}));p.tabId='original';p.phase='writing';await assert.rejects(()=>d.run(p),/보존/);assert.equal(C.tabText(m.doc.tabs[0]),'KEEP ME\n');});
test('backup whitelists fields and never exports top-level tokens or configuration',()=>{const s=C.createState(seed);s.access_token='never-export';s.clientId='never-export';s.config={secret:'never-export'};const text=JSON.stringify(C.backup(s));assert.ok(!text.includes('never-export'));});
test('API rejects absent auth before any network request',async()=>{let requests=0;const d=new DocsClient({getToken:()=>'',fetchImpl:async()=>requests++});await assert.rejects(()=>d.get('abcdefghijklmno'),/연결/);assert.equal(requests,0);});
test('API permission errors are explicit and never produce saved history',async()=>{const j=[];const d=new DocsClient({getToken:()=>'mock',fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:{message:'Permission denied'}})}),onJournal:async p=>j.push(p)});await assert.rejects(()=>d.prepare('abcdefghijklmno',C.buildReport(seed.areas[0])),/편집 권한/);assert.equal(j.length,0);});
test('14 areas export separately, preserving original and numbering repeat snapshots',async()=>{const m=mockGoogle();const d=new DocsClient({getToken:()=>'mock',fetchImpl:m.fetchImpl});for(const a of seed.areas){const p=await d.prepare(m.doc.documentId,C.buildReport(a,{date:'2026-10-08'}));await d.run(p);}assert.equal(m.doc.tabs.length,15);assert.equal(C.tabText(m.doc.tabs[0]),'KEEP ME\n');const again=await d.prepare(m.doc.documentId,C.buildReport(seed.areas[0],{date:'2026-10-08'}));assert.ok(again.title.endsWith('(2)'));});
test('nested Google tab titles participate in collision checks',()=>{const tabs=[{tabProperties:{title:'Parent'},childTabs:[{tabProperties:{title:'[영역] 2026-10-08'}}]}];assert.equal(C.uniqueTabTitle('[영역] 2026-10-08',C.flattenTabs(tabs).map(t=>t.tabProperties.title)),'[영역] 2026-10-08 (2)');});
test('5xx add-tab errors retain an uncertain creation state for safe recovery',async()=>{const m=mockGoogle();const d=new DocsClient({getToken:()=>'mock',fetchImpl:async(u,o)=>{const response=await m.fetchImpl(u,o);if(o.method==='POST'&&JSON.parse(o.body).requests[0]?.addDocumentTab)return {ok:false,status:500,json:async()=>({error:{message:'Backend error'}})};return response;}});const plan=await d.prepare(m.doc.documentId,C.buildReport(seed.areas[0]));await assert.rejects(()=>d.run(plan));assert.equal(plan.phase,'creating');assert.equal(m.doc.tabs.length,2);await d.run(plan,{allowBlankRecovery:true});assert.equal(m.doc.tabs.length,2);});
