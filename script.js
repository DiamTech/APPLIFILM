// --- CONFIGURATION ET ÉTAT ---
let state = JSON.parse(localStorage.getItem('appliFilmState')) || {
    batch: [],
    signature: null
};

let envoiEnCours = false;

function saveState() {
    localStorage.setItem('appliFilmState', JSON.stringify(state));
}

// --- GESTION DES VITRES ---
let selectedWindows = [];
function toggleWindow(name, btn) {
    const index = selectedWindows.indexOf(name);
    if (index > -1) {
        selectedWindows.splice(index, 1);
        btn.style.backgroundColor = ""; 
        btn.style.color = "";
    } else {
        selectedWindows.push(name);
        btn.style.backgroundColor = "#28a745";
        btn.style.color = "white";
    }
}

// --- SYSTÈME D'ENVOI (LA CORRECTION) ---
async function finalize() {
    if (envoiEnCours) return;
    if (state.batch.length === 0) return alert("❌ Aucun véhicule dans la liste.");

    envoiEnCours = true;
    const btnEnvoi = document.getElementById('btn-envoyer');
    if(btnEnvoi) {
        btnEnvoi.disabled = true;
        btnEnvoi.innerHTML = "⏳ ENVOI EN COURS...";
    }

    try {
        const response = await fetch('https://sheetdb.io/api/v1/gc2df6w3b42tw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: state.batch.map(v => ({
                    "Date": new Date().toLocaleString('fr-FR'),
                    "VIN": v.vin.toUpperCase(),
                    "Type": v.type,
                    "Vitres": v.windows.join(', '),
                    "Observations": v.obs || "",
                    "Signature": state.signature || "Validé"
                }))
            })
        });

        if (response.ok) {
            alert("✅ Données envoyées avec succès !");
            state.batch = [];
            state.signature = null;
            saveState();
            location.reload(); 
        } else {
            alert("❌ Erreur SheetDB. Vérifiez votre quota.");
        }
    } catch (error) {
        alert("❌ Erreur réseau : " + error.message);
    } finally {
        envoiEnCours = false;
        if(btnEnvoi) {
            btnEnvoi.disabled = false;
            btnEnvoi.innerHTML = "FINALISER ET ENVOYER";
        }
    }
}

// --- INITIALISATION ---
window.onload = () => {
    console.log("Moteur de l'application démarré");
    // Remets ici tes fonctions de rendu de liste si nécessaire (renderBatch)
};
