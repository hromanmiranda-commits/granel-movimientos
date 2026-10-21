#!/usr/bin/env python3
"""
Módulo para procesar Facturas y Guías de Despacho de ENAP Refinerías S.A.
y registrar las compras automáticamente en 'Ventas Granel.xlsx'.
"""

import os
import re
from datetime import datetime
import openpyxl
from pypdf import PdfReader


def clasificar_documento(pdf_path):
    """
    Determina si un PDF es FACTURA o GUIA analizando su contenido.
    """
    try:
        reader = PdfReader(pdf_path)
        texto = reader.pages[0].extract_text() or ""
        if "FACTURA ELECTRONICA" in texto.upper():
            return "FACTURA"
        elif "GUIA DE DESPACHO" in texto.upper():
            return "GUIA"
    except Exception:
        pass
    return "OTRO"


def extraer_datos_factura(pdf_path):
    """
    Extrae N° Factura, Fecha, N° Guía, Valor Neto y Total (con IVA) desde una Factura ENAP PDF.
    """
    reader = PdfReader(pdf_path)
    texto = "\n".join([page.extract_text() or "" for page in reader.pages])

    datos = {
        'tipo': 'FACTURA',
        'archivo': os.path.basename(pdf_path),
        'numero_factura': None,
        'fecha': None,
        'numero_guia': None,
        'valor_neto': None,
        'valor_total': None
    }

    # N° Factura: FACTURA ELECTRONICA N° 000853450
    m_fac = re.search(r'FACTURA\s+ELECTRONICA.*?N[°º]\s*0*(\d+)', texto, re.DOTALL | re.IGNORECASE)
    if m_fac:
        datos['numero_factura'] = m_fac.group(1)

    # Fecha Emisión: FECHA EMISION : 20 / 10 / 2026
    m_fec = re.search(r'FECHA\s+EMISION\s*:\s*(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})', texto, re.IGNORECASE)
    if m_fec:
        dia, mes, anio = m_fec.groups()
        datos['fecha'] = datetime(int(anio), int(mes), int(dia))

    # N° Guía referenciada en la factura: 02377964
    m_guia = re.search(r'PROPANO\s+COMERCIAL\s+0*(\d{6,8})', texto, re.IGNORECASE)
    if not m_guia:
        m_guia = re.search(r'N[°º]\s*GUIA.*?0*(\d{6,8})', texto, re.DOTALL | re.IGNORECASE)
    if m_guia:
        datos['numero_guia'] = m_guia.group(1).lstrip('0')

    # Valor Neto: VALOR NETO ... 3.435.620
    m_neto = re.search(r'VALOR\s+NETO[^\d]+([\d\.]+)', texto, re.IGNORECASE)
    if m_neto:
        num_str = m_neto.group(1).replace('.', '')
        datos['valor_neto'] = float(num_str)

    # Valor Total (con IVA): TOTAL ... 4.088.388
    m_tot = re.search(r'\n\s*TOTAL[^\d\n\r]*\n\s*-+\s*\n\s*([\d\.]+)', texto, re.IGNORECASE)
    if not m_tot:
        m_tot = re.search(r'19%\s*IVA[^\d]+[\d\.]+[^\d]+([\d\.]+)', texto, re.IGNORECASE)
    if m_tot:
        num_str = m_tot.group(1).replace('.', '')
        datos['valor_total'] = float(num_str)
    elif datos['valor_neto']:
        # Respaldo si no encuentra la línea: Neto * 1.19
        datos['valor_total'] = round(datos['valor_neto'] * 1.19)

    return datos


def extraer_datos_guia(pdf_path):
    """
    Extrae N° Guía, Fecha, Patente Camión, Kilos, M3 y Litros desde una Guía ENAP PDF.
    """
    reader = PdfReader(pdf_path)
    texto = "\n".join([page.extract_text() or "" for page in reader.pages])

    datos = {
        'tipo': 'GUIA',
        'archivo': os.path.basename(pdf_path),
        'numero_guia': None,
        'fecha': None,
        'camion': None,
        'kilos': None,
        'm3': None,
        'litros': None
    }

    # N° Guía: GUIA DE DESPACHO ELECTRONICA N° 002377964
    m_guia = re.search(r'GUIA\s+DE\s+DESPACHO.*?N[°º]\s*0*(\d+)', texto, re.DOTALL | re.IGNORECASE)
    if m_guia:
        datos['numero_guia'] = m_guia.group(1).lstrip('0')

    # Fecha: FECHA: 20 de Octubre del 2026 o 20/10/2026
    meses = {
        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
        'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
    }
    m_fec = re.search(r'FECHA\s*:\s*(\d{1,2})\s+de\s+([A-Za-z]+)\s+del?\s+(\d{4})', texto, re.IGNORECASE)
    if m_fec:
        dia, mes_nombre, anio = m_fec.groups()
        mes_num = meses.get(mes_nombre.lower(), 1)
        datos['fecha'] = datetime(int(anio), mes_num, int(dia))
    else:
        m_fec2 = re.search(r'FECHA\s*:\s*(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})', texto, re.IGNORECASE)
        if m_fec2:
            dia, mes, anio = m_fec2.groups()
            datos['fecha'] = datetime(int(anio), int(mes), int(dia))

    # Patente Camión: CAMION PATENTE: VJYL61
    m_pat = re.search(r'CAMION\s+PATENTE\s*:\s*([A-Z0-9]{4,6})', texto, re.IGNORECASE)
    if m_pat:
        datos['camion'] = m_pat.group(1).strip()

    # M3 equivalentes (1 M3 = 1000 Litros): 11,075 M3 -> 11075 Litros
    m_m3 = re.search(r'([\d,\.]+)\s*M3', texto, re.IGNORECASE)
    if m_m3:
        m3_val = float(m_m3.group(1).replace(',', '.'))
        datos['m3'] = m3_val
        datos['litros'] = round(m3_val * 1000)

    # Kilos / TNM: 5,720 TNM
    m_tnm = re.search(r'([\d,\.]+)\s*TNM', texto, re.IGNORECASE)
    if m_tnm:
        datos['kilos'] = float(m_tnm.group(1).replace('.', '').replace(',', '.'))

    return datos


def registrar_carga_enap_excel(fecha, camion, n_guia, monto_total_iva, litros_comprados, excel_path="Ventas Granel.xlsx"):
    """
    Agrega una fila de ENAP carga a la hoja 'Detalles movimientos' de Ventas Granel.xlsx
    utilizando el monto total pagado (con IVA incluido).
    """
    wb = openpyxl.load_workbook(excel_path, data_only=False)
    ws = wb['Detalles movimientos']

    # 1. Encontrar la última fila ocupada en la columna C (Fecha)
    ultima_fila = 4
    for i in range(5, ws.max_row + 1):
        if ws.cell(row=i, column=3).value is not None:
            ultima_fila = i

    nueva_fila = ultima_fila + 1

    # 2. Verificar si la guía ya existe: si existe, actualizar su monto a valor con IVA
    str_guia_busqueda = str(n_guia).lstrip('0')
    for r in range(5, nueva_fila):
        obs = str(ws.cell(row=r, column=16).value or '')
        if str_guia_busqueda in obs:
            monto_actual = ws.cell(row=r, column=17).value
            if monto_actual != int(monto_total_iva):
                ws.cell(row=r, column=17).value = int(monto_total_iva)
                wb.save(excel_path)
                print(f"🔄 Guía N° {n_guia} actualizada en fila {r}: nuevo monto con IVA = ${int(monto_total_iva):,}")
                return True
            return False

    # 3. Llenar columnas correspondientes a ENAP carga
    # Col 3 (C): Fecha
    ws.cell(row=nueva_fila, column=3).value = fecha
    # Col 4 (D): Nombre Cliente -> ENAP carga
    ws.cell(row=nueva_fila, column=4).value = "ENAP carga"
    # Col 5 (E): Camión -> VJYL61 / VJYL42
    ws.cell(row=nueva_fila, column=5).value = camion
    # Col 6 (F): Vende -> ENAP carga
    ws.cell(row=nueva_fila, column=6).value = "ENAP carga"
    # Col 14 (N): Medio de pago -> ENAP carga
    ws.cell(row=nueva_fila, column=14).value = "ENAP carga"
    # Col 16 (P): Observación -> Guía N° XXXXXXX
    ws.cell(row=nueva_fila, column=16).value = f"Guía N° {n_guia}"
    # Col 17 (Q): COMPRA ENAP (Monto Total con IVA)
    ws.cell(row=nueva_fila, column=17).value = int(monto_total_iva)
    # Col 18 (R): Litros Comprados
    ws.cell(row=nueva_fila, column=18).value = int(litros_comprados)
    # Col 23 (W): _Idx_ENAP carga (Fórmula de índice)
    ws.cell(row=nueva_fila, column=23).value = f'=IF(F{nueva_fila}="ENAP carga", COUNTIF(F$5:F{nueva_fila}, "ENAP carga"), "")'

    wb.save(excel_path)
    print(f"✅ Carga registrada con éxito en fila {nueva_fila} de {excel_path}:")
    print(f"   - Fecha: {fecha.strftime('%Y-%m-%d')}")
    print(f"   - Camión: {camion}")
    print(f"   - Guía: N° {n_guia}")
    print(f"   - Monto Total (con IVA): ${int(monto_total_iva):,}")
    print(f"   - Litros Comprados: {int(litros_comprados):,} L")
    return True


if __name__ == "__main__":
    print("Módulo de extracción y registro de compras ENAP cargado correctamente.")
