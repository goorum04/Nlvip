# 📱 NL VIP CLUB - Guía de Publicación en App Store

## ✅ Lo que ya está preparado:
- [x] Capacitor instalado y configurado
- [x] Íconos SVG listos para convertir
- [x] Splash screen diseñado
- [x] Configuración de la app (capacitor.config.ts)
- [x] Scripts de build

---

## 🍎 PUBLICAR EN APP STORE (iOS)

### Requisitos previos:
1. **Mac** con macOS 11 o superior
2. **Xcode** 13 o superior (descargar de App Store)
3. **Cuenta Apple Developer** ($99/año) - https://developer.apple.com
4. **Certificados** configurados en Xcode

### Pasos en tu Mac:

#### 1. Clonar/Copiar el proyecto
```bash
# Si tienes git:
git clone <tu-repo> nl-vip-club
cd nl-vip-club

# O copia manualmente los archivos
```

#### 2. Instalar dependencias
```bash
yarn install
```

#### 3. Generar íconos (en Mac)
```bash
# Instala imagemagick si no lo tienes
brew install imagemagick

# Genera los íconos PNG desde el SVG
cd resources/icon
for size in 20 29 40 58 60 76 80 87 120 152 167 180 1024; do
  convert -background none icon.svg -resize ${size}x${size} icon-${size}.png
done
```

#### 4. Crear build de producción
```bash
# Build de Next.js
yarn build

# Exportar archivos estáticos
npx next export -o out

# Añadir plataforma iOS
npx cap add ios

# Sincronizar
npx cap sync ios
```

#### 5. Abrir en Xcode
```bash
npx cap open ios
```

#### 6. En Xcode:
1. Selecciona tu **Team** (cuenta de desarrollador)
2. Cambia el **Bundle Identifier** si es necesario: `com.nlvipclub.app`
3. Ve a **Signing & Capabilities** → activa "Automatically manage signing"
4. Selecciona un dispositivo o **Any iOS Device (arm64)**
5. **Product → Archive**
6. Una vez archivado, click en **Distribute App → App Store Connect**

#### 7. En App Store Connect (https://appstoreconnect.apple.com):
1. Crea una nueva app
2. Sube screenshots (necesitas capturas de 6.5" y 5.5")
3. Completa la información:
   - Nombre: **NL VIP CLUB**
   - Subtítulo: **Premium Fitness**
   - Categoría: **Health & Fitness**
   - Descripción (ver abajo)
4. Sube el build desde Xcode
5. Envía para revisión

---

## 🤖 PUBLICAR EN GOOGLE PLAY (Android)

### Requisitos previos:
1. **Android Studio** instalado
2. **Cuenta Google Play Console** ($25 único) - https://play.google.com/console
3. **Keystore** para firmar la app

### Pasos:

#### 1. Añadir plataforma Android
```bash
npx cap add android
npx cap sync android
```

#### 2. Abrir en Android Studio
```bash
npx cap open android
```

#### 3. Generar APK/Bundle firmado:
1. **Build → Generate Signed Bundle/APK**
2. Crear nuevo keystore (guárdalo bien!)
3. Selecciona **Android App Bundle**
4. Build

#### 4. Subir a Google Play Console:
1. Crea una nueva aplicación
2. Sube el .aab generado
3. Completa la información de la tienda

---

## 📝 TEXTOS PARA LAS TIENDAS

### Nombre de la App
```
NL VIP CLUB
```

### Subtítulo (iOS) / Tagline corta
```
Tu gimnasio premium en el bolsillo
```

### Descripción corta (Google Play - 80 caracteres)
```
Rutinas, dietas y seguimiento fitness con entrenadores personales.
```

### Descripción larga
```
NL VIP CLUB es la app exclusiva para miembros de nuestro gimnasio premium.

🏋️ CARACTERÍSTICAS PRINCIPALES:

• Rutinas personalizadas creadas por entrenadores certificados
• Planes de alimentación adaptados a tus objetivos
• Seguimiento de progreso con fotos y medidas
• Contador de pasos integrado
• Registro de comidas con análisis de macros por IA
• Feed social para conectar con la comunidad
• Retos y desafíos grupales
• Chat directo con tu entrenador

💪 PARA SOCIOS:
- Accede a tu rutina diaria
- Registra tus entrenamientos
- Sigue tu progreso visual
- Participa en retos del gym

👨‍🏫 PARA ENTRENADORES:
- Gestiona tus clientes
- Crea rutinas y dietas
- Monitorea el progreso
- Comunícate directamente

📱 DISEÑO PREMIUM:
Interfaz moderna con tema oscuro, animaciones fluidas y experiencia de usuario optimizada para entrenar sin distracciones.

Descarga ahora y lleva tu entrenamiento al siguiente nivel.
```

### Palabras clave (iOS - separadas por coma)
```
fitness,gym,workout,trainer,diet,nutrition,health,exercise,progress,tracking
```

### Categoría
- **iOS**: Health & Fitness
- **Android**: Health & Fitness

### Clasificación de edad
- **iOS**: 4+ (sin contenido objetable)
- **Android**: Everyone

---

## 📸 SCREENSHOTS NECESARIOS

### iOS:
- **6.5" (iPhone 14 Pro Max)**: 1290 x 2796 px
- **5.5" (iPhone 8 Plus)**: 1242 x 2208 px

### Android:
- **Phone**: 1080 x 1920 px (mínimo)
- **Tablet 7"**: 1200 x 1920 px
- **Tablet 10"**: 1920 x 1200 px

### Sugerencia de screenshots:
1. Pantalla de login (muestra el diseño premium)
2. Dashboard del socio (rutinas y progreso)
3. Feed social
4. Seguimiento de pasos
5. Análisis de comidas con IA
6. Retos/Challenges

---

## 🔑 CONFIGURACIÓN IMPORTANTE

### Bundle ID / Package Name:
```
com.nlvipclub.app
```

### Versión inicial:
```
1.0.0
```

### Build number:
```
1
```

---

## ⚠️ ANTES DE ENVIAR

### Checklist iOS:
- [ ] Certificados configurados
- [ ] Íconos en todos los tamaños
- [ ] Launch screen configurado
- [ ] Privacy policy URL (requerido)
- [ ] Screenshots subidos
- [ ] Descripción completada

### Checklist Android:
- [ ] Keystore guardado en lugar seguro
- [ ] Content rating completado
- [ ] Data safety form completado
- [ ] Target API level actualizado
- [ ] Screenshots subidos

---

## 🆘 PROBLEMAS COMUNES

### "No signing certificate"
→ Ve a Xcode → Preferences → Accounts → Añade tu Apple ID

### Build falla en iOS
→ Asegúrate de tener la última versión de Xcode
→ Limpia build: Product → Clean Build Folder

### App rechazada por Apple
→ Revisa el email de Apple para ver la razón específica
→ Problemas comunes: falta privacy policy, login no funciona, crashes

---

## 📞 SOPORTE

Si tienes problemas, puedes:
1. Revisar la documentación de Capacitor: https://capacitorjs.com/docs
2. Documentación de Apple: https://developer.apple.com/documentation
3. Documentación de Google Play: https://developer.android.com/distribute

¡Buena suerte con la publicación! 🚀
