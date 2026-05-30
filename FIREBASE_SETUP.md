# Firebase 正式登入與雲端資料設定

目前 App 具備兩種模式：

- 本機示範模式：未填 Firebase 設定時啟用，資料存在瀏覽器 `localStorage`。
- Firebase 雲端模式：填入 `firebase-config.js` 後啟用，使用 Firebase Authentication 與 Cloud Firestore。

## 啟用 Google 登入

1. 前往 Firebase Console 建立專案。
2. 在 Authentication 啟用 Google provider。
3. 在 Firebase 專案設定新增 Web App，複製 Firebase config。
4. 將 config 貼到 `firebase-config.js`。
5. 在 Authentication 的 Authorized domains 加入正式網域，例如 `plugmoon.github.io`。

## 啟用 Cloud Firestore

正式雲端同步需要先啟用 Cloud Firestore API 並建立 Firestore Database。

1. 前往 Firebase Console 的 Firestore Database：
   https://console.firebase.google.com/project/time-capsule-web/firestore
2. 按「建立資料庫」或「Create database」。
3. 選 Production mode。
4. 建立完成後切到 Rules。
5. 將專案根目錄的 `firestore.rules` 完整貼上並發布。

若 Google API 回覆 `Cloud Firestore API has not been used... or it is disabled`，代表 API 尚未啟用。請先前往以下網址按 Enable：

https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=time-capsule-web

Firebase 官方文件：

- Google 登入：https://firebase.google.com/docs/auth/web/google-signin
- Firestore 快速入門：https://firebase.google.com/docs/firestore/quickstart

## Firestore 資料集合

- `users/{uid}`：會員資料、時光幣餘額。
- `users/{uid}/capsules/{capsuleId}`：使用者自己的時光寶盒。
- `users/{uid}/inheritances/{inheritanceId}`：使用者自己的數位繼承設定。
- `users/{uid}/beneficiaries/{beneficiaryId}`：使用者預先設定的繼承人。
- `platform/settings`：時光幣比例、登入獎勵、運費、通知信箱。
- `products/{productId}`：商城商品。
- `orders/{orderId}`：訂單。
- `notifications/{notificationId}`：通知紀錄。

## 數位繼承注意事項

「確認用戶已過世」必須是人工審核流程，不應由前端或未驗證資料自動判定。正式商用時建議補上：

- 後台管理員登入與權限。
- 文件審核流程。
- 審核紀錄不可竄改。
- 繼承人身份驗證。
- 法務條款與個資同意。
