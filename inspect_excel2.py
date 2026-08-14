import pandas as pd

# Load the excel file
file_path = "Ventas Granel.xlsx"
xls = pd.ExcelFile(file_path)

# Read the first sheet, all rows and columns as string, first 15 rows
df = pd.read_excel(xls, sheet_name=xls.sheet_names[0], header=None, nrows=15)
pd.set_option('display.max_columns', None)
pd.set_option('display.width', 1000)
print(df)
