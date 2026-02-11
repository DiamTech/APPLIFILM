// ==========================================
// 1. VARIABLES & ÉTAT
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
    if (typeof lucide !== 'undefined') lucide.createIcons();
    renderBatch();
};

function saveState() {
    localStorage.setItem('appliFilmState', JSON.stringify(state));
}

// ==========================================
// 2. SÉLECTION DES VITRES (VERSION SYNCHRO)
// ==========================================
function toggleWindow(id) {
    const btn = document.getElementById('win-' + id);
    const index = selectedWindows.indexOf(id);
    
    if (index > -1) {
        selectedWindows.splice(index, 1);
        if(btn) btn.classList.remove('selected', 'bg-indigo-600', 'text-white');
    } else {
        selectedWindows.push(id);
        if(btn) btn.classList.add('selected', 'bg-indigo-600', 'text-white');
    }
}

function addToBatch() {
    const vin = document.getElementById('vin-input').value;
    if (!vin) return alert("Scannez ou tapez un VIN d'abord");
    if (selectedWindows.length === 0) return alert("Sélectionnez au moins une vitre");
    
    const typeInter = document.querySelector('input[name="type_inter"]:checked').value;

    state.batch.push({
        vin: vin.toUpperCase(),
        windows: [...selectedWindows],
        type: typeInter,
        timestamp: new Date().toLocaleString('fr-FR')
    });
    
    saveState();
    renderBatch();
    
    // Reset après ajout
    document.getElementById('vin-input').value = "";
    selectedWindows = [];
    document.querySelectorAll('.window-btn').forEach(b => {
        b.classList.remove('selected', 'bg-indigo-600', 'text-white');
    });
    alert("Véhicule ajouté au lot !");
}

function renderBatch() {
    const container = document.getElementById('batch-container');
    if(!container) return;
    container.innerHTML = state.batch.map((v, i) => `
        <div class="bg-white p-3 rounded-xl mb-2 shadow-sm border-l-4 border-indigo-500">
            <div class="font-bold text-slate-800">${v.vin}</div>
            <div class="text-[10px] text-slate-500 font-medium uppercase">
                ${v.type} : ${v.windows.join(', ')}
            </div>
        </div>
    `).join('');
    document.getElementById('batch-count').innerText = state.batch.length;
}

// ==========================================
// 3. GESTION DE LA SIGNATURE
// ==========================================
const sigCanvas = document.getElementById('signature-pad');
let isDrawing = false;

function openSignature() {
    const overlay = document.getElementById('signature-overlay');
    overlay.style.display = 'flex';
    resizeSignatureCanvas();
}

function closeSignature() {
    if (!state.signature) {
        // On vérifie si le canvas est vide
        const tempCanvas = document.getElementById('signature-pad');
        state.signature = tempCanvas.toDataURL();
    }
    document.getElementById('signature-overlay').style.display = 'none';
    saveState();
}

function resizeSignatureCanvas() {
    if (!sigCanvas) return;
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
}

// ==========================================
// 4. CAMÉRA ET ENVOI (RESTE INCHANGÉ)
// ==========================================
async function startCamera() {
    if (isRequesting) return;
    isRequesting = true;
    const overlay = document.getElementById('cam-overlay');
    const video = document.getElementById('hidden-video');
    overlay.style.display = 'flex';
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            isRequesting = false;
            ocrInterval = setInterval(captureAndScan, 1500);
            requestAnimationFrame(() => updateCanvas(video));
        };
    } catch (err) { isRequesting = false; stopCamera(); }
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
    if (stream) stream.getTracks().forEach(t => t.stop());
    clearInterval(ocrInterval);
    document.getElementById('cam-overlay').style.display = 'none';
}

async function captureAndScan() {
    const canvas = document.getElementById('cam-canvas');
    const status = document.getElementById('cam-status');
    
    // On crée un canvas temporaire pour le recadrage
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');

    // On définit la zone de capture (le centre de l'image)
    // On prend 80% de la largeur et 20% de la hauteur au milieu
    const width = canvas.width * 0.8;
    const height = canvas.height * 0.2;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;

    cropCanvas.width = width;
    cropCanvas.height = height;

    // On dessine uniquement la zone centrale du flux vidéo sur notre petit canvas
    cropCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

    try {
        // On envoie seulement la zone découpée à Tesseract
        const result = await Tesseract.recognize(cropCanvas, 'eng', {
            tessedit_char_whitelist: '0123456789ABCDEFGHJKLMNPRSTUVWXYZ',
            tessedit_pageseg_mode: '7'
        });

        let text = result.data.text.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const vinMatch = text.match(/[A-Z0-9]{17}/);

        if (vinMatch) {
            document.getElementById('vin-input').value = vinMatch[0];
            status.innerText = "VIN DÉTECTÉ !";
            if (navigator.vibrate) navigator.vibrate(200);
            stopCamera();
        } else {
            status.innerText = "ALIGNEZ LE CODE...";
        }
    } catch (e) {
        console.error("Erreur OCR:", e);
    }
}

async function finalize() {
    if (envoiEnCours || state.batch.length === 0) return alert("Lot vide");
    if (!state.signature) return alert("Signature obligatoire");
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
                    "Type": v.type,
                    "Signature": state.signature
                }))
            })
        });
        if (response.ok) {
            alert("✅ Données envoyées !");
            state.batch = []; state.signature = null;
            saveState(); location.reload();
        }
    } catch (err) { alert(err); }
    finally { envoiEnCours = false; }
}
