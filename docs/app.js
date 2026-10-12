/* Fran:D Director Desk — no backend and no external UI dependencies. */
(function() {
'use strict';
const C=window.FranDCore, seed=window.FRAND_SEED;
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const ICONS={
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 check:'<path d="m5 12 4 4L19 6"/>',list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',alert:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.1"/>',
 cloud:'<path d="M7 18H6a4 4 0 0 1-.5-8A6.5 6.5 0 0 1 18 8a5 5 0 0 1 0 10h-1M12 21V11m-4 4 4-4 4 4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',edit:'<path d="m15 4 5 5M4 20l4-1L21 6a2 2 0 0 0-3-3L5 16l-1 4Z"/>',
 star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
 link:'<path d="m10 13 4-4M8 16l-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m4-2 2-2a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0"/>',
 download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-.7 3-2.5 1.5L3 7l-2 4 2.3 2-.1 3L5 19l3-.5L10 21h4l2-2.5 3 .5 2-3-.3-3L23 11l-2-4-3 .5L15.7 6 15 3H9Z"/>',
 doc:'<path d="M14 3H5v18h14V8l-5-5Z"/><path d="M14 3v6h5M8 13h8M8 17h6"/>',shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
 archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M9 12h6"/>',up:'<path d="m6 14 6-6 6 6"/>',down:'<path d="m6 10 6 6 6-6"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5M19 10a7 7 0 0 0-12-5L4 8m1 6a7 7 0 0 0 12 5l3-3"/>',logout:'<path d="M9 4H4v16h5m5-4 4-4-4-4M8 12h13"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>'
};
const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||ICONS.list}</svg>`;
const btn=(label,act,kind='',attrs='')=>`<button type="button" class="btn ${kind}" data-act="${act}" ${attrs}>${label}</button>`;
const tabURL=h=>`https://docs.google.com/document/d/${encodeURIComponent(h.documentId)}/edit?tab=${encodeURIComponent(h.tabId)}`;
const namespace=location.protocol==='file:'?'local-file':location.pathname.replace(/[^/]*$/,'');
const KEY='frand-director-desk:v1:'+namespace, CONFIGKEY=KEY+':google';
let storageOK=true, fatalRaw='', conflict=false, saveError='', revision=0, state, cfg={...window.FRAND_CONFIG};
let token='', tokenExpires=0, googleReady=false, googleLoading=null, tokenClient=null;
let exportBusy=false, exportSpec=null, editorDirty=false, filters={text:'',status:'all',sort:'manual'}, lastRoute='';
const expanded=new Set();
try {
 const raw=localStorage.getItem(KEY);
 if(raw){
   let parsed;
   try {parsed=JSON.parse(raw);state=C.validateState(parsed,seed);} catch(e){fatalRaw=raw;throw new Error('저장된 업무를 읽지 못했습니다. 원문 백업 후 복구할 수 있습니다.');}
   state.pending=(Array.isArray(parsed.pending)?parsed.pending:[]).filter(p=>p&&C.docId(p.documentId)&&p.report?.marker===`FD-DESK-SNAPSHOT:${p.id}`&&typeof p.report.text==='string'&&p.report.text.length<500000&&Array.isArray(p.report.headings)).slice(0,20);
 } else state=C.createState(seed);
 const storedConfig=JSON.parse(localStorage.getItem(CONFIGKEY)||'{}');
 ['clientId','apiKey','projectNumber','documentId','documentName','mode','timezone'].forEach(k=>{if(typeof storedConfig[k]==='string')cfg[k]=storedConfig[k];});
 cfg.documentId=C.docId(cfg.documentId); if(!['drive.file','documents'].includes(cfg.mode))cfg.mode='drive.file'; cfg.timezone='Asia/Seoul';
} catch(e) {
 if(!state)state=C.createState(seed); storageOK=false; saveError=e.message;
}
revision=state.revision;
function nowDate(){return C.today(cfg.timezone);}
function formatDateTime(value){ if(!value)return '아직 기록 없음';const d=new Date(value);return isNaN(d)?value:new Intl.DateTimeFormat('ko-KR',{timeZone:cfg.timezone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d); }
function areaById(aid){return state.areas.find(a=>a.id===aid);}
function findTask(aid,tid){const a=areaById(aid);const t=a?.tasks.find(t=>t.id===tid);if(!t)throw new Error('업무를 찾을 수 없습니다.');return {a,t};}
function persist(){
 if(fatalRaw||conflict)throw new Error('다른 창의 변경 또는 복구할 기록을 먼저 확인하세요.');
 try {
  const old=JSON.parse(localStorage.getItem(KEY)||'null');
  if(old && old.revision!==revision){conflict=true;localStorage.setItem(KEY+':conflict',JSON.stringify(C.backup(state)));throw new Error('다른 창에서 업무가 변경됐습니다. 현재 작업을 백업한 뒤 최신 기록을 불러오세요.');}
  const next=revision+1; state.revision=next; state.updatedAt=new Date().toISOString();
  localStorage.setItem(KEY,JSON.stringify(state)); revision=next;storageOK=true;saveError='';
 }catch(e){storageOK=false;saveError=e.message;renderNotice();updateChrome();throw e;}
 updateChrome();
}
function mutate(fn,activity='',areaId=''){
 const prev=C.clone(state);
 try {fn(state); if(activity)state.activity.unshift({id:C.id(),at:new Date().toISOString(),text:activity,areaId}); state.activity=state.activity.slice(0,80);persist();}
 catch(e){state=prev;throw e;}
}
function persistCfg(){try{localStorage.setItem(CONFIGKEY,JSON.stringify(cfg));}catch(e){throw new Error('Google 설정을 이 브라우저에 저장할 수 없습니다. 저장 공간을 확인하세요.');}}
function notify(msg,error=false){const el=$('#toast');el.textContent=msg;el.classList.toggle('error',error);el.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.hidden=true,error?9000:3800);}
function renderNotice(){
 let text='';if(fatalRaw)text='보관된 업무 데이터에 복구가 필요합니다. 원문을 먼저 백업하고 초기화하거나 다른 백업을 불러오세요.';
 else if(conflict)text='다른 브라우저 창에서 업무가 변경되었습니다. 이 창의 내용을 백업한 뒤 최신 기록을 불러오세요.';
 else if(!storageOK)text='브라우저 저장을 완료하지 못했습니다. JSON 백업으로 기록을 보관하세요. '+saveError;
 $('#noticeHost').innerHTML=text?`<div class="notice"><span>${esc(text)}</span><div class="head-actions">${btn('현재 기록 백업','backup','small')}${conflict?btn('최신 기록 불러오기','reload','small'):btn('설정·복구','go-settings','small')}</div></div>`:'';
}
function updateChrome(){
 const online=!!token && Date.now()<tokenExpires;
 $('#connectionLabel').textContent=online?'Google 연결됨':'Google 설정';$('#connectionShortcut').classList.toggle('is-connected',online);
 $('#localStatus').textContent=storageOK?`이 브라우저에 저장 ${state.updatedAt?'· '+formatDateTime(state.updatedAt):'· 초기 체크리스트'}`:'저장 상태 확인 필요';
}
function route(){const h=location.hash.slice(1)||'dashboard';const [page,arg]=h.split('/');return {page,arg:arg?decodeURIComponent(arg):''};}
function go(hash){if(location.hash==='#'+hash){render();return;}location.hash=hash;}
function closeNav(){$('#sidebar').classList.remove('open');$('#navBackdrop').hidden=true;$('#menuButton').setAttribute('aria-expanded','false');}
function renderNav(){
 const r=route();let group='';
 const nav=state.areas.map(a=>{let h='';if(a.group!==group){group=a.group;h=`<div class="nav-section">${esc(group)}</div>`;}const s=C.stats(a.tasks,nowDate());
 return h+`<a href="#area/${a.id}" class="nav-link ${r.page==='area'&&r.arg===a.id?'active':''}" ${r.page==='area'&&r.arg===a.id?'aria-current="page"':''} title="${esc(a.title)}"><span class="nav-no">${String(a.number).padStart(2,'0')}</span><span class="nav-name">${esc(a.title)}</span><span class="nav-count">${s.remaining}</span></a>`;}).join('');
 $('#sidebar').innerHTML=`<a class="brand" href="#dashboard" aria-label="Fran:D 실장 업무실 대시보드"><div class="brand-mark">F:</div><div><div class="brand-name">Fran:D</div><div class="brand-sub">DIRECTOR DESK</div></div></a><nav class="nav-scroll"><a href="#dashboard" class="nav-link nav-primary ${r.page==='dashboard'?'active':''}">${icon('grid')}<span>대시보드</span></a><a href="#all" class="nav-link nav-primary ${r.page==='all'||r.page==='search'?'active':''}">${icon('list')}<span>전체 할 일</span></a>${nav}<div class="nav-section">기록과 연결</div><a href="#history" class="nav-link ${r.page==='history'?'active':''}">${icon('doc')}<span>Google 저장 기록</span></a><a href="#settings" class="nav-link ${r.page==='settings'?'active':''}">${icon('settings')}<span>연결 설정 · 백업</span></a></nav><div class="nav-bottom"><div class="mini-avatar">실</div><div><div style="font-size:12px;font-weight:650">실장 업무실</div><small>14개 업무 영역 · 실행과 기록</small></div></div>`;
}
function render(){
 const r=route();if(lastRoute!==location.hash){filters={text:'',status:'all',sort:'manual'};lastRoute=location.hash;window.scrollTo(0,0);}
 renderNav();updateChrome();renderNotice();closeNav();
 let title='대시보드',html='';
 if(r.page==='area'&&areaById(r.arg)){title=areaById(r.arg).title;html=renderArea(areaById(r.arg));}
 else if(r.page==='settings'){title='연결 설정 · 백업';html=renderSettings();}
 else if(r.page==='history'){title='Google 저장 기록';html=renderHistory();}
 else if(r.page==='all'||r.page==='search'){title=r.page==='search'?'검색 결과':'전체 할 일';if(r.page==='all'&&r.arg)filters.status=r.arg;html=renderAll(r);}
 else html=renderDashboard();
 $('#breadcrumb').textContent=title;document.title=title+' · Fran:D 실장 업무실';$('#main-content').innerHTML=html;
 if(['area','all','search'].includes(r.page)) refreshList();
 if(r.page==='settings' && location.protocol!=='file:')loadGoogle().catch(()=>{});
}
function metric(label,value,foot,ic,filter,klass=''){return `<button class="panel metric ${klass}" type="button" data-act="metric" data-filter="${filter}"><span class="metric-top">${esc(label)}${icon(ic)}</span><span class="metric-value">${value}<small>건</small></span><span class="metric-foot">${esc(foot)}</span></button>`;}
function renderDashboard(){
 const tasks=C.allTasks(state),s=C.stats(tasks,nowDate()),pinned=tasks.filter(t=>!t.archived&&t.pinned&&t.status!=='done');
 const focus=pinned.length?pinned.map(t=>focusItem(t)).join(''):`<div class="focus-empty"><p>업무의 별표를 눌러 오늘 집중할 일을 이곳에 모으세요.</p>${['strategy-2','people-1','pricing-3'].map((_,i)=>tasks.find(t=>t.id===["strategy-02","people-01","pricing-03"][i])).filter(Boolean).map(t=>`<div class="suggestion"><a href="#area/${t.areaId}">${esc(t.title)}</a><button class="icon-btn" data-act="pin-task" data-area="${t.areaId}" data-task="${t.id}" aria-label="${esc(t.title)} 집중 업무로 선택">${icon('star')}</button></div>`).join('')}</div>`;
 const dateLabel=new Intl.DateTimeFormat('ko-KR',{timeZone:cfg.timezone,dateStyle:'full'}).format(new Date());
 return `<div class="page-head"><div><div class="eyebrow">WORKSPACE OVERVIEW</div><h1>실장 업무 대시보드</h1><p>${esc(dateLabel)} · 할 일을 점검하고, 필요한 결정을 앞으로 옮기세요.</p></div><div class="head-actions">${btn(icon('download')+'백업','backup')}${btn(icon('cloud')+'전체 영역 구글로 저장','export-all','primary')}</div></div>
 <section class="hero"><div><div class="eyebrow">FROM DIRECTION TO ACTION</div><h2>방향을 실행으로,<br>실행을 다음 단계로.</h2><p>사람 · 고객 · 제품 · 데이터를 하나의 업무 흐름으로 연결하세요.<br>업무를 완료하고, 중요한 판단과 결과를 기록합니다.</p><div class="hero-note">${icon('shield')}초기 상태는 모두 미착수 · 담당자와 기한을 직접 지정하세요.</div></div><div class="hero-meter"><div class="ring" style="--progress:${s.percent}"><div class="ring-inner"><b>${s.percent}%</b><small>업무 완료율</small></div></div><div class="meter-label"><b>${s.done} / ${s.total} 완료</b>14개 업무 영역<br>남은 할 일 ${s.remaining}건</div></div></section>
 <section class="metric-grid" aria-label="업무 상태 요약">${metric('완료한 업무',s.done,'전체 '+s.total+'건 기준','check','done')}${metric('진행 중',s.doing,'현재 실행하고 있는 업무','clock','doing')}${metric('확인·결정 대기',s.blocked,'다음 단계에 필요한 결정','alert','blocked','warn')}${metric('기한 지난 업무',s.overdue,'미완료 · 설정한 기한 기준','calendar','overdue','alert')}</section>
 <div class="dashboard-row"><section class="panel"><div class="panel-head"><h2>오늘의 집중 업무 <span class="badge-count">${pinned.length}</span></h2><a href="#all" class="tiny">전체 보기 →</a></div><div class="panel-body">${focus}</div></section><section class="panel"><div class="panel-head"><h2>이번 주 실장 메모</h2>${icon('edit')}</div><div class="panel-body"><form id="focusForm"><textarea class="note-input" name="note" aria-label="이번 주 실장 메모" placeholder="이번 주에 만들 결과, 필요한 결정, 팀에 지원할 일을 적어 두세요.">${esc(state.focusNote)}</textarea><div class="note-footer"><span class="tiny muted">이 브라우저에만 저장됩니다.</span><button class="btn small" type="submit">메모 저장</button></div></form></div></section></div>
 <div class="section-heading"><div><h2>업무 영역별 점검</h2><p>각 영역을 열어 체크리스트를 수정하고 진행 상황을 업데이트하세요.</p></div><span class="tiny muted">14 AREAS</span></div><section class="area-grid">${state.areas.map(a=>{const x=C.stats(a.tasks,nowDate());return `<a class="panel area-card" href="#area/${a.id}"><div class="area-card-top"><span class="area-number">${String(a.number).padStart(2,'0')}</span><span class="area-group">${esc(a.group)}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.goal)}</p><div class="progress-track" role="progressbar" aria-label="${esc(a.title)} 완료율" aria-valuenow="${x.percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="--progress:${x.percent}"></div></div><div class="area-card-foot"><span>완료 <b>${x.done}/${x.total}</b>${x.blocked?' · 결정 대기 '+x.blocked:''}${x.overdue?' · 기한 경과 '+x.overdue:''}</span><span class="arrow">↗</span></div></a>`;}).join('')}</section>
 <section class="panel activity-panel"><div class="panel-head"><h2>최근 변경</h2><span class="tiny muted">실제 편집·체크 이력</span></div><div class="panel-body">${state.activity.length?state.activity.slice(0,5).map(a=>`<div class="activity-row"><time>${esc(formatDateTime(a.at))}</time><span>${esc(a.text)}</span></div>`).join(''):`<p class="tiny muted">첫 업무를 체크하거나 내용을 편집하면 변경 이력이 남습니다.</p>`}</div></section>`;
}
function focusItem(t){return `<div class="focus-item"><input type="checkbox" class="check" data-act="toggle-task" data-area="${t.areaId}" data-task="${t.id}" aria-label="${esc(t.title)} 완료"><div class="focus-info"><a href="#area/${t.areaId}">${esc(t.title)}</a><div class="focus-meta">${esc(t.areaTitle)} · ${esc(t.owner||'담당 미지정')}${t.due?' · '+esc(t.due):''}</div></div><div class="focus-actions"><span class="badge ${t.status}">${C.STATUS[t.status]}</span><button class="icon-btn pinned" data-act="pin-task" data-area="${t.areaId}" data-task="${t.id}" aria-label="집중 업무에서 제외">${icon('star')}</button></div></div>`;}
function filterBar(){return `<div class="filterbar"><input class="filter-search" id="taskSearch" aria-label="현재 목록 검색" placeholder="제목·담당자·메모 검색" value="${esc(filters.text)}"><select id="statusFilter" aria-label="업무 상태 필터">${[['all','전체 상태'],['open','미완료'],['todo','미착수'],['doing','진행 중'],['blocked','확인·결정 대기'],['done','완료'],['overdue','기한 경과'],['dueSoon','7일 이내 기한'],['unassigned','담당 미지정'],['pinned','집중 업무'],['archived','보관함']].map(([v,l])=>`<option value="${v}" ${v===filters.status?'selected':''}>${l}</option>`).join('')}</select><select id="sortFilter" aria-label="정렬 기준">${[['manual','기본 순서'],['due','기한순'],['priority','우선순위순'],['updated','최근 변경순']].map(([v,l])=>`<option value="${v}" ${v===filters.sort?'selected':''}>${l}</option>`).join('')}</select><span id="filterCount" class="filter-count"></span></div>`;}
function renderArea(a){
 const s=C.stats(a.tasks,nowDate()),last=state.history.find(h=>h.areaId===a.id),savedUrl=last?tabURL(last):'';
 return `<div class="page-head"><div><div class="eyebrow">${String(a.number).padStart(2,'0')} / ${esc(a.group)}</div><h1>${esc(a.title)}</h1><p>업무의 결과물과 하위 할 일을 확인하고, 상태를 업데이트하세요.</p></div><div class="head-actions">${btn(icon('plus')+'할 일 추가','add-task','',`data-area="${a.id}"`)}${btn(icon('cloud')+'구글로 저장하기','export-area','primary',`data-area="${a.id}"`)}</div></div>
 <section class="panel area-banner"><span class="area-number">${String(a.number).padStart(2,'0')}</span><div class="area-banner-text"><strong>이 영역에서 만들 결과</strong><p>${esc(a.goal)}</p></div><div class="inline-progress"><div><strong>${s.percent}%</strong>${s.done}/${s.total} 완료</div><div class="progress-track"><div class="progress-fill" style="--progress:${s.percent}"></div></div></div></section>
 <div class="area-layout"><section>${filterBar()}<div id="task-list"></div><div class="inline-note">완료율은 보관함을 제외한 상위 업무 기준입니다. 하위 할 일을 모두 완료하면 상위 업무도 완료됩니다.</div></section><aside class="area-aside"><section class="panel side-panel"><div class="panel-head"><h2>영역 메모 · 결정</h2><button class="icon-btn" data-act="edit-area" data-area="${a.id}" aria-label="영역 목표와 메모 편집">${icon('edit')}</button></div><div class="panel-body"><p>${esc(a.notes||'이번 영역의 결정사항, 지원 요청, 다음 점검 내용을 기록하세요.')}</p><div class="side-actions">${btn('목표·메모 편집','edit-area','small',`data-area="${a.id}"`)}</div></div></section><section class="panel side-panel"><div class="panel-head"><h2>실행 상태</h2></div><div class="panel-body">${[['남은 업무',s.remaining],['진행 중',s.doing],['결정 대기',s.blocked],['기한 경과',s.overdue],['담당 미지정',s.unassigned]].map(([l,n])=>`<div class="side-metric"><span>${l}</span><b>${n}</b></div>`).join('')}<p style="margin-top:15px">점검 주기는 업무를 분류하는 표시입니다. 반복 업무는 완료 후 복제해 다음 기한을 지정하세요.</p></div></section><section class="panel side-panel"><div class="panel-head"><h2>문서로 기록하기</h2>${icon('doc')}</div><div class="panel-body"><p>현재 업무 영역을 지정한 Google 문서의 새 탭으로 저장합니다. 같은 날의 추가 기록은 (2), (3)으로 구분합니다.</p>${last?`<p style="margin-top:12px">최근 저장 · ${esc(formatDateTime(last.savedAt))}</p><a class="tiny" href="${savedUrl}" target="_blank" rel="noopener noreferrer">저장한 탭 열기 ↗</a>`:''}<div class="side-actions">${btn('Markdown 내보내기','export-md','small',`data-area="${a.id}"`)}${btn('저장 전 미리보기','export-area','small soft',`data-area="${a.id}"`)}</div></div></section></aside></div>`;
}
function taskCard(t,a,showArea=false){
 const over=t.status!=='done'&&t.due&&t.due<nowDate();
 return `${showArea?`<div class="all-area-label"><a href="#area/${a.id}">${esc(a.title)}</a></div>`:''}<article class="panel task-card ${t.status==='done'?'is-done':''}" data-task-card="${t.id}"><div class="task-head"><input class="check" type="checkbox" data-act="toggle-task" data-area="${a.id}" data-task="${t.id}" ${t.status==='done'?'checked':''} ${t.archived?'disabled':''} aria-label="${esc(t.title)} 완료"><div class="task-main"><h3>${esc(t.title)}</h3><p class="task-desc">${esc(t.description)}</p><div class="task-tags"><span class="badge ${t.status}">${C.STATUS[t.status]}</span>${t.priority!=='normal'?`<span class="badge ${t.priority}">${C.PRIORITY[t.priority]} 우선순위</span>`:''}<span class="meta">${esc(t.owner||'담당 미지정')}</span>${t.due?`<span class="${over?'badge overdue':'meta'}">${over?'기한 경과 · ':''}${esc(t.due)}</span>`:'<span class="meta">기한 미지정</span>'}${t.cadence!=='once'?`<span class="meta">${C.CADENCE[t.cadence]}</span>`:''}</div>${t.archived?'<div class="archive-message">보관된 업무 · 대시보드 집계에서 제외</div>':''}</div><div class="task-tools">${t.archived?`<button class="icon-btn" data-act="restore-task" data-area="${a.id}" data-task="${t.id}" aria-label="업무 복원">${icon('refresh')}</button>`:`<button class="icon-btn ${t.pinned?'pinned':''}" data-act="pin-task" data-area="${a.id}" data-task="${t.id}" aria-label="${t.pinned?'집중 업무에서 제외':'집중 업무로 선택'}" aria-pressed="${t.pinned}">${icon('star')}</button>`}<button class="icon-btn" data-act="edit-task" data-area="${a.id}" data-task="${t.id}" aria-label="${esc(t.title)} 편집">${icon('edit')}</button></div></div><details class="task-details" data-detail="${t.id}" ${expanded.has(t.id)?'open':''}><summary>하위 할 일 ${t.subtasks.filter(x=>x.done).length}/${t.subtasks.length} · 결과물과 메모</summary><div class="task-detail-body">${t.subtasks.map(s=>`<label class="subtask"><input class="check" type="checkbox" data-act="toggle-subtask" data-area="${a.id}" data-task="${t.id}" data-sub="${s.id}" ${s.done?'checked':''} ${t.archived?'disabled':''}><span>${esc(s.title)}</span></label>`).join('')}${t.output?`<div class="output-box"><b>완료 결과물</b>${esc(t.output)}</div>`:''}${t.blocker?`<div class="blocker-note"><b>결정·지원 요청</b><br>${esc(t.blocker)}</div>`:''}${t.notes?`<div class="task-note"><b>진행 메모</b>${esc(t.notes)}</div>`:''}${t.links.map(l=>`<div class="link-row">${icon('link')}<a href="${esc(C.safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">${esc(l.label||l.url)}</a></div>`).join('')}<div class="settings-actions">${btn('편집','edit-task','small',`data-area="${a.id}" data-task="${t.id}"`)}${btn('복제','duplicate-task','small',`data-area="${a.id}" data-task="${t.id}"`)}${!showArea?`${btn('↑','move-task','small',`data-area="${a.id}" data-task="${t.id}" data-direction="-1" aria-label="위로 이동"`)}${btn('↓','move-task','small',`data-area="${a.id}" data-task="${t.id}" data-direction="1" aria-label="아래로 이동"`)}`:''}</div></div></details></article>`;
}
function visibleTasks(){
 const r=route();let list=r.page==='area'?areaById(r.arg).tasks.map(t=>({...t,areaId:r.arg})):C.allTasks(state);
 const query=(r.page==='search'?r.arg:'')+' '+filters.text,terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),date=nowDate();
 list=list.filter(t=>filters.status==='archived'?t.archived:!t.archived).filter(t=>{
  if(terms.length&&!terms.every(q=>[t.title,t.description,t.owner,t.notes,t.blocker,t.output,areaById(t.areaId).title,...t.subtasks.map(s=>s.title)].join(' ').toLocaleLowerCase().includes(q)))return false;
  const f=filters.status;if(f==='all'||f==='archived')return true;
  if(f==='open')return t.status!=='done';if(f==='overdue')return t.status!=='done'&&t.due&&t.due<date;
  if(f==='dueSoon')return t.status!=='done'&&t.due&&t.due>=date&&t.due<=C.addDays(date,7);
  if(f==='unassigned')return t.status!=='done'&&!t.owner.trim();if(f==='pinned')return t.status!=='done'&&t.pinned;
  return t.status===f;
 });
 if(filters.sort==='due')list.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
 if(filters.sort==='priority')list.sort((a,b)=>({high:0,normal:1,low:2}[a.priority]-{high:0,normal:1,low:2}[b.priority]));
 if(filters.sort==='updated')list.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
 return list;
}
function refreshList(){const el=$('#task-list');if(!el)return;const list=visibleTasks(),show=route().page!=='area';$('#filterCount').textContent=list.length+'건';el.innerHTML=list.length?list.map(t=>taskCard(t,areaById(t.areaId),show)).join(''):`<div class="panel empty-state search-empty">${icon('list')}<b>조건에 맞는 업무가 없습니다.</b>필터를 바꾸거나 새로운 할 일을 추가하세요.</div>`;}
function renderAll(r){return `<div class="page-head"><div><div class="eyebrow">ALL ACTIONS</div><h1>${r.page==='search'?'검색 결과':'전체 할 일'}</h1><p>${r.page==='search'?'“'+esc(r.arg)+'” 검색 · ':''}14개 영역을 한 목록에서 확인하세요. 업무는 해당 영역 페이지에서 추가할 수 있습니다.</p></div><div class="head-actions">${btn(icon('download')+'JSON 백업','backup')}</div></div>${filterBar()}<div id="task-list"></div>`;}
function renderHistory(){return `<div class="page-head"><div><div class="eyebrow">DOCUMENT SNAPSHOTS</div><h1>Google 저장 기록</h1><p>Google에서 본문 저장이 확인된 기록입니다. 기존 탭은 그대로 보존합니다.</p></div><div class="head-actions">${btn(icon('settings')+'연결 설정','go-settings')}</div></div>${state.pending.length?`<section class="panel settings-card pending-card"><h2>확인이 필요한 저장 ${state.pending.length}건</h2><p>중단된 요청은 이전 스냅샷 내용으로 이어서 확인합니다. 이후의 추가 편집은 복구 완료 후 새로 저장하세요.</p>${state.pending.map(p=>`<div class="history-item"><div class="history-content"><b>${esc(p.title)}</b><small>${esc(formatDateTime(p.createdAt))} · ${esc(p.phase)}</small></div>${btn('이전 저장 이어서 확인','recover-export','small primary',`data-id="${p.id}"`)}${btn('기록 정리','forget-export','small',`data-id="${p.id}"`)}</div>`).join('')}</section>`:''}<div class="history-list">${state.history.length?state.history.map(h=>`<article class="panel history-item"><div class="history-icon">${icon('doc')}</div><div class="history-content"><b>${esc(h.title)}</b><small>${esc(formatDateTime(h.savedAt))} · 업무 ${h.taskCount}건 · 새 탭으로 저장</small></div><a class="btn small" href="${tabURL(h)}" target="_blank" rel="noopener noreferrer">탭 열기 ${icon('arrow')}</a></article>`).join(''):`<section class="panel empty-state search-empty">${icon('doc')}<b>아직 Google 저장 기록이 없습니다.</b>영역 페이지에서 「구글로 저장하기」를 눌러 첫 스냅샷을 남기세요.<br>${btn('Google 연결 설정','go-settings','small')}</section>`}</div><p class="inline-note">이 목록은 현재 브라우저의 저장 이력입니다. Google 문서의 직접 수정 내용은 웹페이지에 자동 동기화되지 않습니다.</p>`;}
function renderSettings(){
 const fileMode=cfg.mode==='drive.file';
 return `<div class="page-head"><div><div class="eyebrow">CONNECTION & DATA</div><h1>연결 설정 · 백업</h1><p>체크리스트는 로컬에서 바로 사용하고, Google 연결 후 문서 탭으로 저장하세요.</p></div><div class="head-actions"><a class="btn" href="#dashboard">대시보드로</a></div></div><div class="settings-grid"><div><section class="panel settings-card"><h2>Google Docs 연결</h2><p>처음 한 번 Google Cloud 설정이 필요합니다. ChatGPT의 Google 연결과 이 웹페이지의 권한은 별개입니다.</p><form id="googleConfigForm"><label class="field"><span>연결 방식</span><select name="mode" id="googleMode"><option value="drive.file" ${fileMode?'selected':''}>선택한 파일만 허용 · 권장</option><option value="documents" ${!fileMode?'selected':''}>문서 URL 직접 지정 · Google Docs 전체 편집 권한</option></select><small>권장 모드: Google 문서 선택기로 고른 문서 또는 이 앱에서 만든 문서에만 접근합니다.</small></label><div id="scopeWarning" class="helper-box warning" ${fileMode?'hidden':''}>직접 지정 모드는 <b>Google Docs 전체 읽기·편집 권한</b>을 요청합니다. 이 앱은 지정 문서에만 요청하지만, 권한 자체는 모든 Google 문서를 포함합니다. 조직의 승인 범위에 맞게 선택하세요.</div><label class="field"><span>OAuth 클라이언트 ID</span><input name="clientId" value="${esc(cfg.clientId)}" placeholder="…apps.googleusercontent.com" autocomplete="off"><small>유형은 웹 애플리케이션. Client Secret이나 액세스 토큰 대신 공개 클라이언트 ID를 입력하세요.</small></label><div id="pickerFields" ${!fileMode?'hidden':''}><label class="field"><span>Google Picker API 키</span><input name="apiKey" type="password" value="${esc(cfg.apiKey)}" placeholder="기존 문서 선택 시 필요" autocomplete="off"><small>사이트와 API를 제한한 브라우저용 키를 사용하세요. 새 문서만 만들 때는 생략할 수 있습니다.</small></label><label class="field"><span>Google Cloud 프로젝트 번호</span><input name="projectNumber" value="${esc(cfg.projectNumber)}" placeholder="숫자로 된 프로젝트 번호" inputmode="numeric" autocomplete="off"><small>클라이언트 ID·API 키와 같은 프로젝트의 번호입니다.</small></label></div><label class="field"><span>저장할 Google 문서 URL 또는 ID</span><input name="documentId" value="${esc(cfg.documentId?`https://docs.google.com/document/d/${cfg.documentId}/edit`:'')}" placeholder="https://docs.google.com/document/d/…/edit" autocomplete="off"><small>지정 문서의 편집 권한이 필요합니다. 선택 파일 모드에서 기존 문서는 아래 「문서 선택」으로 승인하세요.</small></label><button class="btn primary" type="submit">연결 설정 저장</button></form><div class="settings-actions">${btn('Google 권한 연결','google-connect','dark')}${btn('문서 선택','google-picker','',fileMode?'':'disabled')}${btn('문서 확인','google-verify')}${btn('새 문서 만들기','google-create')}</div><div id="googleFeedback" class="helper-box">${esc(cfg.documentName?'선택 문서: '+cfg.documentName:'지정된 Google 문서를 아직 확인하지 않았습니다.')}</div>${token?btn(icon('logout')+'Google 연결 해제','google-disconnect','small'):''}<p class="inline-note">권한 토큰은 이 페이지의 메모리에만 보관합니다. 페이지를 새로 열거나 권한이 만료되면 다시 연결하세요.</p></section>
 <section class="panel settings-card"><h2>내 기록 · 백업</h2><p>실제 체크 상태·담당자·메모는 GitHub가 아니라 현재 브라우저에 저장됩니다.</p><form id="profileForm"><label class="field"><span>기록자 이름 (선택)</span><input name="ownerName" value="${esc(state.ownerName)}" placeholder="Google 저장본에 표시할 이름" maxlength="100"></label><button class="btn small" type="submit">기록자 저장</button></form><div class="storage-stats"><span>상위 업무 ${C.allTasks(state).length}건 · 보관함 포함</span><span>Google 기록 ${state.history.length}건</span></div><div class="settings-actions">${btn(icon('download')+'JSON 백업','backup')}${btn(icon('upload')+'백업 불러오기','import')}${btn('이전 로컬 백업 복구','restore-backup')}</div><p class="inline-note">PC·브라우저·사이트 주소가 바뀔 때 JSON을 내보내고 새 환경에서 불러오세요. 백업 파일에는 업무 내용이 포함되므로 개인 저장소에 보관하세요.</p>${fatalRaw?`<div class="helper-box warning">저장 원문에 복구가 필요합니다. ${btn('원문 백업','backup-raw','small')}</div>`:''}<hr class="divider-line"><div class="settings-actions">${btn('전체 업무 초기화','reset','small danger')}${conflict?btn('최신 기록 불러오기','reload','small'):''}</div><small class="muted">초기화 전 자동으로 이전 상태를 로컬 복구 사본에 보관합니다. 별도 JSON 백업도 권장합니다.</small></section></div>
 <div><section class="panel settings-card"><h2>처음 연결하는 순서</h2><p>GitHub에는 코드, Google Docs에는 업무 스냅샷을 저장합니다.</p><ol class="step-list"><li><b>웹페이지를 실행하세요.</b><br>ZIP의 <code>docs/</code> 폴더를 GitHub Pages 배포 대상으로 선택하거나 <code>start-local.bat</code>로 로컬 서버를 실행합니다.</li><li><b>Google Cloud 프로젝트를 준비하세요.</b><br>Google Docs API를 활성화합니다. 기존 문서를 선택하는 모드는 Drive API·Picker API도 활성화하세요.</li><li><b>OAuth 웹 클라이언트를 만드세요.</b><br>승인된 JavaScript 원본에 아래 주소를 등록합니다. 동의 화면과 본인의 테스트 계정 또는 내부 사용자를 설정하세요.</li><li><b>연결 설정을 저장하세요.</b><br>클라이언트 ID를 입력하고, 선택 파일 모드는 API 키와 프로젝트 번호도 넣습니다.</li><li><b>Google 권한을 승인하고 문서를 고르세요.</b><br>지정한 문서를 확인한 후, 업무 영역의 「구글로 저장하기」를 사용합니다.</li></ol><div class="helper-box"><b>현재 실행 원본</b><br><code class="code">${esc(location.protocol==='file:'?'file:// → Google 연결은 localhost 또는 HTTPS에서 사용':location.origin)}</code><br><span class="tiny">원본에는 경로(/저장소명)를 포함하지 않습니다.</span></div>${location.protocol==='file:'?'<div class="helper-box warning">지금은 파일로 열었습니다. 업무 편집은 사용할 수 있으며, Google 연결은 GitHub Pages 또는 로컬 서버에서 실행하세요.</div>':''}<details><summary>Google 권한·키 설정 도움말</summary><p>선택 파일 모드는 <code>drive.file</code> 권한을 요청하며 Google Picker 선택으로 기존 문서에 접근합니다. 프로젝트 번호·API 키·클라이언트 ID를 같은 프로젝트로 맞추세요. API 키의 웹사이트 제한에 배포 원본과 <code>https://docs.google.com/*</code>를, API 제한에는 Google Picker API를 포함합니다. 직접 지정 모드는 <code>documents</code> 범위로 전체 Docs 편집 권한을 요청하므로 승인 범위를 확인하세요.</p><p>테스트 앱은 등록된 테스트 사용자로 연결합니다. Workspace 관리자 정책 또는 OAuth 검증 설정에 따라 관리자 승인이 필요할 수 있습니다. 상세 절차는 ZIP의 SETUP_KO.md를 참고하세요.</p></details></section>
 <section class="panel settings-card"><h2>기록과 공개 범위를 분리하세요</h2><p>초기 체크리스트는 대화에서 정리한 14개 업무의 편집용 템플릿입니다. 실제 완료·담당·기한을 의미하지 않습니다.</p><div class="helper-box">브라우저 자동 저장 → 작업 중인 기록<br>Google Docs 저장 → 그 시점의 보고용 스냅샷<br>JSON 백업 → 다시 편집할 수 있는 전체 기록</div><p>브라우저 저장소와 JSON은 암호화되지 않습니다. 민감한 인사·고객 기록은 회사가 승인한 개인 기기와 접근 통제 환경에서 관리하세요.</p><p>GitHub Pages는 기본적으로 공개 사이트입니다. 배포된 코드와 초기 템플릿을 검토하고, 업무 백업·API 비밀키·내부 원문은 저장소에 올리지 마세요. 같은 원본의 다른 앱도 브라우저 저장소에 접근할 수 있으므로 전용 원본 사용을 권장합니다.</p><details><summary>Google 문서 저장 방식</summary><p>제목은 <code>[업무 영역] YYYY-MM-DD</code>입니다. 같은 날 다시 저장하면 <code>(2)</code>를 붙인 새 탭을 생성합니다. 기존 탭을 덮어쓰거나 삭제하지 않습니다. Google Docs의 체크 표시는 텍스트이며, 문서에서 바꾼 내용은 웹페이지로 역동기화되지 않습니다. 문서 탭 수 제한에 도달하면 새 기록 문서를 지정하세요.</p></details></section></div></div>`;
}
function confirmAction(title,message,{yes='확인',danger=false}={}){return new Promise(resolve=>{const d=$('#confirmDialog');d.innerHTML=`<div class="dialog-head"><h2 id="confirmTitle">${esc(title)}</h2></div><div class="dialog-body"><p>${esc(message)}</p></div><div class="dialog-actions"><button class="btn" id="confirmNo">취소</button><button class="btn ${danger?'danger':'primary'}" id="confirmYes">${esc(yes)}</button></div>`;const done=v=>{d.close();resolve(v);};$('#confirmNo').onclick=()=>done(false);$('#confirmYes').onclick=()=>done(true);d.oncancel=e=>{e.preventDefault();done(false);};d.showModal();});}
function openEditor(aid,tid){
 const a=areaById(aid);const existing=tid?a.tasks.find(x=>x.id===tid):null;
 const t=existing?C.clone(existing):{id:C.id(),title:'',description:'',output:'',owner:'',due:'',priority:'normal',status:'todo',cadence:'once',notes:'',blocker:'',subtasks:[],links:[],pinned:false,archived:false,updatedAt:'',completedAt:''};
 const d=$('#editorDialog');d.dataset.area=aid;d.dataset.task=tid||'';d.dataset.newId=t.id;
 d.innerHTML=`<div class="dialog-head"><div><h2 id="editorTitle">${existing?'할 일 편집':'새 할 일'}</h2><p>${esc(a.title)}</p></div><button class="icon-btn" data-act="close-editor" aria-label="닫기">${icon('close')}</button></div><form id="taskForm"><div class="dialog-body"><div id="editorError" class="form-error"></div><label class="field"><span>업무 제목</span><input name="title" required maxlength="300" value="${esc(t.title)}" placeholder="완료할 행동을 구체적으로 적어 주세요."></label><label class="field"><span>업무 설명</span><textarea name="description" maxlength="6000">${esc(t.description)}</textarea></label><div class="field-grid three"><label class="field"><span>상태</span><select name="status">${Object.entries(C.STATUS).map(([v,l])=>`<option value="${v}" ${t.status===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="field"><span>우선순위</span><select name="priority">${Object.entries(C.PRIORITY).map(([v,l])=>`<option value="${v}" ${t.priority===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="field"><span>점검 주기</span><select name="cadence">${Object.entries(C.CADENCE).map(([v,l])=>`<option value="${v}" ${t.cadence===v?'selected':''}>${l}</option>`).join('')}</select></label></div><div class="field-grid"><label class="field"><span>담당자</span><input name="owner" list="ownerSuggestions" maxlength="150" value="${esc(t.owner)}" placeholder="미지정"><datalist id="ownerSuggestions">${['실장','기획팀','개발팀','HR','회계팀','협의 후 지정'].map(n=>`<option value="${n}"></option>`).join('')}</datalist></label><label class="field"><span>완료 기한</span><input name="due" type="date" value="${esc(t.due)}"></label></div><label class="field"><span>완료 결과물·확인 기준</span><textarea name="output" maxlength="3000" placeholder="무엇을 만들고 어떤 상태를 확인하면 완료인가요?">${esc(t.output)}</textarea></label><span class="field-label">하위 할 일</span><div id="subEditor">${t.subtasks.map(s=>subEditorRow(s)).join('')}</div>${btn(icon('plus')+'하위 할 일 추가','add-sub-editor','small')}<label class="field" style="margin-top:20px"><span>진행 메모</span><textarea name="notes" maxlength="18000" placeholder="진행 상황·결정·다음 행동">${esc(t.notes)}</textarea></label><label class="field"><span>결정·지원 요청</span><textarea name="blocker" maxlength="6000" placeholder="누구의 어떤 결정이나 지원이 필요한가요?">${esc(t.blocker)}</textarea></label><label class="field editor-links"><span>근거 링크 · 한 줄에 하나</span><textarea name="links" placeholder="자료 제목 | https://…">${esc(t.links.map(l=>(l.label?l.label+' | ':'')+l.url).join('\n'))}</textarea><small>Slack·Google Docs·기획서 등의 URL을 붙여 넣으세요. http/https 링크만 저장합니다.</small></label><label class="export-options"><input name="pinned" type="checkbox" ${t.pinned?'checked':''}> 오늘의 집중 업무에 표시</label></div><div class="dialog-actions">${existing?btn(icon('archive')+(t.archived?'영구 삭제':'보관하기'),t.archived?'delete-task':'archive-task','small danger left',`data-area="${aid}" data-task="${tid}"`):''}${btn('취소','close-editor')}<button class="btn primary" type="submit">${existing?'변경 저장':'할 일 추가'}</button></div></form>`;
 editorDirty=false;d.showModal();d.querySelector('[name=title]').focus();
}
function subEditorRow(s){return `<div class="sub-editor-row" data-sub-id="${esc(s.id)}"><input class="check" type="checkbox" ${s.done?'checked':''} aria-label="하위 할 일 완료"><input type="text" value="${esc(s.title)}" maxlength="2000" placeholder="하위 할 일"><button type="button" class="icon-btn" data-act="remove-sub-editor" aria-label="하위 할 일 제거">${icon('close')}</button></div>`;}
async function closeEditor(){if(editorDirty&&!await confirmAction('편집 중인 내용','저장하지 않은 편집을 취소하고 닫을까요?',{yes:'편집 취소'}))return;$('#editorDialog').close();editorDirty=false;}
function saveEditor(){
 const d=$('#editorDialog'),f=$('#taskForm'),fd=new FormData(f),aid=d.dataset.area,tid=d.dataset.task;
 const title=C.clean(fd.get('title'),300).trim();if(!title)throw new Error('업무 제목을 입력하세요.');
 const due=String(fd.get('due')||'');if(due&&!C.validDate(due))throw new Error('유효한 기한을 입력하세요.');
 const links=String(fd.get('links')||'').split('\n').filter(s=>s.trim()).map(line=>{let idx=line.indexOf('|');const label=idx>=0?line.slice(0,idx).trim():'',url=C.safeUrl(idx>=0?line.slice(idx+1).trim():line.trim());if(!url)throw new Error('근거 링크를 확인하세요: '+line);return {label:C.clean(label,200),url};});
 if(links.length>30)throw new Error('링크는 업무당 30개까지 저장할 수 있습니다.');
 const subtasks=$$('#subEditor .sub-editor-row').map(row=>({id:row.dataset.subId,title:row.querySelector('input[type=text]').value.trim(),done:row.querySelector('input[type=checkbox]').checked})).filter(s=>s.title);
 const patch={title,description:C.clean(fd.get('description'),6000),output:C.clean(fd.get('output'),3000),owner:C.clean(fd.get('owner'),150).trim(),due,priority:fd.get('priority'),status:fd.get('status'),cadence:fd.get('cadence'),notes:C.clean(fd.get('notes'),18000),blocker:C.clean(fd.get('blocker'),6000),pinned:fd.get('pinned')==='on',subtasks,links,updatedAt:new Date().toISOString()};
 mutate(()=>{const a=areaById(aid);if(tid){const t=a.tasks.find(t=>t.id===tid);Object.assign(t,patch);C.setStatus(t,patch.status);}else{const t={id:d.dataset.newId,archived:false,completedAt:'',...patch};C.setStatus(t,patch.status);a.tasks.push(t);}},(tid?'업무 편집: ':'업무 추가: ')+title,aid);
 d.close();editorDirty=false;render();notify('업무를 이 브라우저에 저장했습니다.');
}
function openAreaEditor(aid){const a=areaById(aid),d=$('#editorDialog');d.dataset.area=aid;d.dataset.task='';d.innerHTML=`<div class="dialog-head"><div><h2 id="editorTitle">영역 목표·메모</h2><p>${esc(a.title)}</p></div><button class="icon-btn" data-act="close-editor" aria-label="닫기">${icon('close')}</button></div><form id="areaForm"><div class="dialog-body"><div id="editorError" class="form-error"></div><label class="field"><span>이 영역에서 만들 결과</span><textarea name="goal" required maxlength="2000">${esc(a.goal)}</textarea></label><label class="field"><span>영역 메모·결정사항</span><textarea name="notes" style="min-height:240px" maxlength="15000" placeholder="결정한 내용, 다음 점검, 대표 보고할 사항">${esc(a.notes)}</textarea></label></div><div class="dialog-actions">${btn('취소','close-editor')}<button class="btn primary" type="submit">기록 저장</button></div></form>`;editorDirty=false;d.showModal();}
function download(name,text,type='application/json'){const blob=new Blob([text],{type:type+';charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function backupFile(){download(`FranD_director_backup_${nowDate()}_${Date.now()}.json`,JSON.stringify(C.backup(state),null,2));notify('업무와 메모를 JSON 백업으로 내보냈습니다.');}
function exportMarkdown(aid){const a=areaById(aid),r=C.buildReport(a,{date:nowDate(),workspace:state.workspace,author:state.ownerName});download(`FranD_${String(a.number).padStart(2,'0')}_${nowDate()}.md`,r.text.replace(/☑ /g,'- [x] ').replace(/☐ /g,'- [ ] '),'text/markdown');}
function replaceLocalState(next){
 // This path is reached only after explicit reset/import confirmation. Preserve the
 // exact previous bytes, including a corrupt JSON file, before replacing anything.
 const oldRaw=localStorage.getItem(KEY), oldState=state, oldRevision=revision;
 const oldFatal=fatalRaw, oldConflict=conflict;
 localStorage.setItem(KEY+':previous',oldRaw||JSON.stringify(C.backup(state)));
 let storedRevision=0;
 try{const p=JSON.parse(oldRaw||'null');if(Number.isSafeInteger(p?.revision))storedRevision=p.revision;}catch{/* recovery is explicit */}
 const replacement=C.clone(next);replacement.revision=storedRevision+1;replacement.updatedAt=new Date().toISOString();
 try{
  localStorage.setItem(KEY,JSON.stringify(replacement));
  state=replacement;revision=replacement.revision;fatalRaw='';conflict=false;storageOK=true;saveError='';
 }catch(e){state=oldState;revision=oldRevision;fatalRaw=oldFatal;conflict=oldConflict;storageOK=false;saveError=e.message;throw e;}
 updateChrome();renderNotice();
}
async function importFile(file){
 if(!file)return;if(exportBusy)throw new Error('Google 저장 결과 확인 후 백업을 불러오세요.');
 if(file.size>20*1024*1024)throw new Error('20MB 이하의 JSON 백업을 선택하세요.');
 const parsed=JSON.parse(await file.text()),next=C.validateState(parsed,seed);
 if(!await confirmAction('백업 불러오기',`현재 업무를 선택한 백업으로 교체합니다.\n업무 ${C.allTasks(next).length}건 · 저장일 ${formatDateTime(parsed.exportedAt||parsed.updatedAt)}\n현재 상태는 이전 로컬 백업에 보관됩니다.`,{yes:'백업으로 교체'}))return;
 replaceLocalState(next);render();notify('백업을 불러왔습니다. Google 연결 설정은 유지됩니다.');
}
function loadScript(url,id){return new Promise((resolve,reject)=>{const exists=document.getElementById(id);if(exists){if(exists.dataset.loaded==='true'){resolve();return;}exists.addEventListener('load',()=>resolve(),{once:true});exists.addEventListener('error',()=>reject(new Error('Google 라이브러리를 불러오지 못했습니다.')),{once:true});return;}const s=document.createElement('script');s.id=id;s.src=url;s.async=true;const timer=setTimeout(()=>{s.remove();reject(new Error('Google 연결 모듈 로딩 시간이 초과되었습니다. 네트워크와 차단 설정을 확인하세요.'));},18000);s.onload=()=>{clearTimeout(timer);s.dataset.loaded='true';resolve();};s.onerror=()=>{clearTimeout(timer);s.remove();reject(new Error('Google 연결 모듈을 불러오지 못했습니다.'));};document.head.append(s);});}
async function loadGoogle(){if(window.google?.accounts?.oauth2){googleReady=true;return;}if(googleLoading)return googleLoading;googleLoading=loadScript('https://accounts.google.com/gsi/client','google-gis').then(()=>{googleReady=true;}).finally(()=>googleLoading=null);return googleLoading;}
function configFromForm(){const form=$('#googleConfigForm');if(!form)return;const data=new FormData(form),input=String(data.get('documentId')||'').trim(),cid=String(data.get('clientId')||'').trim();if(input&&!C.docId(input))throw new Error('Google Docs의 문서 URL 또는 문서 ID를 입력하세요.');if(cid&&!/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(cid))throw new Error('OAuth 클라이언트 ID는 apps.googleusercontent.com으로 끝납니다.');const mode=data.get('mode');if(cfg.clientId!==cid||cfg.mode!==mode){token='';tokenExpires=0;tokenClient=null;}const newDoc=C.docId(input);if(newDoc!==cfg.documentId)cfg.documentName='';cfg={...cfg,clientId:cid,mode,apiKey:String(data.get('apiKey')||'').trim(),projectNumber:String(data.get('projectNumber')||'').trim(),documentId:newDoc};persistCfg();updateChrome();}
function accessToken(){return token&&Date.now()<tokenExpires?token:'';}
// Called directly from a user gesture. No client secret is ever used.
function authorize(){
 if(location.protocol==='file:')return Promise.reject(new Error('Google 연결은 GitHub Pages(HTTPS) 또는 localhost에서 사용하세요. 파일 실행은 로컬 편집용입니다.'));
 if(!cfg.clientId)return Promise.reject(new Error('연결 설정에서 OAuth 클라이언트 ID를 먼저 저장하세요.'));
 if(!googleReady){loadGoogle().catch(e=>notify(e.message,true));return Promise.reject(new Error('Google 연결 모듈을 준비하고 있습니다. 잠시 후 연결 버튼을 다시 눌러 주세요.'));}
 if(accessToken())return Promise.resolve(token);
 const scope=cfg.mode==='documents'?'https://www.googleapis.com/auth/documents':'https://www.googleapis.com/auth/drive.file';
 return new Promise((resolve,reject)=>{
  tokenClient=google.accounts.oauth2.initTokenClient({client_id:cfg.clientId,scope,include_granted_scopes:false,callback:response=>{
    if(response.error){reject(new Error('Google 권한 승인을 완료하지 못했습니다: '+response.error));return;}
    if(!response.access_token || (google.accounts.oauth2.hasGrantedAllScopes&&!google.accounts.oauth2.hasGrantedAllScopes(response,scope))){reject(new Error('문서 저장에 필요한 권한을 승인하세요.'));return;}
    token=response.access_token;tokenExpires=Date.now()+(Number(response.expires_in)||3600)*1000-60000;updateChrome();resolve(token);
  },error_callback:e=>reject(new Error(e.type==='popup_closed'?'Google 연결 창이 닫혔습니다.':'Google 인증 팝업을 열 수 없습니다. 팝업 허용을 확인하세요.'))});
  tokenClient.requestAccessToken({prompt:'select_account'});
 });
}
const docs=new window.FranDGoogleDocs.DocsClient({getToken:accessToken,onJournal:async p=>{
 mutate(()=>{const i=state.pending.findIndex(x=>x.id===p.id);if(p.phase==='complete'){if(i>=0)state.pending.splice(i,1);const h=docs.result(p);if(!state.history.some(x=>x.id===h.id))state.history.unshift(h);state.history=state.history.slice(0,200);}else{if(i<0)state.pending.push(p);else state.pending[i]=p;}});
}});
function feedback(msg,error=false){const e=$('#googleFeedback');if(e){e.textContent=msg;e.classList.toggle('warning',error);}else notify(msg,error);}
async function verifyDoc(){await authorize();if(!cfg.documentId)throw new Error('저장할 Google 문서를 선택하거나 URL을 입력하세요.');const d=await docs.get(cfg.documentId);cfg.documentName=d.title||'Google 문서';persistCfg();feedback(`문서 확인: ${cfg.documentName} · ${C.flattenTabs(d.tabs).length}개 탭${d.revisionId?' · 편집 가능한 응답 확인':''}`);return d;}
async function picker(){
 if(cfg.mode!=='drive.file')throw new Error('문서 선택은 선택 파일 모드에서 사용합니다.');
 if(!cfg.apiKey||!/^\d+$/.test(cfg.projectNumber))throw new Error('문서 선택을 위해 Google Picker API 키와 프로젝트 번호를 저장하세요.');
 await authorize();await loadScript('https://apis.google.com/js/api.js','google-api');
 await new Promise((resolve,reject)=>gapi.load('picker',{callback:resolve,onerror:()=>reject(new Error('Google 문서 선택기를 불러오지 못했습니다.')),timeout:18000,ontimeout:()=>reject(new Error('문서 선택기 로딩 시간이 초과됐습니다.'))}));
 const v=new google.picker.DocsView(google.picker.ViewId.DOCUMENTS).setMimeTypes('application/vnd.google-apps.document').setMode(google.picker.DocsViewMode.LIST);
 const p=new google.picker.PickerBuilder().addView(v).setOAuthToken(accessToken()).setDeveloperKey(cfg.apiKey).setAppId(cfg.projectNumber).setOrigin(location.origin).setTitle('체크리스트를 저장할 Google 문서 선택').setCallback(data=>{
  if(data.action===google.picker.Action.PICKED){const d=data.docs?.[0];if(!d)return;cfg.documentId=d.id;cfg.documentName=d.name||'';persistCfg();render();feedback('선택한 문서: '+cfg.documentName+' · 「문서 확인」으로 편집 접근을 확인하세요.');}
 }).build();p.setVisible(true);
}
function openExport(ids){
 const d=$('#exportDialog');exportSpec={ids,includeDone:true,includeNotes:true,date:nowDate()};
 const count=ids.reduce((s,id)=>s+C.stats(areaById(id).tasks).total,0);
 d.innerHTML=`<div class="dialog-head"><div><h2 id="exportTitle">${ids.length>1?'전체 영역을 Google Docs에 저장':'구글로 저장하기'}</h2><p>${ids.length}개 업무 영역 · 전체 ${count}건 · 영역별 새 탭 생성</p></div><button class="icon-btn" data-act="close-export" aria-label="닫기">${icon('close')}</button></div><div class="dialog-body"><div class="helper-box"><b>저장 대상</b><br>${esc(cfg.documentName||cfg.documentId||'아직 Google 문서가 지정되지 않았습니다.')}<br>${cfg.documentId?`<a href="https://docs.google.com/document/d/${encodeURIComponent(cfg.documentId)}/edit" target="_blank" rel="noopener noreferrer">대상 문서 확인 ↗</a>`:''} ${btn('연결 설정','export-settings','small')}</div><label class="field"><span>기록 기준일 · 한국시간</span><input id="exportDate" type="date" value="${nowDate()}"></label><div class="export-options"><label><input id="includeDone" type="checkbox" checked> 완료 업무 포함</label><label><input id="includeNotes" type="checkbox" checked> 진행 메모·결정 요청 포함</label></div><p class="inline-note">제목: [업무 영역] 날짜 · 같은 제목이 있으면 (2), (3)으로 구분합니다.<br>Google 문서의 공유 대상이 이 내용을 볼 수 있습니다. 아래 저장 범위를 확인하세요.</p><pre id="exportPreview" class="export-preview"></pre><div id="exportStatus" class="export-status" role="status"></div></div><div class="dialog-actions">${btn('닫기','close-export')}<button class="btn primary" id="exportRun" data-act="run-export">${icon('cloud')}${ids.length>1?ids.length+'개 탭으로 저장':'구글로 저장하기'}</button></div>`;
 updateExportPreview();d.showModal();if(location.protocol!=='file:')loadGoogle().catch(()=>{});
}
function updateExportPreview(){if(!exportSpec||exportBusy)return;exportSpec.date=$('#exportDate').value;exportSpec.includeDone=$('#includeDone').checked;exportSpec.includeNotes=$('#includeNotes').checked;try {const opts={date:exportSpec.date,workspace:state.workspace,author:state.ownerName,includeDone:exportSpec.includeDone,includeNotes:exportSpec.includeNotes,requestId:'미리보기'};$('#exportPreview').textContent=exportSpec.ids.length>1?exportSpec.ids.map(id=>{const r=C.buildReport(areaById(id),opts);return `${r.title}\n업무 ${r.taskCount}건 · ${areaById(id).goal}`;}).join('\n\n'):C.buildReport(areaById(exportSpec.ids[0]),opts).text.replace(/\nFD-DESK-SNAPSHOT:미리보기\n$/,'');$('#exportRun').disabled=false;}catch(e){$('#exportPreview').textContent=e.message;$('#exportRun').disabled=true;}}
function exportStatus(msg,error=false){const el=$('#exportStatus');if(el){el.textContent=msg;el.classList.toggle('error',error);}}
async function runExport(){
 if(exportBusy)return;
 if(!cfg.documentId||!cfg.clientId){exportStatus('연결 설정에서 OAuth 클라이언트 ID와 저장할 Google 문서를 먼저 지정하세요.',true);return;}
 if(state.pending.length){exportStatus('확인이 필요한 이전 저장이 있습니다. 「Google 저장 기록」에서 이어서 확인한 후 새로 저장하세요.',true);return;}
 if(!C.validDate(exportSpec.date)){exportStatus('기록 기준일을 선택하세요.',true);return;}
 exportBusy=true;$('#exportRun').disabled=true;['exportDate','includeDone','includeNotes'].forEach(id=>$('#'+id).disabled=true);
 try{
  // Freeze the selected content before async requests so later edits do not change a snapshot.
  const options={...exportSpec,workspace:state.workspace,author:state.ownerName};
  const reports=options.ids.map(aid=>C.buildReport(C.clone(areaById(aid)),{...options,requestId:C.id()}));
  await authorize();
  for(let i=0;i<reports.length;i++){
   exportStatus(`${i+1}/${reports.length} · ${areaById(reports[i].areaId).title}\n새 탭과 본문 저장을 확인하고 있습니다…`);
   const p=await docs.prepare(cfg.documentId,reports[i]);await docs.run(p);
  }
  exportStatus(`${reports.length}개 업무 영역을 새 탭으로 저장했습니다. 기존 탭은 그대로 유지됩니다.`);
  $('#exportRun').textContent='저장 완료';$('#exportRun').disabled=true;
  mutate(()=>{},`Google Docs에 ${reports.length}개 영역 저장`);
  notify('Google 문서 탭에 저장한 본문을 확인했습니다.');render();
 }catch(e){if(e.status===401){token='';tokenExpires=0;}exportStatus(e.message+(state.pending.length?'\n창을 닫고 「Google 저장 기록」에서 이전 저장을 이어서 확인하세요.':''),true);$('#exportRun').disabled=false;updateChrome();}
 finally{exportBusy=false;['exportDate','includeDone','includeNotes'].forEach(id=>{if($('#'+id))$('#'+id).disabled=false;});}
}
async function recoverExport(id){
 if(exportBusy)return;
 const saved=state.pending.find(p=>p.id===id);if(!saved)return;
 if(!await confirmAction('이전 저장 이어서 확인',`“${saved.title}”의 저장 결과를 확인합니다.\n이미 본문이 저장돼 있으면 완료 기록만 복구하고, 비어 있는 이전 탭이면 당시 스냅샷을 이어서 씁니다.\n그 밖의 기존 내용은 보존합니다.`,{yes:'확인 후 이어 저장'}))return;
 if(exportBusy)return;exportBusy=true;
 try{await authorize();notify('Google 문서에서 이전 저장 결과를 확인하고 있습니다.');await docs.run(C.clone(saved),{allowBlankRecovery:true});render();notify('이전 저장의 본문을 확인하고 기록을 복구했습니다.');}
 catch(e){if(e.status===401){token='';tokenExpires=0;}throw e;}
 finally{exportBusy=false;updateChrome();}
}
async function handleAction(el){
 const act=el.dataset.act,aid=el.dataset.area,tid=el.dataset.task;
 if(exportBusy&&['reset','import','restore-backup','forget-export','google-disconnect'].includes(act))throw new Error('Google 저장 결과를 확인한 뒤 진행하세요.');
 if(act==='go-settings')go('settings');
 else if(act==='metric')go('all/'+el.dataset.filter);
 else if(act==='add-task')openEditor(aid);
 else if(act==='edit-task')openEditor(aid,tid);
 else if(act==='edit-area')openAreaEditor(aid);
 else if(act==='close-editor')await closeEditor();
 else if(act==='pin-task'){const {t}=findTask(aid,tid);mutate(()=>{t.pinned=!t.pinned;t.updatedAt=new Date().toISOString();},(t.pinned?'집중 업무 해제: ':'집중 업무 선택: ')+t.title,aid);render();}
 else if(act==='add-sub-editor'){$('#subEditor').insertAdjacentHTML('beforeend',subEditorRow({id:C.id(),title:'',done:false}));editorDirty=true;$('#subEditor').lastElementChild.querySelector('input[type=text]').focus();}
 else if(act==='remove-sub-editor'){el.closest('.sub-editor-row').remove();editorDirty=true;}
 else if(act==='archive-task'||act==='delete-task'){
  const {a,t}=findTask(aid,tid),deleting=act==='delete-task';
  if(await confirmAction(deleting?'업무 영구 삭제':'업무 보관',`“${t.title}”\n${deleting?'이 업무를 영구 삭제할까요? 별도 백업이 있으면 복구할 수 있습니다.':'보관함으로 이동하고 대시보드의 진행률 집계에서 제외할까요?'}`,{yes:deleting?'삭제':'보관하기',danger:deleting})){
   mutate(()=>{if(deleting)a.tasks=a.tasks.filter(x=>x.id!==tid);else{t.archived=true;t.updatedAt=new Date().toISOString();}},(deleting?'업무 삭제: ':'업무 보관: ')+t.title,aid);$('#editorDialog').close();editorDirty=false;render();notify(deleting?'업무를 삭제했습니다.':'보관함으로 이동했습니다. 상태 필터에서 복원할 수 있습니다.');
  }
 }
 else if(act==='restore-task'){const {t}=findTask(aid,tid);mutate(()=>{t.archived=false;t.updatedAt=new Date().toISOString();},'업무 복원: '+t.title,aid);render();notify('업무를 복원했습니다.');}
 else if(act==='duplicate-task'){const {a,t}=findTask(aid,tid);mutate(()=>{const x=C.clone(t);x.id=C.id();x.title+=' (복제)';x.status='todo';x.archived=false;x.pinned=false;x.due='';x.completedAt='';x.updatedAt=new Date().toISOString();x.subtasks=x.subtasks.map(s=>({...s,id:C.id(),done:false}));a.tasks.splice(a.tasks.indexOf(t)+1,0,x);},'업무 복제: '+t.title,aid);render();notify('복제한 업무의 담당·다음 기한을 확인하세요.');}
 else if(act==='move-task'){const {a,t}=findTask(aid,tid);const i=a.tasks.indexOf(t),to=i+Number(el.dataset.direction);if(to<0||to>=a.tasks.length)return;mutate(()=>{a.tasks.splice(i,1);a.tasks.splice(to,0,t);},'업무 순서 변경: '+t.title,aid);render();}
 else if(act==='backup')backupFile();
 else if(act==='export-md')exportMarkdown(aid);
 else if(act==='import'){$('#importInput').value='';$('#importInput').click();}
 else if(act==='restore-backup'){const raw=localStorage.getItem(KEY+':previous');if(!raw)throw new Error('이전 로컬 백업이 아직 없습니다.');await importFile(new File([raw],'previous.json',{type:'application/json'}));}
 else if(act==='backup-raw'){download('FranD_recovery_raw_'+Date.now()+'.txt',fatalRaw||localStorage.getItem(KEY)||'','text/plain');}
 else if(act==='reset'){if(await confirmAction('전체 업무 초기화','현재 기록을 이전 로컬 백업에 보관하고, 초기 14개 영역·62개 업무로 되돌립니다.\nGoogle 문서와 연결 설정은 변경하지 않습니다.',{yes:'초기화',danger:true})){replaceLocalState(C.createState(seed));go('dashboard');notify('초기 체크리스트로 되돌렸습니다.');}}
 else if(act==='reload'){location.reload();}
 else if(act==='google-connect'){configFromForm();await authorize();feedback('Google 권한을 연결했습니다. 문서를 선택하거나 문서 확인을 눌러 주세요.');}
 else if(act==='google-verify'){configFromForm();await verifyDoc();}
 else if(act==='google-picker'){configFromForm();await picker();}
 else if(act==='google-create'){
  configFromForm();await authorize();
  if(await confirmAction('새 기록 문서 만들기','내 Google 계정에 “Fran:D 실장 업무 기록” 문서를 만들고 저장 대상으로 지정할까요?\n체크리스트는 영역 페이지에서 저장할 때 작성됩니다.',{yes:'새 문서 만들기'})){
    // After a long confirmation the token may have expired; require another click if necessary.
    const d=await docs.create('Fran:D 실장 업무 기록');cfg.documentId=d.documentId;cfg.documentName=d.title;persistCfg();render();feedback('새 문서를 만들었습니다. 업무 영역에서 구글로 저장하기를 누르세요.');
  }
 }
 else if(act==='google-disconnect'){if(token&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(token,()=>{});token='';tokenExpires=0;render();feedback('이 앱의 Google 연결을 해제했습니다. 업무 기록과 문서는 유지됩니다.');}
 else if(act==='export-area')openExport([aid]);
 else if(act==='export-all')openExport(state.areas.map(a=>a.id));
 else if(act==='export-settings'){if(exportBusy)return;$('#exportDialog').close();go('settings');}
 else if(act==='close-export'){if(exportBusy){notify('저장 결과를 확인 중입니다. 잠시 기다려 주세요.');return;}$('#exportDialog').close();render();}
 else if(act==='run-export')await runExport();
 else if(act==='recover-export')await recoverExport(el.dataset.id);
 else if(act==='forget-export'){const p=state.pending.find(x=>x.id===el.dataset.id);if(p&&await confirmAction('미완료 저장 기록 정리','이 브라우저의 대기 기록만 지웁니다. Google 문서의 탭은 그대로 남습니다.\n문서에서 해당 저장 결과를 확인한 뒤 진행하세요.',{yes:'기록 정리'})){mutate(()=>state.pending=state.pending.filter(x=>x.id!==p.id));render();}}
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el||el.tagName==='INPUT'||el.disabled)return;e.preventDefault();Promise.resolve(handleAction(el)).catch(err=>{if($('#googleFeedback')&&el.dataset.act.startsWith('google-'))feedback(err.message,true);else notify(err.message,true);});});
document.addEventListener('change',e=>{
 const el=e.target;
 try{
  if(el.dataset.act==='toggle-task'){const {t}=findTask(el.dataset.area,el.dataset.task);const next=el.checked?'done':'doing';mutate(()=>C.setStatus(t,next),C.STATUS[next]+': '+t.title,el.dataset.area);render();}
  if(el.dataset.act==='toggle-subtask'){const {t}=findTask(el.dataset.area,el.dataset.task);mutate(()=>C.setSubtask(t,el.dataset.sub,el.checked),'하위 할 일 변경: '+t.title,el.dataset.area);expanded.add(t.id);render();}
  if(el.id==='statusFilter'){filters.status=el.value;refreshList();}
  if(el.id==='sortFilter'){filters.sort=el.value;refreshList();}
  if(['exportDate','includeDone','includeNotes'].includes(el.id))updateExportPreview();
  if(el.id==='googleMode'){const f=el.value==='drive.file';$('#scopeWarning').hidden=f;$('#pickerFields').hidden=!f;}
  if(el.closest('#subEditor')&&el.type==='checkbox'&&!el.checked){const s=$('#taskForm [name=status]');if(s?.value==='done')s.value='doing';}
 }catch(err){notify(err.message,true);render();}
});
document.addEventListener('input',e=>{if(e.target.id==='taskSearch'){filters.text=e.target.value;refreshList();}if(e.target.closest('#editorDialog'))editorDirty=true;});
document.addEventListener('toggle',e=>{if(e.target.matches?.('.task-details')){if(e.target.open)expanded.add(e.target.dataset.detail);else expanded.delete(e.target.dataset.detail);}},true);
document.addEventListener('submit',e=>{
 e.preventDefault();const form=e.target;
 try{
  if(form.id==='taskForm')saveEditor();
  else if(form.id==='areaForm'){const a=areaById($('#editorDialog').dataset.area),fd=new FormData(form);const goal=String(fd.get('goal')).trim();if(!goal)throw new Error('영역 목표를 입력하세요.');mutate(()=>{a.goal=C.clean(goal,2000);a.notes=C.clean(fd.get('notes'),15000);},'영역 목표·메모 편집',a.id);$('#editorDialog').close();editorDirty=false;render();notify('영역 기록을 저장했습니다.');}
  else if(form.id==='focusForm'){mutate(()=>state.focusNote=C.clean(new FormData(form).get('note'),5000),'실장 메모 저장');notify('실장 메모를 저장했습니다.');}
  else if(form.id==='googleConfigForm'){configFromForm();render();feedback('연결 설정을 저장했습니다. Google 권한 연결을 진행하세요.');}
  else if(form.id==='profileForm'){mutate(()=>state.ownerName=C.clean(new FormData(form).get('ownerName'),100));notify('기록자 이름을 저장했습니다.');}
  else if(form.id==='searchForm'){const q=$('#globalSearch').value.trim();go(q?'search/'+encodeURIComponent(q):'all');}
 }catch(err){const host=$('#editorError');if(host&&$('#editorDialog').open)host.textContent=err.message;else if(form.id==='googleConfigForm')feedback(err.message,true);else notify(err.message,true);}
});
$('#importInput').addEventListener('change',e=>importFile(e.target.files[0]).catch(err=>notify('백업을 불러오지 못했습니다. '+err.message,true)));
$('#menuButton').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');$('#navBackdrop').hidden=!open;$('#menuButton').setAttribute('aria-expanded',String(open));});
$('#navBackdrop').addEventListener('click',closeNav);
$('#connectionShortcut').addEventListener('click',()=>go('settings'));
$('#editorDialog').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
$('#exportDialog').addEventListener('cancel',e=>{if(exportBusy)e.preventDefault();});
window.addEventListener('hashchange',render);
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){if($('#editorDialog').open||exportBusy){conflict=true;renderNotice();notify('다른 창에서 기록이 변경되었습니다. 현재 작업을 백업 후 최신 기록을 불러오세요.',true);}else{try{const raw=JSON.parse(e.newValue);state=C.validateState(raw,seed);state.pending=raw.pending||[];revision=state.revision;render();notify('다른 창의 변경을 불러왔습니다.');}catch{notify('다른 창의 기록을 확인할 수 없습니다. 백업을 확인하세요.',true);}}}});
window.addEventListener('beforeunload',e=>{if(editorDirty||exportBusy||!storageOK){e.preventDefault();e.returnValue='';}});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeNav();if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$$('dialog[open]').length){e.preventDefault();$('#globalSearch').focus();}});
render();
// Useful for repeatable, non-network unit/UI tests and manual debugging; contains no token.
window.FranDDesk={getSnapshot:()=>C.backup(state),version:'1.0.0',storageKey:KEY};
})();
