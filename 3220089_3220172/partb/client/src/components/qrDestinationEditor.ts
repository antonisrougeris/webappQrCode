import { API_BASE_URL } from "../services/api";
import { firebaseAuth } from "../services/firebase";
import { activateQrPhoto, updateQrCode, uploadQrPhoto, type QrCode } from "../services/qr";
import { translatePhrase } from "../i18n/locale";

const MAX_PHOTO = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const say = (phrase: string): string => translatePhrase(phrase);
type DestinationMode = "link" | "photo";

/**
 * The homepage and My QR page deliberately share one editor and one action.
 * Changing a tab only changes the draft; the QR destination changes on submit.
 */
export function enhanceQrDestinationEditors(container: HTMLElement, qrCodes: QrCode[]): void {
  for (const qr of qrCodes) {
    const card = Array.from(container.querySelectorAll<HTMLElement>("[data-qr-editor]"))
      .find((element) => element.dataset.qrEditor === qr.id);
    if (!card) continue;

    const linkRow = card.querySelector<HTMLElement>("[data-qr-link-fields]");
    const linkInput = linkRow?.querySelector<HTMLInputElement>('input[type="url"]');
    const action = card.querySelector<HTMLButtonElement>(".qr-save-btn, [data-my-qr-save]");
    const oldLabel = card.querySelector<HTMLLabelElement>("[data-qr-destination-label]");
    if (!linkRow || !linkInput || !action) continue;

    let mode: DestinationMode = qr.destinationType === "photo" ? "photo" : "link";
    let busy = false;
    let previewVersion = 0;
    linkInput.setAttribute("aria-label", say("Destination URL"));

    const wrapper = document.createElement("div");
    wrapper.className = "qr-destination-picker";
    wrapper.innerHTML = `
      <div class="qr-destination-picker__overview">
        <div class="qr-destination-picker__active" aria-live="polite" aria-atomic="true">
          <div class="qr-destination-picker__active-heading">
            <span class="qr-destination-picker__live-dot" aria-hidden="true"></span>
            <span>${say("Currently active")}</span>
            <strong data-qr-active-type></strong>
          </div>
          <p data-qr-active-description></p>
        </div>
        <div class="qr-destination-picker__selector">
          <p class="qr-destination-picker__edit-heading">${say("Choose what to edit")}</p>
          <div class="qr-destination-picker__modes" role="group" aria-label="${say("QR destination type")}">
            <button type="button" data-destination-mode="link">${say("Edit link")}</button>
            <button type="button" data-destination-mode="photo">${say("Edit photo")}</button>
          </div>
        </div>
      </div>
      <div class="qr-destination-picker__fields">
        <div class="qr-destination-picker__link" data-qr-link-slot></div>
        <div class="qr-destination-picker__photo" hidden>
          <div class="qr-destination-picker__photo-input">
            <label>
              ${say("Choose a photo (JPEG, PNG or WebP, up to 5 MB)")}
              <input type="file" accept="image/jpeg,image/png,image/webp" data-qr-photo-file />
            </label>
            <p class="qr-destination-picker__privacy">
              ${say("Anyone scanning your QR can see this photo. Do not upload private or sensitive images.")}
            </p>
          </div>
          <div class="qr-destination-picker__preview" data-qr-photo-preview></div>
        </div>
      </div>
      <div class="qr-destination-picker__footer">
        <p class="qr-destination-picker__note" role="status" aria-live="polite"></p>
        <div class="qr-destination-picker__action"></div>
      </div>
    `;
    linkRow.parentElement?.insertBefore(wrapper, linkRow);
    wrapper.querySelector("[data-qr-link-slot]")?.appendChild(linkRow);
    wrapper.querySelector(".qr-destination-picker__action")?.appendChild(action);
    oldLabel?.remove();

    const modes = wrapper.querySelectorAll<HTMLButtonElement>("[data-destination-mode]");
    const activeType = wrapper.querySelector<HTMLElement>("[data-qr-active-type]")!;
    const activeDescription = wrapper.querySelector<HTMLElement>("[data-qr-active-description]")!;
    const photoPanel = wrapper.querySelector<HTMLElement>(".qr-destination-picker__photo")!;
    const preview = wrapper.querySelector<HTMLElement>("[data-qr-photo-preview]")!;
    const fileInput = wrapper.querySelector<HTMLInputElement>("[data-qr-photo-file]")!;
    const note = wrapper.querySelector<HTMLElement>(".qr-destination-picker__note")!;

    function hasPhoto(): boolean {
      return Boolean(qr.photo?.storagePath);
    }

    function updateAction(): void {
      const active = qr.destinationType === "photo" ? "photo" : "link";
      const switching = mode !== active;
      action.textContent = say(switching
        ? (mode === "photo" ? "Activate photo" : "Activate link")
        : (mode === "photo" ? "Save photo" : "Save"));
      action.disabled = busy || (mode === "photo" && !fileInput.files?.length &&
        (active === "photo" || !hasPhoto()));
    }

    function refreshActiveDestination(): void {
      const photoActive = qr.destinationType === "photo";
      activeType.textContent = say(photoActive ? "Photo" : "Link");
      const link = qr.linkUrl || (photoActive ? "" : qr.targetUrl) || "";
      activeDescription.textContent = photoActive
        ? say("Scanning this QR currently displays your uploaded photo.")
        : link
          ? `${say("Scanning this QR currently opens:")} ${link}`
          : say("Scanning this QR currently opens your saved link.");
      modes.forEach((button) => {
        button.classList.toggle("is-live", button.dataset.destinationMode ===
          (photoActive ? "photo" : "link"));
      });
      updateAction();
    }

    async function showSavedPhoto(): Promise<void> {
      const version = ++previewVersion;
      preview.replaceChildren();
      if (!hasPhoto()) {
        preview.textContent = say("No photo uploaded yet.");
        return;
      }
      preview.textContent = say("Loading photo…");
      try {
        await firebaseAuth.authStateReady();
        const token = await firebaseAuth.currentUser?.getIdToken();
        if (!token) throw new Error(say("Sign in to preview your photo."));
        const response = await fetch(
          `${API_BASE_URL}/qr-photo/preview/${encodeURIComponent(qr.id)}`,
          { credentials: "include", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
        );
        if (!response.ok) throw new Error(say("Could not load photo preview."));
        const blob = await response.blob();
        const image = await readImage(blob);
        if (version !== previewVersion || fileInput.files?.length) return;
        const img = document.createElement("img");
        img.src = image;
        img.alt = say("Current QR photo");
        preview.replaceChildren(img);
      } catch (error) {
        if (version !== previewVersion) return;
        preview.textContent = error instanceof Error
          ? error.message : say("Could not load photo preview.");
      }
    }

    function readImage(blob: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error(say("Could not load photo preview.")));
        reader.readAsDataURL(blob);
      });
    }

    async function showSelectedPhoto(file: File): Promise<void> {
      const version = ++previewVersion;
      try {
        const image = await readImage(file);
        if (version !== previewVersion) return;
        const img = document.createElement("img");
        img.src = image;
        img.alt = say("Selected QR photo");
        preview.replaceChildren(img);
      } catch {
        if (version === previewVersion) preview.textContent = say("Could not load photo preview.");
      }
    }

    function switchMode(next: DestinationMode): void {
      mode = next;
      modes.forEach((button) => {
        const selected = button.dataset.destinationMode === mode;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      linkRow.hidden = mode !== "link";
      photoPanel.hidden = mode !== "photo";
      if (mode === "photo" && !fileInput.files?.length) void showSavedPhoto();
      note.textContent = "";
      updateAction();
    }

    modes.forEach((button) => {
      button.addEventListener("click", () => switchMode(button.dataset.destinationMode as DestinationMode));
    });

    linkInput.addEventListener("input", updateAction);
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) {
        void showSavedPhoto();
        note.textContent = "";
      } else if (!ALLOWED.has(file.type) || file.size > MAX_PHOTO || file.size === 0) {
        fileInput.value = "";
        note.textContent = say("Choose a JPEG, PNG or WebP image smaller than 5 MB.");
        void showSavedPhoto();
      } else {
        note.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
        void showSelectedPhoto(file);
      }
      updateAction();
    });

    action.addEventListener("click", async () => {
      if (busy) return;
      const requestedMode = mode;
      const target = linkInput.value.trim();
      const file = fileInput.files?.[0];

      if (requestedMode === "link" && !target) {
        note.textContent = say("Enter a destination URL.");
        linkInput.focus();
        return;
      }
      if (requestedMode === "photo" && !file && !hasPhoto()) {
        note.textContent = say("Choose a photo first.");
        fileInput.focus();
        return;
      }

      busy = true;
      updateAction();
      note.textContent = say(requestedMode === "photo" && file ? "Uploading photo…" : "Saving…");

      try {
        const saved = requestedMode === "link"
          ? await updateQrCode(qr.id, target)
          : file
            ? await uploadQrPhoto(qr.id, file)
            : await activateQrPhoto(qr.id);

        Object.assign(qr, saved);
        if (requestedMode === "link") {
          linkInput.value = qr.linkUrl || qr.targetUrl || target;
        } else {
          fileInput.value = "";
          void showSavedPhoto();
        }
        refreshActiveDestination();
        note.textContent = say(requestedMode === "link"
          ? "Link saved and now active."
          : "Photo saved. Your printed QR stays the same.");
      } catch (error) {
        note.textContent = error instanceof Error ? error.message
          : say(requestedMode === "link" ? "Could not update QR destination." : "Could not upload photo.");
      } finally {
        busy = false;
        updateAction();
      }
    });

    switchMode(mode);
    refreshActiveDestination();
  }
}
