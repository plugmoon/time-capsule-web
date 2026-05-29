# 時光寶盒 Web App

這是一個可部署在 Web 上執行的靜態時光膠囊 APP。它不需要後端服務，資料會儲存在使用者瀏覽器的 `localStorage`。

## 功能

- 建立時光寶盒：標題、收件人、開啟時間、心情標籤、保護密語與內容。
- 倒數封存：未到時間前只顯示倒數。
- 到期開啟：到達指定時間後可開啟閱讀內容。
- 密語保護：建立時可選擇加入保護密語。
- 搜尋與篩選：依標題、收件人、內容、狀態查找。
- Google / Facebook 登入：填入 Firebase 設定後啟用正式 OAuth 登入；未設定時使用本機示範模式。
- 時光幣：登入每日發放，可由後台設定發放數量與折抵比例。
- 時光幣：使用者點選「立即簽到」後發放，可由後台設定發放數量與折抵比例。
- 購物商城：商品分類、價格、庫存、3-5 張商品圖片、運費、時光幣折抵、訂單與通知紀錄。
- 繼承人與數位繼承：可預先新增繼承人，建立寶盒時指定可開啟的繼承人。
- 開啟條件：支援指定日期，或在離世後由指定數量的繼承人共同確認，並等待設定的緩衝時間。

## 本機執行

直接用瀏覽器開啟 `index.html` 即可。

如果要用本機 HTTP 服務測試，可在專案根目錄執行任一靜態伺服器。

## 部署

可部署到任何靜態網站服務：

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- Firebase Hosting

部署時將專案根目錄作為網站根目錄，入口檔為 `index.html`。

## GitHub Pages 一鍵部署

此專案包含 `deploy-github.ps1`，可在沒有 `git` 與 GitHub CLI 的環境中，透過 GitHub API 建立儲存庫、上傳檔案並啟用 GitHub Pages。

最簡單方式是雙擊 `deploy-github.bat`，貼上 GitHub Token，輸入 repo 名稱後自動部署。

```powershell
$env:GITHUB_TOKEN="你的 GitHub Personal Access Token"
powershell -ExecutionPolicy Bypass -File .\deploy-github.ps1 -RepoName "time-capsule-web"
```

## Firebase 正式模式

請參考 `FIREBASE_SETUP.md`。正式 Google / Facebook 登入與雲端資料需要 Firebase Authentication、Cloud Firestore 與對應 OAuth provider 設定。

若你已從 Firebase Console 複製 `firebaseConfig` 物件，可雙擊 `set-firebase-config.bat` 自動寫入 `firebase-config.js`。
