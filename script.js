let state = {
    selectedWindows: [],
    photos: [],
    batch: []
};

let html5QrCode;

// --- INITIALISATION ---
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 700);
    }, 1500);
});

// --- SCANNER VIN ---
async function startScanner() {
    const readerDiv = document.getElementById('reader');
    readerDiv.classList.remove('hidden');
    html5QrCode = new Html5Qrcode("reader");
    
    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 150 } },
            (decodedText) => {
                document.getElementById('vin-input').value = decodedText;
                stopScanner();
            }
        );
    } catch (err) {
        alert("Caméra introuvable");
        readerDiv.classList.add('hidden');
    }
}

function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader').classList.add('hidden');
        });
    }
}

// --- VITRES ---
function toggleWindow(id) {
    const btn = document.getElementById('win-' + id);
    if (state.selectedWindows.includes(id)) {
        state.selectedWindows = state.selectedWindows.filter(w => w !== id);
        btn.classList.remove('selected');
    } else {
        state.selectedWindows.push(id);
        btn.classList.add('selected');
    }
}

// --- PHOTOS ---
function handlePhotos(input) {
    const files = Array.from(input.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.photos.push(e.target.result);
            renderPhotos();
        };
        reader.readAsDataURL(file);
    });
}

function renderPhotos() {
    const container = document.getElementById('photo-preview-container');
    const addButton = container.querySelector('label');
    container.innerHTML = '';
    container.appendChild(addButton);

    state.photos.forEach((photo, index) => {
        const div = document.createElement('div');
        div.className = "relative aspect-square rounded-2xl overflow-hidden border animate-in";
        div.innerHTML = `
            <img src="${photo}" class="w-full h-full object-cover">
            <button onclick="removePhoto(${index})" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-[10px]">✕</button>
        `;
        container.appendChild(div);
    });
}

function removePhoto(index) {
    state.photos.splice(index, 1);
    renderPhotos();
}

// --- LOGIQUE MÉTIER ---
function addToBatch() {
    const vin = document.getElementById('vin-input').value;
    const typeInter = document.querySelector('input[name="type_inter"]:checked').value;
    const obs = document.getElementById('observation-input').value;

    if (!vin && state.selectedWindows.length === 0) return alert("Saisie vide");

    const entry = {
        date: new Date().toLocaleString('fr-FR'),
        vin: vin || "NON SPÉCIFIÉ",
        type: typeInter,
        windows: [...state.selectedWindows],
        observations: obs,
        photos: [...state.photos]
    };

    state.batch.push(entry);
    
    // Reset
    state.selectedWindows = [];
    state.photos = [];
    document.getElementById('vin-input').value = "";
    document.getElementById('observation-input').value = "";
    document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('selected'));
    
    renderPhotos();
    updateBatchCount();
    renderBatchList();
}

function renderBatchList() {
    const list = document.getElementById('batch-list');
    list.innerHTML = state.batch.length > 0 ? '<label class="block text-[10px] font-black text-slate-400 uppercase mb-3">Lot en attente</label>' : '';
    
    state.batch.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = "bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between animate-in";
        div.innerHTML = `
            <div>
                <p class="text-xs font-mono font-bold text-indigo-600">${item.vin}</p>
                <p class="text-[9px] text-slate-400">${item.windows.length} vitres • ${item.photos.length} photos</p>
            </div>
            <button onclick="removeFromBatch(${index})" class="text-slate-300 hover:text-red-500">✕</button>
        `;
        list.appendChild(div);
    });
}

function removeFromBatch(index) {
    state.batch.splice(index, 1);
    updateBatchCount();
    renderBatchList();
}

function updateBatchCount() {
    document.getElementById('batch-counter').innerText = state.batch.length + " lot(s)";
}

// --- ENVOI GOOGLE ---
async function finalize() {
    if (state.batch.length === 0) return;
    const btn = document.getElementById('btn-finaliser');
    btn.disabled = true;
    btn.innerText = "Envoi au Drive...";

    try {
        await fetch('https://script.google.com/macros/s/AKfycbybQoN5JD72b3o3KlePS3ZCFtr2nL5TJJizmnGGLxZopWAQFwB9aPiJZGSWYMmIxwSX/exec', {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ interventions: state.batch })
        });
        alert("Tout est envoyé !");
        state.batch = [];
        updateBatchCount();
        renderBatchList();
    } catch (e) {
        alert("Erreur connexion");
    } finally {
        btn.disabled = false;
        btn.innerText = "Finaliser l'envoi";
    }
}
