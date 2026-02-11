let envoiEnCours = false;

// --- 1. GESTION DE LA SUPPRESSION ---
function supprimerVehicule(index) {
    // 1. On retire l'élément du tableau state.batch
    state.batch.splice(index, 1);
    
    // 2. On sauvegarde le nouvel état dans le localStorage
    saveState(); 
    
    // 3. On rafraîchit l'affichage de la liste
    renderBatch(); 
    
    // Optionnel : un petit message discret
    console.log("Véhicule supprimé, index:", index);
}

// --- 2. FONCTION D'ENVOI (VERSION NETTOYÉE) ---
async function finalize() {
    if (envoiEnCours) return;
    
    if (state.batch.length === 0) return alert("❌ Lot vide.");
    if (!state.signature) return alert("❌ Signature manquante.");

    envoiEnCours = true;
    const btn = document.querySelector('button[onclick="finalize()"]');
    btn.disabled = true;
    btn.innerHTML = "⏳ Envoi...";

    try {
        const resBefore = await fetch('https://sheetdb.io/api/v1/gc2df6w3b42tw?keys=VIN');
        const dataBefore = await resBefore.json();
        const nbAvant = Array.isArray(dataBefore) ? dataBefore.length : 0;

        await fetch('https://sheetdb.io/api/v1/gc2df6w3b42tw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: state.batch.map(v => ({
                    "Date": new Date().toLocaleString('fr-FR'),
                    "VIN": v.vin.toUpperCase(),
                    "Type": v.type,
                    "Vitres": v.windows.join(', '),
                    "Observations": v.obs || "",
                    "Signature": state.signature
                }))
            })
        });

        await new Promise(r => setTimeout(r, 5000)); 

        const resAfter = await fetch('https://sheetdb.io/api/v1/gc2df6w3b42tw?keys=VIN');
        const dataAfter = await resAfter.json();
        const nbApres = Array.isArray(dataAfter) ? dataAfter.length : 0;

        if (nbApres > nbAvant) {
            alert("Envoi réussi");
            state.batch = [];
            state.signature = null;
            localStorage.removeItem('appliFilmState');
            window.location.reload();
            return; 
        }

    } catch (error) {
        console.error("Erreur silencieuse:", error);
    }

    envoiEnCours = false;
    btn.disabled = false;
    btn.innerHTML = "FINALISER ET ENVOYER";
}