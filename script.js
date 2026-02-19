let isOwner = localStorage.getItem('haus_owner_mode') === 'true';
let currentEraKey = "";
let currentPage = 1;
const SESSIONS_PER_PAGE = 10;
let currentFilteredPhotos = [];
let currentIndex = 0;
let currentPhotogFilter = 'all';
let currentTargetMonth = null;

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
    console.log("Firebase initialized");
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
    if (!archiveRef) {
        callback();
        return;
    }
    archiveRef.once('value')
        .then((snapshot) => {
            const firebaseData = snapshot.val() || {};
            Object.keys(firebaseData).forEach(eraKey => {
                const nk = eraKey.toLowerCase().replace(/\s+/g, '-');
                if (!window.gagaArchive[nk]) window.gagaArchive[nk] = { title: eraKey.toUpperCase(), photos: [] };
                const raw = firebaseData[eraKey]?.photos || {};
                const fbPhotos = Array.isArray(raw) ? raw : Object.values(raw);
                const localPhotos = window.gagaArchive[nk].photos || [];
                fbPhotos.forEach(p => {
                    if (p && p.url && !localPhotos.some(lp => lp.url === p.url)) {
                        localPhotos.push(p);
                    }
                });
                window.gagaArchive[nk].photos = localPhotos;
            });
            callback();
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
    const email = prompt("EMAIL:");
    if (!email) return;
    const pass = prompt("PASSWORD:");
    firebase.auth().signInWithEmailAndPassword(email, pass)
        .then(() => {
            isOwner = true;
            localStorage.setItem('haus_owner_mode', 'true');
            alert("ACCESS GRANTED.");
            location.reload();
        })
        .catch(() => alert("UNAUTHORIZED"));
}

function logout() {
    firebase.auth().signOut().catch(() => {});
    localStorage.removeItem('haus_owner_mode');
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
        `<option value="${k}">${window.gagaPhotogs[k].name}</option>`
    ).join('');

    modal.innerHTML = `
        <h2 style="margin:0; font-size:10px; letter-spacing:4px; text-transform:uppercase;">ADD TO COLLECTION</h2>
        <input type="text" id="m-url" placeholder="IMAGE URL" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
        <input type="text" id="m-desc" placeholder="DESC (e.g. Promotional Session)" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
        <input type="text" id="m-event" placeholder="EVENT (e.g. FEB 14: SWIMSUIT STORE)" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
        <input type="number" id="m-year" placeholder="YEAR (2025)" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
        <label style="font-size:9px; opacity:0.6;">PHOTOGRAPHER</label>
        <select id="m-photog" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
            <option value="NONE">NONE (NO NAME)</option>
            ${photogOptions}
        </select>
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
    const photogKey = document.getElementById('m-photog').value;
    const eraKey = document.getElementById('m-era').value;

    if (!url || !year || !eraKey) return alert("URL, Year, and Era are required.");
    if (!url.startsWith('http')) return alert("Please enter a valid image URL starting with http.");

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
                console.error("Save failed:", err);
                alert("Failed to save: " + err.message);
            });
    } else {
        alert("No connection to shared archive.");
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

function buildSessionPhotoGrid(sessionKey, photos, observer) {
    const wrapper = document.createElement('div');
    wrapper.className = 'session-photos-wrapper';

    const totalPhotos = photos.length;

    if (totalPhotos <= PHOTOS_PER_SESSION_PAGE) {
    const grid = document.createElement('div');
    grid.className = 'photo-wall-inner';
    photos.forEach(photo => {
        grid.appendChild(createPhotoItem(photo, observer));
    });
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

        const grid = document.createElement('div');
        grid.className = 'photo-wall-inner';
        pagePhotos.forEach(photo => {
            grid.appendChild(createPhotoItem(photo, observer));
        });
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
                link.style.color = '#000';
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

    const photogDisplay = (photo.photogKey === "NONE" || !window.gagaPhotogs[photo.photogKey])
        ? ""
        : window.gagaPhotogs[photo.photogKey].name.toUpperCase();

    const descLabel = photo.desc ? photo.desc.toUpperCase() : '';

    photoDiv.innerHTML = `
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
    observer.observe(img);
    return photoDiv;
}

function renderPhotos(filterKey = currentPhotogFilter, btn = null, targetMonth = null, page = 1) {
    currentPhotogFilter = filterKey;
    currentPage = page;
    currentTargetMonth = targetMonth;

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
        const photogName = window.gagaPhotogs[filterKey]?.name;
        titleEl.innerText = (currentPhotogFilter === 'all' || !photogName)
            ? eraTitle
            : `${eraTitle} — ${photogName.toUpperCase()}`;
    } else {
        // Full archive — collect from ALL eras
        Object.keys(window.gagaArchive || {}).forEach(eraKey => {
            let photos = window.gagaArchive[eraKey]?.photos || [];
            if (!Array.isArray(photos)) photos = Object.values(photos);
            if (currentPhotogFilter !== 'all') photos = photos.filter(p => p.photogKey === currentPhotogFilter);
            rawPhotos = [...rawPhotos, ...photos];
        });
        titleEl.innerText = (filterKey === 'all')
            ? "FULL ARCHIVE"
            : `ALL WORK BY ${window.gagaPhotogs[filterKey]?.name.toUpperCase() || "UNKNOWN"}`;
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

    sortedYears.forEach(year => {
        if (yearGroups[year].length === 0) return;

        let availableMonths = new Set();
        yearGroups[year].forEach(p => {
            const m = detectMonth(p.event || p.desc || '');
            if (m) availableMonths.add(m);
        });
        const sortedAvailableMonths = Array.from(availableMonths).sort((a, b) =>
            FULL_MONTHS.indexOf(a) - FULL_MONTHS.indexOf(b)
        );

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
                availableMonths: sortedAvailableMonths
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

            headerRow.appendChild(monthContainer);
            display.appendChild(headerRow);
        }

        const uniqueEvents = [...new Set(
            photos
                .filter(p => p.event)
                .map(p => {
                    const parts = p.event.split(':');
                    return parts.length > 1 ? parts.slice(1).join(':').trim().toUpperCase() : p.event.toUpperCase();
                })
        )];

        const eventsHTML = uniqueEvents.map(e => `<span class="event-sub-title">${e}</span>`).join('');

        const sessionBox = document.createElement('div');
        sessionBox.className = 'event-session-box';

        sessionBox.innerHTML = `
            <div class="session-layout">
                <div class="session-label">
                    <div class="session-date">${sessionKey}</div>
                    ${eventsHTML}
                </div>
                <div class="photo-wall"></div>
            </div>
        `;

        const grid = sessionBox.querySelector('.photo-wall');
        const photoGrid = buildSessionPhotoGrid(sessionKey, photos, observer);
        grid.appendChild(photoGrid);

        display.appendChild(sessionBox);
    });

    if (totalPages > 1) {
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
                pageLink.style.color = '#000';
                pageLink.style.textDecoration = 'underline';
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

        display.appendChild(pagination);
    }

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
    Object.keys(window.gagaPhotogs || {}).forEach(pKey => {
        const btn = document.createElement('button');
        btn.innerText = window.gagaPhotogs[pKey].name.toUpperCase();
        btn.onclick = () => { currentEraKey = ""; renderPhotos(pKey); };
        nav.appendChild(btn);
    });
}

function handlePhotogClick(event, photogKey) {
    if (photogKey === "NONE") return;
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
    const name = (d.photogKey === "NONE" || !window.gagaPhotogs[d.photogKey])
        ? "" : window.gagaPhotogs[d.photogKey].name.toUpperCase();

    document.getElementById('lightbox-img').src = d.url;

    const delBtn = isOwner
        ? `<button onclick="deletePhoto('${d.url}')" style="background:#ff4444; color:white; border:none; padding:8px 15px; cursor:pointer; font-size:9px; font-weight:bold; text-transform:uppercase; margin-top:10px;">DELETE PERMANENT</button>`
        : '';

    document.getElementById('lightbox-caption').innerHTML = `
        <div class="lb-title">${name} ${d.year ? '(' + d.year + ')' : ''}</div>
        <div class="lb-desc">${d.event || d.desc || ""}</div>
        <div style="margin-top:15px; display:flex; gap:10px; justify-content:center;">
            ${delBtn}
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
