import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const helper = readFileSync("src/pages/login/login-credentials.ts", "utf8");
const login = readFileSync("src/pages/login/login.ts", "utf8");
const html = readFileSync("src/pages/login/login.html", "utf8");
const visibility = readFileSync("src/utils/password-visibility.ts", "utf8");

function createReaderFixture(savedEmail = "saved@example.com", savedPassword = "saved-password") {
  function makeInput(value) {
    const listeners = new Map();
    return {
      value,
      addEventListener(event, listener) {
        listeners.set(event, listener);
      },
      input(value) {
        this.value = value;
        listeners.get("input")?.();
      },
    };
  }
  const email = makeInput(savedEmail);
  const password = makeInput(savedPassword);
  const form = {
    querySelector(selector) {
      return selector.includes('name="email"') ? email : password;
    },
  };
  const context = { exports: {} };
  const js = ts.transpileModule(helper, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, context);
  return { email, password, read: context.exports.observeLoginCredentials(form) };
}

test("saved credentials still work when the user leaves the autofilled fields untouched", () => {
  const { read } = createReaderFixture();
  assert.deepEqual({ ...read() }, {
    email: "saved@example.com",
    password: "saved-password",
  });
});

test("manual account switch wins if the browser restores the blue autofill values before submit", () => {
  const { email, password, read } = createReaderFixture();
  email.input(" New@Example.COM ");
  password.input("new-user-password");
  // Emulate a password manager restoring the old DOM values on blur without
  // emitting a new input event.
  email.value = "saved@example.com";
  password.value = "saved-password";
  assert.deepEqual({ ...read() }, {
    email: "New@Example.COM",
    password: "new-user-password",
  });
});

test("manual clearing never silently falls back to saved credentials", () => {
  const { email, password, read } = createReaderFixture();
  email.input("");
  password.input("");
  email.value = "saved@example.com";
  password.value = "saved-password";
  assert.deepEqual({ ...read() }, { email: "", password: "" });
});

test("login snapshots after URL prefill and authenticates with the observed credentials", () => {
  assert.match(login, /applyPrefill\(\);[\s\S]*?readCredentials = observeLoginCredentials\(form\)/);
  assert.match(login, /\(readCredentials \?\? observeLoginCredentials\(form\)\)\(\)/);
  assert.match(login, /credentials\.user\.email[\s\S]*?email\.toLowerCase\(\)/);
  assert.match(login, /user\.uid !== credentials\.user\.uid/);
  assert.doesNotMatch(login, /new FormData\(form\)/);
});

test("login keeps password input mounted and uses correct password-manager autocomplete hints", () => {
  assert.match(html, /autocomplete="username"/);
  assert.match(html, /class="password-visibility">\s*<input\s+name="password"/);
  assert.match(html, /autocomplete="current-password"/);
  assert.match(visibility, /if \(!wrapper\?\.classList\.contains\("password-visibility"\)\)/);
});
