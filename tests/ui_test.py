from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json, re, os, shutil
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-output'; OUT.mkdir(exist_ok=True)
def mount(page, route='', storage=None):
 # Render application locally without network navigation. This container's managed
 # Chromium blocks URL navigation. A standards-shaped storage stub is used only
 # by this UI harness; the shipped app uses real browser localStorage.
 html=(ROOT/'index.html').read_text()
 html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>', '', html)
 html=re.sub(r'<script[^>]+src=[^>]+></script>', '', html)
 html=html.replace('<link rel="stylesheet" href="styles.css">','<style>'+(ROOT/'styles.css').read_text()+'</style>')
 page.set_content(html)
 page.evaluate("""(args)=>{
 window.__testStorage=args.storage||{};
 Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__testStorage[k]??null,setItem:(k,v)=>window.__testStorage[k]=String(v),removeItem:k=>delete window.__testStorage[k]},configurable:true});
 location.hash=args.route;
 }""", {'storage':storage,'route':route})
 for file in ['config.js','seed.js','core.js','google-docs.js','app.js']:
  page.add_script_tag(content=(ROOT/file).read_text())
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1512,'height':1100},device_scale_factor=1)
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 mount(page);page.wait_for_selector('.area-card')
 assert page.locator('.area-card').count()==14
 assert '대시보드' in page.title()
 page.screenshot(path=str(OUT/'dashboard.png'),full_page=True)
 page.locator('a[href="#area/people"].area-card').click()
 expect(page.locator('.task-card')).to_have_count(5)
 page.screenshot(path=str(OUT/'people.png'),full_page=True)
 # Complete + persist task; its subtasks become complete.
 page.locator('[data-act="toggle-task"][data-task="people-01"]').check()
 saved=page.evaluate('Object.assign({},window.__testStorage)');page.close();page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));mount(page, '#area/people', saved);page.wait_for_selector('.task-card')
 assert page.locator('[data-act="toggle-task"][data-task="people-01"]').is_checked()
 page.locator('[data-detail="people-01"] summary').click()
 expect(page.locator('[data-detail="people-01"] input:checked')).to_have_count(3)
 page.locator('[data-act="toggle-subtask"][data-task="people-01"]').first.uncheck()
 assert not page.locator('[data-act="toggle-task"][data-task="people-01"]').is_checked()
 # Existing editor, field persistence and XSS-safe rendering.
 page.locator('[data-act="edit-task"][data-task="people-02"]').first.click()
 form=page.locator('#taskForm')
 form.locator('[name=title]').fill('R&R 실제 업무 맵 확정 <script>bad()</script>')
 form.locator('[name=owner]').fill('테스트전담자')
 form.locator('[name=due]').fill('2026-10-01')
 form.locator('[name=status]').select_option('blocked')
 form.locator('[name=priority]').select_option('high')
 form.locator('[name=notes]').fill('실제 업무량과 겸임 역할 확인\n확정 후 채용계획 연결')
 form.locator('[name=blocker]').fill('팀장과 완료 기준 협의')
 form.locator('[name=links]').fill('근거 문서 | https://example.com/proof')
 form.locator('button[type=submit]').click()
 assert page.locator('article[data-task-card="people-02"] h3').inner_text().endswith('<script>bad()</script>')
 assert page.locator('#task-list script').count()==0
 page.locator('[data-act="pin-task"][data-task="people-02"]').click()
 page.locator('#statusFilter').select_option('blocked');expect(page.locator('.task-card')).to_have_count(1)
 page.locator('#statusFilter').select_option('all')
 # Add, substep add, duplicate, archive, restore.
 page.locator('[data-act=add-task]').click();form=page.locator('#taskForm')
 form.locator('[name=title]').fill('새 채용 과제')
 page.locator('[data-act=add-sub-editor]').click();page.locator('#subEditor input[type=text]').fill('면접 평가표 검토')
 form.locator('button[type=submit]').click();expect(page.locator('.task-card')).to_have_count(6)
 new_id=page.locator('article').last.get_attribute('data-task-card')
 page.locator(f'[data-act="edit-task"][data-task="{new_id}"]').first.click()
 page.locator('[data-act=archive-task]').click();page.locator('#confirmYes').click()
 expect(page.locator('.task-card')).to_have_count(5)
 page.locator('#statusFilter').select_option('archived');expect(page.locator('.task-card')).to_have_count(1)
 page.locator('[data-act=restore-task]').click();expect(page.locator('.task-card')).to_have_count(0)
 page.locator('#statusFilter').select_option('all');expect(page.locator('.task-card')).to_have_count(6)
 # Export preview contents and note filtering.
 page.locator('[data-act=export-area]').first.click()
 expect(page.locator('#exportPreview')).to_contain_text('R&R 실제 업무 맵 확정')
 expect(page.locator('#exportPreview')).to_contain_text('실제 업무량과 겸임 역할 확인')
 page.locator('#includeNotes').uncheck();expect(page.locator('#exportPreview')).not_to_contain_text('실제 업무량과 겸임 역할 확인')
 page.locator('#exportRun').click();expect(page.locator('#exportStatus')).to_contain_text('먼저 지정')
 page.locator('[data-act=close-export]').last.click()
 # JSON download is real and contains changed data, no credentials.
 with page.expect_download() as dl:page.locator('#sidebar a[href="#settings"]').click();page.locator('[data-act=backup]').click()
 data=json.loads(Path(dl.value.path()).read_text())
 assert data['areas'][1]['tasks'][1]['owner']=='테스트전담자'
 assert 'clientId' not in data and 'access_token' not in data
 # Google scripts fail harmlessly offline; local UI still works.
 page.screenshot(path=str(OUT/'settings.png'),full_page=True)
 page.evaluate("location.hash='dashboard'")
 expect(page.locator('.focus-info')).to_have_count(1)
 expect(page.locator('.metric.alert .metric-value')).to_contain_text('1')
 # Global search.
 page.locator('#globalSearch').fill('테스트전담자');page.locator('#searchForm').evaluate('(form)=>form.requestSubmit()')
 expect(page.locator('.task-card')).to_have_count(1)
 # Mobile fresh context / no horizontal overflow.
 m=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 mobile=m.new_page();mount(mobile);mobile.wait_for_selector('.area-card')
 assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
 mobile.screenshot(path=str(OUT/'mobile-dashboard.png'),full_page=True)
 mobile.locator('#menuButton').click();mobile.locator('#sidebar a[href="#area/people"]').click()
 expect(mobile.locator('h1')).to_contain_text('조직설계')
 assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
 mobile.wait_for_timeout(350)
 mobile.screenshot(path=str(OUT/'mobile-area.png'),full_page=True)
 # Snapshot all 14 areas rendered and no horizontal overflow.
 for area in page.evaluate('window.FRAND_SEED.areas.map(a=>a.id)'):
  page.evaluate('(a)=>location.hash="area/"+a', area);page.wait_for_timeout(60);page.wait_for_selector('.task-card')
  assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'),area
 assert not errors,errors
 print(json.dumps({'ui':'passed','pageerrors':errors,'screenshots':str(OUT),'areas':14,'checks':['persistence','task/subtask transitions','edit','XSS escaping','add','archive/restore','filter','pin','JSON backup','export preview','mobile','all area routes']},ensure_ascii=False,indent=2))
 browser.close()
