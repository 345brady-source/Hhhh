# gate: none
# Test-only reader for checks/workbook.js (plan 11-03). Usage: python3 -I read-xlsx.py <file.xlsx>
# Opens the workbook with openpyxl (it never writes it) and prints one JSON object:
#   parts: every entry of the zip, in order
#   raw_formulas: the number of <f> elements in all worksheet parts, counted from the XML itself
#   sheets: [{ name, max_row, max_col, cells: { "A1": { v, t, fmt, f, b } } }] for every non-empty cell, where
#     v is the value, t openpyxl's data type, fmt the number format, f true when openpyxl holds a formula,
#     b true when the font is bold.
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

import openpyxl

MAIN = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'


def main(path):
    with zipfile.ZipFile(path) as z:
        parts = z.namelist()
        raw = 0
        for name in parts:
            if name.startswith('xl/worksheets/') and name.endswith('.xml'):
                raw += sum(1 for _ in ET.fromstring(z.read(name)).iter(MAIN + 'f'))
    wb = openpyxl.load_workbook(path, data_only=False)
    sheets = []
    for ws in wb.worksheets:
        cells = {}
        for row in ws.iter_rows():
            for c in row:
                if c.value is None:
                    continue
                cells[c.coordinate] = {
                    'v': c.value if isinstance(c.value, (int, float, str)) else str(c.value),
                    't': c.data_type,
                    'fmt': c.number_format,
                    'f': c.data_type == 'f',
                    'b': bool(c.font and c.font.b),
                }
        sheets.append({'name': ws.title, 'max_row': ws.max_row, 'max_col': ws.max_column, 'cells': cells})
    print(json.dumps({'parts': parts, 'raw_formulas': raw, 'sheets': sheets}, ensure_ascii=False))


if __name__ == '__main__':
    main(sys.argv[1])
