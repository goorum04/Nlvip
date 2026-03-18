#!/bin/bash

# ============================================
# NL VIP CLUB - Script de Build para App Store
# ============================================

echo "🚀 Iniciando build para App Store..."

# 1. Instalar dependencias
echo "📦 Instalando dependencias..."
yarn install

# 2. Build de Next.js con configuración móvil
echo "🔨 Generando build de producción..."
cp next.config.js next.config.backup.js
cp next.config.mobile.js next.config.js
yarn build
mv next.config.backup.js next.config.js

# 3. Verificar que existe la carpeta 'out'
if [ ! -d "out" ]; then
    echo "❌ Error: No se generó la carpeta 'out'"
    exit 1
fi

echo "✅ Build completado en carpeta 'out'"

# 4. Sincronizar con Capacitor
echo "📱 Sincronizando con Capacitor..."

# Añadir plataformas si no existen
if [ ! -d "ios" ]; then
    echo "📱 Añadiendo plataforma iOS..."
    npx cap add ios
fi

if [ ! -d "android" ]; then
    echo "🤖 Añadiendo plataforma Android..."
    npx cap add android
fi

# Sincronizar
npx cap sync

echo ""
echo "============================================"
echo "✅ ¡BUILD COMPLETADO!"
echo "============================================"
echo ""
echo "Próximos pasos:"
echo ""
echo "📱 Para iOS:"
echo "   npx cap open ios"
echo "   (Se abrirá Xcode)"
echo ""
echo "🤖 Para Android:"
echo "   npx cap open android"
echo "   (Se abrirá Android Studio)"
echo ""
