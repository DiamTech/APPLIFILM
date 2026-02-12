let state = { vin: "", selectedWindows: [], photos: [], batch: [], signature: null };
let scanner;
let canvas, ctx, drawing = false;

// --- INITIALISATION ---
window.addEventListener('DOMContentLoaded', () => {
    initSignature();
    lucide.createIcons();
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 500);
        }
    }, 1200);
});

// --- SCANNER VIN (Correction) ---
async function startScanner() {
    const readerDiv = document.getElementById('reader');
    readerDiv.classList.toggle('hidden');
    
    if (readerDiv.classList.contains('hidden')) {
        if(scanner) await scanner.stop();
        return;
    }

    scanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    try {
        await scanner.start({ facingMode: "environment" }, config, (text) => {
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

function initSignature() {
    canvas = document.getElementById('canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    // Force la taille du dessin à correspondre à l'affichage écran
    const fixSize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        // On doit redéfinir les styles après un changement de taille
        ctx.strokeStyle = "#4f46e5"; 
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    };

    // On attend un peu que la modale soit affichée pour calculer la taille
    window.addEventListener('resize', fixSize);
    setTimeout(fixSize, 100);

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const ev = e.touches ? e.touches[0] : e;
        return {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top
        };
    };

    const start = (e) => {
        // Empêche la page de bouger pendant qu'on signe
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

    const stop = () => {
        drawing = false;
    };

    // Événements Souris
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    
    // Événements Tactiles (Mobile)
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', stop);
}

function openSignature() {
    document.getElementById('modal-sig').classList.remove('hidden');
    // On laisse 50ms à la modale pour apparaître puis on ajuste le canvas
    setTimeout(() => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.strokeStyle = "#4f46e5";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
    }, 50);
}
function closeSignature() { document.getElementById('modal-sig').classList.add('hidden'); }
function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

function saveSignature() {
    // Vérifier si le canvas est vide (optionnel)
    state.signature = canvas.toDataURL();
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

// --- LOGIQUE MÉTIER ---
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

function handlePhotos(input) {
    Array.from(input.files).forEach(f => {
        const r = new FileReader();
        r.onload = (e) => state.photos.push(e.target.result);
        r.readAsDataURL(f);
    });
    setTimeout(() => {
        document.getElementById('photo-count').innerText = state.photos.length;
    }, 500);
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
        sig: state.signature,
        date: new Date().toLocaleTimeString('fr-FR')
    });

    // Reset
    document.getElementById('vin-input').value = "";
    document.getElementById('obs').value = "";
    document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('selected'));
    state.selectedWindows = []; state.photos = []; resetSignature();
    document.getElementById('photo-count').innerText = "0";
    updateBatchUI();
    alert("Véhicule ajouté au lot !");
}

function updateBatchUI() {
    document.getElementById('batch-counter').innerText = `${state.batch.length} lot(s)`;
    const list = document.getElementById('batch-list');
    list.innerHTML = state.batch.map((item, i) => `
        <div class="flex justify-between items-center p-3 mb-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700">
            <div class="flex flex-col">
                <span class="font-black text-indigo-600 text-[10px]">${item.vin}</span>
                <span class="text-[8px] text-slate-400 uppercase">${item.type} • ${item.windows.length} vitres</span>
            </div>
            <button onclick="state.batch.splice(${i},1); updateBatchUI()" class="text-red-400 p-2">✕</button>
        </div>
    `).join('') || '<p class="text-center text-slate-400 py-4">Aucun lot en attente</p>';
}

function toggleHistoryMenu() { 
    document.getElementById('history-menu').classList.toggle('hidden'); 
}

async function finalize() {
    if(!state.batch.length) return alert("Le lot est vide !");
    const btn = document.getElementById('btn-final');
    btn.disabled = true;
    btn.innerHTML = `<span>ENVOI EN COURS...</span>`;
    
    try {
        // Remplace par ton URL Google Script /exec
        await fetch('https://script.google.com/macros/s/AKfycbybQoN5JD72b3o3KlePS3ZCFtr2nL5TJJizmnGGLxZopWAQFwB9aPiJZGSWYMmIxwSX/exec', {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ interventions: state.batch })
        });
        alert("TERMINÉ ! Toutes les données sont sur Google Drive.");
        state.batch = [];
        updateBatchUI();
    } catch(e) {
        alert("Erreur de connexion. Vérifiez votre 4G/5G.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>FINALISER L'ENVOI</span><i data-lucide="send" class="w-5 h-5"></i>`;
        lucide.createIcons();
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    document.getElementById('dark-icon').setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons();
}
