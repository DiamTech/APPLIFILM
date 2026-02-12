// --- 1. ÉTAT DE L'APPLICATION ---
let state = JSON.parse(localStorage.getItem('scannerState')) || {
    batch: [],
    signature: null
};

let selectedWindows = [];
let signaturePad = null;
let history = JSON.parse(localStorage.getItem('scannerHistory')) || [];

// --- 2. INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
    initSignaturePad();
    renderBatch();
    
    // Si une signature existait déjà, on affiche le bouton poubelle
    if (state.signature) {
        updateSignatureUI(true);
    }
});

window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 700); // Temps pour la transition de fondu
    }, 1500); // Temps d'affichage du logo (1.5 seconde)
});

// On ajoute un tableau d'images dans l'état actuel
state.photos = [];

function handlePhotos(input) {
    const files = Array.from(input.files);
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target.result;
            state.photos.push(base64Image);
            renderPhotos();
        };
        reader.readAsDataURL(file);
    });
}

function renderPhotos() {
    const container = document.getElementById('photo-preview-container');
    // On garde seulement le premier élément (le bouton +)
    const addButton = container.firstElementChild;
    container.innerHTML = '';
    container.appendChild(addButton);

    state.photos.forEach((photo, index) => {
        const div = document.createElement('div');
        div.className = "relative aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-sm animate-in";
        div.innerHTML = `
            <img src="${photo}" class="w-full h-full object-cover">
            <button onclick="removePhoto(${index})" class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-lg">
                <i data-lucide="x" class="w-3 h-3"></i>
            </button>
        `;
        container.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
}

function removePhoto(index) {
    state.photos.splice(index, 1);
    renderPhotos();
}

function toggleHistory() {
    const sidebar = document.getElementById('history-sidebar');
    const overlay = document.getElementById('history-overlay');
    const isOpened = !sidebar.classList.contains('translate-x-full');

    if (isOpened) {
        // Fermer
        sidebar.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    } else {
        // Ouvrir
        renderHistory(); // On rafraîchit la liste
        sidebar.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
    }
}

function toggleDarkMode() {
    const html = document.documentElement;
    const icon = document.getElementById('dark-icon');
    
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        icon.setAttribute('data-lucide', 'moon');
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        icon.setAttribute('data-lucide', 'sun');
        localStorage.setItem('theme', 'dark');
    }
    // Met à jour l'icône Lucide
    if (window.lucide) lucide.createIcons();
}

// Au chargement, vérifier la préférence sauvegardée
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
        document.getElementById('dark-icon').setAttribute('data-lucide', 'sun');
        if (window.lucide) lucide.createIcons();
    }
});

// Modifie renderHistory pour mettre à jour le petit point rouge dans le header
function renderHistory() {
    const container = document.getElementById('history-container');
    const dot = document.getElementById('hist-dot');
    container.innerHTML = "";

    if (history.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-40 text-slate-400 italic text-xs">Aucun envoi archivé</div>`;
        dot.classList.add('hidden');
        return;
    }

    dot.classList.remove('hidden');

    history.forEach((v) => {
        const div = document.createElement('div');
        div.className = "bg-white border border-slate-200 rounded-xl p-3 shadow-sm";
        div.innerHTML = `
            <div class="flex justify-between items-start mb-1">
                <span class="font-mono text-[11px] font-bold text-indigo-600">${v.vin}</span>
                <span class="text-[9px] text-slate-400">${v.timestamp.split(' ')[0]}</span>
            </div>
            <div class="text-[10px] text-slate-600 font-semibold mb-1 italic">Note : ${v.obs}</div>
            <div class="flex flex-wrap gap-1">
                <span class="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded uppercase font-bold text-slate-500">${v.type}</span>
                ${v.windows.slice(0, 3).map(w => `<span class="text-[8px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded">${w}</span>`).join('')}
                ${v.windows.length > 3 ? `<span class="text-[8px] text-slate-300">...</span>` : ''}
            </div>
        `;
        container.appendChild(div); // Plus récent en haut déjà géré par l'ordre du tableau
    });
    if (window.lucide) lucide.createIcons();
}

function saveState() {
    localStorage.setItem('scannerState', JSON.stringify(state));
}

let html5QrCode;

function startScan() {
    const reader = document.getElementById('reader');
    reader.classList.remove('hidden'); // On montre la zone caméra

    html5QrCode = new Html5Qrcode("reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    html5QrCode.start(
        { facingMode: "environment" }, // Caméra arrière
        config,
        (decodedText) => {
            // Quand le VIN est détecté :
            document.getElementById('vin-input').value = decodedText;
            stopScan();
            showModal("Succès", "Code détecté : " + decodedText, "success");
        },
        (errorMessage) => { /* On ignore les erreurs de lecture continue */ }
    ).catch(err => {
        showModal("Erreur", "Impossible d'ouvrir la caméra.", "info");
    });
}

function stopScan() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader').classList.add('hidden');
        });
    }
}

// --- 3. GESTION DES MODALES (FENÊTRES CUSTOM) ---
function showModal(title, text, type = 'info') {
    const modal = document.getElementById('custom-modal');
    const iconDiv = document.getElementById('modal-icon');
    
    if(!modal) return alert(title + " : " + text); // Sécurité si HTML manquant

    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;
    
    if(type === 'success') {
        iconDiv.className = "w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4";
        iconDiv.innerHTML = '<i data-lucide="check-circle-2"></i>';
    } else {
        iconDiv.className = "w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4";
        iconDiv.innerHTML = '<i data-lucide="info"></i>';
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
}

function closeModal() {
    document.getElementById('custom-modal').classList.add('hidden');
    document.getElementById('custom-modal').classList.remove('flex');
}

// --- 4. GESTION DU PLAN DES VITRES ---
function toggleWindow(windowId) {
    const btn = document.getElementById(`win-${windowId}`);
    if (selectedWindows.includes(windowId)) {
        selectedWindows = selectedWindows.filter(id => id !== windowId);
        btn.classList.remove('selected');
    } else {
        selectedWindows.push(windowId);
        btn.classList.add('selected');
    }
}

// --- 5. AJOUT AU LOT ---
function addToBatch() {
    const vin = document.getElementById('vin-input').value.trim();
    const typeInter = document.querySelector('input[name="type_inter"]:checked').value;
    const obs = document.getElementById('observation-input').value;

    // 1. On vérifie qu'il y a au moins un VIN ou une vitre sélectionnée
    if (!vin && state.selectedWindows.length === 0) {
        showModal('Erreur', 'Veuillez saisir un VIN ou sélectionner des vitres.', 'error');
        return;
    }

    // 2. ON CRÉE L'ENTRÉE AVEC LES PHOTOS
    const entry = {
        id: Date.now(),
        vin: vin || "NON SPÉCIFIÉ",
        type: typeInter,
        windows: [...state.selectedWindows],
        observations: obs,
        photos: [...state.photos], // <--- ON AJOUTE LES PHOTOS ICI
        date: new Date().toLocaleString()
    };

    // 3. On ajoute à la liste globale
    state.batch.push(entry);

    // 4. ON RÉINITIALISE TOUT POUR LE PROCHAIN SCAN
    state.selectedWindows = [];
    state.photos = []; // On vide les photos stockées
    document.getElementById('observation-input').value = '';
    document.getElementById('vin-input').value = '';
    
    // On met à jour l'affichage
    renderBatch();
    renderPhotos(); // Pour vider les miniatures à l'écran
    updateBatchCount();
    
    // On remet les boutons des vitres en blanc
    document.querySelectorAll('.window-btn').forEach(btn => btn.classList.remove('selected'));
    
    showModal('Ajouté !', 'L\'intervention a été ajoutée au lot.', 'success');
}
function renderBatch() {
    const container = document.getElementById('batch-container');
    document.getElementById('batch-count').innerText = state.batch.length;
    container.innerHTML = "";

    state.batch.forEach((v, index) => {
        const div = document.createElement('div');
        div.className = "bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2";
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <span class="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase">${v.type}</span>
                    <h3 class="font-mono font-bold text-slate-800 mt-1">${v.vin}</h3>
                </div>
                <button onclick="removeItem(${index})" class="text-slate-300 hover:text-red-500 p-1">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="flex flex-wrap gap-1">
                ${v.windows.map(w => `<span class="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">${w}</span>`).join('')}
            </div>
            <div class="text-[11px] text-slate-500 italic mt-1 border-t pt-2 italic">
                Note : ${v.obs}
            </div>
        `;
        container.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
}

function removeItem(index) {
    state.batch.splice(index, 1);
    saveState();
    renderBatch();
}

// --- 6. SIGNATURE ---
function initSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let writing = false;

    // Ajuster taille canvas
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e) => { writing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if(!writing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
    const stop = () => { writing = false; };

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start);
    canvas.addEventListener('touchmove', move);
    canvas.addEventListener('touchend', stop);
}

function openSignature() {
    const overlay = document.getElementById('signature-overlay');
    overlay.style.display = 'flex';
    
    // Indispensable : Redonner la bonne taille au canvas quand il devient visible
    const canvas = document.getElementById('signature-pad');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Relancer l'initialisation pour s'assurer que le pinceau suit le doigt
    initSignaturePad(); 
}

function clearSignature() {
    const canvas = document.getElementById('signature-pad');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function closeSignature() {
    const canvas = document.getElementById('signature-pad');
    state.signature = canvas.toDataURL();
    saveState();
    document.getElementById('signature-overlay').style.display = 'none';
    updateSignatureUI(true);
    showModal("Signature", "Signature enregistrée avec succès !", "success");
}

function resetSignature() {
    state.signature = null;
    saveState();
    updateSignatureUI(false);
    showModal("Supprimé", "La signature a été effacée.");
}

function updateSignatureUI(isSigned) {
    const btnSign = document.getElementById('btn-open-sign');
    const btnClear = document.getElementById('btn-clear-sign');
    
    if (isSigned) {
        btnSign.classList.replace('bg-amber-500', 'bg-green-600');
        btnSign.innerHTML = '<i data-lucide="check"></i> SIGNATURE ENREGISTRÉE';
        btnClear.classList.remove('hidden');
    } else {
        btnSign.classList.replace('bg-green-600', 'bg-amber-500');
        btnSign.innerHTML = '<i data-lucide="pen-tool"></i> SIGNER LE BON';
        btnClear.classList.add('hidden');
    }
    if (window.lucide) lucide.createIcons();
}

// --- 7. ENVOI FINAL ---
https://script.google.com/macros/s/AKfycbybQoN5JD72b3o3KlePS3ZCFtr2nL5TJJizmnGGLxZopWAQFwB9aPiJZGSWYMmIxwSX/exec
