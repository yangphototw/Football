// World Cup Football Bet Manager - Core Application Logic with Supabase Cloud Support & PPVI Premium Theme

// Initial Clean Demo Data (Zero Balances for all members)
const DEFAULT_DATA = {
    members: [
        { id: 'm1', name: '小白', balance: 0, totalDeposit: 0, totalWithdraw: 0 },
        { id: 'm2', name: '政陽', balance: 0, totalDeposit: 0, totalWithdraw: 0 },
        { id: 'm3', name: 'Pulu', balance: 0, totalDeposit: 0, totalWithdraw: 0 },
        { id: 'm4', name: '熊學長', balance: 0, totalDeposit: 0, totalWithdraw: 0 }
    ],
    transactions: [],
    bets: []
};

// Global Application State
let appData = {
    members: [],
    transactions: [],
    bets: []
};

// Supabase Default Credentials (Hardcoded for sharing)
const DEFAULT_SUPABASE_URL = "https://bcwxgrgbliwwgvfhzwqu.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_rlF5B-dsogw9D4ZkoTfg_g_wfeRsYWN";

// Supabase State
let supabaseClient = null;
let profitChart = null;

// Cloud warning banner utility functions
function showCloudWarning(error) {
    console.error("Supabase Cloud Sync Warning:", error);
    const banner = document.getElementById('cloud-warning-banner');
    if (banner) {
        banner.classList.remove('hidden');
    }
}

function hideCloudWarning() {
    const banner = document.getElementById('cloud-warning-banner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

// Initialize App (Non-blocking Bootstrapping)
document.addEventListener('DOMContentLoaded', () => {
    // 1. Theme initialization
    initTheme();

    // 2. Process potential URL configuration parameters (easy share link)
    processUrlParams();
    
    // 3. Initialize Supabase if credentials exist
    initSupabase();

    // 4. Setup UI Routing (Immediately functional and interactive)
    setupRouting();

    // 5. Setup Form Listeners & Modals
    setupEventListeners();
    setTodayDate();
    
    // 6. Asynchronously fetch database data without blocking UI menus
    loadData().then(async () => {
        // Hotfix: Clean up any old member names automatically and sync to cloud
        await sanitizeMemberNames();
        renderAll();
        updateCloudStatusUI();
    }).catch(err => {
        console.error("Data load sequence failed:", err);
    });
});

// Theme Management Logic
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.className = savedTheme + '-theme';
    updateThemeButtonUI(savedTheme);
}

function toggleTheme() {
    const current = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.className = next + '-theme';
    localStorage.setItem('theme', next);
    updateThemeButtonUI(next);
    
    // Re-render chart to update grid/text colors
    if (profitChart) {
        initProfitChart();
    }
}

function updateThemeButtonUI(theme) {
    const btn = document.getElementById('btnThemeToggle');
    if (btn) {
        btn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    }
}

// Process URL parameters for easy configuration sharing
function processUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const supaUrl = urlParams.get('supaUrl');
    const supaKey = urlParams.get('supaKey');

    if (supaUrl && supaKey) {
        localStorage.setItem('supabase_url', supaUrl);
        localStorage.setItem('supabase_key', supaKey);
        
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        
        showToast('已由分享連結自動套用雲端同步設定！');
    }
}

// Initialize Supabase client
function initSupabase() {
    let url = localStorage.getItem('supabase_url') || DEFAULT_SUPABASE_URL;
    let key = localStorage.getItem('supabase_key');

    // If no key in localStorage but DEFAULT_SUPABASE_KEY is configured, use it
    if (!key && DEFAULT_SUPABASE_KEY !== "YOUR_ANON_KEY") {
        key = DEFAULT_SUPABASE_KEY;
    }

    if (url && key && window.supabase) {
        try {
            supabaseClient = window.supabase.createClient(url, key);
            
            // Console helper to copy key easily
            console.log(`%c⚽ 運彩代購對帳系統：%c雲端連線成功！`, "color: #e2b85c; font-weight: bold; font-size: 13px;", "color: #10b981; font-weight: bold; font-size: 13px;");
            console.log(`💡 %c同學分享貼心提示%c：如果您想將目前的連線資訊徹底「寫死」在網頁中直接分享給同學，請編輯 app.js 並在頂端第 22-23 行填入：`, "color: #3b82f6; font-weight: bold;", "color: inherit;");
            console.log(`const DEFAULT_SUPABASE_URL = "${url}";\nconst DEFAULT_SUPABASE_KEY = "${key}";`);
        } catch (e) {
            console.error("Failed to initialize Supabase client:", e);
            supabaseClient = null;
        }
    } else {
        supabaseClient = null;
    }
}

// Update settings page connection status UI
function updateCloudStatusUI() {
    const textEl = document.getElementById('cloud-status-text');
    const boxEl = document.getElementById('cloud-status-box');
    const urlInput = document.getElementById('settings-supa-url');
    const keyInput = document.getElementById('settings-supa-key');
    
    if (urlInput) urlInput.value = localStorage.getItem('supabase_url') || '';
    if (keyInput) keyInput.value = localStorage.getItem('supabase_key') || '';

    if (textEl && boxEl) {
        if (supabaseClient) {
            textEl.innerHTML = '<i class="fa-solid fa-cloud text-green"></i> 雲端同步中 (已成功連線至 Supabase 資料庫)';
            textEl.className = 'text-green font-bold';
            boxEl.style.borderColor = 'var(--color-green)';
        } else {
            textEl.innerHTML = '<i class="fa-solid fa-cloud-slash"></i> 本地儲存模式 (使用瀏覽器 LocalStorage，無法跨裝置同步)';
            textEl.className = 'text-secondary';
            boxEl.style.borderColor = 'var(--border-color)';
        }
    }
}

// Automatically correct old member names from database or localstorage
async function sanitizeMemberNames() {
    let hasChanges = false;
    const updatePromises = [];

    appData.members.forEach(m => {
        let newName = m.name;
        // Map old names to new ones requested by the user
        if (m.name === '小明') { newName = '政陽'; hasChanges = true; }
        else if (m.name === '小華') { newName = 'Pulu'; hasChanges = true; }
        else if (m.name === '阿翔') { newName = '熊學長'; hasChanges = true; }
        
        if (newName !== m.name) {
            m.name = newName;
            if (supabaseClient) {
                updatePromises.push(
                    supabaseClient.from('members').update({ name: newName }).eq('id', m.id)
                );
            }
        }
    });

    if (hasChanges) {
        if (supabaseClient && updatePromises.length > 0) {
            try {
                await Promise.all(updatePromises);
            } catch (err) {
                console.error("Cloud name sanitization sync failed:", err);
            }
        }
        saveLocalData();
        console.log("Automatic hotfix: Member names updated to standard list (政陽, Pulu, 熊學長)");
    }
}

// Load data (supports Cloud Fetch and LocalStorage Fallback)
async function loadData() {
    // Version Control Check: Clear older LocalStorage demo entries to align names and zero out cache
    if (!localStorage.getItem('app_version_v5')) {
        localStorage.removeItem('football_bet_manager_data');
        localStorage.setItem('app_version_v5', 'true');
        console.log("Cleared outdated local cache. Applied fresh DEFAULT_DATA.");
    }

    if (supabaseClient) {
        try {
            hideCloudWarning(); // Reset warning banner if connection is established
            // Fetch everything concurrently from Supabase
            const [membersRes, transRes, betsRes] = await Promise.all([
                supabaseClient.from('members').select('*'),
                supabaseClient.from('transactions').select('*'),
                supabaseClient.from('bets').select('*')
            ]);

            if (membersRes.error) throw membersRes.error;
            if (transRes.error) throw transRes.error;
            if (betsRes.error) throw betsRes.error;

            // Map data
            appData.members = membersRes.data || [];
            appData.transactions = transRes.data || [];
            appData.bets = betsRes.data || [];

            // Map keys from snake_case to CamelCase with robust null-safety fallbacks
            appData.members = appData.members.map(m => ({
                id: m.id,
                name: m.name || '未知名稱',
                balance: parseFloat(m.balance) || 0,
                totalDeposit: parseFloat(m.total_deposit) || 0,
                totalWithdraw: parseFloat(m.total_withdraw) || 0
            }));

            appData.transactions = appData.transactions.map(t => ({
                id: t.id,
                memberId: t.member_id,
                type: t.type || 'deposit',
                amount: parseFloat(t.amount) || 0,
                date: t.date || '',
                note: t.note || ''
            }));

            appData.bets = appData.bets.map(b => ({
                id: b.id,
                matchName: b.match_name || '未知賽事',
                betType: b.bet_type || '未知玩法',
                odds: parseFloat(b.odds) || 0,
                amount: parseFloat(b.amount) || 0,
                bettors: Array.isArray(b.bettors) ? b.bettors : [], // Strict safety check for array
                status: b.status || 'pending',
                wonAmount: parseFloat(b.won_amount) || 0,
                date: b.date || '',
                note: b.note || ''
            }));

            // If database is completely empty, initialize it with DEFAULT_DATA
            if (appData.members.length === 0) {
                console.log("Supabase database empty. Initializing default data...");
                await initializeCloudWithDefaults();
            }
        } catch (err) {
            console.error("Cloud database fetch failed. Falling back to local storage:", err);
            showCloudWarning(err);
            showToast("雲端連線失敗或權限不足，切換為本地唯讀快取", "error");
            loadLocalFallback();
        }
    } else {
        loadLocalFallback();
        hideCloudWarning();
    }
}

// Fallback to LocalStorage
function loadLocalFallback() {
    const local = localStorage.getItem('football_bet_manager_data');
    if (local) {
        try {
            appData = JSON.parse(local);
            if (!appData.members) appData.members = [];
            if (!appData.transactions) appData.transactions = [];
            if (!appData.bets) appData.bets = [];
            
            // If even localfallback is empty, force load DEFAULT_DATA
            if (appData.members.length === 0) {
                appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
                saveLocalData();
            }
        } catch (e) {
            appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
            saveLocalData();
        }
    } else {
        appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
        saveLocalData();
    }
}

// Save to LocalStorage (used in local mode)
function saveLocalData() {
    localStorage.setItem('football_bet_manager_data', JSON.stringify(appData));
}

// Write default demo data to Supabase (safely avoids inserting empty arrays)
async function initializeCloudWithDefaults() {
    try {
        // Upload members (always populated)
        if (DEFAULT_DATA.members.length > 0) {
            const { error: mErr } = await supabaseClient.from('members').insert(
                DEFAULT_DATA.members.map(m => ({
                    id: m.id,
                    name: m.name,
                    balance: m.balance,
                    total_deposit: m.totalDeposit,
                    total_withdraw: m.totalWithdraw
                }))
            );
            if (mErr) throw mErr;
        }

        // Upload transactions
        if (DEFAULT_DATA.transactions.length > 0) {
            const { error: tErr } = await supabaseClient.from('transactions').insert(
                DEFAULT_DATA.transactions.map(t => ({
                    id: t.id,
                    member_id: t.memberId,
                    type: t.type,
                    amount: t.amount,
                    date: t.date,
                    note: t.note
                }))
            );
            if (tErr) throw tErr;
        }

        // Upload bets
        if (DEFAULT_DATA.bets.length > 0) {
            const { error: bErr } = await supabaseClient.from('bets').insert(
                DEFAULT_DATA.bets.map(b => ({
                    id: b.id,
                    match_name: b.matchName,
                    bet_type: b.betType,
                    odds: b.odds,
                    amount: b.amount,
                    bettors: b.bettors,
                    status: b.status,
                    won_amount: b.wonAmount,
                    date: b.date,
                    note: b.note
                }))
            );
            if (bErr) throw bErr;
        }

        // Refresh appData in memory
        appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
        console.log("Supabase initialization complete.");
    } catch (e) {
        console.error("Failed to seed default database values: ", e);
        showCloudWarning(e);
        showToast("雲端寫入失敗！已加載記憶體暫存。請確認 Supabase RLS Policy 寫入權限已開放！", "error");
        
        // Solid Fallback: Load DEFAULT_DATA in memory so the UI is never blank
        appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
}

// ----------------------------------------------------
// DATABASE WRITE OPERATIONS (Cloud + Local Wrapper)
// ----------------------------------------------------

async function dbAddMember(member) {
    if (supabaseClient) {
        const { error } = await supabaseClient.from('members').insert([{
            id: member.id,
            name: member.name,
            balance: member.balance,
            total_deposit: member.totalDeposit,
            total_withdraw: member.totalWithdraw
        }]);
        if (error) {
            showCloudWarning(error);
            throw error;
        }
    }
    
    appData.members.push(member);
    saveLocalData();
}

async function dbDeleteMember(memberId) {
    if (supabaseClient) {
        const { error } = await supabaseClient.from('members').delete().eq('id', memberId);
        if (error) {
            showCloudWarning(error);
            throw error;
        }
    }
    
    appData.members = appData.members.filter(m => m.id !== memberId);
    saveLocalData();
}

async function dbUpdateMemberBalance(memberId, balance, totalDeposit, totalWithdraw) {
    if (supabaseClient) {
        const { error } = await supabaseClient.from('members').update({
            balance: balance,
            total_deposit: totalDeposit,
            total_withdraw: totalWithdraw
        }).eq('id', memberId);
        if (error) {
            showCloudWarning(error);
            throw error;
        }
    }
    
    const member = appData.members.find(m => m.id === memberId);
    if (member) {
        member.balance = balance;
        member.totalDeposit = totalDeposit;
        member.totalWithdraw = totalWithdraw;
    }
    saveLocalData();
}

async function dbAddTransaction(trans) {
    if (supabaseClient) {
        const { error } = await supabaseClient.from('transactions').insert([{
            id: trans.id,
            member_id: trans.memberId,
            type: trans.type,
            amount: trans.amount,
            date: trans.date,
            note: trans.note
        }]);
        if (error) {
            showCloudWarning(error);
            throw error;
        }
    }
    
    appData.transactions.push(trans);
    saveLocalData();
}

async function dbAddBet(bet) {
    if (supabaseClient) {
        const { error } = await supabaseClient.from('bets').insert([{
            id: bet.id,
            match_name: bet.matchName,
            bet_type: bet.betType,
            odds: bet.odds,
            amount: bet.amount,
            bettors: bet.bettors,
            status: bet.status,
            won_amount: bet.wonAmount,
            date: bet.date,
            note: bet.note
        }]);
        if (error) {
            showCloudWarning(error);
            throw error;
        }
    }
    
    appData.bets.push(bet);
    saveLocalData();
}

async function dbSettleBet(betId, status, wonAmount) {
    if (supabaseClient) {
        const { error } = await supabaseClient.from('bets').update({
            status: status,
            won_amount: wonAmount
        }).eq('id', betId);
        if (error) {
            showCloudWarning(error);
            throw error;
        }
    }
    
    const bet = appData.bets.find(b => b.id === betId);
    if (bet) {
        bet.status = status;
        bet.wonAmount = wonAmount;
    }
    saveLocalData();
}

async function dbDeleteBet(betId) {
    if (supabaseClient) {
        const { error } = await supabaseClient.from('bets').delete().eq('id', betId);
        if (error) {
            showCloudWarning(error);
            throw error;
        }
    }
    
    appData.bets = appData.bets.filter(b => b.id !== betId);
    saveLocalData();
}

// ----------------------------------------------------
// UI ROUTING (Robust Implementation)
// ----------------------------------------------------

function setupRouting() {
    const handleRoute = () => {
        try {
            const hash = window.location.hash || '#dashboard';
            const tabName = hash.replace('#', '');
            
            // 1. Update active class on left nav buttons
            document.querySelectorAll('.nav-item').forEach(item => {
                if (item.getAttribute('data-tab') === tabName) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });

            const pageTitle = document.getElementById('page-title');
            const pageSubtitle = document.getElementById('page-subtitle');

            switch(tabName) {
                case 'dashboard':
                    if (pageTitle) pageTitle.textContent = '控制台儀表板';
                    if (pageSubtitle) pageSubtitle.textContent = '即時監控代購運彩資金、投注狀態與損益分析';
                    break;
                case 'members':
                    if (pageTitle) pageTitle.textContent = '成員與錢包';
                    if (pageSubtitle) pageSubtitle.textContent = '管理你的好夥伴，進行入金與出金記帳';
                    break;
                case 'bets':
                    if (pageTitle) pageTitle.textContent = '登記運彩注單';
                    if (pageSubtitle) pageSubtitle.textContent = '輸入賽事與下注本金，可選擇多人分攤或均分';
                    break;
                case 'history':
                    if (pageTitle) pageTitle.textContent = '所有歷史注單';
                    if (pageSubtitle) pageSubtitle.textContent = '查看與篩選所有注單，並為尚未開獎的運彩進行開獎結算';
                    break;
                case 'summary':
                    if (pageTitle) pageTitle.textContent = '對帳與結算';
                    if (pageSubtitle) pageSubtitle.textContent = '小白與朋友們的清帳對帳單，一鍵搞定繁雜款項';
                    break;
            }

            // 2. Toggle Tab Content display (Crucial - showing/hiding sections)
            document.querySelectorAll('.tab-content').forEach(section => {
                if (section.id === `tab-${tabName}`) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });

            // 3. Trigger context-specific rendering safely
            if (tabName === 'dashboard') {
                setTimeout(initProfitChart, 50); 
            } else if (tabName === 'bets') {
                renderBettorAllocationForm();
            }
        } catch (e) {
            console.error("Routing error occurred, swallowed to keep page interactive:", e);
        }
    };

    window.addEventListener('hashchange', handleRoute);
    handleRoute();
}

// Re-render everything
function renderAll() {
    renderStats();
    renderPendingBets();
    renderMembers();
    renderHistoryBets();
    renderSettlement();
    renderFinancialSummary();
    renderBettorAllocationForm();
    initProfitChart();
}

// Show Toast message
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    let icon = '<i class="fa-solid fa-circle-check text-green"></i>';
    if (type === 'error') {
        icon = '<i class="fa-solid fa-triangle-exclamation text-red"></i>';
        toast.style.borderColor = 'var(--color-red)';
    } else {
        toast.style.borderColor = 'var(--color-green)';
    }
    toast.innerHTML = `${icon} <span>${message}</span>`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Helper: Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD',
        maximumFractionDigits: 0
    }).format(amount).replace('TWD', '');
}

// ----------------------------------------------------
// TAB 1: DASHBOARD RENDERING
// ----------------------------------------------------

function renderStats() {
    const totalCash = appData.members.reduce((sum, m) => sum + m.balance, 0);
    const totalCashEl = document.getElementById('stat-total-cash');
    if (totalCashEl) totalCashEl.textContent = formatCurrency(totalCash);
    
    const pendingBet = appData.bets
        .filter(b => b.status === 'pending')
        .reduce((sum, b) => sum + b.amount, 0);
    const pendingBetEl = document.getElementById('stat-pending-bet');
    if (pendingBetEl) pendingBetEl.textContent = formatCurrency(pendingBet);

    const betCountEl = document.getElementById('stat-bet-count');
    if (betCountEl) betCountEl.textContent = `${appData.bets.length} 次`;

    const totalProfit = appData.members.reduce((sum, m) => {
        const net = m.balance + m.totalWithdraw - m.totalDeposit;
        return sum + net;
    }, 0);
    
    const profitEl = document.getElementById('stat-total-profit');
    const profitCard = document.getElementById('stat-profit-card');
    const profitIcon = document.getElementById('stat-profit-icon');
    const profitDesc = document.getElementById('stat-profit-desc');

    if (profitEl) {
        profitEl.textContent = (totalProfit >= 0 ? '+' : '') + formatCurrency(totalProfit);
        if (totalProfit >= 0) {
            profitEl.className = 'stat-value profit-positive';
            if (profitCard) profitCard.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            if (profitIcon) {
                profitIcon.innerHTML = '<i class="fa-solid fa-circle-trending-up"></i>';
                profitIcon.className = 'stat-icon text-green';
            }
            if (profitDesc) profitDesc.textContent = '所有人累計贏回大於投入！';
        } else {
            profitEl.className = 'stat-value profit-negative';
            if (profitCard) profitCard.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            if (profitIcon) {
                profitIcon.innerHTML = '<i class="fa-solid fa-circle-trending-down"></i>';
                profitIcon.className = 'stat-icon text-red';
            }
            if (profitDesc) profitDesc.textContent = '目前累計投注處於虧損狀態';
        }
    }

    renderLeaderboard();
}

function renderLeaderboard() {
    const leaderboardContainer = document.getElementById('dashboard-leaderboard');
    if (!leaderboardContainer) return;

    const memberStats = appData.members.map(m => {
        const netProfit = m.balance + m.totalWithdraw - m.totalDeposit;
        const totalBets = appData.bets.filter(b => b.bettors.some(bt => bt.memberId === m.id)).length;
        return {
            name: m.name,
            profit: netProfit,
            totalBets: totalBets
        };
    });

    memberStats.sort((a, b) => b.profit - a.profit);

    if (memberStats.length === 0) {
        leaderboardContainer.innerHTML = '<div class="text-secondary text-center py-4">無成員資料</div>';
        return;
    }

    leaderboardContainer.innerHTML = memberStats.map((m, index) => {
        const profitClass = m.profit >= 0 ? 'profit-positive' : 'profit-negative';
        const sign = m.profit >= 0 ? '+' : '';
        return `
            <div class="leader-item">
                <div class="leader-rank-name">
                    <span class="leader-rank">${index + 1}</span>
                    <div>
                        <span class="font-bold">${m.name}</span>
                        <div style="font-size: 10px; color: var(--text-secondary)">下注 ${m.totalBets} 次</div>
                    </div>
                </div>
                <div class="leader-val ${profitClass}">
                    ${sign}${formatCurrency(m.profit)}
                </div>
            </div>
        `;
    }).join('');
}

function renderPendingBets() {
    const tbody = document.getElementById('dashboard-pending-bets');
    if (!tbody) return;

    const pendingBets = appData.bets.filter(b => b.status === 'pending');

    if (pendingBets.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-secondary py-4" style="opacity: 0.6;">
                    目前無進行中注單
                </td>
            </tr>
        `;
        return;
    }

    pendingBets.sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = pendingBets.map(b => {
        const bettorNames = b.bettors.map(bt => {
            const m = appData.members.find(member => member.id === bt.memberId);
            return m ? `${m.name}($${bt.amount})` : `未知($${bt.amount})`;
        }).join(', ');

        return `
            <tr>
                <td>${b.date}</td>
                <td><strong class="text-gold">${b.matchName}</strong></td>
                <td><span class="badge badge-pending">${b.betType}</span></td>
                <td>${b.odds}</td>
                <td><strong>$${b.amount}</strong></td>
                <td class="text-secondary" style="font-size: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${bettorNames}">
                    ${bettorNames}
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="openSettleBetModal('${b.id}')">
                        <i class="fa-solid fa-gavel"></i> 開獎
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function initProfitChart() {
    const ctx = document.getElementById('chartProfitability');
    if (!ctx) return;

    if (profitChart) {
        profitChart.destroy();
    }

    const labels = appData.members.map(m => m.name);
    const balances = appData.members.map(m => m.balance);
    const netProfits = appData.members.map(m => m.balance + m.totalWithdraw - m.totalDeposit);

    const isDark = document.body.classList.contains('dark-theme');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.05)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const balanceColors = labels.map(() => isDark ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.6)');
    const profitColors = netProfits.map(p => p >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)');

    profitChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '可用餘額 ($)',
                    data: balances,
                    backgroundColor: balanceColors,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 3
                },
                {
                    label: '累計損益 ($)',
                    data: netProfits,
                    backgroundColor: profitColors,
                    borderColor: netProfits.map(p => p >= 0 ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)'),
                    borderWidth: 1,
                    borderRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor,
                        font: { family: 'Noto Sans TC', weight: '600' }
                    }
                },
                tooltip: {
                    titleFont: { family: 'Noto Sans TC' },
                    bodyFont: { family: 'Noto Sans TC' }
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Noto Sans TC' } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Noto Sans TC' } }
                }
            }
        }
    });
}

// ----------------------------------------------------
// TAB 2: MEMBERS RENDERING
// ----------------------------------------------------

function renderMembers() {
    const container = document.getElementById('member-cards-container');
    if (!container) return;

    if (appData.members.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-secondary py-5">目前沒有成員，請點選上方「新增成員」</div>';
        return;
    }

    container.innerHTML = appData.members.map(m => {
        const netProfit = m.balance + m.totalWithdraw - m.totalDeposit;
        const profitClass = netProfit >= 0 ? 'profit-positive' : 'profit-negative';
        const sign = netProfit >= 0 ? '+' : '';
        const betCount = appData.bets.filter(b => b.bettors.some(bt => bt.memberId === m.id)).length;

        const totalFlow = m.totalDeposit + m.totalWithdraw;
        const depPct = totalFlow > 0 ? (m.totalDeposit / totalFlow) * 100 : 0;
        const witPct = totalFlow > 0 ? (m.totalWithdraw / totalFlow) * 100 : 0;

        const visualBar = totalFlow > 0 ? `
            <div class="member-visual-bar" title="藍色: 累計入金 | 紅色: 累計出金">
                <div class="visual-bar-deposit" style="width: ${depPct}%;"></div>
                <div class="visual-bar-withdraw" style="width: ${witPct}%;"></div>
            </div>
        ` : `<div class="member-visual-bar" style="background: var(--border-color);" title="尚無交易資料"></div>`;

        const hasHistory = betCount > 0 || appData.transactions.some(t => t.memberId === m.id);
        const deleteButton = hasHistory ? '' : `
            <button class="btn btn-icon" style="position: absolute; top: 18px; right: 18px; width: 24px; height: 24px;" onclick="deleteMember('${m.id}')" title="刪除成員">
                <i class="fa-solid fa-xmark" style="font-size: 12px;"></i>
            </button>
        `;

        return `
            <div class="member-card">
                ${deleteButton}
                <div class="member-card-header">
                    <div>
                        <span class="member-name">${m.name}</span>
                        ${m.id === 'm1' ? '<span class="member-badge" style="margin-left: 8px;">掌櫃</span>' : ''}
                    </div>
                </div>
                
                <div class="member-finance">
                    <div class="finance-row">
                        <span>累計入金</span>
                        <span class="text-blue">$${m.totalDeposit}</span>
                    </div>
                    <div class="finance-row">
                        <span>累計出金</span>
                        <span class="text-red">$${m.totalWithdraw}</span>
                    </div>
                    <div class="finance-row">
                        <span>參團次數</span>
                        <span>${betCount} 次</span>
                    </div>
                    <div class="finance-row">
                        <span>累計損益</span>
                        <span class="${profitClass}">${sign}$${netProfit}</span>
                    </div>
                    <div class="finance-row">
                        <span>餘額</span>
                        <span style="font-weight: 800; font-size: 20px;" class="${m.balance >= 0 ? 'text-green' : 'text-red'}">
                            $${m.balance}
                        </span>
                    </div>
                    ${visualBar}
                </div>

                <div class="member-actions">
                    <button class="btn btn-sm btn-primary-outline" onclick="openTransactionModal('${m.id}', 'deposit')">
                        入金
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="openTransactionModal('${m.id}', 'withdraw')">
                        出金
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function deleteMember(id) {
    const member = appData.members.find(m => m.id === id);
    if (!member) return;

    if (confirm(`確定要刪除成員 ${member.name} 嗎？`)) {
        try {
            await dbDeleteMember(id);
            renderAll();
            showToast(`已成功刪除成員 ${member.name}`);
        } catch (e) {
            showToast("刪除成員失敗：" + e.message, "error");
        }
    }
}

// ----------------------------------------------------
// TAB 3: BET ALLOCATION FORM RENDERING (Interactive checked logic)
// ----------------------------------------------------

function renderBettorAllocationForm() {
    const container = document.getElementById('bettor-allocation-list');
    if (!container) return;

    if (appData.members.length === 0) {
        container.innerHTML = '<div class="text-secondary">請先前往「成員與錢包」頁面新增成員。</div>';
        return;
    }

    const allocType = document.querySelector('input[name="allocation-type"]:checked').value;

    // Dynamically adjust bet-amount input behavior based on allocation type
    const betAmountInput = document.getElementById('bet-amount');
    if (betAmountInput) {
        if (allocType === 'custom') {
            betAmountInput.setAttribute('placeholder', '自動由下方金額累加');
            betAmountInput.removeAttribute('required');
            betAmountInput.removeAttribute('readonly');
            betAmountInput.style.background = '';
        } else if (allocType === 'each-100') {
            betAmountInput.setAttribute('placeholder', '每人 100 元自動加總');
            betAmountInput.setAttribute('readonly', 'true');
            betAmountInput.style.background = 'var(--bg-hover)';
        } else {
            betAmountInput.setAttribute('placeholder', '例如：500');
            betAmountInput.setAttribute('required', 'true');
            betAmountInput.removeAttribute('readonly');
            betAmountInput.style.background = '';
        }
    }

    container.innerHTML = appData.members.map(m => {
        const isReadOnly = (allocType === 'equal' || allocType === 'each-100');
        return `
            <div class="bettor-alloc-item" data-member-id="${m.id}" id="bettor-item-row-${m.id}">
                <div class="bettor-alloc-name">
                    <input type="checkbox" id="chk-bettor-${m.id}" class="chk-bettor" value="${m.id}" checked onchange="calculateAllocation()">
                    <label for="chk-bettor-${m.id}" style="margin-bottom: 0; cursor: pointer;">${m.name}</label>
                    <span style="font-size: 11px; color: var(--text-secondary)"> (餘額: $${m.balance})</span>
                </div>
                <div class="bettor-alloc-inputs">
                    <input type="number" id="input-val-${m.id}" class="alloc-input-field" 
                           min="0" step="any"
                           oninput="onAllocationFieldInput('${m.id}')"
                           ${isReadOnly ? 'readonly disabled style="opacity: 0.5"' : ''}>
                    <span class="alloc-unit" id="alloc-unit-${m.id}">${allocType === 'ratio' ? '%' : '元'}</span>
                </div>
            </div>
        `;
    }).join('');

    calculateAllocation();
}

function onAllocationFieldInput(memberId) {
    const chk = document.getElementById(`chk-bettor-${memberId}`);
    const input = document.getElementById(`input-val-${memberId}`);
    
    if (input && parseFloat(input.value) > 0) {
        if (chk) chk.checked = true;
    }
    calculateAllocation(false);
}

function calculateAllocation(shouldResetFields = true) {
    const totalAmount = parseFloat(document.getElementById('bet-amount').value) || 0;
    const allocType = document.querySelector('input[name="allocation-type"]:checked').value;
    const checkedBettors = Array.from(document.querySelectorAll('.chk-bettor:checked')).map(el => el.value);
    const warning = document.getElementById('allocation-warning');
    
    // Dynamic Opacity and Disabled status depending on Checked state (Punctuation rule implementation)
    appData.members.forEach(m => {
        const row = document.getElementById(`bettor-item-row-${m.id}`);
        const chk = document.getElementById(`chk-bettor-${m.id}`);
        const input = document.getElementById(`input-val-${m.id}`);
        
        if (row && chk && input) {
            if (chk.checked) {
                row.style.opacity = '1';
                row.style.borderLeft = '3px solid var(--text-primary)';
                row.style.paddingLeft = '8px';
                if (allocType !== 'equal' && allocType !== 'each-100') {
                    input.removeAttribute('disabled');
                    input.style.opacity = '1';
                }
            } else {
                row.style.opacity = '0.35';
                row.style.borderLeft = '3px solid transparent';
                row.style.paddingLeft = '0';
                input.setAttribute('disabled', 'true');
                input.style.opacity = '0.35';
                input.value = ''; // Clean disabled fields to prevent miscalculations
            }
        }
    });

    if (checkedBettors.length === 0) {
        if (warning) {
            warning.classList.remove('hidden');
            warning.textContent = '⚠️ 請至少選擇一位出資的下注人！';
        }
        return;
    }

    if (allocType === 'equal') {
        if (warning) warning.classList.add('hidden');
        const count = checkedBettors.length;
        const equalAmount = Math.floor(totalAmount / count);
        let remainder = totalAmount % count;

        appData.members.forEach(m => {
            const input = document.getElementById(`input-val-${m.id}`);
            const chk = document.getElementById(`chk-bettor-${m.id}`);
            if (chk && chk.checked) {
                const extra = remainder > 0 ? 1 : 0;
                if (extra > 0) remainder--;
                if (input) input.value = equalAmount + extra;
            }
        });
    } else if (allocType === 'each-100') {
        if (warning) warning.classList.add('hidden');
        const count = checkedBettors.length;
        const calculatedTotal = count * 100;

        // Auto backfill calculated total amount to top input
        const betAmountInput = document.getElementById('bet-amount');
        if (betAmountInput) {
            betAmountInput.value = calculatedTotal > 0 ? calculatedTotal : '';
        }

        appData.members.forEach(m => {
            const input = document.getElementById(`input-val-${m.id}`);
            const chk = document.getElementById(`chk-bettor-${m.id}`);
            if (chk && chk.checked) {
                if (input) input.value = 100;
            }
        });
    } else if (allocType === 'ratio') {
        if (shouldResetFields) {
            const equalRatio = (100 / checkedBettors.length).toFixed(1);
            appData.members.forEach(m => {
                const input = document.getElementById(`input-val-${m.id}`);
                const chk = document.getElementById(`chk-bettor-${m.id}`);
                if (chk && chk.checked) {
                    if (input) input.value = equalRatio;
                }
            });
        }

        let sumRatio = 0;
        appData.members.forEach(m => {
            const chk = document.getElementById(`chk-bettor-${m.id}`);
            const input = document.getElementById(`input-val-${m.id}`);
            if (chk && chk.checked) {
                sumRatio += parseFloat(input.value) || 0;
            }
        });

        sumRatio = Math.round(sumRatio * 100) / 100;

        if (sumRatio !== 100) {
            if (warning) {
                warning.classList.remove('hidden');
                warning.innerHTML = `⚠️ 目前分配比例總和為 <b>${sumRatio}%</b>，必須剛好等於 <b>100%</b>！`;
            }
        } else {
            if (warning) warning.classList.add('hidden');
        }
    } else if (allocType === 'custom') {
        // Initialize fields only if we just switched to custom and have a positive amount
        if (shouldResetFields && totalAmount > 0) {
            const count = checkedBettors.length;
            const equalAmount = Math.floor(totalAmount / count);
            let remainder = totalAmount % count;
            
            appData.members.forEach(m => {
                const input = document.getElementById(`input-val-${m.id}`);
                const chk = document.getElementById(`chk-bettor-${m.id}`);
                if (chk && chk.checked) {
                    const extra = remainder > 0 ? 1 : 0;
                    if (extra > 0) remainder--;
                    if (input) input.value = equalAmount + extra;
                }
            });
        }

        // Sum up the custom amounts inputted by the user
        let sumAmount = 0;
        appData.members.forEach(m => {
            const chk = document.getElementById(`chk-bettor-${m.id}`);
            const input = document.getElementById(`input-val-${m.id}`);
            if (chk && chk.checked) {
                sumAmount += parseFloat(input.value) || 0;
            }
        });

        // Automatically sync the sum back to the top "Bet Amount" field in real-time
        const betAmountInput = document.getElementById('bet-amount');
        if (betAmountInput && (!shouldResetFields || betAmountInput.value === '')) {
            betAmountInput.value = sumAmount > 0 ? sumAmount : '';
        }

        if (warning) warning.classList.add('hidden'); // Warning is obsolete since sum is auto-synced
    }
}

// ----------------------------------------------------
// TAB 4: BET HISTORY & SETTLE RENDERING
// ----------------------------------------------------

let currentHistoryFilter = 'all';

function renderHistoryBets() {
    const tbody = document.getElementById('history-bets-list');
    if (!tbody) return;

    let filteredBets = [...appData.bets];
    if (currentHistoryFilter !== 'all') {
        filteredBets = filteredBets.filter(b => b.status === currentHistoryFilter);
    }

    filteredBets.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredBets.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-secondary py-5" style="opacity: 0.6;">
                    目前無歷史注單
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredBets.map(b => {
        let statusBadge = '';
        let rowActions = '';

        if (b.status === 'pending') {
            statusBadge = '<span class="badge badge-pending">待開獎</span>';
            rowActions = `
                <button class="btn btn-sm btn-primary" onclick="openSettleBetModal('${b.id}')" title="開獎結算">
                    開獎
                </button>
                <button class="btn btn-sm btn-icon" onclick="deleteBet('${b.id}')" title="刪除注單">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
        } else if (b.status === 'won') {
            statusBadge = '<span class="badge badge-won">中獎</span>';
            rowActions = `
                <span class="text-green font-bold">+$${b.wonAmount - b.amount}</span>
                <button class="btn btn-sm btn-icon" onclick="deleteBet('${b.id}')" title="作廢並刪除">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
        } else if (b.status === 'lost') {
            statusBadge = '<span class="badge badge-lost">未中獎</span>';
            rowActions = `
                <span class="text-red font-bold">-$${b.amount}</span>
                <button class="btn btn-sm btn-icon" onclick="deleteBet('${b.id}')" title="作廢並刪除">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
        }

        const bettorDetails = b.bettors.map(bt => {
            const m = appData.members.find(member => member.id === bt.memberId);
            const name = m ? m.name : '未知';
            return `${name}($${bt.amount})`;
        }).join(', ');

        const formattedBettors = `<div style="font-size: 12px; color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${bettorDetails}">${bettorDetails}</div>`;

        return `
            <tr>
                <td>${b.date}</td>
                <td>
                    <div><strong>${b.matchName}</strong></div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">玩法：${b.betType}</div>
                </td>
                <td>${b.odds}</td>
                <td>
                    <div>本金: <b>$${b.amount}</b></div>
                    <div style="font-size: 11px; color: var(--text-secondary)">
                        ${b.status === 'pending' ? `預估: $${Math.floor(b.amount * b.odds)}` : `得彩金: $${b.wonAmount}`}
                    </div>
                </td>
                <td>${formattedBettors}</td>
                <td>${statusBadge}</td>
                <td style="font-size: 12px; color: var(--text-secondary); max-width: 120px; overflow: hidden; text-overflow: ellipsis;">${b.note || '-'}</td>
                <td>
                    <div class="flex items-center gap-2">
                        ${rowActions}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Delete bet (reverts any balance deductions and payouts)
async function deleteBet(id) {
    const bet = appData.bets.find(b => b.id === id);
    if (!bet) return;

    let confirmMsg = `確定要刪除這筆下注「${bet.matchName}」嗎？`;
    if (bet.status !== 'pending') {
        confirmMsg += `\n⚠️ 此注單已開獎結算，刪除會自動扣回/退回所有成員對應的彩金與本金，恢復帳目！`;
    } else {
        confirmMsg += `\n此操作將退回所有下注人的投注本金。`;
    }

    if (confirm(confirmMsg)) {
        try {
            const updatePromises = [];

            if (bet.status === 'pending') {
                bet.bettors.forEach(bt => {
                    const member = appData.members.find(m => m.id === bt.memberId);
                    if (member) {
                        const newBalance = member.balance + bt.amount;
                        updatePromises.push(dbUpdateMemberBalance(member.id, newBalance, member.totalDeposit, member.totalWithdraw));
                    }
                });
            } else if (bet.status === 'won') {
                bet.bettors.forEach(bt => {
                    const member = appData.members.find(m => m.id === bt.memberId);
                    if (member) {
                        const ratio = bt.amount / bet.amount;
                        const wonShare = Math.floor(bet.wonAmount * ratio);
                        const newBalance = member.balance + bt.amount - wonShare;
                        updatePromises.push(dbUpdateMemberBalance(member.id, newBalance, member.totalDeposit, member.totalWithdraw));
                    }
                });
            } else if (bet.status === 'lost') {
                bet.bettors.forEach(bt => {
                    const member = appData.members.find(m => m.id === bt.memberId);
                    if (member) {
                        const newBalance = member.balance + bt.amount;
                        updatePromises.push(dbUpdateMemberBalance(member.id, newBalance, member.totalDeposit, member.totalWithdraw));
                    }
                });
            }

            await Promise.all(updatePromises);
            await dbDeleteBet(id);

            renderAll();
            showToast('已刪除注單並回滾帳戶餘額！');
        } catch (e) {
            showToast("作廢注單失敗：" + e.message, "error");
        }
    }
}

// ----------------------------------------------------
// TAB 5: SUMMARY & SETTLEMENT (Visual Flow Diagram)
// ----------------------------------------------------

function renderSettlement() {
    const container = document.getElementById('settlement-results-container');
    if (!container) return;

    const debtors = []; 
    const creditors = []; 

    appData.members.forEach(m => {
        if (m.id === 'm1') return; 
        
        if (m.balance > 0) {
            creditors.push({ name: m.name, amount: m.balance });
        } else if (m.balance < 0) {
            debtors.push({ name: m.name, amount: Math.abs(m.balance) });
        }
    });

    if (creditors.length === 0 && debtors.length === 0) {
        container.innerHTML = `
            <div class="no-settlement" style="padding: 32px 0;">
                <i class="fa-solid fa-square-check" style="font-size: 32px; color: var(--color-green); margin-bottom: 12px;"></i>
                <p style="font-size: 14px; color: var(--text-secondary)">目前帳目皆已結清，無待處理的資金轉移</p>
            </div>
        `;
        return;
    }

    let html = '';

    debtors.forEach(d => {
        html += `
            <div class="settlement-flow-card">
                <div class="diagram-node">
                    <span class="diagram-node-name text-red">${d.name}</span>
                    <span class="diagram-node-label">匯款人</span>
                </div>
                <div class="diagram-connector">
                    <span class="connector-val text-red">$${d.amount}</span>
                    <div class="connector-line"></div>
                </div>
                <div class="diagram-node">
                    <span class="diagram-node-name">小白</span>
                    <span class="diagram-node-label">收款人</span>
                </div>
            </div>
        `;
    });

    creditors.forEach(c => {
        html += `
            <div class="settlement-flow-card">
                <div class="diagram-node">
                    <span class="diagram-node-name">小白</span>
                    <span class="diagram-node-label">匯款人</span>
                </div>
                <div class="diagram-connector">
                    <span class="connector-val text-green">$${c.amount}</span>
                    <div class="connector-line"></div>
                </div>
                <div class="diagram-node">
                    <span class="diagram-node-name text-green">${c.name}</span>
                    <span class="diagram-node-label">收款人</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderFinancialSummary() {
    const container = document.getElementById('financial-summary-list');
    if (!container) return;

    if (appData.members.length === 0) {
        container.innerHTML = '<div class="text-secondary text-center">無財務資料</div>';
        return;
    }

    container.innerHTML = appData.members.map(m => {
        const netProfit = m.balance + m.totalWithdraw - m.totalDeposit;
        const profitText = netProfit >= 0 ? `+${netProfit}` : `${netProfit}`;
        const profitClass = netProfit >= 0 ? 'text-green' : 'text-red';
        const balClass = m.balance >= 0 ? 'text-green' : 'text-red';

        return `
            <div class="fin-item">
                <div>
                    <span class="fin-name-tag">${m.name}</span>
                    <div class="fin-sub">累計入金: $${m.totalDeposit} | 出金: $${m.totalWithdraw}</div>
                </div>
                <div class="fin-details">
                    <div class="fin-bal ${balClass}">餘額: $${m.balance}</div>
                    <div class="fin-sub">累計損益: <b class="${profitClass}">${profitText}</b></div>
                </div>
            </div>
        `;
    }).join('');
}

// TRANSACTION MODAL (DEPOSIT / WITHDRAW)
function openTransactionModal(memberId, defaultType = 'deposit') {
    const member = appData.members.find(m => m.id === memberId);
    if (!member) return;

    document.getElementById('trans-member-id').value = memberId;
    document.getElementById('trans-member-name').value = member.name;
    document.getElementById('trans-amount').value = '';
    document.getElementById('trans-note').value = '';

    const radio = document.querySelector(`.transaction-type-selector input[value="${defaultType}"]`);
    if (radio) radio.checked = true;

    const title = document.getElementById('transaction-modal-title');
    if (title) title.textContent = `${member.name} - 進行儲值與提領登記`;

    document.getElementById('modalTransaction').style.display = 'block';
}

// SETTLE BET MODAL
function openSettleBetModal(betId) {
    const bet = appData.bets.find(b => b.id === betId);
    if (!bet) return;

    document.getElementById('settle-bet-id').value = betId;
    
    const detailsContainer = document.getElementById('settle-bet-details');
    const bettorList = bet.bettors.map(bt => {
        const m = appData.members.find(member => member.id === bt.memberId);
        return m ? `${m.name} 出資 $${bt.amount}` : `未知 出資 $${bt.amount}`;
    }).join('<br>');

    if (detailsContainer) {
        detailsContainer.innerHTML = `
            🚀 <b>賽事名稱：</b> ${bet.matchName}<br>
            🎯 <b>投注玩法：</b> ${bet.betType}<br>
            📊 <b>賠率：</b> ${bet.odds} | <b>總本金：</b> $${bet.amount}<br>
            👥 <b>出資明細：</b><br>${bettorList}
        `;
    }

    const wonInput = document.getElementById('settle-won-amount');
    const autoWon = Math.floor(bet.amount * bet.odds);
    if (wonInput) wonInput.value = autoWon;

    const wonRadio = document.querySelector('input[name="settle-result"][value="won"]');
    const amountGroup = document.getElementById('settle-won-amount-group');
    
    document.querySelectorAll('input[name="settle-result"]').forEach(rad => {
        rad.addEventListener('change', (e) => {
            if (e.target.value === 'won') {
                if (amountGroup) amountGroup.classList.remove('hidden');
                if (wonInput) wonInput.value = autoWon;
            } else {
                if (amountGroup) amountGroup.classList.add('hidden');
                if (wonInput) wonInput.value = 0;
            }
        });
    });

    if (amountGroup) amountGroup.classList.remove('hidden');
    if (wonRadio) wonRadio.checked = true;

    document.getElementById('modalSettleBet').style.display = 'block';
}

// ----------------------------------------------------
// UI EVENT LISTENERS
// ----------------------------------------------------

function setupEventListeners() {
    const closeModal = () => {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    };

    document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });

    const themeToggle = document.getElementById('btnThemeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Bet Registration Form - Allocation Type Switcher
    const allocRadios = document.querySelectorAll('input[name="allocation-type"]');
    allocRadios.forEach(rad => {
        rad.addEventListener('change', () => {
            renderBettorAllocationForm();
        });
    });

    // Bet Registration Form - Bet Amount Input change
    const betAmountInput = document.getElementById('bet-amount');
    if (betAmountInput) {
        betAmountInput.addEventListener('input', () => {
            calculateAllocation(true);
        });
    }

    // Parlay dynamic legs addition
    const addParlayBtn = document.getElementById('btnAddParlayLeg');
    if (addParlayBtn) {
        addParlayBtn.addEventListener('click', () => {
            const container = document.getElementById('parlay-legs-container');
            if (container) {
                const legDiv = document.createElement('div');
                legDiv.className = 'parlay-leg form-row';
                legDiv.style = 'margin-bottom: 12px; display: flex; gap: 10px; align-items: center;';
                legDiv.innerHTML = `
                    <div style="flex: 2;">
                        <input type="text" class="leg-match-name" placeholder="賽事名稱，例如：巴西 vs 法國" required>
                    </div>
                    <div style="flex: 2;">
                        <input type="text" class="leg-bet-type" placeholder="玩法預測，例如：讓分主勝" required>
                    </div>
                    <div style="flex: 1;">
                        <input type="number" class="leg-odds" step="0.01" min="1.00" placeholder="賠率" required>
                    </div>
                    <button type="button" class="btn btn-icon btn-remove-leg" style="height: 42px; width: 42px; flex-shrink: 0; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--color-red); color: var(--color-red);" title="移除此關">
                        <i class="fa-solid fa-trash-can" style="font-size: 14px;"></i>
                    </button>
                `;
                container.appendChild(legDiv);
                updateParlayRemoveButtons();
            }
        });
    }

    // Parlay dynamic legs deletion & input monitoring (Event Delegation)
    const parlayContainer = document.getElementById('parlay-legs-container');
    if (parlayContainer) {
        // Handle deletion of legs
        parlayContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-remove-leg');
            if (btn) {
                const legRow = btn.closest('.parlay-leg');
                if (legRow) {
                    legRow.remove();
                    updateParlayRemoveButtons();
                    calculateParlayOdds(); // Recalculate odds after leg is deleted
                }
            }
        });

        // Handle typing odds to calculate parlay multiplication in real-time
        parlayContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('leg-odds')) {
                calculateParlayOdds();
            }
        });
    }

    const quickDep = document.getElementById('btnQuickDeposit');
    if (quickDep) {
        quickDep.addEventListener('click', () => {
            if (appData.members.length > 0) {
                openTransactionModal(appData.members[0].id, 'deposit');
            } else {
                showToast('請先新增成員！', 'error');
            }
        });
    }

    const quickBet = document.getElementById('btnQuickBet');
    if (quickBet) {
        quickBet.addEventListener('click', () => {
            window.location.hash = '#bets';
            const betTab = document.querySelector('[data-tab="bets"]');
            if (betTab) betTab.click();
        });
    }

    // Settings Modal Open
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            updateCloudStatusUI();
            document.getElementById('modalSettings').style.display = 'block';
        });
    }

    // Test cloud connection
    const testCloud = document.getElementById('btnTestCloud');
    if (testCloud) {
        testCloud.addEventListener('click', async () => {
            const url = document.getElementById('settings-supa-url').value.trim();
            const key = document.getElementById('settings-supa-key').value.trim();

            if (!url || !key) {
                showToast('請填寫 Supabase URL 與 Anon Key', 'error');
                return;
            }

            const btn = document.getElementById('btnTestCloud');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 連線測試中...';

            try {
                const tempClient = window.supabase.createClient(url, key);
                const { error } = await tempClient.from('members').select('id').limit(1);
                
                if (error) throw error;

                localStorage.setItem('supabase_url', url);
                localStorage.setItem('supabase_key', key);
                supabaseClient = tempClient;

                updateCloudStatusUI();
                showToast('連線測試成功！已啟動 Supabase 雲端同步模式。');
                
                await loadData();
                await sanitizeMemberNames(); // Sync clean names immediately to Supabase
                renderAll();
                closeModal();
            } catch (e) {
                console.error(e);
                showToast('連線失敗：' + e.message + '\n請確認資料庫中是否存在 tables，且已開啟所有人存取權限 (RLS Policy)。', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-plug"></i> 測試並連線';
            }
        });
    }

    // Clear cloud credentials
    const clearCloud = document.getElementById('btnClearCloud');
    if (clearCloud) {
        clearCloud.addEventListener('click', () => {
            if (confirm('確定要中斷與 Supabase 的連結，並恢復為本機 LocalStorage 模式嗎？')) {
                localStorage.removeItem('supabase_url');
                localStorage.removeItem('supabase_key');
                supabaseClient = null;
                
                updateCloudStatusUI();
                showToast('已清除雲端設定。正在重新讀取本地資料...');
                
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        });
    }

    // Generate Share Sync Link
    const shareCloud = document.getElementById('btnShareCloudLink');
    if (shareCloud) {
        shareCloud.addEventListener('click', () => {
            const url = localStorage.getItem('supabase_url');
            const key = localStorage.getItem('supabase_key');

            if (!url || !key) {
                showToast('請先完成 Supabase 連線設定，才能生成分享連結喔！', 'error');
                return;
            }

            const base = window.location.protocol + "//" + window.location.host + window.location.pathname;
            const shareLink = `${base}?supaUrl=${encodeURIComponent(url)}&supaKey=${encodeURIComponent(key)}`;

            navigator.clipboard.writeText(shareLink).then(() => {
                showToast('已複製同步分享連結！發給朋友點擊即可加入相同帳本。');
            }).catch(() => {
                alert('複製失敗，請手動複製網址：\n' + shareLink);
            });
        });
    }

    // Reset Cloud Database to fresh defaults
    const resetCloud = document.getElementById('btnResetCloudDb');
    if (resetCloud) {
        resetCloud.addEventListener('click', async () => {
            if (!supabaseClient) {
                showToast('目前非雲端同步模式，無須重設雲端。', 'error');
                return;
            }

            const confirmMsg = `⚠️ 警告！此操作將徹底重設雲端資料庫：\n\n` +
                `這會將 Supabase 上所有的投注、交易紀錄和成員全部清空！\n` +
                `並以全新的朋友名單 (政陽、小白、Pulu、熊學長，且金額皆為 0 元) 重新初始化。\n\n` +
                `確定要執行這項重設操作嗎？此操作無法還原！`;

            if (confirm(confirmMsg)) {
                const btn = document.getElementById('btnResetCloudDb');
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 重設中...';

                try {
                    // Delete everything from tables
                    await Promise.all([
                        supabaseClient.from('members').delete().neq('id', 'dummy_val'),
                        supabaseClient.from('transactions').delete().neq('id', 'dummy_val'),
                        supabaseClient.from('bets').delete().neq('id', 'dummy_val')
                    ]);

                    // Seed new clean DEFAULT_DATA
                    await initializeCloudWithDefaults();
                    
                    showToast('🎉 雲端資料庫已成功重設為乾淨的 0 元狀態！');
                    closeModal();
                    
                    await loadData();
                    renderAll();
                } catch (e) {
                    console.error(e);
                    showToast('重設雲端失敗：' + e.message, 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 重設雲端資料庫 (清空為 0)';
                }
            }
        });
    }

    // 1. Add Member Form Submission
    const addMemberForm = document.getElementById('add-member-form');
    if (addMemberForm) {
        addMemberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-member-name').value.trim();
            const initDeposit = parseFloat(document.getElementById('new-member-init-deposit').value) || 0;

            if (!name) return;

            if (appData.members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
                showToast('成員名字重複囉！', 'error');
                return;
            }

            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = '新增中...';

            try {
                const memberId = 'm_' + Math.random().toString(36).substr(2, 9);
                const newMember = {
                    id: memberId,
                    name: name,
                    balance: initDeposit,
                    totalDeposit: initDeposit,
                    totalWithdraw: 0
                };

                await dbAddMember(newMember);

                if (initDeposit > 0) {
                    const transId = 't_' + Math.random().toString(36).substr(2, 9);
                    await dbAddTransaction({
                        id: transId,
                        memberId: memberId,
                        type: 'deposit',
                        amount: initDeposit,
                        date: new Date().toISOString().split('T')[0],
                        note: '加入成員時初始入金'
                    });
                }

                renderAll();
                closeModal();
                showToast(`已成功新增成員 ${name}！`);
            } catch (err) {
                showToast("寫入失敗：" + err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = '確認新增';
            }
        });
    }

    // 2. Transaction Form Submission
    const transForm = document.getElementById('transaction-form');
    if (transForm) {
        transForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const memberId = document.getElementById('trans-member-id').value;
            const type = document.querySelector('input[name="trans-type"]:checked').value;
            const amount = parseFloat(document.getElementById('trans-amount').value);
            const note = document.getElementById('trans-note').value.trim();

            if (!memberId || isNaN(amount) || amount <= 0) return;

            const member = appData.members.find(m => m.id === memberId);
            if (!member) return;

            const btn = document.getElementById('btnSubmitTrans');
            if (btn) {
                btn.disabled = true;
                btn.textContent = '傳送中...';
            }

            try {
                let newBalance = member.balance;
                let newDeposit = member.totalDeposit;
                let newWithdraw = member.totalWithdraw;

                if (type === 'deposit') {
                    newBalance += amount;
                    newDeposit += amount;
                } else if (type === 'withdraw') {
                    newBalance -= amount;
                    newWithdraw += amount;
                }

                await dbUpdateMemberBalance(memberId, newBalance, newDeposit, newWithdraw);

                const transId = 't_' + Math.random().toString(36).substr(2, 9);
                await dbAddTransaction({
                    id: transId,
                    memberId: memberId,
                    type: type,
                    amount: amount,
                    date: new Date().toISOString().split('T')[0],
                    note: note || (type === 'deposit' ? '入金儲值' : '出金提領')
                });

                renderAll();
                closeModal();
                showToast(`${member.name} 的交易登記成功！`);
            } catch (err) {
                showToast("登記失敗：" + err.message, "error");
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '確認送出';
                }
            }
        });
    }

    // 3. Bet Registration Form Submission
    const betForm = document.getElementById('bet-form');
    if (betForm) {
        betForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Collect all parlay legs and join them with " x " for parlays
            const matchNameInputs = Array.from(document.querySelectorAll('.leg-match-name'));
            const betTypeInputs = Array.from(document.querySelectorAll('.leg-bet-type'));
            const oddsInputs = Array.from(document.querySelectorAll('.leg-odds'));
            
            const matchName = matchNameInputs.map(input => input.value.trim()).filter(val => val).join(' x ');
            const betType = betTypeInputs.map((input, idx) => {
                const oddVal = parseFloat(oddsInputs[idx] ? oddsInputs[idx].value : 0) || 0;
                return `${input.value.trim()}(${oddVal.toFixed(2)})`;
            }).join(' x ');
            
            const odds = parseFloat(document.getElementById('bet-odds').value);
            const date = document.getElementById('bet-date').value;
            const note = document.getElementById('bet-note').value.trim();
            
            const checkedBettors = Array.from(document.querySelectorAll('.chk-bettor:checked')).map(el => el.value);

            if (checkedBettors.length === 0) {
                alert('請至少選擇一位出資的下注人！');
                return;
            }

            const bettors = [];
            for (const memberId of checkedBettors) {
                const input = document.getElementById(`input-val-${memberId}`);
                let allocVal = parseFloat(input ? input.value : 0) || 0;
                bettors.push({ memberId, val: allocVal });
            }

            const allocType = document.querySelector('input[name="allocation-type"]:checked').value;
            let amount = parseFloat(document.getElementById('bet-amount').value);

            // Auto-calculate total amount for custom allocation if empty or zero
            if (allocType === 'custom' && (isNaN(amount) || amount === 0)) {
                amount = bettors.reduce((sum, b) => sum + b.val, 0);
                const betAmountEl = document.getElementById('bet-amount');
                if (betAmountEl) betAmountEl.value = amount;
            }

            // Auto-calculate total amount for each-100 if empty or zero
            if (allocType === 'each-100' && (isNaN(amount) || amount === 0)) {
                amount = checkedBettors.length * 100;
                const betAmountEl = document.getElementById('bet-amount');
                if (betAmountEl) betAmountEl.value = amount;
            }

            if (isNaN(amount) || amount <= 0) {
                alert('請輸入下注總本金，或在下方填寫參與成員的出資金額！');
                return;
            }

            const finalBettors = [];

            if (allocType === 'equal') {
                bettors.forEach(b => {
                    finalBettors.push({ memberId: b.memberId, amount: Math.floor(b.val) });
                });
            } else if (allocType === 'each-100') {
                bettors.forEach(b => {
                    finalBettors.push({ memberId: b.memberId, amount: 100 });
                });
            } else if (allocType === 'ratio') {
                let sumRatio = bettors.reduce((sum, b) => sum + b.val, 0);
                sumRatio = Math.round(sumRatio * 100) / 100;
                if (sumRatio !== 100) {
                    alert('比例總和必須剛好為 100%！');
                    return;
                }

                let distributed = 0;
                bettors.forEach((b, idx) => {
                    let share = 0;
                    if (idx === bettors.length - 1) {
                        share = amount - distributed; 
                    } else {
                        share = Math.floor(amount * (b.val / 100));
                        distributed += share;
                    }
                    finalBettors.push({ memberId: b.memberId, amount: share });
                });
            } else if (allocType === 'custom') {
                let sumAmount = bettors.reduce((sum, b) => sum + b.val, 0);
                if (sumAmount !== amount) {
                    alert(`金額總和 ($${sumAmount}) 必須剛好等於下注總本金 ($${amount})！`);
                    return;
                }
                bettors.forEach(b => {
                    finalBettors.push({ memberId: b.memberId, amount: Math.floor(b.val) });
                });
            }

            const btn = document.getElementById('btnSubmitBet');
            if (btn) {
                btn.disabled = true;
                btn.textContent = '登記中...';
            }

            try {
                const balancePromises = [];
                finalBettors.forEach(fb => {
                    const m = appData.members.find(member => member.id === fb.memberId);
                    if (m) {
                        const newBalance = m.balance - fb.amount;
                        balancePromises.push(dbUpdateMemberBalance(fb.memberId, newBalance, m.totalDeposit, m.totalWithdraw));
                    }
                });

                await Promise.all(balancePromises);

                const betId = 'b_' + Math.random().toString(36).substr(2, 9);
                await dbAddBet({
                    id: betId,
                    matchName,
                    betType,
                    odds,
                    amount,
                    bettors: finalBettors,
                    status: 'pending',
                    wonAmount: 0,
                    date,
                    note
                });

                renderAll();
                
                document.getElementById('bet-form').reset();
                const parlayContainer = document.getElementById('parlay-legs-container');
                if (parlayContainer) {
                    const legs = parlayContainer.querySelectorAll('.parlay-leg');
                    for (let i = 1; i < legs.length; i++) {
                        legs[i].remove();
                    }
                    updateParlayRemoveButtons();
                }
                setTodayDate();
                
                window.location.hash = '#history';
                const histTab = document.querySelector('[data-tab="history"]');
                if (histTab) histTab.click();
                
                showToast('運彩注單登記並自動扣款成功！');
            } catch (err) {
                showToast("登記注單失敗：" + err.message, "error");
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '確認登記並扣款';
                }
            }
        });
    }

    // 4. Settle Bet Form Submission
    const settleForm = document.getElementById('settle-bet-form');
    if (settleForm) {
        settleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const betId = document.getElementById('settle-bet-id').value;
            const result = document.querySelector('input[name="settle-result"]:checked').value;
            const wonAmount = parseFloat(document.getElementById('settle-won-amount').value) || 0;

            if (!betId) return;

            const bet = appData.bets.find(b => b.id === betId);
            if (!bet) return;

            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = '開獎中...';

            try {
                const balancePromises = [];
                const finalWonAmount = result === 'won' ? Math.floor(wonAmount) : 0;

                if (result === 'won') {
                    let distributed = 0;
                    bet.bettors.forEach((bt, idx) => {
                        const member = appData.members.find(m => m.id === bt.memberId);
                        if (member) {
                            let share = 0;
                            if (idx === bet.bettors.length - 1) {
                                share = finalWonAmount - distributed; 
                            } else {
                                const ratio = bt.amount / bet.amount;
                                share = Math.floor(finalWonAmount * ratio);
                                distributed += share;
                            }
                            const newBalance = member.balance + share;
                            balancePromises.push(dbUpdateMemberBalance(bt.memberId, newBalance, member.totalDeposit, member.totalWithdraw));
                        }
                    });
                }

                await Promise.all(balancePromises);
                await dbSettleBet(betId, result, finalWonAmount);

                renderAll();
                closeModal();
                showToast(`注單開獎結算成功！結果為：${result === 'won' ? '🏆 中獎' : '❌ 未中獎'}`);
            } catch (err) {
                showToast("開獎失敗：" + err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = '確認開獎';
            }
        });
    }

    // 5. Data Backup Export
    const exportData = document.getElementById('btnExportData');
    if (exportData) {
        exportData.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 4));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            const date = new Date().toISOString().split('T')[0];
            downloadAnchor.setAttribute("download", `football_bet_backup_${date}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            showToast('資料備份 JSON 下載完成！');
        });
    }

    // 6. Data Backup Import
    const importData = document.getElementById('btnImportData');
    if (importData) {
        importData.addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
    }

    const importFile = document.getElementById('importFile');
    if (importFile) {
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async function(evt) {
                try {
                    const imported = JSON.parse(evt.target.result);
                    
                    if (imported.members && Array.isArray(imported.members)) {
                        if (confirm('⚠️ 警告：匯入新資料將會完全覆蓋目前的記帳資料，且無法還原！\n確定要匯入嗎？')) {
                            if (supabaseClient) {
                                const btn = document.getElementById('btnImportData');
                                if (btn) btn.disabled = true;
                                showToast('正在清空雲端資料庫並重新寫入，請稍候...');

                                try {
                                    await Promise.all([
                                        supabaseClient.from('members').delete().neq('id', 'dummy_val'),
                                        supabaseClient.from('transactions').delete().neq('id', 'dummy_val'),
                                        supabaseClient.from('bets').delete().neq('id', 'dummy_val')
                                    ]);

                                    const mappedMembers = imported.members.map(m => ({
                                        id: m.id,
                                        name: m.name,
                                        balance: m.balance,
                                        total_deposit: m.totalDeposit !== undefined ? m.totalDeposit : (m.total_deposit || 0),
                                        total_withdraw: m.totalWithdraw !== undefined ? m.totalWithdraw : (m.total_withdraw || 0)
                                    }));
                                    const mappedTrans = (imported.transactions || []).map(t => ({
                                        id: t.id,
                                        member_id: t.memberId !== undefined ? t.memberId : (t.member_id || ''),
                                        type: t.type,
                                        amount: t.amount,
                                        date: t.date,
                                        note: t.note
                                    }));
                                    const mappedBets = (imported.bets || []).map(b => ({
                                        id: b.id,
                                        match_name: b.matchName !== undefined ? b.matchName : (b.match_name || ''),
                                        bet_type: b.betType !== undefined ? b.betType : (b.bet_type || ''),
                                        odds: b.odds,
                                        amount: b.amount,
                                        bettors: b.bettors,
                                        status: b.status,
                                        won_amount: b.wonAmount !== undefined ? b.wonAmount : (b.won_amount || 0),
                                        date: b.date,
                                        note: b.note
                                    }));

                                    if (mappedMembers.length > 0) await supabaseClient.from('members').insert(mappedMembers);
                                    if (mappedTrans.length > 0) await supabaseClient.from('transactions').insert(mappedTrans);
                                    if (mappedBets.length > 0) await supabaseClient.from('bets').insert(mappedBets);

                                    showToast('🎉 雲端資料庫匯入備份成功！');
                                } catch (se) {
                                    console.error(se);
                                    showToast('匯入雲端失敗：' + se.message, 'error');
                                } finally {
                                    if (btn) btn.disabled = false;
                                }
                            } else {
                                appData = imported;
                                saveLocalData();
                                showToast('🎉 本地資料庫匯入備份成功！');
                            }
                            
                            await loadData();
                            renderAll();
                        }
                    } else {
                        showToast('匯入失敗：JSON 格式無效（缺漏 members 陣列）。', 'error');
                    }
                } catch (err) {
                    showToast('匯入失敗：無法解析 JSON 檔案。', 'error');
                }
            };
            reader.readAsText(file);
        });
    }

    // Settle group balances (Summary Tab)
    const btnSettleAllEl = document.getElementById('btnSettleAll');
    if (btnSettleAllEl) {
        btnSettleAllEl.addEventListener('click', async () => {
            if (appData.members.length === 0) return;

            const confirmMsg = `⚠️ 警告！此操作將「模擬全部清帳」：\n\n` +
                `這會將所有人的帳戶餘額歸零（代表小白已將錢退還給餘額為正的朋友，並收到了餘額為負的朋友的欠款）。\n` +
                `這會自動在系統中建立對應的入金與出金交易紀錄，以便保存歷史痕跡。\n\n` +
                `確定要執行這項重設操作嗎？`;

            if (confirm(confirmMsg)) {
                try {
                    const today = new Date().toISOString().split('T')[0];
                    const promises = [];

                    for (const m of appData.members) {
                        if (m.balance === 0) continue;

                        const transId = 't_' + Math.random().toString(36).substr(2, 9);
                        
                        if (m.balance > 0) {
                            const amount = m.balance;
                            promises.push(dbAddTransaction({
                                id: transId,
                                memberId: m.id,
                                type: 'withdraw',
                                amount: amount,
                                date: today,
                                note: '期末清帳結清可用餘額'
                            }));
                            promises.push(dbUpdateMemberBalance(m.id, 0, m.totalDeposit, m.totalWithdraw + amount));
                        } else {
                            const deficit = Math.abs(m.balance);
                            promises.push(dbAddTransaction({
                                id: transId,
                                memberId: m.id,
                                type: 'deposit',
                                amount: deficit,
                                date: today,
                                note: '期末清帳補齊欠款'
                            }));
                            promises.push(dbUpdateMemberBalance(m.id, 0, m.totalDeposit + deficit, m.totalWithdraw));
                        }
                    }

                    await Promise.all(promises);
                    renderAll();
                    showToast('🎉 所有成員帳目已結清歸零，已自動建立交易憑證！');
                } catch (e) {
                    showToast("清帳失敗：" + e.message, "error");
                }
            }
        });
    }

    // LINE REPORT GENERATION
    const btnShareLineEl = document.getElementById('btnShareLine');
    if (btnShareLineEl) {
        btnShareLineEl.addEventListener('click', () => {
            const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
            const totalCash = appData.members.reduce((sum, m) => sum + m.balance, 0);
            const pendingBet = appData.bets.filter(b => b.status === 'pending').reduce((sum, b) => sum + b.amount, 0);

            let msg = `⚽🏆【世足運彩代購對帳報表 ${today}】⚽\n`;
            msg += `--------------------------------\n`;
            msg += `💰 小白手頭實有總現金：$${totalCash} 元\n`;
            msg += `⏳ 在途未開獎本金：$${pendingBet} 元\n\n`;
            
            msg += `👥 【成員錢包餘額與損益】\n`;
            appData.members.forEach(m => {
                const netProfit = m.balance + m.totalWithdraw - m.totalDeposit;
                const profitSign = netProfit >= 0 ? '+' : '';
                const balSign = m.balance >= 0 ? '' : ' (欠款)';
                msg += `- ${m.name}：餘額 $${m.balance}${balSign} [損益 ${profitSign}$${netProfit}]\n`;
            });
            
            const pendingBets = appData.bets.filter(b => b.status === 'pending');
            if (pendingBets.length > 0) {
                msg += `\n📝 【待開獎注單追蹤】\n`;
                pendingBets.forEach(b => {
                    const bettors = b.bettors.map(bt => {
                        const m = appData.members.find(member => member.id === bt.memberId);
                        return m ? `${m.name}($${bt.amount})` : `未知($${bt.amount})`;
                    }).join(', ');
                    msg += `- ${b.matchName} (${b.betType}) - 本金 $${b.amount} [賠率 ${b.odds}]\n  金主：${bettors}\n`;
                });
            }

            msg += `--------------------------------\n`;
            msg += `💡 小提示：負餘額的夥伴請記得轉帳給小白儲值喔！如有帳目問題請洽小白對帳。`;

            navigator.clipboard.writeText(msg).then(() => {
                showToast('已複製 LINE 報表文字，可直接貼到 LINE 群組！');
            }).catch(err => {
                const textarea = document.createElement('textarea');
                textarea.value = msg;
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    showToast('已複製 LINE 報表文字，可直接貼到 LINE 群組！');
                } catch (e) {
                    showToast('複製失敗，請手動複製控制台報表。', 'error');
                }
                document.body.removeChild(textarea);
            });
        });
    }
}

// Helper: Automatically set the betting date input to today
function setTodayDate() {
    const betDateInput = document.getElementById('bet-date');
    if (betDateInput) {
        const today = new Date().toISOString().split('T')[0];
        betDateInput.value = today;
    }
}

// Helper: Show/Hide Parlay remove buttons based on leg count
function updateParlayRemoveButtons() {
    const container = document.getElementById('parlay-legs-container');
    if (!container) return;
    const rows = container.querySelectorAll('.parlay-leg');
    const removeBtns = container.querySelectorAll('.btn-remove-leg');
    
    if (rows.length > 1) {
        removeBtns.forEach(btn => btn.style.display = 'block');
    } else {
        removeBtns.forEach(btn => btn.style.display = 'none');
    }
}

// Helper: Calculate total parlay odds by multiplying all leg odds in real-time
function calculateParlayOdds() {
    const oddsInputs = Array.from(document.querySelectorAll('.leg-odds'));
    let totalOdds = 1.0;
    let hasValidOdds = false;
    
    oddsInputs.forEach(input => {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) {
            totalOdds *= val;
            hasValidOdds = true;
        }
    });
    
    const totalOddsInput = document.getElementById('bet-odds');
    if (totalOddsInput) {
        if (hasValidOdds) {
            totalOddsInput.value = parseFloat(totalOdds.toFixed(4));
        } else {
            totalOddsInput.value = '';
        }
    }
}
