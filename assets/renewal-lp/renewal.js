(() => {
  const copyButton = document.querySelector("[data-copy-value]");
  const copyStatus = document.querySelector("[data-copy-status]");

  copyButton?.addEventListener("click", async () => {
    const value = copyButton.dataset.copyValue || "";
    if (!value) return;

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API is unavailable");
      await Promise.race([
        navigator.clipboard.writeText(value),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Clipboard API timed out")), 800)),
      ]);
      copyStatus.textContent = "LINEのURLをコピーしました。";
    } catch {
      const temporary = document.createElement("textarea");
      temporary.value = value;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.append(temporary);
      temporary.select();
      document.execCommand("copy");
      temporary.remove();
      copyStatus.textContent = "LINEのURLをコピーしました。";
    }
  });

  const dialog = document.querySelector("#screen-lightbox");
  if (!dialog) return;

  const image = dialog.querySelector("img");
  const caption = dialog.querySelector("figcaption");
  const closeButton = dialog.querySelector(".lightbox__close");
  let opener = null;

  document.querySelectorAll("[data-lightbox-src]").forEach((button) => {
    button.addEventListener("click", () => {
      opener = button;
      image.src = button.dataset.lightboxSrc;
      image.alt = button.dataset.lightboxCaption || "画面の拡大表示";
      caption.textContent = button.dataset.lightboxCaption || "";
      dialog.showModal();
      closeButton.focus();
    });
  });

  const closeDialog = () => {
    if (dialog.open) dialog.close();
  };

  closeButton.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener("close", () => {
    image.removeAttribute("src");
    opener?.focus();
  });
})();
