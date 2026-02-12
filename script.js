// ==========================================
// 1. ÉTAT GLOBAL ET INITIALISATION
// ==========================================
let state = JSON.parse(localStorage.getItem('appliFilmState')) || {
    batch: [],
    signature: null
};

let selectedWindows = [];
let envoiEnCours = false;
let stream = null;
let ocrInterval = null;
let isRequesting = false;

window.onload = () => {
    // Initialisation des icônes Lucide
    if (typeof lucide !== 'undefined') lucide.createIcons();
    renderBatch();
};

function saveState() {
    localStorage.setItem('appliFilmState', JSON.stringify(state));
}

// ==========================================
// 2. GESTION DES VITRES (SÉLECTION)
// ==========================================
function toggleWindow(id) {
    const btn = document.getElementById('win-' + id);
    const index = selectedWindows.indexOf(id);
    
    if (index > -1) {
        selectedWindows.splice(index, 1);
        if(btn) {
            btn.classList.remove('selected', 'bg-indigo-600', 'text-white');
            btn.classList.add('bg-white', 'text-slate-600');
        }
    } else {
        selectedWindows.push(id);
        if(btn) {
            btn.classList.add('selected', 'bg-indigo-600', 'text-white');
            btn.classList.remove('bg-white', 'text-slate-600');
        }
    }
}

// ==========================================
// 3. LOGIQUE DU LOT (AJOUTER / AFFICHER)
// ==========================================
function addToBatch() {
    const vinInput = document.getElementById('vin-input');
    const obsInput = document.getElementById('observation-input'); // Assure-toi que cette ligne est là
    const vin = vinInput.value.trim();

    if (!vin) return showModal("Oups !", "Merci de scanner ou taper un VIN.", "info");
    if (selectedWindows.length === 0) return showModal("Plan vide", "Tu dois sélectionner au moins une vitre.", "info");

    const typeInter = document.querySelector('input[name="type_inter"]:checked').value;

    state.batch.push({
        vin: vin.toUpperCase(),
        windows: [...selectedWindows],
        type: typeInter,
        timestamp: new Date().toLocaleString('fr-FR'),
        // On récupère la valeur du champ ou "RAS" si c'est vide
        obs: (obsInput && obsInput.value.trim()) ? obsInput.value.trim() : "RAS" 
    });

    saveState();
    renderBatch();

    // Reset des champs
    vinInput.value = "";
    if(obsInput) obsInput.value = ""; // On vide le champ après l'ajout
    selectedWindows = [];
    document.querySelectorAll('.window-btn').forEach(btn => btn.classList.remove('selected'));
    
    showModal("Ajouté !", "Le véhicule a bien été ajouté au lot.", "success");
}

function renderBatch() {
    const container = document.getElementById('batch-container');
    const countBadge = document.getElementById('batch-count');
    countBadge.innerText = state.batch.length;
    container.innerHTML = "";

    state.batch.forEach((v, index) => {
        const div = document.createElement('div');
        div.className = "bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300";
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
                ${v.windows.map(w => `<span class="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">${w}</span>`).join('')}
            </div>

            <div class="text-[11px] text-slate-500 italic mt-1 border-t pt-2 flex items-center gap-1">
                <i data-lucide="message-square" class="w-3 h-3"></i>
                ${v.obs}
            </div>
        `;
        container.appendChild(div);
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function removeItem(index) {
    state.batch.splice(index, 1);
    saveState();
    renderBatch();
}

// ==========================================
// 4. MOTEUR DE SCAN (BARCODE + OCR)
// ==========================================
async function startCamera() {
    isRequesting = false; // Reset de sécurité
    const overlay = document.getElementById('cam-overlay');
    const video = document.getElementById('hidden-video');
    const status = document.getElementById('cam-status');
    
    overlay.style.display = 'flex';
    status.innerText = "OUVERTURE FLUX...";

    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", width: { ideal: 1280 } } 
        });
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        
        video.onloadedmetadata = () => {
            video.play();
            status.innerText = "VISEZ LE CODE-BARRES OU LE VIN";
            if (ocrInterval) clearInterval(ocrInterval);
            ocrInterval = setInterval(scanLogic, 1000);
            requestAnimationFrame(() => updateCanvas(video));
        };
    } catch (err) {
        alert("Accès caméra refusé ou non supporté.");
        stopCamera();
    }
}

function updateCanvas(video) {
    if (!stream) return;
    const canvas = document.getElementById('cam-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    requestAnimationFrame(() => updateCanvas(video));
}

async function scanLogic() {
    const canvas = document.getElementById('cam-canvas');
    
    // 1. TENTATIVE CODE-BARRES (API NATIVE)
    if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'ean_13'] });
        try {
            const barcodes = await detector.detect(canvas);
            if (barcodes.length > 0) {
                return successScan(barcodes[0].rawValue, "BARCODE");
            }
        } catch (e) {}
    }

    // 2. TENTATIVE OCR (SUR ZONE CENTRALE)
    const cropCanvas = document.createElement('canvas');
    const ctx = cropCanvas.getContext('2d');
    const w = canvas.width * 0.8;
    const h = canvas.height * 0.2;
    cropCanvas.width = w;
    cropCanvas.height = h;
    ctx.drawImage(canvas, (canvas.width - w)/2, (canvas.height - h)/2, w, h, 0, 0, w, h);

    try {
        const result = await Tesseract.recognize(cropCanvas, 'eng', {
            tessedit_char_whitelist: '0123456789ABCDEFGHJKLMNPRSTUVWXYZ',
            tessedit_pageseg_mode: '7'
        });
        let text = result.data.text.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (text.length >= 10) successScan(text, "OCR");
    } catch (e) {}
}

function successScan(val, source) {
    document.getElementById('vin-input').value = val.toUpperCase();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    stopCamera();
}

function stopCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    clearInterval(ocrInterval);
    document.getElementById('cam-overlay').style.display = 'none';
}

// ==========================================
// 5. SIGNATURE TACTILE
// ==========================================
const sigCanvas = document.getElementById('signature-pad');
let isDrawing = false;

function openSignature() {
    document.getElementById('signature-overlay').style.display = 'flex';
    resizeSignatureCanvas();
}

function resizeSignatureCanvas() {
    const rect = sigCanvas.getBoundingClientRect();
    sigCanvas.width = rect.width;
    sigCanvas.height = rect.height;
    const ctx = sigCanvas.getContext('2d');
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
}

if (sigCanvas) {
    const ctx = sigCanvas.getContext('2d');
    const getPos = (e) => {
        const rect = sigCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e) => { isDrawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    const draw = (e) => { 
        if (!isDrawing) return; 
        if (e.cancelable) e.preventDefault();
        const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); 
    };
    const stop = () => { if(isDrawing) { isDrawing = false; state.signature = sigCanvas.toDataURL(); saveState(); } };

    sigCanvas.addEventListener('mousedown', start);
    sigCanvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stop);
    sigCanvas.addEventListener('touchstart', start, { passive: false });
    sigCanvas.addEventListener('touchmove', draw, { passive: false });
    sigCanvas.addEventListener('touchend', stop);
}

function clearSignature() {
    const ctx = sigCanvas.getContext('2d');
    ctx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    state.signature = null;
    saveState();

    // Si on efface, on redonne au bouton son aspect normal
    const btnSigner = document.querySelector('button[onclick="openSignature()"]');
    btnSigner.classList.remove('bg-slate-400', 'cursor-not-allowed');
    btnSigner.classList.add('bg-amber-500');
    btnSigner.disabled = false;
    btnSigner.innerHTML = '<i data-lucide="pen-tool"></i> SIGNER LE BON';
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeSignature() {
    document.getElementById('signature-overlay').style.display = 'none';
    
    if (state.signature) {
        // On récupère le bouton de signature
        const btnSigner = document.querySelector('button[onclick="openSignature()"]');
        
        // On le grise et on le désactive
        btnSigner.classList.remove('bg-amber-500');
        btnSigner.classList.add('bg-slate-400', 'cursor-not-allowed');
        btnSigner.disabled = true;
        btnSigner.innerHTML = '<i data-lucide="check-circle"></i> BON SIGNÉ';
        
        // On rafraîchit l'icône Lucide
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        showModal("Parfait !", "La signature est enregistrée.", "success");
    } else {
        showModal("Signature manquante", "Le cadre est vide. Le client doit signer.", "info");
    }
}

// ==========================================
// 6. ENVOI FINAL (SHEETDB)
// ==========================================
async function finalize() {
    if (state.batch.length === 0) return showModal("Lot vide", "Ajoute au moins un véhicule avant d'envoyer.", "info");

    if (!state.signature || state.signature === "") {
        return showModal("Signature manquante", "Le client doit signer le bon avant l'envoi final.", "info");
    }
    
    const finalBtn = document.querySelector('button[onclick="finalize()"]');
    finalBtn.disabled = true;
    finalBtn.innerHTML = "ENVOI EN COURS...";

    try {
        // REMPLACE BIEN L'URL CI-DESSOUS PAR LA TIENNE
        const url = "https://sheetdb.io/api/v1/gc2df6w3b42tw"; 
        
        const response = await fetch(url, { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: state.batch.map(v => ({
                    "Date": "'" + v.timestamp,
                    "VIN": v.vin,
                    "Vitres": v.windows.join(', '),
                    "Type": v.type,
                    "Observations": v.obs || "RAS",
                    "Signature": state.signature
                }))
            })
        });

        // On vérifie d'abord si la réponse réseau est OK
        if (response.ok) {
            showModal("Terminé !", "Toutes les données sont dans le Google Sheets.", "success");
            localStorage.clear();
            location.reload();
        } else {
            // Si le serveur répond une erreur (404, 500, etc.)
            const errorText = await response.text();
            console.error("Détail erreur:", errorText);
            alert("❌ Erreur serveur : Vérifiez que votre lien SheetDB est toujours valide.");
            finalBtn.disabled = false;
            finalBtn.innerHTML = "RÉESSAYER";
        }

    } catch (e) {
        // Erreur de connexion (internet coupé, etc.)
        alert("❌ Problème de connexion internet.");
        finalBtn.disabled = false;
        finalBtn.innerHTML = "RÉESSAYER";
    }
}
