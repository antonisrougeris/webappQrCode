import { API_BASE_URL } from "../services/api";
import { activateQrPhoto, uploadQrPhoto, type QrCode } from "../services/qr";
import { t } from "../i18n/locale";

const MAX_PHOTO = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const say = (key: string) => t(key, key);

export function enhanceQrDestinationEditors(container: HTMLElement, qrCodes: QrCode[]): void {
  for (const qr of qrCodes) {
    const card = Array.from(container.querySelectorAll<HTMLElement>("[data-qr-editor]"))
      .find((element) => element.dataset.qrEditor === qr.id);
    if (!card) continue;

    const linkRow = card.querySelector<HTMLElement>("[data-qr-link-fields]");
    const linkInput = linkRow?.querySelector<HTMLInputElement>('input[type="url"]');
    const label = card.querySelector<HTMLLabelElement>("[data-qr-destination-label]");
    if (!linkRow || !linkInput) continue;

    const publicId = qr.shortId || qr.id;
    const active = qr.destinationType === "photo" ? "photo" : "link";

    const wrapper = document.createElement("div");
    wrapper.className = "qr-destination-picker";
    wrapper.innerHTML = `
      <div class="qr-destination-picker__modes" role="group" aria-label="${say("QR destination type")}">
        <button type="button" data-destination-mode="link">${say("Link")}</button>
        <button type="button" data-destination-mode="photo">${say("Photo")}</button>
      </div>
      <div class="qr-destination-picker__photo" hidden>
        <label>${say("Choose a photo (JPEG, PNG or WebP, up to 5 MB)")}
          <input type="file" accept="image/jpeg,image/png,image/webp" data-qr-photo-file />
        </label>
        <div class="qr-destination-picker__preview"></div>
        <button type="button" class="qr-destination-picker__upload" data-qr-upload-photo>
          ${say("Upload and use photo")}
        </button>
        <button type="button" class="qr-destination-picker__reuse" data-qr-reuse-photo hidden>
          ${say("Use saved photo")}
        </button>
        <p class="qr-destination-picker__privacy">
          ${say("Anyone scanning your QR can see this photo. Do not upload private or sensitive images.")}
        </p>
      </div>
      <p class="qr-destination-picker__note" aria-live="polite"></p>`;
    linkRow.parentElement?.insertBefore(wrapper, linkRow);
    const modes = wrapper.querySelectorAll<HTMLButtonElement>("[data-destination-mode]");
    const photoPanel = wrapper.querySelector<HTMLElement>(".qr-destination-picker__photo")!;
    const preview = wrapper.querySelector<HTMLElement>(".qr-destination-picker__preview")!;
    const fileInput = wrapper.querySelector<HTMLInputElement>("[data-qr-photo-file]")!;
    const uploadButton = wrapper.querySelector<HTMLButtonElement>("[data-qr-upload-photo]")!;
    const reuseButton = wrapper.querySelector<HTMLButtonElement>("[data-qr-reuse-photo]")!;
    const note = wrapper.querySelector<HTMLElement>(".qr-destination-picker__note")!;
    let hasPhoto = Boolean(qr.photo?.storagePath);
    const photoUrl = () => `${API_BASE_URL}/qr-photo/image/${encodeURIComponent(publicId)}`;

    function updatePreview(): void {
      preview.replaceChildren();
      if (!hasPhoto) {
        preview.textContent = say("No photo uploaded yet.");
        return;
      }
      const img = document.createElement("img");
      img.src = photoUrl();
      img.alt = say("Current QR photo");
      img.loading = "lazy";
      preview.appendChild(img);
    }

    function switchMode(mode: "link" | "photo"): void {
      modes.forEach((button) => {
        const isActive = button.dataset.destinationMode === mode;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
      if (linkRow) linkRow.hidden = mode !== "link";
      photoPanel.hidden = mode !== "photo";
      if (label) label.hidden = mode !== "link";
      if (mode === "photo") {
        updatePreview();
        reuseButton.hidden = !hasPhoto || qr.destinationType === "photo";
      }
      note.textContent = "";
    }

    modes.forEach((button) => {
      button.addEventListener("click", () => switchMode(button.dataset.destinationMode as "link" | "photo"));
    });

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (!ALLOWED.has(file.type) || file.size > MAX_PHOTO || file.size === 0) {
        note.textContent = say("Choose a JPEG, PNG or WebP image smaller than 5 MB.");
        fileInput.value = "";
      } else {
        note.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
      }
    });

    uploadButton.addEventListener("click", async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        note.textContent = say("Choose a photo first.");
        return;
      }
      uploadButton.disabled = true;
      note.textContent = say("Uploading photo…");
      try {
        const saved = await uploadQrPhoto(qr.id, file);
        qr.destinationType = "photo";
        qr.photo = saved.photo;
        qr.targetUrl = saved.targetUrl;
        hasPhoto = true;
        fileInput.value = "";
        updatePreview();
        reuseButton.hidden = true;
        note.textContent = say("Photo saved. Your printed QR stays the same.");
      } catch (error) {
        note.textContent = error instanceof Error ? error.message : say("Could not upload photo.");
      } finally {
        uploadButton.disabled = false;
      }
    });

    reuseButton.addEventListener("click", async () => {
      reuseButton.disabled = true;
      try {
        const saved = await activateQrPhoto(qr.id);
        qr.destinationType = "photo";
        qr.targetUrl = saved.targetUrl;
        reuseButton.hidden = true;
        note.textContent = say("Saved photo is now active.");
      } catch (error) {
        note.textContent = error instanceof Error ? error.message : say("Could not activate photo.");
      } finally {
        reuseButton.disabled = false;
      }
    });

    // Clicking Save in the pre-existing URL editor switches back to link mode.
    const save = linkRow.querySelector<HTMLButtonElement>("button");
    save?.addEventListener("click", () => {
      if (!linkInput.value.trim()) return;
      // The existing API handler is authoritative; do not assume success.
      note.textContent = say("Save this link to make it your QR destination.");
    });

    switchMode(active);
  }
}
