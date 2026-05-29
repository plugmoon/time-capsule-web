# Firebase 快速設定步驟

## 你要先做的事

1. 打開 Firebase Console：https://console.firebase.google.com/
2. 按「Create a project」或「建立專案」。
3. 專案名稱輸入：`time-capsule-web`。
4. Google Analytics 可以先選擇不啟用。
5. 建立完成後，進入專案總覽。
6. 點 Web 圖示 `</>` 新增 Web App。
7. App nickname 輸入：`time-capsule-web`。
8. 按 Register app。
9. 複製畫面中的 `firebaseConfig` 物件。

## 自動寫入 firebase-config.js

1. 複製 `firebaseConfig` 物件後，不要再複製其他文字。
2. 回到專案資料夾，雙擊 `set-firebase-config.bat`。
3. 如果畫面顯示 `Firebase config updated`，代表已寫入完成。

## 啟用登入

1. 到 Firebase Console 左側選 Authentication。
2. 進入 Sign-in method。
3. 啟用 Google。
4. 啟用 Facebook 需要先到 Meta for Developers 建立 Facebook App，取得 App ID 與 App Secret。
5. 在 Authentication 的 Authorized domains 加入：`plugmoon.github.io`。

Firebase 官方文件說明，Web App 註冊後會取得 Firebase configuration object，用來連接 Firebase 專案資源。
