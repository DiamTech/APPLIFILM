let state = { selectedWindows: [], photos: [], batch: [] };
let html5QrCode;

// --- INITIALISATION ---
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('splash-screen').classList.add('splash-fade');
        initSignature();
        if(localStorage.theme === 'dark') toggleDarkMode(true);
    }, 1200);
});

// --- MODE SOMBRE ---
function toggleDarkMode(init = false) {
    const isDark = document.documentElement.classList.toggle('dark');
    if(!init) localStorage.theme = isDark ? 'dark' : 'light';
    const icon = document.getElementById('dark-icon');
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons();
}

// --- MENU HISTORIQUE ---
function toggleHistoryMenu() {
    document.getElementById('history-menu').classList.toggle('hidden');
}

// --- SIGNATURE (CANVAS) ---
let canvas, ctx, drawing = false;

function initSignature() {
    canvas = document.getElementById('sig-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 2;

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e) => { drawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if(!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const stop = () => { drawing = false; };

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start); canvas.addEventListener('touchmove', move); window.addEventListener('touchend', stop);
}

function clearSignature() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

// --- LOGIQUE MÉTIER ---
function addToBatch() {
    const vin = document.getElementById('vin-input').value;
    const sig = canvas.toDataURL(); // Capture la signature en image

    const entry = {
        vin: vin || "SANS VIN",
        type: document.querySelector('input[name="type_inter"]:checked').value,
        windows: [...state.selectedWindows],
        photos: [...state.photos],
        signature: sig,
        date: new Date().toLocaleTimeString()
    };

    state.batch.push(entry);
    resetForm();
    updateUI();
}

function resetForm() {
    state.selectedWindows = []; state.photos = [];
    document.getElementById('vin-input').value = "";
    document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('selected'));
    clearSignature();
    renderPhotos();
}

function updateUI() {
    document.getElementById('batch-counter').innerText = `${state.batch.length} lot(s)`;
    const list = document.getElementById('batch-list');
    list.innerHTML = state.batch.map((item, i) => `
        <div class="flex justify-between items-center p-2 border-b dark:border-slate-700 last:border-0">
            <span>${item.vin} (${item.type})</span>
            <button onclick="state.batch.splice(${i},1); updateUI();" class="text-red-400">✕</button>
        </div>
    `).join('') || '<p class="text-center text-slate-400">Vide</p>';
}

// [Garde tes fonctions existantes : handlePhotos, renderPhotos, startScanner, stopScanner, finalize]
