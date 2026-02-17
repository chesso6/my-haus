if (!window.gagaPhotogs) window.gagaPhotogs = {
    "getty": { name: "Getty Images" },
    "itv": { name: "ITV / X Factor" },
    "polaroid": { name: "Polaroid / Gaga" },
    "ladygaga": { name: "Lady Gaga" },
};

const photographerList = [
    "2Vista", "Aaron Fallon", "Aaron Rapoport", "Adrian Sidney", "Aliya Naumoff", 
    "Andrea Spotorno", "Andrew Coppa", "Angela Rowlings", "Angus Smythe", "Ari Michelson", 
    "Artistic Agitators", "Ashleigh Sim", "Ashley Armstrong", "Brad Walsh", "Brendan Sullivan", "C. Flanigan", 
    "Candice Lawler", "Carsten Molis", "Chaos Theory Films", "Chiaki Oshima", "Chris Probst", 
    "Christian Jakubaszek", "Collin Erie", "D. Yount", "Damien Miller", "Dana Edelson", "David C. Lee", 
    "David LaChapelle", "David Richardson", "David Venni", "Derrick Santini", "Driven By Boredom", 
    "Ella Pellegrini", "Ellen von Unwerth", "Emma Porter", "Eric Myre", "Estevan Oriol", 
    "Francois Berthier", "Frank Lothar Lange", "Fred Greissing", "G-A-Y Heaven", "Gabe Zapata", 
    "Geordie Wood", "Gitte Meldgaard", "Hal Horowitz", "Henri Tullio", "Hilary Walsh", 
    "Jens Koch", "John Grainger", "John Lindquist", "John Wright", "Jonny Storey", 
    "Julio Kamara", "Kane Skennar", "Keiron O'Connor", "Kasia Bobula", "Lauren Dukoff", "Leslie Kee", 
    "Lindsay Lozon", "Liz Johnson-Artur", "LuxHunters", "M. Riley", "Manuela Cifra", 
    "Mario Testino", "Maro Hagopian", "Marcel Montemayor", "Martin Schoeller", "Matthew Rolston", 
    "Meeno", "Michael Wilfling", "Mick Rock", "Mitch Weiss", "Nic Paone", 
    "Nicolas Hidiro", "Nobuyoshi Araki", "Oliver Rauh", "Ollie & Capaldi", "Philipp Rathmer", 
    "Pierpaolo Ferrari", "Pieter Henket", "Rennio Maifredi", "Robin Roemer", "Ros O'Gorman", 
    "Sarah Lee", "Sasha Eisenman", "Sebastian Faena", "Severin Schweiger", "Slam", 
    "Stephanie Cabral", "Stephan Schraps", "Teri Pengilley", "Theo Wargo", "Thomas Rabsch", 
    "Tom Hawkins", "Tracey Nearmy", "Vasiliy Kudryavtsev", "Warwick Saint", "YOUGOTTALOVE"
];

photographerList.forEach(name => {
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!window.gagaPhotogs[key]) {
        window.gagaPhotogs[key] = { name: name };
    }
});