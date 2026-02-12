let state = { 
    vin: "", 
    selectedWindows: [], 
    photos: [], 
    batch: [], 
    signature: null,
    sentHistory: [],
    dailyHistory: [] 
};

let scanner;
let canvas, ctx, drawing = false;

// --- INITIALISATION ---
window.addEventListener('load', () => {
    setTimeout(() => {
        initSignature();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 600);
        }
    }, 100);
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
                try {
                    const video = document.querySelector('#reader video');
                    const canvasPhoto = document.createElement('canvas');
                    canvasPhoto.width = video.videoWidth;
                    canvasPhoto.height = video.videoHeight;
                    const ctxPhoto = canvasPhoto.getContext('2d');
                    ctxPhoto.drawImage(video, 0, 0);
                    state.photos.push(canvasPhoto.toDataURL('image/jpeg', 0.7));
                    renderPhotos();
                } catch (e) { console.log("Erreur capture auto", e); }

                stopScanner();
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

// --- SIGNATURE ---
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
    document.getElementById('modal-sig').classList.remove('hidden'); 
    setTimeout(() => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.strokeStyle = "#4f46e5"; 
        ctx.lineWidth = 3; 
        ctx.lineCap = "round";
    }, 250);
}

function closeSignature() { 
    document.getElementById('modal-sig').classList.add('hidden'); 
}

function saveSignature() { 
    state.signature = canvas.toDataURL('image/png'); 
    document.getElementById('btn-sig-open').classList.add('hidden'); 
    document.getElementById('sig-status').classList.remove('hidden'); 
    closeSignature(); 
}

function clearCanvas() { 
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height); 
}

function resetSignature() { 
    state.signature = null; 
    clearCanvas(); 
    document.getElementById('btn-sig-open').classList.remove('hidden'); 
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
                let width = img.width, height = img.height, max_size = 1000;
                if (width > height) { if (width > max_size) { height *= max_size / width; width = max_size; } }
                else { if (height > max_size) { width *= max_size / height; height = max_size; } }
                canvasPhoto.width = width; canvasPhoto.height = height;
                canvasPhoto.getContext('2d').drawImage(img, 0, 0, width, height);
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

// --- LOGIQUE METIER ---
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
    if (index > -1) state.selectedWindows[index].tint = tint;
    else state.selectedWindows.push({ id: id, tint: tint });
    
    // Mise à jour visuelle forcée ici pour s'assurer que le violet s'applique
    renderVitraux();
    closeTintModal();
}

function deselectWindow() {
    const id = currentPendingWindow;
    state.selectedWindows = state.selectedWindows.filter(w => w.id !== id);
    renderVitraux();
    closeTintModal();
}

// --- AJOUT AU LOT (CORRIGÉ AVEC SÉCURITÉS STRICTES) ---
function addToBatch() {
    const vinInput = document.getElementById('vin-input');
    const vinValue = vinInput.value.trim();

    // 1. VERROU VIN : Si pas de VIN, on arrête tout
    if (!vinValue) {
        alert("⚠️ Le numéro VIN est OBLIGATOIRE pour ajouter le véhicule.");
        vinInput.focus();
        return; 
    }

    // 2. VERROU VITRES : Si aucune vitre dans la liste, on arrête tout
    if (state.selectedWindows.length === 0) {
        alert("⚠️ Vous devez sélectionner AU MOINS UNE VITRE.");
        return; 
    }

    // 3. VERROU SIGNATURE : Si pas de signature validée, on arrête tout
    if (!state.signature) {
        alert("⚠️ La signature est OBLIGATOIRE pour valider l'intervention.");
        return; 
    }
    
    // Si on arrive ici, c'est que tout est bon
    state.batch.push({
        vin: vinValue,
        type: document.querySelector('input[name="type"]:checked').value,
        obs: document.getElementById('obs').value,
        windows: state.selectedWindows.map(w => `${w.id} (${w.tint})`), 
        photos: [...state.photos],
        signature: state.signature,
        date: new Date().toLocaleString('fr-FR')
    });
    
    // Reset de l'interface pour le prochain véhicule
    vinInput.value = ""; 
    document.getElementById('obs').value = "";
    state.selectedWindows = []; 
    state.photos = []; 
    
    resetSignature(); 
    renderPhotos(); 
    renderVitraux(); // Remet les vitres à blanc
    updateBatchUI();
    
    alert("✅ Véhicule ajouté au lot avec succès !");
}

function updateBatchUI() { 
    const counter = document.getElementById('batch-counter');
    if(counter) counter.innerText = `${state.batch.length} EN ATTENTE`; 
}

function toggleHistoryMenu() { 
    document.getElementById('history-menu').classList.toggle('hidden'); 
    updateHistoryUI(); 
}

function updateHistoryUI() {
    const list = document.getElementById('sent-list');
    if(!list) return;
    list.innerHTML = state.sentHistory.length === 0 ? '<p class="text-center py-6 text-[10px] opacity-50 uppercase">Aucun envoi</p>' : 
    state.sentHistory.map(item => `<div class="p-3 border-b border-slate-100 dark:border-slate-700"><div class="flex justify-between text-[10px] font-black"><span class="text-indigo-500">${item.vin}</span><span>${item.sentTime}</span></div></div>`).reverse().join('');
}

async function finalize() {
    if(!state.batch.length) return alert("Le lot est vide ! Ajoutez d'abord un véhicule.");
    
    const btn = document.getElementById('btn-final');
    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = "<span>ENVOI EN COURS...</span>";
    
    const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbx127X1JbcpO4hwYuNzKC9tmBsB51Fi4XnOn4ve65YBnvWsVuq9If5cwJBv0tQ5Rm6t/exec';

    try {
        await fetch(GOOGLE_URL, {
            method: 'POST', mode: 'no-cors', cache: 'no-cache',
            body: JSON.stringify({ interventions: state.batch })
        });
        
        // --- MISE A JOUR DE L'HISTORIQUE DETAILLÉ ---
        const now = new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
        
        state.batch.forEach(v => { 
            // On ajoute TOUT l'objet véhicule dans l'historique + l'heure
            state.dailyHistory.push({ ...v, sentTime: now });
        });

        state.batch = [];
        updateBatchUI(); 
        
        alert("TERMINÉ ! Lot envoyé.");

    } catch(e) {
        alert("Erreur réseau.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('dark-icon');
    if (icon) {
        icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        lucide.createIcons();
    }
}

if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
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

function switchView(view) {
    toggleMenu(false);
    
    const divIntervention = document.getElementById('view-intervention');
    const divHistory = document.getElementById('view-history');

    if (view === 'history') {
        divIntervention.classList.add('hidden');
        divHistory.classList.remove('hidden');
        renderDailyHistory(); // On génère la liste
    } else if (view === 'vitrage') {
        divIntervention.classList.remove('hidden');
        divHistory.classList.add('hidden');
    } else if (view === 'pret') {
        alert("Interface 'Prêt de véhicule' en préparation...");
    }
}

function renderDailyHistory() {
    const container = document.getElementById('daily-history-list');
    if (!container) return;

    if (state.dailyHistory.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm">Aucun envoi aujourd\'hui</div>';
        return;
    }

    container.innerHTML = state.dailyHistory.map(item => `
        <div class="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <div class="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">${item.type}</div>
                    <div class="text-lg font-bold text-slate-800 dark:text-white">${item.vin}</div>
                </div>
                <div class="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg">
                    ${item.sentTime}
                </div>
            </div>
            
            <div class="space-y-2">
                <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl text-xs text-slate-600 dark:text-slate-300">
                    <strong class="block text-[9px] uppercase text-slate-400 mb-1">Vitres</strong>
                    ${item.windows.join(', ')}
                </div>
                ${item.obs ? `
                <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl text-xs text-slate-600 dark:text-slate-300">
                    <strong class="block text-[9px] uppercase text-slate-400 mb-1">Observations</strong>
                    ${item.obs}
                </div>` : ''}
            </div>
            
            <div class="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <div class="flex -space-x-2">
                    ${item.photos.map(() => `<div class="w-6 h-6 rounded-full bg-slate-200 border-2 border-white dark:border-slate-800"></div>`).join('')}
                </div>
                <div class="text-[10px] font-bold text-slate-400">
                    ${item.photos.length} Photo(s) • Signature OK
                </div>
            </div>
        </div>
    `).reverse().join('');
}


// --- CONFIGURATION IDENTIQUE POUR TOUS LES VEHICULES (RESTÉE INCHANGÉE) ---
const COMMON_VITRES = [
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
];

const VEHICLES_CONFIG = {
    VOITURE: { shape: '<svg viewBox="0 0 200 550" class="w-full h-full stroke-slate-300 dark:stroke-slate-600 fill-none" stroke-width="2"><path d="M50 20 C50 10, 150 10, 150 20 L175 100 L175 480 C175 510, 25 510, 25 480 L25 100 Z"/><path d="M30 110 L170 110 M30 350 L170 350"/></svg>', vitres: COMMON_VITRES },
    FOURGON: { shape: '<svg viewBox="0 0 200 550" class="w-full h-full stroke-slate-300 dark:stroke-slate-600 fill-none" stroke-width="2"><path d="M50 20 C50 10, 150 10, 150 20 L175 100 L175 480 C175 510, 25 510, 25 480 L25 100 Z"/><path d="M30 110 L170 110 M30 350 L170 350"/></svg>', vitres: COMMON_VITRES },
    VDL: { shape: '<svg viewBox="0 0 200 550" class="w-full h-full stroke-slate-300 dark:stroke-slate-600 fill-none" stroke-width="2"><path d="M50 20 C50 10, 150 10, 150 20 L175 100 L175 480 C175 510, 25 510, 25 480 L25 100 Z"/><path d="M30 110 L170 110 M30 350 L170 350"/></svg>', vitres: COMMON_VITRES }
};

function setVehicle(type) {
    state.vehiculeType = type;
    ['VOITURE', 'FOURGON', 'VDL'].forEach(t => {
        const btn = document.getElementById('tab-' + t);
        if(btn) { btn.classList.toggle('opacity-50', t !== type); btn.classList.toggle('bg-white', t === type); }
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
            ? `<div style="font-size: 7px; opacity: 0.6;">${v.id}</div><div style="font-weight: 900; color: #4f46e5;">${selection.tint}</div>` 
            : `<div>${v.id}</div>`;
        return `<button type="button" onclick="toggleWindow('${v.id}')" id="win-${v.id}" style="position: absolute; ${v.pos}" class="window-btn rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-800/90 shadow-sm ${isSelected}">${label}</button>`;
    }).join('');
}

setTimeout(() => setVehicle('VOITURE'), 200);
