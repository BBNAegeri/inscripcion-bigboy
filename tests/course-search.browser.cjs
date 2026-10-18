// Run with Node.js and Playwright/Chromium available. All network access is intercepted.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(const file of fs.readdirSync(path.join(__dirname,'..')).filter(f=>/v4\.7.*\.html$/.test(f))){
   const page=await browser.newPage();const errors=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    const req=route.request();
    if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..',file))});
    if(req.url().includes('.supabase.co/')){
     if(req.method()!=='GET')writes.push(req.method());
     return route.fulfill({contentType:'application/json',body:'[]'});
    }
    return route.abort();
   });
   await page.goto('https://preview.invalid/');await page.locator('#loginDialog').waitFor({state:'visible'});
   await page.evaluate(()=>{
    loginDialog.close();
    students=['PNB','PER','PY','CY','LN'].flatMap((course,ci)=>[
     {id:ci*10+1,name:'José García López',course,year:2026,call:'Marzo'},
     {id:ci*10+2,name:'Josefina García Martín',course,year:2025,call:'Julio'},
     {id:ci*10+3,name:'Ana López García',course,year:2024,call:'Diciembre'}]);
    renderAll();
   });
   const snapshot=await page.evaluate(()=>JSON.stringify(students));
   await page.locator('nav [data-page="alumnos"]').click();
   for(const course of ['PER','PNB','PY','CY']){
    await page.locator(`[data-course="${course}"]`).click();
    const input=page.locator(`#${course.toLowerCase()}StudentSearch`);
    assert.equal(await input.isVisible(),true);
    assert.equal(await page.locator('[id$="StudentSearchWrap"]:visible').count(),1);
    await page.locator('#studentYear').selectOption('2026');
    if(course!=='PNB')await page.locator('#studentCall').selectOption('Marzo');
    const ids=()=>page.locator('#studentTable tbody button[onclick^="editStudent("]').evaluateAll(buttons=>buttons.map(b=>b.getAttribute('onclick')));
    assert.equal((await ids()).length,1);
    await input.pressSequentially('a');assert.equal((await ids()).length,3);
    await input.fill('JOSE GARCIA');assert.equal((await ids()).length,2);
    const broad=await ids();await input.pressSequentially(' L');
    const narrow=await ids();assert.equal(narrow.length,1);assert.ok(narrow.every(id=>broad.includes(id)));
    await input.fill('MÁRTIN');assert.match(await page.locator('#studentTable tbody').innerText(),/Josefina/);
    await input.fill('lopez JOSE');assert.match(await page.locator('#studentTable tbody').innerText(),/José García López/);
    assert.equal(await page.locator('#studentYear').inputValue(),'2026');
    if(course!=='PNB')assert.equal(await page.locator('#studentCall').inputValue(),'Marzo');
    const renderedIndexes=await page.locator('#studentTable tbody button[onclick^="editStudent("]').evaluateAll(bs=>bs.map(b=>Number(b.getAttribute('onclick').match(/\d+/)[0])));
    assert.equal(await page.evaluate(({indexes,course})=>indexes.every(i=>students[i].course===course),{indexes:renderedIndexes,course}),true);
    await input.fill('zzzz');assert.match(await page.locator('#studentTable tbody').innerText(),new RegExp('No hay alumnos '+course));
    await input.fill('');assert.equal((await ids()).length,1);
    assert.equal(await page.locator('#studentSectionTitle').innerText(),course+' · 2026'+(course==='PNB'?'':' · Marzo'));
    await input.fill('martin');
    console.log(`PASS ${file}: ${course}, live search, accents, names/surnames, all years/calls, course isolation, filter restoration`);
   }
   // Each course keeps its own search text; PER retains its original behavior.
   await page.locator('[data-course="PER"]').click();assert.equal(await page.locator('#perStudentSearch').inputValue(),'martin');
   assert.match(await page.locator('#studentTable tbody').innerText(),/Josefina/);
   assert.equal(await page.evaluate(()=>JSON.stringify(students)),snapshot);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
