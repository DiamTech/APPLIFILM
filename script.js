// --- 1. ÉTAT INITIAL ET SYSTÈME ---
let state = JSON.parse(localStorage.getItem('appliFilmState')) || {
    batch: [],
    signature: null,
    editingIndex: null
};

let selectedWindows = [];
let envoiEnCours = false;

// Initialisation des icônes Lucide
window.onload = () => {
    lucide.createIcons();
    renderBatch();
};

function saveState() {
    localStorage.setItem('appliFilmState', JSON.stringify(state));
    const status = document.getElementById('storage-status');
    if(status) {
        status.classList.remove('hidden');
        setTimeout(() => status.classList.add('hidden'), 2000);
    }
}

// --- 2. GESTION DES VITRES ---
function toggleWindow(id, btn) {
    const el = document.getElementById('win-' + id);
    if (!el) return;
    
    const index = selectedWindows.indexOf(id);
    if (index > -1) {
        selectedWindows.splice(index, 1);
        el.classList.remove('selected');
    } else {
        selectedWindows.push(id);
        el.classList.add('selected');
    }
}

function clearWindows() {
    selectedWindows = [];
    document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('selected'));
}

// --- 3. GESTION DU BATCH (VÉHICULES) ---
function addToBatch() {
    const vin = document.getElementById('vin-input').value.trim();
    const type = document.querySelector('input[name="type_inter"]:checked').value;
    const obs = document.getElementById('obs').value;

    if (!vin) return alert("❌ Le VIN est obligatoire.");
    if (selectedWindows.length === 0) return alert("❌ Sélectionnez au moins une vitre.");

    const vehicule = {
        vin: vin,
        type: type,
        windows: [...selectedWindows],
        obs: obs,
        timestamp: new Date().toLocaleString('fr-FR')
    };

    if (state.editingIndex !== null) {
        state.batch[state.editingIndex] = vehicule;
        state.editingIndex = null;
    } else {
        state.batch.push(vehicule);
    }

    saveState();
    clearForm();
    renderBatch();
}

function renderBatch() {
    const container = document.getElementById('batch-container');
    const countEl = document.getElementById('batch-count');
    if (!container) return;

    container.innerHTML = state.batch.map((v, i) => `
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <div class="text-[10px] font-black text-indigo-600 uppercase">${v.type}</div>
                    <div class="font-mono font-bold text-sm">${v.vin}</div>
                </div>
                <button onclick="deleteVehicule(${i})" class="text-red-400 p-1"><i data-lucide="trash-2" size="18"></i></button>
            </div>
            <div class="text-[10px] text-slate-500 font-bold uppercase">${v.windows.join(' • ')}</div>
            ${v.obs ? `<div class="mt-2 text-xs italic text-slate-600">"${v.obs}"</div>` : ''}
        </div>
    `).join('');
    
    if(countEl) countEl.innerText = state.batch.length;
    lucide.createIcons();
}

function deleteVehicule(index) {
    if(confirm("Supprimer ce véhicule ?")) {
        state.batch.splice(index, 1);
        saveState();
        renderBatch();
    }
}

function clearForm() {
    document.getElementById('vin-input').value = "";
    document.getElementById('obs').value = "";
    clearWindows();
}

// --- 4. SIGNATURE ---
function openSignature() {
    document.getElementById('sig-modal').classList.remove('hidden');
    const canvas = document.getElementById('sig-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    let drawing = false;
    canvas.onmousedown = canvas.ontouchstart = (e) => { drawing = true; ctx.beginPath(); };
    canvas.onmousemove = canvas.ontouchmove = (e) => {
        if(!drawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
    };
    canvas.onmouseup = canvas.ontouchend = () => drawing = false;
}

function saveSignature() {
    state.signature = document.getElementById('sig-canvas').toDataURL();
    saveState();
    closeSignature();
    alert("✅ Signature enregistrée.");
}

function closeSignature() { document.getElementById('sig-modal').classList.add('hidden'); }
function clearSig() {
    const canvas = document.getElementById('sig-canvas');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// --- 5. ENVOI FINAL VERS SHEETDB (CORRIGÉ) ---
async function finalize() {
    if (envoiEnCours) return;
    if (state.batch.length === 0) return alert("❌ Ajoutez des véhicules avant d'envoyer.");
    if (!state.signature) return alert("❌ Signature client manquante (bouton Signer).");

    envoiEnCours = true;
    const btn = document.querySelector('button[onclick="finalize()"]');
    btn.disabled = true;
    btn.innerHTML = "⏳ ENVOI EN COURS...";

    try {
        const payload = {
            data: state.batch.map(v => ({
                "Date": v.timestamp,
                "VIN": v.vin.toUpperCase(),
                "Type": v.type,
                "Vitres": v.windows.join(', '),
                "Observations": v.obs || "",
                "Signature": state.signature
            }))
        };

        const response = await fetch('https://sheetdb.io/api/v1/gc2df6w3b42tw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("🚀 ENVOI RÉUSSI ! Le Google Sheet a été mis à jour.");
            state.batch = [];
            state.signature = null;
            saveState();
            location.reload();
        } else {
            alert("❌ Erreur SheetDB. Vérifiez votre quota ou l'URL.");
        }
    } catch (error) {
        alert("❌ Erreur réseau. Vérifiez votre connexion.");
    } finally {
        envoiEnCours = false;
        btn.disabled = false;
        btn.innerHTML = `Envoyer <span id="batch-count" class="bg-white/20 px-2 py-0.5 rounded text-[10px] ml-1">${state.batch.length}</span>`;
    }
}

// --- 6. CAMÉRA (SIMPLIFIÉE) ---
function startCamera() {
    alert("Fonction Caméra/OCR en cours de liaison. Tapez le VIN manuellement pour tester l'envoi.");
}

// --- 6. GESTION DE LA CAMÉRA ET OCR ---
let stream = null;
let ocrInterval = null;

async function startCamera() {
    const overlay = document.getElementById('cam-overlay');
    const video = document.getElementById('hidden-video');
    const canvas = document.getElementById('cam-canvas');
    const status = document.getElementById('cam-status');
    
    overlay.style.display = 'flex';
    status.innerText = "DÉMARRAGE CAMÉRA...";
    status.classList.replace('bg-green-600', 'bg-red-600');

    try {
        // On définit les réglages (les fameuses constraints)
        const mesReglages = {
            video: { 
                facingMode: "environment" // On demande la caméra arrière
            },
            audio: false
        };

        // On demande l'accès avec ces réglages
        stream = await navigator.mediaDevices.getUserMedia(mesReglages);
        
        video.srcObject = stream;
        video.setAttribute("playsinline", true); // Crucial pour iPhone
        video.play();
        
        requestAnimationFrame(() => updateCanvas(video, canvas));
        ocrInterval = setInterval(captureAndScan, 1500);

    } catch (err) {
        console.error("Erreur Caméra:", err);
        // Si ça bloque, on affiche un message clair
        alert("ERREUR : " + err.name + "\nAllez dans les réglages de votre téléphone pour autoriser l'appareil photo.");
        stopCamera();
    }
}

function updateCanvas(video, canvas) {
    if (!stream) return;
    const ctx = canvas.getContext('2d');
    
    // On adapte le canvas à la taille de la vidéo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Dessiner l'image
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    requestAnimationFrame(() => updateCanvas(video, canvas));
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (ocrInterval) {
        clearInterval(ocrInterval);
        ocrInterval = null;
    }
    document.getElementById('cam-overlay').style.display = 'none';
}

// --- 7. L'INTELLIGENCE : LECTURE DU VIN ---
async function captureAndScan() {
    const canvas = document.getElementById('cam-canvas');
    const status = document.getElementById('cam-status');
    
    status.innerText = "ANALYSE DU VIN...";

    try {
        // On utilise Tesseract pour lire le texte sur le canvas
        const result = await Tesseract.recognize(canvas, 'eng', {
            tessedit_char_whitelist: '0123456789ABCDEFGHJKLMNPRSTUVWXYZ'
        });

        const text = result.data.text.replace(/\s+/g, ''); // On enlève les espaces
        console.log("Texte détecté :", text);

        // On cherche un VIN (17 caractères alphanumériques)
        const vinMatch = text.match(/[A-Z0-9]{17}/);

        if (vinMatch) {
            const foundVin = vinMatch[0];
            document.getElementById('vin-input').value = foundVin;
            
            status.innerText = "VIN DÉTECTÉ !";
            status.classList.replace('bg-red-600', 'bg-green-600');

            // Petite vibration de succès
            if (navigator.vibrate) navigator.vibrate(100);

            // On ferme la caméra après 1.5s pour laisser l'utilisateur voir le résultat
            setTimeout(stopCamera, 1500);
        }
    } catch (e) {
        console.error("Erreur OCR:", e);
    }
}

// Optionnel : Forcer la capture si l'OCR galère
function forceCapture() {
    const canvas = document.getElementById('cam-canvas');
    // On pourrait ici enregistrer juste la photo du VIN
    alert("Photo capturée (envoi manuel du VIN requis)");
    stopCamera();
}
