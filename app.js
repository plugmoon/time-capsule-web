const STORAGE_KEY = "timeCapsuleApp.capsules.v1";

const state = {
  capsules: [],
  filter: "all",
  query: "",
  activeCapsuleId: null,
};

const els = {
  form: document.querySelector("#capsuleForm"),
  list: document.querySelector("#capsuleList"),
  emptyState: document.querySelector("#emptyState"),
  newCapsuleButton: document.querySelector("#newCapsuleButton"),
  emptyCreateButton: document.querySelector("#emptyCreateButton"),
  closeComposerButton: document.querySelector("#closeComposerButton"),
  composerPanel: document.querySelector("#composerPanel"),
  exportButton: document.querySelector("#exportButton"),
  importFile: document.querySelector("#importFile"),
  searchInput: document.querySelector("#searchInput"),
  filterButtons: document.querySelectorAll("[data-filter]"),
  totalCount: document.querySelector("#totalCount"),
  lockedCount: document.querySelector("#lockedCount"),
  readyCount: document.querySelector("#readyCount"),
  openedCount: document.querySelector("#openedCount"),
  template: document.querySelector("#capsuleTemplate"),
  unlockDialog: document.querySelector("#unlockDialog"),
  unlockForm: document.querySelector("#unlockForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogMeta: document.querySelector("#dialogMeta"),
  secretPrompt: document.querySelector("#secretPrompt"),
  secretCheckInput: document.querySelector("#secretCheckInput"),
  unlockError: document.querySelector("#unlockError"),
  revealedMessage: document.querySelector("#revealedMessage"),
  confirmUnlockButton: document.querySelector("#confirmUnlockButton"),
  unlockInput: document.querySelector("#unlockInput"),
};

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toLocalInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getCapsuleStatus(capsule) {
  if (capsule.openedAt) {
    return "opened";
  }

  return new Date(capsule.unlockAt).getTime() <= Date.now() ? "ready" : "locked";
}

function getCountdownText(unlockAt) {
  const diff = new Date(unlockAt).getTime() - Date.now();

  if (diff <= 0) {
    return "可開啟";
  }

  const minutes = Math.ceil(diff / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) {
    return `${days} 天 ${hours} 小時`;
  }

  if (hours > 0) {
    return `${hours} 小時 ${mins} 分`;
  }

  return `${mins} 分`;
}

function loadCapsules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.capsules = raw ? JSON.parse(raw) : [];
  } catch {
    state.capsules = [];
  }
}

function saveCapsules() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.capsules));
}

function getFilteredCapsules() {
  const query = state.query.trim().toLowerCase();

  return state.capsules
    .filter((capsule) => state.filter === "all" || getCapsuleStatus(capsule) === state.filter)
    .filter((capsule) => {
      if (!query) {
        return true;
      }

      return [capsule.title, capsule.recipient, capsule.message, capsule.mood]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => new Date(a.unlockAt).getTime() - new Date(b.unlockAt).getTime());
}

function updateStats() {
  const statusCounts = state.capsules.reduce(
    (counts, capsule) => {
      counts[getCapsuleStatus(capsule)] += 1;
      return counts;
    },
    { locked: 0, ready: 0, opened: 0 },
  );

  els.totalCount.textContent = state.capsules.length;
  els.lockedCount.textContent = statusCounts.locked;
  els.readyCount.textContent = statusCounts.ready;
  els.openedCount.textContent = statusCounts.opened;
}

function renderCapsules() {
  const capsules = getFilteredCapsules();
  els.list.replaceChildren();
  els.emptyState.hidden = capsules.length !== 0;
  els.list.hidden = capsules.length === 0;
  els.emptyState.querySelector("h2").textContent =
    state.capsules.length === 0 ? "尚未建立寶盒" : "沒有符合的寶盒";
  els.emptyCreateButton.hidden = state.capsules.length !== 0;

  capsules.forEach((capsule) => {
    const status = getCapsuleStatus(capsule);
    const fragment = els.template.content.cloneNode(true);
    const card = fragment.querySelector(".capsule-card");
    const statusPill = fragment.querySelector(".status-pill");
    const openButton = fragment.querySelector(".open-button");

    card.dataset.tone = capsule.tone;
    card.querySelector("h2").textContent = capsule.title;
    card.querySelector(".capsule-preview").textContent =
      status === "locked" ? "內容已封存，等待指定時間。" : capsule.message;
    card.querySelector(".recipient").textContent = capsule.recipient || "未指定";
    card.querySelector(".unlock-date").textContent = formatDateTime(capsule.unlockAt);
    card.querySelector(".mood-tag").textContent = capsule.mood;

    statusPill.classList.add(status);
    statusPill.textContent =
      status === "opened" ? "已開啟" : status === "ready" ? "可開啟" : getCountdownText(capsule.unlockAt);

    openButton.textContent = status === "locked" ? "查看倒數" : "開啟";
    openButton.addEventListener("click", () => showCapsuleDialog(capsule.id));
    fragment.querySelector(".delete-button").addEventListener("click", () => deleteCapsule(capsule.id));

    els.list.append(fragment);
  });

  updateStats();
}

function resetFormDefaults() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  els.unlockInput.min = toLocalInputValue(new Date());
  els.unlockInput.value = toLocalInputValue(tomorrow);
}

function createCapsule(formData) {
  return {
    id: uid(),
    title: formData.get("title").trim(),
    recipient: formData.get("recipient").trim(),
    unlockAt: new Date(formData.get("unlockAt")).toISOString(),
    mood: formData.get("mood"),
    secret: formData.get("secret").trim(),
    message: formData.get("message").trim(),
    tone: formData.get("tone"),
    createdAt: new Date().toISOString(),
    openedAt: null,
  };
}

function addCapsule(event) {
  event.preventDefault();
  const formData = new FormData(els.form);
  const capsule = createCapsule(formData);

  if (!capsule.title || !capsule.message || Number.isNaN(new Date(capsule.unlockAt).getTime())) {
    return;
  }

  state.capsules.push(capsule);
  saveCapsules();
  els.form.reset();
  resetFormDefaults();
  renderCapsules();
}

function deleteCapsule(id) {
  const capsule = state.capsules.find((item) => item.id === id);
  if (!capsule) {
    return;
  }

  const confirmed = window.confirm(`刪除「${capsule.title}」？`);
  if (!confirmed) {
    return;
  }

  state.capsules = state.capsules.filter((item) => item.id !== id);
  saveCapsules();
  renderCapsules();
}

function showCapsuleDialog(id) {
  const capsule = state.capsules.find((item) => item.id === id);
  if (!capsule) {
    return;
  }

  const status = getCapsuleStatus(capsule);
  state.activeCapsuleId = id;
  els.unlockForm.reset();
  els.dialogTitle.textContent = capsule.title;
  els.dialogMeta.textContent = `${capsule.recipient || "未指定"}・${formatDateTime(capsule.unlockAt)}`;
  els.unlockError.hidden = true;
  els.revealedMessage.hidden = true;
  els.confirmUnlockButton.hidden = status === "locked";
  els.secretPrompt.hidden = status === "locked" || !capsule.secret;

  if (status === "locked") {
    els.revealedMessage.textContent = `剩餘 ${getCountdownText(capsule.unlockAt)}`;
    els.revealedMessage.hidden = false;
  }

  if (status === "opened") {
    revealCapsule(capsule);
  }

  els.unlockDialog.showModal();
}

function revealCapsule(capsule) {
  els.unlockError.hidden = true;
  els.secretPrompt.hidden = true;
  els.confirmUnlockButton.hidden = true;
  els.revealedMessage.textContent = capsule.message;
  els.revealedMessage.hidden = false;
}

function confirmUnlock() {
  const capsule = state.capsules.find((item) => item.id === state.activeCapsuleId);
  if (!capsule) {
    return;
  }

  if (getCapsuleStatus(capsule) === "locked") {
    return;
  }

  if (capsule.secret && els.secretCheckInput.value !== capsule.secret) {
    els.unlockError.textContent = "密語不相符";
    els.unlockError.hidden = false;
    return;
  }

  capsule.openedAt = capsule.openedAt ?? new Date().toISOString();
  saveCapsules();
  revealCapsule(capsule);
  renderCapsules();
}

function exportCapsules() {
  const payload = {
    app: "time-capsule-web",
    exportedAt: new Date().toISOString(),
    capsules: state.capsules,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `time-capsules-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeImportedCapsule(capsule) {
  return {
    id: capsule.id || uid(),
    title: String(capsule.title || "未命名寶盒").slice(0, 60),
    recipient: String(capsule.recipient || "").slice(0, 40),
    unlockAt: new Date(capsule.unlockAt || Date.now()).toISOString(),
    mood: String(capsule.mood || "紀念").slice(0, 20),
    secret: String(capsule.secret || "").slice(0, 40),
    message: String(capsule.message || "").slice(0, 1200),
    tone: ["mint", "coral", "amber"].includes(capsule.tone) ? capsule.tone : "mint",
    createdAt: capsule.createdAt || new Date().toISOString(),
    openedAt: capsule.openedAt || null,
  };
}

async function importCapsules(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  try {
    const data = JSON.parse(await file.text());
    const capsules = Array.isArray(data) ? data : data.capsules;
    if (!Array.isArray(capsules)) {
      throw new Error("Invalid backup");
    }

    const imported = capsules.map(normalizeImportedCapsule);
    const existingIds = new Set(state.capsules.map((capsule) => capsule.id));
    state.capsules = [
      ...state.capsules,
      ...imported.map((capsule) => (existingIds.has(capsule.id) ? { ...capsule, id: uid() } : capsule)),
    ];
    saveCapsules();
    renderCapsules();
  } catch {
    window.alert("備份檔格式不正確");
  } finally {
    event.target.value = "";
  }
}

function wireEvents() {
  els.form.addEventListener("submit", addCapsule);
  els.form.addEventListener("reset", () => window.setTimeout(resetFormDefaults, 0));
  els.newCapsuleButton.addEventListener("click", () => els.composerPanel.scrollIntoView({ behavior: "smooth" }));
  els.emptyCreateButton.addEventListener("click", () => els.composerPanel.scrollIntoView({ behavior: "smooth" }));
  els.closeComposerButton.addEventListener("click", () => els.composerPanel.classList.toggle("is-collapsed"));
  els.exportButton.addEventListener("click", exportCapsules);
  els.importFile.addEventListener("change", importCapsules);
  els.confirmUnlockButton.addEventListener("click", confirmUnlock);
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderCapsules();
  });
  els.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      els.filterButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderCapsules();
    });
  });
}

function startCountdownRefresh() {
  window.setInterval(renderCapsules, 60000);
}

function init() {
  loadCapsules();
  resetFormDefaults();
  wireEvents();
  renderCapsules();
  startCountdownRefresh();
}

init();
