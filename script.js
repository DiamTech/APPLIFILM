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

// --- INITIALISATION & SECURITE LOGO ---
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
        alert("Erreur caméra : Vérifiez les autorisations.");
        readerDiv.classList.add('hidden');
    }
}

async function stopScanner() {
    if (scanner) {
        await scanner.stop();
        document.getElementById('reader').classList.add('hidden');
    }
}

// --- SIGNATURE (Modale & Tracé) ---
function initSignature() {
    canvas = document.getElementById('canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    const fixSize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.strokeStyle = "#4f46e5"; 
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    };

    window.addEventListener('resize', fixSize);

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const ev = e.touches ? e.touches[0] : e;
        return {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top
        };
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
    }, 100);
}

function closeSignature() { document.getElementById('modal-sig').classList.add('hidden'); }
function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

function saveSignature() {
    state.signature = canvas.toDataURL('image/png');
    document.getElementById('btn-sig-open').classList.add('hidden');
    document.getElementById('sig-status').classList.remove('hidden');
    closeSignature();
}

function resetSignature() {
    state.signature = null;
    clearCanvas();
    document.getElementById('btn-sig-open').classList.remove('hidden');
    document.getElementById('sig-status').classList.add('hidden');
}

// --- GESTION DES PHOTOS & MINIATURES ---
function handlePhotos(input) {
    const files = Array.from(input.files);
    let processed = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.photos.push(e.target.result);
            processed++;
            if (processed === files.length) renderPhotos();
        };
        reader.readAsDataURL(file);
    });
}

function renderPhotos() {
    const container = document.getElementById('photo-preview-container');
    const addButton = container.querySelector('label');
    container.innerHTML = '';
    container.appendChild(addButton);

    state.photos.forEach((photo, index) => {
        const div = document.createElement('div');
        div.className = "relative aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm";
        div.innerHTML = `
            <img src="${photo}" class="w-full h-full object-cover">
            <button onclick="removePhoto(${index})" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                <i data-lucide="x" class="w-3 h-3"></i>
            </button>`;
        container.appendChild(div);
    });
    lucide.createIcons();
}

function removePhoto(index) {
    state.photos.splice(index, 1);
    renderPhotos();
}

// --- LOGIQUE METIER ---
function toggleWindow(id) {
    const btn = document.getElementById('win-' + id);
    if(state.selectedWindows.includes(id)) {
        state.selectedWindows = state.selectedWindows.filter(w => w !== id);
        btn.classList.remove('selected');
    } else {
        state.selectedWindows.push(id);
        btn.classList.add('selected');
    }
}

function addToBatch() {
    const vin = document.getElementById('vin-input').value;
    if(!vin && state.selectedWindows.length === 0) return alert("Remplissez le VIN ou cochez une vitre.");

    state.batch.push({
        vin: vin || "SANS VIN",
        type: document.querySelector('input[name="type"]:checked').value,
        obs: document.getElementById('obs').value,
        windows: [...state.selectedWindows],
        photos: [...state.photos],
        signature: state.signature,
        date: new Date().toLocaleString('fr-FR')
    });

    // Reset UI
    document.getElementById('vin-input').value = "";
    document.getElementById('obs').value = "";
    document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('selected'));
    state.selectedWindows = []; state.photos = []; resetSignature();
    renderPhotos();
    updateBatchUI();
    alert("Véhicule ajouté au lot !");
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
    const counter = document.getElementById('sent-counter');
    const list = document.getElementById('sent-list');
    if(counter) counter.innerText = `${state.sentHistory.length} ENVOYÉS`;
    
    if (state.sentHistory.length === 0) {
        list.innerHTML = '<p class="text-center py-6 text-slate-400 text-[10px]">Aucun envoi effectué</p>';
        return;
    }

    list.innerHTML = state.sentHistory.map((item) => `
        <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 mb-2">
            <div class="flex justify-between items-start">
                <span class="font-black text-[11px] text-indigo-600 dark:text-indigo-400">${item.vin}</span>
                <span class="text-[8px] font-bold opacity-50">${item.sentTime}</span>
            </div>
            <div class="text-[9px] text-slate-500 uppercase font-bold">${item.type} • ${item.windowsCount} vitres</div>
        </div>
    `).reverse().join('');
}

// --- FONCTION D'ENVOI FINAL ---
async function finalize() {
    if(!state.batch.length) return alert("Le lot est vide !");
    
    const btn = document.getElementById('btn-final');
    btn.disabled = true;
    btn.innerHTML = "<span>TRANSMISSION...</span>";
    
    const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwf2GH4-Fj2Ags-0d-eNkUonx0pZVZLX72VnEiiSl7knUOWHXb3WXMqBHagQsbaTrM9/exec';

    // On prépare les données proprement
    const blob = new Blob([JSON.stringify({ interventions: state.batch })], { type: 'application/json' });

    try {
        // Technique BEACON : Conçue pour envoyer des données même si on ferme l'appli
        // C'est la méthode la plus fiable sur mobile
        const success = navigator.sendBeacon(GOOGLE_URL, blob);

        if (success) {
            const now = new Date().toLocaleTimeString('fr-FR');
            state.batch.forEach(v => state.sentHistory.push({ vin: v.vin, sentTime: now }));
            
            state.batch = [];
            updateBatchUI();
            updateHistoryUI();
            
            alert("✅ ENVOI RÉUSSI !\nLes données sont en route vers Google Sheets.");
        } else {
            // Si le Beacon échoue, on tente un dernier Fetch classique
            await fetch(GOOGLE_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ interventions: state.batch })
            });
            alert("✅ ENVOI EFFECTUÉ (via Fetch)");
            state.batch = [];
            updateBatchUI();
        }
    } catch(e) {
        alert("⚠️ Problème de réseau. Vérifiez votre 4G/5G.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = "<span>Finaliser l'envoi</span>";
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    document.getElementById('dark-icon').setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons();
}
