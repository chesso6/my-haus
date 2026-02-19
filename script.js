let isOwner = localStorage.getItem('haus_owner_mode') === 'true';
let currentEraKey = "";
let currentPage = 1;
const SESSIONS_PER_PAGE = 10;
let currentFilteredPhotos = [];
let currentIndex = 0;
let currentPhotogFilter = 'all';
let currentTargetMonth = null;
let currentTargetYear = null;

const MONTH_ALIASES = {
    "JAN": "JANUARY",
    "FEB": "FEBRUARY",
    "MAR": "MARCH",
    "MARCH": "MARCH",
    "APR": "APRIL",
    "APRIL": "APRIL",
    "MAY": "MAY",
    "JUN": "JUNE",
    "JUNE": "JUNE",
    "JUL": "JULY",
    "JULY": "JULY",
    "AUG": "AUGUST",
    "SEP": "SEPTEMBER",
    "SEPT": "SEPTEMBER",
    "OCT": "OCTOBER",
    "NOV": "NOVEMBER",
    "DEC": "DECEMBER"
};

const MONTH_KEYS = Object.keys(MONTH_ALIASES).sort((a, b) => b.length - a.length);

const FULL_MONTHS = [
    "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
    "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"
];

const PHOTOS_PER_SESSION_PAGE = 10;
const OWNER_PASSWORD = "HAUS";

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

function init() {
    loadArchiveFromFirebase(() => {
        filterEras('all');
        renderSidebar();
        if (isOwner) renderOwnerUI();
        setupSearchKey();

        const savedEra = localStorage.getItem('haus_current_era');
        if (savedEra && window.gagaArchive[savedEra]) {
            openEra(savedEra);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'l' && !isOwner) showLogin();
    });
}

function showLogin() {
    const pass = prompt("PASSWORD:");
    if (!pass) return;
    if (pass.toUpperCase() === OWNER_PASSWORD) {
        isOwner = true;
        localStorage.setItem('haus_owner_mode', 'true');
        alert("ACCESS GRANTED.");
        location.reload();
    } else {
        alert("UNAUTHORIZED");
    }
}

function logout() {
    localStorage.removeItem('haus_owner_mode');
    isOwner = false;
    location.reload();
}

function renderOwnerUI() {
    const subNav = document.getElementById('sub-era-nav');
    if (subNav) {
        const existing = document.getElementById('owner-controls');
        if (existing) existing.remove();
        const controlPanel = document.createElement('span');
        controlPanel.id = 'owner-controls';
        controlPanel.style = `display:inline-flex; align-items:center; gap:15px; margin-left:20px; padding-left:15px; border-left:1px solid #333; vertical-align:middle;`;
        controlPanel.innerHTML = `
            <span onclick="openAddModal()" style="color:#00ff00; cursor:pointer; font-size:10px; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">[+] ADD</span>
            <span onclick="logout()" style="color:#ff4444; cursor:pointer; font-size:10px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; opacity:0.8;">LOGOUT</span>
        `;
        subNav.appendChild(controlPanel);
    }
}

function openAddModal() {
    const modal = document.createElement('div');
    modal.id = "owner-modal";
    modal.style = `position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#000; border:1px solid #333; padding:30px; z-index:9999; display:flex; flex-direction:column; gap:15px; width:350px; color:#fff; box-shadow: 0 0 30px rgba(0,0,0,1);`;

    const photogOptions = Object.keys(window.gagaPhotogs || {}).map(k =>
        `<option value="${window.gagaPhotogs[k].name}">${window.gagaPhotogs[k].name}</option>`
    ).join('');

    modal.innerHTML = `
        <h2 style="margin:0; font-size:10px; letter-spacing:4px; text-transform:uppercase;">ADD TO COLLECTION</h2>
        <input type="text" id="m-url" placeholder="IMAGE URL" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
        <input type="text" id="m-desc" placeholder="DESC (e.g. Promotional Session)" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
        <input type="text" id="m-event" placeholder="EVENT (e.g. FEB 14: SWIMSUIT STORE)" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
        <input type="number" id="m-year" placeholder="YEAR (2025)" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
        <label style="font-size:9px; opacity:0.6;">PHOTOGRAPHER (type a name or leave blank)</label>
        <input type="text" id="m-photog-input" placeholder="e.g. Inez and Vinoodh" list="m-photog-list" style="background:#111; border:1px solid #333; color:#fff; padding:10px; font-size:10px;">
        <datalist id="m-photog-list">
            ${photogOptions}
        </datalist>
        <label style="font-size:9px; opacity:0.6;">ERA CATEGORY</label>
        <select id="m-era" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
            ${Object.keys(window.gagaArchive || {}).map(k =>
                `<option value="${k}">${window.gagaArchive[k].title || k.toUpperCase()}</option>`
            ).join('')}
        </select>
        <button onclick="saveNewPhoto()" style="background:#fff; color:#000; border:none; padding:12px; cursor:pointer; font-weight:bold;">SAVE TO PHOTOGRAPHY</button>
        <button onclick="document.getElementById('owner-modal').remove()" style="background:transparent; color:#555; border:none; cursor:pointer; font-size:10px;">CANCEL</button>
    `;
    document.body.appendChild(modal);
}

function saveNewPhoto() {
    const url = document.getElementById('m-url').value.trim();
    const desc = document.getElementById('m-desc').value.trim();
    const event = document.getElementById('m-event').value.trim();
    const year = document.getElementById('m-year').value.trim();
    const photogRaw = document.getElementById('m-photog-input').value.trim();
    const eraKey = document.getElementById('m-era').value;

    if (!url || !year || !eraKey) return alert("URL, Year, and Era are required.");
    if (!url.startsWith('http')) return alert("Please enter a valid image URL starting with http.");

    const matchedKey = Object.keys(window.gagaPhotogs || {}).find(k =>
        window.gagaPhotogs[k].name.toLowerCase() === photogRaw.toLowerCase()
    );

    const photogKey = matchedKey || (photogRaw ? photogRaw : "NONE");

    const normalizedEraKey = eraKey.toLowerCase().replace(/\s+/g, '-');
    const newPhoto = { url, desc, event, year, photogKey };

    if (archiveRef) {
        const eraPhotosRef = database.ref(`gagaArchive/${normalizedEraKey}/photos`);
        eraPhotosRef.push(newPhoto)
            .then(() => {
                alert("Photo saved to shared archive!");
                document.getElementById('owner-modal').remove();
                location.reload();
            })
            .catch(err => {
                alert("Failed to save: " + err.message);
            });
    } else {
        alert("No connection to shared archive.");
    }
}

function openEditModal(photoUrl) {
    if (!archiveRef) return alert("No connection.");

    archiveRef.once('value').then(snapshot => {
        let foundEraKey = null;
        let foundPhotoKey = null;
        let foundPhoto = null;

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

        const currentPhotogName = foundPhoto.photogKey === 'NONE' || !foundPhoto.photogKey
            ? ''
            : (window.gagaPhotogs[foundPhoto.photogKey]
                ? window.gagaPhotogs[foundPhoto.photogKey].name
                : foundPhoto.photogKey);

        const eraOptions = Object.keys(window.gagaArchive || {}).map(k =>
            `<option value="${k}" ${foundEraKey === k ? 'selected' : ''}>${window.gagaArchive[k].title || k.toUpperCase()}</option>`
        ).join('');

        const modal = document.createElement('div');
        modal.id = "owner-modal";
        modal.style = `position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#000; border:1px solid #333; padding:30px; z-index:9999; display:flex; flex-direction:column; gap:15px; width:380px; color:#fff; box-shadow: 0 0 30px rgba(0,0,0,1); max-height:90vh; overflow-y:auto;`;

        modal.innerHTML = `
            <h2 style="margin:0; font-size:10px; letter-spacing:4px; text-transform:uppercase; color:#ffaa00;">[EDIT] PHOTO INFO</h2>
            <label style="font-size:9px; opacity:0.6;">IMAGE URL</label>
            <input type="text" id="e-url" value="${foundPhoto.url || ''}" style="background:#111; border:1px solid #333; color:#fff; padding:10px; font-size:10px;">
            <label style="font-size:9px; opacity:0.6;">DESC</label>
            <input type="text" id="e-desc" value="${foundPhoto.desc || ''}" placeholder="e.g. Promotional Session" style="background:#111; border:1px solid #333; color:#fff; padding:10px; font-size:10px;">
            <label style="font-size:9px; opacity:0.6;">EVENT</label>
            <input type="text" id="e-event" value="${foundPhoto.event || ''}" placeholder="e.g. FEB 14: SWIMSUIT STORE" style="background:#111; border:1px solid #333; color:#fff; padding:10px; font-size:10px;">
            <label style="font-size:9px; opacity:0.6;">YEAR</label>
            <input type="number" id="e-year" value="${foundPhoto.year || ''}" style="background:#111; border:1px solid #333; color:#fff; padding:10px; font-size:10px;">
            <label style="font-size:9px; opacity:0.6;">PHOTOGRAPHER (type a name or leave blank)</label>
            <input type="text" id="e-photog-input" value="${currentPhotogName}" placeholder="e.g. Inez and Vinoodh" list="e-photog-list" style="background:#111; border:1px solid #333; color:#fff; padding:10px; font-size:10px;">
            <datalist id="e-photog-list">
                ${photogOptions}
            </datalist>
            <label style="font-size:9px; opacity:0.6;">ERA CATEGORY</label>
            <select id="e-era" style="background:#111; border:1px solid #333; color:#fff; padding:10px; font-size:10px;">
                ${eraOptions}
            </select>
            <button onclick="saveEditedPhoto('${foundEraKey}', '${foundPhotoKey}', '${photoUrl}')" style="background:#ffaa00; color:#000; border:none; padding:12px; cursor:pointer; font-weight:bold; letter-spacing:2px; font-size:10px;">SAVE CHANGES</button>
            <button onclick="document.getElementById('owner-modal').remove()" style="background:transparent; color:#555; border:none; cursor:pointer; font-size:10px; letter-spacing:1px;">CANCEL</button>
        `;
        document.body.appendChild(modal);
    });
}

function saveEditedPhoto(originalEraKey, photoKey, originalUrl) {
    const url = document.getElementById('e-url').value.trim();
    const desc = document.getElementById('e-desc').value.trim();
    const event = document.getElementById('e-event').value.trim();
    const year = document.getElementById('e-year').value.trim();
    const photogRaw = document.getElementById('e-photog-input').value.trim();
    const newEraKey = document.getElementById('e-era').value;

    if (!url || !year) return alert("URL and Year are required.");

    const matchedKey = Object.keys(window.gagaPhotogs || {}).find(k =>
        window.gagaPhotogs[k].name.toLowerCase() === photogRaw.toLowerCase()
    );
    const photogKey = matchedKey || (photogRaw ? photogRaw : "NONE");

    const updatedPhoto = { url, desc, event, year, photogKey };
    const eraChanged = newEraKey !== originalEraKey;

    if (eraChanged) {
        const deleteRef = database.ref(`gagaArchive/${originalEraKey}/photos/${photoKey}`);
        const newEraPhotosRef = database.ref(`gagaArchive/${newEraKey}/photos`);
        deleteRef.remove()
            .then(() => newEraPhotosRef.push(updatedPhoto))
            .then(() => {
                alert("Photo moved and updated!");
                document.getElementById('owner-modal').remove();
                closeLightbox();
                location.reload();
            })
            .catch(err => alert("Update failed: " + err.message));
    } else {
        database.ref(`gagaArchive/${originalEraKey}/photos/${photoKey}`)
            .set(updatedPhoto)
            .then(() => {
                alert("Photo updated!");
                document.getElementById('owner-modal').remove();
                closeLightbox();
                location.reload();
            })
            .catch(err => alert("Update failed: " + err.message));
    }
}

function deletePhoto(photoUrl) {
    if (!confirm("DELETE THIS PHOTO PERMANENTLY?")) return;
    if (!archiveRef) return alert("No connection.");

    archiveRef.once('value').then(snapshot => {
        const updates = {};
        snapshot.forEach(eraSnap => {
            const eraKey = eraSnap.key;
            const photos = eraSnap.child('photos').val() || {};
            Object.keys(photos).forEach(photoKey => {
                if (photos[photoKey].url === photoUrl) {
                    updates[`${eraKey}/photos/${photoKey}`] = null;
                }
            });
        });

        if (Object.keys(updates).length > 0) {
            archiveRef.update(updates)
                .then(() => {
                    alert("Photo deleted from shared archive.");
                    closeLightbox();
                    location.reload();
                })
                .catch(err => alert("Delete failed: " + err.message));
        } else {
            alert("Photo not found in shared archive.");
        }
    });
}

function filterPhotographers() {
    const input = document.getElementById('photogSearch');
    if (!input) return;
    const filter = input.value.toUpperCase();
    const photogContainer = document.getElementById('photog-filters');
    const buttons = photogContainer.getElementsByTagName('button');
    for (let i = 0; i < buttons.length; i++) {
        const txtValue = buttons[i].textContent || buttons[i].innerText;
        buttons[i].style.display = (txtValue.toUpperCase().indexOf(filter) > -1) ? "" : "none";
    }
}

function setupSearchKey() {
    const searchBar = document.getElementById('photogSearch');
    if (searchBar) {
        searchBar.replaceWith(searchBar.cloneNode(true));
        const newSearchBar = document.getElementById('photogSearch');
        newSearchBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = newSearchBar.value.trim();
                if (value === '') {
                    currentPhotogFilter = 'all';
                    renderPhotos('all');
                    newSearchBar.value = '';
                    filterPhotographers();
                    return;
                }
                const buttons = Array.from(document.querySelectorAll('#photog-filters button'));
                const firstMatch = buttons.find(btn => btn.style.display !== 'none');
                if (firstMatch) {
                    firstMatch.click();
                    newSearchBar.value = "";
                    filterPhotographers();
                }
            }
        });
    }
}

let dragSrc = null;

function makeDraggable(grid, photosRef) {
    function getItems() {
        return Array.from(grid.querySelectorAll('.photo-item:not(.photo-item-empty)'));
    }

    grid.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.photo-item');
        if (!item || item.classList.contains('photo-item-empty')) return;
        dragSrc = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
    });

    grid.addEventListener('dragend', (e) => {
        const item = e.target.closest('.photo-item');
        if (item) item.classList.remove('dragging');
        grid.querySelectorAll('.photo-item').forEach(i => i.classList.remove('drag-over'));
        dragSrc = null;
    });

    grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
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
        const srcIdx = items.indexOf(dragSrc);
        const tgtIdx = items.indexOf(target);
        if (srcIdx === -1 || tgtIdx === -1) return;

        if (srcIdx < tgtIdx) {
            grid.insertBefore(dragSrc, target.nextSibling);
        } else {
            grid.insertBefore(dragSrc, target);
        }

        [photosRef[srcIdx], photosRef[tgtIdx]] = [photosRef[tgtIdx], photosRef[srcIdx]];

        showDragSaveBar(grid, photosRef);
    });
}

function showDragSaveBar(grid, photosRef) {
    const wrapper = grid.closest('.session-photos-wrapper');
    if (!wrapper) return;
    let bar = wrapper.querySelector('.drag-save-bar');
    if (bar) {
        bar.querySelectorAll('button')[0].onclick = () => saveDragOrder(bar.querySelectorAll('button')[0], photosRef.map(p => p.url));
        return;
    }

    bar = document.createElement('div');
    bar.className = 'drag-save-bar';
    bar.innerHTML = `
        <span>UNSAVED ORDER CHANGES</span>
        <button>SAVE ORDER</button>
        <button style="background:transparent; color:#888; border:1px solid #333;" onclick="location.reload()">CANCEL</button>
    `;
    bar.querySelectorAll('button')[0].onclick = () => saveDragOrder(bar.querySelectorAll('button')[0], photosRef.map(p => p.url));
    wrapper.appendChild(bar);
}

function saveDragOrder(btn, orderedUrls) {
    if (!archiveRef) return alert("No connection.");
    btn.textContent = 'SAVING...';
    btn.disabled = true;

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
            const existingKeys = Object.keys(existingEntries);

            const orderedForEra = orderedUrls
                .map(url => Object.values(existingEntries).find(p => p.url === url))
                .filter(Boolean);

            const deletePromises = existingKeys.map(k =>
                database.ref(`gagaArchive/${eraKey}/photos/${k}`).remove()
            );

            promises.push(
                Promise.all(deletePromises).then(() => {
                    return orderedForEra.reduce((chain, photo) => {
                        return chain.then(() =>
                            database.ref(`gagaArchive/${eraKey}/photos`).push(photo)
                        );
                    }, Promise.resolve());
                })
            );
        });

        Promise.all(promises)
            .then(() => {
                const bar = btn.closest('.drag-save-bar');
                if (bar) {
                    bar.innerHTML = `<span style="color:#00ff88;">✓ ORDER SAVED</span>`;
                    setTimeout(() => location.reload(), 800);
                }
            })
            .catch(err => {
                alert("Save failed: " + err.message);
                btn.textContent = 'SAVE ORDER';
                btn.disabled = false;
            });
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
        for (let i = 0; i < remaining; i++) {
            const empty = document.createElement('div');
            empty.className = 'photo-item photo-item-empty';
            grid.appendChild(empty);
        }
        if (isOwner) makeDraggable(grid, pagePhotosRef);
        wrapper.appendChild(grid);
        return wrapper;
    }

    const totalSessionPages = Math.ceil(totalPhotos / PHOTOS_PER_SESSION_PAGE);
    if (!sessionPhotoPages[sessionKey]) sessionPhotoPages[sessionKey] = 1;

    function renderPage() {
        wrapper.innerHTML = '';
        const pg = sessionPhotoPages[sessionKey];
        const start = (pg - 1) * PHOTOS_PER_SESSION_PAGE;
        const end = Math.min(start + PHOTOS_PER_SESSION_PAGE, totalPhotos);
        const pagePhotos = photos.slice(start, end);
        const pagePhotosRef = pagePhotos.slice();

        const grid = document.createElement('div');
        grid.className = 'photo-wall-inner';
        pagePhotosRef.forEach(photo => grid.appendChild(createPhotoItem(photo, observer)));

        const remaining = PHOTOS_PER_SESSION_PAGE - pagePhotos.length;
        for (let i = 0; i < remaining; i++) {
            const empty = document.createElement('div');
            empty.className = 'photo-item photo-item-empty';
            grid.appendChild(empty);
        }

        if (isOwner) makeDraggable(grid, pagePhotosRef);
        wrapper.appendChild(grid);

        const pager = document.createElement('div');
        pager.className = 'session-pagination';

        if (pg > 1) {
            const prev = document.createElement('span');
            prev.textContent = '← PREV';
            prev.onclick = () => { sessionPhotoPages[sessionKey] = pg - 1; renderPage(); };
            pager.appendChild(prev);
        }

        for (let p = 1; p <= totalSessionPages; p++) {
            const link = document.createElement('span');
            link.textContent = p;
            if (p === pg) {
                link.style.fontWeight = 'bold';
                link.style.textDecoration = 'underline';
                link.style.color = '#fff';
            }
            link.onclick = ((page) => () => { sessionPhotoPages[sessionKey] = page; renderPage(); })(p);
            pager.appendChild(link);
        }

        if (pg < totalSessionPages) {
            const next = document.createElement('span');
            next.textContent = 'NEXT →';
            next.onclick = () => { sessionPhotoPages[sessionKey] = pg + 1; renderPage(); };
            pager.appendChild(next);
        }

        wrapper.appendChild(pager);
    }

    renderPage();
    return wrapper;
}

function createPhotoItem(photo, observer) {
    const photoDiv = document.createElement('div');
    photoDiv.className = 'photo-item';
    if (isOwner) photoDiv.draggable = true;

    const photogDisplay = (photo.photogKey === "NONE" || !photo.photogKey)
        ? ""
        : (window.gagaPhotogs[photo.photogKey]
            ? window.gagaPhotogs[photo.photogKey].name.toUpperCase()
            : photo.photogKey.toUpperCase());

    const descLabel = photo.desc ? photo.desc.toUpperCase() : '';

    const editOverlay = isOwner
        ? `<div class="owner-edit-overlay" onclick="event.stopPropagation(); openEditModal('${photo.url}')">✎ EDIT</div>`
        : '';

    const dragHandle = isOwner
        ? `<div class="drag-handle">⠿</div>`
        : '';

    photoDiv.innerHTML = `
        ${editOverlay}
        ${dragHandle}
        <img data-src="${photo.url}" loading="lazy"
             onclick="openLightbox(${photo.globalIndex})"
             style="opacity:0; transition: opacity 0.3s;">
        <div class="photo-info">
            <span class="info-photog" onclick="handlePhotogClick(event, '${photo.photogKey}')">
                ${photogDisplay}
            </span>
            ${descLabel ? `<div class="info-event">${descLabel}</div>` : ''}
        </div>`;

    const img = photoDiv.querySelector('img');
    img.onload = () => img.style.opacity = '1';
    img.addEventListener('mousedown', (e) => e.stopPropagation());
    observer.observe(img);
    return photoDiv;
}

function renderPhotos(filterKey = currentPhotogFilter, btn = null, targetMonth = null, page = 1, targetYear = currentTargetYear) {
    currentPhotogFilter = filterKey;
    currentPage = page;
    currentTargetMonth = targetMonth;
    currentTargetYear = targetYear;

    const display = document.getElementById('photo-display');
    const titleEl = document.getElementById('active-title');
    if (!display) return;
    display.innerHTML = '';

    let rawPhotos = [];

    if (currentEraKey) {
        rawPhotos = window.gagaArchive[currentEraKey]?.photos || [];
        if (currentPhotogFilter !== 'all') {
            rawPhotos = rawPhotos.filter(p => p.photogKey === currentPhotogFilter);
        }
        const eraTitle = window.gagaArchive[currentEraKey]?.title || "UNKNOWN";
        const photogName = window.gagaPhotogs[filterKey]?.name || (filterKey !== 'all' ? filterKey : null);
        titleEl.innerText = (currentPhotogFilter === 'all' || !photogName)
            ? eraTitle
            : `${eraTitle} — ${photogName.toUpperCase()}`;
    } else {
        Object.keys(window.gagaArchive || {}).forEach(eraKey => {
            let photos = window.gagaArchive[eraKey]?.photos || [];
            if (!Array.isArray(photos)) photos = Object.values(photos);
            if (currentPhotogFilter !== 'all') photos = photos.filter(p => p.photogKey === currentPhotogFilter);
            rawPhotos = [...rawPhotos, ...photos];
        });
        titleEl.innerText = (filterKey === 'all')
            ? "FULL GALLERY"
            : `ALL WORK BY ${(window.gagaPhotogs[filterKey]?.name || filterKey).toUpperCase()}`;
    }

    if (rawPhotos.length === 0) {
        display.innerHTML = `<div class="no-results">NO PHOTOS FOUND.</div>`;
        return;
    }

    currentFilteredPhotos = rawPhotos;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            }
        });
    }, { rootMargin: '400px' });

    const yearGroups = {};
    rawPhotos.forEach((photo, index) => {
        const year = photo.year;
        if (!year) return;
        if (!yearGroups[year]) yearGroups[year] = [];
        yearGroups[year].push({ ...photo, globalIndex: index });
    });

    const sortedYears = Object.keys(yearGroups).sort((a, b) => a - b);
    const allSessions = [];

    const allYearMonths = {};
    sortedYears.forEach(y => {
        const months = new Set();
        yearGroups[y].forEach(p => {
            const m = detectMonth(p.event || p.desc || '');
            if (m) months.add(m);
        });
        allYearMonths[y] = Array.from(months).sort((a, b) => FULL_MONTHS.indexOf(a) - FULL_MONTHS.indexOf(b));
    });

    const yearsToRender = (targetYear && !currentEraKey) ? [targetYear] : sortedYears;

    yearsToRender.forEach(year => {
        if (!yearGroups[year] || yearGroups[year].length === 0) return;

        const availableMonths = allYearMonths[year];

        const filteredPhotos = targetMonth
            ? yearGroups[year].filter(p => detectMonth(p.event || p.desc || '') === targetMonth)
            : yearGroups[year];

        if (filteredPhotos.length === 0) return;

        const sessionGroups = {};
        filteredPhotos.forEach(photo => {
            const sessionKey = getSessionKey(photo);
            if (!sessionGroups[sessionKey]) sessionGroups[sessionKey] = [];
            sessionGroups[sessionKey].push(photo);
        });

        const sortedSessionKeys = Object.keys(sessionGroups).sort((a, b) => {
            const getMonthIdx = key => {
                for (const mk of MONTH_KEYS) {
                    if (key.startsWith(mk)) return FULL_MONTHS.indexOf(MONTH_ALIASES[mk]);
                }
                return 999;
            };
            const aMonth = getMonthIdx(a);
            const bMonth = getMonthIdx(b);
            if (aMonth !== bMonth) return aMonth - bMonth;
            const aDay = parseInt(a.match(/\d+/)?.[0] || 0);
            const bDay = parseInt(b.match(/\d+/)?.[0] || 0);
            return aDay - bDay;
        });

        sortedSessionKeys.forEach((sessionKey, i) => {
            allSessions.push({
                year,
                sessionKey,
                photos: sessionGroups[sessionKey],
                isFirstOfYear: i === 0,
                availableMonths: availableMonths
            });
        });
    });

    if (allSessions.length === 0) {
        display.innerHTML = `<div class="no-results">NO PHOTOS FOUND.</div>`;
        return;
    }

    const totalSessions = allSessions.length;
    const totalPages = Math.ceil(totalSessions / SESSIONS_PER_PAGE);
    const startIdx = (currentPage - 1) * SESSIONS_PER_PAGE;
    const endIdx = Math.min(startIdx + SESSIONS_PER_PAGE, totalSessions);
    const pageSessions = allSessions.slice(startIdx, endIdx);

    const renderedYears = new Set();

    function buildPagination() {
        if (totalPages <= 1) return null;
        const pagination = document.createElement('div');
        pagination.className = 'pagination';

        if (currentPage > 1) {
            const prev = document.createElement('span');
            prev.textContent = '← PREV';
            prev.onclick = () => { renderPhotos(currentPhotogFilter, null, currentTargetMonth, currentPage - 1); window.scrollTo(0, 0); };
            pagination.appendChild(prev);
        }

        for (let p = 1; p <= totalPages; p++) {
            const pageLink = document.createElement('span');
            pageLink.textContent = p;
            if (p === currentPage) {
                pageLink.style.fontWeight = 'bold';
                pageLink.style.color = '#fff';
                pageLink.style.borderBottom = '1px solid #ff0000';
            }
            pageLink.onclick = ((pg) => () => { renderPhotos(currentPhotogFilter, null, currentTargetMonth, pg); window.scrollTo(0, 0); })(p);
            pagination.appendChild(pageLink);
        }

        if (currentPage < totalPages) {
            const next = document.createElement('span');
            next.textContent = 'NEXT →';
            next.onclick = () => { renderPhotos(currentPhotogFilter, null, currentTargetMonth, currentPage + 1); window.scrollTo(0, 0); };
            pagination.appendChild(next);
        }

        return pagination;
    }

    pageSessions.forEach(({ year, sessionKey, photos, availableMonths }, sessionIdx) => {

        const shouldShowHeader = !currentTargetMonth || sessionIdx === 0;

        if (shouldShowHeader && !renderedYears.has(year)) {
            renderedYears.add(year);

            const headerRow = document.createElement('div');
            headerRow.className = 'year-month-header';
            headerRow.dataset.year = year;

            const yearEl = document.createElement('span');
            yearEl.className = 'year-label';
            yearEl.textContent = year;
            headerRow.appendChild(yearEl);

            const monthContainer = document.createElement('span');
            monthContainer.className = 'month-links';

            const allLink = document.createElement('span');
            allLink.className = `month-link ${!currentTargetMonth ? 'active' : ''}`;
            allLink.textContent = 'ALL';
            allLink.onclick = () => { renderPhotos(filterKey, null, null, 1); window.scrollTo(0, 0); };
            monthContainer.appendChild(allLink);

            availableMonths.forEach(m => {
                const link = document.createElement('span');
                link.className = `month-link ${currentTargetMonth === m ? 'active' : ''}`;
                link.textContent = m;
                link.onclick = () => { renderPhotos(filterKey, null, m, 1); window.scrollTo(0, 0); };
                monthContainer.appendChild(link);
            });

            if (!currentEraKey) {
                const yearJumpRow = document.createElement('div');
                yearJumpRow.className = 'year-jump-links';

                const activeYear = currentTargetYear || year;

                const activeYl = document.createElement('span');
                activeYl.className = 'month-link active';
                activeYl.textContent = activeYear;
                activeYl.onclick = () => renderPhotos(currentPhotogFilter, null, currentTargetMonth, 1, activeYear);
                yearJumpRow.appendChild(activeYl);

                const sep = document.createElement('span');
                sep.textContent = '|';
                sep.style.color = 'rgba(255,255,255,0.2)';
                sep.style.cursor = 'default';
                yearJumpRow.appendChild(sep);

                sortedYears.filter(y => y !== activeYear).forEach(y => {
                    const yl = document.createElement('span');
                    yl.className = 'month-link';
                    yl.textContent = y;
                    yl.onclick = () => {
                        const targetYearMonths = allYearMonths[y] || [];
                        const monthToUse = (currentTargetMonth && targetYearMonths.includes(currentTargetMonth))
                            ? currentTargetMonth
                            : null;
                        renderPhotos(currentPhotogFilter, null, monthToUse, 1, y);
                        window.scrollTo(0, 0);
                    };
                    yearJumpRow.appendChild(yl);
                });

                headerRow.appendChild(yearJumpRow);
            }

            headerRow.appendChild(monthContainer);
            display.appendChild(headerRow);

            if (sessionIdx === 0) {
                const topPag = buildPagination();
                if (topPag) display.appendChild(topPag);
            }
        }

        const uniqueEvents = [...new Set(
            photos
                .filter(p => p.event)
                .map(p => {
                    const parts = p.event.split(':');
                    return parts.length > 1 ? parts.slice(1).join(':').trim().toUpperCase() : p.event.toUpperCase();
                })
        )];

        const sessionBox = document.createElement('div');
        sessionBox.className = 'event-session-box';

        sessionBox.innerHTML = `
            <div class="session-layout">
                <div class="session-label">
                    <div class="session-date">${sessionKey}</div>
                    <div class="event-sub-titles"></div>
                </div>
                <div class="photo-wall"></div>
            </div>
        `;

        const subTitlesEl = sessionBox.querySelector('.event-sub-titles');
        const photoWall = sessionBox.querySelector('.photo-wall');

        let activeEvent = null;

        function renderSessionGrid(eventFilter) {
            const filtered = eventFilter
                ? photos.filter(p => {
                    if (!p.event) return false;
                    const parts = p.event.split(':');
                    const label = parts.length > 1 ? parts.slice(1).join(':').trim().toUpperCase() : p.event.toUpperCase();
                    return label === eventFilter;
                })
                : photos;
            photoWall.innerHTML = '';
            photoWall.appendChild(buildSessionPhotoGrid(sessionKey + (eventFilter || ''), filtered, observer));
        }

        uniqueEvents.forEach(e => {
            const span = document.createElement('span');
            span.className = 'event-sub-title event-sub-title-link';
            span.textContent = e;
            span.dataset.event = e;
            span.onclick = () => {
                if (activeEvent === e) {
                    activeEvent = null;
                    subTitlesEl.querySelectorAll('.event-sub-title').forEach(s => s.classList.remove('active-event'));
                    renderSessionGrid(null);
                } else {
                    activeEvent = e;
                    subTitlesEl.querySelectorAll('.event-sub-title').forEach(s => s.classList.remove('active-event'));
                    span.classList.add('active-event');
                    renderSessionGrid(e);
                }
            };
            subTitlesEl.appendChild(span);
        });

        renderSessionGrid(null);

        display.appendChild(sessionBox);
    });

    const bottomPagination = buildPagination();
    if (bottomPagination) display.appendChild(bottomPagination);

    setTimeout(fixYearMonthBar, 0);
}

function filterEras(category) {
    const menu = document.getElementById('era-menu');
    const subNav = document.getElementById('sub-era-nav');
    if (!menu) return;
    menu.innerHTML = '';
    if (subNav) subNav.innerHTML = '';

    if (subNav) {
        const allLink = document.createElement('span');
        allLink.className = 'nav-item';
        allLink.innerText = "ALL";
        allLink.onclick = () => {
            currentEraKey = "";
            currentPage = 1;
            currentTargetMonth = null;
            document.getElementById('lobby').style.display = 'none';
            document.getElementById('exhibition-room').style.display = 'block';
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.style.display = 'flex';
            renderPhotos('all');
        };
        subNav.appendChild(allLink);
    }

    Object.keys(window.gagaArchive).forEach(key => {
        const eraData = window.gagaArchive[key];
        if (category === 'all' || eraData.type === category) {
            const card = document.createElement('div');
            card.className = 'era-card';
            card.innerHTML = `<span>${eraData.title}</span>`;
            card.onmouseenter = () => {
                if (eraData.albumArt) {
                    card.style.backgroundImage = `url('${eraData.albumArt}')`;
                    card.classList.add('hovered');
                }
            };
            card.onmouseleave = () => { card.style.backgroundImage = "none"; card.classList.remove('hovered'); };
            card.onclick = () => openEra(key);
            menu.appendChild(card);

            const navLink = document.createElement('span');
            navLink.className = 'nav-item';
            navLink.innerText = eraData.title;
            navLink.onclick = () => openEra(key);
            if (subNav) subNav.appendChild(navLink);
        }
    });
    if (isOwner) renderOwnerUI();
}

function openEra(key) {
    currentEraKey = key;
    currentPage = 1;
    currentTargetMonth = null;
    localStorage.setItem('haus_current_era', key);
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('exhibition-room').style.display = 'block';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) { sidebar.style.display = 'flex'; }
    renderPhotos();
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
        photos.forEach(p => {
            if (p && p.photogKey && p.photogKey !== 'NONE' && !knownKeys.has(p.photogKey)) {
                customNames.add(p.photogKey);
            }
        });
    });

    Object.keys(window.gagaPhotogs || {}).forEach(pKey => {
        const btn = document.createElement('button');
        btn.innerText = window.gagaPhotogs[pKey].name.toUpperCase();
        btn.onclick = () => { currentEraKey = ""; renderPhotos(pKey); };
        nav.appendChild(btn);
    });

    [...customNames].sort().forEach(name => {
        const btn = document.createElement('button');
        btn.innerText = name.toUpperCase();
        btn.onclick = () => { currentEraKey = ""; renderPhotos(name); };
        nav.appendChild(btn);
    });
}

function handlePhotogClick(event, photogKey) {
    if (!photogKey || photogKey === "NONE") return;
    event.stopPropagation();
    currentEraKey = "";
    currentPage = 1;
    renderPhotos(photogKey);
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('exhibition-room').style.display = 'block';
    updateSubNavHighlight("");
}

function showLobby() {
    localStorage.removeItem('haus_current_era');
    document.getElementById('lobby').style.display = 'block';
    document.getElementById('exhibition-room').style.display = 'none';
    const sidebar = document.getElementById('sidebar');
    if (sidebar) { sidebar.style.display = 'none'; }
}

function updateSubNavHighlight(activeKey) {
    document.querySelectorAll('.nav-item').forEach(item => {
        const eraKey = Object.keys(window.gagaArchive).find(k => window.gagaArchive[k].title === item.innerText);
        item.classList.toggle('active-era', eraKey === activeKey || (item.innerText === "ALL" && activeKey === ""));
    });
}

function openLightbox(i) {
    currentIndex = i;
    updateLightbox();
    document.getElementById('lightbox').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function updateLightbox() {
    const d = currentFilteredPhotos[currentIndex];
    const name = (d.photogKey === "NONE" || !d.photogKey)
        ? ""
        : (window.gagaPhotogs[d.photogKey]
            ? window.gagaPhotogs[d.photogKey].name.toUpperCase()
            : d.photogKey.toUpperCase());

    document.getElementById('lightbox-img').src = d.url;

    const ownerBtns = isOwner ? `
        <button onclick="openEditModal('${d.url}')" style="background:#ffaa00; color:#000; border:none; padding:8px 15px; cursor:pointer; font-size:9px; font-weight:bold; text-transform:uppercase; margin-top:10px; letter-spacing:1px;">✎ EDIT</button>
        <button onclick="deletePhoto('${d.url}')" style="background:#ff4444; color:white; border:none; padding:8px 15px; cursor:pointer; font-size:9px; font-weight:bold; text-transform:uppercase; margin-top:10px;">DELETE</button>
    ` : '';

    document.getElementById('lightbox-caption').innerHTML = `
    <div style="flex:1; min-width:0;">
        <div class="lb-title">${name} ${d.year ? '(' + d.year + ')' : ''}</div>
        <div class="lb-desc">${d.event || d.desc || ""}</div>
    </div>
    <div style="display:flex; gap:8px; flex-shrink:0; align-items:center;">
        ${ownerBtns}
    </div>
`;
}

async function downloadImage() {
    const imgElement = document.getElementById('lightbox-img');
    const url = imgElement.src;
    const fileName = `HAUS_ARCHIVE_${Date.now()}.jpg`;
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobURL = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobURL;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobURL);
    } catch (err) {
        window.open(url, '_blank');
    }
}

function changeImage(step) {
    currentIndex = (currentIndex + step + currentFilteredPhotos.length) % currentFilteredPhotos.length;
    updateLightbox();
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
    document.body.style.overflow = 'auto';
}

document.addEventListener('keydown', (e) => {
    if (document.getElementById('lightbox').style.display === 'flex') {
        if (e.key === "ArrowLeft") changeImage(-1);
        if (e.key === "ArrowRight") changeImage(1);
        if (e.key === "Escape") closeLightbox();
    }
});

function fixYearMonthBar() {
    const header = document.querySelector('.header');
    if (!header) return;
    const headerHeight = header.getBoundingClientRect().height;
    document.querySelectorAll('.year-month-header').forEach(bar => {
        bar.style.top = headerHeight + 'px';
    });
}

document.addEventListener('DOMContentLoaded', init);
