let isOwner = localStorage.getItem('haus_owner_mode') === 'true';
let isEditor = !isOwner && !!localStorage.getItem('haus_editor_name');
let editorName = localStorage.getItem('haus_editor_name') || '';

function canEdit()   { return isOwner || isEditor; }
function canDelete() { return isOwner; }
function actorName() { return isOwner ? 'OWNER' : editorName; }

let currentEraKey = "";
let currentPage = 1;
const SESSIONS_PER_PAGE = 10;
let currentFilteredPhotos = [];
let currentIndex = 0;
let currentPhotogFilter = 'all';
let currentTargetMonth = null;
let currentTargetYear = null;

const MONTH_ALIASES = {
    "JAN": "JANUARY", "FEB": "FEBRUARY", "MAR": "MARCH", "MARCH": "MARCH",
    "APR": "APRIL", "APRIL": "APRIL", "MAY": "MAY", "JUN": "JUNE",
    "JUNE": "JUNE", "JUL": "JULY", "JULY": "JULY", "AUG": "AUGUST",
    "SEP": "SEPTEMBER", "SEPT": "SEPTEMBER", "OCT": "OCTOBER",
    "NOV": "NOVEMBER", "DEC": "DECEMBER"
};

const MONTH_KEYS = Object.keys(MONTH_ALIASES).sort((a, b) => b.length - a.length);
const FULL_MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
const PHOTOS_PER_SESSION_PAGE = 10;
const OWNER_PASSWORD = "HAUSOFGAGA";

const firebaseConfig = {
    apiKey: "AIzaSyA_OzgQ2ah1mpF5gguB68BNpw8hGdN9Sbw",
    authDomain: "haus-archive-80d24.firebaseapp.com",
    databaseURL: "https://haus-archive-80d24-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "haus-archive-80d24",
    storageBucket: "haus-archive-80d24.firebasestorage.app",
    messagingSenderId: "459748805258",
    appId: "1:459748805258:web:a80ae4f4033a4b8e8a7b73",
    measurementId: "G-V27K42TTCQ"
};

let database;
let archiveRef;
const sessionPhotoPages = {};

try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    archiveRef = database.ref('gagaArchive');
} catch (error) {
    console.error("Firebase init failed:", error);
}

function detectMonth(str) {
    const s = (str || '').toUpperCase().trim();
    for (const key of MONTH_KEYS) {
        if (s.startsWith(key)) return MONTH_ALIASES[key];
    }
    return null;
}

function getSessionKey(photo) {
    const source = (photo.event || photo.desc || '').toUpperCase().trim();
    const dateMatch = source.match(/^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JAN|FEB|MAR|APR|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)\s*\d{1,2}/i);
    if (dateMatch) return dateMatch[0].toUpperCase();
    if (source.includes(':')) return source.split(':')[0].trim().toUpperCase();
    return source.split(' ')[0].toUpperCase() || 'UNKNOWN';
}

function getSubTitleKey(photo) {
    if (!photo) return 'UNKNOWN';
    const raw = (photo.event || photo.desc || '').trim();
    if (!raw) return 'UNKNOWN';
    const upper = raw.toUpperCase();
    const colonIdx = upper.indexOf(':');
    return colonIdx !== -1 ? upper.slice(colonIdx + 1).trim() : upper;
}

function loadArchiveFromFirebase(callback) {
    if (!archiveRef) { callback(); return; }
    archiveRef.once('value')
        .then((snapshot) => {
            const firebaseData = snapshot.val() || {};
            Object.keys(firebaseData).forEach(eraKey => {
                const nk = eraKey.toLowerCase().replace(/\s+/g, '-');
                if (!window.gagaArchive[nk]) {
                    window.gagaArchive[nk] = { title: eraKey.toUpperCase(), photos: [] };
                }
                const raw = firebaseData[eraKey]?.photos || {};
                const fbPhotos = Array.isArray(raw) ? raw : Object.values(raw);
                const existingUrls = new Set(window.gagaArchive[nk].photos.map(p => p.url));
                fbPhotos.forEach(p => {
                    if (p && p.url && !existingUrls.has(p.url)) {
                        window.gagaArchive[nk].photos.push(p);
                    }
                });
            });
            callback();
            renderSidebar();
        })
        .catch(() => callback());
}

function showLobby() {
    localStorage.removeItem('haus_current_era');
    currentEraKey = "";
    currentPhotogFilter = 'all';
    currentPage = 1;
    currentTargetMonth = null;
    currentTargetYear = null;
    document.getElementById('lobby').style.display = 'block';
    document.getElementById('exhibition-room').style.display = 'none';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'none';
}

function openEra(key) {
    currentEraKey = key;
    currentPage = 1;
    currentTargetMonth = null;
    currentTargetYear = null;
    localStorage.setItem('haus_current_era', key);
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('exhibition-room').style.display = 'block';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'flex';
    renderPhotos();
}

function init() {
    loadArchiveFromFirebase(() => {
        filterEras('all');
        renderSidebar();
        if (isOwner) renderOwnerUI();
        else if (isEditor) renderEditorUI();
        setupSearchKey();
        const savedEra = localStorage.getItem('haus_current_era');
        if (savedEra && window.gagaArchive[savedEra]) openEra(savedEra);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'l' && !isOwner && !isEditor) showLoginModal();
    });
}

function showLogin() { showLoginModal(); }

function showLoginModal() {
    const existing = document.getElementById('login-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'login-modal-overlay';
    overlay.className = 'om-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="om-panel" style="max-width:400px;">
            <div class="om-header">
                <div class="om-header-left">
                    <span class="om-badge" style="background:#1a1a1a;color:#888;border:1px solid #333;letter-spacing:3px;">ACCESS</span>
                    <h2 class="om-title">Login</h2>
                </div>
                <button class="om-close" onclick="document.getElementById('login-modal-overlay').remove()">×</button>
            </div>
            <div class="om-body">
                <div class="om-field">
                    <label class="om-label">Name</label>
                    <input type="text" id="login-name" class="om-input" placeholder="Your name" autocomplete="off">
                </div>
                <div class="om-field">
                    <label class="om-label">Password</label>
                    <input type="password" id="login-pass" class="om-input" placeholder="••••••••">
                </div>
                <div id="login-error" style="font-size:11px;color:#ff4444;letter-spacing:2px;display:none;font-family:'Space Mono',monospace;padding-top:4px;">UNAUTHORIZED</div>
            </div>
            <div class="om-footer">
                <button class="om-btn-cancel" onclick="document.getElementById('login-modal-overlay').remove()">Cancel</button>
                <button class="om-btn-save add" onclick="attemptLogin()">Enter</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('om-open'));
    setTimeout(() => { const n = document.getElementById('login-name'); if (n) n.focus(); }, 250);
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });
}

function attemptLogin() {
    const nameVal = (document.getElementById('login-name')?.value || '').trim();
    const passVal = (document.getElementById('login-pass')?.value || '').trim();
    const errEl   = document.getElementById('login-error');

    if (passVal.toUpperCase() === OWNER_PASSWORD) {
        localStorage.setItem('haus_owner_mode', 'true');
        localStorage.removeItem('haus_editor_name');
        location.reload();
        return;
    }

    if (!database) {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'NO CONNECTION'; }
        return;
    }

    database.ref('hausEditors').once('value').then(snap => {
        const editors = snap.val() || {};
        const match = Object.values(editors).find(e =>
            e.password === passVal && e.name.toLowerCase() === nameVal.toLowerCase()
        );
        if (match) {
            localStorage.setItem('haus_editor_name', match.name);
            localStorage.removeItem('haus_owner_mode');
            location.reload();
        } else {
            if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'UNAUTHORIZED'; }
            const passInput = document.getElementById('login-pass');
            if (passInput) { passInput.value = ''; passInput.focus(); }
        }
    });
}

function logout() {
    localStorage.removeItem('haus_owner_mode');
    localStorage.removeItem('haus_editor_name');
    isOwner = false;
    isEditor = false;
    location.reload();
}

function renderOwnerUI() {
    const subNav = document.getElementById('sub-era-nav');
    if (!subNav) return;
    const existing = document.getElementById('owner-controls');
    if (existing) existing.remove();
    const panel = document.createElement('span');
    panel.id = 'owner-controls';
    panel.style = `display:inline-flex;align-items:center;gap:14px;margin-left:20px;padding-left:15px;border-left:1px solid #333;vertical-align:middle;`;
    panel.innerHTML = `
        <span onclick="openAddModal()" style="color:#00ff88;cursor:pointer;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">[+] ADD</span>
        <span onclick="openActivityLog()" style="color:#ffaa00;cursor:pointer;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">◈ LOG</span>
        <span onclick="openEditorManager()" style="color:#aaaaff;cursor:pointer;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">⊞ EDITORS</span>
        <span onclick="logout()" style="color:#ff4444;cursor:pointer;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">LOGOUT</span>`;
    subNav.appendChild(panel);
}

function renderEditorUI() {
    const subNav = document.getElementById('sub-era-nav');
    if (!subNav) return;
    const existing = document.getElementById('owner-controls');
    if (existing) existing.remove();
    const panel = document.createElement('span');
    panel.id = 'owner-controls';
    panel.style = `display:inline-flex;align-items:center;gap:14px;margin-left:20px;padding-left:15px;border-left:1px solid #333;vertical-align:middle;`;
    panel.innerHTML = `
        <span style="color:#888;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-family:'Space Mono',monospace;">✦ ${editorName.toUpperCase()}</span>
        <span onclick="openAddModal()" style="color:#00ff88;cursor:pointer;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">[+] ADD</span>
        <span onclick="logout()" style="color:#ff4444;cursor:pointer;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">LOGOUT</span>`;
    subNav.appendChild(panel);
}

function logActivity(action, data) {
    if (!database) return;
    const entry = {
        action,
        actor: actorName(),
        timestamp: Date.now(),
        ...data
    };
    database.ref('hausActivityLog').push(entry).catch(() => {});
}

function closeOwnerModal() {
    const overlay = document.getElementById('owner-modal-overlay');
    if (overlay) {
        overlay.classList.remove('om-open');
        setTimeout(() => overlay.remove(), 220);
    }
    const legacy = document.getElementById('owner-modal');
    if (legacy) legacy.remove();
}

function openAddModal() {
    closeOwnerModal();
    const photogOptions = Object.keys(window.gagaPhotogs || {}).map(k =>
        `<option value="${window.gagaPhotogs[k].name}">${window.gagaPhotogs[k].name}</option>`
    ).join('');
    const eraOptions = Object.keys(window.gagaArchive || {}).map(k =>
        `<option value="${k}">${window.gagaArchive[k].title || k.toUpperCase()}</option>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.id = 'owner-modal-overlay';
    overlay.className = 'om-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeOwnerModal(); };
    overlay.innerHTML = `
        <div class="om-panel">
            <div class="om-header">
                <div class="om-header-left">
                    <span class="om-badge add">ADD</span>
                    <h2 class="om-title">New Photo</h2>
                </div>
                <button class="om-close" onclick="closeOwnerModal()">×</button>
            </div>
            <div class="om-body">
                <div class="om-field">
                    <label class="om-label">Image URL <span class="om-req">*</span></label>
                    <input type="text" id="m-url" class="om-input" placeholder="https://...">
                </div>
                <div class="om-row">
                    <div class="om-field">
                        <label class="om-label">Year <span class="om-req">*</span></label>
                        <input type="number" id="m-year" class="om-input" placeholder="2025">
                    </div>
                    <div class="om-field om-field-grow">
                        <label class="om-label">Era <span class="om-req">*</span></label>
                        <select id="m-era" class="om-input om-select">${eraOptions}</select>
                    </div>
                </div>
                <div class="om-field">
                    <label class="om-label">Event</label>
                    <input type="text" id="m-event" class="om-input" placeholder="e.g. FEB 14: SWIMSUIT STORE">
                </div>
                <div class="om-field">
                    <label class="om-label">Description</label>
                    <input type="text" id="m-desc" class="om-input" placeholder="e.g. Promotional Session">
                </div>
                <div class="om-field">
                    <label class="om-label">Photographer</label>
                    <input type="text" id="m-photog-input" class="om-input" placeholder="e.g. Inez and Vinoodh" list="m-photog-list">
                    <datalist id="m-photog-list">${photogOptions}</datalist>
                </div>
            </div>
            <div class="om-footer">
                <button class="om-btn-cancel" onclick="closeOwnerModal()">Cancel</button>
                <button class="om-btn-save add" onclick="saveNewPhoto()">Save Photo</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('om-open'));
}

function saveNewPhoto() {
    const url      = document.getElementById('m-url').value.trim();
    const desc     = document.getElementById('m-desc').value.trim();
    const event    = document.getElementById('m-event').value.trim();
    const year     = document.getElementById('m-year').value.trim();
    const photogRaw = document.getElementById('m-photog-input').value.trim();
    const eraKey   = document.getElementById('m-era').value;

    if (!url || !year || !eraKey) return alert("URL, Year, and Era are required.");
    if (!url.startsWith('http')) return alert("Please enter a valid image URL starting with http.");

    const matchedKey = Object.keys(window.gagaPhotogs || {}).find(k =>
        window.gagaPhotogs[k].name.toLowerCase() === photogRaw.toLowerCase()
    );
    const photogKey = matchedKey || (photogRaw ? photogRaw : "NONE");
    const normalizedEraKey = eraKey.toLowerCase().replace(/\s+/g, '-');
    const newPhoto = { url, desc, event, year, photogKey };

    if (archiveRef) {
        database.ref(`gagaArchive/${normalizedEraKey}/photos`).push(newPhoto)
            .then(() => {
                logActivity('ADD', { photoUrl: url, era: normalizedEraKey, event, year, photographer: photogKey });
                alert("Photo saved!");
                closeOwnerModal();
                location.reload();
            })
            .catch(err => alert("Failed to save: " + err.message));
    } else {
        alert("No connection to shared archive.");
    }
}

function openEditModal(photoUrl) {
    if (!archiveRef) return alert("No connection.");
    archiveRef.once('value').then(snapshot => {
        let foundEraKey = null, foundPhotoKey = null, foundPhoto = null;
        snapshot.forEach(eraSnap => {
            const photos = eraSnap.child('photos').val() || {};
            Object.keys(photos).forEach(pk => {
                if (photos[pk].url === photoUrl) {
                    foundEraKey = eraSnap.key;
                    foundPhotoKey = pk;
                    foundPhoto = photos[pk];
                }
            });
        });
        if (!foundPhoto) return alert("Photo not found in shared archive.");

        const existingModal = document.getElementById('owner-modal');
        if (existingModal) existingModal.remove();

        const photogOptions = Object.keys(window.gagaPhotogs || {}).map(k =>
            `<option value="${window.gagaPhotogs[k].name}">${window.gagaPhotogs[k].name}</option>`
        ).join('');
        const currentPhotogName = foundPhoto.photogKey === 'NONE' || !foundPhoto.photogKey ? ''
            : (window.gagaPhotogs[foundPhoto.photogKey] ? window.gagaPhotogs[foundPhoto.photogKey].name : foundPhoto.photogKey);
        const eraOptions = Object.keys(window.gagaArchive || {}).map(k =>
            `<option value="${k}" ${foundEraKey === k ? 'selected' : ''}>${window.gagaArchive[k].title || k.toUpperCase()}</option>`
        ).join('');

        const overlay = document.createElement('div');
        overlay.id = 'owner-modal-overlay';
        overlay.className = 'om-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) closeOwnerModal(); };
        overlay.innerHTML = `
            <div class="om-panel">
                <div class="om-header">
                    <div class="om-header-left">
                        <span class="om-badge edit">EDIT</span>
                        <h2 class="om-title">Edit Photo</h2>
                    </div>
                    <button class="om-close" onclick="closeOwnerModal()">×</button>
                </div>
                <div class="om-body">
                    <div class="om-field">
                        <label class="om-label">Image URL <span class="om-req">*</span></label>
                        <input type="text" id="e-url" class="om-input" value="${foundPhoto.url || ''}">
                    </div>
                    <div class="om-row">
                        <div class="om-field">
                            <label class="om-label">Year <span class="om-req">*</span></label>
                            <input type="number" id="e-year" class="om-input" value="${foundPhoto.year || ''}">
                        </div>
                        <div class="om-field om-field-grow">
                            <label class="om-label">Era</label>
                            <select id="e-era" class="om-input om-select">${eraOptions}</select>
                        </div>
                    </div>
                    <div class="om-field">
                        <label class="om-label">Event</label>
                        <input type="text" id="e-event" class="om-input" value="${foundPhoto.event || ''}" placeholder="e.g. FEB 14: SWIMSUIT STORE">
                    </div>
                    <div class="om-field">
                        <label class="om-label">Description</label>
                        <input type="text" id="e-desc" class="om-input" value="${foundPhoto.desc || ''}" placeholder="e.g. Promotional Session">
                    </div>
                    <div class="om-field">
                        <label class="om-label">Photographer</label>
                        <input type="text" id="e-photog-input" class="om-input" value="${currentPhotogName}" placeholder="e.g. Inez and Vinoodh" list="e-photog-list">
                        <datalist id="e-photog-list">${photogOptions}</datalist>
                    </div>
                </div>
                <div class="om-footer">
                    <button class="om-btn-cancel" onclick="closeOwnerModal()">Cancel</button>
                    <button class="om-btn-save edit" onclick="saveEditedPhoto('${foundEraKey}','${foundPhotoKey}','${photoUrl}')">Save Changes</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('om-open'));

        window._editBefore = { url: foundPhoto.url, desc: foundPhoto.desc, event: foundPhoto.event, year: foundPhoto.year, photogKey: foundPhoto.photogKey, era: foundEraKey };
    });
}

function saveEditedPhoto(originalEraKey, photoKey, originalUrl) {
    const url       = document.getElementById('e-url').value.trim();
    const desc      = document.getElementById('e-desc').value.trim();
    const event     = document.getElementById('e-event').value.trim();
    const year      = document.getElementById('e-year').value.trim();
    const photogRaw = document.getElementById('e-photog-input').value.trim();
    const newEraKey = document.getElementById('e-era').value;

    if (!url || !year) return alert("URL and Year are required.");

    const matchedKey = Object.keys(window.gagaPhotogs || {}).find(k =>
        window.gagaPhotogs[k].name.toLowerCase() === photogRaw.toLowerCase()
    );
    const photogKey  = matchedKey || (photogRaw ? photogRaw : "NONE");
    const updatedPhoto = { url, desc, event, year, photogKey };
    const eraChanged = newEraKey !== originalEraKey;

    const before = window._editBefore || {};
    const after  = { url, desc, event, year, photogKey, era: newEraKey };

    const doLog = () => logActivity('EDIT', { photoUrl: url, before, after });

    if (eraChanged) {
        database.ref(`gagaArchive/${originalEraKey}/photos/${photoKey}`).remove()
            .then(() => database.ref(`gagaArchive/${newEraKey}/photos`).push(updatedPhoto))
            .then(() => { doLog(); alert("Photo moved and updated!"); closeOwnerModal(); closeLightbox(); location.reload(); })
            .catch(err => alert("Update failed: " + err.message));
    } else {
        database.ref(`gagaArchive/${originalEraKey}/photos/${photoKey}`).set(updatedPhoto)
            .then(() => { doLog(); alert("Photo updated!"); closeOwnerModal(); closeLightbox(); location.reload(); })
            .catch(err => alert("Update failed: " + err.message));
    }
}

function deletePhoto(photoUrl) {
    if (!confirm("DELETE THIS PHOTO PERMANENTLY?")) return;
    if (!archiveRef) return alert("No connection.");
    archiveRef.once('value').then(snapshot => {
        const updates = {};
        let deletedMeta = {};
        snapshot.forEach(eraSnap => {
            const photos = eraSnap.child('photos').val() || {};
            Object.keys(photos).forEach(pk => {
                if (photos[pk].url === photoUrl) {
                    updates[`${eraSnap.key}/photos/${pk}`] = null;
                    deletedMeta = { era: eraSnap.key, event: photos[pk].event, year: photos[pk].year };
                }
            });
        });
        if (Object.keys(updates).length > 0) {
            archiveRef.update(updates)
                .then(() => {
                    logActivity('DELETE', { photoUrl, ...deletedMeta });
                    alert("Photo deleted.");
                    closeLightbox();
                    location.reload();
                })
                .catch(err => alert("Delete failed: " + err.message));
        } else {
            alert("Photo not found in shared archive.");
        }
    });
}

function openActivityLog() {
    if (!database) return alert("No connection.");
    const existing = document.getElementById('log-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'log-modal-overlay';
    overlay.className = 'om-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="om-panel log-panel">
            <div class="om-header">
                <div class="om-header-left">
                    <span class="om-badge" style="background:#ffaa00;color:#000;">LOG</span>
                    <h2 class="om-title">Activity Log</h2>
                </div>
                <button class="om-close" onclick="document.getElementById('log-modal-overlay').remove()">×</button>
            </div>
            <div id="log-body" class="log-body">
                <div class="log-loading">Loading...</div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('om-open'));

    database.ref('hausActivityLog').orderByChild('timestamp').limitToLast(100).once('value').then(snap => {
        const body = document.getElementById('log-body');
        if (!body) return;
        const entries = [];
        snap.forEach(child => entries.push(child.val()));
        entries.reverse();

        if (entries.length === 0) {
            body.innerHTML = `<div class="log-empty">No activity recorded yet.</div>`;
            return;
        }

        body.innerHTML = entries.map(e => {
            const d  = new Date(e.timestamp);
            const ts = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                     + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            const actionClass = e.action === 'ADD' ? 'log-add' : e.action === 'DELETE' ? 'log-del' : 'log-edit';
            const thumb = e.photoUrl ? `<img class="log-thumb" src="${e.photoUrl}" loading="lazy" onerror="this.style.display='none'">` : '';

            let details = '';
            if (e.action === 'EDIT' && e.before && e.after) {
                const fields = ['url','event','desc','year','photogKey','era'];
                const changed = fields.filter(f => (e.before[f]||'') !== (e.after[f]||''));
                details = changed.map(f => `
                    <div class="log-diff">
                        <span class="log-field">${f.toUpperCase()}</span>
                        <span class="log-before">${e.before[f] || '—'}</span>
                        <span class="log-arrow">→</span>
                        <span class="log-after">${e.after[f] || '—'}</span>
                    </div>`).join('');
            } else if (e.action === 'ADD') {
                details = `<div class="log-meta">${[e.era, e.event, e.year].filter(Boolean).join(' · ')}</div>`;
            } else if (e.action === 'DELETE') {
                details = `<div class="log-meta">${[e.era, e.event, e.year].filter(Boolean).join(' · ')}</div>`;
            }

            return `
                <div class="log-entry">
                    <div class="log-entry-top">
                        ${thumb}
                        <div class="log-entry-info">
                            <div class="log-entry-header">
                                <span class="log-action ${actionClass}">${e.action}</span>
                                <span class="log-actor">${e.actor || 'UNKNOWN'}</span>
                                <span class="log-ts">${ts}</span>
                            </div>
                            ${details}
                        </div>
                    </div>
                </div>`;
        }).join('');
    }).catch(() => {
        const body = document.getElementById('log-body');
        if (body) body.innerHTML = `<div class="log-empty">Failed to load log.</div>`;
    });
}

function openEditorManager() {
    if (!database) return alert("No connection.");
    const existing = document.getElementById('editors-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'editors-modal-overlay';
    overlay.className = 'om-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="om-panel" style="max-width:520px;">
            <div class="om-header">
                <div class="om-header-left">
                    <span class="om-badge" style="background:#aaaaff;color:#000;">EDITORS</span>
                    <h2 class="om-title">Manage Editors</h2>
                </div>
                <button class="om-close" onclick="document.getElementById('editors-modal-overlay').remove()">×</button>
            </div>
            <div id="editors-list" class="editors-list"><div class="log-loading">Loading...</div></div>
            <div class="om-body" style="border-top:1px solid rgba(255,255,255,0.07);padding-top:20px;">
                <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:3px;color:#888;margin-bottom:14px;text-transform:uppercase;">Add New Editor</div>
                <div class="om-row">
                    <div class="om-field om-field-grow">
                        <label class="om-label">Name</label>
                        <input type="text" id="new-editor-name" class="om-input" placeholder="Editor name">
                    </div>
                    <div class="om-field om-field-grow">
                        <label class="om-label">Password</label>
                        <input type="text" id="new-editor-pass" class="om-input" placeholder="Password">
                    </div>
                </div>
            </div>
            <div class="om-footer">
                <button class="om-btn-cancel" onclick="document.getElementById('editors-modal-overlay').remove()">Close</button>
                <button class="om-btn-save" style="background:#aaaaff;color:#000;" onclick="addEditor()">Add Editor</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('om-open'));
    loadEditorsList();
}

function loadEditorsList() {
    const listEl = document.getElementById('editors-list');
    if (!listEl || !database) return;
    database.ref('hausEditors').once('value').then(snap => {
        const editors = snap.val() || {};
        const keys = Object.keys(editors);
        if (keys.length === 0) {
            listEl.innerHTML = `<div class="log-empty" style="padding:20px 24px;">No editors added yet.</div>`;
            return;
        }
        listEl.innerHTML = `
            <div class="editors-table">
                <div class="editors-th"><span>Name</span><span>Password</span><span></span></div>
                ${keys.map(k => `
                    <div class="editors-row">
                        <span class="editors-name">${editors[k].name}</span>
                        <span class="editors-pass">${editors[k].password}</span>
                        <button class="editors-del-btn" onclick="removeEditor('${k}')">✕</button>
                    </div>`).join('')}
            </div>`;
    });
}

function addEditor() {
    const name = document.getElementById('new-editor-name')?.value.trim();
    const pass = document.getElementById('new-editor-pass')?.value.trim();
    if (!name || !pass) return alert("Name and password are required.");
    if (!database) return alert("No connection.");
    database.ref('hausEditors').push({ name, password: pass })
        .then(() => {
            document.getElementById('new-editor-name').value = '';
            document.getElementById('new-editor-pass').value = '';
            loadEditorsList();
        })
        .catch(err => alert("Failed: " + err.message));
}

function removeEditor(key) {
    if (!confirm("Remove this editor?")) return;
    database.ref(`hausEditors/${key}`).remove()
        .then(() => loadEditorsList())
        .catch(err => alert("Failed: " + err.message));
}

function filterPhotographers() {
    const input = document.getElementById('photogSearch');
    if (!input) return;
    const filter = input.value.toUpperCase();
    const buttons = document.getElementById('photog-filters').getElementsByTagName('button');
    for (let i = 0; i < buttons.length; i++) {
        const txt = buttons[i].textContent || buttons[i].innerText;
        buttons[i].style.display = txt.toUpperCase().indexOf(filter) > -1 ? "" : "none";
    }
}

function setupSearchKey() {
    const searchBar = document.getElementById('photogSearch');
    if (searchBar) {
        searchBar.replaceWith(searchBar.cloneNode(true));
        const newBar = document.getElementById('photogSearch');
        newBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = newBar.value.trim();
                if (val === '') { currentPhotogFilter = 'all'; renderPhotos('all'); newBar.value = ''; filterPhotographers(); return; }
                const firstMatch = Array.from(document.querySelectorAll('#photog-filters button')).find(b => b.style.display !== 'none');
                if (firstMatch) { firstMatch.click(); newBar.value = ''; filterPhotographers(); }
            }
        });
    }
}

let dragSrc = null;

function makeDraggable(grid, photosRef) {
    function getItems() { return Array.from(grid.querySelectorAll('.photo-item:not(.photo-item-empty)')); }
    grid.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.photo-item');
        if (!item || item.classList.contains('photo-item-empty')) return;
        dragSrc = item; item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', '');
    });
    grid.addEventListener('dragend', (e) => {
        const item = e.target.closest('.photo-item');
        if (item) item.classList.remove('dragging');
        grid.querySelectorAll('.photo-item').forEach(i => i.classList.remove('drag-over'));
        dragSrc = null;
    });
    grid.addEventListener('dragover', (e) => {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        const target = e.target.closest('.photo-item');
        if (!target || target === dragSrc || target.classList.contains('photo-item-empty')) return;
        grid.querySelectorAll('.photo-item').forEach(i => i.classList.remove('drag-over'));
        target.classList.add('drag-over');
    });
    grid.addEventListener('dragleave', (e) => {
        const target = e.target.closest('.photo-item');
        if (target) target.classList.remove('drag-over');
    });
    grid.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target.closest('.photo-item');
        if (!target || target === dragSrc || target.classList.contains('photo-item-empty')) return;
        target.classList.remove('drag-over');
        const items = getItems();
        const srcIdx = items.indexOf(dragSrc), tgtIdx = items.indexOf(target);
        if (srcIdx === -1 || tgtIdx === -1) return;
        if (srcIdx < tgtIdx) grid.insertBefore(dragSrc, target.nextSibling);
        else grid.insertBefore(dragSrc, target);
        [photosRef[srcIdx], photosRef[tgtIdx]] = [photosRef[tgtIdx], photosRef[srcIdx]];
        showDragSaveBar(grid, photosRef);
    });
}

function showDragSaveBar(grid, photosRef) {
    const wrapper = grid.closest('.session-photos-wrapper');
    if (!wrapper) return;
    let bar = wrapper.querySelector('.drag-save-bar');
    if (bar) { bar.querySelectorAll('button')[0].onclick = () => saveDragOrder(bar.querySelectorAll('button')[0], photosRef.map(p => p.url)); return; }
    bar = document.createElement('div');
    bar.className = 'drag-save-bar';
    bar.innerHTML = `<span>UNSAVED ORDER CHANGES</span><button>SAVE ORDER</button><button style="background:transparent;color:#888;border:1px solid #333;" onclick="location.reload()">CANCEL</button>`;
    bar.querySelectorAll('button')[0].onclick = () => saveDragOrder(bar.querySelectorAll('button')[0], photosRef.map(p => p.url));
    wrapper.appendChild(bar);
}

function saveDragOrder(btn, orderedUrls) {
    if (!archiveRef) return alert("No connection.");
    btn.textContent = 'SAVING...'; btn.disabled = true;
    archiveRef.once('value').then(snapshot => {
        const eraPhotoMap = {};
        snapshot.forEach(eraSnap => {
            const photos = eraSnap.child('photos').val() || {};
            Object.keys(photos).forEach(pk => {
                if (orderedUrls.includes(photos[pk].url)) {
                    if (!eraPhotoMap[eraSnap.key]) eraPhotoMap[eraSnap.key] = {};
                    eraPhotoMap[eraSnap.key][pk] = photos[pk];
                }
            });
        });
        const promises = [];
        Object.keys(eraPhotoMap).forEach(eraKey => {
            const existingEntries = eraPhotoMap[eraKey];
            const orderedForEra = orderedUrls.map(url => Object.values(existingEntries).find(p => p.url === url)).filter(Boolean);
            const deletePromises = Object.keys(existingEntries).map(k => database.ref(`gagaArchive/${eraKey}/photos/${k}`).remove());
            promises.push(Promise.all(deletePromises).then(() =>
                orderedForEra.reduce((chain, photo) =>
                    chain.then(() => database.ref(`gagaArchive/${eraKey}/photos`).push(photo)), Promise.resolve())
            ));
        });
        Promise.all(promises)
            .then(() => {
                const bar = btn.closest('.drag-save-bar');
                if (bar) { bar.innerHTML = `<span style="color:#00ff88;">✓ ORDER SAVED</span>`; setTimeout(() => location.reload(), 800); }
            })
            .catch(err => { alert("Save failed: " + err.message); btn.textContent = 'SAVE ORDER'; btn.disabled = false; });
    });
}

function buildSessionPhotoGrid(sessionKey, photos, observer) {
    const wrapper = document.createElement('div');
    wrapper.className = 'session-photos-wrapper';
    const totalPhotos = photos.length;

    if (totalPhotos <= PHOTOS_PER_SESSION_PAGE) {
        const grid = document.createElement('div');
        grid.className = 'photo-wall-inner';
        const pagePhotosRef = photos.slice();
        pagePhotosRef.forEach(photo => grid.appendChild(createPhotoItem(photo, observer)));
        const remaining = PHOTOS_PER_SESSION_PAGE - totalPhotos;
        for (let i = 0; i < remaining; i++) { const e = document.createElement('div'); e.className = 'photo-item photo-item-empty'; grid.appendChild(e); }
        if (canEdit()) makeDraggable(grid, pagePhotosRef);
        wrapper.appendChild(grid);
        const spacer = document.createElement('div');
        spacer.className = 'session-pagination session-pagination-spacer';
        spacer.innerHTML = '&nbsp;';
        wrapper.appendChild(spacer);
        return wrapper;
    }

    const totalSessionPages = Math.ceil(totalPhotos / PHOTOS_PER_SESSION_PAGE);
    if (!sessionPhotoPages[sessionKey]) sessionPhotoPages[sessionKey] = 1;

    function renderPage() {
        wrapper.innerHTML = '';
        const pg = sessionPhotoPages[sessionKey];
        const pagePhotos = photos.slice((pg - 1) * PHOTOS_PER_SESSION_PAGE, Math.min(pg * PHOTOS_PER_SESSION_PAGE, totalPhotos));
        const pagePhotosRef = pagePhotos.slice();
        const grid = document.createElement('div');
        grid.className = 'photo-wall-inner';
        pagePhotosRef.forEach(photo => grid.appendChild(createPhotoItem(photo, observer)));
        const remaining = PHOTOS_PER_SESSION_PAGE - pagePhotos.length;
        for (let i = 0; i < remaining; i++) { const e = document.createElement('div'); e.className = 'photo-item photo-item-empty'; grid.appendChild(e); }
        if (canEdit()) makeDraggable(grid, pagePhotosRef);
        wrapper.appendChild(grid);

        const pager = document.createElement('div');
        pager.className = 'session-pagination';
        const prev = document.createElement('span'); prev.className = 'pag-nav-btn'; prev.textContent = '← PREV';
        if (pg > 1) prev.onclick = () => { sessionPhotoPages[sessionKey] = pg - 1; renderPage(); };
        else prev.classList.add('hidden-btn');
        pager.appendChild(prev);
        for (let p = 1; p <= totalSessionPages; p++) {
            const link = document.createElement('span'); link.className = 'pag-num-btn'; link.textContent = p;
            if (p === pg) { link.style.fontWeight = 'bold'; link.style.textDecoration = 'underline'; link.style.color = '#fff'; }
            link.onclick = ((page) => () => { sessionPhotoPages[sessionKey] = page; renderPage(); })(p);
            pager.appendChild(link);
        }
        const next = document.createElement('span'); next.className = 'pag-nav-btn'; next.textContent = 'NEXT →';
        if (pg < totalSessionPages) next.onclick = () => { sessionPhotoPages[sessionKey] = pg + 1; renderPage(); };
        else next.classList.add('hidden-btn');
        pager.appendChild(next);
        wrapper.appendChild(pager);
    }
    renderPage();
    return wrapper;
}

function createPhotoItem(photo, observer) {
    const photoDiv = document.createElement('div');
    photoDiv.className = 'photo-item';
    if (canEdit()) photoDiv.draggable = true;

    const photogDisplay = (photo.photogKey === "NONE" || !photo.photogKey)
        ? ""
        : (window.gagaPhotogs[photo.photogKey] ? window.gagaPhotogs[photo.photogKey].name.toUpperCase() : photo.photogKey.toUpperCase());

    const descLabel = photo.desc ? photo.desc.toUpperCase() : '';

    const editOverlay = canEdit()
        ? `<div class="owner-edit-overlay" onclick="event.stopPropagation(); openEditModal('${photo.url}')">✎ EDIT</div>` : '';
    const dragHandle = canEdit()
        ? `<div class="drag-handle">⠿</div>` : '';

    photoDiv.innerHTML = `
        ${editOverlay}${dragHandle}
        <img data-src="${photo.url}" loading="lazy" onclick="openLightbox(${photo.globalIndex})" style="opacity:0;transition:opacity 0.3s;">
        <div class="photo-info">
            <span class="info-photog" onclick="handlePhotogClick(event,'${photo.photogKey}')">${photogDisplay}</span>
            ${descLabel ? `<div class="info-event">${descLabel}</div>` : ''}
        </div>`;
    const img = photoDiv.querySelector('img');
    img.onload = () => img.style.opacity = '1';
    img.addEventListener('mousedown', (e) => e.stopPropagation());
    observer.observe(img);
    return photoDiv;
}

function renderPhotos(filterKey = currentPhotogFilter, btn = null, targetMonth = null, page = 1, targetYear = currentTargetYear) {
    currentPhotogFilter = filterKey; currentPage = page;
    currentTargetMonth = targetMonth; currentTargetYear = targetYear;
    const display = document.getElementById('photo-display');
    const titleEl = document.getElementById('active-title');
    if (!display) return;
    display.innerHTML = '';

    let rawPhotos = [];
    if (currentEraKey) {
        rawPhotos = window.gagaArchive[currentEraKey]?.photos || [];
        if (currentPhotogFilter !== 'all') rawPhotos = rawPhotos.filter(p => p.photogKey === currentPhotogFilter);
        const eraTitle = window.gagaArchive[currentEraKey]?.title || "UNKNOWN";
        const photogName = window.gagaPhotogs[filterKey]?.name || (filterKey !== 'all' ? filterKey : null);
        titleEl.innerText = (currentPhotogFilter === 'all' || !photogName) ? eraTitle : `${eraTitle} — ${photogName.toUpperCase()}`;
    } else {
        Object.keys(window.gagaArchive || {}).forEach(eraKey => {
            let photos = window.gagaArchive[eraKey]?.photos || [];
            if (!Array.isArray(photos)) photos = Object.values(photos);
            if (currentPhotogFilter !== 'all') photos = photos.filter(p => p.photogKey === currentPhotogFilter);
            rawPhotos = [...rawPhotos, ...photos];
        });
        titleEl.innerText = filterKey === 'all' ? "FULL GALLERY" : `ALL WORK BY ${(window.gagaPhotogs[filterKey]?.name || filterKey).toUpperCase()}`;
    }

    if (rawPhotos.length === 0) { display.innerHTML = `<div class="no-results">NO PHOTOS FOUND.</div>`; return; }
    currentFilteredPhotos = rawPhotos;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); observer.unobserve(img); }
            }
        });
    }, { rootMargin: '400px' });

    const yearGroups = {};
    rawPhotos.forEach((photo, index) => {
        const year = photo.year; if (!year) return;
        if (!yearGroups[year]) yearGroups[year] = [];
        yearGroups[year].push({ ...photo, globalIndex: index });
    });

    const sortedYears = Object.keys(yearGroups).sort((a, b) => a - b);
    const allSessions = [];
    const allYearMonths = {};
    sortedYears.forEach(y => {
        const months = new Set();
        yearGroups[y].forEach(p => { const m = detectMonth(p.event || p.desc || ''); if (m) months.add(m); });
        allYearMonths[y] = Array.from(months).sort((a, b) => FULL_MONTHS.indexOf(a) - FULL_MONTHS.indexOf(b));
    });

    const yearsToRender = (targetYear && !currentEraKey) ? [targetYear] : sortedYears;
    yearsToRender.forEach(year => {
        if (!yearGroups[year] || yearGroups[year].length === 0) return;
        const filteredPhotos = targetMonth ? yearGroups[year].filter(p => detectMonth(p.event || p.desc || '') === targetMonth) : yearGroups[year];
        if (filteredPhotos.length === 0) return;
        const sessionGroups = {};
        filteredPhotos.forEach(photo => {
            const sk = getSessionKey(photo);
            if (!sessionGroups[sk]) sessionGroups[sk] = [];
            sessionGroups[sk].push(photo);
        });
        const sortedSessionKeys = Object.keys(sessionGroups).sort((a, b) => {
            const getMonthIdx = key => { for (const mk of MONTH_KEYS) { if (key.startsWith(mk)) return FULL_MONTHS.indexOf(MONTH_ALIASES[mk]); } return 999; };
            const aM = getMonthIdx(a), bM = getMonthIdx(b);
            if (aM !== bM) return aM - bM;
            return parseInt(a.match(/\d+/)?.[0] || 0) - parseInt(b.match(/\d+/)?.[0] || 0);
        });
        sortedSessionKeys.forEach((sessionKey, i) => {
            allSessions.push({ year, sessionKey, photos: sessionGroups[sessionKey], isFirstOfYear: i === 0, availableMonths: allYearMonths[year] });
        });
    });

    if (allSessions.length === 0) { display.innerHTML = `<div class="no-results">NO PHOTOS FOUND.</div>`; return; }

    const totalSessions = allSessions.length;
    const totalPages = Math.ceil(totalSessions / SESSIONS_PER_PAGE);
    const pageSessions = allSessions.slice((currentPage - 1) * SESSIONS_PER_PAGE, Math.min(currentPage * SESSIONS_PER_PAGE, totalSessions));
    const renderedYears = new Set();

    function buildPagination() {
        if (totalPages <= 1) return null;
        const pagination = document.createElement('div');
        pagination.className = 'pagination';
        const prev = document.createElement('span'); prev.className = 'pag-nav-btn'; prev.textContent = '← PREV';
        if (currentPage > 1) prev.onclick = () => { renderPhotos(currentPhotogFilter, null, currentTargetMonth, currentPage - 1); window.scrollTo(0, 0); };
        else prev.classList.add('hidden-btn');
        pagination.appendChild(prev);
        for (let p = 1; p <= totalPages; p++) {
            const link = document.createElement('span'); link.className = 'pag-num-btn'; link.textContent = p;
            if (p === currentPage) { link.style.fontWeight = 'bold'; link.style.color = '#fff'; link.style.borderBottom = '1px solid #ff0000'; }
            link.onclick = ((pg) => () => { renderPhotos(currentPhotogFilter, null, currentTargetMonth, pg); window.scrollTo(0, 0); })(p);
            pagination.appendChild(link);
        }
        const next = document.createElement('span'); next.className = 'pag-nav-btn'; next.textContent = 'NEXT →';
        if (currentPage < totalPages) next.onclick = () => { renderPhotos(currentPhotogFilter, null, currentTargetMonth, currentPage + 1); window.scrollTo(0, 0); };
        else next.classList.add('hidden-btn');
        pagination.appendChild(next);
        return pagination;
    }

    pageSessions.forEach(({ year, sessionKey, photos, availableMonths }, sessionIdx) => {
        const shouldShowHeader = !currentTargetMonth || sessionIdx === 0;
        if (shouldShowHeader && !renderedYears.has(year)) {
            renderedYears.add(year);
            const headerRow = document.createElement('div');
            headerRow.className = 'year-month-header'; headerRow.dataset.year = year;
            const yearEl = document.createElement('span'); yearEl.className = 'year-label'; yearEl.textContent = year;
            headerRow.appendChild(yearEl);
            const monthContainer = document.createElement('span'); monthContainer.className = 'month-links';
            const allLink = document.createElement('span'); allLink.className = `month-link ${!currentTargetMonth ? 'active' : ''}`; allLink.textContent = 'ALL';
            allLink.onclick = () => { renderPhotos(filterKey, null, null, 1); window.scrollTo(0, 0); };
            monthContainer.appendChild(allLink);
            availableMonths.forEach(m => {
                const link = document.createElement('span'); link.className = `month-link ${currentTargetMonth === m ? 'active' : ''}`; link.textContent = m;
                link.onclick = () => { renderPhotos(filterKey, null, m, 1); window.scrollTo(0, 0); };
                monthContainer.appendChild(link);
            });
            if (!currentEraKey) {
                const yearJumpRow = document.createElement('div'); yearJumpRow.className = 'year-jump-links';
                const activeYear = currentTargetYear || year;
                const activeYl = document.createElement('span'); activeYl.className = 'month-link active'; activeYl.textContent = activeYear;
                activeYl.onclick = () => renderPhotos(currentPhotogFilter, null, currentTargetMonth, 1, activeYear);
                yearJumpRow.appendChild(activeYl);
                const sep = document.createElement('span'); sep.textContent = '|'; sep.style.color = 'rgba(255,255,255,0.2)'; sep.style.cursor = 'default';
                yearJumpRow.appendChild(sep);
                sortedYears.filter(y => y !== activeYear).forEach(y => {
                    const yl = document.createElement('span'); yl.className = 'month-link'; yl.textContent = y;
                    yl.onclick = () => { const m2 = allYearMonths[y] || []; renderPhotos(currentPhotogFilter, null, (currentTargetMonth && m2.includes(currentTargetMonth)) ? currentTargetMonth : null, 1, y); window.scrollTo(0, 0); };
                    yearJumpRow.appendChild(yl);
                });
                headerRow.appendChild(yearJumpRow);
            }
            headerRow.appendChild(monthContainer);
            display.appendChild(headerRow);
            if (sessionIdx === 0) { const topPag = buildPagination(); if (topPag) display.appendChild(topPag); }
        }

        const eventGroups = {}, eventOrder = [];
        photos.forEach(p => {
            const raw = (p.event || p.desc || '').trim();
            const colonIdx = raw.indexOf(':');
            const eventName = (colonIdx !== -1 ? raw.slice(colonIdx + 1).trim() : raw).toUpperCase();
            if (!eventGroups[eventName]) { eventGroups[eventName] = []; eventOrder.push(eventName); }
            eventGroups[eventName].push(p);
        });

        const sessionBox = document.createElement('div');
        sessionBox.className = 'event-session-box';
        sessionBox.innerHTML = `
            <div class="session-layout">
                <div class="session-label">
                    <div class="session-date">${sessionKey}</div>
                    <div class="session-event-label">
                        <div class="session-events-heading">EVENT${eventOrder.length > 1 ? 'S' : ''}</div>
                        <div class="event-sub-titles"></div>
                    </div>
                </div>
                <div class="photo-wall"></div>
            </div>`;

        const subTitlesEl = sessionBox.querySelector('.event-sub-titles');
        const photoWall   = sessionBox.querySelector('.photo-wall');
        let activeEvent = eventOrder[0];

        function renderEventGrid(name) { photoWall.innerHTML = ''; photoWall.appendChild(buildSessionPhotoGrid(sessionKey + name, eventGroups[name], observer)); }

        eventOrder.forEach((name, idx) => {
            const span = document.createElement('span');
            span.className = 'session-event-name' + (idx === 0 ? ' active-event' : ''); span.textContent = name;
            span.onclick = () => {
                if (activeEvent === name) return; activeEvent = name;
                subTitlesEl.querySelectorAll('.session-event-name').forEach(s => s.classList.remove('active-event'));
                span.classList.add('active-event'); renderEventGrid(name);
            };
            subTitlesEl.appendChild(span);
        });
        renderEventGrid(activeEvent);
        display.appendChild(sessionBox);
    });

    const bottomPagination = buildPagination();
    if (bottomPagination) display.appendChild(bottomPagination);
    setTimeout(() => { fixYearMonthBar(); startYearMonthBarObserver(); }, 0);
}

function filterEras(category) {
    const menu = document.getElementById('era-menu');
    const subNav = document.getElementById('sub-era-nav');
    if (!menu) return;
    menu.innerHTML = ''; if (subNav) subNav.innerHTML = '';
    if (subNav) {
        const allLink = document.createElement('span'); allLink.className = 'nav-item'; allLink.innerText = "ALL";
        allLink.onclick = () => {
            currentEraKey = ""; currentPage = 1; currentTargetMonth = null;
            document.getElementById('lobby').style.display = 'none';
            document.getElementById('exhibition-room').style.display = 'block';
            const sb = document.getElementById('sidebar'); if (sb) sb.style.display = 'flex';
            renderPhotos('all');
        };
        subNav.appendChild(allLink);
    }
    Object.keys(window.gagaArchive).forEach(key => {
        const eraData = window.gagaArchive[key];
        if (category === 'all' || eraData.type === category) {
            const card = document.createElement('div'); card.className = 'era-card';
            card.innerHTML = `<span>${eraData.title}</span>`;
            card.onmouseenter = () => { if (eraData.albumArt) { card.style.backgroundImage = `url('${eraData.albumArt}')`; card.classList.add('hovered'); } };
            card.onmouseleave = () => { card.style.backgroundImage = "none"; card.classList.remove('hovered'); };
            card.onclick = () => openEra(key);
            menu.appendChild(card);
            const navLink = document.createElement('span'); navLink.className = 'nav-item'; navLink.innerText = eraData.title;
            navLink.onclick = () => openEra(key);
            if (subNav) subNav.appendChild(navLink);
        }
    });
    if (isOwner) renderOwnerUI();
    else if (isEditor) renderEditorUI();
}

function renderSidebar() {
    const nav = document.getElementById('photog-filters');
    if (!nav) return;
    nav.innerHTML = '';
    const knownKeys = new Set(Object.keys(window.gagaPhotogs || {}));
    const customNames = new Set();
    Object.keys(window.gagaArchive || {}).forEach(eraKey => {
        let photos = window.gagaArchive[eraKey]?.photos || [];
        if (!Array.isArray(photos)) photos = Object.values(photos);
        photos.forEach(p => { if (p && p.photogKey && p.photogKey !== 'NONE' && !knownKeys.has(p.photogKey)) customNames.add(p.photogKey); });
    });
    Object.keys(window.gagaPhotogs || {}).forEach(pKey => {
        const btn = document.createElement('button'); btn.innerText = window.gagaPhotogs[pKey].name.toUpperCase();
        btn.onclick = () => { currentEraKey = ""; renderPhotos(pKey); }; nav.appendChild(btn);
    });
    [...customNames].sort().forEach(name => {
        const btn = document.createElement('button'); btn.innerText = name.toUpperCase();
        btn.onclick = () => { currentEraKey = ""; renderPhotos(name); }; nav.appendChild(btn);
    });
}

function handlePhotogClick(event, photogKey) {
    if (!photogKey || photogKey === "NONE") return;
    event.stopPropagation(); currentEraKey = ""; currentPage = 1;
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('exhibition-room').style.display = 'block';
    const sidebar = document.getElementById('sidebar'); if (sidebar) sidebar.style.display = 'flex';
    renderPhotos(photogKey);
}

function updateSubNavHighlight(activeKey) {
    document.querySelectorAll('.nav-item').forEach(item => {
        const eraKey = Object.keys(window.gagaArchive).find(k => window.gagaArchive[k].title === item.innerText);
        item.classList.toggle('active-era', eraKey === activeKey || (item.innerText === "ALL" && activeKey === ""));
    });
}

let currentGroupPhotos = [], currentGroupIndex = 0;

function openLightbox(globalIndex) {
    currentIndex = globalIndex;
    const photo = currentFilteredPhotos[currentIndex];
    const subKey = getSubTitleKey(photo);
    currentGroupPhotos = currentFilteredPhotos.filter(p => getSubTitleKey(p) === subKey);
    currentGroupIndex = currentGroupPhotos.findIndex(p => p.url === photo.url);
    document.getElementById('lightbox').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    buildThumbnails();
    updateLightboxContent();
}

function updateLightboxContent() {
    const d = currentGroupPhotos[currentGroupIndex];
    document.getElementById('lightbox-img').src = d.url;
    const name = (d.photogKey === "NONE" || !d.photogKey) ? ""
        : (window.gagaPhotogs[d.photogKey] ? window.gagaPhotogs[d.photogKey].name.toUpperCase() : d.photogKey.toUpperCase());

    const editItem   = canEdit()   ? `<button class="lb-menu-item edit"   onclick="openEditModal('${d.url}'); closeLbMenu(); event.stopPropagation();">✎ EDIT</button>` : '';
    const deleteItem = canDelete() ? `<button class="lb-menu-item delete" onclick="deletePhoto('${d.url}'); closeLbMenu(); event.stopPropagation();">✕ DELETE</button>` : '';

    document.getElementById('lightbox-caption').innerHTML = `
        <div class="lb-info">
            <div class="lb-title">${name} ${d.year ? '(' + d.year + ')' : ''}</div>
            <div class="lb-desc">${d.event || d.desc || ""}</div>
        </div>
        <div class="lb-kebab-wrap">
            <button class="lb-kebab-btn" onclick="toggleLbMenu(event)">⋮</button>
            <div class="lb-menu" id="lb-menu">
                <button class="lb-menu-item download" onclick="downloadImage(); closeLbMenu(); event.stopPropagation();">↓ DOWNLOAD</button>
                ${editItem}${deleteItem}
            </div>
        </div>`;
    updateActiveThumbnail();
}

function buildThumbnails() {
    const container = document.getElementById('lightbox-thumbnails'); container.innerHTML = '';
    currentGroupPhotos.forEach((photo, i) => {
        const thumb = document.createElement('img'); thumb.src = photo.url; thumb.loading = "lazy"; thumb.className = 'thumb';
        thumb.onclick = (e) => { e.stopPropagation(); currentGroupIndex = i; updateLightboxContent(); };
        container.appendChild(thumb);
    });
}

function updateActiveThumbnail() {
    document.querySelectorAll('#lightbox-thumbnails img').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === currentGroupIndex);
        if (i === currentGroupIndex) thumb.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    });
}

async function downloadImage() {
    const url = document.getElementById('lightbox-img').src;
    try {
        const blob = await (await fetch(url)).blob();
        const blobURL = window.URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = blobURL; link.download = `HAUS_ARCHIVE_${Date.now()}.jpg`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        window.URL.revokeObjectURL(blobURL);
    } catch (err) { window.open(url, '_blank'); }
}

function changeImage(step) {
    if (currentGroupPhotos.length <= 1) return;
    currentGroupIndex = (currentGroupIndex + step + currentGroupPhotos.length) % currentGroupPhotos.length;
    updateLightboxContent();
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
    document.body.style.overflow = 'auto';
    closeLbMenu();
}

function toggleLbMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('lb-menu'); if (!menu) return;
    const isOpen = menu.classList.contains('open'); closeLbMenu();
    if (!isOpen) menu.classList.add('open');
}

function closeLbMenu() {
    const menu = document.getElementById('lb-menu'); if (menu) menu.classList.remove('open');
}

document.addEventListener('click', (e) => { if (!e.target.closest('.lb-kebab-wrap')) closeLbMenu(); });

document.addEventListener('keydown', (e) => {
    if (document.getElementById('lightbox').style.display === 'flex') {
        if (e.key === "ArrowLeft") changeImage(-1);
        if (e.key === "ArrowRight") changeImage(1);
        if (e.key === "Escape") closeLightbox();
    }
});

function fixYearMonthBar() {
    const header = document.querySelector('#exhibition-room .header');
    if (!header) return;
    const h = Math.round(header.getBoundingClientRect().height);
    document.querySelectorAll('.year-month-header').forEach(bar => { bar.style.top = h + 'px'; });
}

let _ymhObserver = null;
function startYearMonthBarObserver() {
    const header = document.querySelector('#exhibition-room .header');
    if (!header) return;
    if (_ymhObserver) _ymhObserver.disconnect();
    _ymhObserver = new ResizeObserver(() => fixYearMonthBar());
    _ymhObserver.observe(header);
}

function showContentWarning() {
    if (sessionStorage.getItem('haus_cw_accepted')) return;
    const overlay = document.createElement('div'); overlay.id = 'content-warning';
    overlay.innerHTML = `
        <div class="cw-box">
            <div class="cw-title">MY HAUS</div>
            <div class="cw-tags">
                <span class="cw-tag">POLITICAL CONTENT</span>
                <span class="cw-tag">MATURE THEMES</span>
                <span class="cw-tag">R-18</span>
            </div>
            <div class="cw-warning">
                This archive contains photography that may include<br>
                mature, provocative, or politically charged content.<br>
                By continuing, you confirm you are 18 or older<br>
                and are not easily offended.
            </div>
            <div class="cw-sub">If you are sensitive about this kind of content,<br>this site is not for you.</div>
            <button class="cw-btn" onclick="dismissWarning()">I UNDERSTAND — ENTER</button>
            <button class="cw-exit" onclick="window.history.back()">LEAVE</button>
        </div>`;
    document.body.appendChild(overlay);
}

function dismissWarning() {
    sessionStorage.setItem('haus_cw_accepted', 'true');
    const overlay = document.getElementById('content-warning');
    if (overlay) { overlay.style.opacity = '0'; overlay.style.transition = 'opacity 0.4s'; setTimeout(() => overlay.remove(), 400); }
}

document.addEventListener('DOMContentLoaded', () => {
    showContentWarning();
    init();
    const loginBtn = document.getElementById('header-login-btn');
    if (loginBtn) {
        if (isOwner || isEditor) loginBtn.classList.add('hidden');
    }
});
