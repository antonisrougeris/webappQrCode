/**
 * Native password managers can visually restore an earlier saved login after
 * the user has replaced it, particularly while the fields are autofill-blue.
 * Remember the most recent input events in memory (never localStorage), so a
 * submit uses the values the user actually typed.
 *
 * Untouched autofilled credentials still work via the live DOM values.
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

export function observeLoginCredentials(form: HTMLFormElement): () => LoginCredentials {
  const emailField = form.querySelector<HTMLInputElement>('input[name="email"]');
  const passwordField = form.querySelector<HTMLInputElement>('input[name="password"]');

  if (!emailField || !passwordField) {
    throw new Error("Missing login credentials fields");
  }

  let lastEmailInput: string | undefined;
  let lastPasswordInput: string | undefined;

  emailField.addEventListener("input", () => {
    lastEmailInput = emailField.value;
  });
  passwordField.addEventListener("input", () => {
    lastPasswordInput = passwordField.value;
  });

  return () => ({
    email: (lastEmailInput ?? emailField.value).trim(),
    password: lastPasswordInput ?? passwordField.value,
  });
}
