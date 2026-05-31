# Email 通知設定

目前網站會在新增繼承人後，將通知信寫入 Firestore 的 `mail` 集合。若要讓系統真正自動寄出 Email，Firebase 專案需要安裝官方 Trigger Email 擴充功能。

## 必要設定

1. 在 Firebase Console 開啟專案 `time-capsule-web`。
2. 前往 Extensions，安裝 `Trigger Email from Firestore`。
3. Email documents collection 請設定為 `mail`。
4. 設定寄信用 SMTP 服務，例如 SendGrid、Mailgun、Gmail SMTP 或其他可用的寄信服務。
5. 到 Firestore Rules 貼上本專案的 `firestore.rules` 並發布。

## 測試方式

1. 使用 Google 登入網站。
2. 到「數位繼承」新增繼承人。
3. 系統會跳出「通知繼承人」視窗。
4. 可修改 Email 主旨與通知內容。
5. 點選「送出 Email」。
6. 若 Firebase Trigger Email 已安裝且 SMTP 設定正確，系統會寄出通知信。

若尚未安裝 Trigger Email 擴充功能，網站仍會建立寄信佇列文件，但不會真正寄出 Email。

## 常見錯誤

如果畫面顯示「Firestore 規則尚未允許寫入 mail 集合」，請先到 Firestore Database > Rules，貼上本專案最新的 `firestore.rules` 並按「發布」。GitHub Pages 上傳規則檔不等於 Firebase 已套用規則，Firebase Console 仍需要另外發布一次。

如果畫面顯示「尚未偵測到 Firebase Trigger Email 擴充功能處理紀錄」，代表文件已經寫入 `mail` 集合，但擴充功能沒有接手處理。請檢查：

1. Extensions 是否已安裝 `Trigger Email from Firestore`。
2. 安裝時的 Email documents collection 是否填 `mail`。
3. SMTP 帳號、密碼、寄件人地址是否正確。
4. Firebase 專案是否已升級到可使用 Extensions / Cloud Functions 的方案。

擴充功能處理後，會在 `mail/{文件ID}` 加上 `delivery` 欄位。`delivery.state` 可能是 `PENDING`、`PROCESSING`、`SUCCESS` 或 `ERROR`。
