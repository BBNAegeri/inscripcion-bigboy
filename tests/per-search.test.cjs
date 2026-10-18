const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
for(const file of fs.readdirSync(path.join(__dirname,'..')).filter(f=>/v4\.7.*\.html$/.test(f))){
 const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const render=html.slice(html.indexOf('function renderStudents()'),html.indexOf('\nfunction openLicense()'));
 function fixture(){
  const students=[
   {id:1,name:'José García López',course:'PER',year:2026,call:'Marzo'},
   {id:2,name:'Josefina García Martín',course:'PER',year:2025,call:'Julio'},
   {id:3,name:'Ana López García',course:'PER',year:2024,call:'Diciembre'},
   {id:4,name:'José García López',course:'PY',year:2026,call:'Marzo'}
  ];
  const body={innerHTML:''};
  const otherSearchControls=Object.fromEntries(['pnb','py','cy'].flatMap(prefix=>[[prefix+'StudentSearch',{value:''}],[prefix+'StudentSearchWrap',{style:{}}]]));
  const context=vm.createContext({...otherSearchControls,students,studentCourseFilter:'PER',studentYear:{value:'2026'},studentCall:{value:'Marzo'},studentCallWrap:{style:{}},perStudentSearchWrap:{style:{}},perStudentSearch:{value:''},studentSectionTitle:{},studentTable:{querySelector:()=>body},eur:()=>'',practiceCell:()=>''});
  vm.runInContext(render,context);
  const search=query=>{context.perStudentSearch.value=query;context.renderStudents();return body.innerHTML};
  return {context,students,search,body};
 }
 test(`${file}: search is wired to input, with visible label`,()=>{
  assert.match(html,/<label for="perStudentSearch">Buscar alumno por nombre o apellidos<\/label>/);
  assert.match(html,/<input id="perStudentSearch"[^>]*oninput="renderStudents\(\)"/);
 });
 test(`${file}: first character ignores year and call without changing filters`,()=>{
  const f=fixture();const result=f.search('a');
  assert.equal((result.match(/onclick="editStudent/g)||[]).length,3);
  assert.equal(f.context.studentYear.value,'2026');assert.equal(f.context.studentCall.value,'Marzo');
  assert.match(f.context.studentSectionTitle.textContent,/todos los años y convocatorias/);
 });
 test(`${file}: progressive search, accents, casing and surname combinations`,()=>{
  const f=fixture();let previous=Infinity;
  for(const query of ['j','jo','jos','jose','jose g','jose garcia l']){
   const count=(f.search(query).match(/onclick="editStudent/g)||[]).length;
   assert.ok(count<=previous);previous=count;
  }
  for(const query of ['JOSÉ GARCÍA LÓPEZ','jose garcia lopez','lopez jose','  jose   lopez ']){
   const result=f.search(query);assert.match(result,/editStudent\(0\)/);assert.doesNotMatch(result,/editStudent\([123]\)/);
  }
  assert.match(f.search('martin'),/editStudent\(1\)/);
  assert.match(f.search('ana garcia'),/editStudent\(2\)/);
 });
 test(`${file}: clearing or whitespace restores original filters`,()=>{
  const f=fixture();f.search('martin');
  for(const query of ['', '   ']){
   const result=f.search(query);assert.match(result,/editStudent\(0\)/);assert.doesNotMatch(result,/editStudent\([123]\)/);
   assert.equal(f.context.studentSectionTitle.textContent,'PER · 2026 · Marzo');
  }
 });
 test(`${file}: other courses unaffected and no results message`,()=>{
  const f=fixture();assert.match(f.search('zzzz'),/No hay alumnos PER que coincidan/);
  f.context.studentCourseFilter='PY';const result=f.search('zzzz');
  assert.match(result,/editStudent\(3\)/);assert.equal(f.context.perStudentSearchWrap.style.display,'none');
 });
 test(`${file}: rendering never mutates students or calls the network`,()=>{
  const f=fixture(),before=JSON.stringify(f.students);
  for(const query of ['j','martin','','garcia'])f.search(query);
  assert.equal(JSON.stringify(f.students),before);
 });
}
