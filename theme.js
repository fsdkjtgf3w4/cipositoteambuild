const KEY = "cipocity-theme";

function getTheme(){
    return localStorage.getItem(KEY) || "day";
}

function applyTheme(theme){
    document.body.classList.toggle("night", theme === "night");
    localStorage.setItem(KEY, theme);
    updateButton(theme);
}

function toggleTheme(){
    const next = getTheme() === "night" ? "day" : "night";
    applyTheme(next);
}

// bottone globale
function updateButton(theme){
    const btn = document.getElementById("themeToggle");
    if(!btn) return;

    btn.textContent = theme === "night" ? "🌙" : "☀️";
}

// inizializza subito
applyTheme(getTheme());

// aggiorna bottone quando DOM pronto
document.addEventListener("DOMContentLoaded", () => {
    updateButton(getTheme());
});