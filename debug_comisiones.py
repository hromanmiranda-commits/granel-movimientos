import openpyxl

file_path = "Ventas Granel.xlsx"
wb = openpyxl.load_workbook(file_path, data_only=True)
ws = wb['Detalles movimientos']

rows = list(ws.iter_rows(values_only=True))

for i, row in enumerate(rows[4:15]):
    if row and len(row) > 14:
        print(f"Row {i+5}: Cliente='{row[3]}' | Comision (raw)='{row[14]}' | type={type(row[14])}")
    else:
        print(f"Row {i+5}: Too short")
