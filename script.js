let envoiEnCours = false;

// --- 1. GESTION DE LA SUPPRESSION ---
// On l'attache à window pour être sûr que le HTML la trouve
window.supprimerVehicule = function(index) {
    if (confirm("Supprimer ce véhicule ?")) {
        state.batch.splice(index, 1);
        saveState(); 
        renderBatch(); 
        console.log("Véhicule supprimé, index:", index);
    }
}

// --- 2. FONCTION D'ENVOI ---
async function finalize() {
    if (envoiEnCours) return;
    
    // Vérifications de base
    if (state.batch.length === 0) return alert("❌ La liste est vide.");
    
    // Note: J'ai commenté la signature pour que tu puisses tester sans bloquer
    // if (!state.signature) return alert("❌ Signature manquante.");

    envoiEnCours = true;
    
    // On cherche le bouton pour changer son état
    const btn = document.querySelector('button[onclick="finalize()"]') || document.getElementById('btn-envoyer');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = "⏳ Envoi vers Google Sheets...";
    }

    try {
        // Préparation des données pour SheetDB
        const payload = {
            data: state.batch.map(v => ({
                "Date": new Date().toLocaleString('fr-FR'),
                "VIN": v.vin ? v.vin.toUpperCase() : "INCONNU",
                "Type": v.type || "Non spécifié",
                "Vitres": Array.isArray(v.windows) ? v.windows.join(', ') : (v.windows || ""),
                "Observations": v.obs || "",
                "Signature": state.signature || "Sans signature"
            }))
        };

        console.log("Envoi en cours...", payload);

        const response = await fetch('https://sheetdb.io/api/v1/gc2df6w3b42tw', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("✅ Données envoyées avec succès !");
            
            // Nettoyage
            state.batch = [];
            state.signature = null;
            localStorage.removeItem('appliFilmState');
            
            // Rafraîchir l'affichage au lieu de recharger toute la page (plus fluide)
            renderBatch(); 
            if(btn) btn.innerHTML = "FINALISER ET ENVOYER";
        } else {
            const errorData = await response.json();
            alert("❌ Erreur SheetDB: " + (errorData.error || "Problème de connexion"));
        }

    } catch (error) {
        console.error("Erreur d'envoi:", error);
        alert("❌ Erreur réseau. Vérifiez votre connexion internet.");
    } finally {
        envoiEnCours = false;
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = "FINALISER ET ENVOYER";
        }
    }
}
