#!/bin/bash
cd "$(dirname "$0")"

echo "=================================================="
echo " 🚀 Sincronizando datos de Ventas Granel.xlsx"
echo "=================================================="

if [ -d "./venv" ]; then
    ./venv/bin/python3 update_presentation.py
else
    python3 update_presentation.py
fi

echo ""
echo "=================================================="
echo " 🌐 Enviando datos a GitHub / Servidor Web..."
echo "=================================================="
git push origin main

echo ""
echo "=================================================="
echo " ✅ Sincronización completada exitosamente."
echo " Puedes cerrar esta ventana."
echo "=================================================="
sleep 3
