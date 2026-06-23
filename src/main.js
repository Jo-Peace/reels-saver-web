import { registerSW } from "virtual:pwa-register";

const urlInput = document.getElementById("url-input");
const pasteBtn = document.getElementById("paste-btn");
const downloadBtn = document.getElementById("download-btn");
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const thumbnailEl = document.getElementById("thumbnail");
const previewUserEl = document.getElementById("preview-user");
const previewCaptionEl = document.getElementById("preview-caption");
const saveLinkEl = document.getElementById("save-link");
const offlineBanner = document.getElementById("offline-banner");

let busy = false;

registerSW({
  immediate: true,
  onOfflineReady() {
    console.log("App shell is ready for offline use.");
  },
});

function setStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
  statusEl.classList.remove("hidden");
}

function updateOfflineState() {
  const offline = !navigator.onLine;
  offlineBanner.classList.toggle("hidden", !offline);
  updateDownloadButton();
}

function updateDownloadButton() {
  const hasUrl = urlInput.value.trim().length > 0;
  const offline = !navigator.onLine;
  downloadBtn.disabled = busy || !hasUrl || offline;
  downloadBtn.title = offline ? "需要網路連線才能下載" : "";
}

function showPreview(media) {
  previewEl.classList.remove("hidden");
  if (media.thumbnailUrl) {
    thumbnailEl.src = media.thumbnailUrl;
    thumbnailEl.classList.remove("hidden");
  } else {
    thumbnailEl.classList.add("hidden");
  }
  previewUserEl.textContent = media.username ? `@${media.username}` : "";
  previewCaptionEl.textContent = media.caption || "";
}

function hidePreview() {
  previewEl.classList.add("hidden");
  saveLinkEl.classList.add("hidden");
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      updateDownloadButton();
    }
  } catch {
    setStatus("error", "無法讀取剪貼簿，請手動貼上連結。");
  }
}

async function resolveAndDownload() {
  const url = urlInput.value.trim();
  if (!url || busy) return;

  if (!navigator.onLine) {
    setStatus("error", "目前離線，請連上網路後再下載。");
    return;
  }

  busy = true;
  hidePreview();
  updateDownloadButton();
  setStatus("loading", "正在解析 Reel 連結...");

  try {
    const response = await fetch("/api/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "解析失敗");
    }

    showPreview(data);
    setStatus("loading", "正在準備下載...");

    const downloadURL = `/api/download?url=${encodeURIComponent(data.videoUrl)}`;
    saveLinkEl.href = downloadURL;
    saveLinkEl.classList.remove("hidden");

    if (isIOS()) {
      setStatus(
        "success",
        "解析完成！請點下方「儲存影片」，再透過分享選單存入相簿。"
      );
      saveLinkEl.click();
    } else {
      setStatus("success", "解析完成！影片下載已開始。");
      const anchor = document.createElement("a");
      anchor.href = downloadURL;
      anchor.download = `reel-${Date.now()}.mp4`;
      anchor.click();
    }
  } catch (error) {
    setStatus("error", error.message || "下載失敗，請稍後再試。");
  } finally {
    busy = false;
    updateDownloadButton();
  }
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

window.addEventListener("online", updateOfflineState);
window.addEventListener("offline", updateOfflineState);

urlInput.addEventListener("input", updateDownloadButton);
pasteBtn.addEventListener("click", pasteFromClipboard);
downloadBtn.addEventListener("click", resolveAndDownload);

updateOfflineState();