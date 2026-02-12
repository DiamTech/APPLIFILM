let state = { 
    vin: "", 
    selectedWindows: [], 
    photos: [], 
    batch: [], 
    signature: null,
    sentHistory: [] 
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
                // 1. On remplit le champ VIN
                document.getElementById('vin-input').value = text;

                // 2. CAPTURE AUTOMATIQUE DE LA PHOTO
                try {
                    const video = document.querySelector('#reader video');
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0);
                    
                    // On compresse légèrement et on ajoute aux photos
                    const photoVIN = canvas.toDataURL('image/jpeg', 0.7);
                    state.photos.push(photoVIN);
                    renderPhotos(); // Met à jour l'affichage des photos
                } catch (e) {
                    console.log("Erreur capture auto :", e);
                }

                // 3. On arrête le scanner
                stopScanner();
                alert("VIN détecté et photo de preuve enregistrée !");
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
    const fixSize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.strokeStyle = "#4f46e5"; ctx.lineWidth = 3; ctx.lineCap = "round";
    };
    window.addEventListener('resize', fixSize);
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const ev = e.touches ? e.touches[0] : e;
        return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };
    const start = (e) => { if (e.target === canvas) e.preventDefault(); drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if (!drawing) return; if (e.target === canvas) e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const stop = () => { drawing = false; };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', stop);
}

function openSignature() { document.getElementById('modal-sig').classList.remove('hidden'); setTimeout(() => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; ctx.strokeStyle = "#4f46e5"; ctx.lineWidth = 3; }, 100); }
function closeSignature() { document.getElementById('modal-sig').classList.add('hidden'); }
function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }
function saveSignature() { state.signature = canvas.toDataURL('image/png'); document.getElementById('btn-sig-open').classList.add('hidden'); document.getElementById('sig-status').classList.remove('hidden'); closeSignature(); }
function resetSignature() { state.signature = null; clearCanvas(); document.getElementById('btn-sig-open').classList.remove('hidden'); document.getElementById('sig-status').classList.add('hidden'); }

// --- PHOTOS AVEC COMPRESSION (Vital pour éviter les erreurs de connexion) ---
function handlePhotos(input) {
    const files = Array.from(input.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const max_size = 1000; // Max 1000px
                if (width > height) { if (width > max_size) { height *= max_size / width; width = max_size; } }
                else { if (height > max_size) { width *= max_size / height; height = max_size; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                state.photos.push(canvas.toDataURL('image/jpeg', 0.6)); // 60% qualité pour la légèreté
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
let currentPendingWindow = null; // Stocke la vitre en cours de sélection

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
    // On cherche si la vitre est déjà dans la liste
    const index = state.selectedWindows.findIndex(w => w.id === id);
    
    if (index > -1) {
        state.selectedWindows[index].tint = tint; // On met à jour la teinte
    } else {
        state.selectedWindows.push({ id: id, tint: tint }); // On ajoute la vitre
    }
    
    // Mise à jour visuelle du bouton sur le schéma
    const btn = document.getElementById('win-' + id);
    btn.classList.add('selected');
    btn.innerHTML = `<span class="block text-[7px] opacity-70">${id}</span><span class="block">${tint}</span>`;
    
    closeTintModal();
}

function deselectWindow() {
    const id = currentPendingWindow;
    state.selectedWindows = state.selectedWindows.filter(w => w.id !== id);
    const btn = document.getElementById('win-' + id);
    btn.classList.remove('selected');
    btn.innerHTML = id; // On remet le nom d'origine
    closeTintModal();
}

function addToBatch() {
    const vinInput = document.getElementById('vin-input');
    const vin = vinInput.value.trim();
    if(!vin && state.selectedWindows.length === 0) return alert("Veuillez saisir un VIN ou sélectionner une vitre.");
    
    // APRÈS (Ce que tu dois mettre) :
state.batch.push({
    vin: vin || "SANS VIN",
    type: document.querySelector('input[name="type"]:checked').value,
    obs: document.getElementById('obs').value,
    // MODIFICATION ICI :
    windows: state.selectedWindows.map(w => `${w.id} (${w.tint})`), 
    photos: [...state.photos],
    signature: state.signature,
    date: new Date().toLocaleString('fr-FR')
});
    
    // Reset
    vinInput.value = ""; document.getElementById('obs').value = "";
    document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('selected'));
    state.selectedWindows = []; state.photos = []; resetSignature(); renderPhotos(); updateBatchUI();
    alert("Véhicule ajouté au lot !");
}

function updateBatchUI() { 
    const counter = document.getElementById('batch-counter');
    if(counter) counter.innerText = `${state.batch.length} EN ATTENTE`; 
}

function toggleHistoryMenu() { document.getElementById('history-menu').classList.toggle('hidden'); updateHistoryUI(); }

function updateHistoryUI() {
    const list = document.getElementById('sent-list');
    list.innerHTML = state.sentHistory.length === 0 ? '<p class="text-center py-6 text-[10px] opacity-50 uppercase">Aucun envoi</p>' : 
    state.sentHistory.map(item => `<div class="p-3 border-b border-slate-100 dark:border-slate-700"><div class="flex justify-between text-[10px] font-black"><span class="text-indigo-500">${item.vin}</span><span>${item.sentTime}</span></div></div>`).reverse().join('');
}

// --- ENVOI FINAL (VERSION BLINDÉE MOBILE) ---
async function finalize() {
    if(!state.batch.length) return alert("Le lot est vide !");
    
    const btn = document.getElementById('btn-final');
    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = "<span>ENVOI EN COURS...</span>";
    
    // Ton URL Google Script exacte
    const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbxNU3VrpgcdShsFfG_ETvgpis7x1nJCIQChoUTideIU4pxS1NZgr46hj8xEQiZEdq8y/exec';

    try {
        // On utilise NO-CORS pour éviter le blocage du téléphone
        await fetch(GOOGLE_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            body: JSON.stringify({ interventions: state.batch })
        });

        // Comme on est en no-cors, on ne peut pas lire la réponse "OK"
        // Mais si on n'a pas d'erreur réseau, on valide l'historique
        const now = new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
        state.batch.forEach(v => {
            state.sentHistory.push({ vin: v.vin, sentTime: now });
        });

        state.batch = [];
        updateBatchUI();
        updateHistoryUI();
        alert("TERMINÉ ! Les données ont été transmises.");

    } catch(e) {
        console.error(e);
        alert("Erreur de connexion. Vérifiez votre 4G/5G.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function toggleDarkMode() { 
    const isDark = document.documentElement.classList.toggle('dark'); 
    const icon = document.getElementById('dark-icon');
    if(icon) icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons();
}

// --- GESTION DU MENU ---
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

// --- CHANGEMENT DE VUE ---
function switchView(view) {
    toggleMenu(false); // Ferme le menu
    
    // Pour l'instant on prépare juste la logique
    if (view === 'pret') {
        alert("Interface 'Prêt de véhicule' en cours de préparation...");
    } else {
        alert("Retour à l'interface Vitrages");
    }
    
    // On mettra ici le code pour cacher/afficher les sections HTML
}

const VEHICLES_CONFIG = {
    VOITURE: {
        shape: '<svg viewBox="0 0 200 450" class="w-full h-full stroke-slate-300 dark:stroke-slate-600 fill-none" stroke-width="2"><path d="M50 20 C50 10, 150 10, 150 20 L170 100 L170 400 C170 430, 30 430, 30 400 L30 100 Z"/><path d="M40 110 L160 110 M40 280 L160 280"/></svg>',
        vitres: [
            { id: "PARE-BRISE", pos: "top: 40px; left: 50%; transform: translateX(-50%); width: 140px; height: 60px;" },
            { id: "AV-G", pos: "top: 120px; left: 10px; width: 50px; height: 70px;" },
            { id: "AV-D", pos: "top: 120px; right: 10px; width: 50px; height: 70px;" },
            { id: "AR-G", pos: "top: 200px; left: 10px; width: 50px; height: 70px;" },
            { id: "AR-D", pos: "top: 200px; right: 10px; width: 50px; height: 70px;" },
            { id: "LUNETTE", pos: "bottom: 40px; left: 50%; transform: translateX(-50%); width: 120px; height: 50px;" }
        ]
    },
    FOURGON: {
        shape: '<svg viewBox="0 0 200 450" class="w-full h-full stroke-slate-300 dark:stroke-slate-600 fill-none" stroke-width="2"><rect x="30" y="20" width="140" height="400" rx="15"/><path d="M30 100 L170 100 M30 380 L170 380"/></svg>',
        vitres: [
            { id: "PARE-BRISE", pos: "top: 35px; left: 50%; transform: translateX(-50%); width: 150px; height: 60px;" },
            { id: "LAT-G", pos: "top: 110px; left: 5px; width: 40px; height: 120px;" },
            { id: "LAT-D", pos: "top: 110px; right: 5px; width: 40px; height: 120px;" },
            { id: "LUN-G", pos: "bottom: 30px; left: 35px; width: 60px; height: 40px;" },
            { id: "LUN-D", pos: "bottom: 30px; right: 35px; width: 60px; height: 40px;" },
            { id: "TOIT", pos: "top: 250px; left: 50%; transform: translateX(-50%); width: 80px; height: 60px;" }
        ]
    },
    VDL: {
        shape: '<svg viewBox="0 0 200 450" class="w-full h-full stroke-slate-300 dark:stroke-slate-600 fill-none" stroke-width="2"><rect x="20" y="10" width="160" height="430" rx="5"/><path d="M20 90 L180 90"/></svg>',
        vitres: [
            { id: "PARE-BRISE", pos: "top: 25px; left: 50%; transform: translateX(-50%); width: 160px; height: 60px;" },
            { id: "BAIE-G", pos: "top: 120px; left: 5px; width: 35px; height: 100px;" },
            { id: "BAIE-D", pos: "top: 120px; right: 5px; width: 35px; height: 100px;" },
            { id: "LANT-1", pos: "top: 150px; left: 50%; transform: translateX(-50%); width: 70px; height: 70px;" },
            { id: "LANT-2", pos: "top: 300px; left: 50%; transform: translateX(-50%); width: 70px; height: 70px;" }
        ]
    }
};

function setVehicle(type) {
    state.vehiculeType = type;
    
    // UI Onglets
    ['VOITURE', 'FOURGON', 'VDL'].forEach(t => {
        const btn = document.getElementById('tab-' + t);
        if(btn) btn.classList.toggle('opacity-50', t !== type);
        if(btn) btn.classList.toggle('bg-white', t === type);
    });

    // Injecter le contour SVG
    document.getElementById('vehicle-svg-container').innerHTML = VEHICLES_CONFIG[type].shape;

    // Dessiner les boutons
    renderVitraux();
}

function renderVitraux() {
    const container = document.getElementById('vitres-container');
    const config = VEHICLES_CONFIG[state.vehiculeType];
    
    container.innerHTML = config.vitres.map(v => {
        const selection = state.selectedWindows.find(sw => sw.id === v.id);
        const isSelected = selection ? 'selected' : '';
        const label = selection ? `<span class="text-[7px] leading-none">${v.id}</span><br><b>${selection.tint}</b>` : v.id;
        
        return `
            <button type="button" onclick="toggleWindow('${v.id}')" id="win-${v.id}" 
                style="position: absolute; ${v.pos}"
                class="window-btn rounded-xl border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-[8px] font-bold uppercase transition-all flex flex-col items-center justify-center ${isSelected}">
                ${label}
            </button>
        `;
    }).join('');
}

// Initialisation au chargement
setTimeout(() => setVehicle('VOITURE'), 200);
