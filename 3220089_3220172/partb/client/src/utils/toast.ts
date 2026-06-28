const FLASH_TOAST_KEY = "skanare_flash_toast";

export function showToast(message: string): void {
  let stack = document.getElementById("toastStack");

  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (stack && stack.children.length === 0) stack.remove();
  }, 7000);
}

export function setFlashToast(message: string): void {
  sessionStorage.setItem(FLASH_TOAST_KEY, message);
}

export function showFlashToast(): void {
  const message = sessionStorage.getItem(FLASH_TOAST_KEY);
  if (!message) return;

  sessionStorage.removeItem(FLASH_TOAST_KEY);

  setTimeout(() => {
    showToast(message);
  }, 250);
}