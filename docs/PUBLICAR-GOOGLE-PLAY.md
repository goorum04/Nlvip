# Publicar NL VIP Team en Google Play

Esta guía cubre todo lo necesario para publicar la app Android en Google Play,
usando el pipeline automatizado (`android-release`) ya configurado en
`codemagic.yaml`, análogo al que ya existe para iOS.

## 0. Qué ya está hecho en el repo

- `android/` — proyecto nativo Android generado con Capacitor 5 (`applicationId`
  `com.leonardos.app`, igual que el `BUNDLE_ID` de iOS).
- `compileSdkVersion` / `targetSdkVersion` en `35` (Android 15), el mínimo que
  exige Google Play para subir o actualizar apps en 2025-2026.
- Iconos adaptativos y splash screen (claro/oscuro) generados desde
  `resources/icon.png` y `resources/splash/splash.svg` con `@capacitor/assets`.
- `android/app/build.gradle` con firma de release configurable por
  `keystore.properties` (local, no se commitea) o por variables de entorno en
  CI — nunca hay una keystore ni contraseñas en el repo.
- `versionCode` / `versionName` se inyectan en build time vía
  `ANDROID_VERSION_CODE` / `ANDROID_VERSION_NAME` (en CI, a partir del
  `BUILD_NUMBER` de Codemagic, igual que la versión de marketing en iOS).
- Workflow `android-release` en `codemagic.yaml`: build de Next.js estático →
  `cap sync android` → firma → `./gradlew bundleRelease` → publicación
  automática a Google Play (pista **interna**, como borrador).

Lo que **no** puede hacerse desde el repo — requiere tus cuentas y credenciales:

## 1. Cuenta de Google Play Developer

1. Crea una cuenta en [Play Console](https://play.google.com/console) (pago
   único de 25 USD).
2. Crea la app: nombre "NL VIP Team", tipo "App", gratuita, y acepta las
   declaraciones de contenido.

## 2. Generar la keystore de firma (una sola vez, y guardarla para siempre)

Google Play exige que **todas** las actualizaciones futuras estén firmadas con
la misma clave (o gestionadas por Play App Signing, recomendado). Genera la
keystore en tu máquina, **no** en CI:

```bash
keytool -genkeypair -v \
  -keystore nlvip-release.keystore \
  -alias nlvip-release \
  -keyalg RSA -keysize 2048 -validity 10000
```

Guarda `nlvip-release.keystore` y las contraseñas en un gestor de secretos —
si se pierden, no podrás volver a actualizar la app con el mismo
`applicationId`.

Al subir el primer AAB, activa **Play App Signing** (Play Console te lo
propone automáticamente): Google guarda la clave de firma definitiva y tu
keystore pasa a ser solo la "clave de subida" (upload key), más fácil de
rotar si se compromete.

## 3. Subir la keystore a Codemagic

En Codemagic → *Team/Personal Settings* → **Code signing identities** →
**Android**:

- Sube `nlvip-release.keystore`.
- Nombra la referencia exactamente `nlvip_release_keystore` (así está
  referenciado en `codemagic.yaml` bajo `android_signing`).
- Introduce el alias y las contraseñas del paso anterior.

## 4. Cuenta de servicio para publicar automáticamente

1. En [Google Cloud Console](https://console.cloud.google.com/), en el mismo
   proyecto (o uno nuevo), habilita la **Google Play Android Developer API**.
2. Crea una cuenta de servicio y descarga su clave JSON.
3. En Play Console → **Configuración** → **Acceso a la API**, vincula el
   proyecto de Google Cloud y da permisos de "Release manager" a esa cuenta de
   servicio para la app NL VIP Team.
4. En Codemagic → *Team/Personal Settings* → **Environment variables**, crea
   un grupo llamado `google_play` con una variable `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`
   que contenga el **contenido completo del JSON** (márcala como *Secure*).

## 5. Ficha de la tienda (Play Console)

Antes de poder publicar en cualquier pista necesitas completar, en Play
Console → **Presencia en la tienda**:

- Descripción corta (80 caracteres) y completa (4000 caracteres).
- Ícono 512×512 (puedes exportarlo de `resources/icon.png`, 1024×1024, y
  reducirlo).
- Gráfico destacado 1024×500.
- Al menos 2 capturas de pantalla de teléfono (mínimo 320px, máximo 3840px de
  lado).
- Categoría (Salud y fitness) y datos de contacto.
- **Política de privacidad**: URL pública. El contenido ya existe en
  `public/privacy-policy.md` (ruta `app/privacy`) — publícala en tu dominio de
  producción y usa esa URL, p. ej. `https://tu-dominio.com/privacy`.
- **Cuestionario de clasificación de contenido** (IARC): complétalo en Play
  Console → *Clasificación de contenido*.
- **Formulario de seguridad de datos** (Data safety): declara qué datos
  recoge la app — cuentas (Supabase Auth), fotos de progreso, datos de salud
  (ciclo menstrual, pasos), y si se comparten con terceros (OpenAI/Anthropic
  para IA, Sentry para errores). Sé exhaustivo: Google rechaza fichas
  incompletas o inconsistentes con el comportamiento real de la app.

## 6. Primera subida (manual, obligatoria)

Google Play **no permite** que la primera versión de una app se suba por API:
la primera subida siempre es manual desde la consola.

1. Dispara el workflow `android-release` en Codemagic manualmente (Start new
   build) para generar el primer `.aab` firmado — descárgalo de los
   artifacts, **sin** que el paso de publicación falle si la API aún no está
   vinculada (puedes comentar temporalmente el bloque `publishing` en
   `codemagic.yaml` para este primer build si Play Console todavía no acepta
   subidas por API).
2. En Play Console → **Pruebas** → **Interna** → **Crear versión nueva**, sube
   ese `.aab` manualmente.
3. Completa el resto de la ficha de la tienda (paso 5) y envía la app para
   revisión inicial de Google.

## 7. Builds siguientes: automáticos

Una vez completado el paso 6, cada `push` a `main` (o un build manual en
Codemagic) ejecuta `android-release`, que:

1. Compila el export estático de Next.js (`next.config.mobile.js`).
2. Sincroniza Capacitor (`cap sync android`).
3. Firma el `.aab` con la keystore configurada.
4. Sube automáticamente el `.aab` a la pista **interna** de Google Play como
   borrador (`submit_as_draft: true`), usando la cuenta de servicio del paso
   4.

Desde Play Console puedes promocionar esa versión de *Interna* → *Cerrada* →
*Abierta* → *Producción* cuando estés listo, o cambiar el `track` en
`codemagic.yaml` (p. ej. a `production`) una vez que confíes en el pipeline.

## 8. Notas y troubleshooting

- **`applicationId` fijo**: `com.leonardos.app`, el mismo namespace que ya usa
  la app iOS (`com.leonardos.app` como `BUNDLE_ID`). No lo cambies una vez
  publicada la app: Play Store lo trata como identidad permanente.
- **`versionCode` duplicado**: si un build falla después de subir a Play
  Store, el siguiente build de Codemagic usará un `BUILD_NUMBER` mayor
  automáticamente, así que nunca deberías reenviar el mismo `versionCode`.
- **Google Fit / notificaciones push**: los plugins `@capacitor/push-notifications`
  y el SDK de Google Fit están instalados pero no conectados en el código
  todavía. Si se activan más adelante, habrá que añadir `google-services.json`
  (Firebase) como secreto en Codemagic — no se commitea al repo
  (`android/.gitignore` ya lo excluye).
- **Compilar localmente**: necesitas Android Studio / Android SDK + JDK 17.
  `npm run cap:android` añade la plataforma si falta y sincroniza; luego
  `npx cap open android` abre el proyecto en Android Studio.
