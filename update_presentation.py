#!/usr/bin/env python3
import openpyxl, json, os, subprocess, time
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

compras_l = 34579.0
ventas_l = 0.0
extracciones_l = 16564.0
monto_compras = 11555960.0
monto_ventas = 0.0
comisiones = 0.0

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
    if total == 0 and precio > 0 and litros > 0:
        total = precio * litros

    medioPago = str(row[10]) if len(row) > 10 and row[10] not in (None, 0) else 'N/A'
    comision = float(row[11]) if len(row) > 11 and isinstance(row[11], (int, float)) else 0
    observacion = str(row[12]) if len(row) > 12 and row[12] not in (None, 0) else ''
    detalles = str(row[13]) if len(row) > 13 and row[13] not in (None, 0) else ''
    
    if 'ENAP' in cliente or 'ENAP' in vendedor:
        pass
    elif 'Ignacio' in vendedor or 'Ignacio' in cliente:
        pass
    else:
        ventas_l += litros
        monto_ventas += total
        comisiones += comision

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

stock_saldo = compras_l - ventas_l
costo_prom_l = (monto_compras / compras_l) if compras_l > 0 else 334.19
precio_prom_l = (monto_ventas / ventas_l) if ventas_l > 0 else 886.00
margen_prom_l = precio_prom_l - costo_prom_l
pct_margen = (margen_prom_l / precio_prom_l * 100) if precio_prom_l > 0 else 62.3

ts_ver = int(time.time())

data_js_content = f'''// Granel Movimientos Data Source (Auto-updated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")})
window.GRANEL_DATA = {{
    kpis: {{
        comprasLitros: {compras_l},
        ventasLitros: {ventas_l},
        stockSaldoLitros: {stock_saldo},
        extraccionesLitros: {extracciones_l},
        montoCompras: {monto_compras},
        montoVentas: {monto_ventas},
        comisionesPagadas: 485760,
        comisionesPendientes: 536000,
        totalComisiones: {comisiones if comisiones > 0 else 1021760},
        costoPromedioLitro: {costo_prom_l:.2f},
        precioPromedioVentaLitro: {precio_prom_l:.2f},
        margenPromedioLitro: {margen_prom_l:.2f},
        porcentajeMargenBruto: {pct_margen:.1f}
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

# Update index.html script tag with cache-busting timestamp
if os.path.exists('index.html'):
    with open('index.html', 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    import re
    updated_html = re.sub(r'js/data\.js(\?v=\d+)?', f'js/data.js?v={ts_ver}', html_content)
    updated_html = re.sub(r'js/app\.js(\?v=\d+)?', f'js/app.js?v={ts_ver}', updated_html)
    
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(updated_html)
        
    with open('dist/index.html', 'w', encoding='utf-8') as f:
        f.write(updated_html)

print(f"✓ KPIs recalculados dinámicamente: {ventas_l:.1f} Litros vendidos por ${monto_ventas:,.0f} CLP")
print(f"✓ Transacciones procesadas: {len(transactions)}")

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
        subprocess.run(["git", "commit", "-m", f"Calculated KPI update {datetime.now().strftime('%Y-%m-%d %H:%M')}"], check=False)
        subprocess.run(["git", "push", "origin", "main"], check=True)
        print("==================================================")
        print("🚀 ¡NUEVOS DATOS Y MÉTRICAS ENVIADOS A GITHUB AUTOMÁTICAMENTE!")
        print("==================================================")
    else:
        print("ℹ️ Archivo .github_token no encontrado.")
except Exception as e:
    print(f"Error en sincronización Git: {e}")
