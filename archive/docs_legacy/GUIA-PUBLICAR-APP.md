# 📱 GUÍA RÁPIDA - Publicar NL VIP CLUB en las Tiendas

## ✅ ESTADO ACTUAL (Todo listo):
- [x] App funcionando en producción
- [x] Capacitor configurado
- [x] Política de Privacidad: `tu-dominio.vercel.app/privacy`
- [x] Términos de Servicio: `tu-dominio.vercel.app/terms`
- [x] Script de build automático
- [x] Configuración iOS/Android

---

## 🍎 PUBLICAR EN iOS (App Store)

### Requisitos que necesitas:
- [ ] Mac con macOS
- [ ] Xcode instalado (descargar de App Store del Mac)
- [ ] Cuenta Apple Developer activa ($99/año)

### Pasos en el Mac:

#### 1️⃣ Clonar el proyecto
```bash
git clone https://github.com/goorum04/Nlvip.git
cd Nlvip
```

#### 2️⃣ Instalar dependencias
```bash
# Instalar Node.js si no lo tienes (https://nodejs.org)
# Instalar Yarn
npm install -g yarn

# Instalar dependencias del proyecto
yarn install
```

#### 3️⃣ Ejecutar el script de build
```bash
chmod +x build-mobile.sh
./build-mobile.sh
```

#### 4️⃣ Abrir en Xcode
```bash
npx cap open ios
```

#### 5️⃣ Configurar en Xcode:
1. En el panel izquierdo, haz clic en "App"
2. En **Signing & Capabilities**:
   - Marca ✅ "Automatically manage signing"
   - Selecciona tu **Team** (tu cuenta de desarrollador)
3. En **General**:
   - Bundle Identifier: `com.nlvipteam.app`
   - Version: `1.0.0`
   - Build: `1`

#### 6️⃣ Crear el Archive:
1. En la barra de menú: **Product → Archive**
2. Espera a que termine (puede tardar 5-10 minutos)
3. Se abrirá el Organizer con tu archive

#### 7️⃣ Subir a App Store:
1. En el Organizer, clic en **Distribute App**
2. Selecciona **App Store Connect**
3. Sigue los pasos hasta completar la subida

#### 8️⃣ En App Store Connect (https://appstoreconnect.apple.com):
1. Ve a **My Apps** → tu app
2. Sube los screenshots (ver sección abajo)
3. Completa la información:
   - Nombre: **NL VIP CLUB**
   - Categoría: **Health & Fitness**
   - URL de privacidad: `https://tu-dominio.vercel.app/privacy`
4. En **Build**, selecciona el build que subiste
5. Clic en **Submit for Review**

---

## 🤖 PUBLICAR EN Android (Google Play)

### Requisitos:
- [ ] Android Studio instalado (Mac, Windows o Linux)
- [ ] Cuenta Google Play Console ($25 único)

### Pasos:

#### 1️⃣ Si ya hiciste el build para iOS, solo ejecuta:
```bash
npx cap open android
```

#### 2️⃣ En Android Studio:
1. Espera a que se sincronice Gradle
2. **Build → Generate Signed Bundle / APK**
3. Selecciona **Android App Bundle**
4. Crea un **nuevo keystore** (¡guárdalo bien!)
5. Genera el `.aab`

#### 3️⃣ En Google Play Console:
1. Crea una nueva aplicación
2. Sube el archivo `.aab`
3. Completa la información de la tienda
4. URL de privacidad: `https://tu-dominio.vercel.app/privacy`

---

## 📸 SCREENSHOTS NECESARIOS

### Para iOS necesitas capturas de:
- **iPhone 6.7"** (iPhone 14 Pro Max): 1290 x 2796 px
- **iPhone 6.5"** (iPhone 14 Plus): 1284 x 2778 px  
- **iPhone 5.5"** (iPhone 8 Plus): 1242 x 2208 px

### Para Android:
- **Teléfono**: 1080 x 1920 px mínimo

### Capturas sugeridas (6-8 por tienda):
1. 📱 Pantalla de login
2. 🏠 Dashboard principal
3. 🏋️ Rutinas de ejercicio
4. 🍽️ Sección de recetas
5. 📊 Seguimiento de progreso
6. 👥 Feed social
7. 🎯 Retos/Challenges
8. 🤖 Análisis de comida con IA

---

## 📝 TEXTOS PARA LAS TIENDAS

### Nombre
```
NL VIP CLUB
```

### Subtítulo
```
Tu gimnasio premium en el bolsillo
```

### Descripción corta (80 caracteres)
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

### Palabras clave (iOS)
```
fitness,gym,workout,trainer,diet,nutrition,health,exercise,progress,tracking
```

### Categoría
- **iOS**: Health & Fitness
- **Android**: Health & Fitness

### Clasificación de edad
- **iOS**: 4+
- **Android**: Everyone

---

## 🔗 URLs IMPORTANTES

| Página | URL |
|--------|-----|
| App en producción | `https://tu-dominio.vercel.app` |
| Política de Privacidad | `https://tu-dominio.vercel.app/privacy` |
| Términos de Servicio | `https://tu-dominio.vercel.app/terms` |

---

## ⚠️ CHECKLIST ANTES DE ENVIAR

### iOS:
- [ ] Screenshots subidos (todos los tamaños)
- [ ] URL de privacidad configurada
- [ ] Descripción completada
- [ ] Categoría seleccionada
- [ ] Build subido y seleccionado

### Android:
- [ ] Screenshots subidos
- [ ] URL de privacidad configurada
- [ ] Content rating completado
- [ ] Data safety form completado
- [ ] Bundle (.aab) subido

---

## 🆘 PROBLEMAS COMUNES

### "No signing certificate" (Xcode)
→ Ve a Xcode → Preferences → Accounts → Añade tu Apple ID

### Build falla en Xcode
→ Product → Clean Build Folder, luego intenta de nuevo

### "App rejected" por Apple
→ Revisa el email con la razón específica
→ Problemas comunes: falta privacy policy, screenshots incorrectos

---

## 📞 ¿NECESITAS AYUDA?

Cuando tengas el Mac listo y las cuentas de desarrollador, vuelve a este chat y te ayudo paso a paso.

¡Buena suerte! 🚀
