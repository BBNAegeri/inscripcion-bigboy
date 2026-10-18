const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const file of fs.readdirSync(path.join(__dirname, '..')).filter(f => /v4\.7.*\.html$/.test(f))) {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const source = scripts.join('\n');
  const handler = source.slice(source.indexOf('async function deleteLicenseStudent('), source.indexOf('function addLicStudent('));
  const renderer = source.slice(source.indexOf('function renderLicenses()'), source.indexOf('\nfunction fillYears()'));
  function fixture(response = [{ licencia_id: 'license-1', alumno_id: 'student-1' }], confirmed = true) {
    const student = { id: 'student-1', name: 'Alumno de prueba', doc: 'TEST', paid: true };
    const license = { id: 'license-1', date: '2026-10-18', price: 125, students: [student], finished: false };
    const calls = [], alerts = [], confirmations = [];
    const context = vm.createContext({
      licenses: [license, { ...license, id: 'license-2', students: [student] }],
      students: [student], licenseList: { innerHTML: '' }, eur: n => `${n} €`,
      confirm: text => { confirmations.push(text); return confirmed; },
      alert: text => alerts.push(text),
      api: async (...args) => { calls.push(args); if (response instanceof Error) throw response; return response; },
      renderAll: () => { context.renders++; context.renderLicenses(); }, renders: 0,
    });
    vm.runInContext(handler + '\n' + renderer, context);
    return { context, calls, alerts, confirmations, student, license };
  }
  test(`${file}: all inline scripts parse`, () => {
    for (const script of scripts) new vm.Script(script, { filename: file });
  });
  test(`${file}: cancel sends no request`, async () => {
    const f = fixture(undefined, false);
    await f.context.deleteLicenseStudent(0, 0);
    assert.equal(f.calls.length, 0);
    assert.equal(f.context.renders, 0);
    assert.equal(f.license.students.length, 1);
    assert.match(f.confirmations[0], /Se conservarán su ficha y la licencia/);
  });
  test(`${file}: confirmed deletion targets only the selected relationship and refreshes`, async () => {
    const f = fixture();
    await f.context.deleteLicenseStudent(0, 0);
    assert.deepEqual(f.calls, [['/rest/v1/licencia_alumnos?licencia_id=eq.license-1&alumno_id=eq.student-1', 'DELETE', null, 'return=representation']]);
    assert.equal(f.license.students.length, 0);
    assert.equal(f.context.licenses.length, 2);
    assert.equal(f.context.students[0], f.student);
    assert.equal(f.context.licenses[1].students[0], f.student);
    assert.equal(f.context.renders, 1);
    assert.equal(f.alerts.length, 0);
    assert.match(f.context.licenseList.innerHTML, /colspan="5"/);
  });
  for (const [name, result] of [['HTTP or network failure', new Error('Supabase denied')], ['RLS zero rows', []], ['unexpected empty response', null]]) {
    test(`${file}: ${name} shows error and retains relation`, async () => {
      const f = fixture(result);
      await f.context.deleteLicenseStudent(0, 0);
      assert.equal(f.alerts.length, 1);
      assert.match(f.alerts[0], /No se pudo eliminar/);
      assert.equal(f.license.students.length, 1);
      assert.equal(f.context.renders, 0);
    });
  }
  test(`${file}: stale indexes never send a DELETE`, async () => {
    const f = fixture();
    await f.context.deleteLicenseStudent(99, 0);
    await f.context.deleteLicenseStudent(0, 99);
    assert.equal(f.calls.length, 0);
    assert.equal(f.alerts.length, 2);
  });
  test(`${file}: renderer covers open, finished, review sent and empty licenses`, () => {
    const f = fixture();
    for (const finished of [false, true]) for (const reviewSent of [false, true]) {
      f.license.finished = finished;
      f.student.reviewSent = reviewSent;
      f.context.renderLicenses();
      const html = f.context.licenseList.innerHTML;
      assert.match(html, /onclick="deleteLicenseStudent\(0,0\)">Eliminar/);
      assert.match(html, /<th>Acciones<\/th>/);
      for (const m of html.matchAll(/onclick="([^"]*)"/g)) new vm.Script(m[1]);
    }
    f.context.licenses = [];
    f.context.renderLicenses();
    assert.match(f.context.licenseList.innerHTML, /Todavía no hay Licencias/);
  });
}
