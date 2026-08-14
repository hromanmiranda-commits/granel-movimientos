import openpyxl

wb = openpyxl.load_workbook("Ventas Granel.xlsx", data_only=False)

for name in ["Ignacio", "ENAP"]:
    if name in wb.sheetnames:
        ws = wb[name]
        print(f"=== {name} Merged Cells ===")
        for merged_cell in ws.merged_cells.ranges:
            print(merged_cell)

