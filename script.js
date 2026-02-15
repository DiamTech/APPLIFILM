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
const URL_PRET = "https://script.google.com/macros/s/AKfycbxh3j0nkQxdO0oTQ5bORE25XwcjlZpUQ_5Fgd0a_utXPuFrkxE0VVp0j2VSmMOAxgXH6w/exec";

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

    // 1. On vérifie seulement le VIN et les Vitres
    if (!vinValue) { 
        alert("⚠️ Le numéro VIN est OBLIGATOIRE."); 
        return vinInput.focus(); 
    }
    if (state.selectedWindows.length === 0) {
        return alert("⚠️ Sélectionnez au moins une vitre.");
    }
    
    // 2. On récupère l'heure pour ton rectangle récapitulatif
    const now = new Date();
    const heureSaisie = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

    // 3. On ajoute au lot (SANS signature pour l'instant)
    state.batch.push({
        vin: vinValue,
        type: document.querySelector('input[name="type"]:checked').value,
        obs: document.getElementById('obs').value,
        windows: state.selectedWindows.map(w => `${w.id} (${w.tint})`), 
        photos: [...state.photos],
        heure: heureSaisie,
        date: now.toLocaleString('fr-FR')
    });
    
    // 4. RESET du formulaire (mais on NE TOUCHE PAS à la signature)
    vinInput.value = ""; 
    document.getElementById('obs').value = "";
    state.selectedWindows = []; 
    state.photos = []; 
    
    // 5. MAJ visuelle
    renderPhotos(); 
    renderVitraux(); 
    updateBatchUI(); 
    
    alert("✅ Véhicule ajouté au lot !");
}

function updateBatchUI() { 
    const counter = document.getElementById('batch-counter');
    const recapContainer = document.getElementById('batch-recap-container');
    const sigSection = document.getElementById('signature-section-vitrage');

    if(counter) counter.innerText = `${state.batch.length} VÉHICULE(S) EN ATTENTE`; 

    if (sigSection) {
        if (state.batch.length > 0) sigSection.classList.remove('hidden');
        else sigSection.classList.add('hidden');
    }

    if (recapContainer) {
        recapContainer.innerHTML = state.batch.map((item, index) => `
            <div class="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-start justify-between mb-3 overflow-hidden">
                <div class="flex-1 pr-4"> 
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-widest">${item.heure}</span>
                        <span class="text-[8px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded uppercase tracking-widest">${item.type}</span>
                    </div>
                    <div class="text-sm font-black text-slate-900 uppercase mb-2">${item.vin}</div>
                    <div class="text-[10px] text-slate-400 font-bold italic leading-relaxed break-words">
                        ${item.windows.join(' • ')}
                    </div>
                </div>
                
                <button onclick="removeFromBatch(${index})" 
                        class="btn-icon w-10 h-10 flex-shrink-0 flex items-center justify-center bg-red-50 text-red-500 rounded-2xl active:scale-95 transition-all mt-1">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `).join('');
    }

    if (window.lucide) lucide.createIcons();
}

// Fonction pour supprimer un véhicule du lot avant l'envoi
function removeFromBatch(index) {
    if (confirm("Supprimer ce véhicule du lot ?")) {
        state.batch.splice(index, 1);
        updateBatchUI();
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
    // On récupère l'élément de la vue Prêt pour savoir si elle est affichée
    const vPret = document.getElementById('view-pret');
    const isPretVisible = vPret && !vPret.classList.contains('hidden');

    // SÉCURITÉ : On ne bloque QUE si on est sur la page de PRÊT
    if (isPretVisible) {
        if (!state.pret || !state.pret.inspectionValidated) {
            return alert("⚠️ Bloqué : Vous devez d'abord cliquer sur 'Confirmer l'état' de la carrosserie !");
        }
    }

    // Si on est en Vitrage (ou que l'inspection prêt est validée), on ouvre
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
    
    // 2. Retour visuel pour le module PRÊT
    const sigBtnPret = document.querySelector('#signature-section button');
    if (sigBtnPret) {
        sigBtnPret.innerHTML = '<span>✅ SIGNATURE ENREGISTRÉE</span>';
        sigBtnPret.className = "w-full bg-green-500 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-green-200";
    }

    // 3. Retour visuel pour le module VITRAGE (si tu as un indicateur là-bas)
    const sigStatusVitrage = document.getElementById('sig-status'); // L'ID dans ta vue vitrage
    if (sigStatusVitrage) sigStatusVitrage.classList.remove('hidden'); 
    
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

function updateHistoryUI() {
    const list = document.getElementById('sent-list');
    if(!list) return;
    list.innerHTML = state.sentHistory.length === 0 ? '<p class="text-center py-6 text-[10px] opacity-50 uppercase">Aucun envoi</p>' : 
    state.sentHistory.map(item => `<div class="p-3 border-b border-slate-100 dark:border-slate-700"><div class="flex justify-between text-[10px] font-black"><span class="text-indigo-500">${item.vin}</span><span>${item.sentTime}</span></div></div>`).reverse().join('');
}

async function finalize() {
    // 1. Vérification si le lot n'est pas vide
    if(!state.batch.length) return alert("Le lot est vide !");
    
    // 2. VERROU : On vérifie si la signature a été faite avant d'autoriser l'envoi
    if(!state.signature) {
        return alert("⚠️ La signature du client est obligatoire pour valider l'ensemble du lot !");
    }

    const btn = document.getElementById('btn-final');
    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = "<span>ENVOI DU LOT...</span>";
    
    // 3. INJECTION DE LA SIGNATURE : On attache la signature à chaque véhicule
    const finalBatch = state.batch.map(item => ({
        ...item,
        signature: state.signature
    }));

    try {
        // Envoi du lot complet avec la signature unique
        await fetch(URL_VITRAGE, {
            method: 'POST', 
            mode: 'no-cors', 
            cache: 'no-cache',
            body: JSON.stringify({ interventions: finalBatch })
        });

        // 4. Mise à jour de l'historique local
        const now = new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
        state.batch.forEach(v => { 
            state.sentHistory.push({ vin: v.vin, sentTime: now }); 
        });

        // 5. Vidage du lot et de la signature
        state.batch = [];
        state.signature = null; // Très important pour ne pas réutiliser la signature pour le lot suivant
        
        updateBatchUI(); 
        updateHistoryUI();
        resetSignature(); // Nettoie le visuel du bouton de signature
        
        alert("✅ TERMINÉ ! Le lot de " + finalBatch.length + " véhicule(s) a été transmis.");
        
    } catch(e) {
        console.error(e);
        alert("❌ Erreur de connexion lors de l'envoi du lot.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

async function finalizePret() {
    const btn = document.getElementById('btn-final-pret');
    
    // 1. RÉCUPÉRATION DES DONNÉES DE BASE
    const selectVehicule = document.getElementById('pret-vehicule-select');
    const fullSelectValue = selectVehicule ? selectVehicule.value : ""; // "Citroen C3 : DC-580-DS"

    // --- NOUVEAU : DÉCOUPAGE MODÈLE ET PLAQUE ---
    let modeleExtraite = "Véhicule";
    let plaqueAuto = "";

    if (fullSelectValue.includes(':')) {
        const parts = fullSelectValue.split(':');
        modeleExtraite = parts[0].trim();
        plaqueAuto = parts[1].trim();
    } else {
        plaqueAuto = fullSelectValue;
    }

    const kmSaisi = parseInt(document.getElementById('pret-km-depart')?.value) || 0;

    const inputs = {
        nom: document.getElementById('pret-nom')?.value.trim(),
        dob: document.getElementById('pret-dob')?.value,
        lieu_naiss: document.getElementById('pret-lieu-naiss')?.value.trim(),
        permis_num: document.getElementById('pret-permis-num')?.value.trim(),
        permis_lieu: document.getElementById('pret-permis-lieu')?.value.trim()
    };

    // 2. VÉRIFICATIONS DE SÉCURITÉ
    if (!plaqueAuto || plaqueAuto === "N/C" || plaqueAuto === "-- Choisir un véhicule --") {
        return alert("⚠️ Veuillez choisir un véhicule !");
    }
    if (!kmSaisi || kmSaisi <= 0) return alert("⚠️ Veuillez saisir le kilométrage !");
    if (!state.signature) return alert("⚠️ La signature du client est obligatoire !");
    if (!state.pret.inspectionValidated) return alert("⚠️ Vous devez valider l'inspection (bouton Confirmer) !");

    if (state.pretMode === "DEPART") {
        if (!inputs.nom || !inputs.dob || !inputs.permis_num) {
            return alert("⚠️ Infos client incomplètes pour un départ !");
        }
        if (!state.pret.permis_recto) return alert("⚠️ Photo du permis obligatoire au départ !");
    }

    // 3. LOGIQUE POUR LES DÉGÂTS ET CALCUL KM
    let texteSaisi = document.getElementById('pret-degats-obs')?.value.trim() || "";
    const nbCroix = state.pret.damages ? state.pret.damages.length : 0;
    
    let degatsFinalText = texteSaisi;
    if (texteSaisi === "") {
        degatsFinalText = nbCroix > 0 
            ? "Dégâts marqués sur le schéma (" + nbCroix + " impact(s))" 
            : "Aucun dégât signalé (Véhicule intact)";
    }

    let kmInfoMessage = "";
    if (state.pretMode === "RETOUR" && state.pret.km_depart_initial) {
        const diff = kmSaisi - state.pret.km_depart_initial;
        degatsFinalText += ` | KM départ: ${state.pret.km_depart_initial} | Parcouru: ${diff}km`;
        kmInfoMessage = `\nDistance parcourue : ${diff} km`;
    }

    // 4. PRÉPARATION DU PAQUET (PAYLOAD)
    const payload = {
        type: "PRET",
        status: state.pretMode, 
        immat: plaqueAuto,      // Va en colonne B
        modele: modeleExtraite, // VA EN COLONNE O (C'est ce qui manquait !)
        km: kmSaisi,
        nom: inputs.nom,
        dob: inputs.dob,
        lieu_naiss: inputs.lieu_naiss,
        permis_num: inputs.permis_num,
        permis_lieu: inputs.permis_lieu,
        degats_details: degatsFinalText,
        degats_coords: JSON.stringify(state.pret.damages || []), 
        permis_recto: state.pret.permis_recto || "N/A",
        permis_verso: state.pret.permis_verso || "N/A",
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

        alert(`✅ ${state.pretMode} ENREGISTRÉ !${kmInfoMessage}`);
        
        // 6. RÉINITIALISATION COMPLÈTE
        resetPretForm(); 
        switchView('vitrage');

    } catch(e) {
        console.error(e);
        alert("❌ Erreur lors de l'envoi.");
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
    if (sigSection) {
        sigSection.classList.remove('opacity-30', 'pointer-events-none');
    }
    
    // UI du bouton : ON LE DÉSACTIVE après validation
    const btn = document.getElementById('btn-lock-inspection');
    if (btn) {
        btn.innerHTML = "✅ INSPECTION TERMINÉE";
        // On remplace les classes de couleur
        btn.classList.remove('bg-slate-100', 'text-slate-600', 'border-slate-200');
        btn.classList.add('bg-green-100', 'text-green-600', 'border-green-200');
        btn.disabled = true; // Verrouillé tant qu'on ne reset pas
    }

    alert("Inspection validée. Vous pouvez maintenant faire signer le client.");
}

// On définit le mode par défaut
state.pretMode = 'DEPART'; 

function setPretMode(mode) {
    state.pretMode = mode;
    const isDepart = mode === 'DEPART';
    
    const btnDepart = document.getElementById('btn-mode-depart');
    const btnRetour = document.getElementById('btn-mode-retour');
    const btnFinal = document.getElementById('btn-final-pret');
    const title = document.querySelector('#view-pret h2');

    // On définit les classes de base (communes aux deux)
    const baseClass = "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-200 ";

    if (isDepart) {
        // --- STYLE DÉPART ---
        // Bouton gauche actif (Blanc sur Indigo)
        btnDepart.className = baseClass + "bg-indigo-600 text-white shadow-md shadow-indigo-100";
        // Bouton droite inactif (Gris discret)
        btnRetour.className = baseClass + "bg-transparent text-slate-400";
        
        // Bouton final en bas
        btnFinal.className = "w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 mt-6";
        btnFinal.innerHTML = '<span>Valider le départ</span> <i data-lucide="check" class="w-4 h-4"></i>';
        
        if (title) title.innerText = "Nouveau Prêt";
        document.getElementById('active-loans-list').classList.add('hidden');
        resetPretForm(); 
    } else {
        // --- STYLE RETOUR ---
        // Bouton droite actif (Blanc sur Vert/Emeraude)
        btnRetour.className = baseClass + "bg-emerald-500 text-white shadow-md shadow-emerald-100";
        // Bouton gauche inactif (Gris discret)
        btnDepart.className = baseClass + "bg-transparent text-slate-400";
        
        // Bouton final en bas
        btnFinal.className = "w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 mt-6";
        btnFinal.innerHTML = '<span>Enregistrer le retour</span> <i data-lucide="log-in" class="w-4 h-4"></i>';
        
        if (title) title.innerText = "Retour de Véhicule";
        document.getElementById('active-loans-list').classList.remove('hidden');
        
        fetchActiveLoans();
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function fetchActiveLoans() {
    const container = document.getElementById('loans-container');
    container.innerHTML = '<div class="text-[10px] font-bold text-center py-4 text-slate-400 animate-pulse">CHARGEMENT DES PRÊTS...</div>';

    try {
        const response = await fetch(URL_PRET + "?action=get_active");
        const loans = await response.json();
        
        // IMPORTANT : On sauvegarde la liste dans le state pour pouvoir cliquer dessus après
        state.activeLoans = loans;

        if (!loans || loans.length === 0) {
            container.innerHTML = '<div class="text-[10px] font-bold text-center py-4 text-slate-400 italic">AUCUN VÉHICULE DEHORS</div>';
            return;
        }

        container.innerHTML = loans.map(loan => {
            const d = new Date(loan.date);
            const datePropre = d.toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'});
        
            // On récupère le KM, s'il n'existe pas on met 0
            const kmAffichage = loan.km || "0";
            
            // LOGIQUE TITRE : Si on a un modèle on le met, sinon on met la plaque en gros
            const titrePrincipal = loan.modele && loan.modele !== "Véhicule" ? loan.modele : loan.immat;
            const sousTitre = loan.modele && loan.modele !== "Véhicule" ? loan.immat : "";
        
            return `
                <button type="button" onclick="selectLoanForReturn('${loan.immat}')" 
                        class="w-full bg-indigo-600 p-5 rounded-[2rem] text-left shadow-lg mb-3 flex flex-col gap-6 active:scale-95 transition-all">
                    
                    <div class="flex justify-between items-start">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-indigo-200 uppercase tracking-widest">MODÈLE</span>
                            <span class="font-black text-white text-xl leading-tight">${titrePrincipal}</span>
                            <span class="text-[11px] font-bold text-indigo-200 opacity-80">${sousTitre}</span>
                        </div>
                        <span class="text-[11px] font-black bg-black text-white px-3 py-1.5 rounded-xl">
                            ${datePropre}
                        </span>
                    </div>
        
                    <div class="flex justify-between items-end">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-indigo-200 uppercase tracking-widest">CLIENT</span>
                            <span class="text-sm font-bold text-white uppercase tracking-wide">${loan.nom}</span>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] font-black text-indigo-200 uppercase tracking-widest block">COMPTEUR</span>
                            <span class="text-sm font-black text-white">${kmAffichage} KM</span>
                        </div>
                    </div>
                </button>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="text-[10px] font-bold text-center py-4 text-red-400 uppercase">⚠️ Erreur de connexion</div>';
    }
}

function resetPretForm() {
    // 1. Remise à zéro du State
    state.signature = null;
    state.pret = {
        damages: [],
        inspectionValidated: false,
        km_depart_initial: null,
        permis_recto: null,
        permis_verso: null
    };

    // 2. Vidage des champs texte et inputs
    const fields = ["pret-nom", "pret-dob", "pret-lieu-naiss", "pret-permis-num", "pret-permis-lieu", "pret-degats-obs", "pret-km-depart"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // 3. Reset du menu déroulant véhicule
    const select = document.getElementById('pret-vehicule-select');
    if (select) select.value = "";

    // 4. Reset visuel (Croix, Signature, Photos)
    document.getElementById('crosses-overlay').innerHTML = "";
    
    const sigBtn = document.querySelector('#signature-section button');
    if (sigBtn) {
        sigBtn.innerHTML = "Faire signer le client";
        sigBtn.className = "w-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 py-4 rounded-2xl font-black text-xs uppercase border-2 border-dashed border-indigo-200";
    }
    
    const sigStatus = document.getElementById('pret-sig-ok');
    if (sigStatus) sigStatus.classList.add('hidden');

    // Verrouiller à nouveau la zone de signature
    const sigSection = document.getElementById('signature-section');
    if (sigSection) sigSection.classList.add('opacity-30', 'pointer-events-none');

    // Reset bouton inspection
    const lockBtn = document.getElementById('btn-lock-inspection');
    if (lockBtn) {
        lockBtn.innerHTML = "Confirmer l'état";
        lockBtn.className = "w-full mt-2 py-3 bg-slate-100 dark:bg-slate-900 text-[10px] font-black uppercase rounded-xl text-slate-500";
    }

    // Reset des previews photos
    if (document.getElementById('preview-recto')) document.getElementById('preview-recto').innerHTML = '<i data-lucide="camera" class="w-5 h-5 text-slate-400"></i><span class="text-[8px] mt-1 text-slate-400 font-bold uppercase">Recto</span>';
    if (document.getElementById('preview-verso')) document.getElementById('preview-verso').innerHTML = '<i data-lucide="camera" class="w-5 h-5 text-slate-400"></i><span class="text-[8px] mt-1 text-slate-400 font-bold uppercase">Verso</span>';

    // Relancer Lucide pour les icônes
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function selectLoanForReturn(immat) {
    const loan = state.activeLoans.find(l => l.immat === immat);
    if (!loan) return alert("❌ Dossier introuvable.");

    // A. MODE RETOUR ET VERROUILLAGE
    state.pretMode = 'RETOUR';
    toggleFormLock(true); 

    // B. REMPLISSAGE IDENTITÉ
    document.getElementById('pret-vehicule-select').value = loan.immat;
    document.getElementById('pret-nom').value = loan.nom || "";
    document.getElementById('pret-lieu-naiss').value = loan.lieu_naiss || "";
    document.getElementById('pret-permis-num').value = loan.permis_num || "";
    document.getElementById('pret-permis-lieu').value = loan.permis_lieu || "";
    
    if (loan.dob) {
        const d = new Date(loan.dob);
        if (!isNaN(d)) {
            document.getElementById('pret-dob').value = d.toISOString().split('T')[0];
        }
    }

    // C. CHAMPS ÉDITABLES
    state.pret.km_depart_initial = parseInt(loan.km) || 0;
    const kmInput = document.getElementById('pret-km-depart');
    if(kmInput) {
        kmInput.placeholder = "Départ : " + loan.km + " km";
        kmInput.value = ""; 
    }
    
    const renderPhoto = (id, url) => {
    const zone = document.getElementById(id);
    if (!zone) return;

    if (url && url.length > 10) {
        let fileId = "";
        try {
            if (url.includes('id=')) fileId = url.split('id=')[1].split('&')[0];
            else if (url.includes('/d/')) fileId = url.split('/d/')[1].split('/')[0];
            else fileId = url.match(/[-\w]{25,}/);
        } catch(e) {}

        const finalUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : url;

        zone.innerHTML = `
            <img src="${finalUrl}" 
                 referrerpolicy="no-referrer" 
                 onclick="openFullscreen('${finalUrl}')" 
                 class="w-full h-full object-cover rounded-xl border-2 border-indigo-500 shadow-lg cursor-zoom-in">
            <div class="absolute bottom-1 right-1 bg-black/50 rounded-full p-1">
                <i data-lucide="maximize" class="w-2 h-2 text-white"></i>
            </div>
        `;
        
        // --- CHANGEMENT ICI ---
        zone.style.pointerEvents = "auto"; // On autorise le clic pour la loupe
        zone.style.border = "none";
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        zone.innerHTML = `<div class="text-[10px] text-slate-500 font-bold italic">AUCUN DOCUMENT</div>`;
    }
};
    
    renderPhoto('preview-recto', loan.recto);
    renderPhoto('preview-verso', loan.verso);

    // E. RÉCUPÉRATION DES DÉGÂTS
    try {
        const savedCoords = loan.degats_coords || loan.coords; 
        const oldCoords = JSON.parse(savedCoords || "[]");
        state.pret.damages = oldCoords.map(c => ({ ...c, type: 'old' }));
        renderDamages(); 
    } catch(e) {
        state.pret.damages = [];
    }

    // F. OBSERVATIONS
    const obsField = document.getElementById('pret-degats-obs');
    if (obsField) {
        obsField.value = "PRÉCÉDEMMENT : " + (loan.details || "RAS") + "\n--- NOTES RETOUR ---\n";
    }

    if (typeof switchView === 'function') switchView('pret');
    alert("✅ Dossier chargé. Photos du permis affichées.");
}

function resetPretForm() {
    state.pretMode = 'DEPART';
    toggleFormLock(false); // On déverrouille tout

    // On recrée les zones d'upload avec leurs icônes et leurs inputs
    const resetZone = (id, label) => {
        const zone = document.getElementById(id);
        if (!zone) return;
        
        zone.style.pointerEvents = "auto";
        zone.style.border = "2px dashed #e2e8f0";
        zone.innerHTML = `
            <input type="file" accept="image/*" capture="environment" class="hidden" onchange="handlePhoto(this, '${id}')">
            <i data-lucide="camera" class="w-5 h-5 text-slate-400"></i>
            <span class="text-[8px] mt-1 text-slate-400 font-bold uppercase">${label}</span>
        `;
    };

    resetZone('preview-recto', 'Recto');
    resetZone('preview-verso', 'Verso');

    // On vide les champs texte
    const fields = ['pret-nom', 'pret-dob', 'pret-lieu-naiss', 'pret-permis-num', 'pret-permis-lieu', 'pret-km-depart', 'pret-degats-obs'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // On vide les croix
    state.pret.damages = [];
    renderDamages();

    // Relancer les icônes Lucide
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderDamages() {
    const overlay = document.getElementById('crosses-overlay');
    if (!overlay) return;

    overlay.innerHTML = state.pret.damages.map(d => {
        // Si c'est 'old', on met en gris. Sinon (nouveau clic), en rouge.
        const isOld = d.type === 'old';
        const color = isOld ? '#94a3b8' : '#ef4444'; 
        const size = isOld ? '16px' : '22px';

        return `
            <div style="position: absolute; left: ${d.x}%; top: ${d.y}%; 
                transform: translate(-50%, -50%); color: ${color}; 
                font-weight: 900; font-size: ${size}; pointer-events: none;">X</div>
        `;
    }).join('');
}

function addDamage(event) {
    if (state.pret.inspectionValidated) return;
    const container = document.getElementById('damage-container');
    const rect = container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    // IMPORTANT : On marque les nouveaux clics comme 'new'
    state.pret.damages.push({ x, y, type: 'new' });
    renderDamages();
}

function toggleFormLock(isReturn) {
    const fieldsToLock = ['pret-vehicule-select', 'pret-nom', 'pret-dob', 'pret-lieu-naiss', 'pret-permis-num', 'pret-permis-lieu'];
    
    fieldsToLock.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'SELECT') el.disabled = isReturn;
            else el.readOnly = isReturn;
            
            // On force les couleurs pour éviter le blanc sur blanc
            if (isReturn) {
                el.style.setProperty('background-color', '#e2e8f0', 'important'); // Gris clair
                el.style.setProperty('color', '#0f172a', 'important');            // Noir Ardoise
                el.style.setProperty('font-weight', '800', 'important');          // Texte Gras
            } else {
                el.style.backgroundColor = "";
                el.style.color = "";
                el.style.fontWeight = "";
            }
        }
    });

    // Blocage des inputs fichiers
    document.querySelectorAll('input[type="file"]').forEach(input => {
        input.disabled = isReturn;
    });
}

function resetDamages() {
    // 1. GESTION DU MESSAGE (Avec alerte signature)
    let msg = "Voulez-vous vraiment effacer les points de carrosserie ?";
    if (state.signature) {
        msg = "⚠️ ATTENTION : Cela supprimera aussi la signature. Il faudra refaire signer le client. Continuer ?";
    }

    if (!confirm(msg)) return;

    // 2. RÉINITIALISATION DES DONNÉES
    if (state.pretMode === 'DEPART') {
        state.pret.damages = [];
    } else {
        // Mode RETOUR : On garde les anciens (gris)
        state.pret.damages = state.pret.damages.filter(d => d.type === 'old');
    }

    // On libère les verrous
    state.pret.inspectionValidated = false;
    state.signature = null; // On efface la signature

    // 3. RÉACTIVATION DU BOUTON (La correction est ici !)
    const btnLock = document.getElementById('btn-lock-inspection');
    if (btnLock) {
        btnLock.disabled = false; // ON RÉACTIVE LE CLIC
        btnLock.innerText = "Confirmer l'inspection";
        // On remet le style gris d'origine
        btnLock.className = "w-full mt-4 bg-slate-100 text-slate-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 border-slate-200 active:scale-95 transition-all";
    }

    // 4. RESET VISUEL DE LA SIGNATURE
    const sigSection = document.getElementById('signature-section');
    const sigOkMsg = document.getElementById('pret-sig-ok'); // Si tu as un message "Signature OK"
    
    if (sigSection) {
        sigSection.classList.add('opacity-30', 'pointer-events-none');
    }
    if (sigOkMsg) {
        sigOkMsg.classList.add('hidden');
    }
    
    // Si tu as un canvas de signature, on le vide aussi
    if (typeof resetSignaturePret === "function") resetSignaturePret();

    renderDamages();
    alert("🧹 Reset effectué. L'inspection est déverrouillée.");
}

function openFullscreen(url) {
    const overlay = document.getElementById('fullscreen-overlay');
    const img = document.getElementById('fullscreen-img');
    if (overlay && img) {
        img.src = url;
        overlay.classList.remove('hidden');
    }
}

async function handleSave() {
    if (state.pretMode === 'RETOUR') {
        await saveReturn(); // La logique pour fermer le dossier
    } else {
        await saveNewLoan(); // Ta logique actuelle pour créer un prêt
    }
}

async function saveReturn() {
    const immat = document.getElementById('pret-vehicule-select').value;
    const kmRetour = parseInt(document.getElementById('pret-km-depart').value);
    const kmDepart = state.pret.km_depart_initial;

    // 1. Validation de sécurité
    if (isNaN(kmRetour) || kmRetour < kmDepart) {
        return alert(`⚠️ Erreur KM : Le retour (${kmRetour}) ne peut pas être inférieur au départ (${kmDepart}) !`);
    }

    // On prépare les données
    const payload = {
        action: 'FINALIZE_RETURN',
        immat: immat,
        km_retour: kmRetour,
        carburant_retour: document.getElementById('pret-carburant').value,
        details_retour: document.getElementById('pret-degats-obs').value,
        // On envoie TOUS les dégâts (les anciens gris + les nouveaux rouges)
        degats_finaux: JSON.stringify(state.pret.damages), 
        date_retour: new Date().toLocaleString('fr-FR')
    };

    try {
        showLoading(true); // Si tu as un indicateur de chargement
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const res = await response.json();
        if (res.status === 'success') {
            alert("✅ Retour enregistré. Le véhicule est de nouveau disponible.");
            resetPretForm();
            switchView('home');
        }
    } catch (e) {
        alert("❌ Erreur de connexion au serveur.");
    } finally {
        showLoading(false);
    }
}

// On écoute le changement de sélection du véhicule
document.getElementById('pret-vehicule-select').addEventListener('change', async function(e) {
    const immat = e.target.value;
    
    // On ne récupère l'historique QUE si on est en mode DEPART (pas en retour)
    if (!immat || state.pretMode !== 'DEPART') return;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'GET_LAST_STATE', 
                immat: immat 
            })
        });
        
        const res = await response.json();

        if (res.status === "success") {
            // 1. On parse les coordonnées récupérées
            const lastCoords = JSON.parse(res.coords || "[]");
            
            // 2. On les injecte en tant que "new" pour qu'elles soient ROUGES 
            // et éffaçables comme des nouveaux points
            state.pret.damages = lastCoords.map(c => ({
                x: c.x,
                y: c.y,
                type: 'new' // 'new' les rend rouges et interactives
            }));
            
            // 3. On remplit le kilométrage et les observations
            const kmInput = document.getElementById('pret-km-depart');
            if (kmInput) kmInput.value = res.km || "";
            
            const obsInput = document.getElementById('pret-degats-obs');
            if (obsInput) obsInput.value = res.details || "";
            
            // 4. On rafraîchit le dessin de la voiture
            renderDamages();
            
            alert("✅ État du véhicule " + immat + " chargé (Dégâts en rouge).");
        } else {
            // Si c'est un nouveau véhicule ou sans historique, on vide tout
            state.pret.damages = [];
            renderDamages();
        }
    } catch (err) {
        console.error("Erreur lors de la récupération :", err);
    }
});

setTimeout(() => setVehicle('VOITURE'), 200);
