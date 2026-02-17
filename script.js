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
    const archive = window.gagaArchive || {};
    
    document.querySelectorAll('.category-item').forEach(el => {
        el.classList.remove('active-category');
        if(el.innerText.toLowerCase().includes(category)) el.classList.add('active-category');
    });

    Object.keys(archive).forEach(key => {
        const eraData = archive[key];
        
        if (category === 'all' || eraData.type === category) {
            
            const card = document.createElement('div');
            card.className = 'era-card';
            card.innerHTML = `<span>${eraData.title}</span>`;
            
            card.onmouseenter = () => {
                if (eraData.albumArt) {
                    card.style.backgroundImage = `url(${eraData.albumArt})`;
                    card.style.backgroundSize = 'contain';
                    card.style.backgroundRepeat = 'no-repeat';
                    card.style.backgroundPosition = 'center';
                    card.style.color = "transparent";
                }
            };
            card.onmouseleave = () => {
                card.style.backgroundImage = 'none';
                card.style.color = "#000";
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
    
    const eraPhotos = window.gagaArchive[key].photos;
    const keysInEra = [...new Set(eraPhotos.map(p => p.photogKey))]
                        .filter(k => k && window.gagaPhotogs[k]);
    
    renderSidebar(keysInEra);
    renderPhotos(currentPhotogFilter);
}

function renderSidebar(keys = null) {
    const nav = document.getElementById('photog-filters');
    if (!nav) return;
    nav.innerHTML = ''; 

    const allBtn = document.createElement('button');
    allBtn.innerText = "ALL";
    allBtn.classList.toggle('active', currentPhotogFilter === 'all');
    allBtn.onclick = () => renderPhotos('all', allBtn);
    nav.appendChild(allBtn);

    let photogKeys = keys || Object.keys(window.gagaPhotogs);
    
    if (currentPhotogFilter !== 'all' && !photogKeys.includes(currentPhotogFilter)) {
        photogKeys.push(currentPhotogFilter);
    }

    photogKeys.sort((a, b) => {
        const nameA = (window.gagaPhotogs[a]?.name || a).toUpperCase();
        const nameB = (window.gagaPhotogs[b]?.name || b).toUpperCase();
        return nameA.localeCompare(nameB);
    });

    photogKeys.forEach(pKey => {
        const name = window.gagaPhotogs[pKey]?.name || pKey;
        const btn = document.createElement('button');
        btn.innerText = name.toUpperCase();
        btn.classList.toggle('active', currentPhotogFilter === pKey);
        btn.onclick = () => renderPhotos(pKey, btn);
        nav.appendChild(btn);
    });
}

function renderPhotos(filterKey, btn = null, targetMonth = null) {
    currentPhotogFilter = filterKey;

    const lobby = document.getElementById('lobby');
    const exhibition = document.getElementById('exhibition-room');
    if (lobby && lobby.style.display !== 'none' && filterKey !== 'all') {
        lobby.style.display = 'none';
        exhibition.style.display = 'block';
    }
    
    const navButtons = document.querySelectorAll('#photog-filters button');
    navButtons.forEach(b => {
        b.classList.remove('active');
        const photogName = window.gagaPhotogs[filterKey]?.name?.toUpperCase();
        if (b.innerText === (filterKey === 'all' ? "ALL" : photogName)) {
            b.classList.add('active');
        }
    });

    const display = document.getElementById('photo-display');
    display.innerHTML = '';

    let rawPhotos = [];
    if (currentEraKey) {
        document.getElementById('active-title').innerText = window.gagaArchive[currentEraKey].title;
        rawPhotos = window.gagaArchive[currentEraKey].photos;
        if (currentPhotogFilter != 'all') {
            rawPhotos = rawPhotos.filter(p => p.photogKey === currentPhotogFilter);
            const photogName = window.gagaPhotogs[currentPhotogFilter]?.name || currentPhotogFilter;
            document.getElementById('active-title').innerText = `${window.gagaArchive[currentEraKey].title} — ${photogName.toUpperCase()}`;
        }
    } 
    else if (currentPhotogFilter !== 'all') {
        const photogName = window.gagaPhotogs[currentPhotogFilter]?.name || currentPhotogFilter;
        document.getElementById('active-title').innerText = photogName.toUpperCase();
        
        Object.keys(window.gagaArchive).forEach(eraKey => {
            const eraPhotos = window.gagaArchive[eraKey].photos.filter(p => p.photogKey === currentPhotogFilter);
            rawPhotos = [...rawPhotos, ...eraPhotos];
        });
    }

    if (rawPhotos.length === 0) {
        display.innerHTML = `<div class="no-results">NO PHOTOS BY THIS PHOTOGRAPHER IN THIS ERA.</div>`;
        return;
    }

    currentFilteredPhotos = rawPhotos;

    const yearGroups = {};
    rawPhotos.forEach((photo, index) => {
        const year = photo.year || "MISC";
        let monthName = "OTHER";
        MONTH_MAP.forEach((m, idx) => {
            if (photo.desc && photo.desc.toUpperCase().includes(m)) {
                monthName = FULL_MONTHS[idx];
            }
        });

        if (!yearGroups[year]) {
            yearGroups[year] = { photos: [], availableMonths: new Set() };
        }
        yearGroups[year].photos.push({ data: photo, originalIndex: index, month: monthName });
        if (monthName !== "OTHER") yearGroups[year].availableMonths.add(monthName);
    });

    Object.keys(yearGroups).sort((a, b) => a - b).forEach(year => {
        const headerContainer = document.createElement('div');
        headerContainer.className = 'year-group-container';

        const yearTitle = document.createElement('span');
        yearTitle.className = 'year-label';
        yearTitle.innerText = year;
        headerContainer.appendChild(yearTitle);

        const monthNav = document.createElement('div');
        monthNav.className = 'month-nav';
        
        const allMonthsBtn = document.createElement('span');
        allMonthsBtn.innerText = "ALL";
        allMonthsBtn.className = !targetMonth ? 'month-link active' : 'month-link';
        allMonthsBtn.onclick = () => renderPhotos(filterKey, null, null);
        monthNav.appendChild(allMonthsBtn);

        FULL_MONTHS.forEach(m => {
            if (yearGroups[year].availableMonths.has(m)) {
                const mLink = document.createElement('span');
                mLink.innerText = m;
                mLink.className = targetMonth === m ? 'month-link active' : 'month-link';
                mLink.onclick = () => renderPhotos(filterKey, null, m);
                monthNav.appendChild(mLink);
            }
        });

        headerContainer.appendChild(monthNav);
        display.appendChild(headerContainer);

        const grid = document.createElement('div');
        grid.className = 'photo-wall';
        
        yearGroups[year].photos.forEach(item => {
            if (targetMonth && item.month !== targetMonth) return;

            const photo = item.data;
            const photogData = window.gagaPhotogs[photo.photogKey];
            const photogHTML = photogData 
                ? `<div class="info-row">
                    <span class="info-photog" 
                          style="cursor:pointer; text-decoration: underline;" 
                          onclick="event.stopPropagation(); renderPhotos('${photo.photogKey}')">
                        ${photogData.name.toUpperCase()}
                    </span>
                   </div>` 
                : '';

            const photoDiv = document.createElement('div');
            photoDiv.className = 'photo-item';
            photoDiv.innerHTML = `
                <img src="${photo.url}" onclick="openLightbox(${item.originalIndex})" loading="lazy">
                <div class="photo-info">
                    ${photogHTML}
                    <div class="info-desc">${photo.desc || ""}</div>
                </div>
            `;
            grid.appendChild(photoDiv);
        });
        display.appendChild(grid);
    });
}

function openLightbox(index) {
    currentIndex = index;
    updateLightbox();
    document.getElementById('lightbox').style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
}

function updateLightbox() {
    const data = currentFilteredPhotos[currentIndex];
    const photogData = window.gagaPhotogs[data.photogKey];
    const nameDisplay = photogData ? photogData.name.toUpperCase() : "";
    
    document.getElementById('lightbox-img').src = data.url;
    document.getElementById('lightbox-caption').innerHTML = `
        <div class="lb-title">${nameDisplay} ${data.year ? '(' + data.year + ')' : ''}</div>
        <div class="lb-desc">${data.desc || ""}</div>
    `;
}

function changeImage(step) {
    if (currentFilteredPhotos.length === 0) return;
    currentIndex = (currentIndex + step + currentFilteredPhotos.length) % currentFilteredPhotos.length;
    updateLightbox();
}

function closeLightbox() { 
    document.getElementById('lightbox').style.display = 'none'; 
    document.body.style.overflow = 'auto';
}

function downloadImage() {
    const imageUrl = currentFilteredPhotos[currentIndex].url;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `GAGA_ARCHIVE_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function filterPhotographers() {
    const input = document.getElementById('photogSearch');
    const filter = input.value.toUpperCase();
    const container = document.getElementById('photog-filters');
    const buttons = container.getElementsByTagName('button');

    for (let i = 0; i < buttons.length; i++) {
        const txtValue = buttons[i].textContent || buttons[i].innerText;
        if (txtValue === "ALL") {
            buttons[i].style.display = filter === "" ? "" : "none";
            continue;
        }
        buttons[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
    }
}

function showLobby() { 
    document.getElementById('lobby').style.display = 'block';
    document.getElementById('exhibition-room').style.display = 'none';
    currentEraKey = "";
    currentPhotogFilter = "all";
    filterEras('all');
    renderSidebar(); 
}

function updateSubNavHighlight(activeKey) {
    const items = document.querySelectorAll('.nav-item');
    const archiveKeys = Object.keys(window.gagaArchive);
    items.forEach((item) => {
        const era = archiveKeys.find(k => window.gagaArchive[k].title === item.innerText);
        item.classList.toggle('active-era', era === activeKey);
    });
}

document.addEventListener('keydown', (e) => {
    if (document.getElementById('lightbox').style.display === 'flex') {
        if (e.key === "ArrowLeft") changeImage(-1);
        if (e.key === "ArrowRight") changeImage(1);
        if (e.key === "Escape") closeLightbox();
    }
});

document.addEventListener('DOMContentLoaded', init);
