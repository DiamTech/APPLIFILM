// ==========================================
// CONFIGURATION & ETAT GLOBAL
// ==========================================

// ⚠️ IMPORTANT : Puisque nous avons fusionné le script Google, 
// mets LA MÊME URL (celle du script fusionné) pour les deux variables ci-dessous :
const URL_SCRIPT_GOOGLE = "https://script.google.com/macros/s/AKfycb.../exec"; // <-- COLLE TON URL ICI

const URL_VITRAGE = URL_SCRIPT_GOOGLE;
const URL_PRET = URL_SCRIPT_GOOGLE;

// Pré-chargement Logo
const logoApplifilm = new Image();
logoApplifilm.src = 'https://www.applifilm.fr/wp-content/uploads/2020/07/applifilm.png';
logoApplifilm.crossOrigin = "Anonymous";

// État de l'application
let state = { 
    vin: "", 
    selectedWindows: [], 
    photos: [], 
    batch: [], 
    signature: null,
    sentHistory: [],
    activeLoans: [], 
    dailyHistory: [],
    pret: { 
        permis_recto: null, 
        permis_verso: null,
        damages: [], 
        inspectionValidated: false,
        km_depart_initial: null
    },
    pretMode: 'DEPART', // 'DEPART' ou 'RETOUR'
    vehiculeType: 'VOITURE'
};

// Variables Scanner & Signature
let scanner = null;
let scannerMode = 'barcode';
let ocrInterval = null;
let canvas, ctx, drawing = false;

// ==========================================
// INITIALISATION
// ==========================================
window.addEventListener('load', () => {
    setTimeout(() => {
        initSignature();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 600);
        }
        
        setVehicle('VOITURE');
        
        // Si on est sur l'onglet Prêt, on charge les véhicules sortis
        if (!document.getElementById('view-pret').classList.contains('hidden')) {
            setPretMode('DEPART');
        }
    }, 100);
});

// Navigation
function switchView(view) {
    if (typeof toggleMenu === 'function') toggleMenu(false);

    const vVitrage = document.getElementById('view-vitrage'); 
    const vPret = document.getElementById('view-pret');
    const vHistory = document.getElementById('view-history');

    if(vVitrage) vVitrage.classList.add('hidden');
    if(vPret) vPret.classList.add('hidden');
    if(vHistory) vHistory.classList.add('hidden');

    if (view === 'pret') {
        if(vPret) vPret.classList.remove('hidden');
        setPretMode('DEPART'); // Reset mode par défaut
    } else if (view === 'history') {
        if(vHistory) vHistory.classList.remove('hidden');
    } else {
        if(vVitrage) vVitrage.classList.remove('hidden');
    }
}

// ==========================================
// MODULE PRÊT : LOGIQUE CŒUR
// ==========================================

// 1. Gestion Photos Permis
function handlePermis(input, type) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        if (!state.pret) state.pret = {};

        if (type === 'recto') state.pret.permis_recto = e.target.result;
        else state.pret.permis_verso = e.target.result;

        const targetId = type === 'recto' ? 'preview-recto' : 'preview-verso';
        const container = document.getElementById(targetId);
        if (container) {
            container.innerHTML = `<img src="${e.target.result}" class="absolute inset-0 w-full h-full object-cover rounded-2xl">`;
            container.style.border = "none";
        }
    };
    reader.readAsDataURL(file);
}

// 2. ENVOI DU DÉPART (CORRIGÉ AVEC VERSO)
async function finalizePret() {
    const btn = document.getElementById('btn-final-pret');
    
    // Récupération champs
    const techInput = document.getElementById('pret-tech-name');
    const clientInput = document.getElementById('pret-nom');
    const tech = techInput?.value.trim();
    const client = clientInput?.value.trim();

    // Reset styles erreurs
    if(techInput) techInput.style.border = "none";
    if(clientInput) clientInput.style.border = "none";

    // Validation de base
    if (!tech || !client) {
        if (!tech && techInput) techInput.style.border = "2px solid #ef4444";
        if (!client && clientInput) clientInput.style.border = "2px solid #ef4444";
        return alert("⚠️ Le nom du TECHNICIEN et du CLIENT sont obligatoires.");
    }

    // Récupération véhicule
    const selectVehicule = document.getElementById('pret-vehicule-select');
    const fullSelectValue = selectVehicule ? selectVehicule.value : "";
    let modeleExtraite = "Véhicule";
    let plaqueAuto = "";

    if (fullSelectValue.includes(':')) {
        const parts = fullSelectValue.split(':');
        modeleExtraite = parts[0].trim();
        plaqueAuto = parts[1].trim();
    } else { plaqueAuto = fullSelectValue; }

    const kmSaisi = parseInt(document.getElementById('pret-km-depart')?.value) || 0;
    
    // Autres inputs
    const inputs = {
        dob: document.getElementById('pret-dob')?.value,
        lieu_naiss: document.getElementById('pret-lieu-naiss')?.value.trim(),
        permis_num: document.getElementById('pret-permis-num')?.value.trim(),
        permis_lieu: document.getElementById('pret-permis-lieu')?.value.trim()
    };

    // Validations Logiques
    if (!plaqueAuto || plaqueAuto === "-- Choisir un véhicule --") return alert("⚠️ Choisis un véhicule !");
    if (kmSaisi <= 0) return alert("⚠️ Saisis le kilométrage !");
    if (!state.signature) return alert("⚠️ Signature obligatoire !");
    if (!state.pret.inspectionValidated) return alert("⚠️ Vous devez valider l'état des lieux !");

    if (state.pretMode === "DEPART") {
        if (!inputs.dob || !inputs.permis_num) return alert("⚠️ Infos client incomplètes !");
        if (!state.pret.permis_recto) return alert("⚠️ Photo Permis (Recto) manquante !");
        // Optionnel : forcer le verso aussi
        // if (!state.pret.permis_verso) return alert("⚠️ Photo Permis (Verso) manquante !");
    }

    // Préparation texte dégâts
    let texteSaisi = document.getElementById('pret-degats-obs')?.value.trim() || "";
    const nbCroix = state.pret.damages ? state.pret.damages.length : 0;
    let degatsFinalText = texteSaisi === "" ? (nbCroix > 0 ? `Dégâts schéma (${nbCroix} impacts)` : "Aucun dégât") : texteSaisi;

    // UI Chargement
    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "CRÉATION PDF...";

    try {
        const payload = {
            type: "PRET", // AIGUILLAGE DU SCRIPT GOOGLE
            status: state.pretMode,
            technicien: tech,
            client: client,
            immat: plaqueAuto,
            modele: modeleExtraite,
            km: kmSaisi,
            nom: client,
            dob: inputs.dob,
            lieu_naiss: inputs.lieu_naiss,
            permis_num: inputs.permis_num,
            permis_lieu: inputs.permis_lieu,
            degats_details: degatsFinalText,
            degats_coords: JSON.stringify(state.pret.damages || []),
            
            // --- CORRECTION MAJEURE ICI ---
            permis_recto: state.pret.permis_recto || "N/A",
            permis_verso: state.pret.permis_verso || "N/A", // C'est ajouté !
            
            signature: state.signature,
            date: new Date().toLocaleString('fr-FR')
        };

        // 1. Génération PDF
        const pdfBase64 = await generatePretPDF(payload, state.pretMode, tech, client);
        payload.pdfBase64 = pdfBase64;

        // 2. Envoi Google (Utilisation de URL_PRET et non SCRIPT_URL)
        await fetch(URL_PRET, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });

        alert(`✅ ${state.pretMode} ENREGISTRÉ !`);
        resetPretForm(); 
        switchView('vitrage');

    } catch(e) {
        console.error(e);
        alert("❌ Erreur envoi : " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// 3. Gestion du Retour (CORRIGÉ AVEC BONNE URL)
async function saveReturn() {
    const immat = document.getElementById('pret-vehicule-select').value;
    const kmRetour = parseInt(document.getElementById('pret-km-depart').value);
    const kmDepart = state.pret.km_depart_initial;

    if (isNaN(kmRetour) || (kmDepart && kmRetour < kmDepart)) {
        return alert(`⚠️ Erreur KM : Le retour (${kmRetour}) ne peut pas être inférieur au départ (${kmDepart}) !`);
    }

    const payload = {
        type: 'PRET',
        status: 'RETOUR',
        action: 'FINALIZE_RETURN',
        immat: immat,
        km: kmRetour,
        carburant_retour: document.getElementById('pret-carburant').value,
        degats_details: document.getElementById('pret-degats-obs').value,
        degats_coords: JSON.stringify(state.pret.damages), 
        date: new Date().toLocaleString('fr-FR'),
        
        // On récupère aussi les infos de base pour le PDF
        technicien: document.getElementById('pret-tech-name').value,
        client: document.getElementById('pret-nom').value,
        signature: state.signature
    };
    
    // On génère aussi un PDF pour le retour (Preuve de fin)
    // On simule un objet 'data' minimal pour le PDF
    const pdfData = {
        modele: "Véhicule",
        immat: immat,
        km: kmRetour,
        permis_num: document.getElementById('pret-permis-num').value,
        degats_details: payload.degats_details,
        signature: state.signature
    };
    
    // Génération PDF Retour
    const pdfBase64 = await generatePretPDF(pdfData, "RETOUR", payload.technicien, payload.client);
    payload.pdfBase64 = pdfBase64;

    try {
        const btn = document.getElementById('btn-final-pret');
        btn.innerText = "ENVOI RETOUR...";
        btn.disabled = true;

        await fetch(URL_PRET, { // CORRIGÉ : URL_PRET au lieu de SCRIPT_URL
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });
        
        alert("✅ Retour enregistré. Véhicule disponible.");
        resetPretForm();
        switchView('vitrage');
        
    } catch (e) {
        alert("❌ Erreur connexion.");
    } finally {
        const btn = document.getElementById('btn-final-pret');
        btn.innerText = "Enregistrer le retour";
        btn.disabled = false;
    }
}

// 4. Écouteur changement Véhicule (CORRIGÉ AVEC BONNE URL)
document.getElementById('pret-vehicule-select')?.addEventListener('change', async function(e) {
    const immat = e.target.value;
    
    if (!immat || state.pretMode !== 'DEPART') return;

    try {
        // CORRIGÉ : URL_PRET au lieu de SCRIPT_URL
        const response = await fetch(URL_PRET, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'GET_LAST_STATE', 
                immat: immat 
            })
        });
        
        const res = await response.json();

        if (res.status === "success") {
            const lastCoords = JSON.parse(res.coords || "[]");
            state.pret.damages = lastCoords.map(c => ({
                x: c.x, y: c.y, type: 'new' // On les met en rouge pour info
            }));
            
            const kmInput = document.getElementById('pret-km-depart');
            if (kmInput) kmInput.value = res.km || "";
            
            const obsInput = document.getElementById('pret-degats-obs');
            if (obsInput) obsInput.value = res.details || "";
            
            renderDamages();
            alert("✅ Historique véhicule chargé.");
        } else {
            state.pret.damages = [];
            renderDamages();
        }
    } catch (err) {
        console.error("Erreur historique:", err);
    }
});


// ==========================================
// MODULE PDF (PRÊT & VITRAGE)
// ==========================================

async function generatePretPDF(data, mode, tech, client) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const primaryColor = mode === "DEPART" ? [79, 70, 229] : [16, 185, 129];
    
    // Fonction image secure
    const getLogoData = (url) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = 'https://images.weserv.nl/?url=' + encodeURIComponent(url);
            img.crossOrigin = 'Anonymous'; 
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(null);
        });
    };

    // Logo
    const logoUrl = 'https://www.applifilm.fr/wp-content/uploads/2020/07/applifilm.png';
    const logoData = await getLogoData(logoUrl);

    if (logoData) {
        doc.addImage(logoData, 'PNG', 20, 10, 40, 15);
    } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("APPLIFILM", 20, 25);
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`CONTRAT DE PRÊT VÉHICULE - ${mode}`, pageWidth - 20, 22, { align: "right" });

    // Ligne séparation
    doc.setDrawColor(230);
    doc.line(20, 35, pageWidth - 20, 35);

    // Infos
    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.text(`Technicien : ${tech.toUpperCase()}`, 20, 45);
    doc.text(`Client : ${client.toUpperCase()}`, 20, 52);
    doc.text(`Date : ${new Date().toLocaleString('fr-FR')}`, pageWidth - 20, 45, { align: "right" });

    // Tableau
    const rows = [
        ["VÉHICULE", `${data.modele} (${data.immat})`],
        ["KILOMÉTRAGE", `${data.km} km`],
        ["PERMIS", data.permis_num || "N/A"],
    ];

    if (mode === "RETOUR" && state.pret.km_depart_initial) {
        const diff = data.km - state.pret.km_depart_initial;
        rows.push(["DISTANCE PARCOURUE", `${diff} km`]);
    }

    doc.autoTable({
        startY: 60,
        head: [['CATÉGORIE', 'DÉTAILS']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: primaryColor }
    });

    // Etat
    let yPos = doc.lastAutoTable.finalY + 15;
    doc.setFont("helvetica", "bold");
    doc.text("ÉTAT DES LIEUX / OBSERVATIONS :", 20, yPos);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const splitObs = doc.splitTextToSize(data.degats_details || "RAS", pageWidth - 40);
    doc.text(splitObs, 20, yPos + 7);

    yPos = yPos + (splitObs.length * 5) + 20;

    // --- AJOUT PHOTOS PERMIS DANS LE PDF (Optionnel mais recommandé) ---
    if (data.permis_recto && data.permis_recto.length > 100) {
        if (yPos > 200) { doc.addPage(); yPos = 20; }
        doc.setFont("helvetica", "bold");
        doc.text("PERMIS RECTO :", 20, yPos);
        try { doc.addImage(data.permis_recto, 'JPEG', 20, yPos + 5, 60, 40); } catch(e){}
    }
    
    if (data.permis_verso && data.permis_verso.length > 100) {
        const xVerso = data.permis_recto ? 100 : 20;
        doc.text("PERMIS VERSO :", xVerso, yPos);
        try { doc.addImage(data.permis_verso, 'JPEG', xVerso, yPos + 5, 60, 40); } catch(e){}
        yPos += 50; 
    }

    // Signature
    if (yPos > 240) { doc.addPage(); yPos = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("SIGNATURE DU CLIENT :", 20, yPos);
    if(data.signature) {
        doc.addImage(data.signature, 'PNG', 20, yPos + 5, 50, 25);
    }

    // Pied de page
    doc.setFontSize(7);
    doc.setTextColor(150);
    const mentions = [
        "Le client reconnaît prendre/rendre le véhicule dans l'état décrit ci-dessus.",
        "En cas de sinistre, la franchise reste à la charge du client.",
        "APPLIFILM - Prêt de véhicule de courtoisie."
    ];
    mentions.forEach((m, i) => doc.text(m, pageWidth / 2, 280 + (i * 3), { align: "center" }));

    return doc.output('datauristring', { compress: true });
}

// ==========================================
// RESTE DU CODE (UTILITAIRES)
// ==========================================

// Fonction de mode Prêt (Départ/Retour)
function setPretMode(mode) {
    state.pretMode = mode;
    const isDepart = mode === 'DEPART';
    
    const btnDepart = document.getElementById('btn-mode-depart');
    const btnRetour = document.getElementById('btn-mode-retour');
    const btnFinal = document.getElementById('btn-final-pret');
    const title = document.querySelector('#view-pret h2');
    const loansListWrapper = document.getElementById('active-loans-wrapper');

    const baseClass = "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-200 ";

    if (isDepart) {
        if(btnDepart) btnDepart.className = baseClass + "bg-indigo-600 text-white shadow-md shadow-indigo-100";
        if(btnRetour) btnRetour.className = baseClass + "bg-transparent text-slate-400";
        if(btnFinal) {
            btnFinal.className = "w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 mt-6";
            btnFinal.innerHTML = '<span>Valider le départ</span> <i data-lucide="check" class="w-4 h-4"></i>';
            // Important : on branche le clic sur finalizePret
            btnFinal.onclick = finalizePret; 
        }
        
        if (title) title.innerText = "Nouveau Prêt";
        if (loansListWrapper) loansListWrapper.classList.add('hidden');
        resetPretForm(); 
    } else {
        if(btnRetour) btnRetour.className = baseClass + "bg-emerald-500 text-white shadow-md shadow-emerald-100";
        if(btnDepart) btnDepart.className = baseClass + "bg-transparent text-slate-400";
        if(btnFinal) {
            btnFinal.className = "w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 mt-6";
            btnFinal.innerHTML = '<span>Enregistrer le retour</span> <i data-lucide="log-in" class="w-4 h-4"></i>';
            // Important : on branche le clic sur saveReturn
            btnFinal.onclick = saveReturn;
        }
        
        if (title) title.innerText = "Retour de Véhicule";
        
        if (loansListWrapper) {
            loansListWrapper.classList.remove('hidden');
            fetchActiveLoans(); 
        }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function fetchActiveLoans() {
    const wrapper = document.getElementById('active-loans-wrapper'); 
    const container = document.getElementById('loans-container');
    if (!wrapper || !container) return;

    container.innerHTML = '<div class="text-[10px] font-black text-center py-8 text-indigo-400 animate-pulse uppercase tracking-widest">Recherche des véhicules...</div>';

    try {
        const response = await fetch(URL_PRET);
        const loans = await response.json();
        state.activeLoans = loans;

        if (!loans || loans.length === 0) {
            container.innerHTML = `<div class="p-8 text-center border-2 border-dashed border-slate-200 rounded-[2rem]"><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Aucun véhicule dehors</p></div>`;
            return;
        }

        container.innerHTML = loans.map(loan => {
            const datePropre = loan.date ? new Date(loan.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'}) : '--/--';
            const titre = (loan.modele && loan.modele !== "Véhicule") ? loan.modele : loan.immat;
            const sousTitre = (loan.modele && loan.modele !== "Véhicule") ? loan.immat : "IMMATRICULATION";
            
            return `
                <button type="button" onclick="selectLoanForReturn('${loan.immat}')" 
                        class="w-full bg-indigo-600 p-5 rounded-[2rem] text-left shadow-lg mb-2 flex flex-col gap-5 active:scale-95 transition-all border-b-4 border-indigo-900">
                    <div class="flex justify-between items-start">
                        <div class="flex flex-col">
                            <span class="text-[9px] font-black text-indigo-200 opacity-70">VÉHICULE</span>
                            <span class="font-black text-white text-lg">${titre}</span>
                            <span class="text-[10px] font-bold text-indigo-100 italic">${sousTitre}</span>
                        </div>
                        <span class="text-[10px] font-black bg-black/20 text-white px-3 py-1.5 rounded-xl border border-white/10">LE ${datePropre}</span>
                    </div>
                    <div class="flex justify-between items-end border-t border-white/10 pt-3">
                        <span class="text-xs font-bold text-white uppercase">${loan.nom}</span>
                        <span class="text-xs font-black text-white">${loan.km} KM</span>
                    </div>
                </button>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<div class="text-[10px] font-bold text-center py-4 text-red-400">⚠️ Erreur connexion</div>';
    }
}

function selectLoanForReturn(immat) {
    const loan = state.activeLoans.find(l => l.immat === immat);
    if (!loan) return alert("❌ Dossier introuvable.");

    state.pretMode = 'RETOUR';
    toggleFormLock(true); 
    
    // Remplissage infos
    if(document.getElementById('pret-tech-name')) document.getElementById('pret-tech-name').value = ""; 
    resetSignature(); 

    const selectVehicule = document.getElementById('pret-vehicule-select');
    if (selectVehicule) {
        for (let option of selectVehicule.options) {
            if (option.value.includes(immat)) {
                selectVehicule.value = option.value;
                break;
            }
        }
    }

    document.getElementById('pret-nom').value = loan.nom || "";
    document.getElementById('pret-lieu-naiss').value = loan.lieu_naiss || "";
    document.getElementById('pret-permis-num').value = loan.permis_num || "";
    document.getElementById('pret-permis-lieu').value = loan.permis_lieu || "";
    
    if (loan.dob) {
        const d = new Date(loan.dob);
        if (!isNaN(d)) document.getElementById('pret-dob').value = d.toISOString().split('T')[0];
    }

    state.pret.km_depart_initial = parseInt(loan.km) || 0;
    const kmInput = document.getElementById('pret-km-depart');
    if(kmInput) {
        kmInput.placeholder = "KM Départ : " + loan.km;
        kmInput.value = ""; 
    }
    
    // Affichage Photos Drive
    const renderPhoto = (id, url) => {
        const zone = document.getElementById(id);
        if (!zone) return;
        if (url && url.length > 10) {
            zone.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-xl border-2 border-indigo-500 shadow-lg">`;
            zone.style.border = "none";
        } else {
            zone.innerHTML = `<div class="text-[10px] text-slate-500 font-bold italic">AUCUN DOC</div>`;
        }
    };
    
    renderPhoto('preview-recto', loan.recto);
    renderPhoto('preview-verso', loan.verso);

    // switch vue
    setPretMode('RETOUR'); 
    alert("✅ Véhicule chargé. Entrez le KM de retour.");
}

function toggleFormLock(isReturn) {
    const fieldsToLock = ['pret-vehicule-select', 'pret-nom', 'pret-dob', 'pret-lieu-naiss', 'pret-permis-num', 'pret-permis-lieu'];
    fieldsToLock.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'SELECT') el.disabled = isReturn;
            else el.readOnly = isReturn;
            
            if (isReturn) {
                el.style.backgroundColor = '#e2e8f0';
                el.style.fontWeight = '800';
            } else {
                el.style.backgroundColor = "";
                el.style.fontWeight = "";
            }
        }
    });
    
    // Bloquer upload photos en retour
    const inputs = document.querySelectorAll('#preview-recto input, #preview-verso input');
    inputs.forEach(i => i.disabled = isReturn);
}

// ==========================================
// OUTILS (Scanner, Signature, etc.)
// ==========================================

// ... (Garde tes fonctions initSignature, openSignature, etc. telles quelles)
function initSignature() {
    canvas = document.getElementById('canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const ev = e.touches ? e.touches[0] : e;
        return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };

    const start = (e) => { 
        if (e.target === canvas) e.preventDefault(); 
        drawing = true; 
        const p = getPos(e); 
        ctx.beginPath(); 
        ctx.moveTo(p.x, p.y); 
    };

    const move = (e) => { 
        if (!drawing) return; 
        if (e.target === canvas) e.preventDefault(); 
        const p = getPos(e); 
        ctx.lineTo(p.x, p.y); 
        ctx.stroke(); 
    };

    const stop = () => { drawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', stop);
}

function openSignature() { 
    const vPret = document.getElementById('view-pret');
    const isPretVisible = vPret && !vPret.classList.contains('hidden');

    if (isPretVisible && (!state.pret || !state.pret.inspectionValidated)) {
        return alert("⚠️ Bloqué : Validez d'abord l'inspection !");
    }

    const modal = document.getElementById('modal-sig');
    if (modal) modal.classList.remove('hidden'); 
    
    setTimeout(() => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.strokeStyle = "#4f46e5"; 
        ctx.lineWidth = 3; 
        ctx.lineCap = "round";
    }, 250);
}

function closeSignature() { 
    const modal = document.getElementById('modal-sig');
    if (modal) modal.classList.add('hidden'); 
}

function saveSignature() { 
    state.signature = canvas.toDataURL('image/png'); 
    
    // Feedback Prets
    const sigBtnPret = document.querySelector('#signature-section button');
    if (sigBtnPret) {
        sigBtnPret.innerHTML = '<span>✅ SIGNATURE OK</span>';
        sigBtnPret.className = "w-full bg-green-500 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-green-200";
    }

    // Feedback Vitrage
    const sigStatusVitrage = document.getElementById('sig-status'); 
    if (sigStatusVitrage) sigStatusVitrage.classList.remove('hidden'); 
    
    closeSignature(); 
}

function clearCanvas() { 
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height); 
}

function resetSignature() { 
    state.signature = null; 
    clearCanvas(); 
    const sigBtn = document.querySelector('#signature-section button');
    if (sigBtn) {
        sigBtn.innerHTML = "Faire signer le client";
        sigBtn.className = "w-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 py-4 rounded-2xl font-black text-xs uppercase border-2 border-dashed border-indigo-200";
    }
}
