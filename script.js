// WITCORP HUB — ENTERPRISE SCRIPT (FIXED VERSION)
const SB_URL = 'https://yznyimxtlamdzotfgajz.supabase.co';
const SB_KEY = 'sb_publishable_6I-WD5gRpeqgR_JIecUSsw_1yaux_3y';
const VAPID_PUBLIC_KEY = "BDosxz9iUmLcKRXXxkXbJBDGqGOkAXipmriqsvi33FyqjfqNxec1bTzvA5CRN6OT6ianW7uh8Vs8Yc2Cfrah0sc";
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
// ============================================================
// SERVICE DETAIL OPTIONS BY CATEGORY
// ============================================================
const SERVICE_DETAILS_MAP = {
  "GST": [
    "GST Registration",
    "GST Amendment",
    "GST Monthly Filing (GSTR-1 & 3B)",
    "GST Quarterly Filing (GSTR-1 & 3B)",
    "LUT Filing",
    "GST Surrender",
    "GST Notice Reply",
    "GST Refund Application"
  ],
  "ROC": [
    "PLC/OPC Annual Filing",
    "Company Registration",
    "Company Amendment",
    "First 30 Days Compliance",
    "LLP Amendment",
    "LLP Annual Filing",
    "Company Closure",
    "Director KYC",
    "Miscellaneous ROC Work"
  ],
  "IT": [
    "ITR 1",
    "ITR 2",
    "ITR 3",
    "ITR 4",
    "ITR 5",
    "ITR 6",
    "Income Tax Notice Reply",
    "PAN Application"
  ],
  "TDS": [
    "TDS Challan",
    "Salary TDS Return",
    "Non-Salary TDS Return",
    "Non-Resident TDS Return",
    "TDS on Property",
    "TDS Lower Deduction Certificate",
    "TDS Return Revision",
    "TAN Registration",
    "Income Tax TAN Registration",
    "Traces TAN Registration",
    "Form 16 / 16A"
  ]
};
function updateServiceDetailOptions(categoryValue) {
  const datalist = document.getElementById('serviceSuggestions');
  if (!datalist) return;
  const options = SERVICE_DETAILS_MAP[categoryValue] || [];
  datalist.innerHTML = options.map(opt => `<option value="${opt}">`).join('');
}
function updateQAServiceOptions(categoryValue) {
  const datalist = document.getElementById('serviceSuggestions');
  if (!datalist) return;
  const options = SERVICE_DETAILS_MAP[categoryValue] || [];
  datalist.innerHTML = options.map(opt => `<option value="${opt}">`).join('');
}
let allRecords = [];
let allClients = [];
let allVault = [];
let allDSC = [];
let allNotifications = [];
let currentExportData = [];
let currentExportType = "records";
let unreadCount = 0;
let currentUserEmail = "";
let currentUserName = "";
let recordPage = 0;
const PAGE_SIZE = 100;
let isFetchingRecords = false;
let sortField = null;
let sortAsc = true;
let isFormDirty = false;
let selectedRowIds = new Set();
// FIX 8: Single interval references — prevent duplicate intervals on re-login
let _onlineUsersInterval = null;
let _presenceInterval = null;

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================
function showToast(message, type = 'success', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = {
        success: 'fa-circle-check', error: 'fa-circle-xmark',
        warning: 'fa-triangle-exclamation', info: 'fa-circle-info'
    };
    const colors = {
        success: 'bg-emerald-600', error: 'bg-red-600',
        warning: 'bg-amber-500', info: 'bg-blue-600'
    };
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl text-white font-bold text-sm shadow-2xl transform translate-x-full transition-all duration-300 ${colors[type] || colors.info}`;
    toast.style.maxWidth = '360px';
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info} text-lg flex-shrink-0"></i>
        <span class="flex-1">${message}</span>
        <button class="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
    `;
    toast.querySelector('button').onclick = () => removeToast(toast);
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.remove('translate-x-full')));
    setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
}

// ============================================================
// LAST SYNC TIMESTAMP
// ============================================================
function updateLastSync() {
    const badge = document.getElementById('lastSyncBadge');
    const text = document.getElementById('lastSyncText');
    if (!badge || !text) return;
    badge.classList.remove('hidden');
    const now = new Date();
    text.innerText = 'Synced ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ============================================================
// BREADCRUMB
// ============================================================
function updateBreadcrumb(section) {
    const map = {
        dashboard: 'Dashboard',
        clientManagement: 'Dashboard → Client Directory',
        vaultManagement: 'Dashboard → Credential Vault',
        dscManagement: 'Dashboard → DSC Status',
        filterView: 'Dashboard → Filter View'
    };
    const el = document.getElementById('breadcrumbText');
    if (el) el.innerText = map[section] || 'Dashboard';
}

// ============================================================
// FORM DIRTY STATE
// ============================================================
function markFormDirty() { isFormDirty = true; }
function clearDirtyState() { isFormDirty = false; }

// ============================================================
// DEADLINE ALERT BANNER
// ============================================================
function checkDeadlineAlerts(data) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const urgent = data.filter(r => {
        if (!r.deadline || r.status === 'Completed') return false;
        const d = new Date(r.deadline);
        d.setHours(0, 0, 0, 0);
        return d >= today && d < dayAfter;
    });
    const overdue = data.filter(r => {
        if (!r.deadline || r.status === 'Completed') return false;
        const d = new Date(r.deadline);
        d.setHours(0, 0, 0, 0);
        return d < today;
    });

    const banner = document.getElementById('deadlineAlertBanner');
    const text = document.getElementById('deadlineAlertText');
    if (!banner || !text) return;
    const parts = [];
    if (overdue.length > 0) parts.push(`${overdue.length} overdue record${overdue.length > 1 ? 's' : ''}`);
    if (urgent.length > 0) parts.push(`${urgent.length} due today/tomorrow`);
    if (parts.length > 0) {
        text.innerText = parts.join(' · ') + ' — action required.';
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

// ============================================================
// FETCH RECORDS
// ============================================================
async function fetchRecords(reset = true) {
    if (isFetchingRecords) return;
    isFetchingRecords = true;
    const skeleton = document.getElementById('tableSkeleton');
    const wrapper = document.getElementById('mainTableWrapper');
    if (reset && skeleton && wrapper) {
        skeleton.style.display = 'block';
        wrapper.style.display = 'none';
    }
    try {
        if (reset) { recordPage = 0; allRecords = []; }
        const from = recordPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabaseClient
            .from('witcorp_records')
            .select('*')
            .order('updated_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error("fetchRecords error:", error);
            showToast('Failed to fetch records. Check connection.', 'error');
            return;
        }
        if (data) {
            const uniqueData = data.filter(n => !allRecords.some(o => o.id === n.id));
            allRecords = [...allRecords, ...uniqueData];
            renderTable(allRecords, 'mainTableBody');
            updateStats(allRecords);
            checkDeadlineAlerts(allRecords);
            updateLastSync();
            recordPage++;
            const btn = document.getElementById("loadMoreBtn");
            if (btn) btn.style.display = data.length < PAGE_SIZE ? "none" : "block";
            const badge = document.getElementById('recordCountBadge');
            if (badge) badge.innerText = `${allRecords.length} records`;
        }
    } catch (err) {
        console.error("fetchRecords exception:", err);
        showToast('Error loading records. Please try again.', 'error');
    } finally {
        isFetchingRecords = false;
        if (skeleton && wrapper) {
            skeleton.style.display = 'none';
            wrapper.style.display = 'block';
        }
    }
}

// ============================================================
// SORT TABLE
// ============================================================
function sortTable(field) {
    if (sortField === field) { sortAsc = !sortAsc; } else { sortField = field; sortAsc = true; }
    document.querySelectorAll('[id^="sort_"]').forEach(el => { el.className = 'fas fa-sort ml-1 opacity-40'; });
    const icon = document.getElementById('sort_' + field);
    if (icon) icon.className = `fas fa-sort-${sortAsc ? 'up' : 'down'} ml-1 text-blue-500`;
    const sorted = [...allRecords].sort((a, b) => {
        let av = a[field] || '', bv = b[field] || '';
        if (field === 'updated_at' || field === 'deadline') {
            av = av ? new Date(av).getTime() : 0;
            bv = bv ? new Date(bv).getTime() : 0;
        } else {
            av = av.toString().toLowerCase();
            bv = bv.toString().toLowerCase();
        }
        if (av < bv) return sortAsc ? -1 : 1;
        if (av > bv) return sortAsc ? 1 : -1;
        return 0;
    });
    renderTable(sorted, 'mainTableBody');
}

// ============================================================
// MULTI FILTER
// ============================================================
function applyMultiFilter() {
    const statusVal = document.getElementById('filterStatus')?.value || '';
    const categoryVal = document.getElementById('filterCategory')?.value || '';
    let filtered = [...allRecords];
    if (statusVal) filtered = filtered.filter(r => r.status === statusVal);
    if (categoryVal) filtered = filtered.filter(r => r.service_category === categoryVal);
    renderTable(filtered, 'mainTableBody');
    updateStats(filtered);
    const badge = document.getElementById('recordCountBadge');
    if (badge) badge.innerText = `${filtered.length} records`;
}

function resetFilters() {
    const s = document.getElementById('filterStatus');
    const c = document.getElementById('filterCategory');
    if (s) s.value = '';
    if (c) c.value = '';
    renderTable(allRecords, 'mainTableBody');
    updateStats(allRecords);
    const badge = document.getElementById('recordCountBadge');
    if (badge) badge.innerText = `${allRecords.length} records`;
}

// ============================================================
// BULK SELECTION
// ============================================================
function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        const id = parseInt(cb.dataset.id, 10);
        if (checkbox.checked) { selectedRowIds.add(id); } else { selectedRowIds.delete(id); }
    });
    updateBulkBar();
}

function toggleRowSelect(id, checked) {
    if (checked) { selectedRowIds.add(id); } else { selectedRowIds.delete(id); }
    updateBulkBar();
    const allCbs = document.querySelectorAll('.row-checkbox');
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) {
        selectAllCb.checked = allCbs.length > 0 && [...allCbs].every(cb => cb.checked);
        selectAllCb.indeterminate = selectedRowIds.size > 0 && selectedRowIds.size < allCbs.length;
    }
}

function updateBulkBar() {
    const bar = document.getElementById('bulkActionBar');
    const count = document.getElementById('bulkSelectedCount');
    if (!bar || !count) return;
    if (selectedRowIds.size > 0) {
        bar.classList.remove('hidden');
        count.innerText = `${selectedRowIds.size} selected`;
    } else {
        bar.classList.add('hidden');
    }
}

function clearBulkSelection() {
    selectedRowIds.clear();
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
    updateBulkBar();
}

// ============================================================
// BULK STATUS APPLY — WITH FULL UNDO SUPPORT
// ============================================================
async function applyBulkStatus() {
    if (selectedRowIds.size === 0) return;
    const newStatus = document.getElementById('bulkStatusSelect')?.value;
    if (!newStatus) return;
    const ids = [...selectedRowIds];
    const previousStatuses = ids.map(id => {
        const rec = allRecords.find(r => r.id === id);
        return { id, status: rec?.status || 'Pending', updated_at: rec?.updated_at || new Date().toISOString(), updated_by: rec?.updated_by || '' };
    });
    const { error } = await supabaseClient
        .from('witcorp_records')
        .update({ status: newStatus, updated_at: new Date().toISOString(), updated_by: currentUserName })
        .in('id', ids);
    if (!error) {
        saveActivity(`Bulk Update: ${ids.length} records → ${newStatus}`);
        clearBulkSelection();
        await fetchRecords(true);
        showUndoToast(`${ids.length} record${ids.length > 1 ? 's' : ''} marked as ${newStatus}`, previousStatuses, 120000);
    } else {
        showToast('Bulk update failed. Check connection.', 'error');
    }
}

function showUndoToast(message, previousStatuses, duration = 120000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl text-white font-bold text-sm shadow-2xl transform translate-x-full transition-all duration-300 bg-slate-700`;
    toast.style.maxWidth = '420px';
    let secondsLeft = Math.floor(duration / 1000);
    toast.innerHTML = `
        <i class="fas fa-circle-check text-emerald-400 text-lg flex-shrink-0"></i>
        <div class="flex-1">
            <div>${message}</div>
            <div style="font-size:11px;opacity:0.6;font-weight:400;margin-top:2px;">
                Undo available for <span id="undoSecs">${secondsLeft}s</span>
            </div>
        </div>
        <button id="undoActionBtn" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:8px;padding:5px 14px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;white-space:nowrap;flex-shrink:0;">↩ Undo</button>
        <button id="undoCloseBtn" style="opacity:0.6;font-size:18px;background:none;border:none;color:#fff;cursor:pointer;padding:0;margin-left:4px;">&times;</button>
    `;
    toast.querySelector('#undoCloseBtn').onclick = () => { clearInterval(ticker); removeToast(toast); };
    toast.querySelector('#undoActionBtn').onclick = async () => { clearInterval(ticker); removeToast(toast); await undoBulkStatus(previousStatuses); };
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.remove('translate-x-full')));
    const ticker = setInterval(() => {
        secondsLeft--;
        const el = toast.querySelector('#undoSecs');
        if (el) {
            if (secondsLeft >= 60) {
                const m = Math.floor(secondsLeft / 60);
                const s = secondsLeft % 60;
                el.textContent = `${m}m ${s < 10 ? '0' + s : s}s`;
            } else {
                el.textContent = `${secondsLeft}s`;
            }
        }
        if (secondsLeft <= 0) clearInterval(ticker);
    }, 1000);
    setTimeout(() => { clearInterval(ticker); removeToast(toast); }, duration);
}

async function undoBulkStatus(previousStatuses) {
    let anyError = false;
    for (const { id, status, updated_at, updated_by } of previousStatuses) {
        const { error } = await supabaseClient.from('witcorp_records').update({ status, updated_at, updated_by }).eq('id', id);
        if (error) anyError = true;
    }
    if (!anyError) {
        saveActivity(`Undo Bulk Update: ${previousStatuses.length} records restored`);
        showToast(`${previousStatuses.length} record${previousStatuses.length > 1 ? 's' : ''} fully restored`, 'info');
        await fetchRecords(true);
    } else {
        showToast('Undo partially failed. Check connection.', 'error');
    }
}

// ============================================================
// RENDER TABLE
// ============================================================
let _rmkCounter = 0;

function renderTable(data, targetId) {
    currentExportData = data;
    currentExportType = "records";
    const tbody = document.getElementById(targetId);
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="12" class="p-16 text-center">
                <div class="flex flex-col items-center gap-4">
                    <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                        <i class="fas fa-folder-open text-3xl text-slate-300"></i>
                    </div>
                    <p class="font-black text-slate-400 text-sm uppercase tracking-wider">No records found</p>
                    <p class="text-xs text-slate-300">Try adjusting your filters or add a new record above</p>
                </div>
            </td></tr>`;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tbody.innerHTML = '';

    data.forEach(row => {
        const statusClass = { 'Completed': 'st-completed', 'Pending': 'st-pending', 'Processing': 'st-processing' }[row.status] || 'bg-slate-100';
        const statusIcon = { 'Completed': 'fa-circle-check', 'Pending': 'fa-circle-exclamation', 'Processing': 'fa-spinner fa-spin' }[row.status] || 'fa-info-circle';

        let rowBg = 'hover:bg-slate-50/80';
        if (row.deadline && row.status !== 'Completed') {
            const dl = new Date(row.deadline);
            dl.setHours(0, 0, 0, 0);
            if (dl < today) { rowBg = 'bg-red-50 hover:bg-red-100/60'; }
            else if (dl.getTime() === today.getTime() || dl.getTime() === tomorrow.getTime()) { rowBg = 'bg-amber-50 hover:bg-amber-100/60'; }
        }

        let datePart = '', timePart = '';
        if (row.updated_at) {
            const d = new Date(row.updated_at);
            datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
        const lastUpdate = row.updated_at ? `${datePart}, ${timePart}` : 'Syncing...';

        const svcFull = row.service_detail || 'General Consulting';
        const svcWords = svcFull.split(' ');
        let svcLines = [];
        if (svcWords.length <= 3) { svcLines = [svcFull]; }
        else { for (let i = 0; i < svcWords.length; i += 3) svcLines.push(svcWords.slice(i, i + 3).join(' ')); }
        const svcDisplay = svcLines.map(line => `<span style="display:block;font-size:13px;font-weight:600;color:#334155;line-height:1.6;">${line}</span>`).join('');

        _rmkCounter++;
        const uid = `rmk_${_rmkCounter}`;
        const fullRemarksRaw = row.remarks || '—';
        const safeShort = fullRemarksRaw.length > 55 ? fullRemarksRaw.substring(0, 54) + '\u2026' : fullRemarksRaw;
        const needsExpand = fullRemarksRaw.length > 55;
        const safeFull = fullRemarksRaw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const safeShortHtml = safeShort.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const remarksCell = needsExpand
            ? `<div style="min-width:180px;max-width:260px;">
                <span id="${uid}_s" style="font-size:13px;color:#475569;font-weight:400;">${safeShortHtml}</span>
                <span id="${uid}_f" style="font-size:13px;color:#475569;font-weight:400;display:none;">${safeFull}</span>
                <button data-rmk="${uid}" class="rmk-toggle-btn" style="margin-left:4px;font-size:11px;font-weight:700;color:#3b82f6;background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;vertical-align:middle;">more</button>
               </div>`
            : `<span style="font-size:13px;color:#475569;font-weight:400;">${safeShortHtml}</span>`;

        const updatedBy = row.updated_by || 'N/A';
        const updatedByShort = updatedBy.includes('@') ? updatedBy.split('@')[0] : updatedBy;
        const updatedByCell = `
            <div style="display:inline-flex;align-items:center;gap:5px;max-width:145px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:4px 9px;" title="${updatedBy}">
                <i class="fas fa-user-circle" style="color:#3b82f6;font-size:12px;flex-shrink:0;"></i>
                <span style="font-size:12px;font-weight:600;color:#1d4ed8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${updatedByShort}</span>
            </div>`;

        let deadlineDisplay = 'N/A', deadlineBadge = '';
        if (row.deadline) {
            const dl = new Date(row.deadline);
            dl.setHours(0, 0, 0, 0);
            deadlineDisplay = dl.toLocaleDateString('en-GB');
            if (row.status !== 'Completed') {
                if (dl < today) {
                    deadlineBadge = `<span style="display:block;font-size:9px;font-weight:700;color:#dc2626;background:#fee2e2;padding:1px 5px;border-radius:4px;margin-top:2px;">OVERDUE</span>`;
                } else if (dl.getTime() === today.getTime()) {
                    deadlineBadge = `<span style="display:block;font-size:9px;font-weight:700;color:#d97706;background:#fef3c7;padding:1px 5px;border-radius:4px;margin-top:2px;">TODAY</span>`;
                } else if (dl.getTime() === tomorrow.getTime()) {
                    deadlineBadge = `<span style="display:block;font-size:9px;font-weight:700;color:#d97706;background:#fef3c7;padding:1px 5px;border-radius:4px;margin-top:2px;">TOMORROW</span>`;
                }
            }
        }

        const isChecked = selectedRowIds.has(row.id) ? 'checked' : '';

        // FIX 6: Safe JSON for onclick — prevent single-quote injection breaking HTML attribute
        const safeJson = JSON.stringify(row).replace(/'/g, "&#39;");

        // FIX 5: Safe client name for onclick string params
        const safeClientName = row.client_name.replace(/'/g, "\\'").replace(/"/g, '&quot;');

       tbody.innerHTML += `
            <tr class="group transition-all ${rowBg}" id="row_${row.id}">
                <td class="p-4">
                    <input type="checkbox" class="row-checkbox w-4 h-4 rounded" data-id="${row.id}" ${isChecked}
                        onchange="toggleRowSelect(${row.id}, this.checked)">
                </td>
                <td class="p-4 font-bold text-slate-800 text-sm whitespace-nowrap">${row.client_name}</td>
                <td class="p-4 whitespace-nowrap">
                    <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                        <i class="far fa-clock text-blue-400"></i>${lastUpdate}
                    </div>
                </td>
                <td class="p-4" style="min-width:140px;max-width:200px;">${svcDisplay}</td>
                <td class="p-4 text-center whitespace-nowrap">
                    <div class="inline-block px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase">${row.service_category}</div>
                </td>
                <td class="p-4 text-center whitespace-nowrap">
                    <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 shadow-sm">
                        <i class="fas fa-user-tie text-blue-500 text-xs"></i>${row.assigned_staff || 'TBD'}
                    </div>
                </td>
                <td class="p-4 text-center whitespace-nowrap">
                    <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-xl text-xs font-semibold text-cyan-700 shadow-sm">
                        <i class="fas fa-user-check text-xs"></i>${row.alloted_by || 'N/A'}
                    </div>
                </td>
                <td class="p-4 text-center font-semibold text-slate-600 text-sm whitespace-nowrap">
                    <div>${deadlineDisplay}</div>${deadlineBadge}
                </td>
                <td class="p-4 text-center whitespace-nowrap">
                    <span class="status-pill ${statusClass}"><i class="fas ${statusIcon}"></i>${row.status}</span>
                </td>
                <td class="p-4">${remarksCell}</td>
                <td class="p-4 whitespace-nowrap">${updatedByCell}</td>
                <td class="p-4 text-right whitespace-nowrap">
                    <div class="flex justify-end gap-2 flex-wrap">
                        <button onclick="togglePin(${row.id})" id="pin_${row.id}"
                            class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-amber-50 hover:text-amber-500 transition-all shadow-sm hover:scale-110 text-sm" title="Pin Record">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                        <button onclick="openCommentsModal(${row.id}, '${safeClientName}')"
                            class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-purple-50 hover:text-purple-600 transition-all shadow-sm hover:scale-110 text-sm" title="Comments">
                            <i class="fas fa-comments"></i>
                        </button>
                        <button onclick="openSubtasksModal(${row.id}, '${safeClientName}')"
                            class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm hover:scale-110 text-sm" title="Checklist">
                            <i class="fas fa-list-check"></i>
                        </button>
                        <button onclick="openAuditModal(${row.id})"
                            class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all shadow-sm hover:scale-110 text-sm" title="Change History">
                            <i class="fas fa-clock-rotate-left"></i>
                        </button>
                        <button onclick='editRecord(${safeJson})' class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm hover:scale-110 text-sm" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteRecord(${row.id})" class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm hover:scale-110 text-sm" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });
}


// ============================================================
// REMARKS TOGGLE — event delegation
// ============================================================
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.rmk-toggle-btn');
    if (btn) {
        const uid = btn.getAttribute('data-rmk');
        if (!uid) return;
        const s = document.getElementById(uid + '_s');
        const f = document.getElementById(uid + '_f');
        if (!s || !f) return;
        const expanded = f.style.display !== 'none';
        f.style.display = expanded ? 'none' : 'inline';
        s.style.display = expanded ? 'inline' : 'none';
        btn.innerText = expanded ? 'more' : 'less';
        return;
    }
    // FIX 7: Consolidated click-outside handlers
    const profileMenu = document.getElementById("profileMenu");
    if (profileMenu && !e.target.closest("#profileMenu") && !e.target.closest("[onclick*='toggleProfileMenu']")) {
        profileMenu.classList.add("hidden");
    }
    const notifPanel = document.getElementById("notificationPanel");
    if (notifPanel && !e.target.closest("#notificationPanel") && !e.target.closest("[onclick*='toggleNotificationPanel']")) {
        notifPanel.classList.add("hidden");
    }
});

// ============================================================
// HANDLE SUBMIT
// ============================================================
async function handleSubmit() {
    const id = document.getElementById('editId').value;
    const clientName = document.getElementById('clientName').value?.trim();
    const serviceCategory = document.getElementById('serviceCategory').value?.trim();
    const deadline = document.getElementById('deadline').value?.trim();

    if (!clientName) { showToast('Client Name is mandatory.', 'error'); return; }
    if (!serviceCategory) { showToast('Service Category is mandatory.', 'error'); return; }
    // Pehle old assigned staff yaad rakho
const oldRecord = allRecords.find(r => r.id === parseInt(id));
const oldStaff = oldRecord?.assigned_staff || '';
const newStaff = document.getElementById('assignedStaff').value;
    const payload = {
        status: document.getElementById('status').value,
        remarks: document.getElementById('remarks').value,
        client_name: clientName,
        service_category: serviceCategory,
        service_detail: document.getElementById('serviceDetail').value,
        assigned_staff: document.getElementById('assignedStaff').value,
        alloted_by: document.getElementById('allotedBy').value,
        deadline: deadline || null,
        updated_at: new Date().toISOString(),
        updated_by: currentUserName
    };

    const btn = document.getElementById('submitBtn');
    const origHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin text-xl"></i> Syncing...`;
    btn.disabled = true;

    try {
        const { error } = id
            ? await supabaseClient.from('witcorp_records').update(payload).eq('id', parseInt(id, 10))
            : await supabaseClient.from('witcorp_records').insert([payload]);

        btn.innerHTML = origHtml;
        btn.disabled = false;

        if (!error) {
            if (id) {
                const oldRecord = allRecords.find(r => r.id === parseInt(id));
                await saveAuditTrail('witcorp_records', id, 'UPDATE', oldRecord, payload);
            } else {
                await saveAuditTrail('witcorp_records', 'new', 'INSERT', null, payload);
            }
            const actionText = id
                ? `Updated Record: ${payload.client_name} | ${payload.service_category} | Status: ${payload.status}`
                : `Added Record: ${payload.client_name} | ${payload.service_category} | ${payload.service_detail || 'N/A'}`;
            saveActivity(actionText);
            await createNotificationForOthers(
                id ? "Record Updated" : "New Record Added",
                `${payload.client_name} — ${payload.service_category} updated by ${currentUserName}`,
                "record", payload.client_name
            );
            showToast(id ? `Record updated: ${payload.client_name}` : `Record added: ${payload.client_name}`, 'success');
            // Feature 12 — Staff assignment notification
if (newStaff && newStaff !== oldStaff) {
    await supabaseClient.from('witcorp_notifications').insert([{
        title: '📋 Naya Kaam Assign Hua!',
        message: `${currentUserName} ne tumhe assign kiya: ${payload.client_name} — ${payload.service_category}`,
        type: 'record',
        reference: payload.client_name,
        created_by: currentUserEmail,
        is_read: false
    }]);
}
            clearForm();
            clearDirtyState();
            await fetchRecords(true);
            showSection('dashboard');
        } else {
            showToast('Sync Error: Please check connection.', 'error');
        }
    } catch (err) {
        console.error("handleSubmit error:", err);
        showToast('Submission failed. Please try again.', 'error');
        btn.innerHTML = origHtml;
        btn.disabled = false;
    }
}

function editRecord(row) {
    document.getElementById('editId').value = row.id;
    document.getElementById('clientName').value = row.client_name;
    document.getElementById('serviceCategory').value = row.service_category;
    updateServiceDetailOptions(row.service_category);
    document.getElementById('serviceDetail').value = row.service_detail || '';
    document.getElementById('assignedStaff').value = row.assigned_staff || '';
    document.getElementById('allotedBy').value = row.alloted_by || '';
    document.getElementById('deadline').value = row.deadline ? row.deadline.substring(0, 10) : "";
    document.getElementById('status').value = row.status;
    document.getElementById('remarks').value = row.remarks || '';
    document.getElementById('formTitle').innerText = "Modify Existing Profile";
    document.getElementById('submitBtn').innerHTML = `<i class="fas fa-arrows-rotate mr-2"></i> Confirm Changes`;
    document.getElementById('editBadge').classList.remove('hidden');
    // FIX 1: Only disable specific fields, keep status/remarks editable
    ['clientName', 'serviceCategory', 'serviceDetail', 'assignedStaff', 'allotedBy', 'deadline'].forEach(fId => {
        const el = document.getElementById(fId);
        if (el) el.disabled = true;
    });
    showSection('dashboard');
    setTimeout(() => {
        document.getElementById('entryFormAnchor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

async function deleteRecord(id) {
    if (confirm("Confirm: Are you sure you want to delete this record?")) {
        const rec = allRecords.find(r => r.id === id);
        try {
            const { error } = await supabaseClient.from('witcorp_records').delete().eq('id', parseInt(id, 10));
            if (!error) {
                const logText = rec
                    ? `Deleted Record: ${rec.client_name} | ${rec.service_category} | ${rec.service_detail || 'N/A'}`
                    : `Deleted Record ID: ${id}`;
                saveActivity(logText);
                showToast(rec ? `Deleted: ${rec.client_name}` : 'Record deleted', 'warning');
                await fetchRecords(true);
            } else {
                showToast('Delete failed. Check connection.', 'error');
            }
        } catch (err) {
            console.error("deleteRecord error:", err);
            showToast('Delete operation failed.', 'error');
        }
    }
}

// ============================================================
// CLEAR FORM — FIX 1: Re-enable all fields on clear
// ============================================================
function clearForm() {
    document.getElementById('editId').value = "";
    document.getElementById('formTitle').innerText = "Management Portal";
    document.getElementById('submitBtn').innerHTML = `<i class="fas fa-cloud-arrow-up text-xl"></i> Sync To WitcorpDB`;
    document.getElementById('editBadge').classList.add('hidden');
    ['clientName', 'serviceCategory', 'serviceDetail', 'assignedStaff', 'allotedBy', 'deadline', 'status', 'remarks'].forEach(fId => {
        const el = document.getElementById(fId);
        if (!el) return;
        el.disabled = false; // Always re-enable first
        if (fId === 'serviceCategory') { el.value = 'Sales'; }
        else if (fId === 'status') { el.value = 'Pending'; }
        else { el.value = ""; }
    });
  updateServiceDetailOptions('GST');
    clearDirtyState();
}

// ============================================================
// FETCH CLIENTS
// ============================================================
async function fetchClients() {
    try {
        const { data, error } = await supabaseClient
            .from('witcorp_clients').select('*')
            .order('client_name', { ascending: true }).limit(300);
        if (error) { console.error("fetchClients error:", error); return; }
        allClients = data || [];
        currentExportData = data;
        currentExportType = "clients";
        setupPredictions();

        const containers = { 'Pvt Ltd': 'pvtLtdList', 'LLP': 'llpList', 'Others': 'othersList' };
        const counts = { 'Pvt Ltd': 0, 'LLP': 0, 'Others': 0 };
        Object.values(containers).forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ""; });

        if (data.length === 0) {
            Object.values(containers).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = `<div class="text-center py-8 text-slate-300 font-bold text-sm"><i class="fas fa-users text-3xl block mb-2"></i>No clients yet</div>`;
            });
            return;
        }

        data.sort((a, b) => (a.client_name || '').toLowerCase().localeCompare((b.client_name || '').toLowerCase()));
        data.forEach(c => {
            const typeKey = ['Pvt Ltd', 'LLP'].includes(c.entity_type) ? c.entity_type : 'Others';
            counts[typeKey]++;
            const listId = containers[typeKey];
            const clientRecordCount = allRecords.filter(r => r.client_name === c.client_name).length;
            const recordBadge = clientRecordCount > 0
                ? `<span class="ml-auto px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black">${clientRecordCount} records</span>` : '';
            // FIX 6: Safe JSON for onclick
            const safeClientJson = JSON.stringify(c).replace(/'/g, "&#39;");
            document.getElementById(listId).innerHTML += `
                <div class="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-blue-400 transition-all group">
                    <div class="flex items-center gap-2">
                        <div class="font-bold text-slate-800 text-sm flex-1">${c.client_name}</div>
                        ${recordBadge}
                    </div>
                    <div class="text-xs text-slate-500 font-semibold mt-1"><i class="fas fa-phone-alt mr-1.5 text-blue-500"></i>${c.contact_number}</div>
                    <div class="text-xs text-blue-600 font-semibold break-all mt-1 opacity-70 group-hover:opacity-100"><i class="fas fa-envelope mr-1.5"></i>${c.email_id}</div>
                    <div class="text-xs text-green-600 font-semibold mt-1">Updated By: ${c.updated_by || 'N/A'}</div>
                    <div class="mt-4 flex gap-4 border-t border-slate-200/50 pt-3">
                        <button onclick='editClient(${safeClientJson})' class="text-xs text-blue-600 font-bold uppercase hover:scale-110 transition-transform">Modify</button>
                        <button onclick="deleteClient(${c.id})" class="text-xs text-rose-500 font-bold uppercase hover:scale-110 transition-transform">Delete</button>
                    </div>
                </div>`;
        });

        const pvtCount = document.getElementById('pvtLtdCount');
        const llpCount = document.getElementById('llpCount');
        const othersCount = document.getElementById('othersCount');
        if (pvtCount) pvtCount.innerText = counts['Pvt Ltd'];
        if (llpCount) llpCount.innerText = counts['LLP'];
        if (othersCount) othersCount.innerText = counts['Others'];
    } catch (err) {
        console.error("fetchClients exception:", err);
        showToast('Error loading clients.', 'error');
    }
}

function editClient(c) {
    document.getElementById('cEditId').value = c.id;
    document.getElementById('cName').value = c.client_name;
    document.getElementById('cPhone').value = c.contact_number;
    document.getElementById('cEmail').value = c.email_id;
    document.getElementById('cType').value = c.entity_type;
    document.getElementById('clientBtn').innerText = "Confirm Update Profile";
    document.getElementById('cName').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveClient() {
    const id = document.getElementById('cEditId').value;
    const clientName = document.getElementById('cName').value?.trim();
    const phone = document.getElementById('cPhone').value?.trim();
    const email = document.getElementById('cEmail').value?.trim();
    const type = document.getElementById('cType').value;
    if (!clientName) { showToast('Entity Name Required', 'error'); return; }
    const payload = { client_name: clientName, contact_number: phone, email_id: email, entity_type: type, updated_by: currentUserName };
    try {
        const { error } = id
            ? await supabaseClient.from('witcorp_clients').update(payload).eq('id', parseInt(id, 10))
            : await supabaseClient.from('witcorp_clients').insert([payload]);
        if (!error) {
            await createNotificationForOthers(id ? "Client Updated" : "New Client Added", `${payload.client_name} profile updated by ${currentUserName}`, "client");
            saveActivity(`${id ? 'Updated' : 'Added'} Client: ${payload.client_name} | ${payload.entity_type}`);
            showToast(`${id ? 'Updated' : 'Added'}: ${payload.client_name}`, 'success');
            await fetchClients();
            document.getElementById('cEditId').value = "";
            ['cName', 'cPhone', 'cEmail'].forEach(i => document.getElementById(i).value = "");
            document.getElementById('clientBtn').innerText = "Save Client Profile";
        } else { showToast('Save failed. Check connection.', 'error'); }
    } catch (err) { console.error("saveClient error:", err); showToast('Save operation failed.', 'error'); }
}

async function deleteClient(id) {
    if (confirm("Action: Delete client profile?")) {
        const c = allClients.find(x => x.id === id);
        try {
            const { error } = await supabaseClient.from('witcorp_clients').delete().eq('id', parseInt(id, 10));
            if (!error) {
                if (c) saveActivity(`Deleted Client: ${c.client_name} | ${c.entity_type}`);
                showToast(c ? `Deleted: ${c.client_name}` : 'Client deleted', 'warning');
                await fetchClients();
            } else { showToast('Delete failed.', 'error'); }
        } catch (err) { console.error("deleteClient error:", err); showToast('Delete operation failed.', 'error'); }
    }
}

// ============================================================
// FETCH VAULT
// ============================================================
async function fetchVault() {
    try {
        const { data, error } = await supabaseClient
            .from('witcorp_credentials').select('*')
            .order('client_name', { ascending: true }).limit(300);
        if (error) { console.error("fetchVault error:", error); return; }
        allVault = data || [];
        currentExportData = data;
        currentExportType = "vault";
        setupPredictions();
        renderVaultTable(data);
    } catch (err) { console.error("fetchVault exception:", err); showToast('Error loading vault.', 'error'); }
}

function renderVaultTable(data) {
    const tbody = document.getElementById('vaultTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-16 text-center">
            <div class="flex flex-col items-center gap-4">
                <i class="fas fa-shield-halved text-4xl text-slate-200"></i>
                <p class="font-black text-slate-400 text-sm uppercase">No credentials stored</p>
            </div></td></tr>`;
        return;
    }
    data.forEach(v => {
        const fullPass = v.password || '';
        const maskedPass = '•'.repeat(Math.min(fullPass.length, 12));
        const vId = `vault_${v.id}`;
        // FIX 4: Consistent safe base64 encode for unicode support
        let encodedPass = '';
        try { encodedPass = btoa(unescape(encodeURIComponent(fullPass))); } catch (e) { encodedPass = btoa(fullPass); }
        // FIX 6: Safe JSON for editVault onclick
        const safeVaultJson = JSON.stringify(v).replace(/'/g, "&#39;");
        const safeUsername = v.username.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        tbody.innerHTML += `
            <tr class="group hover:bg-slate-50" id="${vId}_row">
                <td class="p-4 font-bold text-blue-900 text-sm whitespace-nowrap">${v.client_name || 'N/A'}</td>
                <td class="p-4 whitespace-nowrap"><span class="px-2 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">${v.category}</span></td>
                <td class="p-4 font-semibold text-blue-600 text-sm whitespace-nowrap">
                    <div class="flex items-center gap-2">
                        <span>${v.username}</span>
                        <button onclick="copyToClipboard('${safeUsername}', 'Username')"
                            class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-all text-xs" title="Copy Username">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </td>
                <td class="p-4 font-mono text-sm whitespace-nowrap">
                    <div class="flex items-center gap-2">
                        <span class="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-inner" id="${vId}_pass" data-pwd="${encodedPass}">${maskedPass}</span>
                        <button onclick="toggleVaultPassword('${vId}')" class="text-slate-400 hover:text-blue-600 transition-all text-xs" title="Show/Hide">
                            <i class="fas fa-eye" id="${vId}_eye"></i>
                        </button>
                        <button onclick="copyPasswordSafe('${vId}')"
                            class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-all text-xs" title="Copy Password">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </td>
                <td class="p-4 text-sm font-semibold text-blue-700 whitespace-nowrap">${v.updated_by || 'N/A'}</td>
                <td class="p-4 text-right whitespace-nowrap">
                    <div class="flex gap-3 justify-end items-center">
                        <button onclick='editVault(${safeVaultJson})' class="text-blue-500 hover:scale-125 transition-transform text-sm"><i class="fas fa-pencil"></i></button>
                        <button onclick="deleteVault(${v.id})" class="text-rose-500 hover:scale-125 transition-transform text-sm"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>`;
    });
}

// FIX 4: Consistent password encode/decode
function _encodePass(plainText) {
    try { return btoa(unescape(encodeURIComponent(plainText))); } catch (e) { return btoa(plainText); }
}
function _decodePass(encoded) {
    try { return decodeURIComponent(escape(atob(encoded))); } catch (e) { return atob(encoded); }
}

function toggleVaultPassword(vId) {
    const passEl = document.getElementById(vId + '_pass');
    const eyeEl = document.getElementById(vId + '_eye');
    if (!passEl || !eyeEl) return;
    const encodedPass = passEl.getAttribute('data-pwd');
    if (!encodedPass) return;
    const isHidden = passEl.textContent.includes('•');
    if (isHidden) {
        try {
            passEl.textContent = _decodePass(encodedPass);
            eyeEl.className = 'fas fa-eye-slash';
        } catch (err) { console.error("Password decode error:", err); showToast('Error decoding password', 'error'); }
    } else {
        const fullPass = passEl.textContent;
        passEl.textContent = '•'.repeat(Math.min(fullPass.length, 12));
        eyeEl.className = 'fas fa-eye';
    }
}

function copyPasswordSafe(vId) {
    const passEl = document.getElementById(vId + '_pass');
    if (!passEl) return;
    const encodedPass = passEl.getAttribute('data-pwd');
    let password;
    if (encodedPass && passEl.textContent.includes('•')) {
        try { password = _decodePass(encodedPass); }
        catch (err) { console.error("Password decode error:", err); showToast('Error decoding password', 'error'); return; }
    } else {
        password = passEl.textContent;
    }
    copyToClipboard(password, 'Password');
}

function copyToClipboard(text, label) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`${label} copied to clipboard`, 'info', 2000);
        }).catch(() => fallbackCopy(text, label));
    } else {
        fallbackCopy(text, label);
    }
}

function fallbackCopy(text, label) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast(`${label} copied`, 'info', 2000);
    } catch (err) {
        showToast(`Copy failed. Please copy manually.`, 'error', 2000);
    }
    document.body.removeChild(ta);
}

function editVault(v) {
    document.getElementById('vEditId').value = v.id;
    document.getElementById('vClient').value = v.client_name;
    document.getElementById('vCat').value = v.category;
    document.getElementById('vUser').value = v.username;
    document.getElementById('vPass').value = v.password;
    document.getElementById('vaultBtn').innerText = "Update Vault Credentials";
    document.getElementById('vClient').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveVault() {
    const id = document.getElementById('vEditId').value;
    const clientName = document.getElementById('vClient').value?.trim();
    const category = document.getElementById('vCat').value?.trim();
    const username = document.getElementById('vUser').value?.trim();
    const password = document.getElementById('vPass').value?.trim();
    if (!category || !clientName) { showToast('Required fields missing.', 'error'); return; }
    const payload = { client_name: clientName, category, username, password, updated_by: currentUserName };
    try {
        const { error } = id
            ? await supabaseClient.from('witcorp_credentials').update(payload).eq('id', parseInt(id, 10))
            : await supabaseClient.from('witcorp_credentials').insert([payload]);
        if (!error) {
            await createNotificationForOthers(id ? "Vault Updated" : "Credentials Added", `${payload.client_name} credentials updated by ${currentUserName}`, "vault");
            saveActivity(`${id ? 'Updated' : 'Added'} Vault: ${payload.client_name} | ${payload.category}`);
            showToast(`${id ? 'Updated' : 'Saved'}: ${payload.client_name} credentials`, 'success');
            await fetchVault();
            document.getElementById('vEditId').value = "";
            ['vClient', 'vCat', 'vUser', 'vPass'].forEach(i => document.getElementById(i).value = "");
            document.getElementById('vaultBtn').innerText = "Store Securely";
        } else { showToast('Save failed. Check connection.', 'error'); }
    } catch (err) { console.error("saveVault error:", err); showToast('Save operation failed.', 'error'); }
}

async function deleteVault(id) {
    if (confirm("Security: Confirm credential deletion?")) {
        const v = allVault.find(x => x.id === id);
        try {
            const { error } = await supabaseClient.from('witcorp_credentials').delete().eq('id', parseInt(id, 10));
            if (!error) {
                if (v) saveActivity(`Deleted Vault: ${v.client_name} | ${v.category}`);
                showToast(v ? `Deleted: ${v.client_name}` : 'Credential deleted', 'warning');
                await fetchVault();
            } else { showToast('Delete failed.', 'error'); }
        } catch (err) { console.error("deleteVault error:", err); showToast('Delete operation failed.', 'error'); }
    }
}

function searchVault(query) {
    const q = query.toLowerCase();
    const filtered = allVault.filter(v =>
        v.client_name?.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        v.username?.toLowerCase().includes(q)
    );
    renderVaultTable(filtered);
    if (query.trim() === "") fetchVault();
}

// ============================================================
// ACCOUNTING HUB TOGGLES
// ============================================================
function toggleAccountingHub() { document.getElementById('accountinghubMenu').classList.toggle('hidden'); }
function toggleAccountingHubDesktop() { document.getElementById('accountinghubDesktopMenu').classList.toggle('hidden'); }

// ============================================================
// SHOW SECTION
// ============================================================
function showSection(id) {
    if (isFormDirty && id !== 'dashboard') {
        const leave = confirm("You have unsaved changes in the form. Leave anyway?");
        if (!leave) return;
        clearDirtyState();
    }
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const globalSearch = document.getElementById('globalSearchBox');
    if (id === 'clientManagement' || id === 'vaultManagement' || id === 'dscManagement') {
        if (globalSearch) globalSearch.style.display = 'none';
    } else {
        if (globalSearch) globalSearch.style.display = 'block';
    }
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const section = document.getElementById(id);
    if (section) section.classList.add('active');
    if (id === 'dashboard') document.getElementById('nav-dashboard')?.classList.add('active');
    if (id === 'clientManagement') document.getElementById('nav-client')?.classList.add('active');
    if (id === 'vaultManagement') document.getElementById('nav-vault')?.classList.add('active');
    if (id === 'dscManagement') document.getElementById('nav-dsc')?.classList.add('active');

    const filterMap = {
        'GST': 'nav-gst', 'ROC': 'nav-roc', 'IT': 'nav-it', 'PT': 'nav-pt', 'TDS': 'nav-tds',
        'DIRECTOR KYC': 'nav-dkyc', 'UDIN': 'nav-udin', 'FOOD': 'nav-food',
        'MSME': 'nav-msme', 'PAYROLL': 'nav-payroll', 'REPORTS': 'nav-reports'
    };
    if (id === 'filterView') {
        const activeVal = window._lastFilterValue;
        const navId = filterMap[activeVal];
        if (navId) document.getElementById(navId)?.classList.add('active');
    }

   // AFTER:
if (id === 'dashboard') {
    const fetchPromises = [];
    if (allRecords.length === 0) fetchPromises.push(fetchRecords());
    if (allClients.length === 0) fetchPromises.push(fetchClients());
    if (fetchPromises.length > 0) {
        Promise.all(fetchPromises).then(() => setupPredictions());
    }
}
if (id === 'clientManagement') fetchClients();
    if (id === 'vaultManagement') fetchVault();
    if (id === 'dscManagement') fetchDSC();

    updateBreadcrumb(id);
    updatePresence(id);
    setTimeout(applyGreenHeaders, 80);
}

// ============================================================
// FILTER BY FIELD — FIX 5: Explicit 'all' handling
// ============================================================
function filterByField(field, value) {
    window._lastFilterValue = value;
    showSection('filterView');
    let filtered;
    if (field === 'all' || !value) {
        filtered = [...allRecords];
    } else {
        filtered = allRecords.filter(r => r[field] === value);
    }
    const titles = {
        "GST": "GST Compliance", "ROC": "Corporate Compliance (ROC)", "IT": "Income Tax",
        "PT": "Professional Tax", "TDS": "TDS Compliance", "DIRECTOR KYC": "Director KYC",
        "UDIN": "UDIN/Certification", "FOOD": "Food License", "MSME": "MSME Certification",
        "PAYROLL": "Payroll", "REPORTS": "Reports",
        "Completed": "Completed Records", "Pending": "Pending Records"
    };
    document.getElementById('filterTitle').innerText = `${titles[value] || value || 'All'} Portal View`;
    renderTable(filtered, 'filterTableBody');
}

// ============================================================
// HANDLE SEARCH
// ============================================================
function handleSearch(query) {
    const q = query.toLowerCase().trim();
    if (q === "") {
        showSection('dashboard');
        if (allRecords.length === 0) fetchRecords();
        return;
    }
    const filtered = allRecords.filter(r =>
        r.client_name?.toLowerCase().includes(q) ||
        r.service_detail?.toLowerCase().includes(q) ||
        r.assigned_staff?.toLowerCase().includes(q) ||
        r.service_category?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q) ||
        r.alloted_by?.toLowerCase().includes(q)
    );
    showSection('filterView');
    document.getElementById('filterTitle').innerText = `Results for: "${query}"`;
    renderTable(filtered, 'filterTableBody');
}

// ============================================================
// UPDATE STATS
// ============================================================
function updateStats(data) {
    const total = data.length;
    const done = data.filter(r => r.status === 'Completed').length;
    const pending = data.filter(r => r.status === 'Pending').length;
    const processing = data.filter(r => r.status === 'Processing').length;
    document.getElementById('statTotal').innerText = total;
    document.getElementById('statDone').innerText = done;
    document.getElementById('statPending').innerText = pending;
    const totalSub = document.getElementById('statTotalSub');
    const doneSub = document.getElementById('statDoneSub');
    const pendingSub = document.getElementById('statPendingSub');
    if (totalSub) totalSub.innerText = total > 0 ? `${processing} processing` : '';
    if (doneSub) doneSub.innerText = total > 0 ? `${Math.round((done / total) * 100)}% completion rate` : '';
    if (pendingSub) pendingSub.innerText = total > 0 ? `${Math.round((pending / total) * 100)}% need attention` : '';
}

// ============================================================
// REFRESH DATA
// ============================================================
async function refreshData() {
    const btn = document.getElementById("refreshBtn");
    if (!btn) return;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Refreshing';
    btn.disabled = true;
    await fetchRecords(true);
    renderTable(allRecords, 'mainTableBody');
    btn.innerHTML = '<i class="fas fa-check mr-1"></i> Updated';
    btn.disabled = false;
    showToast('Records refreshed successfully', 'success', 2000);
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-rotate-right mr-1"></i> Refresh'; }, 1500);
}

// ============================================================
// AUTH
// ============================================================
async function registerUser() {
    const email = document.getElementById("email")?.value;
    const password = document.getElementById("password")?.value;
    if (!email || !password) { document.getElementById('authMsg').innerText = "Email and password required"; return; }
    try {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) { document.getElementById('authMsg').innerText = error.message; return; }
        const user = data.user;
        if (user) {
            await supabaseClient.from('witcorp_users').insert([{ id: user.id, email: user.email, role: 'user', approved: true }]);
            document.getElementById('authMsg').innerText = "Registered Successfully! Now login.";
        }
    } catch (err) { console.error("registerUser error:", err); document.getElementById('authMsg').innerText = "Registration failed. Please try again."; }
}

async function loginUser() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    if (!email || !password) { document.getElementById('authMsg').innerText = "Email and password required"; return; }
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { document.getElementById('authMsg').innerText = error.message; return; }
        if (data.user) checkApproval(data.user);
    } catch (err) { console.error("loginUser error:", err); document.getElementById('authMsg').innerText = "Login failed. Please try again."; }
}

async function checkApproval(user) {
    try {
        const { data } = await supabaseClient.from('witcorp_users').select('approved').eq('id', user.id).single();
        if (!data || !data.approved) { showToast('Not approved by admin yet', 'error'); await logout(); return; }
        currentUserName = user.email;
        showApp(user);
    } catch (err) { console.error("checkApproval error:", err); showToast('Approval check failed', 'error'); }
}

async function logout() {
    try { await supabaseClient.auth.signOut(); location.reload(); }
    catch (err) { console.error("logout error:", err); location.reload(); }
}

supabaseClient.auth.getSession().then(({ data }) => {
    if (data?.session) checkApproval(data.session.user);
});

// ============================================================
// MOBILE MENU
// ============================================================
function toggleMenu() {
    const menu = document.getElementById("mobileMenu");
    menu.classList.toggle("hidden");
    if (menu.classList.contains("hidden")) { document.body.classList.remove("menu-open"); }
    else { document.body.classList.add("menu-open"); }
}

// ============================================================
// SEARCH CLIENTS
// ============================================================
function searchClients(query) {
    const q = query.toLowerCase().trim();
    const filtered = allClients.filter(c =>
        c.client_name?.toLowerCase().includes(q) ||
        c.contact_number?.toLowerCase().includes(q) ||
        c.email_id?.toLowerCase().includes(q)
    );
    filtered.sort((a, b) => {
        const aS = a.client_name?.toLowerCase().startsWith(q) ? 0 : 1;
        const bS = b.client_name?.toLowerCase().startsWith(q) ? 0 : 1;
        if (aS !== bS) return aS - bS;
        return (a.client_name || '').toLowerCase().localeCompare((b.client_name || '').toLowerCase());
    });
    const containers = { 'Pvt Ltd': 'pvtLtdList', 'LLP': 'llpList', 'Others': 'othersList' };
    Object.values(containers).forEach(id => { document.getElementById(id).innerHTML = ""; });
    filtered.forEach(c => {
        const typeKey = ['Pvt Ltd', 'LLP'].includes(c.entity_type) ? c.entity_type : 'Others';
        const listId = containers[typeKey];
        const clientRecordCount = allRecords.filter(r => r.client_name === c.client_name).length;
        const recordBadge = clientRecordCount > 0
            ? `<span class="ml-auto px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black">${clientRecordCount} records</span>` : '';
        const safeClientJson = JSON.stringify(c).replace(/'/g, "&#39;");
        document.getElementById(listId).innerHTML += `
            <div class="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-blue-400 transition-all group">
                <div class="flex items-center gap-2">
                    <div class="font-bold text-slate-800 text-sm flex-1">${c.client_name}</div>
                    ${recordBadge}
                </div>
                <div class="text-xs text-slate-500 font-semibold mt-1"><i class="fas fa-phone-alt mr-1.5 text-blue-500"></i>${c.contact_number}</div>
                <div class="text-xs text-blue-600 font-semibold break-all mt-1 opacity-70 group-hover:opacity-100"><i class="fas fa-envelope mr-1.5"></i>${c.email_id}</div>
                <div class="mt-4 flex gap-4 border-t border-slate-200/50 pt-3">
                    <button onclick='editClient(${safeClientJson})' class="text-xs text-blue-600 font-bold uppercase hover:scale-110 transition-transform">Modify</button>
                    <button onclick="deleteClient(${c.id})" class="text-xs text-rose-500 font-bold uppercase hover:scale-110 transition-transform">Delete</button>
                </div>
            </div>`;
    });
    if (query.trim() === "") fetchClients();
}

// ============================================================
// DSC FUNCTIONS
// ============================================================
async function fetchDSC() {
    try {
        const { data, error } = await supabaseClient.from('witcorp_dsc').select('*').order('company_name', { ascending: true });
        if (error) { console.error("DSC FETCH ERROR:", error); return; }
        allDSC = data || [];
        currentExportData = allDSC;
        currentExportType = "dsc";
        setupPredictions();
        renderDSC(allDSC);
    } catch (err) { console.error("fetchDSC exception:", err); showToast('Error loading DSC records.', 'error'); }
}

function renderDSC(data) {
    const tbody = document.getElementById('dscTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-16 text-center">
            <div class="flex flex-col items-center gap-4">
                <i class="fas fa-key text-4xl text-slate-200"></i>
                <p class="font-black text-slate-400 text-sm uppercase">No DSC records found</p>
            </div></td></tr>`;
        return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    data.forEach(d => {
        const fullRem = d.remarks || '—';
        const shortRem = fullRem.length > 50 ? fullRem.substring(0, 48) + '\u2026' : fullRem;
        const updatedAt = d.updated_at ? (() => {
            const dt = new Date(d.updated_at);
            return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
                dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        })() : 'N/A';
        const statusColors = {
            'Valid': 'bg-emerald-100 text-emerald-700 border-emerald-200',
            'Expired': 'bg-red-100 text-red-700 border-red-200',
            'No DSC': 'bg-slate-100 text-slate-600 border-slate-200'
        };
        const statusStyle = statusColors[d.status] || statusColors['No DSC'];
        let expiryBadge = '';
        if (d.expiry_date && d.status === 'Valid') {
            const expiry = new Date(d.expiry_date);
            expiry.setHours(0, 0, 0, 0);
            const daysLeft = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 30 && daysLeft >= 0) {
                expiryBadge = `<span class="ml-1 text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">${daysLeft}d left</span>`;
            } else if (daysLeft < 0) {
                expiryBadge = `<span class="ml-1 text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded">EXPIRED</span>`;
            }
        }
        const safeDscJson = JSON.stringify(d).replace(/'/g, "&#39;");
        tbody.innerHTML += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition-all">
                <td class="p-4 font-bold text-sm text-slate-800 whitespace-nowrap">${d.company_name || ''}</td>
                <td class="p-4 font-semibold text-sm text-slate-600 whitespace-nowrap">${d.client_name || ''}</td>
                <td class="p-4 whitespace-nowrap"><span class="px-3 py-1 rounded-xl text-xs font-black border ${statusStyle}">${d.status || ''}</span></td>
                <td class="p-4 font-semibold text-sm text-slate-600 whitespace-nowrap">${d.expiry_date || 'N/A'}${expiryBadge}</td>
                <td class="p-4 text-sm text-slate-600 max-w-[200px]" title="${fullRem.replace(/"/g, '&quot;')}">
                    <span class="block">${shortRem}</span>
                </td>
                <td class="p-4 text-sm font-semibold text-blue-700 whitespace-nowrap">${d.updated_by || 'N/A'}</td>
                <td class="p-4 text-sm font-semibold text-slate-500 whitespace-nowrap">${updatedAt}</td>
                <td class="p-4 text-right whitespace-nowrap">
                    <div class="flex gap-2 justify-end items-center">
                        <button onclick='editDSC(${safeDscJson})' class="px-3 py-1 bg-blue-500 text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-all">Edit</button>
                        <button onclick="deleteDSC(${d.id})" class="px-3 py-1 bg-red-500 text-white rounded-xl text-xs font-semibold hover:bg-red-600 transition-all">Delete</button>
                    </div>
                </td>
            </tr>`;
    });
}

async function saveDSC() {
    const btn = document.getElementById('dscBtn');
    const id = document.getElementById('dEditId').value; // Capture id before async
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
    const companyName = document.getElementById('dCompany').value?.trim();
    if (!companyName) {
        btn.disabled = false;
        btn.innerHTML = id ? 'Update DSC Status' : 'Save DSC Status'; // FIX 3: Use captured id
        showToast('Company Name Required', 'error');
        return;
    }
    const payload = {
        company_name: companyName,
        client_name: document.getElementById('dClient').value?.trim(),
        status: document.getElementById('dStatus').value,
        expiry_date: document.getElementById('dExpiry').value,
        remarks: document.getElementById('dRemarks').value?.trim(),
        updated_by: currentUserName,
        updated_at: new Date().toISOString()
    };
    try {
        const { error } = id
            ? await supabaseClient.from('witcorp_dsc').update(payload).eq('id', parseInt(id, 10))
            : await supabaseClient.from('witcorp_dsc').insert([payload]);
        if (!error) {
            await createNotificationForOthers(id ? "DSC Updated" : "New DSC Added", `${payload.company_name} DSC updated by ${currentUserName}`, "dsc");
            saveActivity(`${id ? 'Updated' : 'Added'} DSC: ${payload.company_name} | ${payload.client_name} | Status: ${payload.status}`);
            showToast(`DSC ${id ? 'updated' : 'saved'}: ${payload.company_name}`, 'success');
            await fetchDSC();
            document.getElementById('dEditId').value = "";
            ['dCompany', 'dClient', 'dExpiry', 'dRemarks'].forEach(i => document.getElementById(i).value = "");
            document.getElementById('dStatus').value = "Valid";
            document.getElementById('dscBtn').innerText = "Save DSC Status";
        } else { showToast('Save failed. Check connection.', 'error'); }
    } catch (err) { console.error("saveDSC error:", err); showToast('Save operation failed.', 'error'); }
    finally {
        btn.disabled = false;
        // FIX 3: Use captured id for correct label
        btn.innerHTML = id ? 'Update DSC Status' : 'Save DSC Status';
    }
}

function editDSC(d) {
    document.getElementById('dEditId').value = d.id;
    document.getElementById('dCompany').value = d.company_name;
    document.getElementById('dClient').value = d.client_name;
    document.getElementById('dStatus').value = (['Valid', 'Expired', 'No DSC'].includes(d.status)) ? d.status : 'Valid';
    document.getElementById('dExpiry').value = d.expiry_date ? d.expiry_date.substring(0, 10) : "";
    document.getElementById('dRemarks').value = d.remarks || '';
    document.getElementById('dscBtn').innerText = "Update DSC Status";
    document.getElementById('dCompany').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteDSC(id) {
    if (confirm("Delete DSC Record?")) {
        const d = allDSC.find(x => x.id === id);
        try {
            const { error } = await supabaseClient.from('witcorp_dsc').delete().eq('id', parseInt(id, 10));
            if (!error) {
                if (d) saveActivity(`Deleted DSC: ${d.company_name} | ${d.client_name}`);
                showToast(d ? `Deleted: ${d.company_name}` : 'DSC deleted', 'warning');
                await fetchDSC();
            } else { showToast('Delete failed.', 'error'); }
        } catch (err) { console.error("deleteDSC error:", err); showToast('Delete operation failed.', 'error'); }
    }
}

function searchDSC(query) {
    const q = query.toLowerCase();
    const filtered = allDSC.filter(d =>
        d.company_name?.toLowerCase().includes(q) ||
        d.client_name?.toLowerCase().includes(q) ||
        d.status?.toLowerCase().includes(q)
    );
    renderDSC(filtered);
}

// ============================================================
// SERVICE WORKER
// ===========================================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/WitcorpDB/sw.js', { scope: '/WitcorpDB/' })
        .then(() => console.log("SW registered"))
        .catch(err => console.error("SW registration error:", err));
}

// ============================================================
// PROFILE MENU TOGGLE
// ============================================================
function toggleProfileMenu() {
    document.getElementById("profileMenu").classList.toggle("hidden");
}

// ============================================================
// THEME SETTINGS
// ============================================================
function openThemeSettings() { document.getElementById("themeModal").classList.remove("hidden"); }
function closeThemeSettings() { document.getElementById("themeModal").classList.add("hidden"); }

// ============================================================
// NOTIFICATIONS
// ============================================================
async function createNotificationForOthers(title, message, type = "info", reference = "") {
  try {
    await supabaseClient.from('witcorp_notifications').insert([{
      title, message, type, reference,
      created_by: currentUserName, is_read: false
    }]);

    // ✅ Insert push queue with proper data
    await supabaseClient.from('witcorp_push_queue').insert([{ title, message }]);

    // ✅ Call edge function WITH body — warna server kuch push nahi karta
    fetch(`${SB_URL}/functions/v1/send-push-`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, message })  // ← YEH MISSING THA
    }).catch(() => {});

  } catch (err) {
    console.error("createNotificationForOthers error:", err);
  }
}
async function fetchNotifications() {
    try {
        const { data, error } = await supabaseClient
            .from('witcorp_notifications').select('*')
            .order('created_at', { ascending: false }).limit(50);
        if (error) return;
        allNotifications = data || [];
        renderNotifications();
    } catch (err) { console.error("fetchNotifications error:", err); }
}

async function markAllRead() {
    const unreadIds = allNotifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    try {
        await supabaseClient.from('witcorp_notifications').update({ is_read: true }).in('id', unreadIds);
        allNotifications.forEach(n => n.is_read = true);
        renderNotifications();
        showToast('All notifications marked as read', 'info', 2000);
    } catch (err) { console.error("markAllRead error:", err); }
}

function renderNotifications() {
    const list = document.getElementById('notificationList');
    const count = document.getElementById('notificationCount');
    if (!list) return;
    list.innerHTML = "";
    const unread = allNotifications.filter(n => !n.is_read);
    unreadCount = unread.length;
    if (count) {
        if (unreadCount > 0) { count.classList.remove('hidden'); count.innerText = unreadCount > 99 ? '99+' : unreadCount; }
        else { count.classList.add('hidden'); }
    }
    if (allNotifications.length === 0) {
        list.innerHTML = `<div class="p-10 text-center text-slate-400 font-bold text-sm">
            <i class="fas fa-bell-slash text-3xl block mb-3 opacity-30"></i>No notifications yet</div>`;
        return;
    }
    const typeIcon = { record: 'fa-file-alt', client: 'fa-address-card', vault: 'fa-shield-halved', dsc: 'fa-key' };
    allNotifications.forEach(n => {
        const notifDiv = document.createElement('div');
        notifDiv.dataset.notifId = n.id;
        notifDiv.dataset.notifType = n.type;
        notifDiv.dataset.notifRef = n.reference || '';
        notifDiv.className = `p-4 cursor-pointer transition-all hover:bg-slate-50 flex gap-3 items-start ${!n.is_read ? 'bg-blue-50 border-l-4 border-blue-400' : 'bg-white'}`;
        const iconDiv = document.createElement('div');
        iconDiv.className = `w-8 h-8 rounded-full ${!n.is_read ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'} flex items-center justify-center flex-shrink-0 mt-0.5`;
        iconDiv.innerHTML = `<i class="fas ${typeIcon[n.type] || 'fa-bell'} text-xs"></i>`;
        const contentDiv = document.createElement('div');
        contentDiv.className = 'flex-1 min-w-0';
        const titleEl = document.createElement('div');
        titleEl.className = 'font-bold text-sm text-slate-800';
        titleEl.textContent = n.title;
        const messageEl = document.createElement('div');
        messageEl.className = 'text-xs text-slate-500 mt-0.5';
        messageEl.textContent = n.message;
        const timeEl = document.createElement('div');
        timeEl.className = 'text-[10px] text-blue-500 mt-1 font-semibold';
        timeEl.textContent = new Date(n.created_at).toLocaleString('en-IN');
        contentDiv.appendChild(titleEl);
        contentDiv.appendChild(messageEl);
        contentDiv.appendChild(timeEl);
        notifDiv.appendChild(iconDiv);
        notifDiv.appendChild(contentDiv);
        if (!n.is_read) {
            const readDot = document.createElement('span');
            readDot.className = 'w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2';
            notifDiv.appendChild(readDot);
        }
        notifDiv.addEventListener('click', function() {
            openNotification(parseInt(this.dataset.notifId, 10), this.dataset.notifType, this.dataset.notifRef);
        });
        list.appendChild(notifDiv);
    });
}

function toggleNotificationPanel() {
    document.getElementById('notificationPanel').classList.toggle('hidden');
}

async function openNotification(id, type, reference) {
    try {
        await supabaseClient.from('witcorp_notifications').update({ is_read: true }).eq('id', parseInt(id, 10));
        const target = allNotifications.find(n => n.id === id);
        if (target) target.is_read = true;
        renderNotifications();
        if (type === "record") { showSection('dashboard'); handleSearch(reference); }
        if (type === "client") { showSection('clientManagement'); searchClients(reference); }
        if (type === "vault") { showSection('vaultManagement'); searchVault(reference); }
        if (type === "dsc") { showSection('dscManagement'); searchDSC(reference); }
        document.getElementById('notificationPanel').classList.add('hidden');
    } catch (err) { console.error("openNotification error:", err); }
}

// ============================================================
// REALTIME SUBSCRIPTION
// ============================================================
supabaseClient
    .channel('live-notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'witcorp_notifications' }, async (payload) => {
        try {
            if (payload.new.created_by === currentUserName) return;
            allNotifications.unshift(payload.new);
            renderNotifications();
            const notificationEnabled = localStorage.getItem("notificationSound");
            if (notificationEnabled !== "off") {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    oscillator.frequency.value = 800;
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.5);
                } catch (e) {}
                navigator.serviceWorker?.ready.then(reg => {
                    reg.showNotification(payload.new.title || "New Update", {
                        body: payload.new.message || "Database updated",
                        icon: "./logo.png", badge: "./logo.png"
                    });
                }).catch(() => {});
            }
            showToast(payload.new.title + ': ' + payload.new.message, 'info');
            await fetchRecords(true);
        } catch (err) { console.error("Realtime subscription error:", err); }
    })
    .subscribe((status) => { console.log("NOTIFICATION STATUS:", status); });

// ============================================================
// AUTOCOMPLETE / PREDICTIONS
// ============================================================
function setupPredictions() {
    const clientList = document.getElementById('clientSuggestions');
    const uniqueClients = [...new Set(allClients.map(c => c.client_name).filter(Boolean))];
    if (clientList) clientList.innerHTML = uniqueClients.map(name => `<option value="${name}">`).join('');
    const serviceList = document.getElementById('serviceSuggestions');
const currentCat = document.getElementById('serviceCategory')?.value || '';
const categoryOptions = SERVICE_DETAILS_MAP[currentCat] || [];
const dbOptions = [...new Set(allRecords.map(r => r.service_detail).filter(Boolean))];
const mergedOptions = [...new Set([...categoryOptions, ...dbOptions])];
if (serviceList) serviceList.innerHTML = mergedOptions.map(name => `<option value="${name}">`).join('');
    const staffList = document.getElementById('staffSuggestions');
    const uniqueStaff = [...new Set(allRecords.map(r => r.assigned_staff).filter(Boolean))];
    if (staffList) staffList.innerHTML = uniqueStaff.map(name => `<option value="${name}">`).join('');
    const allotList = document.getElementById('allotedSuggestions');
    const uniqueAlloted = [...new Set(allRecords.map(r => r.alloted_by).filter(Boolean))];
    if (allotList) allotList.innerHTML = uniqueAlloted.map(name => `<option value="${name}">`).join('');
    const companyList = document.getElementById('companySuggestions');
    const uniqueCompany = [...new Set(allDSC.map(d => d.company_name).filter(Boolean))];
    if (companyList) companyList.innerHTML = uniqueCompany.map(name => `<option value="${name}">`).join('');
    const vaultList = document.getElementById('vaultCategorySuggestions');
    const uniqueVault = [...new Set(allVault.map(v => v.category).filter(Boolean))];
    if (vaultList) vaultList.innerHTML = uniqueVault.map(name => `<option value="${name}">`).join('');
}

// ============================================================
// FORGOT PASSWORD
// ============================================================
async function forgotPassword() {
    const email = document.getElementById("email")?.value;
    if (!email) { document.getElementById('authMsg').innerText = "Please enter your email first"; return; }
    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname + "?reset=true"
        });
        if (error) { document.getElementById('authMsg').innerText = error.message; }
        else { document.getElementById('authMsg').innerText = "Password reset link sent to your email."; }
    } catch (err) { console.error("forgotPassword error:", err); document.getElementById('authMsg').innerText = "Reset failed. Please try again."; }
}

// ============================================================
// NOTIFICATION SOUND SETTING
// ============================================================
function loadNotificationSetting() {
    const push = localStorage.getItem("notificationSound");
    const status = document.getElementById("notificationStatus");
    if (!status) return;
    if (push === "off") {
        status.innerText = "OFF";
        status.classList.remove("text-green-600");
        status.classList.add("text-red-500");
    } else {
        status.innerText = "ON";
        status.classList.remove("text-red-500");
        status.classList.add("text-green-600");
    }
}

async function toggleNotificationSetting() {
    const current = localStorage.getItem("notificationSound");
    if (current === "off") {
        // ON karo — dobara subscribe
        localStorage.setItem("notificationSound", "on");
        await subscribeToPush();
        showToast('Notifications enabled', 'success', 2000);
    } else {
        // OFF karo — unsubscribe
        localStorage.setItem("notificationSound", "off");
        try {
            const reg = await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.getSubscription();
            if (subscription) await subscription.unsubscribe();
            await supabaseClient.from('witcorp_push_subscriptions')
                .delete().eq('user_email', currentUserEmail);
        } catch (err) {
            console.error('Unsubscribe error:', err);
        }
        showToast('Notifications disabled', 'info', 2000);
    }
    loadNotificationSetting();
}

// ============================================================
// EXPORT MODAL
// ============================================================
function openExportModal() { document.getElementById("exportModal").classList.remove("hidden"); }
function closeExportModal() { document.getElementById("exportModal").classList.add("hidden"); }
function openMyActivity() { document.getElementById("activityModal").classList.remove("hidden"); loadMyActivity(); }
function closeActivityModal() { document.getElementById("activityModal").classList.add("hidden"); }

// ============================================================
// ACTIVITY LOG
// ============================================================
async function loadMyActivity() {
    const list = document.getElementById("activityList");
    if (!list) return;
    list.innerHTML = `<div class="text-center text-slate-400 py-6">Loading...</div>`;
    try {
        const { data } = await supabaseClient
            .from('witcorp_activity_log').select('*')
            .eq('user_email', currentUserEmail)
            .order('created_at', { ascending: false }).limit(50);
        const iconMap = {
            'Added': 'fa-circle-plus text-emerald-500', 'Updated': 'fa-pen-to-square text-blue-500',
            'Deleted': 'fa-trash-can text-rose-500', 'Exported': 'fa-file-export text-purple-500',
            'Bulk': 'fa-layer-group text-cyan-500', 'Login': 'fa-right-to-bracket text-amber-500',
            'Other': 'fa-clock-rotate-left text-slate-400'
        };
        if (!data || data.length === 0) {
            list.innerHTML = `<div class="text-center text-slate-400 py-10 font-semibold">No activity recorded yet.</div>`;
            return;
        }
        list.innerHTML = data.map(item => {
            const icon = iconMap[item.action_type] || iconMap['Other'];
            const parts = item.action_text.split('|').map(p => p.trim());
            const mainText = parts[0] || item.action_text;
            const details = parts.slice(1);
            return `
                <div class="flex items-start gap-3 border-b border-slate-100 py-4 last:border-0">
                    <div class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i class="fas ${icon} text-sm"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-sm text-slate-800">${mainText}</div>
                        ${details.length ? `<div class="text-sm text-slate-500 mt-0.5">${details.join(' · ')}</div>` : ''}
                        <div class="text-xs text-blue-500 font-semibold mt-1">${new Date(item.created_at).toLocaleString('en-IN')}</div>
                    </div>
                </div>`;
        }).join('');
    } catch (err) {
        console.error("loadMyActivity error:", err);
        list.innerHTML = `<div class="text-center text-red-500 py-10 font-semibold">Error loading activity</div>`;
    }
}

// ============================================================
// EXPORT FUNCTIONS
// ============================================================
function exportCSV() {
    const rows = currentExportData || [];
    if (rows.length === 0) { showToast('No records found to export', 'warning'); return; }
    let csv = "";
    if (currentExportType === "records") {
        csv = "Client,Category,Service,Staff,Status,Deadline\n";
        rows.forEach(r => { csv += `"${r.client_name || ""}","${r.service_category || ""}","${r.service_detail || ""}","${r.assigned_staff || ""}","${r.status || ""}","${r.deadline || ""}"\n`; });
    } else if (currentExportType === "clients") {
        csv = "Client Name,Phone,Email,Type\n";
        rows.forEach(r => { csv += `"${r.client_name || ""}","${r.contact_number || ""}","${r.email_id || ""}","${r.entity_type || ""}"\n`; });
    } else if (currentExportType === "vault") {
        csv = "Client,Category,Username,Password,Updated By\n";
        rows.forEach(r => { csv += `"${r.client_name || ""}","${r.category || ""}","${r.username || ""}","${r.password || ""}","${r.updated_by || ""}"\n`; });
    } else if (currentExportType === "dsc") {
        csv = "Company,Client,Status,Expiry Date,Remarks\n";
        rows.forEach(r => { csv += `"${r.company_name || ""}","${r.client_name || ""}","${r.status || ""}","${r.expiry_date || ""}","${r.remarks || ""}"\n`; });
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = currentExportType + ".csv";
    a.click();
    saveActivity("Exported CSV Report: " + currentExportType);
    showToast('CSV exported successfully', 'success');
}

function exportExcel() {
    const rows = currentExportData || [];
    if (rows.length === 0) { showToast('No records found to export', 'warning'); return; }
    let csv = "";
    if (currentExportType === "records") {
        csv = "Client,Category,Service,Staff,Alloted By,Status,Deadline,Remarks,Updated By\n";
        rows.forEach(r => { csv += `"${r.client_name || ""}","${r.service_category || ""}","${r.service_detail || ""}","${r.assigned_staff || ""}","${r.alloted_by || ""}","${r.status || ""}","${r.deadline || ""}","${r.remarks || ""}","${r.updated_by || ""}"\n`; });
    } else if (currentExportType === "clients") {
        csv = "Client Name,Phone,Email,Type,Updated By\n";
        rows.forEach(r => { csv += `"${r.client_name || ""}","${r.contact_number || ""}","${r.email_id || ""}","${r.entity_type || ""}","${r.updated_by || ""}"\n`; });
    } else if (currentExportType === "vault") {
        csv = "Client,Category,Username,Password,Updated By\n";
        rows.forEach(r => { csv += `"${r.client_name || ""}","${r.category || ""}","${r.username || ""}","${r.password || ""}","${r.updated_by || ""}"\n`; });
    } else if (currentExportType === "dsc") {
        csv = "Company,Client,Status,Expiry Date,Remarks,Updated By\n";
        rows.forEach(r => { csv += `"${r.company_name || ""}","${r.client_name || ""}","${r.status || ""}","${r.expiry_date || ""}","${r.remarks || ""}","${r.updated_by || ""}"\n`; });
    }
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Witcorp_" + currentExportType + ".xls";
    a.click();
    saveActivity("Exported Excel Report: " + currentExportType);
    showToast('Excel exported successfully', 'success');
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("landscape");
    const rows = currentExportData || [];
    if (rows.length === 0) { showToast('No records found to export', 'warning'); return; }
    let tableHead = [], tableData = [];
    if (currentExportType === "vault") {
        tableHead = [["Client", "Category", "Username", "Password", "Updated By"]];
        tableData = rows.map(r => [r.client_name || "", r.category || "", r.username || "", r.password || "", r.updated_by || ""]);
    } else if (currentExportType === "clients") {
        tableHead = [["Client", "Phone", "Email", "Type"]];
        tableData = rows.map(r => [r.client_name || "", r.contact_number || "", r.email_id || "", r.entity_type || ""]);
    } else if (currentExportType === "dsc") {
        tableHead = [["Company", "Client", "Status", "Expiry Date", "Remarks"]];
        tableData = rows.map(r => [r.company_name || "", r.client_name || "", r.status || "", r.expiry_date || "", r.remarks || ""]);
    } else {
        tableHead = [["Client", "Category", "Service", "Staff", "Alloted By", "Status", "Deadline", "Remarks", "Updated By"]];
        tableData = rows.map(r => [r.client_name || "", r.service_category || "", r.service_detail || "", r.assigned_staff || "", r.alloted_by || "", r.status || "", r.deadline || "", r.remarks || "", r.updated_by || ""]);
    }
    doc.setFontSize(16);
    doc.text("Witcorp Hub Report", 14, 15);
    doc.autoTable({
        head: tableHead, body: tableData, startY: 25,
        didDrawPage: function() { doc.setFontSize(10); doc.text("Generated: " + new Date().toLocaleString(), 14, 10); }
    });
    doc.save("Witcorp_Report.pdf");
    saveActivity("Exported PDF Report: " + currentExportType);
    showToast('PDF exported successfully', 'success');
}

// ============================================================
// GREEN TABLE HEADERS
// ============================================================
function applyGreenHeaders() {
    document.querySelectorAll('th').forEach(th => {
        th.style.color = '#16a34a';
        th.style.fontWeight = '700';
        th.style.fontSize = '11px';
        th.style.letterSpacing = '0.06em';
    });
}

// ============================================================
// KEYBOARD SHORTCUTS — SINGLE UNIFIED HANDLER
// ============================================================
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchBox = document.getElementById('globalSearch');
        if (searchBox) {
            const globalSearchBox = document.getElementById('globalSearchBox');
            if (globalSearchBox) globalSearchBox.style.display = 'block';
            searchBox.focus();
            searchBox.select();
        }
   }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (!currentUserEmail) return;
        openQuickAdd();
    }
    if (e.key === 'Escape') {
        ['notificationPanel', 'profileMenu', 'themeModal', 'activityModal', 'exportModal',
         'auditModal', 'commentsModal', 'subtasksModal', 'quickAddModal', 'profileModal']
            .forEach(id => document.getElementById(id)?.classList.add('hidden'));
    }
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.id === 'commentInput') {
        e.preventDefault();
        postComment();
    }
});

// ============================================================
// USER PROFILE SYSTEM
// ============================================================
let currentUserProfile = null;

async function loadUserProfile(email) {
    try {
        const { data, error } = await supabaseClient
            .from('witcorp_user_profiles').select('*').eq('email', email).single();
        if (error || !data) { await createUserProfile(email); return; }
        currentUserProfile = data;
        applyUserPreferences(data);
        updateProfileUI(data);
    } catch (err) { console.error('loadUserProfile error:', err); }
}

async function createUserProfile(email) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const payload = {
            id: user.id, email,
            full_name: '', designation: '', role: 'staff',
            bg_theme: localStorage.getItem('bgTheme') || 'theme-light',
            sidebar_theme: localStorage.getItem('sidebarTheme') || 'sidebar-theme-original',
            notification_sound: localStorage.getItem('notificationSound') || 'on',
            avatar_color: randomColor
        };
        const { data, error } = await supabaseClient
            .from('witcorp_user_profiles').insert([payload]).select().single();
        if (!error && data) { currentUserProfile = data; applyUserPreferences(data); updateProfileUI(data); }
    } catch (err) { console.error('createUserProfile error:', err); }
}

async function updateUserProfile(updates, showMessage = true) {
    if (!currentUserProfile) return;
    try {
        updates.updated_at = new Date().toISOString();
        const { error } = await supabaseClient
            .from('witcorp_user_profiles').update(updates).eq('email', currentUserProfile.email);
        if (!error) {
            currentUserProfile = { ...currentUserProfile, ...updates };
            if (showMessage) showToast('Profile updated successfully', 'success', 2000);
            updateProfileUI(currentUserProfile);
        }
    } catch (err) { console.error('updateUserProfile error:', err); }
}

function applyUserPreferences(profile) {
    if (profile.bg_theme) changeTheme(profile.bg_theme);
    if (profile.sidebar_theme) changeSidebarTheme(profile.sidebar_theme);
    if (profile.default_category_filter) { const el = document.getElementById('filterCategory'); if (el) el.value = profile.default_category_filter; }
    if (profile.default_status_filter) { const el = document.getElementById('filterStatus'); if (el) el.value = profile.default_status_filter; }
}

function updateProfileUI(profile) {
    const name = profile.full_name || profile.email;
    const initial = name.charAt(0).toUpperCase();
    const p1 = document.getElementById('profileInitial');
    const p2 = document.getElementById('profileInitial2');
    if (p1) {
        p1.innerText = initial;
        p1.style.background = profile.avatar_color || '#3b82f6';
        p1.style.color = '#ffffff';
        p1.style.fontWeight = '800';
        p1.style.fontSize = '15px';
        p1.style.display = 'flex';
        p1.style.alignItems = 'center';
        p1.style.justifyContent = 'center';
        p1.style.borderRadius = '50%';
        p1.style.boxShadow = '0 2px 8px rgba(0,0,0,0.22)';
        p1.style.textShadow = '0 1px 2px rgba(0,0,0,0.18)';
    }
    if (p2) {
        p2.innerText = initial;
        p2.style.background = profile.avatar_color || '#3b82f6';
        p2.style.color = '#ffffff';
        p2.style.fontWeight = '800';
        p2.style.fontSize = '15px';
        p2.style.display = 'flex';
        p2.style.alignItems = 'center';
        p2.style.justifyContent = 'center';
        p2.style.borderRadius = '50%';
        p2.style.boxShadow = '0 2px 8px rgba(0,0,0,0.22)';
        p2.style.textShadow = '0 1px 2px rgba(0,0,0,0.18)';
    }
    const nameEl = document.getElementById('profileDisplayName');
    if (nameEl) nameEl.innerText = profile.full_name || profile.email.split('@')[0];
    const desigEl = document.getElementById('profileDesignation');
    if (desigEl) desigEl.innerText = profile.designation || 'Team Member';
    const roleEl = document.getElementById('profileRoleBadge');
    if (roleEl) {
        const roleColors = { admin: 'bg-red-100 text-red-700', manager: 'bg-purple-100 text-purple-700', staff: 'bg-blue-100 text-blue-700', viewer: 'bg-slate-100 text-slate-600' };
        roleEl.className = `px-2 py-0.5 rounded-full text-xs font-black ${roleColors[profile.role] || roleColors.staff}`;
        roleEl.innerText = (profile.role || 'staff').toUpperCase();
    }
}

function openProfileModal() {
    const modal = document.getElementById('profileModal');
    if (!modal) return;
    if (currentUserProfile) {
        document.getElementById('pFullName').value = currentUserProfile.full_name || '';
        document.getElementById('pDesignation').value = currentUserProfile.designation || '';
        document.getElementById('pPhone').value = currentUserProfile.phone || '';
        document.getElementById('pDepartment').value = currentUserProfile.department || '';
        document.getElementById('pDefaultCategory').value = currentUserProfile.default_category_filter || '';
        document.getElementById('pDefaultStatus').value = currentUserProfile.default_status_filter || '';
        const statsAdded = document.getElementById('pStatsAdded');
        const statsUpdated = document.getElementById('pStatsUpdated');
        const statsDeleted = document.getElementById('pStatsDeleted');
        if (statsAdded) statsAdded.innerText = currentUserProfile.total_added || 0;
        if (statsUpdated) statsUpdated.innerText = currentUserProfile.total_updated || 0;
        if (statsDeleted) statsDeleted.innerText = currentUserProfile.total_deleted || 0;
    }
    modal.classList.remove('hidden');
}

function closeProfileModal() { document.getElementById('profileModal')?.classList.add('hidden'); }

async function saveProfileChanges() {
    const updates = {
        full_name: document.getElementById('pFullName').value.trim(),
        designation: document.getElementById('pDesignation').value.trim(),
        phone: document.getElementById('pPhone').value.trim(),
        department: document.getElementById('pDepartment').value.trim(),
        default_category_filter: document.getElementById('pDefaultCategory').value,
        default_status_filter: document.getElementById('pDefaultStatus').value
    };
    await updateUserProfile(updates);
    currentUserName = updates.full_name || currentUserProfile.email;
    closeProfileModal();
}

async function loadActivityInProfile() {
    try {
        const { data } = await supabaseClient
            .from('witcorp_activity_log').select('*')
            .eq('user_email', currentUserEmail)
            .order('created_at', { ascending: false }).limit(30);
        const list = document.getElementById('profileActivityList');
        if (!list) return;
        if (!data || data.length === 0) {
            list.innerHTML = `<div class="text-center text-slate-400 py-6 text-sm font-semibold">No activity yet</div>`;
            return;
        }
        const iconMap = {
            Added: 'fa-circle-plus text-emerald-500', Updated: 'fa-pen-to-square text-blue-500',
            Deleted: 'fa-trash-can text-rose-500', Exported: 'fa-file-export text-purple-500',
            Bulk: 'fa-layer-group text-cyan-500', Login: 'fa-right-to-bracket text-amber-500',
            Other: 'fa-clock-rotate-left text-slate-400'
        };
        list.innerHTML = data.map(item => `
            <div class="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
                <div class="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <i class="fas ${iconMap[item.action_type] || iconMap.Other} text-xs"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-700">${item.action_text}</div>
                    <div class="text-xs text-blue-500 font-semibold mt-0.5">${new Date(item.created_at).toLocaleString('en-IN')}</div>
                </div>
            </div>`).join('');
    } catch (err) { console.error('loadActivityInProfile error:', err); }
}

// ============================================================
// ACTIVITY LOG — DB Based
// ============================================================
async function saveActivity(text) {
    try {
        const actionType = ['Added', 'Updated', 'Deleted', 'Exported', 'Bulk', 'Login']
            .find(t => text.startsWith(t)) || 'Other';
        await supabaseClient.from('witcorp_activity_log').insert([{
            user_email: currentUserEmail,
            action_type: actionType,
            action_text: text,
            module: text.includes('Client') ? 'clients' : text.includes('Vault') ? 'vault' : text.includes('DSC') ? 'dsc' : 'records'
        }]);
        if (currentUserProfile) {
            const field = actionType === 'Added' ? 'total_added' : actionType === 'Updated' ? 'total_updated' : actionType === 'Deleted' ? 'total_deleted' : null;
            if (field) {
                await supabaseClient.from('witcorp_user_profiles')
                    .update({ [field]: (currentUserProfile[field] || 0) + 1 })
                    .eq('email', currentUserEmail);
                currentUserProfile[field] = (currentUserProfile[field] || 0) + 1;
            }
        }
    } catch (err) {
        console.error('saveActivity DB error, falling back:', err);
        try {
            let activity = JSON.parse(localStorage.getItem("myActivity") || "[]");
            activity.unshift({ text, time: new Date().toLocaleString('en-IN') });
            if (activity.length > 50) activity = activity.slice(0, 50);
            localStorage.setItem("myActivity", JSON.stringify(activity));
        } catch (e) {}
    }
}

// ============================================================
// THEME — DB Based
// ============================================================
function changeTheme(theme) {
    const body = document.body;
    ['theme-ocean', 'theme-dark', 'theme-green', 'theme-purple', 'theme-light'].forEach(t => body.classList.remove(t));
    body.classList.add(theme);
    localStorage.setItem('bgTheme', theme);
    if (currentUserProfile) updateUserProfile({ bg_theme: theme }, false);
}

function changeSidebarTheme(theme) {
    const sidebar = document.getElementById('sidebar');
    const mobileSidebar = document.getElementById('mobileSidebar');
    const sidebarThemes = [
        'sidebar-theme-raspberry', 'sidebar-theme-mint', 'sidebar-theme-chill',
        'sidebar-theme-forest', 'sidebar-theme-damini', 'sidebar-theme-seaglass',
        'sidebar-theme-lemon', 'sidebar-theme-dark', 'sidebar-theme-navypro', 'sidebar-theme-original'
    ];
    sidebarThemes.forEach(t => { sidebar?.classList.remove(t); mobileSidebar?.classList.remove(t); });
    sidebar?.classList.add(theme);
    mobileSidebar?.classList.add(theme);
    localStorage.setItem('sidebarTheme', theme);
    if (currentUserProfile) updateUserProfile({ sidebar_theme: theme }, false);
}

// ============================================================
// AUDIT TRAIL
// ============================================================
async function saveAuditTrail(tableName, recordId, action, oldData, newData) {
    try {
        const changedFields = [];
        if (action === 'UPDATE' && oldData && newData) {
            Object.keys(newData).forEach(key => { if (oldData[key] !== newData[key]) changedFields.push(key); });
        }
        await supabaseClient.from('witcorp_audit_trail').insert([{
            table_name: tableName,
            record_id: String(recordId),
            action, changed_by: currentUserEmail,
            old_data: oldData || null,
            new_data: newData || null,
            changed_fields: changedFields
        }]);
    } catch (err) { console.error('saveAuditTrail error:', err); }
}

async function openAuditModal(recordId) {
    try {
        const { data } = await supabaseClient
            .from('witcorp_audit_trail').select('*')
            .eq('record_id', String(recordId))
            .order('created_at', { ascending: false }).limit(20);
        const modal = document.getElementById('auditModal');
        const list = document.getElementById('auditList');
        const title = document.getElementById('auditModalTitle');
        if (!modal || !list) return;
        if (title) title.innerText = `Change History — Record #${recordId}`;
        if (!data || data.length === 0) {
            list.innerHTML = `<div class="text-center text-slate-400 py-10 font-semibold text-sm">No history found</div>`;
        } else {
            list.innerHTML = data.map(entry => {
                const actionColors = { INSERT: 'text-emerald-600 bg-emerald-50', UPDATE: 'text-blue-600 bg-blue-50', DELETE: 'text-red-600 bg-red-50' };
                const color = actionColors[entry.action] || 'text-slate-600 bg-slate-50';
                const fields = entry.changed_fields?.length > 0
                    ? `<div class="text-xs text-slate-500 mt-1">Changed: <span class="font-bold text-slate-700">${entry.changed_fields.join(', ')}</span></div>` : '';
                return `
                    <div class="p-4 border-b border-slate-100 last:border-0">
                        <div class="flex items-center gap-3">
                            <span class="px-2 py-0.5 rounded-lg text-xs font-black ${color}">${entry.action}</span>
                            <span class="text-sm font-bold text-slate-700">${entry.changed_by}</span>
                            <span class="text-xs text-slate-400 ml-auto">${new Date(entry.created_at).toLocaleString('en-IN')}</span>
                        </div>
                        ${fields}
                    </div>`;
            }).join('');
        }
        modal.classList.remove('hidden');
    } catch (err) { console.error('openAuditModal error:', err); }
}

function closeAuditModal() { document.getElementById('auditModal')?.classList.add('hidden'); }

// ============================================================
// RECORD COMMENTS
// ============================================================
let activeCommentRecordId = null;

async function openCommentsModal(recordId, clientName) {
    activeCommentRecordId = recordId;
    const modal = document.getElementById('commentsModal');
    const title = document.getElementById('commentsModalTitle');
    if (!modal) return;
    if (title) title.innerText = `Comments — ${clientName}`;
    modal.classList.remove('hidden');
    await loadComments(recordId);
}

function closeCommentsModal() { document.getElementById('commentsModal')?.classList.add('hidden'); activeCommentRecordId = null; }

async function loadComments(recordId) {
    try {
        const { data } = await supabaseClient
            .from('witcorp_comments').select('*')
            .eq('record_id', recordId).order('created_at', { ascending: true });
        const list = document.getElementById('commentsList');
        if (!list) return;
        if (!data || data.length === 0) {
            list.innerHTML = `<div class="text-center text-slate-400 py-8 text-sm font-semibold"><i class="fas fa-comments text-3xl block mb-2 opacity-30"></i>No comments yet</div>`;
            return;
        }
        list.innerHTML = data.map(c => {
            const isMe = c.commented_by === currentUserEmail;
            return `
                <div class="flex gap-3 ${isMe ? 'flex-row-reverse' : ''}">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                        style="background: ${currentUserProfile?.avatar_color || '#3b82f6'}">
                        ${c.commented_by.charAt(0).toUpperCase()}
                    </div>
                    <div class="max-w-[75%]">
                        <div class="text-xs font-bold text-slate-500 mb-1 ${isMe ? 'text-right' : ''}">${isMe ? 'You' : c.commented_by.split('@')[0]}</div>
                        <div class="px-4 py-2.5 rounded-2xl text-sm font-medium ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}">
                            ${c.comment_text}
                        </div>
                        <div class="text-[10px] text-slate-400 mt-1 ${isMe ? 'text-right' : ''}">
                            ${new Date(c.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                            ${c.is_edited ? ' · edited' : ''}
                        </div>
                    </div>
                </div>`;
        }).join('');
        list.scrollTop = list.scrollHeight;
    } catch (err) { console.error('loadComments error:', err); }
}

async function postComment() {
    if (!activeCommentRecordId) return;
    const input = document.getElementById('commentInput');
    const text = input?.value.trim();
    if (!text) return;
    const btn = document.getElementById('postCommentBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    try {
        const { error } = await supabaseClient.from('witcorp_comments').insert([{
            record_id: activeCommentRecordId,
            comment_text: text,
            commented_by: currentUserEmail
        }]);
        if (!error) { input.value = ''; await loadComments(activeCommentRecordId); }
        else { showToast('Comment post failed', 'error'); }
    } catch (err) { console.error('postComment error:', err); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i>'; } }
}

// ============================================================
// SUB-TASKS / CHECKLIST
// ============================================================
let activeSubtaskRecordId = null;

async function openSubtasksModal(recordId, clientName) {
    activeSubtaskRecordId = recordId;
    const modal = document.getElementById('subtasksModal');
    const title = document.getElementById('subtasksModalTitle');
    if (!modal) return;
    if (title) title.innerText = `Checklist — ${clientName}`;
    modal.classList.remove('hidden');
    await loadSubtasks(recordId);
}

function closeSubtasksModal() { document.getElementById('subtasksModal')?.classList.add('hidden'); activeSubtaskRecordId = null; }

async function loadSubtasks(recordId) {
    try {
        const { data } = await supabaseClient
            .from('witcorp_subtasks').select('*')
            .eq('record_id', recordId).order('sort_order', { ascending: true });
        const list = document.getElementById('subtasksList');
        if (!list) return;
        if (!data || data.length === 0) {
            list.innerHTML = `<div class="text-center text-slate-400 py-6 text-sm font-semibold"><i class="fas fa-list-check text-3xl block mb-2 opacity-30"></i>No tasks added yet</div>`;
            return;
        }
        const done = data.filter(t => t.is_done).length;
        const pct = Math.round((done / data.length) * 100);
        list.innerHTML = `
            <div class="mb-4">
                <div class="flex justify-between text-xs font-bold text-slate-600 mb-1">
                    <span>${done}/${data.length} completed</span><span>${pct}%</span>
                </div>
                <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-500 rounded-full transition-all" style="width:${pct}%"></div>
                </div>
            </div>
            ${data.map(task => `
                <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 group transition-all" id="task_${task.id}">
                    <input type="checkbox" class="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                        ${task.is_done ? 'checked' : ''} onchange="toggleSubtask(${task.id}, this.checked)">
                    <span class="flex-1 text-sm font-medium ${task.is_done ? 'line-through text-slate-400' : 'text-slate-700'}">${task.task_text}</span>
                    ${task.is_done ? `<span class="text-[10px] text-emerald-600 font-bold">${task.done_by?.split('@')[0] || ''}</span>` : ''}
                    <button onclick="deleteSubtask(${task.id})" class="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 transition-all text-xs">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>`).join('')}`;
    } catch (err) { console.error('loadSubtasks error:', err); }
}

async function addSubtask() {
    if (!activeSubtaskRecordId) return;
    const input = document.getElementById('subtaskInput');
    const text = input?.value.trim();
    if (!text) return;
    try {
        const { error } = await supabaseClient.from('witcorp_subtasks').insert([{
            record_id: activeSubtaskRecordId, task_text: text, created_by: currentUserEmail
        }]);
        if (!error) { input.value = ''; await loadSubtasks(activeSubtaskRecordId); }
    } catch (err) { console.error('addSubtask error:', err); }
}

async function toggleSubtask(id, isDone) {
    try {
        await supabaseClient.from('witcorp_subtasks')
            .update({ is_done: isDone, done_by: isDone ? currentUserEmail : '', done_at: isDone ? new Date().toISOString() : null })
            .eq('id', id);
        await loadSubtasks(activeSubtaskRecordId);
    } catch (err) { console.error('toggleSubtask error:', err); }
}

async function deleteSubtask(id) {
    try {
        await supabaseClient.from('witcorp_subtasks').delete().eq('id', id);
        await loadSubtasks(activeSubtaskRecordId);
    } catch (err) { console.error('deleteSubtask error:', err); }
}

// ============================================================
// PIN / STAR RECORDS
// ============================================================
async function togglePin(recordId) {
    try {
        const isPinned = await checkIfPinned(recordId);
        if (isPinned) {
            await supabaseClient.from('witcorp_pins').delete().eq('record_id', recordId).eq('pinned_by', currentUserEmail);
            showToast('Record unpinned', 'info', 2000);
        } else {
            await supabaseClient.from('witcorp_pins').insert([{ record_id: recordId, pinned_by: currentUserEmail }]);
            showToast('Record pinned!', 'success', 2000);
        }
        updatePinButton(recordId, !isPinned);
    } catch (err) { console.error('togglePin error:', err); }
}

async function checkIfPinned(recordId) {
    try {
        const { data } = await supabaseClient.from('witcorp_pins').select('id')
            .eq('record_id', recordId).eq('pinned_by', currentUserEmail).single();
        return !!data;
    } catch { return false; }
}

function updatePinButton(recordId, isPinned) {
    const btn = document.getElementById(`pin_${recordId}`);
    if (btn) {
        btn.innerHTML = `<i class="fas fa-thumbtack ${isPinned ? 'text-amber-500' : 'text-slate-400'}"></i>`;
        btn.title = isPinned ? 'Unpin' : 'Pin this record';
    }
}

async function showPinnedRecords() {
    try {
        const { data: pins } = await supabaseClient.from('witcorp_pins').select('record_id').eq('pinned_by', currentUserEmail);
        if (!pins || pins.length === 0) { showToast('No pinned records yet', 'info'); return; }
        const pinnedIds = pins.map(p => p.record_id);
        const pinned = allRecords.filter(r => pinnedIds.includes(r.id));
        showSection('filterView');
        document.getElementById('filterTitle').innerText = `⭐ Pinned Records (${pinned.length})`;
        renderTable(pinned, 'filterTableBody');
    } catch (err) { console.error('showPinnedRecords error:', err); }
}

// ============================================================
// ONLINE PRESENCE
// ============================================================
async function updatePresence(section = 'dashboard') {
    if (!currentUserEmail) return;
    try {
        await supabaseClient.from('witcorp_presence').upsert({
            user_email: currentUserEmail,
            user_initial: currentUserEmail.charAt(0).toUpperCase(),
            avatar_color: currentUserProfile?.avatar_color || '#3b82f6',
            last_seen: new Date().toISOString(),
            current_section: section,
            is_online: true
        }, { onConflict: 'user_email' });
    } catch (err) { console.error('updatePresence error:', err); }
}

async function loadOnlineUsers() {
    try {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data } = await supabaseClient.from('witcorp_presence').select('*').gte('last_seen', fiveMinAgo);
        const container = document.getElementById('onlineUsersBar');
        if (!container || !data) return;
        container.innerHTML = data.map(u => `
            <div class="relative group cursor-default">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black ring-2 ring-white"
                    style="background: ${u.avatar_color}">${u.user_initial}</div>
                <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full"></span>
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                    ${u.user_email.split('@')[0]}
                    <div class="text-[9px] opacity-60">${u.current_section}</div>
                </div>
            </div>`).join('');
    } catch (err) { console.error('loadOnlineUsers error:', err); }
}

// ============================================================
// SESSION TIMEOUT (15 min inactivity)
// ============================================================
let sessionTimer;
let warningTimer;
const SESSION_TIMEOUT = 15 * 60 * 1000;
const WARNING_TIME = 2 * 60 * 1000;

function resetSessionTimer() {
    clearTimeout(sessionTimer);
    clearTimeout(warningTimer);
    warningTimer = setTimeout(() => {
        showToast('Session expiring in 2 minutes due to inactivity', 'warning', 8000);
    }, SESSION_TIMEOUT - WARNING_TIME);
    sessionTimer = setTimeout(() => {
        showToast('Session expired. Logging out...', 'warning');
        setTimeout(logout, 2000);
    }, SESSION_TIMEOUT);
}

['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetSessionTimer, { passive: true });
});

// ============================================================
// ANNOUNCEMENTS
// ============================================================
async function loadAnnouncements() {
    try {
        const now = new Date().toISOString();
        const { data } = await supabaseClient
            .from('witcorp_announcements').select('*')
            .eq('is_active', true)
            .or(`expires_at.is.null,expires_at.gte.${now}`)
            .order('created_at', { ascending: false }).limit(1);
        const banner = document.getElementById('announcementBanner');
        const text = document.getElementById('announcementText');
        if (!banner || !text || !data || data.length === 0) return;
        const a = data[0];
        const bgColors = { info: 'bg-blue-600', warning: 'bg-amber-500', success: 'bg-emerald-600', urgent: 'bg-red-600' };
        banner.className = `${bgColors[a.type] || bgColors.info} text-white px-4 py-2 flex items-center justify-between text-sm font-semibold`;
        text.innerText = `📢 ${a.title}: ${a.message}`;
        banner.classList.remove('hidden');
    } catch (err) { console.error('loadAnnouncements error:', err); }
}

// ============================================================
// QUICK ADD MODAL (Ctrl+N)
// ============================================================
function openQuickAdd() {
    if (!currentUserEmail) return;
    document.getElementById('quickAddModal')?.classList.remove('hidden');
    document.getElementById('qaClientName')?.focus();
}

function closeQuickAdd() { document.getElementById('quickAddModal')?.classList.add('hidden'); }

async function submitQuickAdd() {
    const clientName = document.getElementById('qaClientName')?.value.trim();
    const category = document.getElementById('qaCategory')?.value;
    const status = document.getElementById('qaStatus')?.value;
    if (!clientName || !category) { showToast('Client name & category required', 'error'); return; }
    try {
        const { error } = await supabaseClient.from('witcorp_records').insert([{
            client_name: clientName,
            service_category: category,
            service_detail: document.getElementById('qaServiceDetail')?.value.trim() || '',
            assigned_staff: document.getElementById('qaStaff')?.value.trim() || '',
            status: status || 'Pending',
            deadline: document.getElementById('qaDeadline')?.value || null,
            updated_at: new Date().toISOString(),
            updated_by: currentUserName
        }]);
        if (!error) {
            saveActivity(`Added Record: ${clientName} | ${category}`);
            showToast(`Quick added: ${clientName}`, 'success');
            closeQuickAdd();
            ['qaClientName', 'qaServiceDetail', 'qaStaff', 'qaDeadline'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            await fetchRecords(true);
        } else { showToast('Quick add failed', 'error'); }
    } catch (err) { console.error('submitQuickAdd error:', err); }
}

// ============================================================
// COLUMN VISIBILITY
// ============================================================
const defaultColumns = {
    checkbox: true, client: true, updated: true, service: true,
    category: true, staff: true, allotedby: true, deadline: true,
    status: true, remarks: true, updatedby: true, actions: true
};
let columnVisibility = { ...defaultColumns };

function loadColumnPrefs() {
    try {
        const saved = localStorage.getItem('colVis');
        if (saved) columnVisibility = { ...defaultColumns, ...JSON.parse(saved) };
    } catch {}
    applyColumnVisibility();
}

function applyColumnVisibility() {
    const colMap = {
        checkbox: 0, client: 1, updated: 2, service: 3, category: 4,
        staff: 5, allotedby: 6, deadline: 7, status: 8, remarks: 9, updatedby: 10, actions: 11
    };
    Object.entries(colMap).forEach(([key, idx]) => {
        const display = columnVisibility[key] !== false ? '' : 'none';
        document.querySelectorAll(`#mainTableBody tr td:nth-child(${idx + 1})`).forEach(td => td.style.display = display);
        document.querySelectorAll(`#mainTable thead th:nth-child(${idx + 1})`).forEach(th => th.style.display = display);
    });
}

function toggleColumn(colKey) {
    columnVisibility[colKey] = !columnVisibility[colKey];
    localStorage.setItem('colVis', JSON.stringify(columnVisibility));
    applyColumnVisibility();
}

function resetColumns() {
    columnVisibility = { ...defaultColumns };
    localStorage.setItem('colVis', JSON.stringify(columnVisibility));
    document.querySelectorAll('.col-toggle-cb').forEach(cb => cb.checked = true);
    applyColumnVisibility();
}
// PUSH NOTIFICATION SUBSCRIBE
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!('PushManager' in window)) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const subscription = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    await supabaseClient.from('witcorp_push_subscriptions').upsert({
      user_email: currentUserEmail,
      subscription: JSON.stringify(subscription),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_email' });
  } catch (err) {
    console.error('Push subscribe error:', err);
  }
}

// ============================================================
// SHOWAPP — FIX 2 & FIX 8
// ============================================================
function showApp(user) {
    document.getElementById('authScreen').style.display = 'none';
    const appScreen = document.getElementById('appScreen');
    appScreen.classList.remove('hidden');
    // FIX 2: Use flex-col class explicitly — matches HTML structure
    appScreen.style.display = 'flex';
    appScreen.style.flexDirection = 'column';

    currentUserEmail = user.email;
    currentUserName = user.email;
    const gmailEl = document.getElementById('userGmail');
    if (gmailEl) gmailEl.innerText = user.email;
    const p1 = document.getElementById("profileInitial");
    const p2 = document.getElementById("profileInitial2");
    if (p1) p1.innerText = user.email.charAt(0).toUpperCase();
    if (p2) p2.innerText = user.email.charAt(0).toUpperCase();

    loadUserProfile(user.email);
    loadAnnouncements();
    loadOnlineUsers();
    resetSessionTimer();
    updatePresence('dashboard');
    loadColumnPrefs();
    showSection('dashboard');

    // FIX 8: Clear existing intervals before creating new ones
    if (_onlineUsersInterval) clearInterval(_onlineUsersInterval);
    if (_presenceInterval) clearInterval(_presenceInterval);
    _onlineUsersInterval = setInterval(loadOnlineUsers, 30000);
    _presenceInterval = setInterval(() => updatePresence(), 60000);

    saveActivity('Login: ' + user.email);
    subscribeToPush(); // Push notification subscribe
    showToast(`Welcome back, ${user.email.split('@')[0]}!`, 'success');
}

// ============================================================
// SINGLE window.addEventListener('load')
// ============================================================
window.addEventListener('load', async () => {
    const savedBg = localStorage.getItem('bgTheme');
    if (savedBg) changeTheme(savedBg);
    const savedSidebar = localStorage.getItem('sidebarTheme');
    if (savedSidebar) changeSidebarTheme(savedSidebar);
    loadNotificationSetting();
    setTimeout(applyGreenHeaders, 400);
    fetchNotifications();

    // Password reset flow
    const hash = window.location.hash;
    if (hash.includes("access_token") && hash.includes("type=recovery")) {
        const newPassword = prompt("Enter New Password");
        if (!newPassword) return;
        try {
            const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
            if (error) { showToast(error.message, 'error'); }
            else { showToast("Password updated successfully!", 'success'); window.location.href = window.location.pathname; }
        } catch (err) { console.error("Password update error:", err); showToast("Password update failed. Please try again.", 'error'); }
    }
});
// ============================================================
// TEAM CHAT SYSTEM
// ============================================================
let chatOpen = false;
let chatSubscription = null;

function toggleChat() {
    const panel = document.getElementById('chatPanel');
    if (!panel) return;
    chatOpen = !chatOpen;
    if (chatOpen) {
        panel.classList.remove('hidden');
        loadChats();
        subscribeChatRealtime();
        document.getElementById('chatInput')?.focus();
    } else {
        panel.classList.add('hidden');
        if (chatSubscription) {
            supabaseClient.removeChannel(chatSubscription);
            chatSubscription = null;
        }
    }
}

async function loadChats() {
    try {
        const { data, error } = await supabaseClient
            .from('witcorp_chats')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(100);
        if (error) return;
        renderChats(data || []);
    } catch (err) {
        console.error('loadChats error:', err);
    }
}

function renderChats(messages) {
    const list = document.getElementById('chatList');
    if (!list) return;

    if (messages.length === 0) {
        list.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                <i class="fas fa-comments text-4xl text-slate-300"></i>
                <p class="text-sm font-bold text-slate-400">Koi message nahi abhi tak</p>
                <p class="text-xs text-slate-300">Pehla message bhejo!</p>
            </div>`;
        return;
    }

    let html = '';
    let lastDate = '';

    messages.forEach(msg => {
        const isMe = msg.sent_by === currentUserEmail;
        const msgDate = new Date(msg.created_at).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });

        // Date separator
        if (msgDate !== lastDate) {
            lastDate = msgDate;
            html += `
                <div class="flex items-center gap-3 my-4">
                    <div class="flex-1 h-px bg-slate-200"></div>
                    <span class="text-[10px] font-black text-slate-400 bg-white px-3 py-1 rounded-full border">${msgDate}</span>
                    <div class="flex-1 h-px bg-slate-200"></div>
                </div>`;
        }

        const time = new Date(msg.created_at).toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        const recordTag = msg.record_ref
            ? `<div class="mt-1.5 px-2 py-1 bg-white/20 rounded-lg text-[10px] font-bold flex items-center gap-1">
                <i class="fas fa-link text-[9px]"></i> ${msg.record_ref}
               </div>`
            : '';

        if (isMe) {
            html += `
                <div class="flex justify-end gap-2 mb-3 group">
                    <div class="max-w-[75%]">
                        <div class="text-[10px] font-bold text-slate-400 text-right mb-1">Tum</div>
                        <div class="bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
                            <p class="text-sm font-medium break-words whitespace-pre-wrap">${escapeHtml(msg.message)}</p>

                            ${recordTag}
                        </div>
                        <div class="text-[10px] text-slate-400 text-right mt-1">${time}</div>
                    </div>
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-5"
                        style="background:${msg.avatar_color || '#3b82f6'}">
                        ${msg.sent_by_initial || '?'}
                    </div>
                </div>`;
        } else {
            html += `
                <div class="flex gap-2 mb-3 group">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-5"
                        style="background:${msg.avatar_color || '#6366f1'}">
                        ${msg.sent_by_initial || '?'}
                    </div>
                    <div class="max-w-[75%]">
                        <div class="text-[10px] font-bold text-slate-500 mb-1">${msg.sent_by.split('@')[0]}</div>
                        <div class="bg-white border border-slate-200 text-slate-800 px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm">
                            <p class="text-sm font-medium text-slate-800 break-words whitespace-pre-wrap">${escapeHtml(msg.message)}</p>
                            ${recordTag}
                        </div>
                        <div class="text-[10px] text-slate-400 mt-1">${time}</div>
                    </div>
                </div>`;
        }
    });

    list.innerHTML = html;
    list.scrollTop = list.scrollHeight;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function sendChat() {
    const input = document.getElementById('chatInput');
    const message = input?.value.trim();
    if (!message || !currentUserEmail) return;

    const btn = document.getElementById('sendChatBtn');
    if (btn) btn.disabled = true;

    try {
        const { error } = await supabaseClient.from('witcorp_chats').insert([{
            message,
            sent_by: currentUserEmail,
            sent_by_initial: currentUserEmail.charAt(0).toUpperCase(),
            avatar_color: currentUserProfile?.avatar_color || '#3b82f6'
        }]);
        if (!error) {
            input.value = '';
          await loadChats();
        } else {
            showToast('Message send nahi hua', 'error');
        }
    } catch (err) {
        console.error('sendChat error:', err);
    } finally {
        if (btn) btn.disabled = false;
        input?.focus();
    }
}

function subscribeChatRealtime() {
    if (chatSubscription) return;
    chatSubscription = supabaseClient
        .channel('team-chat')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'witcorp_chats'
        }, (payload) => {
            appendChatMessage(payload.new);
        })
        .subscribe();
}

function appendChatMessage(msg) {
    const list = document.getElementById('chatList');
    if (!list) return;

    if (list.querySelector('.fa-comments')) {
        list.innerHTML = '';
    }

    const isMe = msg.sent_by === currentUserEmail;
    const time = new Date(msg.created_at).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true
    });

    const div = document.createElement('div');
    div.className = `flex ${isMe ? 'justify-end' : ''} gap-2 mb-3`;
    div.setAttribute('data-msg-id', msg.id);
    div.dataset.msgId = msg.id;

    if (isMe) {
        div.innerHTML = `
            <div class="max-w-[75%]">
                <div class="text-[10px] font-bold text-slate-400 text-right mb-1">Tum</div>
                <div class="bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm group relative">
                    <p class="text-sm font-medium break-words whitespace-pre-wrap">${escapeHtml(msg.message)}</p>
                   <div class="flex gap-1 justify-end mt-1.5">
    <button onclick="editChatMsg(${msg.id}, this)" 
        style="background:#e0e7ff;border:none;cursor:pointer;width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#3b82f6;font-size:11px;">
        <i class="fas fa-pencil"></i>
    </button>
    <button onclick="deleteChatMsg(${msg.id})"
        style="background:#fee2e2;border:none;cursor:pointer;width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#ef4444;font-size:11px;">
        <i class="fas fa-trash"></i>
    </button>
</div>
                </div>
                <div class="text-[10px] text-slate-400 text-right mt-1" id="msgtime_${msg.id}">${time}</div>
            </div>
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-5"
                style="background:${msg.avatar_color || '#3b82f6'}">
                ${msg.sent_by_initial || '?'}
            </div>`;
    } else {
        div.innerHTML = `
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-5"
                style="background:${msg.avatar_color || '#6366f1'}">
                ${msg.sent_by_initial || '?'}
            </div>
            <div class="max-w-[75%]">
                <div class="text-[10px] font-bold text-slate-500 mb-1">${msg.sent_by.split('@')[0]}</div>
                <div class="bg-white border border-slate-200 px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm">
                    <p class="text-sm font-medium text-slate-800 break-words whitespace-pre-wrap">${escapeHtml(msg.message)}</p>
                </div>
                <div class="text-[10px] text-slate-400 mt-1">${time}</div>
            </div>`;

        if (document.hidden || !chatOpen) {
            showToast(`💬 ${msg.sent_by.split('@')[0]}: ${msg.message.substring(0, 40)}`, 'info', 4000);
        }
    }

    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
}
async function deleteChatMsg(id) {
    if (!confirm('Message delete karna hai?')) return;
    try {
        const { error } = await supabaseClient
            .from('witcorp_chats').delete().eq('id', id);
        if (!error) {
            const el = document.querySelector(`[data-msg-id="${id}"]`);
            if (el) el.remove();
            showToast('Message delete ho gaya', 'warning', 2000);
        } else {
            showToast('Delete fail hua', 'error');
        }
    } catch (err) {
        console.error('deleteChatMsg error:', err);
    }
}

async function editChatMsg(id, btn) {
    const msgDiv = btn.closest('[data-msg-id]');
    const pEl = msgDiv?.querySelector('p');
    if (!pEl) return;

    const oldText = pEl.textContent;
    const newText = prompt('Message edit karo:', oldText);
    if (!newText || newText.trim() === oldText.trim()) return;

    try {
        const { error } = await supabaseClient
            .from('witcorp_chats')
            .update({ message: newText.trim(), is_edited: true })
            .eq('id', id);
        if (!error) {
            pEl.textContent = newText.trim();
            const timeEl = document.getElementById(`msgtime_${id}`);
            if (timeEl) timeEl.innerHTML += ' · <span class="italic">edited</span>';
            showToast('Message update ho gaya', 'success', 2000);
        } else {
            showToast('Edit fail hua', 'error');
        }
    } catch (err) {
        console.error('editChatMsg error:', err);
    }
}
