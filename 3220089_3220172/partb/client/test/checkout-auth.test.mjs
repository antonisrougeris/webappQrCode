import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = file => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
const checkout = read('pages/checkout/checkout.ts');
const api = read('services/api.ts');
function functions(source, names) {
  const ast = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true);
  return ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text))
    .map(n => n.getText(ast).replace(/^export /, '')).join('\n');
}
const js = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const guestBlock = checkout.slice(checkout.indexOf('if (!user) {\n  saveCheckoutDraft'), checkout.indexOf('\nif (checkoutSubmitting) {', checkout.indexOf('if (!user) {\n  saveCheckoutDraft')));

for (const locale of ['en', 'el']) {
  for (const exists of [true, false]) {
    test(`${locale}: guest checkout routes ${exists ? 'existing' : 'new'} account with prefill`, async () => {
      let saved = false;
      const button = { disabled: false };
      const context = vm.createContext({
        user: null, checkoutSubmitting: false, URLSearchParams,
        formEl: { querySelector: () => button }, e: { target: {} },
        formValues: { email: ' Buyer@Example.COM ', firstName: 'Ada', lastName: 'Test', phone: '+306900000000' },
        locale, window: { location: { pathname: locale === 'el' ? '/el/checkout' : '/checkout' } },
        normalizeRoutePath: p => p,
        localizedPath: p => locale === 'el' ? '/el' + p : p,
        saveCheckoutDraft: () => { saved = true; },
        accountExists: async email => { assert.equal(saved, true); assert.equal(email, 'buyer@example.com'); return exists; },
        saveCheckoutLead: async () => { throw Error('Firestore unavailable'); },
        showToast: () => assert.fail('Unexpected error'), setFlashToast: () => {},
      });
      await vm.runInContext(js(`(async () => { ${guestBlock} })()`), context);
      const url = new URL(context.window.location.href, 'https://skanare.com');
      assert.equal(url.pathname, (locale === 'el' ? '/el' : '') + (exists ? '/login' : '/register'));
      assert.equal(url.searchParams.get('email'), 'buyer@example.com');
      assert.equal(url.searchParams.get('firstName'), 'Ada');
      assert.equal(url.searchParams.get('lastName'), 'Test');
      assert.equal(url.searchParams.get('redirect'), context.window.location.pathname);
      assert.equal(url.searchParams.has('password'), false);
    });
  }
  test(`${locale}: lookup failure preserves checkout and enables retry`, async () => {
    let message = '';
    let saved = false;
    const button = { disabled: false };
    const context = vm.createContext({ user: null, checkoutSubmitting: false, URLSearchParams,
      e: { target: {} }, formEl: { querySelector: () => button },
      formValues: { email: 'buyer@example.com', firstName: 'Ada', lastName: 'Test' },
      locale, window: { location: { pathname: '/checkout' } }, normalizeRoutePath: p => p,
      saveCheckoutDraft: () => { saved = true; }, accountExists: async () => { throw Error('503'); },
      showToast: text => { message = text; },
      saveCheckoutLead: () => assert.fail('No lead capture after lookup failure'),
    });
    await vm.runInContext(js(`(async () => { ${guestBlock} })()`), context);
    assert.equal(saved, true);
    assert.equal(context.window.location.href, undefined);
    assert.equal(button.disabled, false);
    assert.equal(context.checkoutSubmitting, false);
    assert.ok(message.length);
  });
}

test('API accepts explicit true/false only; malformed responses never select registration', async () => {
  for (const response of [{ success: true, exists: true }, { success: true, exists: false }, {}, null, { success: true }, { exists: false }]) {
    const context = vm.createContext({ apiRequest: async (path, options) => {
      assert.equal(path, '/auth/account-status');
      assert.deepEqual(JSON.parse(options.body), { email: 'buyer@example.com' });
      return response;
    } });
    vm.runInContext(js(functions(api, ['accountExists'])), context);
    const result = vm.runInContext(`accountExists(' Buyer@Example.COM ')`, context);
    if (response?.success === true && typeof response.exists === 'boolean') assert.equal(await result, response.exists);
    else await assert.rejects(result);
  }
});

for (const page of ['login', 'register']) {
  test(`${page}: refresh prefills and manual auth switch preserve checkout redirect`, () => {
    const source = read(`pages/${page}/${page}.ts`);
    const inputs = Object.fromEntries(['email', 'firstName', 'lastName'].map(k => [k, { value: '' }]));
    const link = {};
    const context = vm.createContext({ URLSearchParams, locale: 'el',
      window: { location: { search: '?redirect=%2Fel%2Fcheckout&email=buyer%40example.com&firstName=Ada&lastName=Test' } },
      form: { querySelector: selector => inputs[selector.match(/name="(.*?)"/)[1]] },
      loginLink: link, registerLink: link, normalizeSameOriginPath: p => p, localizedPath: p => '/el' + p,
    });
    const switchFn = page === 'login' ? 'applyRegisterRedirect' : 'applyLoginRedirect';
    vm.runInContext(js(functions(source, ['buildAuthQuery', 'getRedirectUrl', 'applyPrefill', switchFn])), context);
    for (let refresh = 0; refresh < 2; refresh++) vm.runInContext(`applyPrefill(); ${switchFn}();`, context);
    assert.equal(inputs.email.value, 'buyer@example.com');
    if (page === 'register') { assert.equal(inputs.firstName.value, 'Ada'); assert.equal(inputs.lastName.value, 'Test'); }
    const url = new URL(link.href, 'https://skanare.com');
    assert.equal(url.searchParams.get('redirect'), '/el/checkout');
    assert.equal(url.searchParams.get('firstName'), 'Ada');
    assert.equal(url.searchParams.get('email'), 'buyer@example.com');
  });
}

test('checkout draft survives navigation/back with locker, address, explicit tip and consent policy', () => {
  const values = { firstName: 'Ada', lastName: 'Test', email: 'buyer@example.com', phone: '6900000000',
    phoneCountryCode: 'GR', locker: '{"id":"123"}', address: 'Test street 1', city: 'Athens',
    shippingMethod: 'boxnow', tipChoice: 'percent:10', personalNote: 'Gift', termsAccepted: 'on' };
  const storage = new Map([['skanare_recovery_code', 'WELCOME']]);
  const fields = Object.fromEntries(Object.entries(values).map(([name]) => [name, { name, value: '', type: name === 'tipChoice' ? 'radio' : 'text', dataset: {} }]));
  const form = { dataset: { tipChoiceExplicit: 'true' }, querySelectorAll: () => [] };
  const context = vm.createContext({ CHECKOUT_DRAFT_KEY: 'skanare_checkout_draft',
    FormData: class { forEach(fn) { Object.entries(values).forEach(([k,v]) => fn(v,k)); } },
    localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    CSS: { escape: s => s }, document: { getElementById: () => form,
      querySelector: selector => fields[selector.match(/name="(.*?)"/)[1]] },
  });
  vm.runInContext(js(functions(checkout, ['saveCheckoutDraft', 'restoreCheckoutDraft'])), context);
  context.formFixture = form;
  vm.runInContext('saveCheckoutDraft(formFixture); restoreCheckoutDraft(); restoreCheckoutDraft();', context);
  const draft = JSON.parse(storage.get('skanare_checkout_draft'));
  assert.equal(draft.termsAccepted, undefined);
  assert.equal(draft.tipChoiceExplicit, 'true');
  assert.equal(fields.tipChoice.checked, true);
  for (const name of ['firstName', 'lastName', 'email', 'phone', 'locker', 'address', 'city', 'shippingMethod', 'personalNote']) assert.equal(fields[name].value, values[name]);
  assert.equal(storage.get('skanare_recovery_code'), 'WELCOME');
  form.dataset.tipChoiceExplicit = '';
  vm.runInContext('saveCheckoutDraft(formFixture)', context);
  assert.equal(JSON.parse(storage.get('skanare_checkout_draft')).tipChoice, undefined);
});
