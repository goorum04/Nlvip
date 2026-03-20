# 🖤✨ Guía de Uso de Google Stitch para NL VIP CLUB ✨🖤

Google Stitch es nuestra herramienta de diseño asistida por IA para crear interfaces de "High-Fidelity" que mantengan la estética premium de NL VIP CLUB.

## 🚀 Cómo empezar

1.  **Acceso**: Entra en [Google Stitch Labs](https://stitch.google.com) (o la URL proporcionada por Google Labs).
2.  **Configuración Visual**: Siempre usa palabras clave que definan nuestra marca:
    *   **Colores**: `Premium Black (#030303)`, `Gold/Dorado (#C9A24D)`, `Glassmorphism`, `Translucent UI`.
    *   **Estilo**: `High-end`, `Minimalist`, `Luxury Fitness`, `Sleek animations`.

## 💡 Prompts Ganadores para este Proyecto

Copia y adapta estos prompts en Stitch para obtener los mejores resultados:

### Para el Feed Social (Socios)
> *"Diseña una tarjeta de post para una red social de fitness premium. Fondo negro mate (#030303), bordes redondeados (3xl), borde sutil en dorado (#C9A24D) con opacidad del 20%. Iconos elegantes de 'Me gusta' y 'Comentar' en estilo minimalista."*

### Para el Dashboard de Entrenador
> *"Crea una tabla de seguimiento de progreso para socios. Usa un estilo de 'vidrio esmerilado' (glassmorphism), tipografía Inter bold para los nombres, y barras de progreso en degradado de violeta a cyan sobre fondo oscuro."*

### Para la Tienda de Suplementos (Futuro)
> *"Diseña un grid de productos de suplementos deportivos. Cada tarjeta debe tener un efecto de hover que resalte el borde en dorado y un botón de 'Añadir al carrito' con gradiente premium."*

## 📥 Cómo integrar el diseño en el código

Una vez que tengas un diseño que te guste en Stitch:

1.  **Exportar**: Usa la función **Export to HTML/CSS** (o React si está disponible).
2.  **Guardar**: Guarda el archivo `.html` o `.jsx` directamente en `assets/stitch-exports/`.
3.  **Refactorizar**: Yo (tu asistente Antigravity) puedo tomar ese código y convertirlo en un componente funcional de Next.js. Solo dime:
    *   *"Oye, toma el archivo `assets/stitch-exports/tarjeta-vip.html` e incorpóralo como un componente en components/PremiumCard.jsx"*

## 🛠️ Uso del SDK (Programático)

Hemos instalado `@google/stitch-sdk`. Puedes usarlo en el código así:

```javascript
import { stitch } from '@/lib/stitch';

const result = await stitch.generateComponent("Tarjeta de suscripción VIP gold");
```

> [!NOTE]
> Para activar la generación automática desde el código, debes añadir tu `STITCH_API_KEY` en el archivo `.env.local`.

---

**¡Vamos a elevar el nivel visual de NL VIP CLUB! 🚀🏆**
