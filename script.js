               const SB_URL = 'https://yznyimxtlamdzotfgajz.supabase.co';
        const SB_KEY = 'sb_publishable_6I-WD5gRpeqgR_JIecUSsw_1yaux_3y';
        const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

        let allRecords = [];
        let allClients = [];
        let allVault = [];
        let allDSC = [];
        let allNotifications = [];
        let unreadCount = 0;
        let currentUserEmail = "";
        let currentUserName = "";
        let recordPage = 0;
        const PAGE_SIZE = 100;
        let isFetchingRecords = false;
        async function fetchRecords(reset = true) {

    if (isFetchingRecords) return;

    isFetchingRecords = true;

    if (reset) {
        recordPage = 0;
        allRecords = [];
    }

    const from = recordPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabaseClient
        .from('witcorp_records')
        .select('*')
        .order('updated_at', { ascending: false })
        .range(from, to);

    if (!error && data) {

        const uniqueData = data.filter(
            newItem => !allRecords.some(
                oldItem => oldItem.id === newItem.id
            )
        );

        allRecords = [...allRecords, ...uniqueData];

        renderTable(allRecords, 'mainTableBody');

        updateStats(allRecords);

        recordPage++;

        const btn = document.getElementById("loadMoreBtn");

        if (btn) {

            if (data.length < PAGE_SIZE) {
                btn.style.display = "none";
            } else {
                btn.style.display = "block";
            }

        }
    }

    isFetchingRecords = false;
}
        function renderTable(data, targetId) {
            const tbody = document.getElementById(targetId);
            if (!tbody) return;
            tbody.innerHTML = data.length === 0 ? `<tr><td colspan="9" class="p-20 text-center text-slate-400 font-bold">No active records found.</td></tr>` : "";
            data.forEach(row => {
                const statusClass = {'Completed': 'st-completed', 'Pending': 'st-pending', 'Processing': 'st-processing'}[row.status] || 'bg-slate-100';
                const statusIcon = {'Completed': 'fa-circle-check', 'Pending': 'fa-circle-exclamation', 'Processing': 'fa-spinner fa-spin'}[row.status] || 'fa-info-circle';
                const lastUpdate = row.updated_at ? new Date(row.updated_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' }) : 'Syncing...';

                tbody.innerHTML += `
                    <tr class="group transition-all hover:bg-slate-50/80">
                        <td class="p-4 font-black text-slate-800 text-sm tracking-tight">${row.client_name}</td>
                        <td class="p-4 text-[9px] font-black text-slate-400 uppercase"><i class="far fa-clock text-blue-400 mr-1"></i> ${lastUpdate}</td>
                        <td class="p-4 text-center text-[11px] text-slate-500 font-bold">${row.service_detail || 'General Consulting'}</td>
                        <td class="p-4 text-center"><div class="inline-block px-3 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase shadow-sm tracking-widest">${row.service_category}</div></td>
                        <td class="p-4 text-center"><div class="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 shadow-sm"><i class="fas fa-user-tie text-blue-500"></i> ${row.assigned_staff || 'TBD'}</div></td>
                        <td class="p-4 text-center"><div class="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-xl text-[10px] font-black text-cyan-700 shadow-sm"><i class="fas fa-user-check"></i>${row.alloted_by || 'N/A'}</div></td>
                        <td class="p-4 text-center font-black text-slate-500 text-[11px]">${row.deadline ? new Date(row.deadline).toLocaleDateString('en-GB') : 'N/A'}</td>
                        <td class="p-4 text-center"><span class="status-pill ${statusClass}"><i class="fas ${statusIcon}"></i> ${row.status}</span></td>
                        <td class="p-4 text-slate-600 text-[11px] italic font-medium whitespace-normal break-words leading-5 max-w-[350px]">${row.remarks || '---'}</td>
                        <td class="p-4 max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-bold text-blue-700">${row.updated_by || 'N/A'}</td>
                        <td class="p-4 text-right"><div class="flex justify-end gap-3"><button onclick='editRecord(${JSON.stringify(row)})' class="w-10 h-10 rounded-xl bg-white border border-slate-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm hover:scale-110"><i class="fas fa-edit"></i></button><button onclick="deleteRecord(${row.id})" class="w-10 h-10 rounded-xl bg-white border border-slate-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm hover:scale-110"><i class="fas fa-trash-alt"></i></button></div></td>
                    </tr>`;
            });
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
                console.log("PAYLOAD:", payload);
                console.log("ID:", id);

            if (!payload.client_name) return alert("Error: Client Name is mandatory.");

            const { error } = id 
                ? await supabaseClient.from('witcorp_records').update(payload).eq('id', id) 
                : await supabaseClient.from('witcorp_records').insert([payload]);

            if (!error) { 
                    await createNotification(
    id ? "Record Updated" : "New Record Added",
    `${payload.client_name} - ${payload.service_category} updated by ${currentUserName}`,
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
            document.getElementById('serviceDetail').value = row.service_detail;
            document.getElementById('assignedStaff').value = row.assigned_staff;
            document.getElementById('allotedBy').value = row.alloted_by;
            document.getElementById('deadline').value = row.deadline? row.deadline.split('T')[0]: "";
            document.getElementById('status').value = row.status;
            document.getElementById('remarks').value = row.remarks;
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
            if(confirm("Confirm: Are you sure you want to delete this record?")) {
                await supabaseClient.from('witcorp_records').delete().eq('id', id);
                fetchRecords();
            }
        }

        async function fetchClients() {
            const { data, error } = await supabaseClient.from('witcorp_clients').select('*').order('client_name', { ascending: true }).limit(300);
            if (error) return;
            allClients = data;
            const containers = { 'Pvt Ltd': 'pvtLtdList', 'LLP': 'llpList', 'Others': 'othersList' };
            Object.values(containers).forEach(id => document.getElementById(id).innerHTML = "");
            
            data.forEach(c => {
                const listId = containers[c.entity_type] || 'othersList';
                document.getElementById(listId).innerHTML += `
                    <div class="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-blue-400 transition-all group">
                        <div class="font-black text-slate-800 text-sm">${c.client_name}</div>
                        <div class="text-[10px] text-slate-500 font-bold mt-1"><i class="fas fa-phone-alt mr-1.5 text-blue-500"></i> ${c.contact_number}</div>
                        <div class="text-[10px] text-blue-600 font-black break-all mt-1 opacity-70 group-hover:opacity-100"><i class="fas fa-envelope mr-1.5"></i> ${c.email_id}</div>
                        <div class="text-[10px] text-green-600 font-black mt-1">Updated By: ${c.updated_by || 'N/A'}</div>
                        <div class="mt-4 flex gap-4 border-t border-slate-200/50 pt-3">
                            <button onclick='editClient(${JSON.stringify(c)})' class="text-[9px] text-blue-600 font-black uppercase hover:scale-110 transition-transform">Modify</button>
                            <button onclick="deleteClient(${c.id})" class="text-[9px] text-rose-500 font-black uppercase hover:scale-110 transition-transform">Delete</button>
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
            document.getElementById('cName').scrollIntoView({
    behavior: 'smooth',
    block: 'center'
});
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
            if(!payload.client_name) return alert("Entity Name Required");
            const { error } = id 
                ? await supabaseClient.from('witcorp_clients').update(payload).eq('id', id)
                : await supabaseClient.from('witcorp_clients').insert([payload]);
            if(!error) { 
                    await createNotification(

    id ? "Client Updated" : "New Client Added",

    `${payload.client_name} profile updated by ${currentUserName}`,

    "client"

);
                fetchClients(); 
                document.getElementById('cEditId').value = "";
                ['cName','cPhone','cEmail'].forEach(i => document.getElementById(i).value = ""); 
                document.getElementById('clientBtn').innerText = "Save Client Profile";
            }
        }

        async function deleteClient(id) {
            if(confirm("Action: Delete client profile?")) {
                await supabaseClient.from('witcorp_clients').delete().eq('id', id);
                fetchClients();
            }
        }

        async function fetchVault() {
            const { data, error } = await supabaseClient.from('witcorp_credentials').select('*').limit(300);
            if (error) return;
            allVault = data;
            const tbody = document.getElementById('vaultTableBody');
            tbody.innerHTML = "";
            data.forEach(v => {
                tbody.innerHTML += `
                    <tr class="group hover:bg-slate-50">
                        <td class="p-4 font-black text-blue-900 text-sm tracking-tight">${v.client_name || 'N/A'}</td>
                        <td class="p-4 font-black text-slate-700 text-sm"><span class="px-2 py-1 bg-slate-100 rounded-lg text-[10px]">${v.category}</span></td>
                        <td class="p-4 font-bold text-blue-600 text-sm">${v.username}</td>
                        <td class="p-4 font-mono text-xs"><span class="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-inner">${v.password}</span></td>
                        <td class="p-4 text-[11px] font-bold text-blue-700">${v.updated_by || 'N/A'}</td>
                        <td class="p-4 text-right flex gap-3 justify-end items-center">
                            <button onclick='editVault(${JSON.stringify(v)})' class="text-blue-500 hover:scale-125 transition-transform"><i class="fas fa-pencil"></i></button>
                            <button onclick="deleteVault(${v.id})" class="text-rose-500 hover:scale-125 transition-transform"><i class="fas fa-trash-alt"></i></button>
                        </td>
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
            document.getElementById('vClient').scrollIntoView({
    behavior: 'smooth',
    block: 'center'
});
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
            if(!payload.category || !payload.client_name) return alert("Error: Required fields missing.");
            const { error } = id 
                ? await supabaseClient.from('witcorp_credentials').update(payload).eq('id', id)
                : await supabaseClient.from('witcorp_credentials').insert([payload]);
            if(!error) { 
                    await createNotification(

    id ? "Vault Updated" : "Credentials Added",

    `${payload.client_name} credentials updated by ${currentUserName}`,

    "vault"

);
                fetchVault(); 
                document.getElementById('vEditId').value = "";
                ['vClient','vCat','vUser','vPass'].forEach(i => document.getElementById(i).value = ""); 
                document.getElementById('vaultBtn').innerText = "Store Securely";
            }
        }

        async function deleteVault(id) {
            if(confirm("Security: Confirm credential deletion?")) {
                await supabaseClient.from('witcorp_credentials').delete().eq('id', id);
                fetchVault();
            }
        }
        function toggleAccountingHub() {

    const menu =
        document.getElementById('accountinghubMenu');

    menu.classList.toggle('hidden');

}
        function toggleAccountingHubDesktop() {

    const menu =
        document.getElementById('accountinghubDesktopMenu');

    menu.classList.toggle('hidden');

}

        function showSection(id) {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            const globalSearch = document.getElementById('globalSearchBox');

if (
    id === 'clientManagement' ||
    id === 'vaultManagement' ||
    id === 'dscManagement'
) {

    globalSearch.style.display = 'none';

} else {

    globalSearch.style.display = 'block';

}
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            if(id === 'dashboard') document.getElementById('nav-dashboard').classList.add('active');
            if(id === 'clientManagement') document.getElementById('nav-client').classList.add('active');
            if(id === 'vaultManagement') document.getElementById('nav-vault').classList.add('active');
            if(id === 'dscManagement') document.getElementById('nav-dsc').classList.add('active');
            if (id === 'dashboard' && allRecords.length === 0) fetchRecords();
            if (id === 'clientManagement') fetchClients();
            if (id === 'vaultManagement') fetchVault();
            if(id === 'dscManagement') {

    fetchDSC();

}
        }

        function filterByField(field, value) {
            showSection('filterView');
            let filtered = field === 'all' ? [...allRecords] : allRecords.filter(r => r[field] === value);
            const titles = {
    "Sales": "Sales",
    "Purchases": "Purchases",
    "Sundry Debtors": "Sundry Debtors",
    "Sundry Creditors": "Sundry Creditors",
    "Payroll Entries": "Payroll Entries",
    "Bank Statement": "Bank Statement",
    "GST Transfer Entries": "GST Transfer Entries",
    "Depreciation Entries": "Depreciation Entries",
    "TDS Entries": "TDS Entries",
    "Miscellaneous Ledgers": "Miscellaneous Ledgers",   
    GST: "GST Compliance",
    ROC: "Corporate Compliance (ROC)",
    IT: "Income Tax",
    PT: "Professional Tax",
    TDS: "TDS Compliance",
    DIRECTORKYC: "Director KYC",
    UDIN: "UDIN/Certification", 
    FOOD: "Food License", 
    MSME: "MSME Certification",
    PAYROLL: "Payroll",
    REPORTS: "Reports"
                    
};

document.getElementById('filterTitle').innerText =
    `${titles[value] || value} Portal View`;
            renderTable(filtered, 'filterTableBody');
        }

        function handleSearch(query) {
            const q = query.toLowerCase();
            const filtered = allRecords.filter(r => 
    r.client_name?.toLowerCase().includes(q) ||
    r.service_detail?.toLowerCase().includes(q) ||
    r.assigned_staff?.toLowerCase().includes(q) ||
    r.service_category?.toLowerCase().includes(q) ||
    r.status?.toLowerCase().includes(q) ||
    r.alloted_by?.toLowerCase().includes(q)
);
            if (query.trim() !== "") {
                showSection('filterView');
                document.getElementById('filterTitle').innerText = `Results for: "${query}"`;
                renderTable(filtered, 'filterTableBody');
            } else { showSection('dashboard'); }
        }

        function updateStats(data) {
            document.getElementById('statTotal').innerText = data.length;
            document.getElementById('statDone').innerText = data.filter(r => r.status === 'Completed').length;
            document.getElementById('statPending').innerText = data.filter(r => r.status === 'Pending').length;
        }
        async function refreshData() {

    const btn = document.getElementById("refreshBtn");

    btn.innerHTML =
        '<i class="fas fa-spinner fa-spin mr-1"></i> Refreshing';

    await fetchRecords(true);
            renderTable(allRecords, 'mainTableBody');

    btn.innerHTML =
        '<i class="fas fa-check mr-1"></i> Updated';

    setTimeout(() => {

        btn.innerHTML =
            '<i class="fas fa-rotate-right mr-1"></i> Refresh';

    }, 1500);
}

        function clearForm() {
            document.getElementById('editId').value = "";
            document.getElementById('formTitle').innerText = "Management Portal";
            document.getElementById('submitBtn').innerHTML = `<i class="fas fa-cloud-arrow-up text-xl"></i> Sync To WitcorpDB`;
            document.getElementById('editBadge').classList.add('hidden');
            ['clientName', 'serviceCategory', 'serviceDetail', 'assignedStaff', 'allotedBy', 'deadline', 'status', 'remarks'].forEach(i => {
                const el = document.getElementById(i);
                el.value = (i === 'serviceCategory') ? 'GST' : (i === 'status' ? 'Pending' : "");
                el.disabled = false;
            });
        }    
      // REGISTER
async function registerUser() {

const email = document.getElementById("email").value;

const password = document.getElementById("password").value;

const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
});

if (error) {
    document.getElementById('authMsg').innerText = error.message;
    return;
}

const user = data.user;

await supabaseClient.from('witcorp_users').insert([
{
    id: user.id,
    email: user.email,
    role: 'user',
    approved: true
}
]);

document.getElementById('authMsg').innerText =
"Registered Successfully! Now login.";

}

// LOGIN
async function loginUser() {

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    document.getElementById('authMsg').innerText = error.message;
    return;
  }

  checkApproval(data.user);
}

// CHECK APPROVAL
// CHECK APPROVAL
async function checkApproval(user) {

  const { data } = await supabaseClient
    .from('witcorp_users')
    .select('approved')
    .eq('id', user.id)
    .single();

  if (!data.approved) {

    alert("Not approved by admin yet");

    logout();

    return;
  }

  currentUserName = user.email;

  showApp(user);
}

function showApp(user) {

  document.getElementById('authScreen').style.display = 'none';

  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('flex');

  const gmailEl = document.getElementById('userGmail');

  if (gmailEl) {

    gmailEl.innerText = user.email;

  }

  const name = user.email;

  const p1 = document.getElementById("profileInitial");

  const p2 = document.getElementById("profileInitial2");

  if (p1) {

    p1.innerText = name.charAt(0).toUpperCase();

  }

  if (p2) {

    p2.innerText = name.charAt(0).toUpperCase();

  }

}
// LOGOUT
async function logout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

// AUTO LOGIN
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) {
    checkApproval(data.session.user);
  }
});
        function toggleMenu() {
  const menu = document.getElementById("mobileMenu");
  menu.classList.toggle("hidden");

  if (menu.classList.contains("hidden")) {
    document.body.classList.remove("menu-open");
  } else {
    document.body.classList.add("menu-open");
  }
}
        function searchClients(query) {

    const q = query.toLowerCase();

    const filtered = allClients.filter(c =>
        c.client_name?.toLowerCase().includes(q) ||
        c.contact_number?.toLowerCase().includes(q) ||
        c.email_id?.toLowerCase().includes(q)
    );
            filtered.sort((a, b) => {
    return a.client_name.toLowerCase().startsWith(q) ? -1 : 1;
});

    const containers = {
        'Pvt Ltd': 'pvtLtdList',
        'LLP': 'llpList',
        'Others': 'othersList'
    };

    Object.values(containers).forEach(id => {
        document.getElementById(id).innerHTML = "";
    });

    filtered.forEach(c => {

        const listId = containers[c.entity_type] || 'othersList';

        document.getElementById(listId).innerHTML += `
            <div class="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-blue-400 transition-all group">

                <div class="font-black text-slate-800 text-sm">
                    ${c.client_name}
                </div>

                <div class="text-[10px] text-slate-500 font-bold mt-1">
                    <i class="fas fa-phone-alt mr-1.5 text-blue-500"></i>
                    ${c.contact_number}
                </div>

                <div class="text-[10px] text-blue-600 font-black break-all mt-1 opacity-70 group-hover:opacity-100">
                    <i class="fas fa-envelope mr-1.5"></i>
                    ${c.email_id}
                </div>

                <div class="mt-4 flex gap-4 border-t border-slate-200/50 pt-3">

                    <button onclick='editClient(${JSON.stringify(c)})'
                        class="text-[9px] text-blue-600 font-black uppercase hover:scale-110 transition-transform">
                        Modify
                    </button>

                    <button onclick="deleteClient(${c.id})"
                        class="text-[9px] text-rose-500 font-black uppercase hover:scale-110 transition-transform">
                        Delete
                    </button>

                </div>

            </div>
        `;
    });

    if (query.trim() === "") {
        fetchClients();
    }
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

        tbody.innerHTML += `

            <tr class="group hover:bg-slate-50">

                <td class="p-4 font-black text-blue-900 text-sm tracking-tight">
                    ${v.client_name || 'N/A'}
                </td>

                <td class="p-4 font-black text-slate-700 text-sm">
                    <span class="px-2 py-1 bg-slate-100 rounded-lg text-[10px]">
                        ${v.category}
                    </span>
                </td>

                <td class="p-4 font-bold text-blue-600 text-sm">
                    ${v.username}
                </td>

                <td class="p-4 font-mono text-xs">
                    <span class="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-inner">
                        ${v.password}
                    </span>
                </td>

                <td class="p-4 text-right flex gap-3 justify-end items-center">

                    <button onclick='editVault(${JSON.stringify(v)})'
                        class="text-blue-500 hover:scale-125 transition-transform">

                        <i class="fas fa-pencil"></i>

                    </button>

                    <button onclick="deleteVault(${v.id})"
                        class="text-rose-500 hover:scale-125 transition-transform">

                        <i class="fas fa-trash-alt"></i>

                    </button>

                </td>

            </tr>

        `;
    });

    if (query.trim() === "") {
        fetchVault();
    }
}
         async function fetchDSC() {

    const { data, error } = await supabaseClient
        .from('witcorp_dsc')
        .select('*')
        .order('updated_at', { ascending: false }); // ✅ FIX IMPORTANT

    if (error) {
        console.log("DSC FETCH ERROR:", error);
        return;
    }

    allDSC = data || [];

    renderDSC(allDSC);
}

function renderDSC(data) {

    const tbody = document.getElementById('dscTableBody');

    if (!tbody) {
        console.log("dscTableBody NOT FOUND");
        return;
    }

    tbody.innerHTML = "";

    data.forEach(d => {

        tbody.innerHTML += `

        <tr class="border-b border-slate-200 hover:bg-slate-50">

            <td class="p-4 font-bold">
                ${d.company_name || ''}
            </td>

            <td class="p-4">
                ${d.client_name || ''}
            </td>

            <td class="p-4">
                ${d.status || ''}
            </td>

            <td class="p-4">
                ${d.expiry_date || ''}
            </td>

            <td class="p-4">
                ${d.remarks || ''}
            </td>

            <td class="p-4 text-blue-700 text-xs">
    ${d.updated_by || 'N/A'}
</td>

<td class="p-4 text-[11px] font-bold text-slate-500">
    ${d.updated_at
        ? new Date(d.updated_at).toLocaleString('en-IN')
        : 'N/A'}
</td>

           <td class="p-4 text-right whitespace-nowrap">

    <div class="flex gap-2 justify-end items-center">

        <button onclick='editDSC(${JSON.stringify(d)})'
            class="px-3 py-1 bg-blue-500 text-white rounded">

            Edit

        </button>

        <button onclick="deleteDSC(${d.id})"
            class="px-3 py-1 bg-red-500 text-white rounded">

            Delete

        </button>

    </div>

</td>

</tr>

`;
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

    if (!payload.company_name) {

        btn.disabled = false;

        return alert("Company Name Required");
    }

    let error;

    if (id) {

        ({ error } = await supabaseClient
            .from('witcorp_dsc')
            .update(payload)
            .eq('id', id));

    } else {

        ({ error } = await supabaseClient
            .from('witcorp_dsc')
            .insert([payload]));
    }
    console.log("DSC SAVED OK, REFRESHING UI...");
    console.log("DSC ERROR:", JSON.stringify(error));

    if (!error) {
            await createNotification(

    id ? "DSC Updated" : "New DSC Added",

    `${payload.company_name} DSC updated by ${currentUserName}`,

    "dsc"

);

        alert(id ? "DSC Updated Successfully" : "DSC Saved Successfully");

        await new Promise(r => setTimeout(r, 300)); // ✅ FORCE REFRESH DELAY
        await fetchDSC();
        

        document.getElementById('dEditId').value = "";

        ['dCompany','dClient','dExpiry','dRemarks']
        .forEach(i => document.getElementById(i).value = "");

        document.getElementById('dStatus').value = "Valid";

        document.getElementById('dscBtn').innerText =
            "Save DSC Status";

    } else {

        alert("Supabase Error Check Console");
    }

    btn.disabled = false;
}
function editDSC(d) {

    document.getElementById('dEditId').value = d.id;

    document.getElementById('dCompany').value =
        d.company_name;

    document.getElementById('dClient').value =
        d.client_name;

    document.getElementById('dStatus').value =
    (d.status === "Valid" || d.status === "Expired" || d.status === "No DSC")
        ? d.status
        : "Valid";

    document.getElementById('dExpiry').value =
    d.expiry_date
    ? d.expiry_date.split('T')[0]
    : "";

    document.getElementById('dRemarks').value =
        d.remarks;

    document.getElementById('dscBtn').innerText =
        "Update DSC Status";
    document.getElementById('dCompany').scrollIntoView({
    behavior: 'smooth',
    block: 'center'
});
}

async function deleteDSC(id) {

    if(confirm("Delete DSC Record?")) {

        await supabaseClient
            .from('witcorp_dsc')
            .delete()
            .eq('id', id);

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
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log("SW registered"));
}
function toggleProfileMenu() {

    const menu = document.getElementById("profileMenu");

    menu.classList.toggle("hidden");

}
document.addEventListener("click", function(event) {

    const menu = document.getElementById("profileMenu");

    const button = event.target.closest("button");

    if (!event.target.closest("#profileMenu") &&
        !event.target.closest("[onclick='toggleProfileMenu()']")) {

        menu.classList.add("hidden");

    }

});
// OPEN THEME MODAL
function openThemeSettings() {

    document.getElementById("themeModal")
    .classList.remove("hidden");

}

// CLOSE THEME MODAL
function closeThemeSettings() {

    document.getElementById("themeModal")
    .classList.add("hidden");

}

// CHANGE THEME
function changeTheme(themeName){

    const body = document.getElementById("appBody");

    // REMOVE OLD THEMES
    body.classList.remove(
        "theme-ocean",
        "theme-dark",
        "theme-green",
        "theme-purple"
    );

    // ADD NEW THEME
    body.classList.add(themeName);

    // SAVE THEME
    localStorage.setItem("witcorpTheme", themeName);

}

// LOAD SAVED THEME
window.addEventListener("DOMContentLoaded", () => {

    const savedTheme =
    localStorage.getItem("witcorpTheme");

    if(savedTheme){

        document.getElementById("appBody")
        .classList.add(savedTheme);

    }

});
async function createNotification(
    title,
    message,
    type = "info",
    reference = ""
) {

    await supabaseClient
        .from('witcorp_notifications')
        .insert([{
            title,
            message,
            type,
            reference,
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

    if(error) return;

    allNotifications = data;

    renderNotifications();

}
function renderNotifications() {

    const list =
        document.getElementById('notificationList');

    const count =
        document.getElementById('notificationCount');

    list.innerHTML = "";

    const unread =
        allNotifications.filter(n => !n.is_read);

    unreadCount = unread.length;

    if(unreadCount > 0){

        count.classList.remove('hidden');

        count.innerText = unreadCount;

    } else {

        count.classList.add('hidden');

    }

    allNotifications.forEach(n => {

        list.innerHTML += `

            <div
    onclick="openNotification(${n.id}, '${n.type}', '${n.reference || ''}')"
    class="p-4 cursor-pointer border-b border-slate-100 transition-all hover:bg-slate-50
    ${!n.is_read ? 'bg-blue-50' : 'bg-white'}
    ${n.is_read ? 'opacity-60' : ''}">

                <div class="font-black text-sm text-slate-800">
                    ${n.title}
                </div>

                <div class="text-xs text-slate-500 mt-1">
                    ${n.message}
                </div>

                <div class="text-[10px] text-blue-600 mt-2 font-bold">
                    ${new Date(n.created_at).toLocaleString('en-IN')}
                </div>

            </div>

        `;
    });

}
function toggleNotificationPanel(){

    document.getElementById('notificationPanel')
    .classList.toggle('hidden');

}
async function openNotification(id, type, reference) {

    // MARK AS READ

    await supabaseClient
        .from('witcorp_notifications')
        .update({ is_read: true })
        .eq('id', id);

    // LOCAL UPDATE

    const target =
        allNotifications.find(n => n.id === id);

    if(target){

        target.is_read = true;

    }

    renderNotifications();

    // OPEN RELATED SECTION

    if(type === "record"){

        showSection('dashboard');

        handleSearch(reference);

    }

    if(type === "client"){

        showSection('clientManagement');

        searchClients(reference);

    }

    if(type === "vault"){

        showSection('vaultManagement');

        searchVault(reference);

    }

    if(type === "dsc"){

        showSection('dscManagement');

        searchDSC(reference);

    }

    // CLOSE PANEL

    document.getElementById('notificationPanel')
    .classList.add('hidden');

}
supabaseClient
.channel('live-notifications')

.on(
    'postgres_changes',
    {
        event: 'INSERT',
        schema: 'public',
        table: 'witcorp_notifications'
    },

   async (payload) => {

    console.log("NEW NOTIFICATION:", payload);

    allNotifications.unshift(payload.new);

    renderNotifications();

    // SOUND
    const audio = new Audio(
        'https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3'
    );

    audio.play();

    // PUSH NOTIFICATION
    navigator.serviceWorker.ready.then(reg => {

        reg.showNotification(
            payload.new.title || "New Update",
            {
                body: payload.new.message || "Database updated",
                icon: "./logo.png",
                badge: "./logo.png"
            }
        );

    });

    // AUTO REFRESH
    fetchRecords(true);

}

)

.subscribe((status) => {

    console.log("NOTIFICATION STATUS:", status);

});
window.addEventListener('DOMContentLoaded', () => {

    fetchNotifications();

});

/* ========================= */
/* BACKGROUND THEME SYSTEM */
/* ========================= */

function changeTheme(theme){

    const body = document.body;

    const bgThemes = [
        'theme-ocean',
        'theme-dark',
        'theme-green',
        'theme-purple',
        'theme-light'
    ];

    bgThemes.forEach(t => {
        body.classList.remove(t);
    });

    body.classList.add(theme);

    localStorage.setItem('bgTheme', theme);
}

/* ========================= */
/* SIDEBAR THEME SYSTEM */
/* ========================= */

function changeSidebarTheme(theme){

    const sidebar =
    document.getElementById('sidebar');

    const mobileSidebar =
    document.getElementById('mobileSidebar');

    const sidebarThemes = [
        'sidebar-theme-raspberry',
        'sidebar-theme-mint',
        'sidebar-theme-chill',
        'sidebar-theme-forest',
        'sidebar-theme-damini',
        'sidebar-theme-seaglass',
        'sidebar-theme-lemon',
        'sidebar-theme-dark',
        'sidebar-theme-navypro',
        'sidebar-theme-original'
    ];

    sidebarThemes.forEach(t => {

        sidebar.classList.remove(t);

        mobileSidebar.classList.remove(t);

    });

    sidebar.classList.add(theme);

    mobileSidebar.classList.add(theme);

    localStorage.setItem(
        'sidebarTheme',
        theme
    );
}

/* ========================= */
/* LOAD SAVED THEMES */
/* ========================= */

window.addEventListener('load', ()=>{

    const savedBg =
    localStorage.getItem('bgTheme');

    if(savedBg){

        changeTheme(savedBg);

    }

    const savedSidebar =
    localStorage.getItem('sidebarTheme');

    if(savedSidebar){

        changeSidebarTheme(savedSidebar);

    }

});
/* ========================= */
/* COMPANY LOGO SYSTEM */
/* ========================= */

const logo =
document.getElementById("companyLogo");

const upload =
document.getElementById("logoUpload");

// CLICK LOGO

logo.addEventListener("click", () => {

    upload.click();

});

// CHANGE IMAGE

upload.addEventListener("change", (e) => {

    const file = e.target.files[0];

    if(!file) return;

    const reader = new FileReader();

    reader.onload = function(event){

        const imageData = event.target.result;

        logo.src = imageData;

        localStorage.setItem(
            "companyLogo",
            imageData
        );

    };

    reader.readAsDataURL(file);

});

// LOAD SAVED LOGO

const savedLogo =
localStorage.getItem("companyLogo");

if(savedLogo){

    logo.src = savedLogo;

}

/* ========================= */
/* COMPANY TITLE SYSTEM */
/* ========================= */

const title =
document.getElementById("companyTitle");

// LOAD SAVED TITLE

const savedTitle =
localStorage.getItem("companyTitle");

if(savedTitle){

    title.innerText = savedTitle;

}

// AUTO SAVE TITLE

title.addEventListener("input", () => {

    localStorage.setItem(
        "companyTitle",
        title.innerText
    );

});
