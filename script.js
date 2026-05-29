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

async function fetchRecords(reset = true) {
    if (isFetchingRecords) return;
    isFetchingRecords = true;
    try {
        if (reset) { recordPage = 0; allRecords = []; }
        const from = recordPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabaseClient
            .from('witcorp_records')
            .select('*')
            .order('updated_at', { ascending: false })
            .range(from, to);
        if (!error && data) {
            const uniqueData = data.filter(n => !allRecords.some(o => o.id === n.id));
            allRecords = [...allRecords, ...uniqueData];
            renderTable(allRecords, 'mainTableBody');
            updateStats(allRecords);
            setupPredictions();
            recordPage++;
            const btn = document.getElementById("loadMoreBtn");
            if (btn) btn.style.display = data.length < PAGE_SIZE ? "none" : "block";
        }
    } catch (err) {
        console.error("fetchRecords error:", err);
    } finally {
        isFetchingRecords = false;
    }
}

// ============================================================
// FIXED renderTable
// 1. Service: har 2 words ek line — clean multi-line wrap
// 2. Remarks: working inline more/less toggle (style.display)
// 3. Updated By: professional blue chip, full email on hover
// ============================================================
function renderTable(data, targetId) {
    currentExportData = data;
    currentExportType = "records";
    const tbody = document.getElementById(targetId);
    if (!tbody) return;
    tbody.innerHTML = data.length === 0
        ? `<tr><td colspan="11" class="p-20 text-center text-slate-400 font-bold text-sm">No active records found.</td></tr>`
        : "";

    data.forEach(row => {
        const statusClass = {
            'Completed': 'st-completed',
            'Pending': 'st-pending',
            'Processing': 'st-processing'
        }[row.status] || 'bg-slate-100';

        const statusIcon = {
            'Completed': 'fa-circle-check',
            'Pending': 'fa-circle-exclamation',
            'Processing': 'fa-spinner fa-spin'
        }[row.status] || 'fa-info-circle';

        // Last Update — compact single line
        let datePart = '', timePart = '';
        if (row.updated_at) {
            const d = new Date(row.updated_at);
            datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
        const lastUpdate = row.updated_at ? `${datePart}, ${timePart}` : 'Syncing...';

        // Service — split every 2 words onto new lines
        const svcWords = (row.service_detail || 'General Consulting').split(' ');
        let svcLines = [];
        for (let i = 0; i < svcWords.length; i += 2) {
            svcLines.push(svcWords.slice(i, i + 2).join(' '));
        }
        const svcDisplay = svcLines.map((line, idx) =>
            `<span style="display:block;font-size:${idx === 0 ? '13px' : '12px'};font-weight:${idx === 0 ? '600' : '500'};color:${idx === 0 ? '#334155' : '#94a3b8'};line-height:1.5;">${line}</span>`
        ).join('');

        // Remarks — inline expand/collapse using style.display (reliable)
        const uid = `rmk_${row.id}`;
        const safeRemarks = (row.remarks || '—').replace(/`/g, '&#96;');
        const CUTOFF = 55;
        const needsExpand = (row.remarks || '').length > CUTOFF;
        const shortRemarks = needsExpand
            ? (row.remarks || '').substring(0, CUTOFF - 1) + '\u2026'
            : (row.remarks || '—');

        const remarksCell = needsExpand ? `
            <div style="min-width:180px;max-width:260px;">
                <span id="${uid}_s" style="font-size:13px;color:#475569;font-weight:400;">${shortRemarks}</span>
                <span id="${uid}_f" style="font-size:13px;color:#475569;font-weight:400;display:none;">${safeRemarks}</span>
                <button onclick="toggleRemark('${uid}')" id="${uid}_btn"
                    style="margin-left:4px;font-size:11px;font-weight:700;color:#3b82f6;background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;vertical-align:middle;">more</button>
            </div>`
            : `<span style="font-size:13px;color:#475569;font-weight:400;">${shortRemarks}</span>`;

        // Updated By — clean blue chip, full email on hover
        const updatedBy = row.updated_by || 'N/A';
        const updatedByShort = updatedBy.includes('@') ? updatedBy.split('@')[0] : updatedBy;
        const updatedByCell = `
            <div style="display:inline-flex;align-items:center;gap:5px;max-width:145px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:4px 9px;" title="${updatedBy}">
                <i class="fas fa-user-circle" style="color:#3b82f6;font-size:12px;flex-shrink:0;"></i>
                <span style="font-size:12px;font-weight:600;color:#1d4ed8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${updatedByShort}</span>
            </div>`;

        tbody.innerHTML += `
            <tr class="group transition-all hover:bg-slate-50/80">
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
                    ${row.deadline ? new Date(row.deadline).toLocaleDateString('en-GB') : 'N/A'}
                </td>
                <td class="p-4 text-center whitespace-nowrap">
                    <span class="status-pill ${statusClass}"><i class="fas ${statusIcon}"></i>${row.status}</span>
                </td>
                <td class="p-4">${remarksCell}</td>
                <td class="p-4 whitespace-nowrap">${updatedByCell}</td>
                <td class="p-4 text-right whitespace-nowrap">
                    <div class="flex justify-end gap-2">
                        <button onclick='editRecord(${JSON.stringify(row)})' class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm hover:scale-110 text-sm">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteRecord(${row.id})" class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm hover:scale-110 text-sm">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });
}

// FIXED toggleRemark — style.display use karta hai, class nahi
function toggleRemark(uid) {
    const short = document.getElementById(uid + '_s');
    const full  = document.getElementById(uid + '_f');
    const btn   = document.getElementById(uid + '_btn');
    if (!short || !full || !btn) return;
    const expanded = full.style.display !== 'none';
    if (expanded) {
        full.style.display = 'none';
        short.style.display = 'inline';
        btn.innerText = 'more';
    } else {
        short.style.display = 'none';
        full.style.display = 'inline';
        btn.innerText = 'less';
    }
}

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
    if (!payload.client_name) return alert("Error: Client Name is mandatory.");

    const { error } = id
        ? await supabaseClient.from('witcorp_records').update(payload).eq('id', id)
        : await supabaseClient.from('witcorp_records').insert([payload]);

    if (!error) {
        const actionText = id
            ? `Updated Record: ${payload.client_name} | ${payload.service_category} | Status: ${payload.status}`
            : `Added Record: ${payload.client_name} | ${payload.service_category} | ${payload.service_detail || 'N/A'}`;
        saveActivity(actionText);

        await createNotificationForOthers(
            id ? "Record Updated" : "New Record Added",
            `${payload.client_name} — ${payload.service_category} updated by ${currentUserName}`,
            "record",
            payload.client_name
        );

        alert(id ? "Record Updated!" : "Record Successfully Added!");
        clearForm();
        await fetchRecords(true);
        showSection('dashboard');
    } else {
        alert("Sync Error: Please check connection.");
    }
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
    ['clientName', 'serviceCategory', 'serviceDetail', 'assignedStaff', 'allotedBy', 'deadline'].forEach(id => {
        document.getElementById(id).disabled = true;
    });
    showSection('dashboard');
    setTimeout(() => {
        document.getElementById('entryFormAnchor').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

async function deleteRecord(id) {
    if (confirm("Confirm: Are you sure you want to delete this record?")) {
        const rec = allRecords.find(r => r.id === id);
        await supabaseClient.from('witcorp_records').delete().eq('id', id);
        const logText = rec
            ? `Deleted Record: ${rec.client_name} | ${rec.service_category} | ${rec.service_detail || 'N/A'}`
            : `Deleted Record ID: ${id}`;
        saveActivity(logText);
        fetchRecords();
    }
}

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
    Object.values(containers).forEach(id => document.getElementById(id).innerHTML = "");
    data.forEach(c => {
        const listId = containers[c.entity_type] || 'othersList';
        document.getElementById(listId).innerHTML += `
            <div class="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-blue-400 transition-all group">
                <div class="font-bold text-slate-800 text-sm">${c.client_name}</div>
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
    const payload = {
        client_name: document.getElementById('cName').value,
        contact_number: document.getElementById('cPhone').value,
        email_id: document.getElementById('cEmail').value,
        entity_type: document.getElementById('cType').value,
        updated_by: currentUserName
    };
    if (!payload.client_name) return alert("Entity Name Required");
    const { error } = id
        ? await supabaseClient.from('witcorp_clients').update(payload).eq('id', id)
        : await supabaseClient.from('witcorp_clients').insert([payload]);
    if (!error) {
        await createNotificationForOthers(
            id ? "Client Updated" : "New Client Added",
            `${payload.client_name} profile updated by ${currentUserName}`,
            "client"
        );
        saveActivity(`${id ? 'Updated' : 'Added'} Client: ${payload.client_name} | ${payload.entity_type}`);
        fetchClients();
        document.getElementById('cEditId').value = "";
        ['cName', 'cPhone', 'cEmail'].forEach(i => document.getElementById(i).value = "");
        document.getElementById('clientBtn').innerText = "Save Client Profile";
    }
}

async function deleteClient(id) {
    if (confirm("Action: Delete client profile?")) {
        const c = allClients.find(x => x.id === id);
        await supabaseClient.from('witcorp_clients').delete().eq('id', id);
        if (c) saveActivity(`Deleted Client: ${c.client_name} | ${c.entity_type}`);
        fetchClients();
    }
}

async function fetchVault() {
    const { data, error } = await supabaseClient
        .from('witcorp_credentials')
        .select('*')
        .limit(300);
    if (error) return;
    allVault = data;
    currentExportData = data;
    currentExportType = "vault";
    setupPredictions();
    const tbody = document.getElementById('vaultTableBody');
    tbody.innerHTML = "";
    data.forEach(v => {
        const fullPass = v.password || '';
        const shortPass = fullPass.length > 20 ? fullPass.substring(0, 18) + '\u2026' : fullPass;
        tbody.innerHTML += `
            <tr class="group hover:bg-slate-50">
                <td class="p-4 font-bold text-blue-900 text-sm whitespace-nowrap">${v.client_name || 'N/A'}</td>
                <td class="p-4 whitespace-nowrap"><span class="px-2 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">${v.category}</span></td>
                <td class="p-4 font-semibold text-blue-600 text-sm whitespace-nowrap">${v.username}</td>
                <td class="p-4 font-mono text-sm whitespace-nowrap" title="${fullPass.replace(/"/g,'&quot;')}"><span class="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-inner">${shortPass}</span></td>
                <td class="p-4 text-sm font-semibold text-blue-700 whitespace-nowrap">${v.updated_by || 'N/A'}</td>
                <td class="p-4 text-right whitespace-nowrap"><div class="flex gap-3 justify-end items-center">
                    <button onclick='editVault(${JSON.stringify(v)})' class="text-blue-500 hover:scale-125 transition-transform text-sm"><i class="fas fa-pencil"></i></button>
                    <button onclick="deleteVault(${v.id})" class="text-rose-500 hover:scale-125 transition-transform text-sm"><i class="fas fa-trash-alt"></i></button>
                </div></td>
            </tr>`;
    });
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
    const payload = {
        client_name: document.getElementById('vClient').value,
        category: document.getElementById('vCat').value,
        username: document.getElementById('vUser').value,
        password: document.getElementById('vPass').value,
        updated_by: currentUserName
    };
    if (!payload.category || !payload.client_name) return alert("Error: Required fields missing.");
    const { error } = id
        ? await supabaseClient.from('witcorp_credentials').update(payload).eq('id', id)
        : await supabaseClient.from('witcorp_credentials').insert([payload]);
    if (!error) {
        await createNotificationForOthers(
            id ? "Vault Updated" : "Credentials Added",
            `${payload.client_name} credentials updated by ${currentUserName}`,
            "vault"
        );
        saveActivity(`${id ? 'Updated' : 'Added'} Vault: ${payload.client_name} | ${payload.category}`);
        fetchVault();
        document.getElementById('vEditId').value = "";
        ['vClient', 'vCat', 'vUser', 'vPass'].forEach(i => document.getElementById(i).value = "");
        document.getElementById('vaultBtn').innerText = "Store Securely";
    }
}

async function deleteVault(id) {
    if (confirm("Security: Confirm credential deletion?")) {
        const v = allVault.find(x => x.id === id);
        await supabaseClient.from('witcorp_credentials').delete().eq('id', id);
        if (v) saveActivity(`Deleted Vault: ${v.client_name} | ${v.category}`);
        fetchVault();
    }
}

function toggleAccountingHub() {
    document.getElementById('accountinghubMenu').classList.toggle('hidden');
}
function toggleAccountingHubDesktop() {
    document.getElementById('accountinghubDesktopMenu').classList.toggle('hidden');
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const globalSearch = document.getElementById('globalSearchBox');
    if (id === 'clientManagement' || id === 'vaultManagement' || id === 'dscManagement') {
        globalSearch.style.display = 'none';
    } else {
        globalSearch.style.display = 'block';
    }
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const section = document.getElementById(id);
    if (section) section.classList.add('active');
    if (id === 'dashboard') document.getElementById('nav-dashboard')?.classList.add('active');
    if (id === 'clientManagement') document.getElementById('nav-client')?.classList.add('active');
    if (id === 'vaultManagement') document.getElementById('nav-vault')?.classList.add('active');
    if (id === 'dscManagement') document.getElementById('nav-dsc')?.classList.add('active');
    if (id === 'dashboard' && allRecords.length === 0) fetchRecords();
    if (id === 'clientManagement') fetchClients();
    if (id === 'vaultManagement') fetchVault();
    if (id === 'dscManagement') fetchDSC();
}

function filterByField(field, value) {
    showSection('filterView');
    let filtered = field === 'all' ? [...allRecords] : allRecords.filter(r => r[field] === value);
    const titles = {
        "Sales": "Sales", "Purchases": "Purchases", "Sundry Debtors": "Sundry Debtors",
        "Sundry Creditors": "Sundry Creditors", "Payroll Entries": "Payroll Entries",
        "Bank Statement": "Bank Statement", "GST Transfer Entries": "GST Transfer Entries",
        "Depreciation Entries": "Depreciation Entries", "TDS Entries": "TDS Entries",
        "Miscellaneous Ledgers": "Miscellaneous Ledgers", "GST": "GST Compliance",
        "ROC": "Corporate Compliance (ROC)", "IT": "Income Tax", "PT": "Professional Tax",
        "TDS": "TDS Compliance", "DIRECTOR KYC": "Director KYC", "UDIN": "UDIN/Certification",
        "FOOD": "Food License", "MSME": "MSME Certification", "PAYROLL": "Payroll",
        "REPORTS": "Reports", "Completed": "Completed Records", "Pending": "Pending Records"
    };
    document.getElementById('filterTitle').innerText = `${titles[value] || value || 'All'} Portal View`;
    renderTable(filtered, 'filterTableBody');
}

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

function updateStats(data) {
    document.getElementById('statTotal').innerText = data.length;
    document.getElementById('statDone').innerText = data.filter(r => r.status === 'Completed').length;
    document.getElementById('statPending').innerText = data.filter(r => r.status === 'Pending').length;
}

async function refreshData() {
    const btn = document.getElementById("refreshBtn");
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Refreshing';
    await fetchRecords(true);
    renderTable(allRecords, 'mainTableBody');
    btn.innerHTML = '<i class="fas fa-check mr-1"></i> Updated';
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-rotate-right mr-1"></i> Refresh'; }, 1500);
}

function clearForm() {
    document.getElementById('editId').value = "";
    document.getElementById('formTitle').innerText = "Management Portal";
    document.getElementById('submitBtn').innerHTML = `<i class="fas fa-cloud-arrow-up text-xl"></i> Sync To WitcorpDB`;
    document.getElementById('editBadge').classList.add('hidden');
    ['clientName', 'serviceCategory', 'serviceDetail', 'assignedStaff', 'allotedBy', 'deadline', 'status', 'remarks'].forEach(i => {
        const el = document.getElementById(i);
        if (i === 'serviceCategory') { el.value = 'Sales'; }
        else if (i === 'status') { el.value = 'Pending'; }
        else { el.value = ""; }
        el.disabled = false;
    });
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
    if (!data || !data.approved) { alert("Not approved by admin yet"); logout(); return; }
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
}

async function logout() {
    await supabaseClient.auth.signOut();
    location.reload();
}

supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) checkApproval(data.session.user);
});

function toggleMenu() {
    const menu = document.getElementById("mobileMenu");
    menu.classList.toggle("hidden");
    if (menu.classList.contains("hidden")) { document.body.classList.remove("menu-open"); }
    else { document.body.classList.add("menu-open"); }
}

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
        return aS - bS;
    });
    const containers = { 'Pvt Ltd': 'pvtLtdList', 'LLP': 'llpList', 'Others': 'othersList' };
    Object.values(containers).forEach(id => { document.getElementById(id).innerHTML = ""; });
    filtered.forEach(c => {
        const listId = containers[c.entity_type] || 'othersList';
        document.getElementById(listId).innerHTML += `
            <div class="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-blue-400 transition-all group">
                <div class="font-bold text-slate-800 text-sm">${c.client_name}</div>
                <div class="text-xs text-slate-500 font-semibold mt-1"><i class="fas fa-phone-alt mr-1.5 text-blue-500"></i>${c.contact_number}</div>
                <div class="text-xs text-blue-600 font-semibold break-all mt-1 opacity-70 group-hover:opacity-100"><i class="fas fa-envelope mr-1.5"></i>${c.email_id}</div>
                <div class="mt-4 flex gap-4 border-t border-slate-200/50 pt-3">
                    <button onclick='editClient(${JSON.stringify(c)})' class="text-xs text-blue-600 font-bold uppercase hover:scale-110 transition-transform">Modify</button>
                    <button onclick="deleteClient(${c.id})" class="text-xs text-rose-500 font-bold uppercase hover:scale-110 transition-transform">Delete</button>
                </div>
            </div>`;
    });
    if (query.trim() === "") fetchClients();
}

function searchVault(query) {
    const q = query.toLowerCase();
    const filtered = allVault.filter(v =>
        v.client_name?.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        v.username?.toLowerCase().includes(q)
    );
    const tbody = document.getElementById('vaultTableBody');
    tbody.innerHTML = "";
    filtered.forEach(v => {
        const fullPass = v.password || '';
        const shortPass = fullPass.length > 20 ? fullPass.substring(0, 18) + '\u2026' : fullPass;
        tbody.innerHTML += `
            <tr class="group hover:bg-slate-50">
                <td class="p-4 font-bold text-blue-900 text-sm whitespace-nowrap">${v.client_name || 'N/A'}</td>
                <td class="p-4 whitespace-nowrap"><span class="px-2 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">${v.category}</span></td>
                <td class="p-4 font-semibold text-blue-600 text-sm whitespace-nowrap">${v.username}</td>
                <td class="p-4 font-mono text-sm whitespace-nowrap" title="${fullPass.replace(/"/g,'&quot;')}"><span class="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-inner">${shortPass}</span></td>
                <td class="p-4 text-sm font-semibold text-blue-700 whitespace-nowrap">${v.updated_by || 'N/A'}</td>
                <td class="p-4 text-right whitespace-nowrap"><div class="flex gap-3 justify-end items-center">
                    <button onclick='editVault(${JSON.stringify(v)})' class="text-blue-500 hover:scale-125 transition-transform text-sm"><i class="fas fa-pencil"></i></button>
                    <button onclick="deleteVault(${v.id})" class="text-rose-500 hover:scale-125 transition-transform text-sm"><i class="fas fa-trash-alt"></i></button>
                </div></td>
            </tr>`;
    });
    if (query.trim() === "") fetchVault();
}

async function fetchDSC() {
    const { data, error } = await supabaseClient
        .from('witcorp_dsc')
        .select('*')
        .order('updated_at', { ascending: false });
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
    data.forEach(d => {
        const fullRem = d.remarks || '—';
        const shortRem = fullRem.length > 50 ? fullRem.substring(0, 48) + '\u2026' : fullRem;
        const updatedAt = d.updated_at ? (() => {
            const dt = new Date(d.updated_at);
            return dt.toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) + ', ' + dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
        })() : 'N/A';
        tbody.innerHTML += `
            <tr class="border-b border-slate-200 hover:bg-slate-50">
                <td class="p-4 font-bold text-sm text-slate-800 whitespace-nowrap">${d.company_name || ''}</td>
                <td class="p-4 font-semibold text-sm text-slate-600 whitespace-nowrap">${d.client_name || ''}</td>
                <td class="p-4 font-semibold text-sm whitespace-nowrap">${d.status || ''}</td>
                <td class="p-4 font-semibold text-sm text-slate-600 whitespace-nowrap">${d.expiry_date || ''}</td>
                <td class="p-4 text-sm text-slate-600 max-w-[200px]" title="${fullRem.replace(/"/g,'&quot;')}"><span class="block">${shortRem}</span></td>
                <td class="p-4 text-sm font-semibold text-blue-700 whitespace-nowrap">${d.updated_by || 'N/A'}</td>
                <td class="p-4 text-sm font-semibold text-slate-500 whitespace-nowrap">${updatedAt}</td>
                <td class="p-4 text-right whitespace-nowrap">
                    <div class="flex gap-2 justify-end items-center">
                        <button onclick='editDSC(${JSON.stringify(d)})' class="px-3 py-1 bg-blue-500 text-white rounded text-sm font-semibold">Edit</button>
                        <button onclick="deleteDSC(${d.id})" class="px-3 py-1 bg-red-500 text-white rounded text-sm font-semibold">Delete</button>
                    </div>
                </td>
            </tr>`;
    });
}

async function saveDSC() {
    const btn = document.getElementById('dscBtn');
    btn.disabled = true;
    const id = document.getElementById('dEditId').value;
    const payload = {
        company_name: document.getElementById('dCompany').value.trim(),
        client_name: document.getElementById('dClient').value.trim(),
        status: document.getElementById('dStatus').value,
        expiry_date: document.getElementById('dExpiry').value,
        remarks: document.getElementById('dRemarks').value.trim(),
        updated_by: currentUserName,
        updated_at: new Date().toISOString()
    };
    if (!payload.company_name) { btn.disabled = false; return alert("Company Name Required"); }
    let error;
    if (id) { ({ error } = await supabaseClient.from('witcorp_dsc').update(payload).eq('id', id)); }
    else { ({ error } = await supabaseClient.from('witcorp_dsc').insert([payload])); }
    if (!error) {
        await createNotificationForOthers(
            id ? "DSC Updated" : "New DSC Added",
            `${payload.company_name} DSC updated by ${currentUserName}`,
            "dsc"
        );
        saveActivity(`${id ? 'Updated' : 'Added'} DSC: ${payload.company_name} | ${payload.client_name} | Status: ${payload.status}`);
        alert(id ? "DSC Updated Successfully" : "DSC Saved Successfully");
        await new Promise(r => setTimeout(r, 300));
        await fetchDSC();
        document.getElementById('dEditId').value = "";
        ['dCompany', 'dClient', 'dExpiry', 'dRemarks'].forEach(i => document.getElementById(i).value = "");
        document.getElementById('dStatus').value = "Valid";
        document.getElementById('dscBtn').innerText = "Save DSC Status";
    } else {
        alert("Supabase Error — Check Console");
        console.error("DSC ERROR:", error);
    }
    btn.disabled = false;
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
        await supabaseClient.from('witcorp_dsc').delete().eq('id', id);
        if (d) saveActivity(`Deleted DSC: ${d.company_name} | ${d.client_name}`);
        await fetchDSC();
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

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => console.log("SW registered"));
}

function toggleProfileMenu() {
    document.getElementById("profileMenu").classList.toggle("hidden");
}

document.addEventListener("click", function (event) {
    const menu = document.getElementById("profileMenu");
    if (!event.target.closest("#profileMenu") && !event.target.closest("[onclick='toggleProfileMenu()']")) {
        menu.classList.add("hidden");
    }
});

function openThemeSettings() { document.getElementById("themeModal").classList.remove("hidden"); }
function closeThemeSettings() { document.getElementById("themeModal").classList.add("hidden"); }

async function createNotification(title, message, type = "info", reference = "") {
    await supabaseClient.from('witcorp_notifications').insert([{
        title, message, type, reference,
        created_by: currentUserName,
        is_read: false
    }]);
}

async function createNotificationForOthers(title, message, type = "info", reference = "") {
    await supabaseClient.from('witcorp_notifications').insert([{
        title, message, type, reference,
        created_by: currentUserName,
        is_read: false
    }]);
}

async function fetchNotifications() {
    const { data, error } = await supabaseClient
        .from('witcorp_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
    if (error) return;
    allNotifications = data;
    renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById('notificationList');
    const count = document.getElementById('notificationCount');
    list.innerHTML = "";
    const unread = allNotifications.filter(n => !n.is_read);
    unreadCount = unread.length;
    if (unreadCount > 0) { count.classList.remove('hidden'); count.innerText = unreadCount; }
    else { count.classList.add('hidden'); }

    allNotifications.forEach(n => {
        list.innerHTML += `
            <div
                data-notif-id="${n.id}"
                data-notif-type="${n.type}"
                data-notif-ref="${(n.reference || '').replace(/"/g, '&quot;')}"
                class="p-4 cursor-pointer border-b border-slate-100 transition-all hover:bg-slate-50
                ${!n.is_read ? 'bg-blue-50' : 'bg-white'}
                ${n.is_read ? 'opacity-60' : ''}">
                <div class="font-bold text-sm text-slate-800">${n.title}</div>
                <div class="text-sm text-slate-500 mt-1">${n.message}</div>
                <div class="text-xs text-blue-600 mt-2 font-semibold">${new Date(n.created_at).toLocaleString('en-IN')}</div>
            </div>`;
    });
    list.querySelectorAll('[data-notif-id]').forEach(el => {
        el.addEventListener('click', function () {
            openNotification(parseInt(this.dataset.notifId), this.dataset.notifType, this.dataset.notifRef);
        });
    });
}

function toggleNotificationPanel() {
    document.getElementById('notificationPanel').classList.toggle('hidden');
}

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
            try {
                const audio = new Audio('https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3');
                audio.play().catch(() => {});
            } catch(e) {}
            navigator.serviceWorker?.ready.then(reg => {
                reg.showNotification(payload.new.title || "New Update", {
                    body: payload.new.message || "Database updated",
                    icon: "./logo.png",
                    badge: "./logo.png"
                });
            }).catch(() => {});
        }
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
    const sidebarThemes = [
        'sidebar-theme-raspberry', 'sidebar-theme-mint', 'sidebar-theme-chill',
        'sidebar-theme-forest', 'sidebar-theme-damini', 'sidebar-theme-seaglass',
        'sidebar-theme-lemon', 'sidebar-theme-dark', 'sidebar-theme-navypro',
        'sidebar-theme-original'
    ];
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
    clientList.innerHTML = uniqueClients.map(name => `<option value="${name}">`).join('');

    const serviceList = document.getElementById('serviceSuggestions');
    const uniqueServices = [...new Set(allRecords.map(r => r.service_detail).filter(Boolean))];
    serviceList.innerHTML = uniqueServices.map(name => `<option value="${name}">`).join('');

    const staffList = document.getElementById('staffSuggestions');
    const uniqueStaff = [...new Set(allRecords.map(r => r.assigned_staff).filter(Boolean))];
    staffList.innerHTML = uniqueStaff.map(name => `<option value="${name}">`).join('');

    const allotList = document.getElementById('allotedSuggestions');
    const uniqueAlloted = [...new Set(allRecords.map(r => r.alloted_by).filter(Boolean))];
    allotList.innerHTML = uniqueAlloted.map(name => `<option value="${name}">`).join('');

    const companyList = document.getElementById('companySuggestions');
    const uniqueCompany = [...new Set(allDSC.map(d => d.company_name).filter(Boolean))];
    companyList.innerHTML = uniqueCompany.map(name => `<option value="${name}">`).join('');

    const vaultList = document.getElementById('vaultCategorySuggestions');
    const uniqueVault = [...new Set(allVault.map(v => v.category).filter(Boolean))];
    vaultList.innerHTML = uniqueVault.map(name => `<option value="${name}">`).join('');
}

async function forgotPassword() {
    const email = document.getElementById("email").value;
    if (!email) return alert("Please enter your email first");
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname + "?reset=true"
    });
    if (error) { alert(error.message); } else { alert("Password reset link sent to your email."); }
}

window.addEventListener('load', async () => {
    const hash = window.location.hash;
    if (hash.includes("access_token") && hash.includes("type=recovery")) {
        const newPassword = prompt("Enter New Password");
        if (!newPassword) return;
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) { alert(error.message); } else {
            alert("Password updated successfully!");
            window.location.href = window.location.pathname;
        }
    }
});

function loadNotificationSetting() {
    const sound = localStorage.getItem("notificationSound");
    const status = document.getElementById("notificationStatus");
    if (!status) return;
    if (sound === "off") {
        status.innerText = "OFF";
        status.classList.remove("text-green-600");
        status.classList.add("text-red-500");
    } else {
        status.innerText = "ON";
        status.classList.remove("text-red-500");
        status.classList.add("text-green-600");
    }
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
    const iconMap = {
        'Added': 'fa-circle-plus text-emerald-500',
        'Updated': 'fa-pen-to-square text-blue-500',
        'Deleted': 'fa-trash-can text-rose-500',
        'Exported': 'fa-file-export text-purple-500',
        'Default': 'fa-clock-rotate-left text-slate-400'
    };

    let html = "";
    if (activity.length === 0) {
        html = `<div class="text-center text-slate-400 py-10 font-semibold">No activity recorded yet.</div>`;
    } else {
        activity.forEach(item => {
            const verb = Object.keys(iconMap).find(k => item.text.startsWith(k)) || 'Default';
            const icon = iconMap[verb];
            const parts = item.text.split('|').map(p => p.trim());
            const mainText = parts[0] || item.text;
            const details = parts.slice(1);

            html += `
                <div class="flex items-start gap-3 border-b border-slate-100 py-4 last:border-0">
                    <div class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i class="fas ${icon} text-sm"></i>
                    </div>
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
    if (rows.length === 0) { alert("No records found"); return; }
    let csv = "";
    if (currentExportType === "records") {
        csv = "Client,Category,Service,Staff,Status,Deadline\n";
        rows.forEach(r => { csv += `"${r.client_name||""}","${r.service_category||""}","${r.service_detail||""}","${r.assigned_staff||""}","${r.status||""}","${r.deadline||""}"\n`; });
    } else if (currentExportType === "clients") {
        csv = "Client Name,Phone,Email,Type\n";
        rows.forEach(r => { csv += `"${r.client_name||""}","${r.contact_number||""}","${r.email_id||""}","${r.entity_type||""}"\n`; });
    } else if (currentExportType === "vault") {
        csv = "Client,Category,Username,Password,Updated By\n";
        rows.forEach(r => { csv += `"${r.client_name||""}","${r.category||""}","${r.username||""}","${r.password||""}","${r.updated_by||""}"\n`; });
    } else if (currentExportType === "dsc") {
        csv = "Company,Client,Status,Expiry Date,Remarks\n";
        rows.forEach(r => { csv += `"${r.company_name||""}","${r.client_name||""}","${r.status||""}","${r.expiry_date||""}","${r.remarks||""}"\n`; });
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = currentExportType + ".csv";
    a.click();
    saveActivity("Exported CSV Report: " + currentExportType);
}

function exportExcel() {
    let rows = currentExportData || [];
    if (rows.length === 0) { alert("No records found"); return; }
    let csv = "";
    if (currentExportType === "records") {
        csv = "Client,Category,Service,Staff,Alloted By,Status,Deadline,Remarks,Updated By\n";
        rows.forEach(r => { csv += `"${r.client_name||""}","${r.service_category||""}","${r.service_detail||""}","${r.assigned_staff||""}","${r.alloted_by||""}","${r.status||""}","${r.deadline||""}","${r.remarks||""}","${r.updated_by||""}"\n`; });
    } else if (currentExportType === "clients") {
        csv = "Client Name,Phone,Email,Type,Updated By\n";
        rows.forEach(r => { csv += `"${r.client_name||""}","${r.contact_number||""}","${r.email_id||""}","${r.entity_type||""}","${r.updated_by||""}"\n`; });
    } else if (currentExportType === "vault") {
        csv = "Client,Category,Username,Password,Updated By\n";
        rows.forEach(r => { csv += `"${r.client_name||""}","${r.category||""}","${r.username||""}","${r.password||""}","${r.updated_by||""}"\n`; });
    } else if (currentExportType === "dsc") {
        csv = "Company,Client,Status,Expiry Date,Remarks,Updated By\n";
        rows.forEach(r => { csv += `"${r.company_name||""}","${r.client_name||""}","${r.status||""}","${r.expiry_date||""}","${r.remarks||""}","${r.updated_by||""}"\n`; });
    }
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Witcorp_" + currentExportType + ".xls";
    a.click();
    saveActivity("Exported Excel Report: " + currentExportType);
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("landscape");
    let rows = currentExportData || [];
    if (rows.length === 0) { alert("No records found"); return; }
    let tableHead = [], tableData = [];
    if (currentExportType === "vault") {
        tableHead = [["Client", "Category", "Username", "Password", "Updated By"]];
        tableData = rows.map(r => [r.client_name||"", r.category||"", r.username||"", r.password||"", r.updated_by||""]);
    } else if (currentExportType === "clients") {
        tableHead = [["Client", "Phone", "Email", "Type"]];
        tableData = rows.map(r => [r.client_name||"", r.contact_number||"", r.email_id||"", r.entity_type||""]);
    } else if (currentExportType === "dsc") {
        tableHead = [["Company", "Client", "Status", "Expiry Date", "Remarks"]];
        tableData = rows.map(r => [r.company_name||"", r.client_name||"", r.status||"", r.expiry_date||"", r.remarks||""]);
    } else {
        tableHead = [["Client", "Category", "Service", "Staff", "Alloted By", "Status", "Deadline", "Remarks", "Updated By"]];
        tableData = rows.map(r => [r.client_name||"", r.service_category||"", r.service_detail||"", r.assigned_staff||"", r.alloted_by||"", r.status||"", r.deadline||"", r.remarks||"", r.updated_by||""]);
    }
    doc.setFontSize(16);
    doc.text("Witcorp Hub Report", 14, 15);
    doc.autoTable({
        head: tableHead, body: tableData, startY: 25,
        didDrawPage: function () { doc.setFontSize(10); doc.text("Generated: " + new Date().toLocaleString(), 14, 10); }
    });
    doc.save("Witcorp_Report.pdf");
    saveActivity("Exported PDF Report: " + currentExportType);
}
