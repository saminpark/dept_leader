"""Browser integration tests with mocked Google Identity/Docs, no external writes."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json, re, hashlib, base64, os, shutil
ROOT=Path(__file__).resolve().parents[1]
GOOGLE_MOCK=r'''
window.FRAND_CONFIG={clientId:'123456-test.apps.googleusercontent.com',mode:'documents',apiKey:'',projectNumber:'',documentId:'abcdefghijklmno',documentName:'모의 문서',timezone:'Asia/Seoul'};
window.google={accounts:{oauth2:{initTokenClient:opts=>({requestAccessToken:()=>opts.callback({access_token:'mock-memory-only',expires_in:3600,scope:opts.scope})}),hasGrantedAllScopes:()=>true,revoke:(_,cb)=>cb()}}};
window.__doc={documentId:'abcdefghijklmno',title:'모의 문서',revisionId:'r1',tabs:[{tabProperties:{tabId:'original',title:'기존 사용자 탭'},documentTab:{body:{content:[{paragraph:{elements:[{textRun:{content:'원래 내용 유지\n'}}]}}]}}}]};
window.__requests=[];window.__failWrite=false;window.__seq=1;
window.fetch=async(url,opts)=>{
 if(!url.startsWith('https://docs.googleapis.com/v1/'))throw Error('Unexpected network destination');
 if(opts.method==='GET')return {ok:true,json:async()=>structuredClone(__doc)};
 const data=JSON.parse(opts.body);__requests.push(data);
 if(data.writeControl?.requiredRevisionId!==__doc.revisionId)throw Error('Bad revision');
 let replies=[];
 for(const req of data.requests){
  if(req.addDocumentTab){const p={tabId:'tab'+__seq++,title:req.addDocumentTab.tabProperties.title};__doc.tabs.push({tabProperties:p,documentTab:{body:{content:[]}}});replies.push({addDocumentTab:{tabProperties:p}});}
  if(req.insertText){const id=req.insertText.endOfSegmentLocation.tabId,t=__doc.tabs.find(t=>t.tabProperties.tabId===id);if(!t)throw Error('Missing tab');t.documentTab.body.content=[{paragraph:{elements:[{textRun:{content:req.insertText.text}}]}}];}
 }
 __doc.revisionId='r'+(__requests.length+1);
 if(__failWrite&&data.requests[0]?.insertText){__failWrite=false;throw Error('lost HTTP response after writing');}
 return {ok:true,json:async()=>({replies})};
};
'''
def mount(page, storage=None, mock=False):
 html=(ROOT/'index.html').read_text()
 html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>', '', html)
 html=re.sub(r'<script[^>]+src=[^>]+></script>', '', html)
 html=html.replace('<link rel="stylesheet" href="styles.css">','<style>'+(ROOT/'styles.css').read_text()+'</style>')
 page.set_content(html)
 page.evaluate('''data=>{window.__storage=data||{};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__storage[k]??null,setItem:(k,v)=>window.__storage[k]=String(v),removeItem:k=>delete window.__storage[k]},configurable:true});}''',storage)
 page.add_script_tag(content=(ROOT/'config.js').read_text())
 if mock:page.add_script_tag(content=GOOGLE_MOCK)
 for name in ['seed.js','core.js','google-docs.js','app.js']:page.add_script_tag(content=(ROOT/name).read_text())
 page.wait_for_selector('.area-card')

def read_snapshot(page):return page.evaluate('FranDDesk.getSnapshot()')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1365,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));mount(page,mock=True)
 # Desktop toggle invisible after specificity fix.
 expect(page.locator('#menuButton')).not_to_be_visible()
 page.locator('a.area-card[href="#area/people"]').click()
 page.locator('[data-act=edit-area]').first.click()
 page.locator('#areaForm [name=goal]').fill('이번 달 R&R과 채용 우선순위 확정')
 page.locator('#areaForm [name=notes]').fill('영역별 증빙과 결정사항')
 page.locator('#areaForm button[type=submit]').click()
 assert read_snapshot(page)['areas'][1]['goal']=='이번 달 R&R과 채용 우선순위 확정'
 # Actual click -> auth callback -> Docs requests -> verified history, all mocked.
 for n in range(2):
  page.locator('[data-act=export-area]').first.click()
  page.locator('#exportDate').fill('2026-10-08');page.locator('#exportDate').dispatch_event('change')
  page.locator('#exportRun').click();expect(page.locator('#exportStatus')).to_contain_text('새 탭으로 저장했습니다',timeout=10000)
  page.locator('[data-act=close-export]').last.click()
 h=read_snapshot(page)['history'];assert len(h)==2;assert h[0]['title']=='[조직설계·채용·평가·육성] 2026-10-08 (2)'
 assert page.evaluate('__doc.tabs[0].documentTab.body.content[0].paragraph.elements[0].textRun.content')=='원래 내용 유지\n'
 assert 'mock-memory-only' not in page.evaluate('JSON.stringify(__storage)')
 # Save all fourteen domains through UI.
 page.evaluate("location.hash='dashboard'");page.locator('[data-act=export-all]').click();page.locator('#exportRun').click()
 expect(page.locator('#exportStatus')).to_contain_text('14개 업무 영역을 새 탭으로 저장했습니다',timeout=10000)
 page.locator('[data-act=close-export]').last.click();assert len(read_snapshot(page)['history'])==16
 # Simulate lost write reply and recover with no additional remote mutation.
 page.evaluate("location.hash='area/people'");page.locator('[data-act=export-area]').first.click()
 page.evaluate('__failWrite=true');page.locator('#exportRun').click()
 expect(page.locator('#exportStatus')).to_contain_text('이전 저장',timeout=10000)
 page.locator('[data-act=close-export]').last.click();page.evaluate("location.hash='history'")
 expect(page.locator('[data-act=recover-export]')).to_have_count(1)
 before=page.evaluate('__requests.length');page.locator('[data-act=recover-export]').click();page.locator('#confirmYes').click()
 expect(page.locator('[data-act=recover-export]')).to_have_count(0)
 assert page.evaluate('__requests.length')==before
 assert len(read_snapshot(page)['history'])==17
 # JSON import and reset restore. Use existing schema, adding a distinct note.
 data=read_snapshot(page);data['focusNote']='백업에서 복원한 메모';page.evaluate("location.hash='settings'")
 page.locator('#importInput').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
 page.locator('#confirmYes').click();assert read_snapshot(page)['focusNote']=='백업에서 복원한 메모'
 page.locator('[data-act=reset]').click();page.locator('#confirmYes').click();assert read_snapshot(page)['focusNote']==''
 page.evaluate("location.hash='settings'");page.locator('[data-act=restore-backup]').click();page.locator('#confirmYes').click()
 assert read_snapshot(page)['focusNote']=='백업에서 복원한 메모'
 # Invalid import preserves the current data.
 page.locator('#importInput').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':b'{broken'})
 expect(page.locator('#toast')).to_contain_text('불러오지 못했습니다');assert read_snapshot(page)['focusNote']=='백업에서 복원한 메모'
 # Corrupted initial storage requires explicit recovery; reset keeps original bytes.
 key=page.evaluate('FranDDesk.storageKey');corrupt=browser.new_page();mount(corrupt,{key:'{broken'})
 expect(corrupt.locator('#noticeHost')).to_contain_text('복구');corrupt.evaluate("location.hash='settings'")
 corrupt.locator('[data-act=reset]').click();corrupt.locator('#confirmYes').click()
 assert corrupt.evaluate('(k)=>__storage[k+":previous"]',key)=='{broken'
 assert read_snapshot(corrupt)['revision']==1
 # The standalone HTML keeps scripts after DOM, and CSP hashes match exact script bytes.
 html=(ROOT/'FranD_Director_Desk.html').read_text();scripts=re.findall(r'<script>([\s\S]*?)</script>',html)
 assert len(scripts)==5
 csp=re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)"',html).group(1)
 for script in scripts:
  digest=base64.b64encode(hashlib.sha256(script.encode()).digest()).decode();assert "'sha256-"+digest+"'" in csp
 assert html.index('<script>')>html.index('id="importInput"')
 single=browser.new_page();single.on('pageerror',lambda e:errors.append(str(e)))
 # about:blank cannot access persistent browser storage. This standalone smoke test
 # leaves that restriction intact: the app must still render and show storage notice.
 single.set_content(html);single.wait_for_selector('.area-card');assert single.locator('.area-card').count()==14
 assert not errors,errors
 result={'ui_integration':'passed','checks':['mock OAuth and Docs save','same-day new tab','all 14 domains','lost-write recovery','area editing','JSON import','reset and restore','corrupt storage recovery','standalone HTML CSP/boot'],'real_google_tested':False,'errors':errors}
 print(json.dumps(result,ensure_ascii=False,indent=2))
 browser.close()
