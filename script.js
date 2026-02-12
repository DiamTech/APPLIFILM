let state = { 
    vin: "", 
    selectedWindows: [], 
    photos: [], 
    batch: [], 
    signature: null,
    sentHistory: [],
    vehiculeType: 'VOITURE',
    pret: {
        km: "",
        carburant: null
    }
};

let scanner;
let canvas, ctx, drawing = false;

// --- INITIALISATION ---
window.addEventListener('load', () => {
    initSignature();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 600);
    }
});

// --- SCANNER VIN ---
async function startScanner() {
    const readerDiv = document.getElementById('reader');
    readerDiv.classList.toggle('hidden');
    
    if (readerDiv.classList.contains('hidden')) {
        if(scanner) await scanner.stop();
        return;
    }

    scanner = new Html5Qrcode("reader");
    
    try {
        await scanner.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 150 } }, 
            async (text) => {
                document.getElementById('vin-input').value = text;
                state.vin = text;

                // Capture auto
                try {
                    const video = document.querySelector('#reader video');
                    const canvasTemp = document.createElement('canvas');
                    canvasTemp.width = video.videoWidth;
                    canvasTemp.height = video.videoHeight;
                    const ctxTemp = canvasTemp.getContext('2d');
                    ctxTemp.drawImage(video, 0, 0);
                    const photoVIN = canvasTemp.toDataURL('image/jpeg', 0.7);
                    state.photos.push(photoVIN);
                    renderPhotos();
                } catch (e) { console.log("Erreur capture auto :", e); }

                stopScanner();
                alert("VIN détecté !");
            }
        );
    } catch (err) {
        alert("Caméra non accessible");
        readerDiv.classList.add('hidden');
    }
}

async function stopScanner() {
    if (scanner) {
        await scanner.stop();
        document.getElementById('reader').classList.add('hidden');
    }
}

// --- SIGNATURE (Ouverture corrigée) ---
function initSignature() {
    canvas = document.getElementById('canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const ev = e.touches ? e.touches[0] : e;
        return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };

    const start = (e) => { 
        if (e.target === canvas) e.preventDefault(); 
        drawing = true; 
        const p = getPos(e); 
        ctx.beginPath(); 
        ctx.moveTo(p.x, p.y); 
    };

    const move = (e) => { 
        if (!drawing) return; 
        if (e.target === canvas) e.preventDefault(); 
        const p = getPos(e); 
        ctx.lineTo(p.x, p.y); 
        ctx.stroke(); 
    };

    const stop = () => { drawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', stop);
}

function openSignature() { 
    const modal = document.getElementById('modal-sig');
    modal.classList.remove('hidden'); 
    // Correction taille canvas à l'ouverture
    setTimeout(() => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.strokeStyle = "#4f46e5"; 
        ctx.lineWidth = 3; 
        ctx.lineCap = "round";
    }, 200);
}

function closeSignature() { document.getElementById('modal-sig').classList.add('hidden'); }
function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

function saveSignature() { 
    state.signature = canvas.toDataURL('image/png'); 
    document.getElementById('btn-signer-principal').classList.add('hidden'); 
    document.getElementById('sig-status').classList.remove('hidden'); 
    closeSignature(); 
}

function resetSignature() { 
    state.signature = null; 
    clearCanvas(); 
    document.getElementById('btn-signer-principal').classList.remove('hidden'); 
    document.getElementById('sig-status').classList.add('hidden'); 
}

// --- PHOTOS ---
function handlePhotos(input) {
    const files = Array.from(input.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvasPhoto = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const max_size = 1000;
                if (width > height) { if (width > max_size) { height *= max_size / width; width = max_size; } }
                else { if (height > max_size) { width *= max_size / height; height = max_size; } }
                canvasPhoto.width = width; canvasPhoto.height = height;
                const ctxPhoto = canvasPhoto.getContext('2d');
                ctxPhoto.drawImage(img, 0, 0, width, height);
                state.photos.push(canvasPhoto.toDataURL('image/jpeg', 0.6));
                renderPhotos();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function renderPhotos() {
    const container = document.getElementById('photo-preview-container');
    const addButton = container.querySelector('label');
    container.innerHTML = ''; container.appendChild(addButton);
    state.photos.forEach((photo, index) => {
        const div = document.createElement('div');
        div.className = "relative aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-sm";
        div.innerHTML = `<img src="${photo}" class="w-full h-full object-cover"><button type="button" onclick="removePhoto(${index})" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>`;
        container.appendChild(div);
    });
}

function removePhoto(index) { state.photos.splice(index, 1); renderPhotos(); }

// --- LOGIQUE VITRES (CORRIGÉ POUR LE VIOLET) ---
let currentPendingWindow = null;

function toggleWindow(id) {
    currentPendingWindow = id;
    document.getElementById('tint-title').innerText = "TEINTE : " + id;
    document.getElementById('modal-tint').classList.remove('hidden');
}

function closeTintModal() {
    document.getElementById('modal-tint').classList.add('hidden');
    currentPendingWindow = null;
}

function selectTint(tint) {
    const id = currentPendingWindow;
    const index = state.selectedWindows.findIndex(w => w.id === id);
    
    if (index > -1) {
        state.selectedWindows[index].tint = tint;
    } else {
        state.selectedWindows.push({ id: id, tint: tint });
    }
    
    renderVitraux(); // On redessine tout pour appliquer les classes .selected
    closeTintModal();
}

function deselectWindow() {
    const id = currentPendingWindow;
    state.selectedWindows = state.selectedWindows.filter(w => w.id !== id);
    renderVitraux();
    closeTintModal();
}

// --- LOGIQUE FICHE DE PRÊT ---
function setFuel(value, btn) {
    state.pret.carburant = value;
    document.querySelectorAll('.fuel-btn').forEach(b => {
        b.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-600');
    });
    btn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600');
}

// --- AJOUT AU LOT ---
function addToBatch() {
    const vinInput = document.getElementById('vin-input');
    const kmInput = document.getElementById('km-input');
    const vin = vinInput.value.trim();
    
    if(!vin && state.selectedWindows.length === 0) return alert("Veuillez remplir les infos.");

    state.batch.push({
        vin: vin || "SANS VIN",
        type: document.querySelector('input[name="type"]:checked').value,
        obs: document.getElementById('obs').value,
        windows: state.selectedWindows.map(w => `${w.id} (${w.tint})`),
        pret: {
            km: kmInput ? kmInput.value : "N/A",
            carburant: state.pret.carburant || "Non spécifié"
        },
        photos: [...state.photos],
        signature: state.signature,
        date: new Date().toLocaleString('fr-FR')
    });

    // Reset complet
    vinInput.value = ""; 
    if(kmInput) kmInput.value = "";
    document.getElementById('obs').value = "";
    document.querySelectorAll('.fuel-btn').forEach(b => b.classList.remove('bg-indigo-600', 'text-white'));
    state.selectedWindows = []; 
    state.photos = []; 
    state.pret.carburant = null;
    resetSignature(); 
    renderPhotos(); 
    renderVitraux();
    updateBatchUI();
    alert("Ajouté au lot !");
}

function updateBatchUI() { 
    const counter = document.getElementById('batch-counter');
    if(counter) counter.innerText = `${state.batch.length} EN ATTENTE`; 
}

// --- FINALISATION ---
async function finalize() {
    if(!state.batch.length) return alert("Le lot est vide !");
    
    const btn = document.getElementById('btn-final');
    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = "<span>ENVOI EN COURS...</span>";
    
    const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbxNU3VrpgcdShsFfG_ETvgpis7x1nJCIQChoUTideIU4pxS1NZgr46hj8xEQiZEdq8y/exec';

    try {
        await fetch(GOOGLE_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ interventions: state.batch })
        });

        const now = new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
        state.batch.forEach(v => state.sentHistory.push({ vin: v.vin, sentTime: now }));

        state.batch = [];
        updateBatchUI();
        alert("TERMINÉ ! Données envoyées.");
    } catch(e) {
        alert("Erreur réseau.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
        lucide.createIcons();
    }
}

// --- THEME & MENU ---
function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('dark-icon');
    if (icon) {
        icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        lucide.createIcons();
    }
}

function toggleMenu(open) {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    const panel = document.getElementById('menu-panel');
    if (open) {
        menu.classList.remove('invisible');
        setTimeout(() => {
            overlay.classList.replace('opacity-0', 'opacity-100');
            panel.classList.replace('translate-x-full', 'translate-x-0');
        }, 10);
    } else {
        overlay.classList.replace('opacity-100', 'opacity-0');
        panel.classList.replace('translate-x-0', 'translate-x-full');
        setTimeout(() => menu.classList.add('invisible'), 300);
    }
}

// --- VEHICULES CONFIG ---
const VEHICLES_CONFIG = {
    VOITURE: {
        shape: '<svg viewBox="0 0 200 550" class="w-full h-full stroke-slate-300 dark:stroke-slate-600 fill-none" stroke-width="2"><path d="M50 20 C50 10, 150 10, 150 20 L175 100 L175 480 C175 510, 25 510, 25 480 L25 100 Z"/><path d="M30 110 L170 110 M30 350 L170 350"/></svg>',
        vitres: [
            { id: "P-BRISE", pos: "top: 5%; left: 50%; transform: translateX(-50%); width: 160px !important;" },
            { id: "CUST. AV-G", pos: "top: 18%; left: 2%;" },
            { id: "CUST. AV-D", pos: "top: 18%; right: 2%;" },
            { id: "VITRE AV-G", pos: "top: 28%; left: 2%;" },
            { id: "VITRE AV-D", pos: "top: 28%; right: 2%;" },
            { id: "TOIT 1", pos: "top: 25%; left: 50%; transform: translateX(-50%); width: 100px !important;" },
            { id: "TOIT 2", pos: "top: 38%; left: 50%; transform: translateX(-50%); width: 100px !important;" },
            { id: "VITRE AR-G", pos: "top: 42%; left: 2%;" },
            { id: "VITRE AR-D", pos: "top: 42%; right: 2%;" },
            { id: "DEMI AR-G", pos: "top: 55%; left: 2%;" },
            { id: "DEMI AR-D", pos: "top: 55%; right: 2%;" },
            { id: "CUST. EXT-G", pos: "top: 68%; left: 2%;" },
            { id: "CUST. EXT-D", pos: "top: 68%; right: 2%;" },
            { id: "LUNETTE", pos: "bottom: 15%; left: 50%; transform: translateX(-50%); width: 160px !important;" },
            { id: "LUN. G (X2)", pos: "bottom: 3%; left: 5%; width: 100px !important;" },
            { id: "LUN. D (X2)", pos: "bottom: 3%; right: 5%; width: 100px !important;" }
        ]
    },
    FOURGON: {
        shape: '<svg viewBox="0 0 200 550" class="w-full h-full stroke-slate-300 dark:stroke-slate-600 fill-none" stroke-width="2"><rect x="25" y="20" width="150" height="480" rx="20"/></svg>',
        vitres: [
            { id: "P-BRISE", pos: "top: 5%; left: 50%; transform: translateX(-50%); width: 160px !important;" },
            { id: "VITRE AV-G", pos: "top: 25%; left: 2%;" },
            { id: "VITRE AV-D", pos: "top: 25%; right: 2%;" },
            { id: "LATERAL-G", pos: "top: 50%; left: 2%;" },
            { id: "LATERAL-D", pos: "top: 50%; right: 2%;" },
            { id: "PORTES-AR", pos: "bottom: 10%; left: 50%; transform: translateX(-50%); width: 140px !important;" }
        ]
    }
};

function setVehicle(type) {
    state.vehiculeType = type;
    ['VOITURE', 'FOURGON'].forEach(t => {
        const btn = document.getElementById('tab-' + t);
        if(btn) btn.classList.toggle('opacity-50', t !== type);
    });
    document.getElementById('vehicle-svg-container').innerHTML = VEHICLES_CONFIG[type].shape;
    renderVitraux();
}

function renderVitraux() {
    const container = document.getElementById('vitres-container');
    const config = VEHICLES_CONFIG[state.vehiculeType];
    container.innerHTML = config.vitres.map(v => {
        const selection = state.selectedWindows.find(sw => sw.id === v.id);
        const isSelected = selection ? 'selected' : '';
        const label = selection 
            ? `<div>${v.id}</div><div style="font-weight:900;">${selection.tint}</div>` 
            : `<div>${v.id}</div>`;
        return `<button type="button" onclick="toggleWindow('${v.id}')" id="win-${v.id}" style="${v.pos}" class="window-btn ${isSelected}">${label}</button>`;
    }).join('');
}

setTimeout(() => setVehicle('VOITURE'), 200);
