// --- 1. ÉTAT DE L'APPLICATION ---
let state = JSON.parse(localStorage.getItem('scannerState')) || {
    batch: [],
    signature: null
};

let selectedWindows = [];
let signaturePad = null;

// --- 2. INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
    initSignaturePad();
    renderBatch();
    
    // Si une signature existait déjà, on affiche le bouton poubelle
    if (state.signature) {
        updateSignatureUI(true);
    }
});

function saveState() {
    localStorage.setItem('scannerState', JSON.stringify(state));
}

// --- 3. GESTION DES MODALES (FENÊTRES CUSTOM) ---
function showModal(title, text, type = 'info') {
    const modal = document.getElementById('custom-modal');
    const iconDiv = document.getElementById('modal-icon');
    
    if(!modal) return alert(title + " : " + text); // Sécurité si HTML manquant

    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-text').innerText = text;
    
    if(type === 'success') {
        iconDiv.className = "w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4";
        iconDiv.innerHTML = '<i data-lucide="check-circle-2"></i>';
    } else {
        iconDiv.className = "w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4";
        iconDiv.innerHTML = '<i data-lucide="info"></i>';
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
}

function closeModal() {
    document.getElementById('custom-modal').classList.add('hidden');
    document.getElementById('custom-modal').classList.remove('flex');
}

// --- 4. GESTION DU PLAN DES VITRES ---
function toggleWindow(windowId) {
    const btn = document.getElementById(`win-${windowId}`);
    if (selectedWindows.includes(windowId)) {
        selectedWindows = selectedWindows.filter(id => id !== windowId);
        btn.classList.remove('selected');
    } else {
        selectedWindows.push(windowId);
        btn.classList.add('selected');
    }
}

// --- 5. AJOUT AU LOT ---
function addToBatch() {
    const vinInput = document.getElementById('vin-input');
    const obsInput = document.getElementById('observation-input');
    const vin = vinInput.value.trim();

    if (!vin) return showModal("Champ vide", "Merci de scanner ou saisir un VIN.", "info");
    if (selectedWindows.length === 0) return showModal("Plan vide", "Sélectionnez au moins une vitre.", "info");

    const typeInter = document.querySelector('input[name="type_inter"]:checked').value;

    state.batch.push({
        vin: vin.toUpperCase(),
        windows: [...selectedWindows],
        type: typeInter,
        timestamp: new Date().toLocaleString('fr-FR'),
        obs: obsInput.value.trim() || "RAS"
    });

    saveState();
    renderBatch();

    // Reset interface
    vinInput.value = "";
    obsInput.value = "";
    selectedWindows = [];
    document.querySelectorAll('.window-btn').forEach(btn => btn.classList.remove('selected'));
    
    showModal("Ajouté !", "Le véhicule est dans la liste.", "success");
}

function renderBatch() {
    const container = document.getElementById('batch-container');
    document.getElementById('batch-count').innerText = state.batch.length;
    container.innerHTML = "";

    state.batch.forEach((v, index) => {
        const div = document.createElement('div');
        div.className = "bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2";
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
                ${v.windows.map(w => `<span class="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">${w}</span>`).join('')}
            </div>
            <div class="text-[11px] text-slate-500 italic mt-1 border-t pt-2 italic">
                Note : ${v.obs}
            </div>
        `;
        container.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
}

function removeItem(index) {
    state.batch.splice(index, 1);
    saveState();
    renderBatch();
}

// --- 6. SIGNATURE ---
function initSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let writing = false;

    // Ajuster taille canvas
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e) => { writing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if(!writing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
    const stop = () => { writing = false; };

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start);
    canvas.addEventListener('touchmove', move);
    canvas.addEventListener('touchend', stop);
}

function openSignature() {
    document.getElementById('signature-overlay').style.display = 'flex';
}

function clearSignature() {
    const canvas = document.getElementById('signature-pad');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function closeSignature() {
    const canvas = document.getElementById('signature-pad');
    state.signature = canvas.toDataURL();
    saveState();
    document.getElementById('signature-overlay').style.display = 'none';
    updateSignatureUI(true);
    showModal("Signature", "Signature enregistrée avec succès !", "success");
}

function resetSignature() {
    state.signature = null;
    saveState();
    updateSignatureUI(false);
    showModal("Supprimé", "La signature a été effacée.");
}

function updateSignatureUI(isSigned) {
    const btnSign = document.getElementById('btn-open-sign');
    const btnClear = document.getElementById('btn-clear-sign');
    
    if (isSigned) {
        btnSign.classList.replace('bg-amber-500', 'bg-green-600');
        btnSign.innerHTML = '<i data-lucide="check"></i> SIGNATURE ENREGISTRÉE';
        btnClear.classList.remove('hidden');
    } else {
        btnSign.classList.replace('bg-green-600', 'bg-amber-500');
        btnSign.innerHTML = '<i data-lucide="pen-tool"></i> SIGNER LE BON';
        btnClear.classList.add('hidden');
    }
    if (window.lucide) lucide.createIcons();
}

// --- 7. ENVOI FINAL ---
async function finalize() {
    if (state.batch.length === 0) return showModal("Lot vide", "Ajoute un véhicule d'abord.", "info");
    if (!state.signature) return showModal("Signature manquante", "Le client doit signer avant d'envoyer.", "info");

    const finalBtn = document.querySelector('button[onclick="finalize()"]');
    const originalContent = finalBtn.innerHTML;

    finalBtn.disabled = true;
    finalBtn.innerHTML = `<span>CHARGEMENT...</span>`;

    try {
        const response = await fetch("https://sheetdb.io/api/v1/gc2df6w3b42tw", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: state.batch.map(v => ({
                    "Date": "'" + v.timestamp,
                    "VIN": v.vin,
                    "Vitres": v.windows.join(', '),
                    "Type": v.type,
                    "Observations": v.obs,
                    "Signature": state.signature
                }))
            })
        });

        if (response.ok) {
            showModal("Succès", "Toutes les données ont été envoyées !", "success");
            setTimeout(() => {
                localStorage.clear();
                location.reload();
            }, 2000);
        } else {
            throw new Error();
        }
    } catch (e) {
        showModal("Erreur", "Problème de connexion. Vérifie ton réseau.", "info");
        finalBtn.disabled = false;
        finalBtn.innerHTML = originalContent;
    }
}
