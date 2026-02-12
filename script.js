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
        await scanner.start({ facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 150 } }, 
        (text) => {
            document.getElementById('vin-input').value = text;
            stopScanner();
        });
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
