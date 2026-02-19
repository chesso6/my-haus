if (!window.gagaPhotogs) window.gagaPhotogs = {
    "ladygaga": { name: "Polaroid / Gaga" },
};

const photographerList = [];

photographerList.forEach(name => {
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!window.gagaPhotogs[key]) {
        window.gagaPhotogs[key] = { name: name };
    }

});


