# ⚽🏆 世足運彩代購對帳系統 (World Cup Football Bet Manager)

一個專為朋友們共同投注運彩代購設計的記帳與對帳系統。採用 PPVI 質感設計規範（磨砂玻璃、亮暗主題、極簡配色），並原生支援 Supabase 雲端資料庫，讓所有人都可以即時同步與對帳。

---

## 🌟 特色功能

1. **PPVI 質感設計**：亮色 (日常對帳) 與暗色 (夜間大螢幕展示) 雙主題，流暢的過度與微互動。
2. **多樣化出資分配**：
   * **均分**：自動平分下注總本金。
   * **每人 100 元**：台灣運彩最常見玩法，一鍵帶入，總本金自動連動 `勾選人數 * 100`。
   * **比例分攤**：支持按自訂百分比扣款。
   * **自訂金額**：免輸入總本金，下方填多少，上方自動加總回填。
3. **極致串關支援**：支援動態增加多關卡，可分別填寫每關賽事、玩法與獨立賠率，系統將**自動累乘計算總賠率**，且在明細與 LINE 報表中完美拼接呈現。
4. **餘額允許為負**：支援小白借錢下注，負數餘額會以珊瑚紅亮色標註「欠款」，一目了然。
5. **一鍵 LINE 群組報表**：自動生成包含手頭現金、在途本金、各人損益、待開獎注單明細的精緻 LINE 對帳報表。
6. **雲端與備份**：原生連線 Supabase，並提供手動 JSON 資料備份與匯出/匯入。

---

## 🚀 如何將網站上傳至 GitHub 並啟用免費外網 (GitHub Pages)

### 第一步：建立 GitHub 倉庫
1. 登入您的 [GitHub 帳號](https://github.com/)。
2. 點選右上角的 **「+」** ➡️ 選擇 **「New repository」**。
3. 填入專案名稱（例如：`football-bet-manager`）。
4. 選擇 **Public**（公開），然後點選 **「Create repository」**。

### 第二步：使用 Git 將程式推送到 GitHub
請在您的電腦終端機 (PowerShell 或 Command Prompt) 執行以下指令：

```bash
# 初始化 Git 倉庫
git init

# 將所有檔案加入暫存區
git add .

# 提交第一次紀錄
git commit -m "First commit: Football Bet Manager PPVI"

# 設定主分支為 main
git branch -M main

# 關聯到您的 GitHub 倉庫 (請將下方的網址換成您剛剛建立的 GitHub Repository 網址)
git remote add origin https://github.com/您的帳號/您的倉庫名稱.git

# 推送到 GitHub
git push -u origin main
```

### 第三步：開啟 GitHub Pages 免費網址
1. 在您的 GitHub 專案頁面中，點選上方選單的 **「Settings」** (設定 ⚙️)。
2. 在左側側邊欄中，找到並點選 **「Pages」**。
3. 在 **Build and deployment** 下方的 **Branch**，將第一個下拉選單從 `None` 改為 **`main`**，後面的資料夾保持 `/ (root)`。
4. 點選 **「Save」** (儲存)。
5. 稍等約 1 分鐘後，重新整理該頁面，最上方會出現一條綠色橫條，顯示：
   👉 **`Your site is live at https://您的帳號.github.io/您的倉庫名稱/`**

這個網址就是可以直接給同學們在外網開啟、自動連線對帳的專屬網站了！
