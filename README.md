# 時光寶盒 Web App

這是一個可部署在 Web 上執行的靜態時光膠囊 APP。它不需要後端服務，資料會儲存在使用者瀏覽器的 `localStorage`。

## 功能

- 建立時光寶盒：標題、收件人、開啟時間、心情標籤、保護密語與內容。
- 倒數封存：未到時間前只顯示倒數。
- 到期開啟：到達指定時間後可開啟閱讀內容。
- 密語保護：建立時可選擇加入保護密語。
- 搜尋與篩選：依標題、收件人、內容、狀態查找。
- 備份匯入匯出：以 JSON 檔備份或還原資料。

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
