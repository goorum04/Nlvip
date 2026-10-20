// Comprueba/pide permisos de cámara y galería antes de Camera.getPhoto.
// Devuelve true si se puede abrir el selector (Prompt ofrece cámara O galería,
// así que basta con una de las dos). En iOS la galería puede quedar en
// 'limited' ("Seleccionar fotos…"), que funciona perfectamente — tratarlo
// como denegado bloqueaba la revisión a socios que sí habían aceptado.
const USABLE = new Set(['granted', 'limited'])

export async function ensureCameraPermissions(Camera) {
  const usable = (s) => USABLE.has(s?.camera) || USABLE.has(s?.photos)
  const status = await Camera.checkPermissions()
  if (usable(status)) return true
  const request = await Camera.requestPermissions()
  return usable(request)
}

export const CAMERA_PERMISSION_ERROR = 'Sin acceso a la cámara ni a la galería. Actívalo en Ajustes > NL VIP Team.'
