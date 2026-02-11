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
    const vin = vinInput.value.trim();

    if (!vin) {
        alert("Veuillez scanner ou saisir un VIN.");
        return;
    }
    if (selectedWindows.length === 0) {
        alert("Veuillez sélectionner au moins une vitre sur le plan.");
        return;
    }

    const typeInter = document.querySelector('input[name="type_inter"]:checked').value;

    // Ajout à l'état
    state.batch.push({
        vin: vin.toUpperCase(),
        windows: [...selectedWindows],
        type: typeInter,
        timestamp: new Date().toLocaleString('fr-FR')
    });

    saveState();
    renderBatch();

    // Reset de l'interface
    vinInput.value = "";
    selectedWindows = [];
    document.querySelectorAll('.window-btn').forEach(btn => {
        btn.classList.remove('selected', 'bg-indigo-600', 'text-white');
    });
}

function renderBatch() {
    const container = document.getElementById('batch-container');
    const countEl = document.getElementById('batch-count');
    if (!container) return;

    container.innerHTML = state.batch.map((item, index) => `
        <div class="bg-white p-3 rounded-xl mb-2 shadow-sm border-l-4 border-indigo-500 flex justify-between items-center">
            <div>
                <div class="font-bold text-slate-800">${item.vin}</div>
                <div class="text-[10px] text-slate-500 uppercase font-semibold">
                    ${item.type} : ${item.windows.join(', ')}
                </div>
            </div>
            <button onclick="removeItem(${index})" class="text-slate-300 hover:text-red-500">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');

    if (countEl) countEl.innerText = state.batch.length;
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
        
        alert("✅ Signature enregistrée !");
    } else {
        alert("⚠️ Aucune signature détectée.");
    }
}

// ==========================================
// 6. ENVOI FINAL (SHEETDB)
// ==========================================
async function finalize() {
    if (envoiEnCours) return;
    if (state.batch.length === 0) return alert("Le lot est vide.");
    if (!state.signature) return alert("La signature est obligatoire.");

    envoiEnCours = true;
    try {
        const response = await fetch('https://sheetdb.io/api/v1/gc2df6w3b42tw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            data: state.batch.map(v => ({
                "Date": "'" + v.timestamp, // Ajoute l'apostrophe ici pour corriger le format
                "VIN": v.vin,
                "Vitres": v.windows.join(', '),
                "Type": v.type,
                "Observations": v.obs || "RAS", // Ajoute cette ligne pour les remarques
                "Signature": state.signature
            }))
        })
        });

        if (response.ok) {
            alert("✅ Données envoyées avec succès !");
            state.batch = [];
            state.signature = null;
            saveState();
            location.reload();
        }
    } catch (err) {
        alert("Erreur réseau : " + err);
    } finally {
        envoiEnCours = false;
    }
}
