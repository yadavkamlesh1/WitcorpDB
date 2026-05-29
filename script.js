const SB_URL = 'https://yznyimxtlamdzotfgajz.supabase.co';
const SB_KEY = 'sb_publishable_6I-WD5gRpeqgR_JIecUSsw_1yaux_3y';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

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

function showToast(message, type = 'success', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const colors = { success: 'bg-emerald-600', error: 'bg-red-600', warning: 'bg-amber-500', info: 'bg-blue-600' };
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl text-white font-bold text-sm shadow-2xl transform translate-x-full transition-all duration-300 ${colors[type] || colors.info}`;
    toast.style.maxWidth = '360px';
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info} text-lg flex-shrink-0"></i>
        <span class="flex-1">${message}</span>
        <button class="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>`;
    toast.querySelector('button').onclick = () => removeToast(toast);
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.remove('translate-x-full')));
    setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
}

function updateLastSync() {
    const badge = document.getElementById('lastSyncBadge');
    const text = document.getElementById('lastSyncText');
    if (!badge || !text) return;
    badge.classList.remove('hidden');
    const now = new Date();
    text.innerText = 'Synced ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function updateBreadcrumb(section) {
    const map = { dashboard: 'Dashboard', clientManagement: 'Dashboard → Client Directory', vaultManagement: 'Dashboard → Credential Vault', dscManagement: 'Dashboard → DSC Status', filterView: 'Dashboard → Filter View' };
    const el = document.getElementById('breadcrumbText');
    if (el) el.innerText = map[section] || 'Dashboard';
}

function markFormDirty() { isFormDirty = true; }
function clearDirtyState() { isFormDirty = false; }

function checkDeadlineAlerts(data) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 2);
    const urgent = data.filter(r => { if (!r.deadline || r.status === 'Completed') return false; const d = new Date(r.deadline); d.setHours(0,0,0,0); return d >= today && d < dayAfter; });
    const overdue = data.filter(r => { if (!r.deadline || r.status === 'Completed') return false; const d = new Date(r.deadline); d.setHours(0,0,0,0); return d < today; });
    const banner = document.getElementById('deadlineAlertBanner');
    const text = document.getElementById('deadlineAlertText');
    if (!banner || !text) return;
    const parts = [];
    if (overdue.length > 0) parts.push(`${overdue.length} overdue record${overdue.length > 1 ? 's' : ''}`);
    if (urgent.length > 0) parts.push(`${urgent.length} due today/tomorrow`);
    if (parts.length > 0) { text.innerText = parts.join(' · ') + ' — action required.'; banner.classList.remove('hidden'); }
    else { banner.classList.add('hidden'); }
}

async function fetchRecords(reset = true) {
    if (isFetchingRecords) return;
    isFetchingRecords = true;
    const skeleton = document.getElementById('tableSkeleton');
    const wrapper = document.getElementById('mainTableWrapper');
    if (reset && skeleton && wrapper) { skeleton.style.display = 'block'; wrapper.style.display = 'none'; }
    try {
        if (reset) { recordPage = 0; allRecords = []; }
        const from = recordPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabaseClient.from('witcorp_records').select('*').order('updated_at', { ascending: false }).range(from, to);
        if (!error && data) {
            const uniqueData = data.filter(n => !allRecords.some(o => o.id === n.id));
            allRecords = [...allRecords, ...uniqueData];
            renderTable(allRecords, 'mainTableBody');
            updateStats(allRecords);
            setupPredictions();
            checkDeadlineAlerts(allRecords);
            updateLastSync();
            recordPage++;
            const btn = document.getElementById("loadMoreBtn");
            if (btn) btn.style.display = data.length < PAGE_SIZE ? "none" : "block";
            const badge = document.getElementById('recordCountBadge');
            if (badge) badge.innerText = `${allRecords.length} records`;
        }
    } catch (err) {
        console.error("fetchRecords error:", err);
        showToast('Failed to fetch records. Check connection.', 'error');
    } finally {
        isFetchingRecords = false;
        if (skeleton && wrapper) { skeleton.style.display = 'none'; wrapper.style.display = 'block'; }
    }
}

function sortTable(field) {
    if (sortField === field) { sortAsc = !sortAsc; } else { sortField = field; sortAsc = true; }
    document.querySelectorAll('[id^="sort_"]').forEach(el => { el.className = 'fas fa-sort ml-1 opacity-40'; });
    const icon = document.getElementById('sort_' + field);
    if (icon) icon.className = `fas fa-sort-${sortAsc ? 'up' : 'down'} ml-1 text-blue-500`;
    const sorted = [...allRecords].sort((a, b) => {
        let av = a[field] || '', bv = b[field] || '';
        if (field === 'updated_at' || field === 'deadline') { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
        else { av = av.toString().toLowerCase(); bv = bv.toString().toLowerCase(); }
        if (av < bv) return sortAsc ? -1 : 1;
        if (av > bv) return sortAsc ? 1 : -1;
        return 0;
    });
    renderTable(sorted, 'mainTableBody');
}

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
    const s = document.getElementById('filterStatus'); const c = document.getElementById('filterCategory');
    if (s) s.value = ''; if (c) c.value = '';
    renderTable(allRecords, 'mainTableBody');
    updateStats(allRecords);
    const badge = document.getElementById('recordCountBadge');
    if (badge) badge.innerText = `${allRecords.length} records`;
}

function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => { cb.checked = checkbox.checked; const id = parseInt(cb.dataset.id); if (checkbox.checked) { selectedRowIds.add(id); } else { selectedRowIds.delete(id); } });
    updateBulkBar();
}

function toggleRowSelect(id, checked) {
    if (checked) { selectedRowIds.add(id); } else { selectedRowIds.delete(id); }
    updateBulkBar();
    const allCbs = document.querySelectorAll('.row-checkbox');
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) { selectAllCb.checked = allCbs.length > 0 && [...allCbs].every(cb => cb.checked); selectAllCb.indeterminate = selectedRowIds.size > 0 && selectedRowIds.size < allCbs.length; }
}

function updateBulkBar() {
    const bar = document.getElementById('bulkActionBar'); const count = document.getElementById('bulkSelectedCount');
    if (!bar || !count) return;
    if (selectedRowIds.size > 0) { bar.classList.remove('hidden'); count.innerText = `${selectedRowIds.size} selected`; }
    else { bar.classList.add('hidden'); }
}

function clearBulkSelection() {
    selectedRowIds.clear();
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
    updateBulkBar();
}

async function applyBulkStatus() {
    if (selectedRowIds.size === 0) return;
    const newStatus = document.getElementById('bulkStatusSelect')?.value;
    if (!newStatus) return;
    const ids = [...selectedRowIds];
    const previousStatuses = ids.map(id => { const rec = allRecords.find(r => r.id === id); return { id, status: rec?.status || 'Pending', updated_at: rec?.updated_at || new Date().toISOString(), updated_by: rec?.updated_by || '' }; });
    const { error } = await supabaseClient.from('witcorp_records').update({ status: newStatus, updated_at: new Date().toISOString(), updated_by: currentUserName }).in('id', ids);
    if (!error) {
        saveActivity(`Bulk Update: ${ids.length} records → ${newStatus}`);
        clearBulkSelection();
        await fetchRecords(true);
        showUndoToast(`${ids.length} record${ids.length > 1 ? 's' : ''} marked as ${newStatus}`, previousStatuses, 120000);
    } else { showToast('Bulk update failed. Check connection.', 'error'); }
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
            <div style="font-size:11px;opacity:0.6;font-weight:400;margin-top:2px;">Undo available for <span id="undoSecs">${secondsLeft}s</span></div>
        </div>
        <button id="undoActionBtn" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:8px;padding:5px 14px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;white-space:nowrap;flex-shrink:0;">↩ Undo</button>
        <button id="undoCloseBtn" style="opacity:0.6;font-size:18px;background:none;border:none;color:#fff;cursor:pointer;padding:0;margin-left:4px;">&times;</button>`;
    toast.querySelector('#undoCloseBtn').onclick = () => { clearInterval(ticker); removeToast(toast); };
    toast.querySelector('#undoActionBtn').onclick = async () => { clearInterval(ticker); removeToast(toast); await undoBulkStatus(previousStatuses); };
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.remove('translate-x-full')));
    const ticker = setInterval(() => {
        secondsLeft--;
        const el = document.getElementById('undoSecs');
        if (el) { if (secondsLeft >= 60) { const m = Math.floor(secondsLeft / 60); const s = secondsLeft % 60; el.textContent = `${m}m ${s < 10 ? '0' + s : s}s`; } else { el.textContent = `${secondsLeft}s`; } }
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
    if (!anyError) { saveActivity(`Undo Bulk Update: ${previousStatuses.length} records restored`); showToast(`${previousStatuses.length} record${previousStatuses.length > 1 ? 's' : ''} fully restored`, 'info'); await fetchRecords(true); }
    else { showToast('Undo partially failed. Check connection.', 'error'); }
}

let _rmkCounter = 0;

function renderTable(data, targetId) {
    currentExportData = data;
    currentExportType = "records";
    const tbody = document.getElementById(targetId);
    if (!tbody) return;
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="p-16 text-center"><div class="flex flex-col items-center gap-4"><div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center"><i class="fas fa-folder-open text-3xl text-slate-300"></i></div><p class="font-black text-slate-400 text-sm uppercase tracking-wider">No records found</p><p class="text-xs text-slate-300">Try adjusting your filters or add a new record above</p></div></td></tr>`;
        return;
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    tbody.innerHTML = '';
    data.forEach(row => {
        const statusClass = { 'Completed': 'st-completed', 'Pending': 'st-pending', 'Processing': 'st-processing' }[row.status] || 'bg-slate-100';
        const statusIcon = { 'Completed': 'fa-circle-check', 'Pending': 'fa-circle-exclamation', 'Processing': 'fa-spinner fa-spin' }[row.status] || 'fa-info-circle';
        let rowBg = '';
        if (row.deadline && row.status !== 'Completed') {
            const dl = new Date(row.deadline); dl.setHours(0, 0, 0, 0);
            if (dl < today) rowBg = 'bg-red-50 hover:bg-red-100/60';
            else if (dl.getTime() === today.getTime() || dl.getTime() === tomorrow.getTime()) rowBg = 'bg-amber-50 hover:bg-amber-100/60';
            else rowBg = 'hover:bg-slate-50/80';
        } else { rowBg = 'hover:bg-slate-50/80'; }
        let datePart = '', timePart = '';
        if (row.updated_at) { const d = new Date(row.updated_at); datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
        const lastUpdate = row.updated_at ? `${datePart}, ${timePart}` : 'Syncing...';
        const svcFull = row.service_detail || 'General Consulting';
        const svcWords = svcFull.split(' ');
        let svcLines = [];
        if (svcWords.length <= 3) { svcLines = [svcFull]; } else { for (let i = 0; i < svcWords.length; i += 3) { svcLines.push(svcWords.slice(i, i + 3).join(' ')); } }
        const svcDisplay = svcLines.map(line => `<span style="display:block;font-size:13px;font-weight:600;color:#334155;line-height:1.6;">${line}</span>`).join('');
        _rmkCounter++;
        const uid = `rmk_${_rmkCounter}`;
        const fullRemarksRaw = row.remarks || '—';
        const safeShort = fullRemarksRaw.length > 55 ? fullRemarksRaw.substring(0, 54) + '\u2026' : fullRemarksRaw;
        const needsExpand = fullRemarksRaw.length > 55;
        const safeFull = fullRemarksRaw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const safeShortHtml = safeShort.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const remarksCell = needsExpand ? `<div style="min-width:180px;max-width:260px;"><span id="${uid}_s" style="font-size:13px;color:#475569;font-weight:400;">${safeShortHtml}</span><span id="${uid}_f" style="font-size:13px;color:#475569;font-weight:400;display:none;">${safeFull}</span><button data-rmk="${uid}" class="rmk-toggle-btn" style="margin-left:4px;font-size:11px;font-weight:700;color:#3b82f6;background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;vertical-align:middle;">more</button></div>` : `<span style="font-size:13px;color:#475569;font-weight:400;">${safeShortHtml}</span>`;
        const updatedBy = row.updated_by || 'N/A';
        const updatedByShort = updatedBy.includes('@') ? updatedBy.split('@')[0] : updatedBy;
        const updatedByCell = `<div style="display:inline-flex;align-items:center;gap:5px;max-width:145px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:4px 9px;" title="${updatedBy}"><i class="fas fa-user-circle" style="color:#3b82f6;font-size:12px;flex-shrink:0;"></i><span style="font-size:12px;font-weight:600;color:#1d4ed8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${updatedByShort}</span></div>`;
        let deadlineDisplay = 'N/A', deadlineBadge = '';
        if (row.deadline) {
            const dl = new Date(row.deadline); dl.setHours(0, 0, 0, 0);
            deadlineDisplay = dl.toLocaleDateString('en-GB');
            if (row.status !== 'Completed') {
                if (dl < today) deadlineBadge = `<span style="display:block;font-size:9px;font-weight:700;color:#dc2626;background:#fee2e2;padding:1px 5px;border-radius:4px;margin-top:2px;">OVERDUE</span>`;
                else if (dl.getTime() === today.getTime()) deadlineBadge = `<span style="display:block;font-size:9px;font-weight:700;color:#d97706;background:#fef3c7;padding:1px 5px;border-radius:4px;margin-top:2px;">TODAY</span>`;
                else if (dl.getTime() === tomorrow.getTime()) deadlineBadge = `<span style="display:block;font-size:9px;font-weight:700;color:#d97706;background:#fef3c7;padding:1px 5px;border-radius:4px;margin-top:2px;">TOMORROW</span>`;
            }
        }
        const isChecked = selectedRowIds.has(row.id) ? 'checked' : '';
        tbody.innerHTML += `
            <tr class="group transition-all ${rowBg}" id="row_${row.id}">
                <td class="p-4"><input type="checkbox" class="row-checkbox w-4 h-4 rounded" data-id="${row.id}" ${isChecked} onchange="toggleRowSelect(${row.id}, this.checked)"></td>
                <td class="p-4 font-bold text-slate-800 text-sm whitespace-nowrap">${row.client_name}</td>
                <td class="p-4 whitespace-nowrap"><div class="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><i class="far fa-clock text-blue-400"></i>${lastUpdate}</div></td>
                <td class="p-4" style="min-width:140px;max-width:200px;">${svcDisplay}</td>
                <td class="p-4 text-center whitespace-nowrap"><div class="inline-block px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase">${row.service_category}</div></td>
                <td class="p-4 text-center whitespace-nowrap"><div class="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 shadow-sm"><i class="fas fa-user-tie text-blue-500 text-xs"></i>${row.assigned_staff || 'TBD'}</div></td>
                <td class="p-4 text-center whitespace-nowrap"><div class="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-xl text-xs font-semibold text-cyan-700 shadow-sm"><i class="fas fa-user-check text-xs"></i>${row.alloted_by || 'N/A'}</div></td>
                <td class="p-4 text-center font-semibold text-slate-600 text-sm whitespace-nowrap"><div>${deadlineDisplay}</div>${deadlineBadge}</td>
                <td class="p-4 text-center whitespace-nowrap"><span class="status-pill ${statusClass}"><i class="fas ${statusIcon}"></i>${row.status}</span></td>
                <td class="p-4">${remarksCell}</td>
                <td class="p-4 whitespace-nowrap">${updatedByCell}</td>
                <td class="p-4 text-right whitespace-nowrap"><div class="flex justify-end gap-2"><button onclick='editRecord(${JSON.stringify(row)})' class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm hover:scale-110 text-sm"><i class="fas fa-edit"></i></button><button onclick="deleteRecord(${row.id})" class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm hover:scale-110 text-sm"><i class="fas fa-trash-alt"></i></button></div></td>
            </tr>`;
    });
}

document.addEventListener('click', function(e) {
    const btn = e.target.closest('.rmk-toggle-btn');
    if (!btn) return;
    const uid = btn.getAttribute('data-rmk');
    if (!uid) return;
    const s = document.getElementById(uid + '_s');
    const f = document.getElementById(uid + '_f');
    if (!s || !f) return;
    const expanded = f.style.display !== 'none';
    f.style.display = expanded ? 'none' : 'inline';
    s.style.display = expanded ? 'inline' : 'none';
    btn.innerText = expanded ? 'more' : 'less';
});

async function handleSubmit() {
    const id = document.getElementById('editId').value;
    const payload = {
        status: document.getElementById('status').value,
        remarks: document.getElementById('remarks').value,
        client_name: document.getElementById('clientName').value,
        service_category: document.getElementById('serviceCategory').value,
        service_detail: document.getElementById('serviceDetail').value,
        assigned_staff: document.getElementById('assignedStaff').value,
        alloted_by: document.getElementById('allotedBy').value,
        deadline: document.getElementById('deadline').value || null,
        updated_at: new Date().toISOString(),
        updated_by: currentUserName
    };
    if (!payload.client_name) { showToast('Client Name is mandatory.', 'error'); return; }
    const btn = document.getElementById('submitBtn');
    const origHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin text-xl"></i> Syncing...`;
    btn.disabled = true;
    const { error } = id ? await supabaseClient.from('witcorp_records').update(payload).eq('id', id) : await supabaseClient.from('witcorp_records').insert([payload]);
    btn.innerHTML = origHtml;
    btn.disabled = false;
    if (!error) {
        const actionText = id ? `Updated Record: ${payload.client_name} | ${payload.service_category} | Status: ${payload.status}` : `Added Record: ${payload.client_name} | ${payload.service_category} | ${payload.service_detail || 'N/A'}`;
        saveActivity(actionText);
        await createNotificationForOthers(id ? "Record Updated" : "New Record Added", `${payload.client_name} — ${payload.service_category} updated by ${currentUserName}`, "record", payload.client_name);
        showToast(id ? `Record updated: ${payload.client_name}` : `Record added: ${payload.client_name}`, 'success');
        clearForm(); clearDirtyState();
        await fetchRecords(true);
        showSection('dashboard');
    } else { showToast('Sync Error: Please check connection.', 'error'); }
}

function editRecord(row) {
    document.getElementById('editId').value = row.id;
    document.getElementById('clientName').value = row.client_name;
    document.getElementById('serviceCategory').value = row.service_category;
    document.getElementById('serviceDetail').value = row.service_detail || '';
    document.getElementById('assignedStaff').value = row.assigned_staff || '';
    document.getElementById('allotedBy').value = row.alloted_by || '';
    document.getElementById('deadline').value = row.deadline ? row.deadline.split('T')[0] : "";
    document.getElementById('status').value = row.status;
    document.getElementById('remarks').value = row.remarks || '';
    document.getElementById('formTitle').innerText = "Modify Existing Profile";
    document.getElementById('submitBtn').innerHTML = `<i class="fas fa-arrows-rotate mr-2"></i> Confirm Changes`;
    document.getElementById('editBadge').classList.remove('hidden');
    ['clientName', 'serviceCategory', 'serviceDetail', 'assignedStaff', 'allotedBy', 'deadline'].forEach(id => { document.getElementById(id).disabled = true; });
    showSection('dashboard');
    setTimeout(() => { document.getElementById('entryFormAnchor').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
}

async function deleteRecord(id) {
    if (confirm("Confirm: Are you sure you want to delete this record?")) {
        const rec = allRecords.find(r => r.id === id);
        const { error } = await supabaseClient.from('witcorp_records').delete().eq('id', id);
        if (!error) {
            const logText = rec ? `Deleted Record: ${rec.client_name} | ${rec.service_category} | ${rec.service_detail || 'N/A'}` : `Deleted Record ID: ${id}`;
            saveActivity(logText);
            showToast(rec ? `Deleted: ${rec.client_name}` : 'Record deleted', 'warning');
            fetchRecords();
        } else { showToast('Delete failed. Check connection.', 'error'); }
    }
}

// ============================================================
// FETCH CLIENTS — FIXED: sort pehle, teeno columns alphabetical
// ============================================================
async function fetchClients() {
    const { data, error } = await supabaseClient
        .from('witcorp_clients')
        .select('*')
        .order('client_name', { ascending: true })
        .limit(300);
    if (error) return;
    allClients = data;
    currentExportData = data;
    currentExportType = "clients";
    setupPredictions();

    const containers = { 'Pvt Ltd': 'pvtLtdList', 'LLP': 'llpList', 'Others': 'othersList' };
    const counts = { 'Pvt Ltd': 0, 'LLP': 0, 'Others': 0 };

    Object.values(containers).forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ""; });

    if (data.length === 0) {
        Object.values(containers).forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = `<div class="text-center py-8 text-slate-300 font-bold text-sm"><i class="fas fa-users text-3xl block mb-2"></i>No clients yet</div>`; });
        return;
    }

    // ✅ SORT PEHLE — teeno columns mein A→Z
    data.sort((a, b) => (a.client_name || '').toLowerCase().localeCompare((b.client_name || '').toLowerCase()));

    data.forEach(c => {
        const typeKey = ['Pvt Ltd', 'LLP'].includes(c.entity_type) ? c.entity_type : 'Others';
        counts[typeKey]++;
        const listId = containers[typeKey];
        const clientRecordCount = allRecords.filter(r => r.client_name === c.client_name).length;
        const recordBadge = clientRecordCount > 0 ? `<span class="ml-auto px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black">${clientRecordCount} records</span>` : '';
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
                    <button onclick='editClient(${JSON.stringify(c)})' class="text-xs text-blue-600 font-bold uppercase hover:scale-110 transition-transform">Modify</button>
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
    const payload = { client_name: document.getElementById('cName').value, contact_number: document.getElementById('cPhone').value, email_id: document.getElementById('cEmail').value, entity_type: document.getElementById('cType').value, updated_by: currentUserName };
    if (!payload.client_name) { showToast('Entity Name Required', 'error'); return; }
    const { error } = id ? await supabaseClient.from('witcorp_clients').update(payload).eq('id', id) : await supabaseClient.from('witcorp_clients').insert([payload]);
    if (!error) {
        await createNotificationForOthers(id ? "Client Updated" : "New Client Added", `${payload.client_name} profile updated by ${currentUserName}`, "client");
        saveActivity(`${id ? 'Updated' : 'Added'} Client: ${payload.client_name} | ${payload.entity_type}`);
        showToast(`${id ? 'Updated' : 'Added'}: ${payload.client_name}`, 'success');
        fetchClients();
        document.getElementById('cEditId').value = "";
        ['cName', 'cPhone', 'cEmail'].forEach(i => document.getElementById(i).value = "");
        document.getElementById('clientBtn').innerText = "Save Client Profile";
    } else { showToast('Save failed. Check connection.', 'error'); }
}

async function deleteClient(id) {
    if (confirm("Action: Delete client profile?")) {
        const c = allClients.find(x => x.id === id);
        const { error } = await supabaseClient.from('witcorp_clients').delete().eq('id', id);
        if (!error) { if (c) saveActivity(`Deleted Client: ${c.client_name} | ${c.entity_type}`); showToast(c ? `Deleted: ${c.client_name}` : 'Client deleted', 'warning'); fetchClients(); }
        else { showToast('Delete failed.', 'error'); }
    }
}

async function fetchVault() {
    const { data, error } = await supabaseClient.from('witcorp_credentials').select('*').order('client_name', { ascending: true }).limit(300);
    if (error) return;
    allVault = data;
    currentExportData = data;
    currentExportType = "vault";
    setupPredictions();
    renderVaultTable(data);
}

function renderVaultTable(data) {
    const tbody = document.getElementById('vaultTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";
    if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-16 text-center"><div class="flex flex-col items-center gap-4"><i class="fas fa-shield-halved text-4xl text-slate-200"></i><p class="font-black text-slate-400 text-sm uppercase">No credentials stored</p></div></td></tr>`; return; }
    data.forEach(v => {
        const fullPass = v.password || '';
        const maskedPass = '•'.repeat(Math.min(fullPass.length, 12));
        const vId = `vault_${v.id}`;
        tbody.innerHTML += `
            <tr class="group hover:bg-slate-50" id="${vId}_row">
                <td class="p-4 font-bold text-blue-900 text-sm whitespace-nowrap">${v.client_name || 'N/A'}</td>
                <td class="p-4 whitespace-nowrap"><span class="px-2 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">${v.category}</span></td>
                <td class="p-4 font-semibold text-blue-600 text-sm whitespace-nowrap"><div class="flex items-center gap-2"><span>${v.username}</span><button onclick="copyToClipboard('${v.username.replace(/'/g,"\\'")}', 'Username')" class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-all text-xs" title="Copy Username"><i class="fas fa-copy"></i></button></div></td>
                <td class="p-4 font-mono text-sm whitespace-nowrap"><div class="flex items-center gap-2"><span class="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-inner" id="${vId}_pass">${maskedPass}</span><button onclick="toggleVaultPassword('${vId}', '${fullPass.replace(/'/g,"\\'")}')'" class="text-slate-400 hover:text-blue-600 transition-all text-xs" title="Show/Hide"><i class="fas fa-eye" id="${vId}_eye"></i></button><button onclick="copyToClipboard('${fullPass.replace(/'/g,"\\'")}', 'Password')" class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-all text-xs" title="Copy Password"><i class="fas fa-copy"></i></button></div></td>
                <td class="p-4 text-sm font-semibold text-blue-700 whitespace-nowrap">${v.updated_by || 'N/A'}</td>
                <td class="p-4 text-right whitespace-nowrap"><div class="flex gap-3 justify-end items-center"><button onclick='editVault(${JSON.stringify(v)})' class="text-blue-500 hover:scale-125 transition-transform text-sm"><i class="fas fa-pencil"></i></button><button onclick="deleteVault(${v.id})" class="text-rose-500 hover:scale-125 transition-transform text-sm"><i class="fas fa-trash-alt"></i></button></div></td>
            </tr>`;
    });
}

function toggleVaultPassword(vId, fullPass) {
    const passEl = document.getElementById(vId + '_pass');
    const eyeEl = document.getElementById(vId + '_eye');
    if (!passEl || !eyeEl) return;
    const isHidden = passEl.textContent.includes('•');
    passEl.textContent = isHidden ? fullPass : '•'.repeat(Math.min(fullPass.length, 12));
    eyeEl.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => { showToast(`${label} copied to clipboard`, 'info', 2000); }).catch(() => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast(`${label} copied`, 'info', 2000); });
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
    const payload = { client_name: document.getElementById('vClient').value, category: document.getElementById('vCat').value, username: document.getElementById('vUser').value, password: document.getElementById('vPass').value, updated_by: currentUserName };
    if (!payload.category || !payload.client_name) { showToast('Required fields missing.', 'error'); return; }
    const { error } = id ? await supabaseClient.from('witcorp_credentials').update(payload).eq('id', id) : await supabaseClient.from('witcorp_credentials').insert([payload]);
    if (!error) {
        await createNotificationForOthers(id ? "Vault Updated" : "Credentials Added", `${payload.client_name} credentials updated by ${currentUserName}`, "vault");
        saveActivity(`${id ? 'Updated' : 'Added'} Vault: ${payload.client_name} | ${payload.category}`);
        showToast(`${id ? 'Updated' : 'Saved'}: ${payload.client_name} credentials`, 'success');
        fetchVault();
        document.getElementById('vEditId').value = "";
        ['vClient', 'vCat', 'vUser', 'vPass'].forEach(i => document.getElementById(i).value = "");
        document.getElementById('vaultBtn').innerText = "Store Securely";
    } else { showToast('Save failed. Check connection.', 'error'); }
}

async function deleteVault(id) {
    if (confirm("Security: Confirm credential deletion?")) {
        const v = allVault.find(x => x.id === id);
        const { error } = await supabaseClient.from('witcorp_credentials').delete().eq('id', id);
        if (!error) { if (v) saveActivity(`Deleted Vault: ${v.client_name} | ${v.category}`); showToast(v ? `Deleted: ${v.client_name}` : 'Credential deleted', 'warning'); fetchVault(); }
        else { showToast('Delete failed.', 'error'); }
    }
}

function searchVault(query) {
    const q = query.toLowerCase();
    const filtered = allVault.filter(v => v.client_name?.toLowerCase().includes(q) || v.category?.toLowerCase().includes(q) || v.username?.toLowerCase().includes(q));
    renderVaultTable(filtered);
    if (query.trim() === "") fetchVault();
}

function toggleAccountingHub() { document.getElementById('accountinghubMenu').classList.toggle('hidden'); }
function toggleAccountingHubDesktop() { document.getElementById('accountinghubDesktopMenu').classList.toggle('hidden'); }

function showSection(id) {
    if (isFormDirty && id !== 'dashboard') { const leave = confirm("You have unsaved changes in the form. Leave anyway?"); if (!leave) return; clearDirtyState(); }
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const globalSearch = document.getElementById('globalSearchBox');
    if (id === 'clientManagement' || id === 'vaultManagement' || id === 'dscManagement') { globalSearch.style.display = 'none'; } else { globalSearch.style.display = 'block'; }
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const section = document.getElementById(id);
    if (section) section.classList.add('active');
    if (id === 'dashboard') document.getElementById('nav-dashboard')?.classList.add('active');
    if (id === 'clientManagement') document.getElementById('nav-client')?.classList.add('active');
    if (id === 'vaultManagement') document.getElementById('nav-vault')?.classList.add('active');
    if (id === 'dscManagement') document.getElementById('nav-dsc')?.classList.add('active');
    const filterMap = { 'GST': 'nav-gst', 'ROC': 'nav-roc', 'IT': 'nav-it', 'PT': 'nav-pt', 'TDS': 'nav-tds', 'DIRECTOR KYC': 'nav-dkyc', 'UDIN': 'nav-udin', 'FOOD': 'nav-food', 'MSME': 'nav-msme', 'PAYROLL': 'nav-payroll', 'REPORTS': 'nav-reports' };
    if (id === 'filterView') { const activeVal = window._lastFilterValue; const navId = filterMap[activeVal]; if (navId) document.getElementById(navId)?.classList.add('active'); }
    if (id === 'dashboard' && allRecords.length === 0) fetchRecords();
    if (id === 'clientManagement') fetchClients();
    if (id === 'vaultManagement') fetchVault();
    if (id === 'dscManagement') fetchDSC();
    updateBreadcrumb(id);
    setTimeout(applyGreenHeaders, 80);
}

function filterByField(field, value) {
    window._lastFilterValue = value;
    showSection('filterView');
    let filtered = field === 'all' ? [...allRecords] : allRecords.filter(r => r[field] === value);
    const titles = { "Sales": "Sales", "Purchases": "Purchases", "Sundry Debtors": "Sundry Debtors", "Sundry Creditors": "Sundry Creditors", "Payroll Entries": "Payroll Entries", "Bank Statement": "Bank Statement", "GST Transfer Entries": "GST Transfer Entries", "Depreciation Entries": "Depreciation Entries", "TDS Entries": "TDS Entries", "Miscellaneous Ledgers": "Miscellaneous Ledgers", "GST": "GST Compliance", "ROC": "Corporate Compliance (ROC)", "IT": "Income Tax", "PT": "Professional Tax", "TDS": "TDS Compliance", "DIRECTOR KYC": "Director KYC", "UDIN": "UDIN/Certification", "FOOD": "Food License", "MSME": "MSME Certification", "PAYROLL": "Payroll", "REPORTS": "Reports", "Completed": "Completed Records", "Pending": "Pending Records" };
    document.getElementById('filterTitle').innerText = `${titles[value] || value || 'All'} Portal View`;
    renderTable(filtered, 'filterTableBody');
}

function handleSearch(query) {
    const q = query.toLowerCase().trim();
    if (q === "") { showSection('dashboard'); if (allRecords.length === 0) fetchRecords(); return; }
    const filtered = allRecords.filter(r => r.client_name?.toLowerCase().includes(q) || r.service_detail?.toLowerCase().includes(q) || r.assigned_staff?.toLowerCase().includes(q) || r.service_category?.toLowerCase().includes(q) || r.status?.toLowerCase().includes(q) || r.alloted_by?.toLowerCase().includes(q));
    showSection('filterView');
    document.getElementById('filterTitle').innerText = `Results for: "${query}"`;
    renderTable(filtered, 'filterTableBody');
}

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

async function refreshData() {
    const btn = document.getElementById("refreshBtn");
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Refreshing';
    btn.disabled = true;
    await fetchRecords(true);
    renderTable(allRecords, 'mainTableBody');
    btn.innerHTML = '<i class="fas fa-check mr-1"></i> Updated';
    btn.disabled = false;
    showToast('Records refreshed successfully', 'success', 2000);
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-rotate-right mr-1"></i> Refresh'; }, 1500);
}

function clearForm() {
    document.getElementById('editId').value = "";
    document.getElementById('formTitle').innerText = "Management Portal";
    document.getElementById('submitBtn').innerHTML = `<i class="fas fa-cloud-arrow-up text-xl"></i> Sync To WitcorpDB`;
    document.getElementById('editBadge').classList.add('hidden');
    ['clientName', 'serviceCategory', 'serviceDetail', 'assignedStaff', 'allotedBy', 'deadline', 'status', 'remarks'].forEach(i => {
        const el = document.getElementById(i);
        if (i === 'serviceCategory') { el.value = 'Sales'; } else if (i === 'status') { el.value = 'Pending'; } else { el.value = ""; }
        el.disabled = false;
    });
    clearDirtyState();
}

async function registerUser() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) { document.getElementById('authMsg').innerText = error.message; return; }
    const user = data.user;
    await supabaseClient.from('witcorp_users').insert([{ id: user.id, email: user.email, role: 'user', approved: true }]);
    document.getElementById('authMsg').innerText = "Registered Successfully! Now login.";
}

async function loginUser() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { document.getElementById('authMsg').innerText = error.message; return; }
    checkApproval(data.user);
}

async function checkApproval(user) {
    const { data } = await supabaseClient.from('witcorp_users').select('approved').eq('id', user.id).single();
    if (!data || !data.approved) { showToast('Not approved by admin yet', 'error'); logout(); return; }
    currentUserName = user.email;
    showApp(user);
}

function showApp(user) {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('flex');
    const gmailEl = document.getElementById('userGmail');
    if (gmailEl) gmailEl.innerText = user.email;
    const name = user.email;
    const p1 = document.getElementById("profileInitial");
    const p2 = document.getElementById("profileInitial2");
    if (p1) p1.innerText = name.charAt(0).toUpperCase();
    if (p2) p2.innerText = name.charAt(0).toUpperCase();
    showSection('dashboard');
    showToast(`Welcome back, ${name.split('@')[0]}!`, 'success');
}

async function logout() { await supabaseClient.auth.signOut(); location.reload(); }

supabaseClient.auth.getSession().then(({ data }) => { if (data.session) checkApproval(data.session.user); });

function toggleMenu() {
    const menu = document.getElementById("mobileMenu");
    menu.classList.toggle("hidden");
    if (menu.classList.contains("hidden")) { document.body.classList.remove("menu-open"); } else { document.body.classList.add("menu-open"); }
}

// ============================================================
// SEARCH CLIENTS — FIXED: sort consistent, empty query fast return
// ============================================================
function searchClients(query) {
    const q = query.toLowerCase().trim();

    // ✅ Empty = fresh sorted fetch
    if (q === "") { fetchClients(); return; }

    const filtered = allClients.filter(c =>
        c.client_name?.toLowerCase().includes(q) ||
        c.contact_number?.toLowerCase().includes(q) ||
        c.email_id?.toLowerCase().includes(q)
    );

    // ✅ Starts-with priority, phir alphabetical
    filtered.sort((a, b) => {
        const aS = (a.client_name || '').toLowerCase().startsWith(q) ? 0 : 1;
        const bS = (b.client_name || '').toLowerCase().startsWith(q) ? 0 : 1;
        if (aS !== bS) return aS - bS;
        return (a.client_name || '').toLowerCase().localeCompare((b.client_name || '').toLowerCase());
    });

    const containers = { 'Pvt Ltd': 'pvtLtdList', 'LLP': 'llpList', 'Others': 'othersList' };
    Object.values(containers).forEach(id => { document.getElementById(id).innerHTML = ""; });

    filtered.forEach(c => {
        const typeKey = ['Pvt Ltd', 'LLP'].includes(c.entity_type) ? c.entity_type : 'Others';
        const listId = containers[typeKey];
        const clientRecordCount = allRecords.filter(r => r.client_name === c.client_name).length;
        const recordBadge = clientRecordCount > 0 ? `<span class="ml-auto px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black">${clientRecordCount} records</span>` : '';
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
                    <button onclick='editClient(${JSON.stringify(c)})' class="text-xs text-blue-600 font-bold uppercase hover:scale-110 transition-transform">Modify</button>
                    <button onclick="deleteClient(${c.id})" class="text-xs text-rose-500 font-bold uppercase hover:scale-110 transition-transform">Delete</button>
                </div>
            </div>`;
    });
}

async function fetchDSC() {
    const { data, error } = await supabaseClient.from('witcorp_dsc').select('*').order('company_name', { ascending: true });
    if (error) { console.log("DSC FETCH ERROR:", error); return; }
    allDSC = data || [];
    currentExportData = allDSC;
    currentExportType = "dsc";
    setupPredictions();
    renderDSC(allDSC);
}

function renderDSC(data) {
    const tbody = document.getElementById('dscTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";
    if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="p-16 text-center"><div class="flex flex-col items-center gap-4"><i class="fas fa-key text-4xl text-slate-200"></i><p class="font-black text-slate-400 text-sm uppercase">No DSC records found</p></div></td></tr>`; return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    data.forEach(d => {
        const fullRem = d.remarks || '—';
        const shortRem = fullRem.length > 50 ? fullRem.substring(0, 48) + '\u2026' : fullRem;
        const updatedAt = d.updated_at ? (() => { const dt = new Date(d.updated_at); return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); })() : 'N/A';
        const statusColors = { 'Valid': 'bg-emerald-100 text-emerald-700 border-emerald-200', 'Expired': 'bg-red-100 text-red-700 border-red-200', 'No DSC': 'bg-slate-100 text-slate-600 border-slate-200' };
        const statusStyle = statusColors[d.status] || statusColors['No DSC'];
        let expiryBadge = '';
        if (d.expiry_date && d.status === 'Valid') {
            const expiry = new Date(d.expiry_date); expiry.setHours(0, 0, 0, 0);
            const daysLeft = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 30 && daysLeft >= 0) expiryBadge = `<span class="ml-1 text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">${daysLeft}d left</span>`;
            else if (daysLeft < 0) expiryBadge = `<span class="ml-1 text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded">EXPIRED</span>`;
        }
        tbody.innerHTML += `
            <tr class="border-b border-slate-200 hover:bg-slate-50 transition-all">
                <td class="p-4 font-bold text-sm text-slate-800 whitespace-nowrap">${d.company_name || ''}</td>
                <td class="p-4 font-semibold text-sm text-slate-600 whitespace-nowrap">${d.client_name || ''}</td>
                <td class="p-4 whitespace-nowrap"><span class="px-3 py-1 rounded-xl text-xs font-black border ${statusStyle}">${d.status || ''}</span></td>
                <td class="p-4 font-semibold text-sm text-slate-600 whitespace-nowrap">${d.expiry_date || 'N/A'}${expiryBadge}</td>
                <td class="p-4 text-sm text-slate-600 max-w-[200px]" title="${fullRem.replace(/"/g,'&quot;')}"><span class="block">${shortRem}</span></td>
                <td class="p-4 text-sm font-semibold text-blue-700 whitespace-nowrap">${d.updated_by || 'N/A'}</td>
                <td class="p-4 text-sm font-semibold text-slate-500 whitespace-nowrap">${updatedAt}</td>
                <td class="p-4 text-right whitespace-nowrap"><div class="flex gap-2 justify-end items-center"><button onclick='editDSC(${JSON.stringify(d)})' class="px-3 py-1 bg-blue-500 text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-all">Edit</button><button onclick="deleteDSC(${d.id})" class="px-3 py-1 bg-red-500 text-white rounded-xl text-xs font-semibold hover:bg-red-600 transition-all">Delete</button></div></td>
            </tr>`;
    });
}

async function saveDSC() {
    const btn = document.getElementById('dscBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
    const id = document.getElementById('dEditId').value;
    const payload = { company_name: document.getElementById('dCompany').value.trim(), client_name: document.getElementById('dClient').value.trim(), status: document.getElementById('dStatus').value, expiry_date: document.getElementById('dExpiry').value, remarks: document.getElementById('dRemarks').value.trim(), updated_by: currentUserName, updated_at: new Date().toISOString() };
    if (!payload.company_name) { btn.disabled = false; btn.innerHTML = id ? 'Update DSC Status' : 'Save DSC Status'; showToast('Company Name Required', 'error'); return; }
    let error;
    if (id) { ({ error } = await supabaseClient.from('witcorp_dsc').update(payload).eq('id', id)); } else { ({ error } = await supabaseClient.from('witcorp_dsc').insert([payload])); }
    if (!error) {
        await createNotificationForOthers(id ? "DSC Updated" : "New DSC Added", `${payload.company_name} DSC updated by ${currentUserName}`, "dsc");
        saveActivity(`${id ? 'Updated' : 'Added'} DSC: ${payload.company_name} | ${payload.client_name} | Status: ${payload.status}`);
        showToast(`DSC ${id ? 'updated' : 'saved'}: ${payload.company_name}`, 'success');
        await new Promise(r => setTimeout(r, 300));
        await fetchDSC();
        document.getElementById('dEditId').value = "";
        ['dCompany', 'dClient', 'dExpiry', 'dRemarks'].forEach(i => document.getElementById(i).value = "");
        document.getElementById('dStatus').value = "Valid";
        document.getElementById('dscBtn').innerText = "Save DSC Status";
    } else { showToast('Save failed. Check connection.', 'error'); console.error("DSC ERROR:", error); }
    btn.disabled = false;
    if (!error) btn.innerHTML = 'Save DSC Status';
}

function editDSC(d) {
    document.getElementById('dEditId').value = d.id;
    document.getElementById('dCompany').value = d.company_name;
    document.getElementById('dClient').value = d.client_name;
    document.getElementById('dStatus').value = (d.status === "Valid" || d.status === "Expired" || d.status === "No DSC") ? d.status : "Valid";
    document.getElementById('dExpiry').value = d.expiry_date ? d.expiry_date.split('T')[0] : "";
    document.getElementById('dRemarks').value = d.remarks || '';
    document.getElementById('dscBtn').innerText = "Update DSC Status";
    document.getElementById('dCompany').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteDSC(id) {
    if (confirm("Delete DSC Record?")) {
        const d = allDSC.find(x => x.id === id);
        const { error } = await supabaseClient.from('witcorp_dsc').delete().eq('id', id);
        if (!error) { if (d) saveActivity(`Deleted DSC: ${d.company_name} | ${d.client_name}`); showToast(d ? `Deleted: ${d.company_name}` : 'DSC deleted', 'warning'); await fetchDSC(); }
        else { showToast('Delete failed.', 'error'); }
    }
}

function searchDSC(query) {
    const q = query.toLowerCase();
    const filtered = allDSC.filter(d => d.company_name?.toLowerCase().includes(q) || d.client_name?.toLowerCase().includes(q) || d.status?.toLowerCase().includes(q));
    renderDSC(filtered);
}

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js').then(() => console.log("SW registered")); }

function toggleProfileMenu() { document.getElementById("profileMenu").classList.toggle("hidden"); }

document.addEventListener("click", function(event) {
    const menu = document.getElementById("profileMenu");
    if (menu && !event.target.closest("#profileMenu") && !event.target.closest("[onclick='toggleProfileMenu()']")) { menu.classList.add("hidden"); }
    const notifPanel = document.getElementById("notificationPanel");
    if (notifPanel && !event.target.closest("#notificationPanel") && !event.target.closest("[onclick='toggleNotificationPanel()']")) { notifPanel.classList.add("hidden"); }
});

function openThemeSettings() { document.getElementById("themeModal").classList.remove("hidden"); }
function closeThemeSettings() { document.getElementById("themeModal").classList.add("hidden"); }

async function createNotification(title, message, type = "info", reference = "") {
    await supabaseClient.from('witcorp_notifications').insert([{ title, message, type, reference, created_by: currentUserName, is_read: false }]);
}

async function createNotificationForOthers(title, message, type = "info", reference = "") {
    await supabaseClient.from('witcorp_notifications').insert([{ title, message, type, reference, created_by: currentUserName, is_read: false }]);
}

async function fetchNotifications() {
    const { data, error } = await supabaseClient.from('witcorp_notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) return;
    allNotifications = data;
    renderNotifications();
}

async function markAllRead() {
    const unreadIds = allNotifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabaseClient.from('witcorp_notifications').update({ is_read: true }).in('id', unreadIds);
    allNotifications.forEach(n => n.is_read = true);
    renderNotifications();
    showToast('All notifications marked as read', 'info', 2000);
}

function renderNotifications() {
    const list = document.getElementById('notificationList');
    const count = document.getElementById('notificationCount');
    if (!list) return;
    list.innerHTML = "";
    const unread = allNotifications.filter(n => !n.is_read);
    unreadCount = unread.length;
    if (count) { if (unreadCount > 0) { count.classList.remove('hidden'); count.innerText = unreadCount > 99 ? '99+' : unreadCount; } else { count.classList.add('hidden'); } }
    if (allNotifications.length === 0) { list.innerHTML = `<div class="p-10 text-center text-slate-400 font-bold text-sm"><i class="fas fa-bell-slash text-3xl block mb-3 opacity-30"></i>No notifications yet</div>`; return; }
    allNotifications.forEach(n => {
        const typeIcon = { record: 'fa-file-alt', client: 'fa-address-card', vault: 'fa-shield-halved', dsc: 'fa-key' };
        list.innerHTML += `
            <div data-notif-id="${n.id}" data-notif-type="${n.type}" data-notif-ref="${(n.reference || '').replace(/"/g, '&quot;')}"
                class="p-4 cursor-pointer transition-all hover:bg-slate-50 flex gap-3 items-start ${!n.is_read ? 'bg-blue-50 border-l-4 border-blue-400' : 'bg-white'}">
                <div class="w-8 h-8 rounded-full ${!n.is_read ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'} flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i class="fas ${typeIcon[n.type] || 'fa-bell'} text-xs"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-sm text-slate-800">${n.title}</div>
                    <div class="text-xs text-slate-500 mt-0.5">${n.message}</div>
                    <div class="text-[10px] text-blue-500 mt-1 font-semibold">${new Date(n.created_at).toLocaleString('en-IN')}</div>
                </div>
                ${!n.is_read ? '<span class="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></span>' : ''}
            </div>`;
    });
    list.querySelectorAll('[data-notif-id]').forEach(el => { el.addEventListener('click', function() { openNotification(parseInt(this.dataset.notifId), this.dataset.notifType, this.dataset.notifRef); }); });
}

function toggleNotificationPanel() { document.getElementById('notificationPanel').classList.toggle('hidden'); }

async function openNotification(id, type, reference) {
    await supabaseClient.from('witcorp_notifications').update({ is_read: true }).eq('id', id);
    const target = allNotifications.find(n => n.id === id);
    if (target) target.is_read = true;
    renderNotifications();
    if (type === "record") { showSection('dashboard'); handleSearch(reference); }
    if (type === "client") { showSection('clientManagement'); searchClients(reference); }
    if (type === "vault") { showSection('vaultManagement'); searchVault(reference); }
    if (type === "dsc") { showSection('dscManagement'); searchDSC(reference); }
    document.getElementById('notificationPanel').classList.add('hidden');
}

supabaseClient
    .channel('live-notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'witcorp_notifications' }, async (payload) => {
        if (payload.new.created_by === currentUserName) return;
        allNotifications.unshift(payload.new);
        renderNotifications();
        const notificationEnabled = localStorage.getItem("notificationSound");
        if (notificationEnabled !== "off") {
            try { const audio = new Audio('https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3'); audio.play().catch(() => {}); } catch(e) {}
            navigator.serviceWorker?.ready.then(reg => { reg.showNotification(payload.new.title || "New Update", { body: payload.new.message || "Database updated", icon: "./logo.png", badge: "./logo.png" }); }).catch(() => {});
        }
        showToast(payload.new.title + ': ' + payload.new.message, 'info');
        fetchRecords(true);
    })
    .subscribe((status) => { console.log("NOTIFICATION STATUS:", status); });

window.addEventListener('DOMContentLoaded', () => { fetchNotifications(); });

function changeTheme(theme) {
    const body = document.body;
    ['theme-ocean', 'theme-dark', 'theme-green', 'theme-purple', 'theme-light'].forEach(t => body.classList.remove(t));
    body.classList.add(theme);
    localStorage.setItem('bgTheme', theme);
}

function changeSidebarTheme(theme) {
    const sidebar = document.getElementById('sidebar');
    const mobileSidebar = document.getElementById('mobileSidebar');
    const sidebarThemes = ['sidebar-theme-raspberry', 'sidebar-theme-mint', 'sidebar-theme-chill', 'sidebar-theme-forest', 'sidebar-theme-damini', 'sidebar-theme-seaglass', 'sidebar-theme-lemon', 'sidebar-theme-dark', 'sidebar-theme-navypro', 'sidebar-theme-original'];
    sidebarThemes.forEach(t => { sidebar.classList.remove(t); mobileSidebar.classList.remove(t); });
    sidebar.classList.add(theme);
    mobileSidebar.classList.add(theme);
    localStorage.setItem('sidebarTheme', theme);
}

window.addEventListener('load', () => {
    const savedBg = localStorage.getItem('bgTheme');
    if (savedBg) changeTheme(savedBg);
    const savedSidebar = localStorage.getItem('sidebarTheme');
    if (savedSidebar) changeSidebarTheme(savedSidebar);
    loadNotificationSetting();
});

function setupPredictions() {
    const clientList = document.getElementById('clientSuggestions');
    const uniqueClients = [...new Set(allClients.map(c => c.client_name).filter(Boolean))];
    if (clientList) clientList.innerHTML = uniqueClients.map(name => `<option value="${name}">`).join('');
    const serviceList = document.getElementById('serviceSuggestions');
    const uniqueServices = [...new Set(allRecords.map(r => r.service_detail).filter(Boolean))];
    if (serviceList) serviceList.innerHTML = uniqueServices.map(name => `<option value="${name}">`).join('');
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

async function forgotPassword() {
    const email = document.getElementById("email").value;
    if (!email) { document.getElementById('authMsg').innerText = "Please enter your email first"; return; }
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname + "?reset=true" });
    if (error) { document.getElementById('authMsg').innerText = error.message; } else { document.getElementById('authMsg').innerText = "Password reset link sent to your email."; }
}

window.addEventListener('load', async () => {
    const hash = window.location.hash;
    if (hash.includes("access_token") && hash.includes("type=recovery")) {
        const newPassword = prompt("Enter New Password");
        if (!newPassword) return;
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) { showToast(error.message, 'error'); } else { showToast("Password updated successfully!", 'success'); window.location.href = window.location.pathname; }
    }
});

function loadNotificationSetting() {
    const sound = localStorage.getItem("notificationSound");
    const status = document.getElementById("notificationStatus");
    if (!status) return;
    if (sound === "off") { status.innerText = "OFF"; status.classList.remove("text-green-600"); status.classList.add("text-red-500"); }
    else { status.innerText = "ON"; status.classList.remove("text-red-500"); status.classList.add("text-green-600"); }
}

function toggleNotificationSetting() {
    const current = localStorage.getItem("notificationSound");
    localStorage.setItem("notificationSound", current === "off" ? "on" : "off");
    loadNotificationSetting();
}

function openExportModal() { document.getElementById("exportModal").classList.remove("hidden"); }
function closeExportModal() { document.getElementById("exportModal").classList.add("hidden"); }
function openMyActivity() { document.getElementById("activityModal").classList.remove("hidden"); loadMyActivity(); }
function closeActivityModal() { document.getElementById("activityModal").classList.add("hidden"); }

function saveActivity(text) {
    let activity = JSON.parse(localStorage.getItem("myActivity") || "[]");
    activity.unshift({ text, time: new Date().toLocaleString('en-IN') });
    if (activity.length > 100) activity = activity.slice(0, 100);
    localStorage.setItem("myActivity", JSON.stringify(activity));
}

function loadMyActivity() {
    let activity = JSON.parse(localStorage.getItem("myActivity") || "[]");
    const iconMap = { 'Added': 'fa-circle-plus text-emerald-500', 'Updated': 'fa-pen-to-square text-blue-500', 'Deleted': 'fa-trash-can text-rose-500', 'Exported': 'fa-file-export text-purple-500', 'Bulk': 'fa-layer-group text-cyan-500', 'Default': 'fa-clock-rotate-left text-slate-400' };
    let html = "";
    if (activity.length === 0) { html = `<div class="text-center text-slate-400 py-10 font-semibold">No activity recorded yet.</div>`; }
    else {
        activity.forEach(item => {
            const verb = Object.keys(iconMap).find(k => item.text.startsWith(k)) || 'Default';
            const icon = iconMap[verb];
            const parts = item.text.split('|').map(p => p.trim());
            const mainText = parts[0] || item.text;
            const details = parts.slice(1);
            html += `
                <div class="flex items-start gap-3 border-b border-slate-100 py-4 last:border-0">
                    <div class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5"><i class="fas ${icon} text-sm"></i></div>
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-sm text-slate-800">${mainText}</div>
                        ${details.length ? `<div class="text-sm text-slate-500 mt-0.5">${details.join(' · ')}</div>` : ''}
                        <div class="text-xs text-blue-500 font-semibold mt-1">${item.time}</div>
                    </div>
                </div>`;
        });
    }
    document.getElementById("activityList").innerHTML = html;
}

function exportCSV() {
    let rows = currentExportData || [];
    if (rows.length === 0) { showToast('No records found to export', 'warning'); return; }
    let csv = "";
    if (currentExportType === "records") { csv = "Client,Category,Service,Staff,Status,Deadline\n"; rows.forEach(r => { csv += `"${r.client_name||""}","${r.service_category||""}","${r.service_detail||""}","${r.assigned_staff||""}","${r.status||""}","${r.deadline||""}"\n`; }); }
    else if (currentExportType === "clients") { csv = "Client Name,Phone,Email,Type\n"; rows.forEach(r => { csv += `"${r.client_name||""}","${r.contact_number||""}","${r.email_id||""}","${r.entity_type||""}"\n`; }); }
    else if (currentExportType === "vault") { csv = "Client,Category,Username,Password,Updated By\n"; rows.forEach(r => { csv += `"${r.client_name||""}","${r.category||""}","${r.username||""}","${r.password||""}","${r.updated_by||""}"\n`; }); }
    else if (currentExportType === "dsc") { csv = "Company,Client,Status,Expiry Date,Remarks\n"; rows.forEach(r => { csv += `"${r.company_name||""}","${r.client_name||""}","${r.status||""}","${r.expiry_date||""}","${r.remarks||""}"\n`; }); }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = currentExportType + ".csv"; a.click();
    saveActivity("Exported CSV Report: " + currentExportType);
    showToast('CSV exported successfully', 'success');
}

function exportExcel() {
    let rows = currentExportData || [];
    if (rows.length === 0) { showToast('No records found to export', 'warning'); return; }
    let csv = "";
    if (currentExportType === "records") { csv = "Client,Category,Service,Staff,Alloted By,Status,Deadline,Remarks,Updated By\n"; rows.forEach(r => { csv += `"${r.client_name||""}","${r.service_category||""}","${r.service_detail||""}","${r.assigned_staff||""}","${r.alloted_by||""}","${r.status||""}","${r.deadline||""}","${r.remarks||""}","${r.updated_by||""}"\n`; }); }
    else if (currentExportType === "clients") { csv = "Client Name,Phone,Email,Type,Updated By\n"; rows.forEach(r => { csv += `"${r.client_name||""}","${r.contact_number||""}","${r.email_id||""}","${r.entity_type||""}","${r.updated_by||""}"\n`; }); }
    else if (currentExportType === "vault") { csv = "Client,Category,Username,Password,Updated By\n"; rows.forEach(r => { csv += `"${r.client_name||""}","${r.category||""}","${r.username||""}","${r.password||""}","${r.updated_by||""}"\n`; }); }
    else if (currentExportType === "dsc") { csv = "Company,Client,Status,Expiry Date,Remarks,Updated By\n"; rows.forEach(r => { csv += `"${r.company_name||""}","${r.client_name||""}","${r.status||""}","${r.expiry_date||""}","${r.remarks||""}","${r.updated_by||""}"\n`; }); }
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "Witcorp_" + currentExportType + ".xls"; a.click();
    saveActivity("Exported Excel Report: " + currentExportType);
    showToast('Excel exported successfully', 'success');
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("landscape");
    let rows = currentExportData || [];
    if (rows.length === 0) { showToast('No records found to export', 'warning'); return; }
    let tableHead = [], tableData = [];
    if (currentExportType === "vault") { tableHead = [["Client", "Category", "Username", "Password", "Updated By"]]; tableData = rows.map(r => [r.client_name||"", r.category||"", r.username||"", r.password||"", r.updated_by||""]); }
    else if (currentExportType === "clients") { tableHead = [["Client", "Phone", "Email", "Type"]]; tableData = rows.map(r => [r.client_name||"", r.contact_number||"", r.email_id||"", r.entity_type||""]); }
    else if (currentExportType === "dsc") { tableHead = [["Company", "Client", "Status", "Expiry Date", "Remarks"]]; tableData = rows.map(r => [r.company_name||"", r.client_name||"", r.status||"", r.expiry_date||"", r.remarks||""]); }
    else { tableHead = [["Client", "Category", "Service", "Staff", "Alloted By", "Status", "Deadline", "Remarks", "Updated By"]]; tableData = rows.map(r => [r.client_name||"", r.service_category||"", r.service_detail||"", r.assigned_staff||"", r.alloted_by||"", r.status||"", r.deadline||"", r.remarks||"", r.updated_by||""]); }
    doc.setFontSize(16);
    doc.text("Witcorp Hub Report", 14, 15);
    doc.autoTable({ head: tableHead, body: tableData, startY: 25, didDrawPage: function() { doc.setFontSize(10); doc.text("Generated: " + new Date().toLocaleString(), 14, 10); } });
    doc.save("Witcorp_Report.pdf");
    saveActivity("Exported PDF Report: " + currentExportType);
    showToast('PDF exported successfully', 'success');
}

function applyGreenHeaders() {
    document.querySelectorAll('th').forEach(th => { th.style.color = '#16a34a'; th.style.fontWeight = '700'; th.style.fontSize = '11px'; th.style.letterSpacing = '0.06em'; });
}

window.addEventListener('DOMContentLoaded', () => { setTimeout(applyGreenHeaders, 400); });

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchBox = document.getElementById('globalSearch');
        if (searchBox) { searchBox.focus(); searchBox.select(); const dashSection = document.getElementById('dashboard'); if (dashSection && !dashSection.classList.contains('active')) { document.getElementById('globalSearchBox').style.display = 'block'; searchBox.focus(); } }
    }
    if (e.key === 'Escape') { document.getElementById('notificationPanel')?.classList.add('hidden'); document.getElementById('profileMenu')?.classList.add('hidden'); document.getElementById('themeModal')?.classList.add('hidden'); document.getElementById('activityModal')?.classList.add('hidden'); document.getElementById('exportModal')?.classList.add('hidden'); }
});
