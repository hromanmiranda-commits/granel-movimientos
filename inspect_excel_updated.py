import pandas as pd

# Load the excel file
file_path = "Ventas Granel.xlsx"
xls = pd.ExcelFile(file_path)

# Read the first sheet, first 15 rows
df = pd.read_excel(xls, sheet_name='Detalles movimientos', header=None, nrows=15)
pd.set_option('display.max_columns', None)
pd.set_option('display.width', 1000)
print("=== Detalles movimientos ===")
print(df)

for sheet in ['ENAP carga', 'Ignacio']:
    if sheet in xls.sheet_names:
        df_sheet = pd.read_excel(xls, sheet_name=sheet, header=None, nrows=20)
        print(f"\n=== {sheet} ===")
        print(df_sheet.head(20))
