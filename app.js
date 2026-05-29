const STORAGE_KEY = "timeCapsulePlatform.v2";
const FIREBASE_CONFIG = window.TIME_CAPSULE_FIREBASE_CONFIG || {};
const DEMO_MODE = new URLSearchParams(window.location.search).has("demo");
const FIREBASE_READY = !DEMO_MODE && Boolean(FIREBASE_CONFIG.apiKey && !String(FIREBASE_CONFIG.apiKey).startsWith("YOUR_"));
const MB = 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * MB;
const MAX_FILE_SIZE = 100 * MB;

const DEFAULT_SETTINGS = {
  dailyLoginCoins: 10,
  coinValueTwd: 10,
  shippingFee: 80,
  freeShippingThreshold: 1200,
  notificationEmail: "admin@example.com",
  deathBufferDays: 7,
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
  products: [],
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
};

const els = {
  runtimeMode: document.querySelector("#runtimeMode"),
  googleLoginButton: document.querySelector("#googleLoginButton"),
  facebookLoginButton: document.querySelector("#facebookLoginButton"),
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
    };
  } catch {
    return {
      users: {},
      settings: { ...DEFAULT_SETTINGS },
      products: DEFAULT_PRODUCTS,
      orders: [],
      notifications: [],
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

  store.users[state.user.uid] ||= {
    profile: {
      uid: state.user.uid,
      displayName: state.user.displayName,
      email: state.user.email,
      coins: 0,
      lastLoginAwardDate: null,
      lastCheckInDate: null,
      createdAt: new Date().toISOString(),
    },
    capsules: [],
    inheritances: [],
    beneficiaries: [],
  };

  return store.users[state.user.uid];
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

function getFirebaseFriendlyError(error, provider = "") {
  const code = error?.code || "";
  const providerName = provider === "facebook" ? "Facebook" : provider === "google" ? "Google" : "Firebase";

  const messages = {
    "auth/operation-not-allowed": `${providerName} 登入尚未在 Firebase Authentication 啟用。請到 Authentication > Sign-in method 啟用此登入方式。`,
    "auth/configuration-not-found": "Firebase Authentication 尚未啟用或登入方式尚未設定。請到 Firebase Console > Authentication 按 Get started，並在 Sign-in method 啟用 Google / Facebook。",
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

  if (String(error?.message || "").includes("permission-denied")) {
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
}

async function loadFirebaseData() {
  const fb = state.firebase;
  const userRef = fb.doc(fb.db, "users", state.user.uid);
  const settingsRef = fb.doc(fb.db, "platform", "settings");
  const [
    profileSnap,
    settingsSnap,
    productSnap,
    capsuleSnap,
    inheritanceSnap,
    beneficiarySnap,
    orderSnap,
    notificationSnap,
  ] =
    await Promise.all([
      fb.getDoc(userRef),
      fb.getDoc(settingsRef),
      fb.getDocs(fb.collection(fb.db, "products")),
      fb.getDocs(fb.collection(fb.db, "users", state.user.uid, "capsules")),
      fb.getDocs(fb.collection(fb.db, "users", state.user.uid, "inheritances")),
      fb.getDocs(fb.collection(fb.db, "users", state.user.uid, "beneficiaries")),
      fb.getDocs(fb.query(fb.collection(fb.db, "orders"), fb.where("userId", "==", state.user.uid))),
      fb.getDocs(fb.collection(fb.db, "notifications")),
    ]);

  state.profile = profileSnap.exists()
    ? { lastCheckInDate: null, ...profileSnap.data() }
    : {
        uid: state.user.uid,
        displayName: state.user.displayName,
        email: state.user.email,
        coins: 0,
        lastLoginAwardDate: null,
        lastCheckInDate: null,
        createdAt: new Date().toISOString(),
      };
  state.settings = settingsSnap.exists() ? { ...DEFAULT_SETTINGS, ...settingsSnap.data() } : { ...DEFAULT_SETTINGS };
  state.products = productSnap.empty ? DEFAULT_PRODUCTS : productSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  state.capsules = capsuleSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  state.inheritances = inheritanceSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  state.beneficiaries = beneficiarySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  state.orders = orderSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  state.notifications = notificationSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  await fb.setDoc(userRef, state.profile, { merge: true });
  if (!settingsSnap.exists()) {
    await fb.setDoc(settingsRef, state.settings, { merge: true });
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

async function persistCollectionItem(collectionName, item) {
  if (state.mode === "firebase" && state.firebase && state.user) {
    const fb = state.firebase;
    if (collectionName === "capsules") {
      await fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "capsules", item.id), item, { merge: true });
    } else if (collectionName === "inheritances") {
      await fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "inheritances", item.id), item, { merge: true });
    } else if (collectionName === "beneficiaries") {
      await fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "beneficiaries", item.id), item, { merge: true });
    } else if (collectionName === "products") {
      await fb.setDoc(fb.doc(fb.db, "products", item.id), item, { merge: true });
    } else if (collectionName === "orders") {
      await fb.setDoc(fb.doc(fb.db, "orders", item.id), item, { merge: true });
    } else if (collectionName === "notifications") {
      await fb.setDoc(fb.doc(fb.db, "notifications", item.id), item, { merge: true });
    }
    await fb.setDoc(fb.doc(fb.db, "users", state.user.uid), state.profile, { merge: true });
    await fb.setDoc(fb.doc(fb.db, "platform", "settings"), state.settings, { merge: true });
    return;
  }

  await saveLocalData();
}

async function persistAll() {
  if (state.mode === "firebase" && state.firebase && state.user) {
    const fb = state.firebase;
    await fb.setDoc(fb.doc(fb.db, "users", state.user.uid), state.profile, { merge: true });
    await fb.setDoc(fb.doc(fb.db, "platform", "settings"), state.settings, { merge: true });
    for (const capsule of state.capsules) {
      await fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "capsules", capsule.id), capsule, { merge: true });
    }
    for (const inheritance of state.inheritances) {
      await fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "inheritances", inheritance.id), inheritance, { merge: true });
    }
    for (const beneficiary of state.beneficiaries) {
      await fb.setDoc(fb.doc(fb.db, "users", state.user.uid, "beneficiaries", beneficiary.id), beneficiary, { merge: true });
    }
    for (const product of state.products) {
      await fb.setDoc(fb.doc(fb.db, "products", product.id), product, { merge: true });
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

async function deleteRemoteItem(collectionName, id) {
  if (!(state.mode === "firebase" && state.firebase && state.user)) {
    return;
  }

  const fb = state.firebase;
  if (collectionName === "capsules") {
    await fb.deleteDoc(fb.doc(fb.db, "users", state.user.uid, "capsules", id));
  } else if (collectionName === "inheritances") {
    await fb.deleteDoc(fb.doc(fb.db, "users", state.user.uid, "inheritances", id));
  } else if (collectionName === "beneficiaries") {
    await fb.deleteDoc(fb.doc(fb.db, "users", state.user.uid, "beneficiaries", id));
  } else if (collectionName === "products") {
    await fb.deleteDoc(fb.doc(fb.db, "products", id));
  }
}

async function login(provider) {
  if (FIREBASE_READY && state.firebase) {
    const fb = state.firebase;
    const authProvider = provider === "google" ? new fb.GoogleAuthProvider() : new fb.FacebookAuthProvider();
    setAuthNotice("正在開啟登入視窗，請在彈窗中完成授權。");

    try {
      await fb.signInWithPopup(fb.auth, authProvider);
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
    displayName: provider === "google" ? "Google 示範會員" : "Facebook 示範會員",
    email: `${provider}@demo.local`,
    provider,
  };
  await loadData();
  render();
}

async function logout() {
  if (state.mode === "firebase" && state.firebase) {
    await state.firebase.signOut(state.firebase.auth);
  }
  state.user = null;
  state.profile = null;
  state.capsules = [];
  state.inheritances = [];
  state.orders = [];
  state.cart = [];
  setAuthNotice("");
  render();
}

async function checkInForCoins() {
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
  alert("請先使用 Google 或 Facebook 登入。");
  return false;
}

function renderAuth() {
  const signedIn = Boolean(state.user);
  els.userChip.hidden = !signedIn;
  els.logoutButton.hidden = !signedIn;
  els.checkInButton.hidden = !signedIn;
  els.checkInButton.disabled =
    signedIn && (state.profile?.lastCheckInDate === todayKey() || state.profile?.lastLoginAwardDate === todayKey());
  els.checkInButton.textContent = els.checkInButton.disabled ? "今日已簽到" : "立即簽到";
  els.googleLoginButton.hidden = signedIn;
  els.facebookLoginButton.hidden = signedIn;
  els.userName.textContent = state.profile?.displayName || state.user?.displayName || "訪客";
  els.userAvatar.textContent = (state.profile?.displayName || "時").slice(0, 1);
  els.coinBalance.textContent = state.profile?.coins || 0;
  els.runtimeMode.textContent =
    state.mode === "firebase"
      ? "目前使用 Firebase Authentication / Firestore 雲端模式。"
      : "目前使用本機示範模式；填入 Firebase 設定後可啟用正式 Google / Facebook 登入與雲端資料。";
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
  const maxCoins = Math.min(
    Number(state.profile?.coins) || 0,
    Math.floor(subtotal / Math.max(1, Number(state.settings.coinValueTwd) || 1)),
  );
  const requestedCoins = Math.min(maxCoins, Math.max(0, Number(els.useCoinsInput.value) || 0));
  els.useCoinsInput.max = String(maxCoins);
  els.useCoinsInput.value = String(requestedCoins);

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

function renderAdmin() {
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
          return row;
        })
      : [Object.assign(document.createElement("p"), { className: "hint", textContent: "尚無訂單或通知。" })]),
  );
}

function render() {
  renderAuth();
  renderStats();
  renderBeneficiaries();
  renderCapsules();
  renderShop();
  renderLegacy();
  renderAdmin();
}

function resetFormDefaults() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  els.unlockInput.min = toLocalInputValue(new Date());
  els.unlockInput.value = toLocalInputValue(tomorrow);
  els.releaseDateInput.min = todayKey();
  els.releaseDateInput.value = todayKey();
  els.capsuleDeathRuleGroup.hidden = els.capsuleReleaseModeInput.value !== "death";
}

async function addCapsule(event) {
  event.preventDefault();
  if (!requireLogin()) {
    return;
  }

  const formData = new FormData(els.capsuleForm);
  const beneficiaryIds = selectedValues(els.capsuleBeneficiaryInput);
  const releaseMode = formData.get("releaseMode");
  if (releaseMode === "death" && beneficiaryIds.length === 0) {
    alert("選擇「在我離世後」時，請先新增並指定至少 1 位繼承人。");
    return;
  }
  const requiredConfirmations = Math.min(
    Math.max(1, Number(formData.get("requiredConfirmations")) || 1),
    Math.max(1, beneficiaryIds.length),
  );
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
    unlockAt: new Date(formData.get("unlockAt")).toISOString(),
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
    els.revealedMessage.textContent = `剩餘 ${getCountdownText(capsule.unlockAt)}`;
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
  if (!requireLogin()) {
    return;
  }

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
  if (!requireLogin()) {
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
  await persistCollectionItem("beneficiaries", beneficiary);
  els.beneficiaryForm.reset();
  render();
}

async function deleteBeneficiary(id) {
  if (!confirm("刪除此繼承人？既有寶盒中的指定紀錄不會被自動移除。")) {
    return;
  }
  state.beneficiaries = state.beneficiaries.filter((item) => item.id !== id);
  await deleteRemoteItem("beneficiaries", id);
  await saveLocalData();
  render();
}

async function checkout() {
  if (!requireLogin() || state.cart.length === 0) {
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const maxCoins = Math.min(
    Number(state.profile.coins) || 0,
    Math.floor(subtotal / Math.max(1, Number(state.settings.coinValueTwd) || 1)),
  );
  const usedCoins = Math.min(maxCoins, Math.max(0, Number(els.useCoinsInput.value) || 0));
  const discount = usedCoins * (Number(state.settings.coinValueTwd) || 0);
  const shipping =
    subtotal >= Number(state.settings.freeShippingThreshold) ? 0 : Number(state.settings.shippingFee) || 0;
  const total = Math.max(0, subtotal - discount + shipping);

  const order = {
    id: uid(),
    userId: state.user.uid,
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

  state.profile.coins = Math.max(0, (Number(state.profile.coins) || 0) - usedCoins);
  state.orders.unshift(order);
  state.notifications.unshift({
    id: uid(),
    type: "order",
    userId: state.user.uid,
    message: `新訂單已建立，通知對象：${state.settings.notificationEmail}`,
    createdAt: new Date().toISOString(),
  });
  state.cart = [];
  await persistCollectionItem("orders", order);
  await persistAll();
  render();
  alert("訂單已建立。");
}

async function addInheritance(event) {
  event.preventDefault();
  if (!requireLogin()) {
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
  const formData = new FormData(els.settingsForm);
  state.settings = {
    dailyLoginCoins: Number(formData.get("dailyLoginCoins")) || 0,
    deathBufferDays: Number(formData.get("deathBufferDays")) || 7,
    coinValueTwd: Number(formData.get("coinValueTwd")) || 0,
    shippingFee: Number(formData.get("shippingFee")) || 0,
    freeShippingThreshold: Number(formData.get("freeShippingThreshold")) || 0,
    notificationEmail: formData.get("notificationEmail").trim(),
  };
  await persistAll();
  render();
  alert("設定已儲存。");
}

async function addProduct(event) {
  event.preventDefault();
  const formData = new FormData(els.productForm);
  const existingProduct = state.products.find((product) => product.id === state.editingProductId);
  const imageFiles = formData.getAll("productImages").filter((file) => file.size);
  if ((!existingProduct || imageFiles.length > 0) && (imageFiles.length < 3 || imageFiles.length > 5)) {
    alert("商品圖片請上傳 3-5 張。");
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
  if (!requireLogin()) {
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

function switchView(viewId) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewId));
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
}

function wireEvents() {
  els.googleLoginButton.addEventListener("click", () => login("google"));
  els.facebookLoginButton.addEventListener("click", () => login("facebook"));
  els.logoutButton.addEventListener("click", logout);
  els.checkInButton.addEventListener("click", checkInForCoins);
  els.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  els.capsuleForm.addEventListener("submit", addCapsule);
  els.capsuleForm.addEventListener("reset", () => window.setTimeout(resetFormDefaults, 0));
  els.capsuleReleaseModeInput.addEventListener("change", () => {
    els.capsuleDeathRuleGroup.hidden = els.capsuleReleaseModeInput.value !== "death";
  });
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
  els.confirmDeathButton.addEventListener("click", confirmDeathForCurrentUser);
}

async function start() {
  resetFormDefaults();
  wireEvents();

  if (FIREBASE_READY) {
    await initFirebase();
    state.firebase
      .getRedirectResult(state.firebase.auth)
      .catch((error) => setAuthNotice(getFirebaseFriendlyError(error), "error"));

    state.firebase.onAuthStateChanged(state.firebase.auth, async (user) => {
      state.mode = "firebase";
      state.user = user
        ? {
            uid: user.uid,
            displayName: user.displayName || user.email || "會員",
            email: user.email || "",
            provider: user.providerData?.[0]?.providerId || "firebase",
          }
        : null;
      if (state.user) {
        state.profile = {
          uid: state.user.uid,
          displayName: state.user.displayName,
          email: state.user.email,
          coins: state.profile?.coins || 0,
          lastLoginAwardDate: state.profile?.lastLoginAwardDate || null,
          lastCheckInDate: state.profile?.lastCheckInDate || null,
          createdAt: state.profile?.createdAt || new Date().toISOString(),
        };

        try {
          await loadData();
          setAuthNotice("登入成功，已連接 Firebase 雲端資料。", "success");
        } catch (error) {
          console.error(error);
          state.mode = "local";
          await loadData();
          setAuthNotice(
            `${getFirebaseFriendlyError(error)} 目前已先登入並暫用本機資料模式。`,
            "error",
          );
        }
      } else {
        state.profile = null;
        state.capsules = [];
        state.inheritances = [];
        state.orders = [];
        state.cart = [];
      }
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
