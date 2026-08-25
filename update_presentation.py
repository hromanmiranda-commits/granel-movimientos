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

compras_l = 0.0
monto_compras = 0.0
guias_enap = 0

ventas_l = 0.0
monto_ventas = 0.0
ventas_ops = 0

extracciones_l = 0.0
extracciones_ops = 0

comisiones_pagadas = 0.0
comisiones_pendientes = 0.0

camion_vjyl61_ops = 0
camion_vjyl42_ops = 0

# Row 4 contains column headers:
# [2] Fecha, [3] Nombre Cliente, [4] Camión, [5] Vende, [6] Dirección,
# [7] Precio, [8] Litros Vendidos, [9] Extraccion, [10] Total Recaudado,
# [11] Medio de pago, [12] Comisiones, [13] Observación, [14] COMPRA ENAP, [15] Litros Comprados

for row in rows[4:]:
    if not row or len(row) < 3 or row[2] is None: continue
    fecha_val = row[2]
    if not isinstance(fecha_val, datetime): continue
    fecha_str = fecha_val.strftime('%Y-%m-%d')
    
    cliente = str(row[3]).strip() if row[3] not in (None, '') else ''
    camion = str(row[4]).strip() if row[4] not in (None, '') else ''
    vendedor = str(row[5]).strip() if row[5] not in (None, '') else ''
    direccion = str(row[6]).strip() if len(row) > 6 and row[6] not in (None, 0, '') else 'N/A'
    def safe_float(val):
        try:
            return float(val) if val is not None else 0.0
        except (ValueError, TypeError):
            return 0.0
            
    precio = safe_float(row[7]) if len(row) > 7 else 0.0
    litros = safe_float(row[8]) if len(row) > 8 else 0.0
    extraccion = safe_float(row[11]) if len(row) > 11 else 0.0
    total = safe_float(row[12]) if len(row) > 12 else 0.0
    if total == 0 and precio > 0 and litros > 0:
        total = precio * litros

    medioPago = str(row[13]).strip() if len(row) > 13 and row[13] not in (None, 0, '') else 'N/A'
    comision = safe_float(row[14]) if len(row) > 14 else 0.0
    observacion = str(row[15]).strip() if len(row) > 15 and row[15] not in (None, 0, '') else ''
    compra_monto = safe_float(row[16]) if len(row) > 16 else 0.0
    compra_litros = safe_float(row[17]) if len(row) > 17 else 0.0
    detalles = str(row[18]).strip() if len(row) > 18 and row[18] not in (None, 0, '') else ''

    if 'VJYL61' in camion:
        camion_vjyl61_ops += 1
    elif 'VJYL42' in camion:
        camion_vjyl42_ops += 1

    if 'ENAP' in cliente or 'ENAP' in vendedor or compra_litros > 0:
        compras_l += compra_litros
        monto_compras += compra_monto
        guias_enap += 1
    elif 'Ignacio' in vendedor or 'Ignacio' in cliente or extraccion > 0:
        extracciones_l += extraccion if extraccion > 0 else litros
        extracciones_ops += 1
    else:
        ventas_l += litros
        monto_ventas += total
        ventas_ops += 1
        
        if 'Pagada' in observacion or 'Tarjeta' in medioPago:
            comisiones_pagadas += comision
        else:
            comisiones_pendientes += comision

    tx = {
        'fecha': fecha_str,
        'cliente': cliente,
        'camion': camion,
        'vendedor': vendedor,
        'direccion': direccion,
        'precio': precio,
        'litros': litros if litros > 0 else (extraccion if extraccion > 0 else compra_litros),
        'total': total if total > 0 else compra_monto,
        'medioPago': medioPago,
        'comision': comision,
        'observacion': observacion,
        'detalles': detalles
    }
    transactions.append(tx)

total_comisiones = comisiones_pagadas + comisiones_pendientes
stock_saldo = compras_l - ventas_l - extracciones_l
costo_prom_l = (monto_compras / compras_l) if compras_l > 0 else 336.77
precio_prom_l = (monto_ventas / ventas_l) if ventas_l > 0 else 890.33
margen_prom_l = precio_prom_l - costo_prom_l
pct_margen = (margen_prom_l / precio_prom_l * 100) if precio_prom_l > 0 else 62.2

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
        guiasEnap: {guias_enap},
        ventasOps: {ventas_ops},
        extraccionesOps: {extracciones_ops},
        comisionesPagadas: {comisiones_pagadas},
        comisionesPendientes: {comisiones_pendientes},
        totalComisiones: {total_comisiones},
        costoPromedioLitro: {costo_prom_l:.2f},
        precioPromedioVentaLitro: {precio_prom_l:.2f},
        margenPromedioLitro: {margen_prom_l:.2f},
        porcentajeMargenBruto: {pct_margen:.1f},
        camionVJYL61Ops: {camion_vjyl61_ops},
        camionVJYL42Ops: {camion_vjyl42_ops}
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

print(f"✓ ENAP Compras recalculadas: {compras_l:,.1f} Litros por ${monto_compras:,.0f} CLP ({guias_enap} Guías)")
print(f"✓ Ventas recalculadas: {ventas_l:,.1f} Litros por ${monto_ventas:,.0f} CLP ({ventas_ops} Ventas)")
print(f"✓ Stock Saldo actual: {stock_saldo:,.1f} Litros")
print(f"✓ Total Operaciones registradas: {len(transactions)}")

# Automatic Git Commit (push if remote accessible)
try:
    token_path = '.github_token'
    if os.path.exists(token_path):
        with open(token_path, 'r') as tf:
            token = tf.read().strip()
        user = 'hromanmiranda-commits'
        remote_url = f'https://{token}@github.com/{user}/granel-movimientos.git'
        
        subprocess.run(["git", "remote", "set-url", "origin", remote_url], check=False)
        subprocess.run(["git", "add", "."], check=True)
        subprocess.run(["git", "commit", "-m", f"Actualización de datos Granel Movimientos {datetime.now().strftime('%Y-%m-%d %H:%M')}"], check=False)
        res = subprocess.run(["git", "push", "origin", "main"], check=False, capture_output=True, text=True)
        if res.returncode == 0:
            print("==================================================")
            print("🚀 ¡NUEVOS DATOS ENVIADOS A GITHUB AUTOMÁTICAMENTE!")
            print("==================================================")
        else:
            print("ℹ️ Git commit completado localmente.")
    else:
        print("ℹ️ Archivo .github_token no encontrado.")
except Exception as e:
    print(f"Info Git: {e}")

