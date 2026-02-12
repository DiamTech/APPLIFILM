// --- ETAT GLOBAL DE L'APPLICATION ---
let state = { 
    vin: "", 
    selectedWindows: [], 
    photos: [], 
    batch: [], 
    signature: null,
    sentHistory: [],
    // AJOUTE BIEN CES LIGNES :
    activeLoans: [], 
    dailyHistory: [],
    pret: { 
        permis_recto: null, 
        permis_verso: null,
        damages: [], // <--- INDISPENSABLE pour stocker les croix
        inspectionValidated: false,
        photos_depart: [] // Même si tu n'as pas de bouton, laisse-le pour éviter l'erreur
    },
    vehiculeType: 'VOITURE'
};

// Mets tes vraies URLs ici
const URL_VITRAGE = "https://script.google.com/macros/s/AKfycbyl-hYWhxxK8-1jLGxHC_QNFgrVFZtbUv69Ozr2hMAdqWz2iQvP5oG92Div0LbG-L5x/exec";
const URL_PRET = "https://script.google.com/macros/s/AKfycbzTjhaJrlV4iPLuGmcX5zFjqizv1GQdXXgzQzDX26e8I1Tb3w9yPtWBLpYjJiG0zVJTsQ/exec";

let scanner, canvas, ctx, drawing = false;

// --- INITIALISATION AU CHARGEMENT ---
window.addEventListener('load', () => {
    setTimeout(() => {
        initSignature();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 600);
        }
        
        // On force l'affichage voiture
        setVehicle('VOITURE');
    }, 100);
});

// --- NAVIGATION ENTRE LES PAGES ---
function switchView(view) {
    // 1. On ferme le menu
    if (typeof toggleMenu === 'function') toggleMenu(false);

    // 2. Les IDs exacts de ton HTML
    const vVitrage = document.getElementById('view-vitrage'); 
    const vPret = document.getElementById('view-pret');
    const vHistory = document.getElementById('view-history');

    // 3. On cache TOUT
    if(vVitrage) vVitrage.classList.add('hidden');
    if(vPret) vPret.classList.add('hidden');
    if(vHistory) vHistory.classList.add('hidden');

    // 4. On affiche la bonne page
    if (view === 'pret') {
        if(vPret) vPret.classList.remove('hidden');
    } else if (view === 'history') {
        if(vHistory) vHistory.classList.remove('hidden');
    } else {
        if(vVitrage) vVitrage.classList.remove('hidden');
    }
}
// ==========================================
// --- MODULE PRÊT DE VÉHICULE ---
// ==========================================

// 1. Gestion des photos Permis (Recto/Verso)
function handlePermis(input, type) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        // Sécurité : on vérifie que l'objet pret existe
        if (!state.pret) state.pret = {};

        // On assigne l'image (ICI PAS DE .PUSH)
        if (type === 'recto') state.pret.permis_recto = e.target.result;
        else state.pret.permis_verso = e.target.result;

        // Affichage miniature
        const targetId = type === 'recto' ? 'preview-recto' : 'preview-verso';
        const container = document.getElementById(targetId);
        if (container) {
            container.innerHTML = `<img src="${e.target.result}" class="absolute inset-0 w-full h-full object-cover rounded-2xl">`;
        }
    };
    reader.readAsDataURL(file);
}
// 2. Valider le départ (Fonction du bouton "Valider le départ")
function savePret() {
    try {
        // Récupération sécurisée des champs
        const getVal = (id) => {
            const el = document.getElementById(id);
            if (!el) throw new Error("Champ introuvable dans le HTML : " + id);
            return el.value;
        };

        const data = {
            nom: getVal('pret-nom'),
            dob: getVal('pret-dob'),
            lieu: getVal('pret-lieu-naiss'),
            permis: getVal('pret-permis-num'),
            permis_lieu: getVal('pret-permis-lieu'),
            vehicule: getVal('pret-vehicule-select'),
            km: getVal('pret-km-depart'),
            fuel: getVal('pret-carburant'),
            date: new Date().toLocaleString('fr-FR')
        };

        // VÉRIFICATIONS (Si ça bloque ici, une alerte s'affiche)
        if(!state.pret.permis_recto || !state.pret.permis_verso) return alert("⚠️ IL MANQUE LES PHOTOS DU PERMIS (Recto & Verso) !");
        if(!data.nom) return alert("⚠️ Le NOM du client est obligatoire.");
        if(!data.vehicule) return alert("⚠️ Choisissez un VÉHICULE dans la liste.");
        if(!data.km) return alert("⚠️ Le KM de départ est obligatoire.");
        if(!state.signature) return alert("⚠️ Le client doit SIGNER avant de partir.");

        // AJOUT AU LOT (Pour l'envoi Google Sheet)
        state.batch.push({
            vin: "PRET: " + data.vehicule.split(':')[1].trim(), // On garde juste la plaque
            type: "PRÊT VÉHICULE",
            obs: `CLIENT: ${data.nom} | NÉ LE: ${data.dob} à ${data.lieu} | PERMIS: ${data.permis} (${data.permis_lieu}) | DÉPART: ${data.km} KM | CARBURANT: ${data.fuel}`,
            windows: [`Véhicule: ${data.vehicule.split(':')[0]}`], 
            photos: [state.pret.permis_recto, state.pret.permis_verso],
            signature: state.signature,
            date: data.date
        });

        // SAUVEGARDE EN MÉMOIRE (Pour le retrouver au retour)
        state.activeLoans.push(data);
        localStorage.setItem('activeLoans', JSON.stringify(state.activeLoans));

        // RESET DU FORMULAIRE
        document.getElementById('pret-nom').value = "";
        document.getElementById('pret-km-depart').value = "";
        document.getElementById('pret-dob').value = "";
        document.getElementById('pret-lieu-naiss').value = "";
        document.getElementById('pret-permis-num').value = "";
        document.getElementById('pret-permis-lieu').value = "";
        document.getElementById('pret-carburant').value = "";
        document.getElementById('pret-vehicule-select').value = "";
        
        // Reset des photos (visuel)
        state.pret.permis_recto = null;
        state.pret.permis_verso = null;
        // On pourrait reset les classes CSS ici, mais l'utilisateur verra que c'est vidé

        resetSignature();
        updateBatchUI();
        
        alert("✅ DÉPART VALIDÉ ! Le prêt est ajouté au lot d'envoi.");
        switchView('vitrage'); // Retour à l'accueil

    } catch (error) {
        alert("ERREUR TECHNIQUE : " + error.message + "\n\nVérifiez que vous avez bien copié le dernier code HTML !");
    }
}

// 3. Gestion du Retour Véhicule
function returnVehicle(index) {
    const loan = state.activeLoans[index];
    const kmRetour = prompt(`RETOUR ${loan.vehicule}\nDépart: ${loan.km} km\n\nEntrez le kilométrage de retour :`);
    
    if(kmRetour) {
        const total = parseInt(kmRetour) - parseInt(loan.km);
        const fuelRetour = prompt("Niveau Carburant retour ?", "Identique");
        
        state.batch.push({
            vin: "RETOUR: " + loan.vehicule.split(':')[1].trim(),
            type: "RETOUR PRÊT",
            obs: `CLIENT: ${loan.nom} | RETOUR: ${kmRetour} KM | TOTAL PARCOURU: ${total} KM | CARBURANT: ${fuelRetour}`,
            windows: [`Total: ${total} km`],
            photos: [], 
            signature: null, 
            date: new Date().toLocaleString('fr-FR')
        });

        // Supprimer de la mémoire
        state.activeLoans.splice(index, 1);
        localStorage.setItem('activeLoans', JSON.stringify(state.activeLoans));
        
        renderActiveLoans();
        updateBatchUI();
        alert(`✅ Retour enregistré (${total} km). Pensez à finaliser l'envoi.`);
    }
}

// 4. Affichage de la liste des véhicules sortis
function renderActiveLoans() {
    const list = document.getElementById('active-loans-list');
    if(!list) return;

    if(state.activeLoans.length === 0) {
        list.innerHTML = '<div class="text-center text-xs text-slate-300 italic py-4">Aucun véhicule sorti</div>';
        return;
    }

    list.innerHTML = state.activeLoans.map((l, i) => `
        <div onclick="returnVehicle(${i})" class="bg-indigo-50 dark:bg-slate-900 p-4 rounded-2xl border border-indigo-100 dark:border-slate-700 flex justify-between items-center cursor-pointer active:scale-95 transition-transform mb-2 shadow-sm">
            <div>
                <div class="font-black text-xs text-indigo-600">${l.vehicule}</div>
                <div class="text-[10px] text-slate-500 font-bold uppercase mt-1">${l.nom}</div>
            </div>
            <div class="text-right">
                <div class="text-xs font-bold text-slate-700 dark:text-slate-300">${l.km} km</div>
                <div class="text-[9px] text-slate-400">Sorti le ${l.date.split(' ')[0]}</div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// --- FONCTIONS STANDARDS (VITRAGE & AUTRES) ---
// ==========================================

function addToBatch() {
    const vinInput = document.getElementById('vin-input');
    const vinValue = vinInput.value.trim();

    if (!vinValue) { alert("⚠️ Le numéro VIN est OBLIGATOIRE."); return vinInput.focus(); }
    if (state.selectedWindows.length === 0) return alert("⚠️ Sélectionnez au moins une vitre.");
    if (!state.signature) return alert("⚠️ La signature est OBLIGATOIRE.");
    
    state.batch.push({
        vin: vinValue,
        type: document.querySelector('input[name="type"]:checked').value,
        obs: document.getElementById('obs').value,
        windows: state.selectedWindows.map(w => `${w.id} (${w.tint})`), 
        photos: [...state.photos],
        signature: state.signature,
        date: new Date().toLocaleString('fr-FR')
    });
    
    // Reset
    vinInput.value = ""; document.getElementById('obs').value = "";
    state.selectedWindows = []; state.photos = []; 
    resetSignature(); renderPhotos(); renderVitraux(); updateBatchUI();
    alert("✅ Véhicule vitrage ajouté au lot !");
}

function updateBatchUI() { 
    const counter = document.getElementById('batch-counter');
    if(counter) counter.innerText = `${state.batch.length} EN ATTENTE`; 
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
                <div><div class="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">${item.type}</div><div class="text-lg font-bold text-slate-800 dark:text-white">${item.vin}</div></div>
                <div class="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg">${item.sentTime}</div>
            </div>
            <div class="space-y-2"><div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl text-xs text-slate-600 dark:text-slate-300"><strong class="block text-[9px] uppercase text-slate-400 mb-1">Détails</strong>${item.windows.join(', ')}</div>${item.obs ? `<div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl text-xs text-slate-600 dark:text-slate-300"><strong class="block text-[9px] uppercase text-slate-400 mb-1">Obs / Infos</strong>${item.obs}</div>` : ''}</div>
            <div class="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700"><div class="flex -space-x-2">${item.photos.map(() => `<div class="w-6 h-6 rounded-full bg-slate-200 border-2 border-white dark:border-slate-800"></div>`).join('')}</div><div class="text-[10px] font-bold text-slate-400">${item.photos.length} Photo(s) • Signature OK</div></div>
        </div>
    `).reverse().join('');
}

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
                    const photoVIN = canvasPhoto.toDataURL('image/jpeg', 0.7);
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
    // SÉCURITÉ : On bloque si l'inspection carrosserie n'est pas confirmée
    if (!state.pret || !state.pret.inspectionValidated) {
        return alert("⚠️ Bloqué : Vous devez d'abord cliquer sur 'Confirmer l'état' de la carrosserie !");
    }

    const modal = document.getElementById('modal-sig');
    if (modal) modal.classList.remove('hidden'); 
    
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
    const modal = document.getElementById('modal-sig');
    if (modal) modal.classList.add('hidden'); 
}

function saveSignature() { 
    // 1. Sauvegarde dans le state
    state.signature = canvas.toDataURL('image/png'); 
    
    // 2. Retour visuel sur le bouton (on change le texte et la couleur)
    const sigBtn = document.querySelector('#signature-section button');
    const sigStatus = document.getElementById('pret-sig-ok');

    if (sigBtn) {
        sigBtn.innerHTML = '<span>✅ SIGNATURE ENREGISTRÉE</span>';
        sigBtn.className = "w-full bg-green-500 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-green-200";
    }

    if (sigStatus) sigStatus.classList.remove('hidden'); 
    
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
    btn.innerHTML = id;
    closeTintModal();
}

// --- LA FONCTION SECURISÉE ---
function addToBatch() {
    const vinInput = document.getElementById('vin-input');
    const vin = vinInput.value.trim();

    // 1. VERROU VIN
    if (!vin) {
        alert("⚠️ Le VIN est obligatoire !");
        vinInput.focus();
        return;
    }

    // 2. VERROU VITRES
    if (state.selectedWindows.length === 0) {
        alert("⚠️ Veuillez sélectionner au moins une vitre.");
        return;
    }

    // 3. VERROU SIGNATURE
    if (!state.signature) {
        alert("⚠️ La signature est obligatoire pour valider.");
        return;
    }
    
    state.batch.push({
        vin: vin,
        type: document.querySelector('input[name="type"]:checked').value,
        obs: document.getElementById('obs').value,
        windows: state.selectedWindows.map(w => `${w.id} (${w.tint})`), 
        photos: [...state.photos],
        signature: state.signature,
        date: new Date().toLocaleString('fr-FR')
    });
    
    // Reset complet
    vinInput.value = ""; 
    document.getElementById('obs').value = "";
    document.querySelectorAll('.window-btn').forEach(b => {
        b.classList.remove('selected');
        // On remet le texte d'origine (ID)
        const originalId = b.id.replace('win-', '');
        b.innerHTML = `<div>${originalId}</div>`;
    });
    state.selectedWindows = []; 
    state.photos = []; 
    resetSignature(); 
    renderPhotos(); 
    updateBatchUI();
    alert("✅ Véhicule ajouté au lot !");
}

function updateBatchUI() { 
    const counter = document.getElementById('batch-counter');
    if(counter) counter.innerText = `${state.batch.length} EN ATTENTE`; 
}

function toggleHistoryMenu() { document.getElementById('history-menu').classList.toggle('hidden'); updateHistoryUI(); }

function updateHistoryUI() {
    const list = document.getElementById('sent-list');
    if(!list) return;
    list.innerHTML = state.sentHistory.length === 0 ? '<p class="text-center py-6 text-[10px] opacity-50 uppercase">Aucun envoi</p>' : 
    state.sentHistory.map(item => `<div class="p-3 border-b border-slate-100 dark:border-slate-700"><div class="flex justify-between text-[10px] font-black"><span class="text-indigo-500">${item.vin}</span><span>${item.sentTime}</span></div></div>`).reverse().join('');
}

async function finalize() {
    // 1. Vérification si le lot n'est pas vide
    if(!state.batch.length) return alert("Le lot est vide !");
    
    const btn = document.getElementById('btn-final');
    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = "<span>ENVOI EN COURS...</span>";
    
    try {
        // On utilise l'URL spécifique au Sheet VITRAGE
        await fetch(URL_VITRAGE, {
            method: 'POST', 
            mode: 'no-cors', 
            cache: 'no-cache',
            body: JSON.stringify({ interventions: state.batch })
        });

        // 2. Mise à jour de l'historique local après succès
        const now = new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
        state.batch.forEach(v => { 
            state.sentHistory.push({ vin: v.vin, sentTime: now }); 
        });

        // 3. Vidage du lot et mise à jour de l'interface
        state.batch = [];
        updateBatchUI(); 
        updateHistoryUI();
        
        alert("✅ TERMINÉ ! Données Vitrage transmises.");
        
    } catch(e) {
        console.error(e);
        alert("❌ Erreur de connexion lors de l'envoi Vitrage.");
    } finally {
        // 4. Remise en état du bouton
        btn.disabled = false;
        btn.innerHTML = originalContent;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

async function finalizePret() {
    const btn = document.getElementById('btn-final-pret');
    
    // 1. RÉCUPÉRATION DES DONNÉES
    const selectVehicule = document.getElementById('pret-vehicule-select');
    const plaqueAuto = selectVehicule ? selectVehicule.value : "";

    const inputs = {
        nom: document.getElementById('pret-nom')?.value.trim(),
        dob: document.getElementById('pret-dob')?.value,
        lieu_naiss: document.getElementById('pret-lieu-naiss')?.value.trim(),
        permis_num: document.getElementById('pret-permis-num')?.value.trim(),
        permis_lieu: document.getElementById('pret-permis-lieu')?.value.trim()
    };

    // 2. VÉRIFICATION DES CHAMPS OBLIGATOIRES (Le "Sauf si")
    if (!plaqueAuto || plaqueAuto === "N/C") return alert("⚠️ Veuillez choisir un véhicule !");
    if (!inputs.nom) return alert("⚠️ Le nom du client est obligatoire !");
    if (!inputs.dob) return alert("⚠️ La date de naissance est obligatoire !");
    if (!inputs.lieu_naiss) return alert("⚠️ Le lieu de naissance est obligatoire !");
    if (!inputs.permis_num) return alert("⚠️ Le numéro de permis est obligatoire !");
    if (!inputs.permis_lieu) return alert("⚠️ Le lieu de délivrance du permis est obligatoire !");
    
    // VÉRIFICATION DES DOCUMENTS (Photos & Signature)
    if (!state.pret.permis_recto) return alert("⚠️ La photo du permis (Recto) est obligatoire !");
    if (!state.signature) return alert("⚠️ La signature du client est obligatoire !");
    if (!state.pret.inspectionValidated) return alert("⚠️ Vous devez valider l'inspection (bouton Confirmer) avant d'envoyer !");

    // 3. LOGIQUE POUR LES DÉGÂTS (Facultatif)
    let texteSaisi = document.getElementById('pret-degats-obs')?.value.trim() || "";
    const nbCroix = state.pret.damages ? state.pret.damages.length : 0;
    
    let degatsFinalText = texteSaisi;
    if (texteSaisi === "") {
        degatsFinalText = nbCroix > 0 
            ? "Dégâts marqués sur le schéma (" + nbCroix + " impact(s))" 
            : "Aucun dégât signalé (Véhicule intact)";
    }

    // 4. PRÉPARATION DU PAQUET (PAYLOAD)
        const payload = {
        // --- L'AIGUILLAGE ---
        type: "PRET",
        status: state.pretMode, // Enverra "DEPART" ou "RETOUR" (défini par tes boutons du haut)
        
        // --- LES INFOS VÉHICULE ---
        immat: plaqueAuto,
        km: document.getElementById('pret-km')?.value || "0", // On récupère les KM
        
        // --- LE CLIENT ---
        nom: inputs.nom,
        dob: inputs.dob,
        lieu_naiss: inputs.lieu_naiss,
        permis_num: inputs.permis_num,
        permis_lieu: inputs.permis_lieu,
        
        // --- L'ÉTAT DES LIEUX ---
        degats_details: degatsFinalText,
        degats_coords: JSON.stringify(state.pret.damages || []), 
        
        // --- LES DOCUMENTS ---
        permis_recto: state.pret.permis_recto,
        permis_verso: state.pret.permis_verso || "Non fournie",
        signature: state.signature,
        date: new Date().toLocaleString('fr-FR')
    };
    // 5. ENVOI AU SHEET
    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "TRANSMISSION...";

    try {
        await fetch(URL_PRET, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });

        alert("✅ DOSSIER COMPLET ! Le prêt pour " + plaqueAuto + " a été enregistré.");
        
        // 6. RÉINITIALISATION COMPLÈTE
        resetPretForm(); // On appelle une petite fonction de nettoyage
        switchView('vitrage');

    } catch(e) {
        alert("❌ Erreur réseau. Vérifiez votre connexion.");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// Petite fonction pour tout vider proprement
function resetPretForm() {
    state.signature = null;
    state.pret.damages = [];
    state.pret.inspectionValidated = false;
    state.pret.permis_recto = null;
    state.pret.permis_verso = null;

    ["pret-nom", "pret-dob", "pret-lieu-naiss", "pret-permis-num", "pret-permis-lieu", "pret-degats-obs"].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = "";
    });
    
    const sel = document.getElementById('pret-vehicule-select');
    if(sel) sel.value = "";
    
    document.getElementById('crosses-overlay').innerHTML = "";
    // Remise à zéro des aperçus photos (si tu as les IDs)
    if(document.getElementById('preview-recto')) document.getElementById('preview-recto').innerHTML = '<i data-lucide="camera" class="w-5 h-5 text-slate-400"></i>';
    if(document.getElementById('preview-verso')) document.getElementById('preview-verso').innerHTML = '<i data-lucide="camera" class="w-5 h-5 text-slate-400"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
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
    
    if (!menu || !overlay || !panel) return; // Sécurité si les éléments manquent

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
    VDL: {
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
    }
};

function setVehicle(type) {
    state.vehiculeType = type;
    ['VOITURE', 'FOURGON', 'VDL'].forEach(t => {
        const btn = document.getElementById('tab-' + t);
        if(btn) {
            btn.classList.toggle('opacity-50', t !== type);
            btn.classList.toggle('bg-white', t === type);
        }
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

// On complète le state au début du fichier
state.pret.damages = [];
state.pret.inspectionValidated = false;

function addDamage(event) {
    if (state.pret.inspectionValidated) return; // Empêche de modifier après validation

    const container = document.getElementById('damage-container');
    const rect = container.getBoundingClientRect();
    
    // Calcul de la position en % pour que ce soit responsive
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    // Ajouter au state
    state.pret.damages.push({ x, y });
    
    renderDamages();
}

function renderDamages() {
    const overlay = document.getElementById('crosses-overlay');
    overlay.innerHTML = state.pret.damages.map((d, index) => `
        <div style="position: absolute; left: ${d.x}%; top: ${d.y}%; transform: translate(-50%, -50%); color: #ef4444; font-weight: bold; font-size: 20px; text-shadow: 0 0 3px white;">
            X
        </div>
    `).join('');
}

function validateInspection() {
    const obs = document.getElementById('pret-degats-obs').value;
    
    if (state.pret.damages.length === 0 && !confirm("Aucun dégât marqué. Confirmer que le véhicule est intact ?")) {
        return;
    }

    state.pret.inspectionValidated = true;
    state.pret.damage_obs = obs;

    // Débloquer la signature
    const sigSection = document.getElementById('signature-section');
    sigSection.classList.remove('opacity-30', 'pointer-events-none');
    
    // UI du bouton
    const btn = document.getElementById('btn-lock-inspection');
    btn.innerHTML = "✅ INSPECTION TERMINÉE";
    btn.classList.replace('bg-slate-100', 'bg-green-100');
    btn.classList.replace('text-slate-600', 'text-green-600');
    btn.disabled = true;

    alert("Inspection validée. Vous pouvez maintenant faire signer le client.");
}

// On définit le mode par défaut
state.pretMode = 'DEPART'; 

function setPretMode(mode) {
    state.pretMode = mode;
    const isDepart = mode === 'DEPART';
    
    // 1. Mise à jour visuelle des boutons du haut
    const btnDepart = document.getElementById('btn-mode-depart');
    const btnRetour = document.getElementById('btn-mode-retour');
    const btnFinal = document.getElementById('btn-final-pret');
    const title = document.querySelector('#view-pret h2');

    if (isDepart) {
        btnDepart.className = "flex-1 py-3 rounded-xl font-black text-[10px] uppercase bg-white shadow-sm text-indigo-600";
        btnRetour.className = "flex-1 py-3 rounded-xl font-black text-[10px] uppercase text-slate-500";
        btnFinal.innerHTML = '<span>Valider le départ</span> <i data-lucide="check" class="w-4 h-4"></i>';
        title.innerText = "Nouveau Prêt";
        document.getElementById('active-loans-list').classList.add('hidden');
        resetPretForm(); // On vide tout pour un nouveau prêt
    } else {
        btnRetour.className = "flex-1 py-3 rounded-xl font-black text-[10px] uppercase bg-white shadow-sm text-indigo-600";
        btnDepart.className = "flex-1 py-3 rounded-xl font-black text-[10px] uppercase text-slate-500";
        btnFinal.innerHTML = '<span>Enregistrer le retour</span> <i data-lucide="log-in" class="w-4 h-4"></i>';
        title.innerText = "Retour de Véhicule";
        document.getElementById('active-loans-list').classList.remove('hidden');
        
        // On lance la récupération des véhicules dehors
        fetchActiveLoans();
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function fetchActiveLoans() {
    const container = document.getElementById('loans-container');
    container.innerHTML = '<div class="text-[10px] font-bold text-center py-4 text-slate-400">CHARGEMENT DES PRÊTS...</div>';

    try {
        // IMPORTANT : On demande au sheet de nous donner la liste
        const response = await fetch(URL_PRET + "?action=get_active");
        const loans = await response.json();
        
        if (!loans || loans.length === 0) {
            container.innerHTML = '<div class="text-[10px] font-bold text-center py-4 text-slate-400 italic">AUCUN VÉHICULE DEHORS</div>';
            return;
        }

        container.innerHTML = loans.map(loan => `
            <button type="button" onclick="selectLoanForReturn('${loan.immat}')" class="w-full bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left flex justify-between items-center active:scale-95 transition-all shadow-sm">
                <div>
                    <div class="font-black text-indigo-600 text-sm">${loan.immat}</div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase">${loan.nom}</div>
                </div>
                <div class="text-right">
                    <div class="text-[9px] font-bold text-slate-300">${loan.date}</div>
                    <div class="text-[9px] font-black text-indigo-400 uppercase">${loan.km_depart} KM</div>
                </div>
            </button>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div class="text-[10px] font-bold text-center py-4 text-red-400">ERREUR DE CHARGEMENT</div>';
    }
}

function selectLoanForReturn(immat) {
    // 1. On trouve les infos du prêt dans notre liste locale
    const loan = state.activeLoans.find(l => l.immat === immat);
    if (!loan) return;

    // 2. On remplit les champs automatiquement pour gagner du temps
    document.getElementById('pret-vehicule-select').value = loan.immat;
    document.getElementById('pret-nom').value = loan.nom;
    
    // 3. On stocke le KM de départ pour le calcul plus tard
    state.startKM = parseInt(loan.km);
    
    // 4. ON RÉCUPÈRE LES ANCIENNES CROIX
    // On les affiche par exemple en gris pour les différencier des nouvelles
    state.pret.damages = JSON.parse(loan.degats_coords || "[]");
    renderDamages(true); // Une version de ta fonction qui dessine en gris
    
    // 5. On prévient l'utilisateur
    alert("Prêt chargé ! KM au départ : " + loan.km + ". Marquez les NOUVEAUX dégâts si nécessaire.");
}

setTimeout(() => setVehicle('VOITURE'), 200);
