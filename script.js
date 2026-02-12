// --- ETAT GLOBAL DE L'APPLICATION ---
let state = { 
    vin: "", 
    selectedWindows: [], 
    photos: [], 
    batch: [], 
    signature: null,
    sentHistory: [],
    // AJOUTE BIEN CETTE LIGNE CI-DESSOUS :
    pret: { permis_recto: null, permis_verso: null },
    vehiculeType: 'VOITURE'
};

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
    console.log("Bouton cliqué, vue demandée :", view);
    
    // 1. Fermer le menu
    if (typeof toggleMenu === 'function') toggleMenu(false);

    // 2. Récupérer les zones par leurs IDs exacts de ton HTML
    const vVitrage = document.getElementById('view-vitrage'); // Ligne 154 de ton HTML
    const vPret = document.getElementById('view-pret');       // Ligne 174 de ton HTML
    const vHistory = document.getElementById('view-history'); // Si tu l'as ajouté

    // 3. On cache tout par défaut
    if(vVitrage) vVitrage.classList.add('hidden');
    if(vPret) vPret.classList.add('hidden');
    if(vHistory) vHistory.classList.add('hidden');

    // 4. On affiche la zone demandée
    if (view === 'pret') {
        if(vPret) vPret.classList.remove('hidden');
    } else if (view === 'history') {
        if(vHistory) vHistory.classList.remove('hidden');
    } else {
        // Par défaut, on affiche le vitrage
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
        // 1. On enregistre la photo dans l'état
        if (type === 'recto') state.pret.permis_recto = e.target.result;
        if (type === 'verso') state.pret.permis_verso = e.target.result;

        // 2. On affiche la miniature dans le carré correspondant
        const previewId = type === 'recto' ? 'preview-recto' : 'preview-verso';
        const container = document.getElementById(previewId);
        
        if (container) {
            container.innerHTML = `
                <img src="${e.target.result}" class="w-full h-full object-cover rounded-xl">
                <div class="absolute top-1 right-1 bg-green-500 text-white rounded-full p-1">
                    <i data-lucide="check" class="w-3 h-3"></i>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
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

async function finalize() {
    if(!state.batch.length) return alert("Le lot est vide ! Ajoutez d'abord un véhicule.");
    
    const btn = document.getElementById('btn-final');
    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = "<span>ENVOI EN COURS...</span>";
    
    // TON LIEN GOOGLE (Vérifie que c'est bien le dernier déployé)
    const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbx127X1JbcpO4hwYuNzKC9tmBsB51Fi4XnOn4ve65YBnvWsVuq9If5cwJBv0tQ5Rm6t/exec';

    try {
        await fetch(GOOGLE_URL, {
            method: 'POST', 
            mode: 'no-cors', 
            cache: 'no-cache',
            body: JSON.stringify({ interventions: state.batch })
        });
        
        // Mise à jour Historique
        const now = new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
        state.batch.forEach(v => { 
            state.dailyHistory.push({ ...v, sentTime: now });
            state.sentHistory.push({ vin: v.vin, sentTime: now });
        });

        state.batch = [];
        updateBatchUI(); 
        
        if (document.getElementById('view-history') && !document.getElementById('view-history').classList.contains('hidden')) {
            renderDailyHistory();
        }

        alert("✅ TERMINÉ ! Données envoyées et archivées.");

    } catch(e) {
        console.error(e);
        alert("❌ Erreur réseau. Vérifiez votre connexion.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

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
    if(!state.batch.length) return alert("Le lot est vide !");
    const btn = document.getElementById('btn-final');
    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = "<span>ENVOI EN COURS...</span>";
    
    const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbxNU3VrpgcdShsFfG_ETvgpis7x1nJCIQChoUTideIU4pxS1NZgr46hj8xEQiZEdq8y/exec';

    try {
        await fetch(GOOGLE_URL, {
            method: 'POST', mode: 'no-cors', cache: 'no-cache',
            body: JSON.stringify({ interventions: state.batch })
        });
        const now = new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
        state.batch.forEach(v => { state.sentHistory.push({ vin: v.vin, sentTime: now }); });
        state.batch = [];
        updateBatchUI(); updateHistoryUI();
        alert("TERMINÉ ! Données transmises.");
    } catch(e) {
        alert("Erreur de connexion.");
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

setTimeout(() => setVehicle('VOITURE'), 200);
