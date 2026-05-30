const STORAGE_KEY = "timeCapsulePlatform.v2";
const FIREBASE_CONFIG = window.TIME_CAPSULE_FIREBASE_CONFIG || {};
const DEMO_MODE = new URLSearchParams(window.location.search).has("demo");
const FIREBASE_READY = !DEMO_MODE && Boolean(FIREBASE_CONFIG.apiKey && !String(FIREBASE_CONFIG.apiKey).startsWith("YOUR_"));
const MB = 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * MB;
const MAX_FILE_SIZE = 100 * MB;
const FIRESTORE_SYNC_TIMEOUT_MS = 8000;

const DEFAULT_SETTINGS = {
  dailyLoginCoins: 10,
  coinValueTwd: 10,
  shippingFee: 80,
  freeShippingThreshold: 1200,
  notificationEmail: "admin@example.com",
  deathBufferDays: 7,
  currentUserRole: "member",
};

const ROLE_LABELS = {
  superAdmin: "最高管理員",
  gold: "黃金級用戶",
  silver: "白銀級用戶",
  member: "一般用戶",
  heir: "繼承人",
  guest: "訪客",
};

const DEFAULT_PRODUCTS = [
  {
    id: "gift-card",
    name: "時光祝福卡",
    category: "紀念商品",
    price: 180,
    stock: 50,
    description: "可放入時光寶盒的實體祝福卡，適合生日、畢業與紀念日。",
  },
  {
    id: "memory-box",
    name: "典藏木盒",
    category: "收藏配件",
    price: 980,
    stock: 12,
    description: "保存照片、信件與小物的紀念木盒。",
  },
  {
    id: "legacy-kit",
    name: "數位繼承整理包",
    category: "數位服務",
    price: 1280,
    stock: 20,
    description: "協助整理數位資產清單、繼承人資訊與重要訊息。",
  },
];

const state = {
  mode: FIREBASE_READY ? "firebase" : "local",
  firebase: null,
  user: null,
  profile: null,
  capsules: [],
  products: DEFAULT_PRODUCTS,
  settings: { ...DEFAULT_SETTINGS },
  orders: [],
  notifications: [],
  inheritances: [],
  beneficiaries: [],
  cart: [],
  filter: "all",
  query: "",
  category: "all",
  activeCapsuleId: null,
  editingProductId: null,
  adminUsers: [],
  adminSelectedUserId: "",
  adminEditingMessage: null,
  heirMessages: [],
  authSyncId: 0,
  pendingSyncUserId: null,
};

const els = {
  runtimeMode: document.querySelector("#runtimeMode"),
  googleLoginButton: document.querySelector("#googleLoginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  checkInButton: document.querySelector("#checkInButton"),
  authNotice: document.querySelector("#authNotice"),
  userChip: document.querySelector("#userChip"),
  userAvatar: document.querySelector("#userAvatar"),
  userName: document.querySelector("#userName"),
  coinBalance: document.querySelector("#coinBalance"),
  totalCount: document.querySelector("#totalCount"),
  coinStat: document.querySelector("#coinStat"),
  productCount: document.querySelector("#productCount"),
  legacyCount: document.querySelector("#legacyCount"),
  tabs: document.querySelectorAll("[data-view]"),
  views: document.querySelectorAll(".view"),
  capsuleForm: document.querySelector("#capsuleForm"),
  capsuleList: document.querySelector("#capsuleList"),
  emptyState: document.querySelector("#emptyState"),
  emptyCreateButton: document.querySelector("#emptyCreateButton"),
  searchInput: document.querySelector("#searchInput"),
  filterButtons: document.querySelectorAll("[data-filter]"),
  capsuleTemplate: document.querySelector("#capsuleTemplate"),
  capsuleBeneficiaryInput: document.querySelector("#capsuleBeneficiaryInput"),
  legacyBeneficiaryInput: document.querySelector("#legacyBeneficiaryInput"),
  capsuleReleaseModeInput: document.querySelector("#capsuleReleaseModeInput"),
  capsuleDeathRuleGroup: document.querySelector("#capsuleDeathRuleGroup"),
  unlockInput: document.querySelector("#unlockInput"),
  unlockDialog: document.querySelector("#unlockDialog"),
  unlockForm: document.querySelector("#unlockForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogMeta: document.querySelector("#dialogMeta"),
  secretPrompt: document.querySelector("#secretPrompt"),
  secretCheckInput: document.querySelector("#secretCheckInput"),
  unlockError: document.querySelector("#unlockError"),
  revealedMessage: document.querySelector("#revealedMessage"),
  confirmUnlockButton: document.querySelector("#confirmUnlockButton"),
  categoryFilter: document.querySelector("#categoryFilter"),
  productGrid: document.querySelector("#productGrid"),
  cartItems: document.querySelector("#cartItems"),
  cartCount: document.querySelector("#cartCount"),
  cartSubtotal: document.querySelector("#cartSubtotal"),
  coinDiscount: document.querySelector("#coinDiscount"),
  shippingFee: document.querySelector("#shippingFee"),
  cartTotal: document.querySelector("#cartTotal"),
  useCoinsInput: document.querySelector("#useCoinsInput"),
  checkoutButton: document.querySelector("#checkoutButton"),
  beneficiaryForm: document.querySelector("#beneficiaryForm"),
  beneficiaryList: document.querySelector("#beneficiaryList"),
  legacyForm: document.querySelector("#legacyForm"),
  legacyList: document.querySelector("#legacyList"),
  releaseModeInput: document.querySelector("#releaseModeInput"),
  releaseDateLabel: document.querySelector("#releaseDateLabel"),
  releaseDateInput: document.querySelector("#releaseDateInput"),
  settingsForm: document.querySelector("#settingsForm"),
  productForm: document.querySelector("#productForm"),
  productImagesInput: document.querySelector("#productImagesInput"),
  productSubmitButton: document.querySelector("#productSubmitButton"),
  cancelProductEditButton: document.querySelector("#cancelProductEditButton"),
  adminUserSelect: document.querySelector("#adminUserSelect"),
  adminMessageForm: document.querySelector("#adminMessageForm"),
  adminMessageSubmitButton: document.querySelector("#adminMessageSubmitButton"),
  cancelAdminMessageEditButton: document.querySelector("#cancelAdminMessageEditButton"),
  adminUserMessageList: document.querySelector("#adminUserMessageList"),
  heirMessageList: document.querySelector("#heirMessageList"),
  adminTimeline: document.querySelector("#adminTimeline"),
  confirmDeathButton: document.querySelector("#confirmDeathButton"),
};

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function money(value) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));
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

function parseList(value) {
  return String(value || "")
    .split(/[,\n，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function selectedValues(select) {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function addDays(dateValue, days) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

function getBeneficiaryName(id) {
  return state.beneficiaries.find((beneficiary) => beneficiary.id === id)?.name || "未指定";
}

function getBeneficiary(id) {
  return state.beneficiaries.find((beneficiary) => beneficiary.id === id) || null;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getCurrentRole() {
  return state.profile?.role || state.settings.currentUserRole || "member";
}

function isSuperAdmin() {
  return Boolean(state.user) && getCurrentRole() === "superAdmin";
}

function isHeirRole() {
  return Boolean(state.user) && getCurrentRole() === "heir";
}

function getAllowedViews() {
  if (!state.user) {
    return ["capsulesView", "shopView", "legacyView"];
  }
  if (isHeirRole()) {
    return ["heirView"];
  }
  return isSuperAdmin()
    ? ["capsulesView", "shopView", "legacyView", "adminView"]
    : ["capsulesView", "shopView", "legacyView"];
}

function requireStandardUser() {
  if (!requireLogin()) {
    return false;
  }
  if (isHeirRole()) {
    alert("繼承人角色只能查看被指定的訊息，不能操作時光寶盒、購物商城或數位繼承功能。");
    switchView("heirView", true);
    return false;
  }
  return true;
}

function requireSuperAdmin() {
  if (!requireLogin()) {
    return false;
  }
  if (!isSuperAdmin()) {
    alert("此功能僅限最高管理員使用。");
    return false;
  }
  return true;
}

function getCapsuleStatus(capsule) {
  if (capsule.openedAt) {
    return "opened";
  }
  if (capsule.releaseMode === "death") {
    const required = Number(capsule.requiredConfirmations) || 1;
    const count = capsule.deathConfirmations?.length || 0;
    if (count < required || !capsule.deathConfirmedAt) {
      return "locked";
    }
    return addDays(capsule.deathConfirmedAt, capsule.deathBufferDays || state.settings.deathBufferDays) <= new Date()
      ? "ready"
      : "locked";
  }
  return new Date(capsule.unlockAt).getTime() <= Date.now() ? "ready" : "locked";
}

function getCapsuleUnlockLabel(capsule) {
  if (capsule.releaseMode !== "death") {
    return formatDateTime(capsule.unlockAt);
  }

  const required = Number(capsule.requiredConfirmations) || 1;
  const count = capsule.deathConfirmations?.length || 0;
  if (count < required || !capsule.deathConfirmedAt) {
    return `離世確認 ${count}/${required}`;
  }

  const releaseAt = addDays(capsule.deathConfirmedAt, capsule.deathBufferDays || state.settings.deathBufferDays);
  return `緩衝至 ${releaseAt.toLocaleDateString("zh-TW")}`;
}

function getDeathLockedMessage(capsule) {
  const required = Number(capsule.requiredConfirmations) || 1;
  const count = capsule.deathConfirmations?.length || 0;
  if (count < required || !capsule.deathConfirmedAt) {
    return `此寶盒設定為「在我離世後」才能開啟。需 ${required} 位指定繼承人共同確認離世，目前已確認 ${count} 位。`;
  }
  const releaseAt = addDays(capsule.deathConfirmedAt, capsule.deathBufferDays || state.settings.deathBufferDays);
  return `指定繼承人已完成離世確認。此寶盒仍在 ${capsule.deathBufferDays || state.settings.deathBufferDays} 天緩衝期內，將於 ${releaseAt.toLocaleDateString("zh-TW")} 後開啟。`;
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

function readLocalStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return {
      users: data.users || {},
      settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
      products: data.products?.length ? data.products : DEFAULT_PRODUCTS,
      orders: data.orders || [],
      notifications: data.notifications || [],
      heirAccess: data.heirAccess || [],
    };
  } catch {
    return {
      users: {},
      settings: { ...DEFAULT_SETTINGS },
      products: DEFAULT_PRODUCTS,
      orders: [],
      notifications: [],
      heirAccess: [],
    };
  }
}

function writeLocalStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function openAssetDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("timeCapsuleAssets", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("assets", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAsset(file, kind, maxSize) {
  if (!file) {
    return null;
  }
  if (file.size > maxSize) {
    throw new Error(`${file.name} 超過大小限制。`);
  }

  const asset = {
    id: uid(),
    kind,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    createdAt: new Date().toISOString(),
    blob: file,
  };

  const db = await openAssetDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put(asset);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  const { blob, ...meta } = asset;
  return meta;
}

async function saveAssets(files, kind, maxSize) {
  const assets = [];
  for (const file of Array.from(files || [])) {
    const asset = await saveAsset(file, kind, maxSize);
    if (asset) {
      assets.push(asset);
    }
  }
  return assets;
}

async function getAssetUrl(assetId) {
  const db = await openAssetDb();
  const asset = await new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readonly");
    const request = tx.objectStore("assets").get(assetId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();

  return asset?.blob ? URL.createObjectURL(asset.blob) : "";
}

function getUserBucket(store = readLocalStore()) {
  if (!state.user) {
    return null;
  }

  return getUserBucketById(state.user.uid, store, state.user);
}

function getUserBucketById(uidValue, store = readLocalStore(), profileSeed = {}) {
  if (!uidValue) {
    return null;
  }

  store.users[uidValue] ||= {
    profile: {
      uid: uidValue,
      displayName: profileSeed.displayName || "未命名用戶",
      email: profileSeed.email || "",
      coins: 0,
      lastLoginAwardDate: null,
      lastCheckInDate: null,
      role: profileSeed.role || "member",
      createdAt: new Date().toISOString(),
    },
    capsules: [],
    inheritances: [],
    beneficiaries: [],
  };

  return store.users[uidValue];
}

async function initFirebase() {
  if (!FIREBASE_READY) {
    return;
  }

  const [{ initializeApp }, authModule, firestoreModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
  ]);

  const app = initializeApp(FIREBASE_CONFIG);
  const auth = authModule.getAuth(app);
  authModule.useDeviceLanguage(auth);
  const db = firestoreModule.getFirestore(app);
  state.firebase = { auth, db, ...authModule, ...firestoreModule };
}

function setAuthNotice(message, level = "info") {
  if (!message) {
    els.authNotice.hidden = true;
    els.authNotice.textContent = "";
    els.authNotice.className = "auth-notice";
    return;
  }

  els.authNotice.hidden = false;
  els.authNotice.textContent = message;
  els.authNotice.className = `auth-notice ${level}`.trim();
}

function createProfileFromAuthUser(user) {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    coins: state.profile?.coins || 0,
    lastLoginAwardDate: state.profile?.lastLoginAwardDate || null,
    lastCheckInDate: state.profile?.lastCheckInDate || null,
    role: state.profile?.role || state.settings.currentUserRole || "member",
    createdAt: state.profile?.createdAt || new Date().toISOString(),
  };
}

function createUserFromFirebaseUser(user) {
  return {
    uid: user.uid,
    displayName: user.displayName || user.email || "會員",
    email: user.email || "",
    provider: user.providerData?.[0]?.providerId || "firebase",
  };
}

function clearSessionState() {
  state.user = null;
  state.profile = null;
  state.capsules = [];
  state.inheritances = [];
  state.beneficiaries = [];
  state.orders = [];
  state.notifications = [];
  state.cart = [];
  state.adminUsers = [];
  state.adminSelectedUserId = "";
  state.adminEditingMessage = null;
  state.heirMessages = [];
}

function startAuthenticatedSession(firebaseUser, message = "已登入 Google，正在同步雲端資料。") {
  const appUser = createUserFromFirebaseUser(firebaseUser);
  const shouldStartSync = state.pendingSyncUserId !== appUser.uid;
  const syncId = shouldStartSync ? state.authSyncId + 1 : state.authSyncId;

  if (shouldStartSync) {
    state.authSyncId = syncId;
    state.pendingSyncUserId = appUser.uid;
  }

  state.mode = "firebase";
  state.user = appUser;
  state.profile = createProfileFromAuthUser(appUser);
  render();
  setAuthNotice(message, "info");

  if (shouldStartSync) {
    hydrateFirebaseDataAfterLogin(syncId, appUser.uid);
  }
}

function withTimeout(promise, ms, code) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      const error = new Error(code);
      error.code = code;
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function getFirebaseFriendlyError(error, provider = "") {
  const code = error?.code || "";
  const detail = String(error?.message || "");
  const providerName = provider === "google" ? "Google" : "Firebase";

  const messages = {
    "auth/operation-not-allowed": `${providerName} 登入尚未在 Firebase Authentication 啟用。請到 Authentication > Sign-in method 啟用此登入方式。`,
    "auth/configuration-not-found": "Firebase Authentication 尚未啟用或登入方式尚未設定。請到 Firebase Console > Authentication 按 Get started，並在 Sign-in method 啟用 Google。",
    "auth/unauthorized-domain": "目前網域尚未加入 Firebase 授權網域。請到 Authentication > Settings > Authorized domains 加入 plugmoon.github.io。",
    "auth/popup-blocked": "瀏覽器封鎖了登入彈窗。請允許此網站開啟彈出視窗後再登入。",
    "auth/popup-closed-by-user": "登入彈窗在完成前被關閉。請再試一次，並在彈窗中完成登入授權。",
    "auth/cancelled-popup-request": "前一次登入彈窗尚未完成。請稍等後再重新登入。",
    "auth/network-request-failed": "Firebase 登入網路連線失敗。請確認網路後再試一次。",
    "auth/account-exists-with-different-credential": "此 Email 已用其他登入方式註冊。請改用原本的登入方式。",
  };

  if (messages[code]) {
    return messages[code];
  }

  if (code === "firestore-timeout") {
    return "Firestore 同步等待時間較久，系統會先顯示帳號並繼續同步雲端資料。";
  }

  if (
    detail.includes("Cloud Firestore API") ||
    detail.includes("SERVICE_DISABLED") ||
    detail.includes("firestore.googleapis.com")
  ) {
    return "Cloud Firestore API 尚未啟用。請到 Google Cloud/Firebase Console 啟用 Cloud Firestore API，並建立 Firestore Database。";
  }

  if (code === "unavailable" || detail.includes("unavailable")) {
    return "Firestore 目前無法連線。請確認 Cloud Firestore API 已啟用、Firestore Database 已建立、網路正常，並已發布 firestore.rules。";
  }

  if (detail.includes("permission-denied")) {
    return "Firestore 權限不足。請確認已建立 Firestore Database，並套用 firestore.rules。";
  }

  return `登入或資料初始化失敗：${code || error?.message || "未知錯誤"}`;
}

async function loadData() {
  if (state.mode === "firebase" && state.firebase && state.user) {
    await loadFirebaseData();
    return;
  }

  const store = readLocalStore();
  state.settings = store.settings;
  state.products = store.products;
  state.orders = store.orders.filter((order) => order.userId === state.user?.uid);
  state.notifications = store.notifications;

  const bucket = getUserBucket(store);
  state.profile = bucket?.profile || null;
  state.capsules = bucket?.capsules || [];
  state.inheritances = bucket?.inheritances || [];
  state.beneficiaries = bucket?.beneficiaries || [];
  state.adminUsers = getAdminUsersFromStore(store);
  state.heirMessages = getHeirMessagesFromStore(store);
  if (state.heirMessages.length && state.profile?.role !== "superAdmin") {
    state.profile.role = "heir";
  }
}

async function loadPublicData() {
  if (!(state.firebase?.db && state.firebase?.getDoc && state.firebase?.getDocs)) {
    const store = readLocalStore();
    state.settings = store.settings;
    state.products = store.products;
    return;
  }

  const fb = state.firebase;
  const [settingsSnap, productSnap] = await Promise.all([
    fb.getDoc(fb.doc(fb.db, "platform", "settings")),
    fb.getDocs(fb.collection(fb.db, "products")),
  ]);
  state.settings = settingsSnap.exists() ? { ...DEFAULT_SETTINGS, ...settingsSnap.data() } : { ...DEFAULT_SETTINGS };
  state.products = productSnap.empty ? DEFAULT_PRODUCTS : productSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function loadFirebaseData(syncId = state.authSyncId) {
  const fb = state.firebase;
  const userId = state.user.uid;
  const userRef = fb.doc(fb.db, "users", userId);
  const adminRef = fb.doc(fb.db, "admins", userId);
  const settingsRef = fb.doc(fb.db, "platform", "settings");
  const [
    adminSnap,
    profileSnap,
    settingsSnap,
    productSnap,
    capsuleSnap,
    inheritanceSnap,
    beneficiarySnap,
    orderSnap,
  ] =
    await Promise.all([
      fb.getDoc(adminRef),
      fb.getDoc(userRef),
      fb.getDoc(settingsRef),
      fb.getDocs(fb.collection(fb.db, "products")),
      fb.getDocs(fb.collection(fb.db, "users", userId, "capsules")),
      fb.getDocs(fb.collection(fb.db, "users", userId, "inheritances")),
      fb.getDocs(fb.collection(fb.db, "users", userId, "beneficiaries")),
      fb.getDocs(fb.query(fb.collection(fb.db, "orders"), fb.where("userId", "==", userId))),
    ]);

  if (syncId !== state.authSyncId || state.user?.uid !== userId) {
    return false;
  }

  state.profile = profileSnap.exists()
    ? { lastCheckInDate: null, ...profileSnap.data() }
    : {
        uid: userId,
        displayName: state.user.displayName,
        email: state.user.email,
        coins: 0,
        lastLoginAwardDate: null,
        lastCheckInDate: null,
        role: state.settings.currentUserRole || "member",
        createdAt: new Date().toISOString(),
      };
  if (adminSnap.exists()) {
    state.profile.role = "superAdmin";
  }
  state.settings = settingsSnap.exists() ? { ...DEFAULT_SETTINGS, ...settingsSnap.data() } : { ...DEFAULT_SETTINGS };
  state.products = productSnap.empty ? DEFAULT_PRODUCTS : productSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  state.capsules = capsuleSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  state.inheritances = inheritanceSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  state.beneficiaries = beneficiarySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  state.orders = orderSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  state.notifications = [];
  state.heirMessages = [];
  state.adminUsers = state.profile.role === "superAdmin" ? state.adminUsers : [];

  await fb.setDoc(userRef, state.profile, { merge: true });
  if (!settingsSnap.exists() && isSuperAdmin()) {
    await fb.setDoc(settingsRef, state.settings, { merge: true });
  }
  await migrateLocalDataToFirebase();
  return true;
}

async function refreshRoleScopedData(syncId = state.authSyncId, userId = state.user?.uid) {
  if (!(state.mode === "firebase" && state.firebase && state.user)) {
    return;
  }

  const [heirMessages, adminUsers] = await Promise.all([
    loadFirebaseHeirMessages(),
    isSuperAdmin() ? loadFirebaseAdminUsers() : Promise.resolve([]),
  ]);

  if (syncId !== state.authSyncId || state.user?.uid !== userId) {
    return;
  }

  state.heirMessages = heirMessages;
  if (heirMessages.length && state.profile?.role !== "superAdmin") {
    state.profile.role = "heir";
  }
  state.adminUsers = isSuperAdmin() ? adminUsers : [];
  render();
}

function getAdminUsersFromStore(store = readLocalStore()) {
  return Object.entries(store.users || {}).map(([uidValue, bucket]) => ({
    uid: uidValue,
    profile: { uid: uidValue, ...(bucket.profile || {}) },
    capsules: bucket.capsules || [],
    inheritances: bucket.inheritances || [],
    beneficiaries: bucket.beneficiaries || [],
  }));
}

function getHeirMessagesFromCollections(access, ownerProfile, capsules = [], inheritances = []) {
  const heirEmail = normalizeEmail(access.email || state.user?.email);
  const ownerName = ownerProfile?.displayName || ownerProfile?.email || "未命名用戶";
  const beneficiaryId = access.beneficiaryId || "";
  const capsuleMessages = capsules
    .filter((capsule) => (capsule.beneficiaryIds || []).includes(beneficiaryId))
    .map((capsule) => {
      const status = getCapsuleStatus(capsule);
      return {
        id: `capsule-${access.ownerUid}-${capsule.id}`,
        type: "時光寶盒",
        ownerName,
        title: capsule.title,
        status,
        releaseLabel: getCapsuleUnlockLabel(capsule),
        message: status === "locked" ? "此訊息尚未達開啟條件。" : capsule.message,
        date: capsule.createdAt || capsule.unlockAt,
      };
    });

  const legacyMessages = inheritances
    .filter((item) => (item.heirs || []).some((heir) => heir.id === beneficiaryId || normalizeEmail(heir.email) === heirEmail))
    .map((item) => {
      const status = getLegacyStatus(item);
      return {
        id: `legacy-${access.ownerUid}-${item.id}`,
        type: "數位繼承",
        ownerName,
        title: item.title,
        status,
        releaseLabel: item.releaseMode === "death" ? "確認離世後" : item.releaseDate,
        message: status === "locked" ? "此訊息尚未達開啟條件。" : item.message,
        date: item.createdAt || item.releaseDate,
      };
    });

  return [...capsuleMessages, ...legacyMessages];
}

function getHeirMessagesFromStore(store = readLocalStore()) {
  const email = normalizeEmail(state.user?.email);
  if (!email) {
    return [];
  }
  return (store.heirAccess || [])
    .filter((access) => normalizeEmail(access.email) === email)
    .flatMap((access) => {
      const bucket = store.users?.[access.ownerUid];
      if (!bucket) {
        return [];
      }
      return getHeirMessagesFromCollections(access, bucket.profile, bucket.capsules || [], bucket.inheritances || []);
    })
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

async function loadFirebaseHeirMessages() {
  const fb = state.firebase;
  const email = normalizeEmail(state.user?.email);
  if (!fb?.collectionGroup || !email) {
    return [];
  }

  try {
    const accessSnap = await fb.getDocs(fb.query(fb.collectionGroup(fb.db, "emails"), fb.where("email", "==", email)));
    const messageGroups = await Promise.all(
      accessSnap.docs.map(async (docSnap) => {
        const access = docSnap.data();
        const ownerUid = access.ownerUid || docSnap.ref.parent.parent?.id;
        if (!ownerUid) {
          return [];
        }
        const [ownerSnap, capsuleSnap, inheritanceSnap] = await Promise.all([
          fb.getDoc(fb.doc(fb.db, "users", ownerUid)),
          fb.getDocs(fb.collection(fb.db, "users", ownerUid, "capsules")),
          fb.getDocs(fb.collection(fb.db, "users", ownerUid, "inheritances")),
        ]);
        return getHeirMessagesFromCollections(
          { ...access, ownerUid },
          ownerSnap.exists() ? ownerSnap.data() : { uid: ownerUid },
          capsuleSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          inheritanceSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      }),
    );
    return messageGroups.flat().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function loadFirebaseAdminUsers() {
  const fb = state.firebase;
  try {
    const userSnap = await fb.getDocs(fb.collection(fb.db, "users"));
    const users = await Promise.all(
      userSnap.docs.map(async (userDoc) => {
        const uidValue = userDoc.id;
        const [capsuleSnap, inheritanceSnap, beneficiarySnap] = await Promise.all([
          fb.getDocs(fb.collection(fb.db, "users", uidValue, "capsules")),
          fb.getDocs(fb.collection(fb.db, "users", uidValue, "inheritances")),
          fb.getDocs(fb.collection(fb.db, "users", uidValue, "beneficiaries")),
        ]);
        return {
          uid: uidValue,
          profile: { uid: uidValue, ...userDoc.data() },
          capsules: capsuleSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          inheritances: inheritanceSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          beneficiaries: beneficiarySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        };
      }),
    );
    return users.sort((a, b) => String(a.profile.email || "").localeCompare(String(b.profile.email || "")));
  } catch (error) {
    console.error(error);
    setAuthNotice("最高管理員跨用戶資料讀取失敗，請確認 Firestore 規則已允許管理員讀寫。", "error");
    return [];
  }
}

async function saveLocalData() {
  const store = readLocalStore();
  store.settings = state.settings;
  store.products = state.products;
  store.orders = [
    ...store.orders.filter((order) => order.userId !== state.user?.uid),
    ...state.orders,
  ];
  store.notifications = state.notifications;

  const bucket = getUserBucket(store);
  if (bucket) {
    bucket.profile = state.profile;
    bucket.capsules = state.capsules;
    bucket.inheritances = state.inheritances;
    bucket.beneficiaries = state.beneficiaries;
  }

  writeLocalStore(store);
}

async function saveLocalCollectionItem(collectionName, item, ownerId = state.user?.uid) {
  const store = readLocalStore();
  if (["capsules", "inheritances", "beneficiaries"].includes(collectionName) && ownerId) {
    const bucket = getUserBucketById(ownerId, store);
    bucket[collectionName] = [
      item,
      ...(bucket[collectionName] || []).filter((existing) => existing.id !== item.id),
    ];
    writeLocalStore(store);
    return;
  }
  await saveLocalData();
}

async function deleteLocalCollectionItem(collectionName, id, ownerId = state.user?.uid) {
  const store = readLocalStore();
  if (["capsules", "inheritances", "beneficiaries"].includes(collectionName) && ownerId) {
    const bucket = getUserBucketById(ownerId, store);
    bucket[collectionName] = (bucket[collectionName] || []).filter((item) => item.id !== id);
    writeLocalStore(store);
    return;
  }
  await saveLocalData();
}

async function persistCollectionItem(collectionName, item, ownerId = state.user?.uid) {
  const canWriteRemote =
    state.mode === "firebase" &&
    state.firebase &&
    (state.user || ["orders", "notifications"].includes(collectionName));
  if (canWriteRemote) {
    const fb = state.firebase;
    if (collectionName === "capsules") {
      await fb.setDoc(fb.doc(fb.db, "users", ownerId, "capsules", item.id), item, { merge: true });
    } else if (collectionName === "inheritances") {
      await fb.setDoc(fb.doc(fb.db, "users", ownerId, "inheritances", item.id), item, { merge: true });
    } else if (collectionName === "beneficiaries") {
      await fb.setDoc(fb.doc(fb.db, "users", ownerId, "beneficiaries", item.id), item, { merge: true });
    } else if (collectionName === "products") {
      await fb.setDoc(fb.doc(fb.db, "products", item.id), item, { merge: true });
    } else if (collectionName === "orders") {
      await fb.setDoc(fb.doc(fb.db, "orders", item.id), item, { merge: true });
    } else if (collectionName === "notifications") {
      await fb.setDoc(fb.doc(fb.db, "notifications", item.id), item, { merge: true });
    }
    if (state.user && state.profile) {
      await fb.setDoc(fb.doc(fb.db, "users", state.user.uid), state.profile, { merge: true });
    }
    if (state.user && isSuperAdmin()) {
      await fb.setDoc(fb.doc(fb.db, "platform", "settings"), state.settings, { merge: true });
    }
    return;
  }

  await saveLocalCollectionItem(collectionName, item, ownerId);
}

async function persistAll() {
  if (state.mode === "firebase" && state.firebase && state.user) {
    const fb = state.firebase;
    await fb.setDoc(fb.doc(fb.db, "users", state.user.uid), state.profile, { merge: true });
    if (isSuperAdmin()) {
      await fb.setDoc(fb.doc(fb.db, "platform", "settings"), state.settings, { merge: true });
    }
    for (const capsule of state.capsules) {
      await fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "capsules", capsule.id), capsule, { merge: true });
    }
    for (const inheritance of state.inheritances) {
      await fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "inheritances", inheritance.id), inheritance, { merge: true });
    }
    for (const beneficiary of state.beneficiaries) {
      await fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "beneficiaries", beneficiary.id), beneficiary, { merge: true });
    }
    if (isSuperAdmin()) {
      for (const product of state.products) {
        await fb.setDoc(fb.doc(fb.db, "products", product.id), product, { merge: true });
      }
    }
    for (const order of state.orders) {
      await fb.setDoc(fb.doc(fb.db, "orders", order.id), order, { merge: true });
    }
    for (const notification of state.notifications) {
      await fb.setDoc(fb.doc(fb.db, "notifications", notification.id), notification, { merge: true });
    }
    return;
  }
  await saveLocalData();
}

async function saveHeirAccess(beneficiary) {
  const access = {
    ownerUid: state.user.uid,
    ownerName: state.profile?.displayName || state.user.displayName || "",
    beneficiaryId: beneficiary.id,
    name: beneficiary.name,
    email: normalizeEmail(beneficiary.email),
    relationship: beneficiary.relationship || "",
    createdAt: beneficiary.createdAt || new Date().toISOString(),
  };

  if (state.mode === "firebase" && state.firebase && state.user) {
    const fb = state.firebase;
    await fb.setDoc(fb.doc(fb.db, "heirAccess", state.user.uid, "emails", access.email), access, { merge: true });
    return;
  }

  const store = readLocalStore();
  store.heirAccess = [
    access,
    ...(store.heirAccess || []).filter(
      (item) => !(item.ownerUid === access.ownerUid && normalizeEmail(item.email) === access.email),
    ),
  ];
  writeLocalStore(store);
}

async function migrateLocalDataToFirebase() {
  if (!(state.mode === "firebase" && state.firebase && state.user)) {
    return;
  }

  const store = readLocalStore();
  const bucket = store.users?.[state.user.uid];
  if (!bucket) {
    return;
  }

  const fb = state.firebase;
  const addMissing = (current, local) => {
    const ids = new Set(current.map((item) => item.id));
    return [...current, ...local.filter((item) => item?.id && !ids.has(item.id))];
  };

  const mergedCapsules = addMissing(state.capsules, bucket.capsules || []);
  const mergedInheritances = addMissing(state.inheritances, bucket.inheritances || []);
  const mergedBeneficiaries = addMissing(state.beneficiaries, bucket.beneficiaries || []);
  const changed =
    mergedCapsules.length !== state.capsules.length ||
    mergedInheritances.length !== state.inheritances.length ||
    mergedBeneficiaries.length !== state.beneficiaries.length;

  if (changed) {
    state.capsules = mergedCapsules;
    state.inheritances = mergedInheritances;
    state.beneficiaries = mergedBeneficiaries;
    await Promise.all([
      ...state.capsules.map((item) => fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "capsules", item.id), item, { merge: true })),
      ...state.inheritances.map((item) => fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "inheritances", item.id), item, { merge: true })),
      ...state.beneficiaries.map((item) => fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "beneficiaries", item.id), item, { merge: true })),
    ]);
  }

  if (isSuperAdmin()) {
    const productIds = new Set(state.products.map((item) => item.id));
    const localProducts = (store.products || []).filter((item) => item?.id && !productIds.has(item.id));
    if (localProducts.length) {
      state.products = [...state.products, ...localProducts];
      await Promise.all(
        localProducts.map((item) => fb.setDoc(fb.doc(fb.db, "products", item.id), item, { merge: true })),
      );
    }
  }
}

async function deleteHeirAccess(beneficiary) {
  const email = normalizeEmail(beneficiary?.email);
  if (!email || !state.user) {
    return;
  }

  if (state.mode === "firebase" && state.firebase) {
    const fb = state.firebase;
    await fb.deleteDoc(fb.doc(fb.db, "heirAccess", state.user.uid, "emails", email));
    return;
  }

  const store = readLocalStore();
  store.heirAccess = (store.heirAccess || []).filter(
    (item) => !(item.ownerUid === state.user.uid && normalizeEmail(item.email) === email),
  );
  writeLocalStore(store);
}

async function deleteRemoteItem(collectionName, id, ownerId = state.user?.uid) {
  if (!(state.mode === "firebase" && state.firebase && state.user)) {
    await deleteLocalCollectionItem(collectionName, id, ownerId);
    return;
  }

  const fb = state.firebase;
  if (collectionName === "capsules") {
    await fb.deleteDoc(fb.doc(fb.db, "users", ownerId, "capsules", id));
  } else if (collectionName === "inheritances") {
    await fb.deleteDoc(fb.doc(fb.db, "users", ownerId, "inheritances", id));
  } else if (collectionName === "beneficiaries") {
    await fb.deleteDoc(fb.doc(fb.db, "users", ownerId, "beneficiaries", id));
  } else if (collectionName === "products") {
    await fb.deleteDoc(fb.doc(fb.db, "products", id));
  }
}

async function login(provider) {
  if (FIREBASE_READY && state.firebase) {
    const fb = state.firebase;
    const authProvider = new fb.GoogleAuthProvider();
    authProvider.setCustomParameters({ prompt: "select_account" });

    if (fb.auth.currentUser) {
      startAuthenticatedSession(fb.auth.currentUser, "已偵測到現有 Google 登入，正在同步雲端資料。");
      return;
    }

    setAuthNotice("正在開啟登入視窗，請在彈窗中完成授權。");

    try {
      const credential = await fb.signInWithPopup(fb.auth, authProvider);
      if (credential?.user) {
        startAuthenticatedSession(credential.user, "已完成 Google 登入，正在同步雲端資料。");
      }
    } catch (error) {
      console.error(error);

      if (["auth/popup-blocked", "auth/cancelled-popup-request"].includes(error?.code)) {
        setAuthNotice("彈窗登入被瀏覽器阻擋，正在改用重新導向登入。", "info");
        await fb.signInWithRedirect(fb.auth, authProvider);
        return;
      }

      setAuthNotice(getFirebaseFriendlyError(error, provider), "error");
    }

    return;
  }

  setAuthNotice("目前使用本機示範登入；填入 Firebase 設定並啟用登入方式後會改用正式登入。", "success");
  state.user = {
    uid: `demo-${provider}`,
    displayName: "Google 示範會員",
    email: `${provider}@demo.local`,
    provider,
  };
  await loadData();
  render();
}

async function hydrateFirebaseDataAfterLogin(syncId, userId) {
  const syncPromise = loadFirebaseData(syncId);
  try {
    state.mode = "firebase";
    await withTimeout(syncPromise, FIRESTORE_SYNC_TIMEOUT_MS, "firestore-timeout");
    if (syncId !== state.authSyncId || state.user?.uid !== userId) {
      return;
    }
    setAuthNotice("登入成功，已連接 Firebase 雲端資料。", "success");
    state.pendingSyncUserId = null;
    refreshRoleScopedData(syncId, userId);
  } catch (error) {
    if (syncId !== state.authSyncId || state.user?.uid !== userId) {
      return;
    }
    console.error(error);
    if (error?.code === "firestore-timeout") {
      setAuthNotice(`${getFirebaseFriendlyError(error)} 請稍候，資料載入完成後會自動更新畫面。`, "info");
      syncPromise
        .then(() => {
          if (syncId !== state.authSyncId || state.user?.uid !== userId) {
            return;
          }
          setAuthNotice("雲端資料同步完成。", "success");
          state.pendingSyncUserId = null;
          render();
          refreshRoleScopedData(syncId, userId);
        })
        .catch((lateError) => {
          if (syncId !== state.authSyncId || state.user?.uid !== userId) {
            return;
          }
          console.error(lateError);
          state.pendingSyncUserId = null;
          setAuthNotice(`${getFirebaseFriendlyError(lateError)} 雲端同步失敗，請確認 Firestore 規則已發布。`, "error");
        });
      render();
      return;
    }
    state.authSyncId += 1;
    state.pendingSyncUserId = null;
    state.mode = "local";
    await loadData();
    if (!state.profile) {
      state.profile = createProfileFromAuthUser(state.user);
    }
    setAuthNotice(`${getFirebaseFriendlyError(error)} 目前已先登入並暫用本機資料模式。`, "error");
  } finally {
    if (state.user?.uid === userId) {
      render();
    }
  }
}

async function logout() {
  state.authSyncId += 1;
  state.pendingSyncUserId = null;
  let logoutError = null;

  if (state.firebase) {
    try {
      await state.firebase.signOut(state.firebase.auth);
    } catch (error) {
      console.error(error);
      logoutError = error;
    }
  }

  clearSessionState();
  state.mode = FIREBASE_READY ? "firebase" : "local";
  setAuthNotice(logoutError ? getFirebaseFriendlyError(logoutError) : "", logoutError ? "error" : "info");
  render();
}

async function checkInForCoins() {
  if (isHeirRole()) {
    setAuthNotice("繼承人角色不累積時光幣；請使用一般會員帳號操作簽到。", "info");
    return;
  }
  if (!state.profile) {
    return;
  }

  const today = todayKey();
  if (state.profile.lastCheckInDate === today || state.profile.lastLoginAwardDate === today) {
    setAuthNotice("今天已完成簽到，明天再回來領取時光幣。", "info");
    return;
  }

  const amount = Number(state.settings.dailyLoginCoins) || 0;
  state.profile.coins = (Number(state.profile.coins) || 0) + amount;
  state.profile.lastLoginAwardDate = today;
  state.profile.lastCheckInDate = today;
  state.profile.lastLoginAwardAmount = amount;
  state.notifications.unshift({
    id: uid(),
    type: "coin",
    userId: state.user.uid,
    message: `每日登入獎勵已發放 ${amount} 枚時光幣。`,
    createdAt: new Date().toISOString(),
  });
  await persistAll();
  setAuthNotice(`簽到成功，已獲得 ${amount} 枚時光幣。`, "success");
  render();
}

function requireLogin() {
  if (state.user) {
    return true;
  }
  alert("請先使用 Google 登入。");
  return false;
}

function renderAuth() {
  const signedIn = Boolean(state.user);
  els.userChip.hidden = !signedIn;
  els.logoutButton.hidden = !signedIn;
  els.checkInButton.hidden = !signedIn || isHeirRole();
  els.checkInButton.disabled =
    signedIn && (state.profile?.lastCheckInDate === todayKey() || state.profile?.lastLoginAwardDate === todayKey());
  els.checkInButton.textContent = els.checkInButton.disabled ? "今日已簽到" : "立即簽到";
  els.googleLoginButton.hidden = signedIn;
  els.userName.textContent = state.profile?.displayName || state.user?.displayName || "訪客";
  els.userAvatar.textContent = (state.profile?.displayName || "時").slice(0, 1);
  els.coinBalance.textContent = state.profile?.coins || 0;
  const role = state.profile?.role || state.settings.currentUserRole || "member";
  els.userName.textContent = `${state.profile?.displayName || state.user?.displayName || "訪客"}・${ROLE_LABELS[role] || ROLE_LABELS.member}`;
  els.runtimeMode.textContent =
    state.mode === "firebase"
      ? "目前使用 Firebase Authentication / Firestore 雲端模式。"
      : signedIn
        ? "目前已登入，暫用本機資料模式；雲端同步恢復後可重新整理再同步。"
        : "目前使用本機示範模式；填入 Firebase 設定後可啟用正式 Google 登入與雲端資料。";
}

function renderPermissions() {
  const allowedViews = getAllowedViews();
  const activeView = Array.from(els.views).find((view) => view.classList.contains("active"))?.id;

  els.tabs.forEach((tab) => {
    tab.hidden = !allowedViews.includes(tab.dataset.view);
  });

  if (!allowedViews.includes(activeView)) {
    switchView(allowedViews[0], true);
  }
}

function renderStats() {
  els.totalCount.textContent = state.capsules.length;
  els.coinStat.textContent = state.profile?.coins || 0;
  els.productCount.textContent = state.products.length;
  els.legacyCount.textContent = state.inheritances.length;
}

function renderBeneficiaries() {
  const options = state.beneficiaries.map((beneficiary) => {
    const option = document.createElement("option");
    option.value = beneficiary.id;
    option.textContent = `${beneficiary.name}（${beneficiary.email}）`;
    return option;
  });
  els.capsuleBeneficiaryInput.replaceChildren(...options);
  els.legacyBeneficiaryInput.replaceChildren(...options.map((option) => option.cloneNode(true)));

  els.beneficiaryList.replaceChildren(
    ...(state.beneficiaries.length
      ? state.beneficiaries.map((beneficiary) => {
          const item = document.createElement("article");
          item.className = "beneficiary-item";
          item.innerHTML = `
            <div>
              <strong>${escapeHtml(beneficiary.name)}</strong>
              <span>${escapeHtml(beneficiary.email)}</span>
            </div>
            <small>${escapeHtml(beneficiary.relationship || "未設定關係")}</small>
          `;
          const button = document.createElement("button");
          button.className = "ghost-icon";
          button.type = "button";
          button.textContent = "×";
          button.title = "刪除繼承人";
          button.addEventListener("click", () => deleteBeneficiary(beneficiary.id));
          item.append(button);
          return item;
        })
      : [Object.assign(document.createElement("p"), { className: "hint", textContent: "尚未新增繼承人。" })]),
  );
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

function renderCapsules() {
  const capsules = getFilteredCapsules();
  els.capsuleList.replaceChildren();
  els.emptyState.hidden = capsules.length !== 0;
  els.capsuleList.hidden = capsules.length === 0;
  els.emptyState.querySelector("h2").textContent =
    state.capsules.length === 0 ? "尚未建立寶盒" : "沒有符合的寶盒";
  els.emptyCreateButton.hidden = state.capsules.length !== 0;

  capsules.forEach((capsule) => {
    const status = getCapsuleStatus(capsule);
    const fragment = els.capsuleTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".capsule-card");
    const statusPill = fragment.querySelector(".status-pill");
    const openButton = fragment.querySelector(".open-button");

    card.dataset.tone = capsule.tone;
    card.querySelector("h2").textContent = capsule.title;
    const attachmentCount = (capsule.images?.length || 0) + (capsule.files?.length || 0) + (capsule.videoUrl ? 1 : 0);
    card.querySelector(".capsule-preview").textContent =
      status === "locked"
        ? `內容已封存，含 ${attachmentCount} 個附件或連結。`
        : capsule.message;
    card.querySelector(".recipient").textContent =
      capsule.beneficiaryIds?.length
        ? capsule.beneficiaryIds.map(getBeneficiaryName).join("、")
        : capsule.recipient || "未指定";
    card.querySelector(".unlock-date").textContent = getCapsuleUnlockLabel(capsule);
    card.querySelector(".mood-tag").textContent = capsule.mood;

    statusPill.classList.add(status);
    statusPill.textContent =
      status === "opened"
        ? "已開啟"
        : status === "ready"
          ? "可開啟"
          : capsule.releaseMode === "death"
            ? getCapsuleUnlockLabel(capsule)
            : getCountdownText(capsule.unlockAt);
    openButton.textContent = status === "locked" ? "查看倒數" : "開啟";
    openButton.addEventListener("click", () => showCapsuleDialog(capsule.id));
    fragment.querySelector(".delete-button").addEventListener("click", () => deleteCapsule(capsule.id));
    els.capsuleList.append(fragment);
  });
}

function renderShop() {
  const categories = ["all", ...new Set(state.products.map((product) => product.category))];
  els.categoryFilter.replaceChildren(
    ...categories.map((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category === "all" ? "全部分類" : category;
      option.selected = state.category === category;
      return option;
    }),
  );

  const products =
    state.category === "all"
      ? state.products
      : state.products.filter((product) => product.category === state.category);

  els.productGrid.replaceChildren(
    ...products.map((product) => {
      const card = document.createElement("article");
      card.className = "product-card";
      const firstImage = product.images?.[0];
      card.innerHTML = `
        <div class="product-art">${product.name.slice(0, 1)}</div>
        <div class="product-body">
          <span class="mood-tag">${product.category}</span>
          <h2>${escapeHtml(product.name)}</h2>
          <p>${escapeHtml(product.description || "")}</p>
          <div class="product-meta">
            <strong>${money(product.price)}</strong>
            <span>庫存 ${product.stock}</span>
          </div>
        </div>
      `;
      const button = document.createElement("button");
      button.className = "primary-button";
      button.type = "button";
      button.textContent = "加入購物車";
      button.disabled = Number(product.stock) <= 0;
      button.addEventListener("click", () => addToCart(product.id));
      card.querySelector(".product-body").append(button);

      if (isSuperAdmin()) {
        const manage = document.createElement("div");
        manage.className = "product-actions";
        const edit = document.createElement("button");
        edit.className = "secondary-button";
        edit.type = "button";
        edit.textContent = "修改";
        edit.addEventListener("click", () => startProductEdit(product.id));
        const remove = document.createElement("button");
        remove.className = "secondary-button danger-button";
        remove.type = "button";
        remove.textContent = "刪除";
        remove.addEventListener("click", () => deleteProduct(product.id));
        manage.append(edit, remove);
        card.querySelector(".product-body").append(manage);
      }

      if (firstImage?.id) {
        getAssetUrl(firstImage.id).then((url) => {
          if (url) {
            const art = card.querySelector(".product-art");
            art.textContent = "";
            art.style.backgroundImage = `url("${url}")`;
            art.classList.add("has-image");
          }
        });
      }
      return card;
    }),
  );

  renderCart();
}

function renderCart() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const canUseCoins = Boolean(state.user && state.profile);
  const maxCoins = Math.min(
    canUseCoins ? Number(state.profile?.coins) || 0 : 0,
    Math.floor(subtotal / Math.max(1, Number(state.settings.coinValueTwd) || 1)),
  );
  const requestedCoins = Math.min(maxCoins, Math.max(0, Number(els.useCoinsInput.value) || 0));
  els.useCoinsInput.max = String(maxCoins);
  els.useCoinsInput.value = String(requestedCoins);
  els.useCoinsInput.disabled = !canUseCoins || maxCoins === 0;

  const coinDiscount = requestedCoins * (Number(state.settings.coinValueTwd) || 0);
  const shipping =
    subtotal === 0 || subtotal >= Number(state.settings.freeShippingThreshold)
      ? 0
      : Number(state.settings.shippingFee) || 0;
  const total = Math.max(0, subtotal - coinDiscount + shipping);

  els.cartItems.replaceChildren(
    ...state.cart.map((item) => {
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${money(item.price)} × ${item.qty}</span>
        </div>
      `;
      const remove = document.createElement("button");
      remove.className = "ghost-icon";
      remove.type = "button";
      remove.textContent = "×";
      remove.addEventListener("click", () => removeFromCart(item.id));
      row.append(remove);
      return row;
    }),
  );

  els.cartCount.textContent = `${state.cart.reduce((sum, item) => sum + item.qty, 0)} 件`;
  els.cartSubtotal.textContent = money(subtotal);
  els.coinDiscount.textContent = `-${money(coinDiscount)}`;
  els.shippingFee.textContent = money(shipping);
  els.cartTotal.textContent = money(total);
  els.checkoutButton.disabled = state.cart.length === 0;
}

function renderLegacy() {
  els.legacyList.replaceChildren(
    ...state.inheritances.map((item) => {
      const status = getLegacyStatus(item);
      const card = document.createElement("article");
      card.className = "capsule-card";
      card.dataset.tone = status === "released" ? "mint" : item.releaseMode === "death" ? "coral" : "amber";
      card.innerHTML = `
        <div class="capsule-card-top">
          <span class="status-pill ${status === "released" ? "ready" : "locked"}">${status === "released" ? "可開啟" : "封存中"}</span>
          <button class="ghost-icon delete-button" type="button" title="刪除" aria-label="刪除">×</button>
        </div>
        <h2>${escapeHtml(item.title)}</h2>
        <p class="capsule-preview">${escapeHtml(item.message)}</p>
        <dl class="capsule-meta">
          <div><dt>繼承人</dt><dd>${item.heirs.map((heir) => escapeHtml(heir.name)).join("、")}</dd></div>
          <div><dt>條件</dt><dd>${item.releaseMode === "death" ? "確認過世後" : item.releaseDate}</dd></div>
        </dl>
        <div class="capsule-card-bottom">
          <span class="mood-tag">${item.heirs.length} 位繼承人</span>
          <button class="secondary-button release-button" type="button">${status === "released" ? "查看訊息" : "尚未可開啟"}</button>
        </div>
      `;
      card.querySelector(".delete-button").addEventListener("click", () => deleteInheritance(item.id));
      card.querySelector(".release-button").addEventListener("click", () => {
        if (getLegacyStatus(item) === "released") {
          alert(item.message);
        }
      });
      return card;
    }),
  );
}

function renderHeirMessages() {
  els.heirMessageList.replaceChildren(
    ...(state.heirMessages.length
      ? state.heirMessages.map((message) => {
          const card = document.createElement("article");
          card.className = "capsule-card";
          card.dataset.tone = message.status === "locked" ? "amber" : "mint";
          card.innerHTML = `
            <div class="capsule-card-top">
              <span class="status-pill ${message.status === "locked" ? "locked" : "ready"}">${message.status === "locked" ? "尚未開啟" : "可查看"}</span>
            </div>
            <h2>${escapeHtml(message.title)}</h2>
            <p class="capsule-preview">${escapeHtml(message.message)}</p>
            <dl class="capsule-meta">
              <div><dt>設定用戶</dt><dd>${escapeHtml(message.ownerName)}</dd></div>
              <div><dt>類型</dt><dd>${escapeHtml(message.type)}</dd></div>
              <div><dt>開啟條件</dt><dd>${escapeHtml(message.releaseLabel || "未設定")}</dd></div>
            </dl>
          `;
          return card;
        })
      : [
          Object.assign(document.createElement("p"), {
            className: "hint",
            textContent: "目前尚未查到指定給您的繼承訊息。請確認設定者使用的是您的 Google 帳號信箱。",
          }),
        ]),
  );
}

function renderAdmin() {
  const adminEnabled = isSuperAdmin();
  els.adminMessageSubmitButton.textContent = state.adminEditingMessage ? "儲存修改" : "新增訊息";
  els.cancelAdminMessageEditButton.hidden = !state.adminEditingMessage;
  els.adminUserSelect.disabled = !adminEnabled;
  els.adminMessageForm.querySelectorAll("input, textarea, select, button").forEach((field) => {
    field.disabled = !adminEnabled;
  });
  els.cancelAdminMessageEditButton.disabled = !adminEnabled;

  const users = adminEnabled ? state.adminUsers : [];
  if (users.length && !users.some((user) => user.uid === state.adminSelectedUserId)) {
    state.adminSelectedUserId = users[0].uid;
  }
  if (!users.length) {
    state.adminSelectedUserId = "";
  }

  els.adminUserSelect.replaceChildren(
    ...(users.length
      ? users.map((user) => {
          const option = document.createElement("option");
          option.value = user.uid;
          option.textContent = `${user.profile.displayName || user.profile.email || "未命名用戶"}（${user.profile.email || user.uid}）`;
          option.selected = user.uid === state.adminSelectedUserId;
          return option;
        })
      : [Object.assign(document.createElement("option"), { value: "", textContent: "尚無可管理用戶" })]),
  );

  renderAdminUserMessages();

  for (const [key, value] of Object.entries(state.settings)) {
    const field = els.settingsForm.elements[key];
    if (field) {
      field.value = value;
    }
  }
  els.productSubmitButton.textContent = state.editingProductId ? "儲存商品" : "新增商品";
  els.cancelProductEditButton.hidden = !state.editingProductId;

  const items = [
    ...state.orders.map((order) => ({
      type: "訂單",
      title: `訂單 ${order.id.slice(0, 8)}：${money(order.total)}`,
      body: `使用 ${order.usedCoins} 枚時光幣，狀態：${order.status}`,
      date: order.createdAt,
    })),
    ...state.notifications.map((note) => ({
      type: "通知",
      title: note.message,
      body: note.type,
      date: note.createdAt,
      mailto: note.mailto || "",
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  els.adminTimeline.replaceChildren(
    ...(items.length
      ? items.map((item) => {
          const row = document.createElement("article");
          row.className = "timeline-item";
          row.innerHTML = `
            <span class="mood-tag">${item.type}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
            <time>${formatDateTime(item.date)}</time>
          `;
          if (item.mailto) {
            const link = document.createElement("a");
            link.className = "attachment-link";
            link.href = item.mailto;
            link.textContent = "開啟 Email 草稿";
            row.append(link);
          }
          return row;
        })
      : [Object.assign(document.createElement("p"), { className: "hint", textContent: "尚無訂單或通知。" })]),
  );
}

function getSelectedAdminUser() {
  return state.adminUsers.find((user) => user.uid === state.adminSelectedUserId) || null;
}

function getAdminUserMessages(user = getSelectedAdminUser()) {
  if (!user) {
    return [];
  }
  return [
    ...(user.capsules || []).map((item) => ({
      collectionName: "capsules",
      id: item.id,
      title: item.title,
      body: item.message,
      date: item.createdAt || item.unlockAt,
      typeLabel: "時光寶盒",
    })),
    ...(user.inheritances || []).map((item) => ({
      collectionName: "inheritances",
      id: item.id,
      title: item.title,
      body: item.message,
      date: item.createdAt || item.releaseDate,
      typeLabel: "數位繼承",
    })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function renderAdminUserMessages() {
  const user = getSelectedAdminUser();
  const messages = getAdminUserMessages(user);
  els.adminUserMessageList.replaceChildren(
    ...(messages.length
      ? messages.map((message) => {
          const row = document.createElement("article");
          row.className = "timeline-item";
          row.innerHTML = `
            <span class="mood-tag">${escapeHtml(message.typeLabel)}</span>
            <h3>${escapeHtml(message.title)}</h3>
            <p>${escapeHtml(message.body || "")}</p>
            <time>${message.date ? formatDateTime(message.date) : "未設定日期"}</time>
          `;
          const actions = document.createElement("div");
          actions.className = "product-actions";
          const edit = document.createElement("button");
          edit.className = "secondary-button";
          edit.type = "button";
          edit.textContent = "修改";
          edit.addEventListener("click", () => startAdminMessageEdit(message.collectionName, message.id));
          const remove = document.createElement("button");
          remove.className = "secondary-button danger-button";
          remove.type = "button";
          remove.textContent = "刪除";
          remove.addEventListener("click", () => deleteAdminMessage(message.collectionName, message.id));
          actions.append(edit, remove);
          row.append(actions);
          return row;
        })
      : [
          Object.assign(document.createElement("p"), {
            className: "hint",
            textContent: user ? "此用戶尚無訊息。" : "請先選擇用戶。",
          }),
        ]),
  );
}

async function saveAdminMessage(event) {
  event.preventDefault();
  if (!requireSuperAdmin()) {
    return;
  }

  const user = getSelectedAdminUser();
  if (!user) {
    alert("請先選擇要管理的用戶。");
    return;
  }

  const formData = new FormData(els.adminMessageForm);
  const collectionName = state.adminEditingMessage?.collectionName || formData.get("messageType");
  const now = new Date().toISOString();
  const existingList = collectionName === "capsules" ? user.capsules : user.inheritances;
  const existing = state.adminEditingMessage
    ? existingList.find((item) => item.id === state.adminEditingMessage.id)
    : null;

  const item =
    collectionName === "capsules"
      ? {
          id: existing?.id || uid(),
          title: formData.get("title").trim(),
          recipient: "由最高管理員建立",
          unlockAt: existing?.unlockAt || now,
          releaseMode: existing?.releaseMode || "date",
          beneficiaryIds: existing?.beneficiaryIds || [],
          requiredConfirmations: existing?.requiredConfirmations || 0,
          deathConfirmations: existing?.deathConfirmations || [],
          deathConfirmedAt: existing?.deathConfirmedAt || null,
          deathBufferDays: existing?.deathBufferDays || Number(state.settings.deathBufferDays) || 7,
          mood: existing?.mood || "管理",
          secret: existing?.secret || "",
          message: formData.get("message").trim(),
          videoUrl: existing?.videoUrl || "",
          images: existing?.images || [],
          files: existing?.files || [],
          tone: existing?.tone || "mint",
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          openedAt: existing?.openedAt || null,
        }
      : {
          id: existing?.id || uid(),
          title: formData.get("title").trim(),
          heirs: existing?.heirs || [],
          releaseMode: existing?.releaseMode || "date",
          releaseDate: existing?.releaseDate || todayKey(),
          message: formData.get("message").trim(),
          deathConfirmedAt: existing?.deathConfirmedAt || null,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };

  if (collectionName === "capsules") {
    user.capsules = [item, ...(user.capsules || []).filter((message) => message.id !== item.id)];
    if (user.uid === state.user.uid) {
      state.capsules = [item, ...state.capsules.filter((message) => message.id !== item.id)];
    }
  } else {
    user.inheritances = [item, ...(user.inheritances || []).filter((message) => message.id !== item.id)];
    if (user.uid === state.user.uid) {
      state.inheritances = [item, ...state.inheritances.filter((message) => message.id !== item.id)];
    }
  }

  await persistCollectionItem(collectionName, item, user.uid);
  state.adminEditingMessage = null;
  els.adminMessageForm.reset();
  render();
}

function startAdminMessageEdit(collectionName, id) {
  if (!requireSuperAdmin()) {
    return;
  }
  const user = getSelectedAdminUser();
  const item = (collectionName === "capsules" ? user?.capsules : user?.inheritances)?.find((message) => message.id === id);
  if (!item) {
    return;
  }

  state.adminEditingMessage = { collectionName, id };
  els.adminMessageForm.elements.messageType.value = collectionName;
  els.adminMessageForm.elements.title.value = item.title || "";
  els.adminMessageForm.elements.message.value = item.message || "";
  renderAdmin();
  els.adminMessageForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelAdminMessageEdit() {
  state.adminEditingMessage = null;
  els.adminMessageForm.reset();
  renderAdmin();
}

async function deleteAdminMessage(collectionName, id) {
  if (!requireSuperAdmin()) {
    return;
  }
  const user = getSelectedAdminUser();
  if (!user || !confirm("刪除此用戶訊息？")) {
    return;
  }

  if (collectionName === "capsules") {
    user.capsules = (user.capsules || []).filter((message) => message.id !== id);
    if (user.uid === state.user.uid) {
      state.capsules = state.capsules.filter((message) => message.id !== id);
    }
  } else {
    user.inheritances = (user.inheritances || []).filter((message) => message.id !== id);
    if (user.uid === state.user.uid) {
      state.inheritances = state.inheritances.filter((message) => message.id !== id);
    }
  }

  await deleteRemoteItem(collectionName, id, user.uid);
  if (state.adminEditingMessage?.id === id) {
    state.adminEditingMessage = null;
    els.adminMessageForm.reset();
  }
  render();
}

function updateCapsuleReleaseControls() {
  const isDeathMode = els.capsuleReleaseModeInput.value === "death";
  const selectedCount = selectedValues(els.capsuleBeneficiaryInput).length;
  const requiredInput = els.capsuleDeathRuleGroup.querySelector('input[name="requiredConfirmations"]');

  els.capsuleDeathRuleGroup.hidden = !isDeathMode;
  els.unlockInput.disabled = isDeathMode;
  els.unlockInput.required = !isDeathMode;

  if (requiredInput) {
    const max = Math.max(1, selectedCount);
    requiredInput.max = String(max);
    requiredInput.value = String(Math.min(Math.max(1, Number(requiredInput.value) || 1), max));
  }
}

function render() {
  renderAuth();
  renderPermissions();
  renderStats();
  renderBeneficiaries();
  renderCapsules();
  renderShop();
  renderLegacy();
  renderHeirMessages();
  renderAdmin();
}

function resetFormDefaults() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  els.unlockInput.min = toLocalInputValue(new Date());
  els.unlockInput.value = toLocalInputValue(tomorrow);
  els.releaseDateInput.min = todayKey();
  els.releaseDateInput.value = todayKey();
  updateCapsuleReleaseControls();
}

async function addCapsule(event) {
  event.preventDefault();
  if (!requireStandardUser()) {
    return;
  }

  const formData = new FormData(els.capsuleForm);
  const beneficiaryIds = selectedValues(els.capsuleBeneficiaryInput);
  const releaseMode = formData.get("releaseMode");
  if (releaseMode === "death" && beneficiaryIds.length === 0) {
    alert("選擇「在我離世後」時，請先新增並指定至少 1 位繼承人。");
    return;
  }
  const requiredConfirmations = releaseMode === "death" ? Math.min(
    Math.max(1, Number(formData.get("requiredConfirmations")) || 1),
    Math.max(1, beneficiaryIds.length),
  ) : 0;
  let images = [];
  let files = [];
  try {
    images = await saveAssets(formData.getAll("imageFiles").filter((file) => file.size), "capsule-image", MAX_IMAGE_SIZE);
    files = await saveAssets(formData.getAll("documentFiles").filter((file) => file.size), "capsule-file", MAX_FILE_SIZE);
  } catch (error) {
    alert(error.message);
    return;
  }

  const capsule = {
    id: uid(),
    title: formData.get("title").trim(),
    recipient: formData.get("recipient").trim(),
    unlockAt:
      releaseMode === "death"
        ? addDays(new Date(), Number(formData.get("deathBufferDays")) || Number(state.settings.deathBufferDays) || 7).toISOString()
        : new Date(formData.get("unlockAt")).toISOString(),
    releaseMode,
    beneficiaryIds,
    requiredConfirmations,
    deathConfirmations: [],
    deathConfirmedAt: null,
    deathBufferDays: Number(formData.get("deathBufferDays")) || Number(state.settings.deathBufferDays) || 7,
    mood: formData.get("mood"),
    secret: formData.get("secret").trim(),
    message: formData.get("message").trim(),
    videoUrl: formData.get("videoUrl").trim(),
    images,
    files,
    tone: formData.get("tone"),
    createdAt: new Date().toISOString(),
    openedAt: null,
  };

  state.capsules.push(capsule);
  await persistCollectionItem("capsules", capsule);
  els.capsuleForm.reset();
  resetFormDefaults();
  render();
}

async function deleteCapsule(id) {
  if (!confirm("刪除此寶盒？")) {
    return;
  }
  state.capsules = state.capsules.filter((item) => item.id !== id);
  await deleteRemoteItem("capsules", id);
  await saveLocalData();
  render();
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
    els.revealedMessage.textContent =
      capsule.releaseMode === "death" ? getDeathLockedMessage(capsule) : `剩餘 ${getCountdownText(capsule.unlockAt)}`;
    els.revealedMessage.hidden = false;
  }

  if (status === "opened") {
    revealCapsule(capsule);
  }

  els.unlockDialog.showModal();
}

async function revealCapsule(capsule) {
  els.unlockError.hidden = true;
  els.secretPrompt.hidden = true;
  els.confirmUnlockButton.hidden = true;
  els.revealedMessage.replaceChildren();

  const text = document.createElement("p");
  text.textContent = capsule.message;
  els.revealedMessage.append(text);

  if (capsule.videoUrl) {
    const video = document.createElement("a");
    video.href = capsule.videoUrl;
    video.target = "_blank";
    video.rel = "noopener";
    video.className = "attachment-link";
    video.textContent = `開啟影片連結：${capsule.videoUrl}`;
    els.revealedMessage.append(video);
  }

  for (const image of capsule.images || []) {
    const url = await getAssetUrl(image.id);
    const figure = document.createElement("figure");
    figure.className = "revealed-asset";
    figure.innerHTML = `<figcaption>${escapeHtml(image.name)}</figcaption>`;
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = image.name;
      figure.prepend(img);
    }
    els.revealedMessage.append(figure);
  }

  for (const file of capsule.files || []) {
    const url = await getAssetUrl(file.id);
    const link = document.createElement("a");
    link.className = "attachment-link";
    link.textContent = `${file.name} (${Math.ceil(file.size / MB)} MB)`;
    if (url) {
      link.href = url;
      link.download = file.name;
    }
    els.revealedMessage.append(link);
  }

  els.revealedMessage.hidden = false;
}

async function confirmUnlock() {
  const capsule = state.capsules.find((item) => item.id === state.activeCapsuleId);
  if (!capsule || getCapsuleStatus(capsule) === "locked") {
    return;
  }

  if (capsule.secret && els.secretCheckInput.value !== capsule.secret) {
    els.unlockError.textContent = "密語不相符";
    els.unlockError.hidden = false;
    return;
  }

  capsule.openedAt = capsule.openedAt ?? new Date().toISOString();
  await persistCollectionItem("capsules", capsule);
  await revealCapsule(capsule);
  render();
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product || Number(product.stock) <= 0) {
    return;
  }

  const existing = state.cart.find((item) => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({ id: product.id, name: product.name, price: Number(product.price), qty: 1 });
  }
  renderCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.id !== productId);
  renderCart();
}

async function addBeneficiary(event) {
  event.preventDefault();
  if (!requireStandardUser()) {
    return;
  }

  const formData = new FormData(els.beneficiaryForm);
  const beneficiary = {
    id: uid(),
    name: formData.get("name").trim(),
    email: formData.get("email").trim(),
    relationship: formData.get("relationship").trim(),
    createdAt: new Date().toISOString(),
  };
  state.beneficiaries.unshift(beneficiary);
  const registerUrl = `${location.origin}${location.pathname}`;
  const subject = "您已被指定為時光寶盒繼承人";
  const body = `${state.profile?.displayName || state.user?.displayName || "一位用戶"} 已將您設定為時光寶盒繼承人。請前往 ${registerUrl} 使用 Google 登入註冊，未來可依設定條件接收重要訊息。`;
  const mailto = `mailto:${encodeURIComponent(beneficiary.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  state.notifications.unshift({
    id: uid(),
    type: "heir-email",
    userId: state.user.uid,
    message: `已建立繼承人通知：${beneficiary.name}（${beneficiary.email}）`,
    mailto,
    createdAt: new Date().toISOString(),
  });
  await persistCollectionItem("beneficiaries", beneficiary);
  await saveHeirAccess(beneficiary);
  await persistAll();
  els.beneficiaryForm.reset();
  render();
  if (confirm(`是否立即開啟 Email 草稿通知 ${beneficiary.name}？`)) {
    window.location.href = mailto;
  }
}

async function deleteBeneficiary(id) {
  if (!confirm("刪除此繼承人？既有寶盒中的指定紀錄不會被自動移除。")) {
    return;
  }
  const beneficiary = state.beneficiaries.find((item) => item.id === id);
  state.beneficiaries = state.beneficiaries.filter((item) => item.id !== id);
  await deleteRemoteItem("beneficiaries", id);
  await deleteHeirAccess(beneficiary);
  await saveLocalData();
  render();
}

async function checkout() {
  if (state.cart.length === 0) {
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const maxCoins = Math.min(
    state.user && state.profile ? Number(state.profile.coins) || 0 : 0,
    Math.floor(subtotal / Math.max(1, Number(state.settings.coinValueTwd) || 1)),
  );
  const usedCoins = Math.min(maxCoins, Math.max(0, Number(els.useCoinsInput.value) || 0));
  const discount = usedCoins * (Number(state.settings.coinValueTwd) || 0);
  const shipping =
    subtotal >= Number(state.settings.freeShippingThreshold) ? 0 : Number(state.settings.shippingFee) || 0;
  const total = Math.max(0, subtotal - discount + shipping);

  const order = {
    id: uid(),
    userId: state.user?.uid || `guest-${uid()}`,
    userEmail: state.user?.email || "",
    items: state.cart,
    subtotal,
    usedCoins,
    discount,
    shipping,
    total,
    status: "created",
    notificationEmail: state.settings.notificationEmail,
    createdAt: new Date().toISOString(),
  };

  if (state.profile) {
    state.profile.coins = Math.max(0, (Number(state.profile.coins) || 0) - usedCoins);
  }
  state.orders.unshift(order);
  const notification = {
    id: uid(),
    type: "order",
    userId: state.user?.uid || "guest",
    message: `${state.user ? "會員" : "訪客"}新訂單已建立，通知對象：${state.settings.notificationEmail}`,
    createdAt: new Date().toISOString(),
  };
  state.notifications.unshift(notification);
  state.cart = [];
  await persistCollectionItem("orders", order);
  await persistCollectionItem("notifications", notification);
  await persistAll();
  render();
  alert("訂單已建立。");
}

async function addInheritance(event) {
  event.preventDefault();
  if (!requireStandardUser()) {
    return;
  }

  const formData = new FormData(els.legacyForm);
  const heirIds = selectedValues(els.legacyBeneficiaryInput);
  if (heirIds.length === 0) {
    alert("請至少選擇 1 位繼承人。");
    return;
  }

  const heirs = heirIds
    .map(getBeneficiary)
    .filter(Boolean)
    .map((beneficiary) => ({
      id: beneficiary.id,
      name: beneficiary.name,
      email: beneficiary.email,
      relationship: beneficiary.relationship || "",
    }));

  const inheritance = {
    id: uid(),
    title: formData.get("title").trim(),
    heirs,
    releaseMode: formData.get("releaseMode"),
    releaseDate: formData.get("releaseDate") || todayKey(),
    message: formData.get("message").trim(),
    deathConfirmedAt: null,
    createdAt: new Date().toISOString(),
  };

  state.inheritances.unshift(inheritance);
  state.notifications.unshift({
    id: uid(),
    type: "legacy",
    userId: state.user.uid,
    message: `已建立「${inheritance.title}」數位繼承設定，繼承人 ${heirs.length} 位。`,
    createdAt: new Date().toISOString(),
  });
  await persistCollectionItem("inheritances", inheritance);
  await persistAll();
  els.legacyForm.reset();
  resetFormDefaults();
  render();
}

function getLegacyStatus(item) {
  if (item.releaseMode === "date") {
    return new Date(`${item.releaseDate}T00:00:00`).getTime() <= Date.now() ? "released" : "locked";
  }
  return item.deathConfirmedAt ? "released" : "locked";
}

async function deleteInheritance(id) {
  if (!confirm("刪除此數位繼承設定？")) {
    return;
  }
  state.inheritances = state.inheritances.filter((item) => item.id !== id);
  await deleteRemoteItem("inheritances", id);
  await saveLocalData();
  render();
}

async function saveSettings(event) {
  event.preventDefault();
  if (!requireSuperAdmin()) {
    return;
  }
  const canWriteSettings = isSuperAdmin();
  const formData = new FormData(els.settingsForm);
  state.settings = {
    dailyLoginCoins: Number(formData.get("dailyLoginCoins")) || 0,
    deathBufferDays: Number(formData.get("deathBufferDays")) || 7,
    coinValueTwd: Number(formData.get("coinValueTwd")) || 0,
    shippingFee: Number(formData.get("shippingFee")) || 0,
    freeShippingThreshold: Number(formData.get("freeShippingThreshold")) || 0,
    notificationEmail: formData.get("notificationEmail").trim(),
    currentUserRole: formData.get("currentUserRole") || "member",
  };
  if (state.profile) {
    state.profile.role = state.settings.currentUserRole;
  }
  if (state.mode === "firebase" && state.firebase && state.user && canWriteSettings) {
    const fb = state.firebase;
    await fb.setDoc(fb.doc(fb.db, "users", state.user.uid), state.profile, { merge: true });
    await fb.setDoc(fb.doc(fb.db, "platform", "settings"), state.settings, { merge: true });
  } else {
    await persistAll();
  }
  render();
  alert("設定已儲存。");
}

async function addProduct(event) {
  event.preventDefault();
  if (!requireSuperAdmin()) {
    return;
  }
  const formData = new FormData(els.productForm);
  const existingProduct = state.products.find((product) => product.id === state.editingProductId);
  const imageFiles = formData.getAll("productImages").filter((file) => file.size);
  if (imageFiles.length > 5) {
    alert("商品圖片最多上傳 5 張。");
    return;
  }
  let images = existingProduct?.images || [];
  try {
    if (imageFiles.length > 0) {
      images = await saveAssets(imageFiles, "product-image", MAX_IMAGE_SIZE);
    }
  } catch (error) {
    alert(error.message);
    return;
  }
  const product = {
    id: existingProduct?.id || uid(),
    name: formData.get("name").trim(),
    category: formData.get("category").trim(),
    price: Number(formData.get("price")) || 0,
    stock: Number(formData.get("stock")) || 0,
    description: formData.get("description").trim(),
    images,
    createdAt: existingProduct?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (existingProduct) {
    state.products = state.products.map((item) => (item.id === product.id ? product : item));
  } else {
    state.products.unshift(product);
  }
  await persistCollectionItem("products", product);
  state.editingProductId = null;
  els.productForm.reset();
  render();
}

function startProductEdit(id) {
  if (!requireSuperAdmin()) {
    return;
  }
  const product = state.products.find((item) => item.id === id);
  if (!product) {
    return;
  }

  state.editingProductId = id;
  els.productForm.elements.name.value = product.name;
  els.productForm.elements.category.value = product.category;
  els.productForm.elements.price.value = product.price;
  els.productForm.elements.stock.value = product.stock;
  els.productForm.elements.description.value = product.description || "";
  els.productImagesInput.value = "";
  switchView("adminView");
  renderAdmin();
  els.productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelProductEdit() {
  state.editingProductId = null;
  els.productForm.reset();
  renderAdmin();
}

async function deleteProduct(id) {
  if (!requireSuperAdmin()) {
    return;
  }
  const product = state.products.find((item) => item.id === id);
  if (!product || !confirm(`刪除商品「${product.name}」？`)) {
    return;
  }

  state.products = state.products.filter((item) => item.id !== id);
  await deleteRemoteItem("products", id);
  await saveLocalData();
  if (state.editingProductId === id) {
    state.editingProductId = null;
    els.productForm.reset();
  }
  render();
}

async function confirmDeathForCurrentUser() {
  if (!requireSuperAdmin()) {
    return;
  }

  if (!confirm("此操作會模擬繼承人共同確認您已離世，並啟動緩衝期。")) {
    return;
  }

  const now = new Date().toISOString();
  state.capsules
    .filter((item) => item.releaseMode === "death" && !item.deathConfirmedAt)
    .forEach((item) => {
      const required = Number(item.requiredConfirmations) || 1;
      item.deathConfirmations = (item.beneficiaryIds || []).slice(0, required).map((beneficiaryId) => ({
        beneficiaryId,
        confirmedAt: now,
      }));
      item.deathConfirmedAt = now;
      item.deathBufferDays = Number(item.deathBufferDays || state.settings.deathBufferDays) || 7;
      state.notifications.unshift({
        id: uid(),
        type: "capsule-death-confirmed",
        userId: state.user.uid,
        message: `「${item.title}」已達離世共同確認門檻，將於 ${item.deathBufferDays} 天緩衝後開啟。`,
        createdAt: now,
      });
    });

  state.inheritances
    .filter((item) => item.releaseMode === "death" && !item.deathConfirmedAt)
    .forEach((item) => {
      item.deathConfirmedAt = now;
      state.notifications.unshift({
        id: uid(),
        type: "legacy-release",
        userId: state.user.uid,
        message: `「${item.title}」已因人工確認過世流程而可開啟。`,
        createdAt: now,
      });
    });
  await persistAll();
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function switchView(viewId, force = false) {
  if (!force && !getAllowedViews().includes(viewId)) {
    setAuthNotice("此角色無法使用該功能。", "info");
    return;
  }
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewId));
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
}

function wireEvents() {
  els.googleLoginButton.addEventListener("click", () => login("google"));
  els.logoutButton.addEventListener("click", logout);
  els.checkInButton.addEventListener("click", checkInForCoins);
  els.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  els.capsuleForm.addEventListener("submit", addCapsule);
  els.capsuleForm.addEventListener("reset", () => window.setTimeout(resetFormDefaults, 0));
  els.capsuleReleaseModeInput.addEventListener("change", updateCapsuleReleaseControls);
  els.capsuleBeneficiaryInput.addEventListener("change", updateCapsuleReleaseControls);
  els.emptyCreateButton.addEventListener("click", () => document.querySelector(".composer-panel").scrollIntoView({ behavior: "smooth" }));
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
  els.categoryFilter.addEventListener("change", (event) => {
    state.category = event.target.value;
    renderShop();
  });
  els.useCoinsInput.addEventListener("input", renderCart);
  els.checkoutButton.addEventListener("click", checkout);
  els.beneficiaryForm.addEventListener("submit", addBeneficiary);
  els.legacyForm.addEventListener("submit", addInheritance);
  els.releaseModeInput.addEventListener("change", () => {
    els.releaseDateLabel.hidden = els.releaseModeInput.value === "death";
  });
  els.settingsForm.addEventListener("submit", saveSettings);
  els.productForm.addEventListener("submit", addProduct);
  els.cancelProductEditButton.addEventListener("click", cancelProductEdit);
  els.adminUserSelect.addEventListener("change", (event) => {
    state.adminSelectedUserId = event.target.value;
    state.adminEditingMessage = null;
    els.adminMessageForm.reset();
    renderAdmin();
  });
  els.adminMessageForm.addEventListener("submit", saveAdminMessage);
  els.cancelAdminMessageEditButton.addEventListener("click", cancelAdminMessageEdit);
  els.confirmDeathButton.addEventListener("click", confirmDeathForCurrentUser);
}

async function start() {
  resetFormDefaults();
  wireEvents();

  if (FIREBASE_READY) {
    await initFirebase();
    loadPublicData()
      .then(() => render())
      .catch((error) => {
        console.error(error);
        const store = readLocalStore();
        state.settings = store.settings;
        state.products = store.products;
        render();
      });
    state.firebase
      .getRedirectResult(state.firebase.auth)
      .catch((error) => setAuthNotice(getFirebaseFriendlyError(error), "error"));

    state.firebase.onAuthStateChanged(state.firebase.auth, (user) => {
      if (user) {
        startAuthenticatedSession(user);
        return;
      }

      state.authSyncId += 1;
      state.pendingSyncUserId = null;
      state.mode = "firebase";
      clearSessionState();
      render();
    });
  } else {
    await loadData();
    render();
  }

  window.setInterval(renderCapsules, 60000);
}

start().catch((error) => {
  console.error(error);
  els.runtimeMode.textContent = "初始化失敗，請檢查 Firebase 設定或瀏覽器主控台錯誤。";
});
