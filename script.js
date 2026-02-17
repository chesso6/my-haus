let currentEraKey = "";
let currentFilteredPhotos = [];
let currentIndex = 0;
let currentPhotogFilter = 'all';

const MONTH_MAP = ["JAN", "FEB", "MARCH", "APR", "MAY", "JUNE", "JULY", "AUG", "SEP", "OCT", "NOV", "DEC"];
const FULL_MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

function init() {
    filterEras('all');
    renderSidebar(); 
}

function filterEras(category) {
    const menu = document.getElementById('era-menu');
    const subNav = document.getElementById('sub-era-nav');
    if (!menu) return;
    
    menu.innerHTML = ''; 
    if (subNav) subNav.innerHTML = '';
    
    if (subNav) {
        const allErasLink = document.createElement('span');
        allErasLink.className = 'nav-item';
        allErasLink.innerText = "ALL";
        allErasLink.onclick = () => {
            currentEraKey = "";
            renderPhotos(currentPhotogFilter);
        };
        subNav.appendChild(allErasLink);
    }

    const archive = window.gagaArchive || {};
    
    Object.keys(archive).forEach(key => {
        const eraData = archive[key];
        if (category === 'all' || eraData.type === category) {
            
            const card = document.createElement('div');
            card.className = 'era-card';
            card.innerHTML = `<span>${eraData.title}</span>`;
            
            card.style.backgroundImage = "none";

            card.onmouseenter = () => {
                if (eraData.albumArt) {
                    card.style.backgroundImage = `url('${eraData.albumArt}')`;
                    card.style.backgroundSize = 'cover';
                    card.style.backgroundPosition = 'center';
                    card.classList.add('hovered');
                }
            };

            card.onmouseleave = () => {
                card.style.backgroundImage = "none";
                card.classList.remove('hovered');
            };

            card.onclick = () => openEra(key);
            menu.appendChild(card);

            const navLink = document.createElement('span');
            navLink.className = 'nav-item';
            navLink.innerText = eraData.title;
            navLink.onclick = () => openEra(key);
            if (subNav) subNav.appendChild(navLink);
        }
    });
}

function openEra(key) {
    currentEraKey = key;
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('exhibition-room').style.display = 'block';
    updateSubNavHighlight(key);
    renderPhotos(currentPhotogFilter); 
}

function filterPhotographers() {
    const input = document.getElementById('photogSearch');
    const filter = input.value.toUpperCase();
    const container = document.getElementById('photog-filters');
    const buttons = container.getElementsByTagName('button');

    if (filter === "") return;

    let match = null;
    for (let i = 0; i < buttons.length; i++) {
        const txtValue = buttons[i].innerText || buttons[i].textContent;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            buttons[i].style.display = "";
            if (!match && txtValue !== "ALL") match = buttons[i];
        } else {
            buttons[i].style.display = "none";
        }
    }

    if (match && filter.length >= 3) {
        const pKey = match.dataset.key;
        if (pKey) {
            currentEraKey = ""; 
            document.getElementById('lobby').style.display = 'none';
            document.getElementById('exhibition-room').style.display = 'block';
            renderPhotos(pKey);
        }
    }
}

function renderSidebar() {
    const nav = document.getElementById('photog-filters');
    if (!nav) return;
    nav.innerHTML = ''; 

    const allBtn = document.createElement('button');
    allBtn.innerText = "ALL";
    allBtn.onclick = () => {
        currentEraKey = "";
        currentPhotogFilter = "all";
        renderPhotos('all');
    };
    nav.appendChild(allBtn);

    Object.keys(window.gagaPhotogs).forEach(pKey => {
        const btn = document.createElement('button');
        btn.innerText = window.gagaPhotogs[pKey].name.toUpperCase();
        btn.dataset.key = pKey;
        btn.onclick = () => {
            currentEraKey = ""; 
            renderPhotos(pKey);
        };
        nav.appendChild(btn);
    });
}

function renderPhotos(filterKey, targetMonth = null) {
    currentPhotogFilter = filterKey;
    const display = document.getElementById('photo-display');
    const titleEl = document.getElementById('active-title');
    if (!display || !titleEl) return;
    
    display.innerHTML = '';

    let rawPhotos = [];
    const photogName = window.gagaPhotogs[filterKey]?.name?.toUpperCase() || "";

    if (currentEraKey) {
        rawPhotos = window.gagaArchive[currentEraKey].photos || [];
        if (filterKey !== 'all') {
            rawPhotos = rawPhotos.filter(p => p.photogKey === filterKey);
        }
        titleEl.innerText = (filterKey === 'all') ? window.gagaArchive[currentEraKey].title : `${window.gagaArchive[currentEraKey].title} — ${photogName}`;
    } else {
        Object.keys(window.gagaArchive).forEach(key => {
            let photos = window.gagaArchive[key].photos || [];
            if (filterKey !== 'all') photos = photos.filter(p => p.photogKey === filterKey);
            rawPhotos = [...rawPhotos, ...photos];
        });
        titleEl.innerText = (filterKey === 'all') ? "FULL ARCHIVE" : `ALL WORK BY ${photogName}`;
    }

    if (rawPhotos.length === 0) {
        display.innerHTML = `<div class="no-results">NO PHOTOS FOUND.</div>`;
        return;
    }

    currentFilteredPhotos = rawPhotos;
    renderGrid(rawPhotos, display, targetMonth);
}

function renderPhotos(filterKey, btn = null, targetMonth = null) {
    currentPhotogFilter = filterKey;

    const lobby = document.getElementById('lobby');
    const exhibition = document.getElementById('exhibition-room');
    
    if (lobby && filterKey !== 'all' && currentEraKey === "") {
        lobby.style.display = 'none';
        exhibition.style.display = 'block';
    }

    document.querySelectorAll('#photog-filters button').forEach(b => {
        const pData = window.gagaPhotogs[filterKey];
        const photogName = pData ? pData.name.toUpperCase() : filterKey.toUpperCase();
        b.classList.toggle('active', b.innerText === (filterKey === 'all' ? "ALL" : photogName));
    });

    const display = document.getElementById('photo-display');
    const titleEl = document.getElementById('active-title');
    display.innerHTML = '';

    let rawPhotos = [];
    const photogName = window.gagaPhotogs[filterKey]?.name?.toUpperCase() || filterKey.toUpperCase();

    if (currentEraKey) {
        rawPhotos = window.gagaArchive[currentEraKey].photos || [];
        if (currentPhotogFilter !== 'all') {
            rawPhotos = rawPhotos.filter(p => p.photogKey === currentPhotogFilter);
        }
        
        const eraTitle = window.gagaArchive[currentEraKey].title;
        titleEl.innerText = (currentPhotogFilter === 'all') 
            ? eraTitle : `${eraTitle} — ${photogName}`;
    } else {
        Object.keys(window.gagaArchive).forEach(eraKey => {
            const eraPhotos = window.gagaArchive[eraKey].photos.filter(p => p.photogKey === currentPhotogFilter);
            rawPhotos = [...rawPhotos, ...eraPhotos];
        });
        titleEl.innerText = (filterKey === 'all') ? "FULL ARCHIVE" : `ALL WORK BY ${photogName}`;
    }

    if (rawPhotos.length === 0) {
        display.innerHTML = `<div class="no-results">NO PHOTOS FOUND.</div>`;
        return;
    }

    currentFilteredPhotos = rawPhotos;

    const yearGroups = {};
    rawPhotos.forEach((photo, index) => {
        const year = photo.year || "MISC";
        let monthName = "OTHER";
        MONTH_MAP.forEach((m, idx) => {
            if (photo.desc && photo.desc.toUpperCase().includes(m)) monthName = FULL_MONTHS[idx];
        });
        if (!yearGroups[year]) yearGroups[year] = { photos: [], availableMonths: new Set() };
        yearGroups[year].photos.push({ data: photo, originalIndex: index, month: monthName });
        if (monthName !== "OTHER") yearGroups[year].availableMonths.add(monthName);
    });

    Object.keys(yearGroups).sort((a, b) => a - b).forEach(year => {
        const headerContainer = document.createElement('div');
        headerContainer.className = 'year-group-container';
        headerContainer.innerHTML = `<span class="year-label">${year}</span>`;

        const monthNav = document.createElement('div');
        monthNav.className = 'month-nav';
        
        const allBtn = document.createElement('span');
        allBtn.innerText = "ALL";
        allBtn.className = !targetMonth ? 'month-link active' : 'month-link';
        allBtn.onclick = () => renderPhotos(filterKey, null, null);
        monthNav.appendChild(allBtn);

        FULL_MONTHS.forEach(m => {
            if (yearGroups[year].availableMonths.has(m)) {
                const mLink = document.createElement('span');
                mLink.innerText = m;
                mLink.className = targetMonth === m ? 'month-link active' : 'month-link';
                mLink.onclick = () => renderPhotos(filterKey, null, m);
                monthNav.appendChild(mLink);
            }
        });

        display.appendChild(headerContainer);
        headerContainer.appendChild(monthNav);

        const grid = document.createElement('div');
        grid.className = 'photo-wall';
        
        yearGroups[year].photos.forEach(item => {
            if (targetMonth && item.month !== targetMonth) return;
            const photo = item.data;
            const photogData = window.gagaPhotogs[photo.photogKey];

            const photogHTML = photogData ? `
                <div class="info-row">
                    <span class="info-photog" style="cursor:pointer; text-decoration:underline;" 
                          onclick="event.stopPropagation(); currentEraKey=''; renderPhotos('${photo.photogKey}')">
                        ${photogData.name.toUpperCase()}
                    </span>
                </div>` : '';

            const photoDiv = document.createElement('div');
photoDiv.className = 'photo-item';
photoDiv.innerHTML = `
    <img src="${photo.url}" onclick="openLightbox(${item.originalIndex})" loading="lazy">
    <div class="photo-info">
        <div class="info-row">
            <span class="info-photog" 
                  style="cursor:pointer; text-decoration:underline; font-weight:bold; color:#000000;" 
                  onclick="handlePhotogClick(event, '${photo.photogKey}')">
                ${(window.gagaPhotogs[photo.photogKey]?.name || "").toUpperCase()}
            </span>
        </div>
        <div class="info-desc">${photo.desc || ""}</div>
    </div>`;
grid.appendChild(photoDiv);
        });
        display.appendChild(grid);
    });
}

function handlePhotogClick(event, photogKey) {
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
    currentEraKey = "";
    currentPhotogFilter = "all";
    
    const searchInput = document.getElementById('photogSearch');
    if (searchInput) searchInput.value = "";
    
    filterEras('all');
    renderSidebar(); 
}

function updateSubNavHighlight(activeKey) {
    document.querySelectorAll('.nav-item').forEach(item => {
        const isAll = item.innerText === "ALL" && activeKey === "";
        const era = Object.keys(window.gagaArchive).find(k => window.gagaArchive[k].title === item.innerText);
        item.classList.toggle('active-era', isAll || era === activeKey);
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
    const name = window.gagaPhotogs[d.photogKey]?.name.toUpperCase() || "";
    document.getElementById('lightbox-img').src = d.url;
    document.getElementById('lightbox-caption').innerHTML = `
        <div class="lb-title">${name} ${d.year ? '('+d.year+')' : ''}</div>
        <div class="lb-desc">${d.desc || ""}</div>
    `;
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

