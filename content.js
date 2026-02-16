// --- Config ---
const CONFIG = {
  threshold: 6, // seuil de masquage
  minTextLen: 180, // évite de scorer des textes trop courts
  debug: false
};

// Heuristiques simples (à affiner)
function scoreAI(text) {
  const t = (text || "").trim();
  if (t.length < CONFIG.minTextLen) return 0;

  let score = 0;

  // Signaux "structure IA" / ton générique
  const patterns = [
    { re: /\b(en résumé|pour conclure|en conclusion)\b/gi, w: 2 },
    { re: /\b(voici|voilà)\s+(quelques|3|5|7|10)\b/gi, w: 2 },
    { re: /\b(dans cet article|dans ce post)\b/gi, w: 2 },
    { re: /\b(les points clés|à retenir)\b/gi, w: 2 },
    { re: /\b(premièrement|deuxièmement|troisièmement)\b/gi, w: 2 },
    { re: /\b(n'hésitez pas à|dites-moi en commentaire|partagez votre avis)\b/gi, w: 1 },
    { re: /\b(je suis ravi|heureux d’annoncer|excité de partager)\b/gi, w: 1 },

    // Signaux "style corporate très lissé"
    { re: /\b(synergie|alignement|paradigme|levier|scalable|disruptif)\b/gi, w: 1 },

    // Listes / formatage typique
    { re: /(^|\n)\s*[-•]\s+/g, w: 1 },
    { re: /(^|\n)\s*\d+\)\s+/g, w: 1 }
  ];

  for (const p of patterns) {
    if (p.re.test(t)) score += p.w;
  }

  // Ponctuation/rythme “trop propre” (signal faible)
  const exclam = (t.match(/!/g) || []).length;
  if (exclam >= 3) score += 1;

  // Longueur importante + très peu de fautes (trop “parfait” → faible signal)
  if (t.length > 700) score += 1;

  return score;
}

// Remonte au "container" à masquer : à adapter
function findHideableContainer(node) {
  // Post : souvent un <div> parent "feed-shared-update-v2" / "update-components-actor" etc.
  // Commentaire : souvent un parent avec "comments-comment-item" ou similaire.
  // Ici, stratégie générique : remonter quelques niveaux.
  let el = node;
  for (let i = 0; i < 8 && el; i++) {
    if (el.getAttribute && el.getAttribute("data-ai-hidden-container") === "true") return el;
    // Si tu identifies une classe stable, mets-la ici.
    // Exemple (à ajuster) :
    if (el.classList && (el.classList.contains("feed-shared-update-v2") || el.classList.contains("comments-comment-item"))) {
      return el;
    }
    el = el.parentElement;
  }
  return node.closest("div");
}

function hideElement(container, score) {
  if (!container || container.dataset.aiHidden === "1") return;
  container.dataset.aiHidden = "1";

  // Marqueur + bouton "afficher"
  const badge = document.createElement("div");
  badge.style.cssText = "padding:10px;margin:8px 0;border:1px dashed #999;border-radius:8px;font-size:12px;";
  badge.innerText = `Masqué localement (score IA: ${score}). `;

  const btn = document.createElement("button");
  btn.textContent = "Afficher";
  btn.style.cssText = "margin-left:8px;cursor:pointer;font-size:12px;";
  btn.onclick = () => {
    container.style.display = "";
    container.dataset.aiHidden = "0";
  };

  badge.appendChild(btn);

  // Injecte le badge avant de masquer
  container.parentElement?.insertBefore(badge, container);

  container.style.display = "none";
}

function processTextNode(textEl) {
  const text = textEl.innerText || textEl.textContent || "";
  const s = scoreAI(text);
  if (CONFIG.debug && s > 0) console.log("[AI-Hider] score", s, text.slice(0, 120));

  if (s >= CONFIG.threshold) {
    const container = findHideableContainer(textEl);
    hideElement(container, s);
  }
}

function scan() {
  // Sélecteurs génériques : sur LinkedIn tu devras affiner
  const candidates = [
    ...document.querySelectorAll("div[dir='ltr'], span[dir='ltr']")
  ];

  for (const el of candidates) {
    // Évite de reprocess
    if (el.dataset.aiScanned === "1") continue;
    el.dataset.aiScanned = "1";

    // Filtre : uniquement ceux qui contiennent du texte “suffisant”
    const text = (el.innerText || "").trim();
    if (text.length < CONFIG.minTextLen) continue;

    processTextNode(el);
  }
}

// Observer pour infinite scroll
const observer = new MutationObserver(() => {
  // Petit debounce simple
  clearTimeout(window.__aiHideTimer);
  window.__aiHideTimer = setTimeout(scan, 250);
});

observer.observe(document.documentElement, { childList: true, subtree: true });

// Scan initial
scan();
