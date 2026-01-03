#!/bin/bash

# Script de setup para Redis
# Ejecutar con: bash SETUP_REDIS.sh

echo "🚀 Iniciando setup de Redis..."

# 1. Instalar dependencia
echo "📦 Instalando @upstash/redis..."
npm install @upstash/redis

# 2. Verificar instalación
if [ $? -eq 0 ]; then
    echo "✅ Dependencia instalada correctamente"
else
    echo "❌ Error instalando dependencia"
    exit 1
fi

# 3. Verificar variables de entorno
echo "🔍 Verificando variables de entorno..."

if [ -z "$UPSTASH_REDIS_REST_URL" ]; then
    echo "⚠️  UPSTASH_REDIS_REST_URL no está configurada"
    echo "   Agrégala a .env.local"
else
    echo "✅ UPSTASH_REDIS_REST_URL configurada"
fi

if [ -z "$UPSTASH_REDIS_REST_TOKEN" ]; then
    echo "⚠️  UPSTASH_REDIS_REST_TOKEN no está configurada"
    echo "   Agrégala a .env.local"
else
    echo "✅ UPSTASH_REDIS_REST_TOKEN configurada"
fi

echo ""
echo "✅ Setup completado!"
echo "📝 Próximos pasos:"
echo "   1. Asegúrate de tener las variables en .env.local"
echo "   2. Ejecuta: npm run dev"
echo "   3. Verifica que no hay errores de Redis"
