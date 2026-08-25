import openpyxl

wb = openpyxl.load_workbook("Ventas Granel.xlsx", data_only=True)
ws = wb['Detalles movimientos']
rows = list(ws.iter_rows(values_only=True))

for row in rows[4:10]:
    if not row or len(row) < 3 or row[2] is None: continue
    cliente = str(row[3]).strip() if row[3] not in (None, '') else ''
    comision = float(row[14]) if len(row) > 14 and isinstance(row[14], (int, float)) else 0.0
    print(f"Cliente: {cliente} | len: {len(row)} | row[14]: {row[14]} | comision: {comision}")
