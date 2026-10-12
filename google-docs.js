/* Google Docs adapter. OAuth token is supplied by the UI and never persisted.
   Creation and content writes are separate operations. The recovery journal
   ensures a lost HTTP response is inspected before any subsequent write. */
(function(root,factory) {
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./core.js'));
  else root.FranDGoogleDocs=factory(root.FranDCore);
})(typeof globalThis!=='undefined'?globalThis:this,function(C) {
  'use strict';
  class DocsClient {
    constructor({getToken,fetchImpl=globalThis.fetch,onJournal=async()=>{}}) {
      this.getToken=getToken; this.fetch=fetchImpl; this.onJournal=onJournal;
    }
    async api(path,{method='GET',body}={}) {
      const token=this.getToken();
      if(!token) throw new Error('Google에 연결한 뒤 다시 저장하세요.');
      const ctl=new AbortController(); const timeout=setTimeout(()=>ctl.abort(),45000);
      try {
        const res=await this.fetch('https://docs.googleapis.com/v1/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:ctl.signal});
        const data=await res.json().catch(()=>({}));
        if(!res.ok) {
          const detail=data.error?.message||`HTTP ${res.status}`;
          let hint='';
          if(res.status===401) hint='Google 연결이 만료됐습니다. 다시 연결하세요. ';
          if(res.status===403||res.status===404) hint='문서 편집 권한과 API 활성화를 확인하세요. 선택 파일 모드에서는 Google 문서 선택기로 해당 문서를 먼저 선택하세요. ';
          if(res.status===429) hint='Google 요청 제한입니다. 잠시 후 저장 기록을 확인하고 다시 시도하세요. ';
          const e=new Error(hint+detail); e.status=res.status; e.definitive=res.status<500 && res.status!==408; throw e;
        }
        return data;
      } catch(e) {
        if(e.definitive) throw e;
        const err=new Error('네트워크 응답을 확인하지 못했습니다. Google에 이미 반영됐을 수 있으므로 「이전 저장 이어서 확인」으로 결과를 확인하세요.'); err.uncertain=true; throw err;
      } finally { clearTimeout(timeout); }
    }
    get(documentId) {
      if(!C.docId(documentId)) throw new Error('유효한 Google Docs URL 또는 문서 ID를 입력하세요.');
      return this.api(`documents/${encodeURIComponent(documentId)}?includeTabsContent=true`);
    }
    async create(title) { return this.api('documents',{method:'POST',body:{title:C.clean(title,150)}}); }
    async journal(plan) { await this.onJournal(C.clone(plan)); }
    async prepare(documentId,report) {
      const doc=await this.get(documentId);
      const title=C.uniqueTabTitle(report.title,C.flattenTabs(doc.tabs).map(t=>t.tabProperties.title));
      const plan={id:report.marker.split(':').pop(),documentId,areaId:report.areaId,date:report.date,title,report,phase:'planned',tabId:'',createdAt:new Date().toISOString()};
      await this.journal(plan); return plan;
    }
    async run(plan,{allowBlankRecovery=false}={}) {
      let doc=await this.get(plan.documentId), tabs=C.flattenTabs(doc.tabs), tab;
      if(plan.tabId) {
        tab=tabs.find(t=>t.tabProperties.tabId===plan.tabId);
        if(!tab) throw new Error('저장 중이던 탭이 삭제되었거나 접근할 수 없습니다. Google 문서를 확인한 뒤 이 저장 기록을 정리하세요.');
      } else if(plan.phase==='creating') {
        const matches=tabs.filter(t=>t.tabProperties.title===plan.title);
        const done=matches.find(t=>C.tabText(t).includes(plan.report.marker));
        if(done) { plan.tabId=done.tabProperties.tabId; plan.phase='complete'; await this.journal(plan); return this.result(plan); }
        if(matches.length) {
          if(matches.length!==1 || C.tabText(matches[0]).trim()) throw new Error('같은 제목의 탭이 이미 있고 별도 내용이 들어 있습니다. 해당 탭을 보존했습니다. Google 문서에서 확인하세요.');
          if(!allowBlankRecovery) { const e=new Error('이전 요청에서 생성된 것으로 보이는 빈 탭이 있습니다. 「이전 저장 이어서 확인」에서 확인 후 이어서 저장하세요.'); e.needsRecovery=true; throw e; }
          tab=matches[0]; plan.tabId=tab.tabProperties.tabId; plan.phase='created'; await this.journal(plan);
        }
      }
      if(!tab && !plan.tabId) {
        // planned requests have never been sent, so a same-title tab belongs elsewhere.
        if(plan.phase==='planned') plan.title=C.uniqueTabTitle(plan.title,tabs.map(t=>t.tabProperties.title));
        plan.phase='creating'; await this.journal(plan);
        let added;
        try { added=await this.api(`documents/${encodeURIComponent(plan.documentId)}:batchUpdate`,{method:'POST',body:{requests:[{addDocumentTab:{tabProperties:{title:plan.title}}}],...(doc.revisionId?{writeControl:{requiredRevisionId:doc.revisionId}}:{})}}); }
        catch(e) { if(e.definitive) {plan.phase='planned';await this.journal(plan);} throw e; }
        const tabId=added.replies?.[0]?.addDocumentTab?.tabProperties?.tabId;
        if(!tabId) throw new Error('새 탭의 ID를 확인하지 못했습니다. 이전 저장 이어서 확인을 실행하세요.');
        plan.tabId=tabId; plan.phase='created'; await this.journal(plan);
        doc=await this.get(plan.documentId); tab=C.flattenTabs(doc.tabs).find(t=>t.tabProperties.tabId===tabId);
        if(!tab) throw new Error('생성한 탭을 다시 확인하지 못했습니다. 이전 저장 이어서 확인을 실행하세요.');
      }
      const existing=C.tabText(tab);
      if(existing.includes(plan.report.marker)) { plan.phase='complete'; await this.journal(plan); return this.result(plan); }
      if(existing.trim()) throw new Error('저장 대상 탭에 별도 내용이 있습니다. 자동 덮어쓰기를 하지 않고 내용을 보존했습니다. Google 문서를 확인하세요.');
      plan.phase='writing'; await this.journal(plan);
      await this.api(`documents/${encodeURIComponent(plan.documentId)}:batchUpdate`,{method:'POST',body:{requests:C.reportRequests(plan.report,plan.tabId),...(doc.revisionId?{writeControl:{requiredRevisionId:doc.revisionId}}:{})}});
      // Verify the marker instead of treating a click or tab creation as a successful save.
      const verify=await this.get(plan.documentId);
      const saved=C.flattenTabs(verify.tabs).find(t=>t.tabProperties.tabId===plan.tabId);
      if(!C.tabText(saved).includes(plan.report.marker)) throw new Error('본문 저장 확인이 필요합니다. 이전 저장 이어서 확인을 실행하세요.');
      plan.phase='complete'; await this.journal(plan); return this.result(plan);
    }
    result(plan) { return {id:plan.id,areaId:plan.areaId,title:plan.title,documentId:plan.documentId,tabId:plan.tabId,date:plan.date,taskCount:plan.report.taskCount,savedAt:new Date().toISOString()}; }
  }
  return {DocsClient};
});
