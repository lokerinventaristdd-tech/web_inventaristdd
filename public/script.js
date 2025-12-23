// ⚠️ Pastikan Port 8080 (sesuaikan jika beda)
const API_URL = 'http://localhost:8080/api/lockers';
const MASTER_API_URL = 'http://localhost:8080/api/masters';
const API_CHECK = 'http://localhost:8080/api/masters/check-locker';
const API_ACQUIRE = 'http://localhost:8080/api/masters/save-locker';

// --- DOM Elements ---
const lockerTableBody = document.getElementById('lockerTableBody');
const lockerForm = document.getElementById('lockerForm');
const printArea = document.getElementById('printArea');
const searchInput = document.getElementById('searchInput');
const cancelButton = document.getElementById('cancelButton');
const exportButton = document.getElementById('exportButton');
const copyAllPromptBtn = document.getElementById('copyAllPromptBtn');

const filterStatus = document.getElementById('filterStatus');
const filterOwner = document.getElementById('filterOwner');
const filterLocker = document.getElementById('filterLocker');
const filterType = document.getElementById('filterType');

const editModal = document.getElementById('editModal');
const editLockerForm = document.getElementById('editLockerForm');

const masterModal = document.getElementById('masterModal');
const masterForm = document.getElementById('masterForm');
const masterOwnerInput = document.getElementById('masterOwnerName');
const masterLockerInput = document.getElementById('masterLockerNumber');

const ownerDropdown = document.getElementById('ownerName');
const lockerDropdown = document.getElementById('lockerNumber');
const hiddenTypeInput = document.getElementById('selectedLocationType');

// index elements (new)
const indexGroup = document.getElementById('indexInputGroup');
const indexInput = document.getElementById('indexNumber');
const editIndexGroup = document.getElementById('editIndexGroup');
const editIndexInput = document.getElementById('editIndexNumber');

// Tab Elements
const tabLocker = document.getElementById('tabLocker');
const tabRack = document.getElementById('tabRack');
const directoryTitle = document.getElementById('directoryTitle');

// Modal Buttons
const addMasterButton = document.getElementById('addMasterButton');
const closeEditModalBtn = document.getElementById('closeEditModalBtn'); // optional
const cancelEditBtn = document.getElementById('cancelEditBtn');       // optional
const closeMasterModalBtn = document.getElementById('closeMasterModalBtn'); // optional
const addMasterOwnerBtn = document.getElementById('addMasterOwnerBtn');
const addOrAcquireLockerBtn = document.getElementById('addOrAcquireLockerBtn');

let currentLockerItems = [];
let masterData = { owners: [], lockers: [] };
let currentActiveTab = 'Locker'; // Default Tab
lockerDropdown.disabled = true;
lockerDropdown.innerHTML = `<option value="" disabled selected>Pilih...</option>`;
// --- 1. INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    initializeDateInputs();
    await fetchMasterData();
    await fetchLockerItems();

    // --- EVENT LISTENERS ---
    if (cancelButton) cancelButton.addEventListener('click', resetFormMode);
    if (exportButton) exportButton.addEventListener('click', handleExport);
    if (copyAllPromptBtn) copyAllPromptBtn.addEventListener('click', handleCopyAllPrompt);

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (filterOwner) filterOwner.addEventListener('change', applyFilters);
    if (filterType) filterType.addEventListener('change', applyFilters);

    // TAB Listeners
    if (tabLocker) tabLocker.addEventListener('click', () => switchTab('Locker'));
    if (tabRack) tabRack.addEventListener('click', () => switchTab('Rack'));

    // Modal Open/Close Listeners
    if (addMasterButton) addMasterButton.addEventListener('click', openMasterModal);

    // Cek elemen close sebelum pasang listener
    const closeBtns = document.querySelectorAll('.close-button, .btn-secondary');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.closest('#editModal') && (e.target.classList.contains('close-button') || e.target.id === 'cancelEditBtn')) closeEditModal();
            if (e.target.closest('#masterModal') && (e.target.classList.contains('close-button'))) closeMasterModal();
        });
    });

    // Master Data Action Listeners
    if (addMasterOwnerBtn) addMasterOwnerBtn.addEventListener('click', addMasterOwner);
    if (addOrAcquireLockerBtn) addOrAcquireLockerBtn.addEventListener('click', addOrAcquireLocker);

    // Dropdown Logic
    if (ownerDropdown) {
        ownerDropdown.addEventListener('change', () => {
            filterLockerDropdown();
        });
    }

    if (lockerDropdown) {
        lockerDropdown.addEventListener('change', () => {
            const selectedOption = lockerDropdown.options[lockerDropdown.selectedIndex];
            if (selectedOption) {
                const type = selectedOption.getAttribute('data-type') || 'Locker';
                hiddenTypeInput.value = type;
                // show/hide index input based on selection
                if (type.toLowerCase() === 'rack') {
                    indexGroup.style.display = 'block';
                } else {
                    indexGroup.style.display = 'none';
                    indexInput.value = '';
                }
            }
        });
    }
    ownerName.addEventListener("change", () => {
        const selectedOwner = ownerName.value;

        lockerNumber.disabled = !selectedOwner;

        if (!selectedOwner) {
            lockerNumber.innerHTML = `<option value="" disabled selected>Pilih...</option>`;
            return;
        }

        // AMBIL DATA LOKASI DARI MASTER (ganti masterLocations dengan variabel milikmu)
        const availableLocations = masterLocations.filter(loc => loc.owner === selectedOwner);

        let optionsHTML = `<option value="" disabled selected>Pilih...</option>`;
        availableLocations.forEach(loc => {
            optionsHTML += `<option value="${loc.code}" data-type="${loc.type}">${loc.type} - ${loc.code}</option>`;
        });

        lockerNumber.innerHTML = optionsHTML;
    });

    // cegah user mengklik lokasi tanpa pilih pemilik
    lockerNumber.addEventListener("click", () => {
        if (!ownerName.value) {
            showAlertToast("Pilih pemilik dulu.", "error");
            lockerNumber.blur();
        }
    });

    // When editing, changing location should show/hide edit index
    const editLockerSelect = document.getElementById('editLockerNumber');
    if (editLockerSelect) {
        editLockerSelect.addEventListener('change', () => {
            const sel = editLockerSelect.options[editLockerSelect.selectedIndex];
            const tp = sel ? (sel.getAttribute('data-type') || 'Locker') : 'Locker';
            if (tp.toLowerCase() === 'rack') {
                editIndexGroup.style.display = 'block';
            } else {
                editIndexGroup.style.display = 'none';
                editIndexInput.value = '';
            }
        });
    }

    const editOwnerSelect = document.getElementById('editOwnerName');
    if (editOwnerSelect) editOwnerSelect.addEventListener('change', filterEditLockerDropdown);

    const editStatusSelect = document.getElementById('editStatusSelect');
    if (editStatusSelect) editStatusSelect.addEventListener('change', handleStatusChange);

    const editEntry = document.getElementById('editEntryDate');
    if (editEntry) {
        editEntry.addEventListener('change', (e) => {
            document.getElementById('editExpirationDate').setAttribute('min', e.target.value);
        });
    }
});

// --- TAB LOGIC ---
function switchTab(type) {
    currentActiveTab = type;

    if (type === 'Locker') {
        if (tabLocker) tabLocker.classList.add('active');
        if (tabRack) tabRack.classList.remove('active');
        if (directoryTitle) directoryTitle.textContent = "Direktori LOKER";
        if (exportButton) exportButton.textContent = "Export Loker";
        if (copyAllPromptBtn) copyAllPromptBtn.textContent = "🤖 AI Loker";
    } else {
        if (tabRack) tabRack.classList.add('active');
        if (tabLocker) tabLocker.classList.remove('active');
        if (directoryTitle) directoryTitle.textContent = "Direktori RAK";
        if (exportButton) exportButton.textContent = "Export Rak";
        if (copyAllPromptBtn) copyAllPromptBtn.textContent = "🤖 AI Rak";
    }

    applyFilters();
}

// ============================================================
// 🔥 FITUR: COPY DATA AI DENGAN SORTIR & FILTER RENTANG 🔥
// ============================================================
function handleCopyAllPrompt() {
    // Filter items berdasarkan TAB AKTIF
    let activeItems = currentLockerItems.filter(item => {
        const type = item.locationType || 'Locker';
        const check = (type === 'Rack' || type === 'Rak') ? 'Rack' : 'Locker';
        return check === currentActiveTab;
    });

    if (!activeItems.length) {
        showAlertToast(`Tidak ada data di ${currentActiveTab}.`, "error");
        return;
    }

    const rangeInput = prompt(`Masukkan Rentang Nomor ${currentActiveTab} (Contoh: 1-10).\nAtau biarkan kosong untuk menyalin SEMUA data.`, "");
    let targetItems = [...activeItems];
    let rangeInfo = `${currentActiveTab} (SEMUA)`;

    if (rangeInput && rangeInput.trim() !== "") {
        const parts = rangeInput.split('-');
        if (parts.length === 2) {
            const start = parseInt(parts[0].trim());
            const end = parseInt(parts[1].trim());
            if (!isNaN(start) && !isNaN(end)) {
                rangeInfo = `${currentActiveTab} (${start}-${end})`;
                targetItems = targetItems.filter(item => {
                    const num = parseInt(item.lockerNumber.replace(/\D/g, ''));
                    return num >= start && num <= end;
                });
            }
        } else if (!isNaN(parseInt(rangeInput))) {
            const single = parseInt(rangeInput);
            rangeInfo = `${currentActiveTab} (${single})`;
            targetItems = targetItems.filter(item => parseInt(item.lockerNumber.replace(/\D/g, '')) === single);
        }
    }

    if (!targetItems.length) {
        showAlertToast("Data tidak ditemukan di rentang tersebut.", "error");
        return;
    }

    showAlertToast(`Menyalin ${targetItems.length} data...`, "info");

    // Sortir numerik
    targetItems.sort((a, b) => {
        const numA = parseInt((a.lockerNumber || "0").replace(/\D/g, '')) || 0;
        const numB = parseInt((b.lockerNumber || "0").replace(/\D/g, '')) || 0;
        return numA - numB;
    });

    // Susun teks
    let dataListText = "";
    targetItems.forEach((item, index) => {
        const status = calculateStatus(item);
        const statusDetail = (item.manualStatus && item.manualStatus !== 'Auto')
            ? `[${status} - ${item.manualNote}]`
            : `[${status}]`;

        // 🔥 KHUSUS RAK: tambahkan Index + Keterangan + backslash 🔥
        let rakExtra = "";
        if (currentActiveTab === 'Rack') {
            const indexText = item.index ? ` | Index: ${item.index}` : "";
            const ketText = item.keterangan ? ` | Ket: ${item.keterangan} \\` : " \\";
            rakExtra = `${indexText}${ketText}`;
        }

        dataListText += `${index + 1}. ${item.lockerNumber} | Pemilik: ${item.ownerName} | Barang: ${item.itemName} | Masuk: ${formatDisplayDate(item.entryDate)} | Status: ${statusDetail}${rakExtra}\n`;
    });

    const fullPrompt = `Anda adalah asisten asisten manajemen penyimpanan yang cerdas dan membantu.

[PANDUAN MENJAWAB]

1.  **ACUAN DATA:** Gunakan informasi dari [SUMBER DATA UTAMA] sebagai prioritas utama. Namun, Anda boleh menggunakan pengetahuan umum dan bahasa yang luwes untuk menjelaskan konteksnya agar lebih mudah dipahami.
2.  **FLEKSIBILITAS:** Jika pengguna bertanya dengan bahasa santai atau tidak baku, cobalah untuk memahami maksudnya dan berikan jawaban yang relevan dengan data yang ada.
3.  **JIKA DATA TIDAK DITEMUKAN:** Jika informasi yang dicari tidak ada di dalam data, sampaikan secara sopan (contoh: "Maaf, sepertinya item tersebut belum tercatat di Loker maupun Rak"), jangan menjawab dengan pesan error kaku.
4.  **GAYA BAHASA:** Gunakan gaya bahasa yang natural, sopan, dan informatif. Anda tidak dibatasi jumlah kalimat, jelaskan secukupnya agar pengguna merasa terbantu.
[SUMBER DATA UTAMA: ${rangeInfo}]
--- MULAI DATA ---
${dataListText}
--- AKHIR DATA ---

[TUGAS AWAL]
Analisa data / Analisa ulang data di atas (Rentang ${rangeInfo}). Berikan laporan singkat (sesuai Aturan #4) mengenai status barang-barang tersebut atau tunggu pertanyaan saya selanjutnya.
`;


    navigator.clipboard.writeText(fullPrompt)
        .then(() => showAlertToast("✅ Data Tersalin! Paste di Gemini.", "success"))
        .catch(err => {
            console.error(err);
            showAlertToast("Gagal menyalin.", "error");
        });
}
// ============================================================
// 🔥 FITUR: CUSTOM PRINT LAYOUT (LOKER vs RAK BEDA) - tampilkan index untuk RAK
// ============================================================
function handlePrint(event) {
    const id = event.currentTarget.dataset.id;
    const item = currentLockerItems.find(i => i.id == id);
    if (!item) return;

    printArea.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'locker-label-print-horizontal';

    // Style Umum
    div.style.border = "2px solid black";
    div.style.backgroundColor = "white";
    div.style.margin = "20px auto";
    div.style.fontFamily = "Arial, sans-serif";
    div.style.color = "black";

    const qrValue = item.keterangan || "-";
    const tglMasuk = formatDisplayDate(item.entryDate);
    const tglExp = formatDisplayDate(item.expirationDate);

    const isRack = (item.locationType === 'Rack' || item.locationType === 'Rak');

    if (isRack) {
        // --- TAMPILAN KHUSUS RAK (SESUAI GAMBAR BIRU) ---
        // Format Portrait Memanjang
        div.style.width = "250px";
        div.style.padding = "0";
        div.style.textAlign = "center";

        // CSS Grid kotak-kotak
        const rowStyle = "border-bottom: 1px solid black; padding: 8px 5px;";

        div.innerHTML = `
            <!-- 1. JUDUL (TDD) -->
            <div style="${rowStyle} font-weight:bold; font-size:16px;">TDD</div>
            
            <!-- 2. JUDUL RECORD (RACK: XX) -->
            <div style="${rowStyle}">
                <div style="font-weight:bold; font-size:14px; margin-bottom:2px;">Judul Record</div>
                <div style="font-size:15px; font-weight:bold; text-transform:uppercase;">${item.itemName}</div>
                <div style="font-size:12px;">(${item.lockerNumber})</div>
            </div>
            
            <!-- 3. WAKTU SIMPAN -->
            <div style="${rowStyle}">
                <div style="font-weight:bold; font-size:14px; margin-bottom:2px;">Waktu Simpan</div>
                <div style="font-size:16px; font-weight:bold;">${tglMasuk}</div>
                <div style="font-size:11px;">(Exp: ${tglExp})</div>
            </div>
            
            <!-- 4. INDEX (QR CODE) -->
            <div style="${rowStyle} display:flex; flex-direction:column; align-items:center;">
                <div style="font-weight:bold; font-size:14px; margin-bottom:5px;"></div>
                <div id="qrcode"></div>
                <div style="font-size:12px; margin-top:6px;"><strong>Index: ${item.index || '-'}</strong></div>
            </div>
            
            <!-- 5. PIC (PEMILIK) -->
            <div style="padding: 10px 5px;">
                <div style="font-weight:bold; font-size:14px; margin-bottom:2px;">PIC</div>
                <div style="font-size:18px; font-weight:bold;">${item.ownerName}</div>
            </div>
        `;
    } else {
        // --- TAMPILAN LOKER (STANDARD LANDSCAPE) ---
        div.style.width = "380px";
        div.style.padding = "15px";

        div.innerHTML = `
            <div style="text-align: center; font-weight: bold; font-size: 28px; margin-bottom: 15px; border-bottom: 3px solid #000; padding-bottom: 5px;">
                LOCKER: ${item.lockerNumber}
            </div>
            <div style="display: flex; align-items: flex-start; gap: 15px;">
                <div id="qrcode" style="flex-shrink: 0;"></div>
                <div style="flex-grow: 1; font-size: 12px; line-height: 1.5; color: #000; font-weight: bold;">
                    <div style="margin-bottom: 8px;">
                        <span style="font-size:11px; font-weight:normal; text-decoration:underline;">PEMILIK :</span><br>
                        <span style="font-size:16px; text-transform:uppercase;">${item.ownerName}</span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <span style="font-size:11px; font-weight:normal; text-decoration:underline;">BARANG :</span><br>
                        <span style="font-size:11px;">${item.itemName}</span>
                    </div>
                    <div style="margin-top: 10px; border-top: 2px dashed #000; padding-top: 5px;">
                        <div style="display:flex; justify-content:space-between; width:100%;">
                            <div style="flex:1;">
                                <span style="font-size:10px; font-weight:normal; text-decoration:underline;">TGL MASUK :</span><br>
                                <span style="font-size:13px;">${tglMasuk}</span>
                            </div>
                            <div style="flex:1; text-align:right;">
                                <span style="font-size:10px; font-weight:normal; text-decoration:underline;">TGL EXP :</span><br>
                                <span style="font-size:13px;">${tglExp}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Tombol Aksi (Sama untuk keduanya)
    const actionDiv = document.createElement('div');
    actionDiv.className = "no-print";
    actionDiv.style.textAlign = "center";
    actionDiv.style.marginTop = "20px";
    actionDiv.innerHTML = `
        <button class="btn-sm" style="background:blue; padding: 8px 20px; font-size:14px;" onclick="window.print()">Cetak</button> 
        <button class="btn-sm" style="background:red; padding: 8px 20px; font-size:14px;" onclick="document.getElementById('printArea').classList.remove('active')">Tutup</button>
    `;
    div.appendChild(actionDiv);

    printArea.appendChild(div);

    // Generate QR (hanya jika ada elemen qrcode)
    const qElem = div.querySelector('#qrcode');
    if (qElem) {
        new QRCode(qElem, {
            text: qrValue,
            width: isRack ? 90 : 110,
            height: isRack ? 90 : 110,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
    }

    printArea.classList.add('active');
}


// --- FETCH DATA ---
async function fetchLockerItems() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            console.error("Server Error:", response.statusText);
            showAlertToast("Server Error. Cek Terminal.", "error");
            currentLockerItems = [];
            renderLockerItems([]);
            return;
        }
        const data = await response.json();
        if (Array.isArray(data)) {
            currentLockerItems = data;
        } else {
            currentLockerItems = [];
        }
        applyFilters();
    } catch (error) {
        console.error('Error:', error);
        showAlertToast('Gagal koneksi ke Server (Port 8080).', 'error');
        currentLockerItems = [];
        renderLockerItems([]);
    }
}

async function fetchMasterData() {
    try {
        const res = await fetch(MASTER_API_URL);
        if (res.ok) {
            masterData = await res.json();
            populateDropdowns();
            renderMasterLists();
            if (ownerDropdown && ownerDropdown.value) filterLockerDropdown();
        }
    } catch (error) { console.error('Error master:', error); }
}

// --- FILTER (BY TAB) ---
function applyFilters() {
    if (!Array.isArray(currentLockerItems)) return;

    const search = searchInput ? searchInput.value.toLowerCase() : "";
    const fStat = filterStatus ? filterStatus.value : "";
    const fOwn = filterOwner ? filterOwner.value : "";
    const fType = filterType ? filterType.value : "";

    const filtered = currentLockerItems.filter(item => {
        // 1. Filter by TAB
        const itemType = item.locationType || 'Locker';
        const typeCheck = (itemType === 'Rack' || itemType === 'Rak') ? 'Rack' : 'Locker';

        if (typeCheck !== currentActiveTab) return false;

        // 2. Standard Filter
        const stat = calculateStatus(item);
        const safeOwner = (item.ownerName || "").toLowerCase();
        const safeItem = (item.itemName || "").toLowerCase();
        const safeLocker = (item.lockerNumber || "").toLowerCase();

        const matchSearch = safeOwner.includes(search) || safeItem.includes(search) || safeLocker.includes(search);
        const matchStat = !fStat || stat === fStat;
        const matchOwn = !fOwn || item.ownerName === fOwn;

        const matchTypeDrop = !fType || itemType === fType || (fType === 'Locker' && !item.locationType);

        return matchSearch && matchStat && matchOwn && matchTypeDrop;
    });

    // Sortir Numerik
    filtered.sort((a, b) => {
        const nA = parseInt((a.lockerNumber || "0").replace(/\D/g, ''));
        const nB = parseInt((b.lockerNumber || "0").replace(/\D/g, ''));
        return nA - nB;
    });

    renderLockerItems(filtered);
}
// --- RENDER TABLE | FIXED TOTAL --- 
function renderLockerItems(items) {
    if (!lockerTableBody) return;
    lockerTableBody.innerHTML = '';

    if (!items || items.length === 0) {
        lockerTableBody.innerHTML = `<tr><td colspan="10" class="text-center">Data ${currentActiveTab} Kosong</td></tr>`;
        return;
    }

    items.forEach(item => {
        const row = lockerTableBody.insertRow();
        const status = calculateStatus(item);

        let badgeClass = status === 'Active'
            ? 'status-active'
            : status === 'Expired'
            ? 'status-expired'
            : status === 'Dipinjam'
            ? 'status-borrowed'
            : status === 'Kalibrasi'
            ? 'status-calibration'
            : 'status-broken';

        const noteHtml =
            item.manualNote && status !== 'Active' && status !== 'Expired'
                ? `<br><small>(${item.manualNote})</small>`
                : '';

        let displayOwner = item.ownerName;
        const masterInfo = masterData.lockers.find(l => l.number == item.locationCode);

        if (masterInfo) {
            if (masterInfo.current_owner && masterInfo.current_owner !== item.ownerName) {
                displayOwner = `<span style="color:red;">${item.ownerName} (Ex)</span>`;
            } else if (!masterInfo.current_owner) {
                displayOwner = `<span style="color:#e67e22;">${item.ownerName} (Lepas)</span>`;
            }
        } else {
            displayOwner = `<span style="color:gray;">${item.ownerName} (?)</span>`;
        }

        const prefix = (item.locationType || '').toLowerCase() === 'rack' ? 'RK' : 'LK';
        const typeLabel =
            (item.locationType || '').toLowerCase() === 'rack'
                ? '<b style="color:purple">RAK</b>'
                : 'LOKER';

        // --- INDEX FIX ---
        const indexDisplay =
            (item.locationType || '').toLowerCase() === 'rack'
                ? (item.index || '-')
                : ''; // LOKER tidak menampilkan apa pun

        row.innerHTML = `
            <td>${prefix}-${item.id}</td>
            <td>${typeLabel}</td>
            <td>${item.lockerNumber}</td>
            <td>${displayOwner}</td>
            <td class="expandable-cell"><div class="cell-content">${item.itemName}</div></td>
            <td>${formatDisplayDate(item.entryDate)}</td>
            <td>${formatDisplayDate(item.expirationDate)}</td>

            <!-- Kolom INDEX -->
            <td class="index-col">${indexDisplay}</td>

            <td>
                <span class="status-badge ${badgeClass}">${status}</span>
                ${noteHtml}
            </td>

            <td style="white-space: nowrap;">
                <button class="btn-sm" style="background:blue" onclick="handleEditClick(${item.id})">Edit</button>
                <button class="btn-sm" style="background:red" onclick="handleDelete(${item.id})">Del</button>
                <button class="btn-sm" style="background:#333" data-id="${item.id}" onclick="handlePrint(event)">QR</button>
            </td>
        `;
    });

    toggleIndexColumn(); // wajib panggil ulang setiap render
}

// --- TAMPILKAN / SEMBUNYIKAN KOLOM INDEX ---
// --- TAMPILKAN / SEMBUNYIKAN KOLOM INDEX (HEADER & BODY) ---
function toggleIndexColumn() {
    // 1. Ambil semua cell data (isi tabel)
    const allIndexCells = document.querySelectorAll(".index-col");

    // 2. Ambil Header Tabel secara otomatis (Mencari <th> yang tulisannya "Index")
    // Agar Anda tidak perlu utak-atik file HTML lagi
    const allHeaders = document.querySelectorAll("th");
    let indexHeader = null;
    allHeaders.forEach(th => {
        if (th.textContent.trim().toLowerCase() === "index") {
            indexHeader = th;
        }
    });

    // 3. Cek apakah Tab aktif adalah RAK (case insensitive)
    const isRack = currentActiveTab.toLowerCase() === "rack";

    if (isRack) {
        // --- JIKA RAK: TAMPILKAN ---
        if (indexHeader) indexHeader.style.display = ""; // Tampilkan Header
        allIndexCells.forEach(c => c.style.display = ""); // Tampilkan Isi
    } else {
        // --- JIKA LOKER: SEMBUNYIKAN ---
        if (indexHeader) indexHeader.style.display = "none"; // Sembunyikan Header
        allIndexCells.forEach(c => c.style.display = "none"); // Sembunyikan Isi
    }
}


// --- UTILS ---
function showAlertToast(message, type = 'success') {
    let alertBox = document.getElementById('customAlert');
    if (!alertBox) {
        alertBox = document.createElement('div');
        alertBox.id = 'customAlert';
        alertBox.className = 'custom-alert';
        document.body.appendChild(alertBox);
    }
    alertBox.textContent = message;
    alertBox.className = 'custom-alert';
    void alertBox.offsetWidth;
    alertBox.className = `custom-alert show ${type}`;
    setTimeout(() => { alertBox.className = 'custom-alert'; }, 3000);
}

function formatDisplayDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date)) return '-';
    return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

function calculateStatus(item) {
    if (item.manualStatus && item.manualStatus !== 'Auto') return item.manualStatus;
    if (!item.expirationDate) return 'N/A';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(item.expirationDate);
    return expiryDate > today ? 'Active' : 'Expired';
}

function initializeDateInputs() {
    const today = new Date().toISOString().split('T')[0];
    const entry = document.getElementById('entryDate');
    const exp = document.getElementById('expirationDate');
    if (entry) entry.value = today;
    if (exp) exp.min = today;
}

// --- MASTER DATA LOGIC ---
async function addMasterOwner() {
    const name = document.getElementById('newOwnerInput').value.trim();
    if (!name) return showAlertToast("Isi nama pemilik!", 'error');
    await fetch(`${MASTER_API_URL}/owner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name }) });
    document.getElementById('newOwnerInput').value = '';
    fetchMasterData(); showAlertToast("Pemilik ditambahkan.", 'success');
}

async function addOrAcquireLocker() {
    let locker = document.getElementById('newLockerInput').value.trim();
    const owner = document.getElementById('assignOwnerSelect').value;
    const type = document.getElementById('newLocationType').value;

    if (!locker) return showAlertToast("Isi kode lokasi!", 'error');

    // AUTO-PREFIX
    if (!isNaN(locker)) {
        if (type === 'Rack') locker = `R-${locker}`;
        else if (type === 'Locker') locker = `L-${locker}`;
    }

    const res = await fetch(API_CHECK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockerNumber: locker })
    });
    const check = await res.json();

    if (check.status === 'type_conflict') { alert(`⛔ ${check.message}`); return; }

    if (check.status === 'occupied' && check.owner !== owner && owner !== "") {
        if (confirm(`Lokasi ${locker} milik ${check.owner}. AMBIL ALIH ke ${owner}?`)) {
            await saveLockerMaster(locker, owner, type, true);
        }
    } else {
        await saveLockerMaster(locker, owner, type, false);
    }
}

async function saveLockerMaster(code, owner, type, force) {
    await fetch(API_ACQUIRE, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockerNumber: code, ownerName: owner, locationType: type, forceAcquire: force })
    });
    showAlertToast("Lokasi tersimpan!", 'success');
    fetchMasterData(); fetchLockerItems();
    document.getElementById('newLockerInput').value = '';
}

window.handleDeleteMaster = async function (val, type) {
    if (!val) return;
    const msg = type === 'owner' ? `Hapus Pemilik "${val}"?` : `Hapus Lokasi "${val}"?`;
    if (confirm(msg)) {
        const safeVal = encodeURIComponent(val);
        try {
            const res = await fetch(`${MASTER_API_URL}/${type}/${safeVal}`, { method: 'DELETE' });
            if (res.ok) {
                fetchMasterData();
                fetchLockerItems();
                showAlertToast('Data dihapus.', 'success');
            } else {
                showAlertToast('Gagal hapus.', 'error');
            }
        } catch (e) { console.error(e); }
    }
}

// --- DROPDOWN & INPUT ---
// --- DROPDOWN & INPUT (UPDATED) ---
function populateDropdowns() {
    // 1. Populate Dropdown di Form Input (Kiri)
    if (ownerDropdown) {
        ownerDropdown.innerHTML = '<option value="" disabled selected>Pilih Pemilik</option>';
        masterData.owners.forEach(o => {
            ownerDropdown.innerHTML += `<option value="${o.name}">${o.name}</option>`;
        });
    }

    // 2. Populate Dropdown di Filter Atas (KANAN - YANG HILANG SEBELUMNYA)
    if (filterOwner) {
        // Simpan nilai yang sedang dipilih user agar tidak reset saat refresh data
        const currentSelection = filterOwner.value; 

        filterOwner.innerHTML = '<option value="">Semua Pemilik</option>';
        masterData.owners.forEach(o => {
            filterOwner.innerHTML += `<option value="${o.name}">${o.name}</option>`;
        });

        // Balikin pilihan user jika masih valid
        if (currentSelection) {
            filterOwner.value = currentSelection;
        }
    }

    // 3. Logic Locker Dropdown (Input)
    if (lockerDropdown) {
        lockerDropdown.addEventListener('change', (e) => {
            const selectedOption = lockerDropdown.options[lockerDropdown.selectedIndex];
            if (!selectedOption) return;

            const type = (selectedOption.getAttribute('data-type') || 'Locker').toLowerCase();

            // Validasi: Pemilik harus dipilih dulu untuk RAK
            const ownerSelected = ownerDropdown && ownerDropdown.value && ownerDropdown.value.trim() !== "";
            if (type === 'rack' && !ownerSelected) {
                const placeholderIndex = Array.from(lockerDropdown.options).findIndex(opt => opt.disabled);
                lockerDropdown.selectedIndex = placeholderIndex >= 0 ? placeholderIndex : 0;

                showAlertToast("Pilih Nama Pemilik terlebih dahulu sebelum memilih Rak.", "error");
                hiddenTypeInput.value = 'Locker';
                indexGroup.style.display = 'none';
                if (indexInput) indexInput.value = '';
                return;
            }

            // Set tipe & index
            hiddenTypeInput.value = (type === 'rack') ? 'Rack' : 'Locker';
            if (type === 'rack') {
                indexGroup.style.display = 'block';
            } else {
                indexGroup.style.display = 'none';
                if (indexInput) indexInput.value = '';
            }
        });
    }

    // 4. Populate Dropdown Assign (Modal Master)
    const assignSel = document.getElementById('assignOwnerSelect');
    if (assignSel) {
        assignSel.innerHTML = '<option value="">- Pilih Pemilik -</option>';
        masterData.owners.forEach(o => assignSel.innerHTML += `<option value="${o.name}">${o.name}</option>`);
    }

    // 5. Populate Locker Dropdown Options
    if (lockerDropdown && masterData.lockers) {
        lockerDropdown.innerHTML = '<option value="" disabled selected>Pilih Lokasi</option>';
        const sorted = [...masterData.lockers].sort((a, b) => {
            const nA = parseInt((a.number || "0").replace(/\D/g, ''));
            const nB = parseInt((b.number || "0").replace(/\D/g, ''));
            return nA - nB;
        });
        sorted.forEach(l => {
            const typeStr = l.type === 'Rack' ? 'RAK' : 'Loker';
            lockerDropdown.innerHTML += `<option value="${l.number}" data-type="${l.type}">${typeStr} ${l.number}</option>`;
        });
    }
}

function filterLockerDropdown() {
    const selectedOwner = ownerDropdown.value;
    const ownedLockers = masterData.lockers.filter(l => l.current_owner === selectedOwner);

    lockerDropdown.innerHTML = '<option value="" disabled selected>Pilih Lokasi</option>';

    if (ownedLockers.length > 0) {
        ownedLockers.sort((a, b) => {
            const nA = parseInt((a.number || "0").replace(/\D/g, ''));
            const nB = parseInt((b.number || "0").replace(/\D/g, ''));
            return nA - nB;
        });

        ownedLockers.forEach(l => {
            const typeStr = l.type === 'Rack' ? 'RAK' : 'Loker';
            lockerDropdown.innerHTML += `<option value="${l.number}" data-type="${l.type}">${typeStr} ${l.number}</option>`;
        });
    } else {
        lockerDropdown.innerHTML += `<option value="" disabled>Tidak punya lokasi</option>`;
    }
}

// Input Submit
if (lockerForm) {
    lockerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const typeVal = hiddenTypeInput ? hiddenTypeInput.value : 'Locker';
        const indexVal = (typeVal && typeVal.toLowerCase() === 'rack') ? (indexInput ? indexInput.value : '') : '';

        const data = {
            ownerName: document.getElementById('ownerName').value,
            itemName: document.getElementById('itemName').value,
            lockerNumber: document.getElementById('lockerNumber').value,
            locationType: typeVal,
            entryDate: document.getElementById('entryDate').value,
            expirationDate: document.getElementById('expirationDate').value,
            keterangan: document.getElementById('keterangan').value,
            index: indexVal // <-- NEW FIELD
        };
        if (new Date(data.entryDate) > new Date(data.expirationDate)) return showAlertToast("Exp Salah!", 'error');

        await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        fetchLockerItems(); resetFormMode(); showAlertToast('Data Tersimpan!', 'success');

        // cleanup index input
        if (indexInput) { indexInput.value = ''; indexGroup.style.display = 'none'; }
    });
}

// --- RENDER MASTER LIST ---
function renderMasterLists() {
    const oList = document.getElementById('masterOwnerList');
    const lList = document.getElementById('masterLockerList');
    const assignSel = document.getElementById('assignOwnerSelect');

    if (!oList) return;
    oList.innerHTML = ''; lList.innerHTML = '';
    masterData.owners.forEach(o => {
        if (o.name) oList.innerHTML += `<li>${o.name} <button class="btn-delete-master" onclick="handleDeleteMaster('${o.name}','owner')">x</button></li>`;
    });

    if (assignSel) {
        const cur = assignSel.value;
        assignSel.innerHTML = '<option value="">(Biarkan Kosong)</option>';
        masterData.owners.forEach(o => assignSel.innerHTML += `<option value="${o.name}">${o.name}</option>`);
        assignSel.value = cur;
    }

    const sorted = [...masterData.lockers].sort((a, b) => {
        const nA = parseInt((a.number || "0").replace(/\D/g, ''));
        const nB = parseInt((b.number || "0").replace(/\D/g, ''));
        return nA - nB;
    });
    sorted.forEach(l => {
        const typeBadge = l.type === 'Rack' ? '[RAK]' : '[LKR]';
        const ownerLabel = l.current_owner ? `<span style="color:green">(${l.current_owner})</span>` : `<span style="color:gray">(Kosong)</span>`;
        lList.innerHTML += `<li><span>${typeBadge} ${l.number} <small>${ownerLabel}</small></span> <button class="btn-delete-master" onclick="handleDeleteMaster('${l.number}','locker')">x</button></li>`;
    });
}

// --- EXPORT ---
async function handleExport() {
    showAlertToast(`Sedang mengekspor data ${currentActiveTab}...`, 'info');
    try {
        const res = await fetch(`${API_URL}/export?type=${currentActiveTab}`);
        if (res.ok) showAlertToast('Export Berhasil!', 'success');
        else showAlertToast('Gagal Export', 'error');
    } catch (e) { showAlertToast('Error export', 'error'); }
}

// --- EDIT LOGIC ---
function handleEditClick(id) {
    const item = currentLockerItems.find(i => i.id == id);
    if (!item) return;
    document.getElementById('editId').value = id;
    document.getElementById('editItemName').value = item.itemName;
    document.getElementById('editEntryDate').value = item.entryDate;
    document.getElementById('editExpirationDate').value = item.expirationDate;
    document.getElementById('editKeterangan').value = item.keterangan || '';
    document.getElementById('editLockerNumber').setAttribute('data-current', item.lockerNumber);
    const editOwnerSelect = document.getElementById('editOwnerName');
    editOwnerSelect.innerHTML = '<option value="" disabled>Pilih</option>';
    masterData.owners.forEach(o => editOwnerSelect.innerHTML += `<option value="${o.name}">${o.name}</option>`);
    editOwnerSelect.value = item.ownerName;
    filterEditLockerDropdown();
    document.getElementById('editLockerNumber').value = item.lockerNumber;

    // set index in edit modal and show/hide
    if (item.locationType && item.locationType.toLowerCase() === 'rack') {
        editIndexGroup.style.display = 'block';
        editIndexInput.value = item.index || '';
    } else {
        editIndexGroup.style.display = 'none';
        editIndexInput.value = '';
    }

    const statusSel = document.getElementById('editStatusSelect');
    const manualNoteInput = document.getElementById('editManualNote');
    if (item.manualStatus && item.manualStatus !== 'Auto') {
        statusSel.value = item.manualStatus;
        manualNoteInput.value = item.manualNote || '';
    } else {
        statusSel.value = 'Auto';
        manualNoteInput.value = '';
    }
    handleStatusChange();
    editModal.style.display = 'block';
}

function filterEditLockerDropdown() {
    const val = document.getElementById('editOwnerName').value;
    const lk = document.getElementById('editLockerNumber');
    const owned = masterData.lockers.filter(l => l.current_owner === val);
    lk.innerHTML = '<option value="" disabled>Pilih Lokasi</option>';
    owned.sort((a, b) => {
        const nA = parseInt((a.number || "0").replace(/\D/g, ''));
        const nB = parseInt((b.number || "0").replace(/\D/g, ''));
        return nA - nB;
    });
    let currentInList = false;
    const currentVal = lk.getAttribute('data-current');
    owned.forEach(l => {
        const typeStr = l.type === 'Rack' ? 'RAK' : 'Loker';
        lk.innerHTML += `<option value="${l.number}" data-type="${l.type}">${typeStr} ${l.number}</option>`;
        if (l.number == currentVal) currentInList = true;
    });
    if (!currentInList && currentVal) {
        lk.innerHTML += `<option value="${currentVal}" selected>${currentVal} (Asal)</option>`;
    }
}

function handleStatusChange() {
    const val = document.getElementById('editStatusSelect').value;
    const box = document.getElementById('editStatusDetailBox');
    const inp = document.getElementById('editManualNote');
    const lbl = document.getElementById('editStatusLabel');
    if (['Dipinjam', 'Kalibrasi', 'Rusak'].includes(val)) {
        box.style.display = 'block';
        lbl.textContent = val === 'Dipinjam' ? 'Peminjam:' : (val === 'Kalibrasi' ? 'Vendor:' : 'Ket:');
    } else { box.style.display = 'none'; inp.value = ''; }
}

if (editLockerForm) {
    editLockerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editId').value;
        const editLockerSel = document.getElementById('editLockerNumber');
        const selectedOpt = editLockerSel.options[editLockerSel.selectedIndex];
        const locType = selectedOpt ? (selectedOpt.getAttribute('data-type') || 'Locker') : 'Locker';
        const indexVal = (locType && locType.toLowerCase() === 'rack') ? (document.getElementById('editIndexNumber').value || '') : '';

        const data = {
            ownerName: document.getElementById('editOwnerName').value,
            itemName: document.getElementById('editItemName').value,
            lockerNumber: document.getElementById('editLockerNumber').value,
            locationType: locType,
            entryDate: document.getElementById('editEntryDate').value,
            expirationDate: document.getElementById('editExpirationDate').value,
            keterangan: document.getElementById('editKeterangan').value,
            manualStatus: document.getElementById('editStatusSelect').value,
            manualNote: document.getElementById('editManualNote').value,
            index: indexVal // <-- include index on update
        };
        await fetch(`${API_URL}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        closeEditModal(); fetchLockerItems(); showAlertToast('Update Sukses!');
    });
}

async function handleDelete(id) { if (confirm('Hapus?')) { await fetch(`${API_URL}/${id}`, { method: 'DELETE' }); fetchLockerItems(); } }
function resetFormMode() { lockerForm.reset(); if (hiddenTypeInput) hiddenTypeInput.value = 'Locker'; if (indexInput) { indexInput.value = ''; indexGroup.style.display = 'none'; } populateDropdowns(); initializeDateInputs(); }
function closeEditModal() { editModal.style.display = 'none'; }
function openMasterModal() { masterModal.style.display = 'block'; fetchMasterData(); }
function closeMasterModal() { masterModal.style.display = 'none'; }
function showSection(id) {/*...*/ }
async function handleExport() {
    showAlertToast(`Sedang mengekspor data ${currentActiveTab}...`, 'info');
    try {
        const res = await fetch(`${API_URL}/export?type=${currentActiveTab}`);
        if (res.ok) {
            const blob = await res.blob(); // jika server mengirim file
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');

            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            showAlertToast('Export Berhasil!', 'success');
        } else {
            showAlertToast('Gagal Export', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlertToast('Error export', 'error');
    }
}