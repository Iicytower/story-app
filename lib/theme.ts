export const THEME_STORAGE_KEY = "theme";

// Runs in <head> before first paint; light is the server-rendered default.
export const themeScript = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
