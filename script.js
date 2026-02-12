let state = { vin: "", selectedWindows: [], photos: [], batch: [], signature: null };
let canvas, ctx, drawing = false;

// --- INITIALISATION ---
window.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    setTimeout(() => {
        document.getElementById('splash-screen').style.opacity = '0';
        setTimeout(() => document.getElementById('splash-screen').remove(), 500);
    }, 1000);
});

// --- SIGNATURE MODALE ---
function initCanvas() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    const resize = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.strokeStyle = "#4f46e5"; ctx.lineWidth = 3; ctx.lineCap = "round";
    };
    window.addEventListener('resize', resize); resize();

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

function openSignature() { document.getElementById('modal-sig').classList.remove('hidden'); }
function closeSignature() { document.getElementById('modal-sig').classList.add('hidden'); }
function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

function saveSignature() {
    state.signature = canvas.toDataURL();
    document.getElementById('btn-sig-open').classList.add('hidden');
    document.getElementById('sig-status').classList.remove('hidden');
    closeSignature();
}

function resetSignature() {
    state.signature = null;
    clearCanvas();
    document.getElementById('btn-sig-open').classList.remove('hidden');
    document.getElementById('sig-status').classList.add('hidden');
}

// --- MÉTIER ---
function toggleWindow(id) {
    const btn = document.getElementById('win-' + id);
    if(state.selectedWindows.includes(id)) {
        state.selectedWindows = state.selectedWindows.filter(w => w !== id);
        btn.classList.remove('selected');
    } else {
        state.selectedWindows.push(id);
        btn.classList.add('selected');
    }
}

function handlePhotos(input) {
    Array.from(input.files).forEach(f => {
        const r = new FileReader();
        r.onload = (e) => state.photos.push(e.target.result);
        r.readAsDataURL(f);
    });
    setTimeout(() => document.getElementById('photo-count').innerText = state.photos.length, 500);
}

function addToBatch() {
    const vin = document.getElementById('vin-input').value;
    if(!vin && state.selectedWindows.length === 0) return alert("Saisie vide !");
    
    state.batch.push({
        vin: vin || "SANS VIN",
        type: document.querySelector('input[name="type"]:checked').value,
        obs: document.getElementById('obs').value,
        windows: [...state.selectedWindows],
        photos: [...state.photos],
        sig: state.signature,
        date: new Date().toLocaleTimeString()
    });

    // Reset UI
    document.getElementById('vin-input').value = "";
    document.getElementById('obs').value = "";
    document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('selected'));
    state.selectedWindows = []; state.photos = []; resetSignature();
    document.getElementById('photo-count').innerText = "0";
    updateBatchUI();
}

function updateBatchUI() {
    document.getElementById('batch-counter').innerText = `${state.batch.length} lot(s)`;
    const list = document.getElementById('batch-list');
    list.innerHTML = state.batch.map((item, i) => `
        <div class="flex justify-between p-3 border-b dark:border-slate-700 last:border-0 bg-slate-50 dark:bg-slate-900 rounded-xl mb-1">
            <span class="font-bold font-mono">${item.vin}</span>
            <button onclick="state.batch.splice(${i},1); updateBatchUI()" class="text-red-500">✕</button>
        </div>
    `).join('') || '<p class="p-4 text-center text-slate-400">Aucun lot</p>';
}

function toggleHistoryMenu() { document.getElementById('history-menu').classList.toggle('hidden'); }

async function finalize() {
    if(!state.batch.length) return alert("Aucun lot à envoyer");
    const btn = document.getElementById('btn-final');
    btn.disabled = true; btn.innerText = "ENVOI EN COURS...";
    try {
        await fetch('https://script.google.com/macros/s/AKfycbybQoN5JD72b3o3KlePS3ZCFtr2nL5TJJizmnGGLxZopWAQFwB9aPiJZGSWYMmIxwSX/exec', {
            method: 'POST', mode: 'no-cors', body: JSON.stringify({interventions: state.batch})
        });
        alert("BRAVO ! Tournée envoyée avec succès.");
        state.batch = []; updateBatchUI();
    } catch(e) { alert("Erreur de connexion"); }
    btn.disabled = false; btn.innerText = "FINALISER L'ENVOI";
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    document.getElementById('dark-icon').setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons();
}
