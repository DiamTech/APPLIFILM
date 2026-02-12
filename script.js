let state = { selectedWindows: [], photos: [], batch: [] };
let html5QrCode;
let canvas, ctx, drawing = false;

// --- INITIALISATION (SÉCURISÉE POUR LE LOGO) ---
window.addEventListener('DOMContentLoaded', () => {
    // 1. Initialiser Lucide
    lucide.createIcons();
    
    // 2. Initialiser Signature
    initSignature();
    
    // 3. Charger le thème
    if(localStorage.theme === 'dark') {
        document.documentElement.classList.add('dark');
        updateDarkIcon(true);
    }

    // 4. SUPPRIMER LE LOGO QUOI QU'IL ARRIVE APRÈS 1.5s
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 600);
        }
    }, 1500);
});

// --- MODE SOMBRE ---
function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.theme = isDark ? 'dark' : 'light';
    updateDarkIcon(isDark);
}

function updateDarkIcon(isDark) {
    const icon = document.getElementById('dark-icon');
    if(icon) {
        icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        lucide.createIcons();
    }
}

// --- SCANNER ---
async function startScanner() {
    const readerDiv = document.getElementById('reader');
    readerDiv.classList.remove('hidden');
    html5QrCode = new Html5Qrcode("reader");
    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 150 } },
            (text) => {
                document.getElementById('vin-input').value = text;
                stopScanner();
            }
        );
    } catch (err) {
        alert("Erreur caméra");
        readerDiv.classList.add('hidden');
    }
}

function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => document.getElementById('reader').classList.add('hidden'));
    }
}

// --- VITRES ---
function toggleWindow(id) {
    const btn = document.getElementById('win-' + id);
    if(!btn) return;
    if (state.selectedWindows.includes(id)) {
        state.selectedWindows = state.selectedWindows.filter(w => w !== id);
        btn.classList.remove('selected');
    } else {
        state.selectedWindows.push(id);
        btn.classList.add('selected');
    }
}

// --- SIGNATURE ---
function initSignature() {
    canvas = document.getElementById('sig-canvas');
    if(!canvas) return;
    ctx = canvas.getContext('2d');
    
    // Ajuster taille canvas
    const resize = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.strokeStyle = "#4f46e5";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
    };
    window.addEventListener('resize', resize);
    resize();

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const ev = e.touches ? e.touches[0] : e;
        return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };

    const start = (e) => { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if(!drawing) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const stop = () => drawing = false;

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, {passive: false}); canvas.addEventListener('touchmove', move, {passive: false}); canvas.addEventListener('touchend', stop);
}

function clearSignature() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

// --- PHOTOS ---
function handlePhotos(input) {
    Array.from(input.files).forEach(file => {
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
    const label = container.querySelector('label');
    container.innerHTML = ''; container.appendChild(label);
    state.photos.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = "relative aspect-square rounded-2xl overflow-hidden border";
        div.innerHTML = `<img src="${p}" class="w-full h-full object-cover"><button onclick="state.photos.splice(${i},1);renderPhotos()" class="absolute top-0 right-0 bg-red-500 text-white p-1 text-[8px]">✕</button>`;
        container.appendChild(div);
    });
}

// --- LOGIQUE MÉTIER ---
function toggleHistoryMenu() { document.getElementById('history-menu').classList.toggle('hidden'); }

function updateUI() {
    document.getElementById('batch-counter').innerText = `${state.batch.length} lot(s)`;
    const list = document.getElementById('batch-list');
    list.innerHTML = state.batch.map((item, i) => `
        <div class="flex justify-between p-2 border-b dark:border-slate-700 last:border-0">
            <span>${item.vin}</span>
            <button onclick="state.batch.splice(${i},1); updateUI();" class="text-red-400">✕</button>
        </div>
    `).join('') || '<p class="text-center text-slate-400">Vide</p>';
}

function addToBatch() {
    const vin = document.getElementById('vin-input').value;
    state.batch.push({
        vin: vin || "SANS VIN",
        windows: [...state.selectedWindows],
        photos: [...state.photos],
        sig: canvas.toDataURL()
    });
    state.selectedWindows = []; state.photos = [];
    document.getElementById('vin-input').value = "";
    document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('selected'));
    clearSignature(); renderPhotos(); updateUI();
}

async function finalize() {
    if(!state.batch.length) return alert("Lot vide");
    const btn = document.getElementById('btn-finaliser');
    btn.innerText = "Envoi..."; btn.disabled = true;
    try {
        await fetch('https://script.google.com/macros/s/AKfycbybQoN5JD72b3o3KlePS3ZCFtr2nL5TJJizmnGGLxZopWAQFwB9aPiJZGSWYMmIxwSX/exec', {
            method: 'POST', mode: 'no-cors', body: JSON.stringify({interventions: state.batch})
        });
        alert("Envoyé !"); state.batch = []; updateUI();
    } catch(e) { alert("Erreur d'envoi"); }
    btn.innerText = "Finaliser l'envoi"; btn.disabled = false;
}
