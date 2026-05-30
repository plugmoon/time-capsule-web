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

## 啟用 Cloud Firestore

目前線上 App 需要 Cloud Firestore 儲存會員資料、時光寶盒、繼承人、商城商品與訂單。

1. 到 Firebase Console：https://console.firebase.google.com/project/time-capsule-web/firestore
2. 左側選 Build > Firestore Database。
3. 按「建立資料庫」或「Create database」。
4. 位置可選 `asia-east1` 或離主要使用者最近的位置。
5. 安全規則模式先選 Production mode。
6. 建立完成後，進入 Rules。
7. 將專案內 `firestore.rules` 的內容完整貼上。
8. 按「發布」或「Publish」。

如果看到 `Cloud Firestore API has not been used... or it is disabled`，請先打開以下網址並按 Enable：

https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=time-capsule-web

Firebase 官方文件說明，Web App 註冊後會取得 Firebase configuration object，用來連接 Firebase 專案資源。
