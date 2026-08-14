#!/usr/bin/env python3
import openpyxl, json, os, subprocess
from datetime import datetime

print("==================================================")
print(" Sincronizando datos de Ventas Granel.xlsx...")
print("==================================================")

file_path = "Ventas Granel.xlsx"
if not os.path.exists(file_path):
    print(f"Error: No se encontró el archivo {file_path}")
    exit(1)

wb = openpyxl.load_workbook(file_path, data_only=True)
ws = wb['Detalles movimientos']

transactions = []
rows = list(ws.iter_rows(values_only=True))

for row in rows[4:]:
    if not row or len(row) < 3 or row[2] is None: continue
    fecha_val = row[2]
    if not isinstance(fecha_val, datetime): continue
    fecha_str = fecha_val.strftime('%Y-%m-%d')
    
    cliente = str(row[3]) if row[3] is not None else ''
    camion = str(row[4]) if row[4] is not None else ''
    vendedor = str(row[5]) if row[5] is not None else ''
    direccion = str(row[6]) if len(row) > 6 and row[6] not in (None, 0) else 'N/A'
    precio = float(row[7]) if len(row) > 7 and isinstance(row[7], (int, float)) else 0
    litros = float(row[8]) if len(row) > 8 and isinstance(row[8], (int, float)) else 0
    total = float(row[9]) if len(row) > 9 and isinstance(row[9], (int, float)) else 0
    medioPago = str(row[10]) if len(row) > 10 and row[10] not in (None, 0) else 'N/A'
    comision = float(row[11]) if len(row) > 11 and isinstance(row[11], (int, float)) else 0
    observacion = str(row[12]) if len(row) > 12 and row[12] not in (None, 0) else ''
    detalles = str(row[13]) if len(row) > 13 and row[13] not in (None, 0) else ''
    
    tx = {
        'fecha': fecha_str,
        'cliente': cliente,
        'camion': camion,
        'vendedor': vendedor,
        'direccion': direccion,
        'precio': precio,
        'litros': litros,
        'total': total,
        'medioPago': medioPago,
        'comision': comision,
        'observacion': observacion,
        'detalles': detalles
    }
    transactions.append(tx)

data_js_content = f'''// Granel Movimientos Data Source (Auto-updated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")})
window.GRANEL_DATA = {{
    kpis: {{
        comprasLitros: 34579.0,
        ventasLitros: 6479.8,
        stockSaldoLitros: 28099.2,
        extraccionesLitros: 16564.0,
        montoCompras: 11555960,
        montoVentas: 5741100,
        comisionesPagadas: 485760,
        comisionesPendientes: 536000,
        totalComisiones: 1021760,
        costoPromedioLitro: 334.19,
        precioPromedioVentaLitro: 886.00,
        margenPromedioLitro: 551.81,
        porcentajeMargenBruto: 62.3
    }},
    transacciones: {json.dumps(transactions, indent=4, ensure_ascii=False)}
}};
'''

os.makedirs('js', exist_ok=True)
with open('js/data.js', 'w', encoding='utf-8') as f:
    f.write(data_js_content)

os.makedirs('dist/js', exist_ok=True)
with open('dist/js/data.js', 'w', encoding='utf-8') as f:
    f.write(data_js_content)

print(f"✓ Datos locales procesados. Total transacciones: {len(transactions)}")

# Automatic Git Push to GitHub
try:
    token_path = '.github_token'
    if os.path.exists(token_path):
        with open(token_path, 'r') as tf:
            token = tf.read().strip()
        user = 'hromanmiranda-commits'
        remote_url = f'https://{token}@github.com/{user}/granel-movimientos.git'
        
        subprocess.run(["git", "remote", "set-url", "origin", remote_url], check=False)
        subprocess.run(["git", "add", "."], check=True)
        subprocess.run(["git", "commit", "-m", f"Auto-update sales data {datetime.now().strftime('%Y-%m-%d %H:%M')}"], check=False)
        subprocess.run(["git", "push", "origin", "main"], check=True)
        print("==================================================")
        print("🚀 ¡NUEVOS DATOS ENVIADOS A GITHUB AUTOMÁTICAMENTE!")
        print("==================================================")
    else:
        print("ℹ️ Archivo .github_token no encontrado.")
except Exception as e:
    print(f"Error en sincronización Git: {e}")
