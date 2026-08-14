import pandas as pd

# Load the excel file
file_path = "Ventas Granel.xlsx"
xls = pd.ExcelFile(file_path)
print("Sheet names:", xls.sheet_names)

# Read the first sheet
df = pd.read_excel(xls, sheet_name=xls.sheet_names[0])
print(f"\nColumns in first sheet '{xls.sheet_names[0]}':")
for col in df.columns:
    print(f"- {col}")
print("\nFirst few rows:")
print(df.head())
