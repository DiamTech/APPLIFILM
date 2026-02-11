// ==========================================
// 1. VARIABLES GLOBALES
// ==========================================
let state = JSON.parse(localStorage.getItem('appliFilmState')) || {
    batch: [],
    signature: null
};

let selectedWindows = [];
let envoiEnCours = false;
let stream = null;
let ocrInterval = null;
let isRequesting = false; // Le fameux verrou anti-boucle

// Initialisation au chargement de la page
window.onload = () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    renderBatch();
};

function saveState() {
    localStorage.setItem('appliFilmState', JSON.stringify(state));
}

// ==========================================
// 2. CAMÉRA ET SCAN (VERSION STABLE)
// ==========================================
async function startCamera() {
    if (isRequesting) return; 
    isRequesting = true;

    const overlay = document.getElementById('cam-overlay');
    const video = document.getElementById('hidden-video');
    const status = document.getElementById('cam-status');
    
    overlay.style.display = 'flex';
    status.innerText = "INITIALISATION...";

    try {
        // Nettoyage avant de démarrer
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" }, 
            audio: false 
        });
        
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        
        video.onloadedmetadata = () => {
            video.play();
            status.innerText = "VISEZ LE CODE (VIN)";
            isRequesting = false;
            
            if (ocrInterval) clearInterval(ocrInterval);
            // On scanne toutes les 1.5 secondes pour laisser le temps à l'appareil de faire le point
            ocrInterval = setInterval(captureAndScan, 1500);
            requestAnimationFrame(() => updateCanvas(video));
        };

    } catch (err) {
        isRequesting = false;
        console.error("Erreur Caméra:", err);
        alert("🔒 Accès bloqué. Vérifiez les réglages de votre téléphone.");
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

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (ocrInterval) clearInterval(ocrInterval);
    document.getElementById('cam-overlay').style.display = 'none';
}

// ==========================================
// 3. LOGIQUE DE DÉCODAGE (VIN & BARCODE)
// ==========================================
async function captureAndScan() {
    const canvas = document.getElementById('cam-canvas');
    const status = document.getElementById('cam-status');
    
    // TENTATIVE CODE-BARRES
    if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({ formats: ['code_128', 'code_39'] });
        try {
            const barcodes = await detector.detect(canvas);
            if (barcodes.length > 0) {
                const val = barcodes[0].rawValue.toUpperCase().replace(/\s+/g, '');
                if (val.length >= 10) return successScan(val, "CODE-BARRES");
            }
        } catch (e) {}
    }

    // TENTATIVE TEXTE (OCR)
    try {
        const result = await Tesseract.recognize(canvas, 'eng', {
            tessedit_char_whitelist: '0123456789ABCDEFGHJKLMNPRSTUVWXYZ', // Uniquement caractères VIN
            tessedit_pageseg_mode: '7'
        });

        let text = result.data.text.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const vinMatch = text.match(/[A-Z0-9]{17}/);

        if (vinMatch) {
            successScan(vinMatch[0], "TEXTE");
        }
    } catch (e) { console.error(e); }
}

function successScan(vin, source) {
    const status = document.getElementById('cam-status');
    document.getElementById('vin-input').value = vin;
    status.innerText = "VIN TROUVÉ (" + source + ")";
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setTimeout(stopCamera, 1200);
}

// ==========================================
// 4. GESTION DES VITRES ET ENVOI
// ==========================================
function toggleWindow(id) {
    const btn = document.getElementById('win-' + id);
    const index = selectedWindows.indexOf(id);
    if (index > -1) {
        selectedWindows.splice(index, 1);
        if(btn) btn.classList.remove('selected');
    } else {
        selectedWindows.push(id);
        if(btn) btn.classList.add('selected');
    }
}

function addToBatch() {
    const vin = document.getElementById('vin-input').value;
    if (!vin) return alert("Scannez ou tapez un VIN");
    
    state.batch.push({
        vin: vin,
        windows: [...selectedWindows],
        type: document.querySelector('input[name="type_inter"]:checked').value,
        timestamp: new Date().toLocaleString()
    });
    
    saveState();
    renderBatch();
    document.getElementById('vin-input').value = "";
    selectedWindows = [];
    document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('selected'));
}

function renderBatch() {
    const container = document.getElementById('batch-container');
    if(!container) return;
    container.innerHTML = state.batch.map((v, i) => `
        <div class="bg-white p-3 rounded-xl mb-2 shadow-sm border border-slate-200">
            <div class="font-bold text-indigo-600">${v.vin}</div>
            <div class="text-[10px] text-slate-500">${v.windows.join(', ')}</div>
        </div>
    `).join('');
    document.getElementById('batch-count').innerText = state.batch.length;
}

async function finalize() {
    if (envoiEnCours || state.batch.length === 0) return alert("Rien à envoyer");
    envoiEnCours = true;
    try {
        const response = await fetch('https://sheetdb.io/api/v1/gc2df6w3b42tw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: state.batch.map(v => ({
                    "Date": v.timestamp,
                    "VIN": v.vin,
                    "Vitres": v.windows.join(', '),
                    "Type": v.type
                }))
            })
        });
        if (response.ok) {
            alert("✅ Données envoyées !");
            state.batch = [];
            saveState();
            location.reload();
        }
    } catch (err) { alert("Erreur : " + err); }
    finally { envoiEnCours = false; }
}

// ==========================================
// 5. GESTION DE LA SIGNATURE
// ==========================================
let isDrawing = false;
const sigCanvas = document.getElementById('signature-pad');

if (sigCanvas) {
    const ctx = sigCanvas.getContext('2d');

    // Adapter la taille du canvas à l'affichage
    function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        sigCanvas.width = sigCanvas.offsetWidth * ratio;
        sigCanvas.height = sigCanvas.offsetHeight * ratio;
        ctx.scale(ratio, ratio);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Événements Souris / Tactile
    const startDrawing = (e) => {
        isDrawing = true;
        ctx.beginPath();
        const pos = getPos(e);
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        isDrawing = false;
        state.signature = sigCanvas.toDataURL(); // Sauvegarde le dessin
        saveState();
    };

    function getPos(e) {
        const rect = sigCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    sigCanvas.addEventListener('mousedown', startDrawing);
    sigCanvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    sigCanvas.addEventListener('touchstart', startDrawing, { passive: false });
    sigCanvas.addEventListener('touchmove', draw, { passive: false });
    sigCanvas.addEventListener('touchend', stopDrawing);
}

function clearSignature() {
    const ctx = sigCanvas.getContext('2d');
    ctx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    state.signature = null;
    saveState();
}
