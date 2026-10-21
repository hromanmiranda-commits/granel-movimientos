#!/bin/bash
cd "$(dirname "$0")"

echo "=================================================="
echo " 📥 1. Revisando correo Hostinger y descargando PDFs..."
echo "=================================================="

if [ -f "./config_email.json" ]; then
    ./venv/bin/python3 sincronizar_correos.py
else
    echo "ℹ️ config_email.json no configurado aún. Omitiendo descarga de correo."
fi

echo ""
echo "=================================================="
echo " 🚀 2. Sincronizando datos de Ventas Granel.xlsx..."
echo "=================================================="

if [ -d "./venv" ]; then
    ./venv/bin/python3 update_presentation.py
else
    python3 update_presentation.py
fi

echo ""
echo "=================================================="
echo " 🌐 3. Enviando datos a GitHub / Servidor Web..."
echo "=================================================="
git push origin main

echo ""
echo "=================================================="
echo " ✅ Sincronización completada exitosamente."
echo " Puedes cerrar esta ventana."
echo "=================================================="
sleep 3
