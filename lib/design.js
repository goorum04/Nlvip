// Diseño negro y oro ("nuevo") frente al diseño clásico.
//
// Desde la versión 1.81 el diseño nuevo es el de todos. Como salida de
// emergencia, ?diseno=clasico vuelve al anterior en ese dispositivo (se
// recuerda) y ?diseno=nuevo deshace esa elección.
// El script de app/layout.js pone la clase en <html> antes de pintar nada, así
// no hay parpadeo; los componentes solo leen esa clase.

export const DESIGN_STORAGE_KEY = 'nlvip_design'
export const GOLD_CLASS = 'nl-gold'

// Se inyecta tal cual en <head>: debe ser JS plano y no fallar nunca. Si el
// almacenamiento local no está disponible, se queda el diseño nuevo.
export const DESIGN_BOOT_SCRIPT = `(function(){var c=false;try{
var k='${DESIGN_STORAGE_KEY}',p=new URLSearchParams(window.location.search).get('diseno');
c=p==='clasico';
if(p==='nuevo'||p==='oro'){localStorage.removeItem(k)}
else if(c){localStorage.setItem(k,'classic')}
c=c||localStorage.getItem(k)==='classic';
}catch(e){}
try{if(!c){document.documentElement.classList.add('${GOLD_CLASS}');
document.addEventListener('DOMContentLoaded',function(){var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute('content','#0B0B0C')}})}
}catch(e){}})();`

export function isGoldDesign() {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains(GOLD_CLASS)
}

// Color de la paleta actual como "rgb(r, g, b)" (para gráficas SVG que no
// aceptan variables CSS en sus atributos). shade: 'violet-500', 'cyan-500'...
export function themeRgb(shade, fallback) {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--nlc-${shade}`).trim()
  return v ? `rgb(${v.split(/\s+/).join(', ')})` : fallback
}
