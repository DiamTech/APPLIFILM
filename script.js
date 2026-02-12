// --- ÉTAT GLOBAL DE L'APP ---
let state = {
    vin: "",
    selectedWindows: [],
    photos: [],
    batch: []
};

// --- GESTION DU SPLASH SCREEN (LOGO AU LANCEMENT) ---
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    // On attend 1.5s pour le style, puis on lance le fondu
    setTimeout(() => {
        splash.style.opacity = '0';
        // On retire complètement l'élément après le fondu pour libérer l'écran
        setTimeout(() => {
            splash.style.display = 'none';
        }, 700);
    }, 1500);
});

let html5QrCode;

async function startScanner() {
    // 1. On affiche la zone du scanner (le div qui doit avoir l'id 'reader')
    const readerDiv = document.getElementById('reader');
    readerDiv.classList.remove('hidden');

    html5QrCode = new Html5Qrcode("reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            config,
            (decodedText) => {
                // 2. Quand on détecte le VIN
                document.getElementById('vin-input').value = decodedText;
                stopScanner(); // On arrête après détection
                
                // Petit retour visuel
                document.getElementById('vin-input').classList.add('ring-4', 'ring-green-500');
                setTimeout(() => document.getElementById('vin-input').classList.remove('ring-4', 'ring-green-500'), 1000);
            }
        );
    } catch (err) {
        console.error("Erreur caméra:", err);
        alert("Impossible d'ouvrir la caméra pour le scan.");
    }
}

function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader').classList.add('hidden');
        });
    }
}
// --- GESTION DES VITRES ---
function toggleWindow(id) {
    const btn = document.getElementById('win-' + id);
    if (state.selectedWindows.includes(id)) {
        state.selectedWindows = state.selectedWindows.filter(w => w !== id);
        btn.classList.remove('bg-indigo-600', 'text-white', 'selected');
        btn.classList.add('bg-white');
    } else {
        state.selectedWindows.push(id);
        btn.classList.add('bg-indigo-600', 'text-white', 'selected');
        btn.classList.remove('bg-white');
    }
}

// --- GESTION DES PHOTOS ---
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
        div.className = "relative aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-sm";
        div.innerHTML = `
            <img src="${photo}" class="w-full h-full object-cover">
            <button onclick="removePhoto(${index})" class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-lg">✕</button>
        `;
        container.appendChild(div);
    });
}

function removePhoto(index) {
    state.photos.splice(index, 1);
    renderPhotos();
}

// --- AJOUT AU LOT ---
function addToBatch() {
    const vinInput = document.getElementById('vin-input');
    const obsInput = document.getElementById('observation-input');
    const typeInter = document.querySelector('input[name="type_inter"]:checked').value;

    if (!vinInput.value && state.selectedWindows.length === 0) {
        alert("Veuillez remplir au moins le VIN ou une vitre.");
        return;
    }

    const entry = {
        date: new Date().toLocaleString('fr-FR'),
        vin: vinInput.value || "NON SPÉCIFIÉ",
        type: typeInter,
        windows: [...state.selectedWindows],
        observations: obsInput.value,
        photos: [...state.photos]
    };

    state.batch.push(entry);
    
    // Reset Formulaire
    state.selectedWindows = [];
    state.photos = [];
    vinInput.value = "";
    obsInput.value = "";
    document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('bg-indigo-600', 'text-white', 'selected'));
    
    renderPhotos();
    updateBatchCount();
    alert("Ajouté au lot avec succès !");
}

function updateBatchCount() {
    document.getElementById('batch-counter').innerText = state.batch.length + " lot(s)";
}

// --- ENVOI FINAL VERS GOOGLE DRIVE & SHEETS ---
async function finalize() {
    if (state.batch.length === 0) return alert("Le lot est vide !");

    const btn = document.getElementById('btn-finaliser');
    btn.disabled = true;
    btn.innerText = "Envoi en cours...";

    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbybQoN5JD72b3o3KlePS3ZCFtr2nL5TJJizmnGGLxZopWAQFwB9aPiJZGSWYMmIxwSX/exec', {
            method: 'POST',
            mode: 'no-cors', // Requis pour Google Apps Script
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interventions: state.batch })
        });

        // Avec no-cors on ne peut pas lire la réponse JSON, mais si on arrive ici, c'est ok.
        alert("Bravo ! Les données et photos sont sur ton Drive.");
        state.batch = [];
        updateBatchCount();

    } catch (error) {
        console.error(error);
        alert("Erreur d'envoi. Vérifie ta connexion.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Finaliser l'envoi";
    }
}
