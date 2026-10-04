export const THEME_KEY = 'salu-theme'

/**
 * Inline script for <head>: applies the theme before first paint (no flash).
 * No saved choice => follows the operating system (prefers-color-scheme), live.
 */
export const themeInitScript = `(function(){try{var k='${THEME_KEY}',d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');var a=function(){var s=localStorage.getItem(k);d.dataset.theme=s==='light'||s==='dark'?s:(m.matches?'dark':'light')};a();m.addEventListener&&m.addEventListener('change',a)}catch(e){}})();`
