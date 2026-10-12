/* Pure state and report helpers. Browser + Node compatible. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FranDCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const STATUS = {todo:'미착수', doing:'진행 중', blocked:'확인·결정 대기', done:'완료'};
  const PRIORITY = {high:'높음', normal:'보통', low:'낮음'};
  const CADENCE = {once:'일회성', weekly:'매주 점검', monthly:'매월 점검', quarterly:'분기 점검'};
  const clone = v => JSON.parse(JSON.stringify(v));
  function id() {
    return globalThis.crypto?.randomUUID?.() || `fd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
  }
  function today(timezone='Asia/Seoul', now=new Date()) {
    const p = new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const get = k => p.find(x=>x.type===k).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function validDate(s) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    const d = new Date(s+'T12:00:00Z');
    return !isNaN(d.valueOf()) && d.toISOString().slice(0,10) === s;
  }
  function addDays(s,n) { const d=new Date(s+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
  function safeUrl(s) {
    try { const u = new URL(String(s).trim()); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch { return ''; }
  }
  function docId(input) {
    const s=String(input || '').trim();
    if(/^[\w-]{15,200}$/.test(s)) return s;
    try { const u=new URL(s); if(u.protocol!=='https:'||u.hostname!=='docs.google.com') return ''; return u.pathname.match(/^\/document\/d\/([\w-]{15,200})(?:\/|$)/)?.[1]||''; } catch { return ''; }
  }
  const clean = (v,max=12000) => typeof v==='string'?v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').slice(0,max):'';
  function stats(tasks,date=today()) {
    const a=tasks.filter(t=>!t.archived);
    const s={total:a.length,done:0,doing:0,blocked:0,todo:0,overdue:0,dueSoon:0,unassigned:0,pinned:0};
    for(const t of a) {
      s[t.status]++;
      if(t.status!=='done') {
        if(!t.owner.trim()) s.unassigned++;
        if(t.due && t.due<date) s.overdue++;
        if(t.due && t.due>=date && t.due<=addDays(date,7)) s.dueSoon++;
        if(t.pinned) s.pinned++;
      }
    }
    s.remaining=s.total-s.done; s.percent=s.total?Math.round(s.done/s.total*100):0;
    return s;
  }
  function allTasks(state) { return state.areas.flatMap(a=>a.tasks.map(t=>({...t,areaId:a.id,areaTitle:a.title}))); }
  function setStatus(task,status,now=new Date().toISOString()) {
    if(!STATUS[status]) throw new Error('지원하지 않는 업무 상태입니다.');
    task.status=status; task.updatedAt=now; task.completedAt=status==='done'?now:'';
    if(status==='done') task.subtasks.forEach(s=>s.done=true);
    // Reopening a task preserves individual subtask evidence until explicitly changed.
    return task;
  }
  function setSubtask(task,subId,done,now=new Date().toISOString()) {
    const s=task.subtasks.find(s=>s.id===subId); if(!s) throw new Error('하위 할 일을 찾을 수 없습니다.');
    s.done=!!done; task.updatedAt=now;
    if(task.subtasks.length && task.subtasks.every(x=>x.done)) setStatus(task,'done',now);
    else if(task.status==='done' || task.status==='todo') setStatus(task,'doing',now);
    return task;
  }
  function createState(seed) {
    return {schemaVersion:1,templateVersion:seed.templateVersion,workspace:seed.workspace,instanceId:id(),createdAt:new Date().toISOString(),updatedAt:'',revision:0,areas:clone(seed.areas),history:[],activity:[],pending:[],focusNote:'',ownerName:''};
  }
  function validateState(raw, seed) {
    if(!raw || raw.schemaVersion!==1 || !Array.isArray(raw.areas)) throw new Error('지원하는 백업 형식이 아닙니다. schemaVersion 1 파일을 선택하세요.');
    if(raw.areas.length!==seed.areas.length || seed.areas.some(a=>!raw.areas.some(x=>x.id===a.id))) throw new Error('14개 업무 영역이 모두 포함된 백업을 선택하세요.');
    if(new Set(raw.areas.map(a=>a.id)).size!==14) throw new Error('업무 영역 ID가 중복되어 있습니다.');
    const out=createState(seed); const ids=new Set(); let count=0;
    out.instanceId=clean(raw.instanceId,100)||id(); out.workspace=clean(raw.workspace,150)||seed.workspace;
    out.createdAt=clean(raw.createdAt,50)||out.createdAt; out.updatedAt=clean(raw.updatedAt,50);
    out.revision=Number.isSafeInteger(raw.revision)&&raw.revision>=0?raw.revision:0;
    out.focusNote=clean(raw.focusNote,5000); out.ownerName=clean(raw.ownerName,100);
    out.areas=seed.areas.map(base=>{
      const a=raw.areas.find(x=>x.id===base.id);
      if(!Array.isArray(a.tasks)||a.tasks.length>1000) throw new Error('업무 목록 형식이나 크기를 확인하세요.');
      return {...clone(base),goal:clean(a.goal,2000)||base.goal,notes:clean(a.notes,15000),tasks:a.tasks.map(t=>{
        if(++count>5000) throw new Error('최대 5,000개 업무까지 불러올 수 있습니다.');
        if(!t || !clean(t.title,300)) throw new Error('제목이 없는 업무가 있습니다.');
        const tid=/^[a-zA-Z0-9_-]{1,120}$/.test(t.id||'')?t.id:id();
        if(ids.has(tid)) throw new Error('업무 ID가 중복되어 있습니다.'); ids.add(tid);
        const subIds=new Set();
        return {id:tid,title:clean(t.title,300),description:clean(t.description,6000),output:clean(t.output,3000),status:STATUS[t.status]?t.status:'todo',priority:PRIORITY[t.priority]?t.priority:'normal',owner:clean(t.owner,150),due:validDate(t.due)?t.due:'',cadence:CADENCE[t.cadence]?t.cadence:'once',pinned:!!t.pinned,notes:clean(t.notes,18000),blocker:clean(t.blocker,6000),links:(Array.isArray(t.links)?t.links:[]).slice(0,30).map(l=>({label:clean(l.label,200),url:safeUrl(l.url)})).filter(l=>l.url),archived:!!t.archived,completedAt:clean(t.completedAt,50),updatedAt:clean(t.updatedAt,50),subtasks:(Array.isArray(t.subtasks)?t.subtasks:[]).slice(0,300).map(s=>{
          let sid=/^[a-zA-Z0-9_-]{1,120}$/.test(s.id||'')?s.id:id(); if(subIds.has(sid)) sid=id(); subIds.add(sid);
          return {id:sid,title:clean(s.title,2000),done:!!s.done};
        }).filter(s=>s.title)};
      })};
    });
    // Backups intentionally exclude Google credentials and in-flight API transactions.
    out.history=(Array.isArray(raw.history)?raw.history:[]).slice(0,200).filter(h=>h&&docId(h.documentId)&&typeof h.tabId==='string').map(h=>({id:clean(h.id,120),areaId:clean(h.areaId,80),title:clean(h.title,200),documentId:docId(h.documentId),tabId:clean(h.tabId,120),savedAt:clean(h.savedAt,50),date:validDate(h.date)?h.date:'',taskCount:Number(h.taskCount)||0}));
    out.activity=(Array.isArray(raw.activity)?raw.activity:[]).slice(0,80).filter(x=>x&&typeof x.text==='string').map(x=>({id:clean(x.id,120),at:clean(x.at,50),text:clean(x.text,500),areaId:clean(x.areaId,80)}));
    return out;
  }
  function backup(state) {
    const out={app:'frand-director-desk',exportedAt:new Date().toISOString()};
    // Whitelist application fields; connection settings and transient tokens never
    // enter an exported backup, even if an extension added extra top-level keys.
    for(const k of ['schemaVersion','templateVersion','workspace','instanceId','createdAt','updatedAt','revision','areas','history','activity','focusNote','ownerName']) if(state[k]!==undefined)out[k]=clone(state[k]);
    out.pending=[];return out;
  }
  function flattenTabs(tabs) { return (tabs||[]).flatMap(t=>[t,...flattenTabs(t.childTabs)]); }
  function tabText(tab) {
    const read = els => (els||[]).map(e=>e.paragraph?(e.paragraph.elements||[]).map(x=>x.textRun?.content||'').join(''):e.table?(e.table.tableRows||[]).map(r=>(r.tableCells||[]).map(c=>read(c.content)).join('')).join(''):e.tableOfContents?read(e.tableOfContents.content):'').join('');
    return read(tab?.documentTab?.body?.content);
  }
  function uniqueTabTitle(base, existing) {
    // Room for numbered same-day snapshots. Never rename or delete existing tabs.
    const short=Array.from(base).slice(0,85).join('');
    if(!existing.includes(short)) return short;
    let i=2; while(existing.includes(`${short} (${i})`)) i++;
    return `${short} (${i})`;
  }
  function buildReport(area,{date=today(),workspace='Fran:D 실장 업무',author='',includeDone=true,includeNotes=true,requestId=id()}={}) {
    if(!validDate(date)) throw new Error('저장 기준일을 확인하세요.');
    const tasks=area.tasks.filter(t=>!t.archived && (includeDone || t.status!=='done'));
    const s=stats(area.tasks,date); const headings=[]; let text='';
    function line(s='',style) { const startIndex=text.length+1; text+=clean(String(s),30000).replace(/[\uE000-\uF8FF]/g,'')+'\n'; if(style) headings.push({startIndex,endIndex:text.length+1,style}); }
    const title=`[${area.title}] ${date}`;
    line(title,'TITLE'); line(workspace); line(`기준일: ${date}${author?'  |  기록자: '+author:''}`);
    line(`전체 ${s.total}건 · 완료 ${s.done}건 · 진행 ${s.doing}건 · 확인·결정 대기 ${s.blocked}건 · 미착수 ${s.todo}건 · 완료율 ${s.percent}%`);
    line(`표시 범위: ${includeDone?'완료 업무 포함':'미완료 업무만'} / 업무 ${tasks.length}건`); line();
    line('이 영역의 결과','HEADING_1'); line(area.goal); line();
    if(includeNotes && area.notes.trim()) { line('영역 메모·결정사항','HEADING_1'); line(area.notes); line(); }
    line('실행 체크리스트','HEADING_1');
    if(!tasks.length) line('현재 표시 범위에 해당하는 할 일이 없습니다.');
    tasks.forEach((t,i)=>{
      line(`${t.status==='done'?'☑':'☐'} ${i+1}. ${t.title}`,'HEADING_2');
      line(`상태: ${STATUS[t.status]} | 우선순위: ${PRIORITY[t.priority]} | 담당: ${t.owner||'미지정'} | 기한: ${t.due||'미지정'} | 주기: ${CADENCE[t.cadence]}`);
      if(t.description) line(`업무 설명: ${t.description}`);
      if(t.output) line(`완료 결과물: ${t.output}`);
      t.subtasks.forEach(s=>line(`  ${s.done?'☑':'☐'} ${s.title}`));
      if(includeNotes && t.blocker) line(`결정·지원 요청: ${t.blocker}`);
      if(includeNotes && t.notes) line(`진행 메모: ${t.notes}`);
      t.links.forEach(l=>line(`근거: ${l.label||'참고자료'} — ${l.url}`)); line();
    });
    line('저장 안내','HEADING_1');
    line('이 탭은 웹페이지에서 저장한 시점의 스냅샷입니다. Google Docs에서 직접 수정한 내용은 웹페이지로 자동 반영되지 않습니다. 체크 표시는 상태를 나타내는 텍스트입니다.');
    const marker='FD-DESK-SNAPSHOT:'+requestId; line(marker);
    return {title,text,headings,marker,taskCount:tasks.length,date,areaId:area.id};
  }
  function reportRequests(report,tabId) {
    const range={tabId,startIndex:1,endIndex:report.text.length+1};
    return [
      {insertText:{endOfSegmentLocation:{tabId},text:report.text}},
      {updateTextStyle:{range,textStyle:{weightedFontFamily:{fontFamily:'Arial'},fontSize:{magnitude:10,unit:'PT'}},fields:'weightedFontFamily,fontSize'}},
      ...report.headings.map(h=>({updateParagraphStyle:{range:{tabId,startIndex:h.startIndex,endIndex:h.endIndex},paragraphStyle:{namedStyleType:h.style},fields:'namedStyleType'}}))
    ];
  }
  return {STATUS,PRIORITY,CADENCE,clone,id,today,validDate,addDays,safeUrl,docId,clean,stats,allTasks,setStatus,setSubtask,createState,validateState,backup,flattenTabs,tabText,uniqueTabTitle,buildReport,reportRequests};
});
