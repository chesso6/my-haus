// ────────────────────────────────────────────────
// Global State & Local Storage
// ────────────────────────────────────────────────
const localArchive = localStorage.getItem('gaga_archive_updates');
if (localArchive) {
    window.gagaArchive = JSON.parse(localArchive);
}

let isOwner = localStorage.getItem('haus_owner_mode') === 'true';
let currentEraKey = "";
let currentFilteredPhotos = [];
let currentIndex = 0;
let currentPhotogFilter = 'all';

const MONTH_MAP = ["JAN", "FEB", "MARCH", "APR", "MAY", "JUNE", "JULY", "AUG", "SEP", "OCT", "NOV", "DEC"];
const FULL_MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

const OWNER_PASSWORD = "HAUS"; 

// ────────────────────────────────────────────────
// Initialization
// ────────────────────────────────────────────────
function init() {
    filterEras('all');
    renderSidebar(); 
    if (isOwner) renderOwnerUI();

    setupSearchKey();

    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'l' && !isOwner) showLogin();
    });
}

// ────────────────────────────────────────────────
// Search & Sidebar Logic
// ────────────────────────────────────────────────
function filterPhotographers() {
    const input = document.getElementById('photogSearch');
    if (!input) return;
    const filter = input.value.toUpperCase();
    const photogContainer = document.getElementById('photog-filters');
    const buttons = photogContainer.getElementsByTagName('button');

    for (let i = 0; i < buttons.length; i++) {
        const txtValue = buttons[i].textContent || buttons[i].innerText;
        if (txtValue === "ALL") {
            buttons[i].style.display = "";
            continue;
        }
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

                const buttons = Array.from(document.querySelectorAll('#photog-filters button'));
                const firstMatch = buttons.find(btn => 
                    btn.style.display !== 'none' && 
                    btn.innerText.trim().toUpperCase() !== 'ALL'
                );

                if (firstMatch) {
                    firstMatch.click(); 
                    newSearchBar.value = ""; 
                    filterPhotographers(); 
                }
            }
        });
    }
}

// ────────────────────────────────────────────────
// Owner Logic
// ────────────────────────────────────────────────
function showLogin() {
    const pass = prompt("ENTER OWNER ACCESS KEY:");
    if (pass === OWNER_PASSWORD) {
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

    const photogOptions = Object.keys(window.gagaPhotogs).map(k => `<option value="${k}">${window.gagaPhotogs[k].name}</option>`).join('');

    modal.innerHTML = `
        <h2 style="margin:0; font-size:10px; letter-spacing:4px; text-transform:uppercase;">ADD TO COLLECTION</h2>
        <input type="text" id="m-url" placeholder="IMAGE URL" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
        <input type="text" id="m-desc" placeholder="DESC (Include month: e.g. JAN)" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
        <input type="number" id="m-year" placeholder="YEAR (2025)" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
        <label style="font-size:9px; opacity:0.6;">PHOTOGRAPHER</label>
        <select id="m-photog" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
            <option value="NONE">NONE (NO NAME)</option>
            ${photogOptions}
        </select>
        <label style="font-size:9px; opacity:0.6;">ERA CATEGORY</label>
        <select id="m-era" style="background:#111; border:1px solid #333; color:#fff; padding:10px;">
            ${Object.keys(window.gagaArchive).map(k => `<option value="${k}">${window.gagaArchive[k].title}</option>`).join('')}
        </select>
        <button onclick="saveNewPhoto()" style="background:#fff; color:#000; border:none; padding:12px; cursor:pointer; font-weight:bold;">SAVE TO PHOTOGRAPHY</button>
        <button onclick="document.getElementById('owner-modal').remove()" style="background:transparent; color:#555; border:none; cursor:pointer; font-size:10px;">CANCEL</button>
    `;
    document.body.appendChild(modal);
}

function saveNewPhoto() {
    const url = document.getElementById('m-url').value;
    const desc = document.getElementById('m-desc').value;
    const year = document.getElementById('m-year').value;
    const photogKey = document.getElementById('m-photog').value;
    const eraKey = document.getElementById('m-era').value;
    if (!url || !year) return alert("Fill in URL and Year.");
    const newPhoto = { url, desc, year, photogKey };
    window.gagaArchive[eraKey].photos.push(newPhoto);
    localStorage.setItem('gaga_archive_updates', JSON.stringify(window.gagaArchive));
    alert("PHOTO SAVED SUCCESSFULLY");
    document.getElementById('owner-modal').remove();
    renderPhotos(currentPhotogFilter);
}

function deletePhoto(photoUrl) {
    if (!confirm("DELETE THIS PHOTO PERMANENTLY?")) return;
    Object.keys(window.gagaArchive).forEach(eraKey => {
        window.gagaArchive[eraKey].photos = window.gagaArchive[eraKey].photos.filter(p => p.url !== photoUrl);
    });
    localStorage.setItem('gaga_archive_updates', JSON.stringify(window.gagaArchive));
    closeLightbox();
    renderPhotos(currentPhotogFilter);
}

// ────────────────────────────────────────────────
// Rendering Logic
// ────────────────────────────────────────────────
function renderPhotos(filterKey = currentPhotogFilter, btn = null, targetMonth = null) {
    currentPhotogFilter = filterKey;
    const display = document.getElementById('photo-display');
    const titleEl = document.getElementById('active-title');
    if(!display) return;
    display.innerHTML = '';
    let rawPhotos = [];

    if (currentEraKey) {
        rawPhotos = window.gagaArchive[currentEraKey].photos || [];
        if (currentPhotogFilter !== 'all') {
            rawPhotos = rawPhotos.filter(p => p.photogKey === currentPhotogFilter);
        }
        const eraTitle = window.gagaArchive[currentEraKey].title;
        const photogName = window.gagaPhotogs[filterKey]?.name;

        if (currentPhotogFilter === 'all' || !photogName) {
            titleEl.innerText = eraTitle; 
        } else {
            titleEl.innerText = `${eraTitle} — ${photogName.toUpperCase()}`; 
        }
    } else {
        Object.keys(window.gagaArchive).forEach(eraKey => {
            let photos = window.gagaArchive[eraKey].photos;
            if (currentPhotogFilter !== 'all') photos = photos.filter(p => p.photogKey === currentPhotogFilter);
            rawPhotos = [...rawPhotos, ...photos];
        });
        titleEl.innerText = (filterKey === 'all') ? "FULL ARCHIVE" : `ALL WORK BY ${window.gagaPhotogs[filterKey]?.name.toUpperCase()}`;
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
        const year = photo.year || "MISC";
        if (!yearGroups[year]) yearGroups[year] = [];
        let monthName = "OTHER";
        MONTH_MAP.forEach((m, idx) => {
            if (photo.desc && photo.desc.toUpperCase().includes(m)) monthName = FULL_MONTHS[idx];
        });
        if (!targetMonth || monthName === targetMonth) yearGroups[year].push({ ...photo, globalIndex: index });
    });

    const sortedYears = Object.keys(yearGroups).sort((a, b) => a - b);
    let yearIdx = 0;

    function renderNextBatch() {
        if (yearIdx >= sortedYears.length) return;
        const year = sortedYears[yearIdx];
        if (yearGroups[year].length === 0) { yearIdx++; renderNextBatch(); return; }

        const yearSection = document.createElement('div');
        yearSection.className = 'year-group-wrapper';
        let availableMonths = new Set();
        rawPhotos.forEach(p => {
            if(p.year === year) {
                MONTH_MAP.forEach((m, idx) => {
                    if (p.desc && p.desc.toUpperCase().includes(m)) availableMonths.add(FULL_MONTHS[idx]);
                });
            }
        });

        let monthButtonsHTML = `<span class="month-link ${!targetMonth ? 'active' : ''}" onclick="renderPhotos('${filterKey}', null, null)">ALL</span>`;
        FULL_MONTHS.forEach(m => {
            if (availableMonths.has(m)) monthButtonsHTML += `<span class="month-link ${targetMonth === m ? 'active' : ''}" onclick="renderPhotos('${filterKey}', null, '${m}')">${m}</span>`;
        });

        yearSection.innerHTML = `
            <div class="year-group-container">
                <span class="year-label">${year}</span>
                <div class="month-nav">${monthButtonsHTML}</div>
            </div>
            <div class="photo-wall"></div>
        `;

        const grid = yearSection.querySelector('.photo-wall');
        yearGroups[year].forEach(photo => {
            const photoDiv = document.createElement('div');
            photoDiv.className = 'photo-item';
            const photogDisplay = (photo.photogKey === "NONE" || !window.gagaPhotogs[photo.photogKey]) 
                ? "" : (window.gagaPhotogs[photo.photogKey].name || "").toUpperCase();

            photoDiv.innerHTML = `
                <img data-src="${photo.url}" onclick="openLightbox(${photo.globalIndex})" style="opacity:0; transition: opacity 0.3s;">
                <div class="photo-info">
                    <div class="info-row"><span class="info-photog" onclick="handlePhotogClick(event, '${photo.photogKey}')">${photogDisplay}</span></div>
                    <div class="info-desc">${photo.desc || ""}</div>
                </div>`;
            const img = photoDiv.querySelector('img');
            img.onload = () => img.style.opacity = '1';
            grid.appendChild(photoDiv);
            observer.observe(img);
        });

        display.appendChild(yearSection);
        yearIdx++;
        requestAnimationFrame(renderNextBatch);
    }
    renderNextBatch();
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
        allLink.onclick = () => { currentEraKey = ""; renderPhotos('all'); };
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
    const allBtn = document.createElement('button');
    allBtn.innerText = "ALL";
    allBtn.onclick = () => { currentEraKey = ""; renderPhotos('all'); };
    nav.appendChild(allBtn);

    Object.keys(window.gagaPhotogs).forEach(pKey => {
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
    renderPhotos(photogKey);
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('exhibition-room').style.display = 'block';
    updateSubNavHighlight(""); 
}

function showLobby() {
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

// ────────────────────────────────────────────────
// Lightbox & Actions
// ────────────────────────────────────────────────
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
    
    const delBtn = isOwner ? `<button onclick="deletePhoto('${d.url}')" style="background:#ff4444; color:white; border:none; padding:8px 15px; cursor:pointer; font-size:9px; font-weight:bold; text-transform:uppercase; margin-top:10px;">Delete Permanent</button>` : '';

    document.getElementById('lightbox-caption').innerHTML = `
        <div class="lb-title">${name} ${d.year ? '('+d.year+')' : ''}</div>
        <div class="lb-desc">${d.desc || ""}</div>
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

document.addEventListener('DOMContentLoaded', init);

