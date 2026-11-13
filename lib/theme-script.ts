const KEY = "theme";

/**
 * Runs in <head> before first paint so there is no flash of the wrong theme.
 * Keep in sync with resolve() in lib/theme-store.ts.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})()`;
