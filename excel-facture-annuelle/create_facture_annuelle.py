"""Génère le classeur Excel « Facture annuelle » (Excel : Calculs Perfectionnement)."""

import datetime as dt

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.data_source import AxDataSource, MultiLevelStrRef, StrRef
from openpyxl.chart.series import SeriesLabel
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

OUTPUT = "Facture_annuelle.xlsx"
SHEET = "Facture annuelle"

MOIS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

COMMERCIAUX = [
    ("DUPONT", [10] * 12),
    ("LARRIVINOV", list(range(10, 33, 2))),
    ("DUJARDIN", list(range(20, 8, -1))),
    ("CONTERUR", list(range(5, 61, 5))),
]

HEADERS = [
    "Commerciaux", "Mois", "Date", "Nombre de ventes", "Gain par vente",
    "Gain par mois", "Prime", "Bonus", "Salaire mensuel brut",
    "Prélèvement d'impôts 21%", "Salaire mensuel net",
    "Moyenne des Salaires mensuels", "Max des salaires mensuels",
    "Min des salaires mensuels", "Salaire Annuel TOTAL",
]
WIDTHS = [14, 12, 12, 10, 10, 11, 9, 9, 12, 13, 12, 13, 12, 12, 14]

GAIN_PAR_VENTE = 100
PRIME = 200
BONUS = 50

HEADER_FILL = PatternFill("solid", fgColor="4A235A")
BLOCK_FILLS = [
    PatternFill("solid", fgColor="FFFFFF"),
    PatternFill("solid", fgColor="E8DAEF"),
    PatternFill("solid", fgColor="FFFFFF"),
    PatternFill("solid", fgColor="E8DAEF"),
]
CALC_FILLS = [
    PatternFill("solid", fgColor="FDEDEC"),
    PatternFill("solid", fgColor="F5B7B1"),
    PatternFill("solid", fgColor="FDEDEC"),
    PatternFill("solid", fgColor="F5B7B1"),
]
TOTAL_FILL = PatternFill("solid", fgColor="7B241C")
TITLE_FILL = PatternFill("solid", fgColor="F9E79F")

WHITE_BOLD = Font(name="Calibri", bold=True, color="FFFFFF", size=10)
BOLD = Font(name="Calibri", bold=True, size=11)
NORMAL = Font(name="Calibri", size=10)

THIN = Side(style="thin", color="000000")
MEDIUM = Side(style="medium", color="000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)

EURO = '#,##0 "€"'
EURO_2 = '#,##0.00 "€"'

FIRST_ROW = 4


def outline(ws, cell_range, side=MEDIUM):
    rows = list(ws[cell_range])
    for r, row in enumerate(rows):
        for c, cell in enumerate(row):
            b = cell.border
            cell.border = Border(
                left=side if c == 0 else b.left,
                right=side if c == len(row) - 1 else b.right,
                top=side if r == 0 else b.top,
                bottom=side if r == len(rows) - 1 else b.bottom,
                diagonal=b.diagonal,
                diagonalDown=b.diagonalDown,
                diagonalUp=b.diagonalUp,
            )


def build():
    wb = Workbook()
    ws = wb.active
    ws.title = SHEET

    for i, w in enumerate(WIDTHS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    # Titre
    ws.merge_cells("D1:O1")
    ws["D1"] = "Facture annuelle"
    ws["D1"].font = Font(name="Arial", bold=True, size=14, color="4A235A")
    ws["D1"].alignment = CENTER
    ws["D1"].fill = TITLE_FILL
    outline(ws, "D1:O1")
    ws.row_dimensions[1].height = 24

    # Case vide barrée au-dessus de Commerciaux / Mois / Date
    ws.merge_cells("A2:C2")
    ws["A2"].border = Border(
        left=THIN, right=THIN, top=THIN, bottom=THIN,
        diagonal=THIN, diagonalUp=True,
    )
    outline(ws, "A2:C2")

    # En-têtes
    for col, title in enumerate(HEADERS, start=1):
        letter = get_column_letter(col)
        if col <= 3:
            cell = ws[f"{letter}3"]
        else:
            ws.merge_cells(f"{letter}2:{letter}3")
            cell = ws[f"{letter}2"]
        cell.value = title
        cell.font = WHITE_BOLD
        cell.fill = HEADER_FILL
        cell.alignment = CENTER
        for row in (2, 3):
            if col > 3 or row == 3:
                ws[f"{letter}{row}"].border = BORDER
                ws[f"{letter}{row}"].fill = HEADER_FILL
    ws.row_dimensions[2].height = 30
    ws.row_dimensions[3].height = 30
    outline(ws, "A3:O3")
    outline(ws, "D2:O3")

    # Données et formules
    for idx, (nom, ventes) in enumerate(COMMERCIAUX):
        first = FIRST_ROW + idx * 12
        last = first + 11
        fill = BLOCK_FILLS[idx]
        calc_fill = CALC_FILLS[idx]

        for m in range(12):
            r = first + m
            ws.row_dimensions[r].height = 15
            ws[f"B{r}"] = MOIS[m]
            ws[f"C{r}"] = dt.date(2017, m + 1, 1)
            ws[f"C{r}"].number_format = "DD/MM/YYYY"
            ws[f"D{r}"] = ventes[m]
            ws[f"E{r}"] = GAIN_PAR_VENTE
            ws[f"E{r}"].number_format = EURO
            if m % 2 == 0:
                ws[f"G{r}"] = PRIME
            else:
                ws[f"H{r}"] = BONUS
            ws[f"G{r}"].number_format = EURO
            ws[f"H{r}"].number_format = EURO

            ws[f"F{r}"] = f"=D{r}*E{r}"
            ws[f"I{r}"] = f"=F{r}+G{r}+H{r}"
            ws[f"J{r}"] = f"=0.21*I{r}"
            ws[f"K{r}"] = f"=I{r}-J{r}"
            ws[f"F{r}"].number_format = EURO
            ws[f"I{r}"].number_format = EURO
            ws[f"J{r}"].number_format = EURO_2
            ws[f"K{r}"].number_format = EURO_2

            for col in range(2, 12):
                cell = ws.cell(row=r, column=col)
                cell.fill = fill
                cell.font = NORMAL
                cell.border = BORDER
                cell.alignment = Alignment(
                    horizontal="right" if col in (5, 6, 7, 8, 9, 10, 11) else "center",
                    vertical="center",
                )

        # Nom du commercial, écrit à la verticale
        ws.merge_cells(f"A{first}:A{last}")
        ws[f"A{first}"] = nom
        ws[f"A{first}"].font = Font(name="Calibri", bold=True, size=10)
        ws[f"A{first}"].alignment = Alignment(
            horizontal="center", vertical="center", text_rotation=90
        )
        for r in range(first, last + 1):
            ws[f"A{r}"].fill = fill
            ws[f"A{r}"].border = BORDER

        # Moyenne / Max / Min / Total annuel : une cellule fusionnée par commercial
        stats = {
            "L": f"=AVERAGE(K{first}:K{last})",
            "M": f"=MAX(K{first}:K{last})",
            "N": f"=MIN(K{first}:K{last})",
            "O": f"=SUM(K{first}:K{last})",
        }
        for letter, formula in stats.items():
            ws.merge_cells(f"{letter}{first}:{letter}{last}")
            cell = ws[f"{letter}{first}"]
            cell.value = formula
            cell.number_format = EURO_2
            cell.alignment = CENTER
            is_total = letter == "O"
            cell.font = WHITE_BOLD if is_total else BOLD
            for r in range(first, last + 1):
                c = ws[f"{letter}{r}"]
                c.fill = TOTAL_FILL if is_total else calc_fill
                c.border = BORDER

        outline(ws, f"A{first}:O{last}")

    # Gain Annuel TOTAL des Commerciaux
    total_row = FIRST_ROW + 12 * len(COMMERCIAUX)
    ws.merge_cells(f"A{total_row}:N{total_row}")
    ws[f"A{total_row}"] = "Gain Annuel TOTAL des Commerciaux"
    ws[f"A{total_row}"].font = Font(name="Calibri", bold=True, size=12, color="FFFFFF")
    ws[f"A{total_row}"].alignment = CENTER
    totals = [f"O{FIRST_ROW + i * 12}" for i in range(len(COMMERCIAUX))]
    ws[f"O{total_row}"] = "=" + "+".join(totals)
    ws[f"O{total_row}"].number_format = EURO_2
    ws[f"O{total_row}"].font = Font(name="Calibri", bold=True, size=11, color="FFFFFF")
    ws[f"O{total_row}"].alignment = CENTER
    for col in range(1, 16):
        cell = ws.cell(row=total_row, column=col)
        cell.fill = HEADER_FILL
        cell.border = BORDER
    ws.row_dimensions[total_row].height = 22
    outline(ws, f"A{total_row}:O{total_row}")

    last_data = total_row - 1

    # Histogramme empilé 2D : Commerciaux + Mois / Nombre de ventes / Salaire mensuel net
    chart = BarChart()
    chart.type = "col"
    chart.grouping = "stacked"
    chart.overlap = 100
    chart.title = "L'évolution annuelle de chaque commercial"
    chart.x_axis.title = "COMMERCIAUX"
    chart.height = 11
    chart.width = 32
    chart.legend.position = "r"

    for col in (11, 4):
        chart.add_data(Reference(ws, min_col=col, min_row=FIRST_ROW, max_row=last_data))
    categories = AxDataSource(
        multiLvlStrRef=MultiLevelStrRef(f=f"'{SHEET}'!$A${FIRST_ROW}:$B${last_data}")
    )
    for serie, col, color in zip(chart.series, ("K", "D"), ("4A235A", "E74C3C")):
        serie.tx = SeriesLabel(strRef=StrRef(f"'{SHEET}'!${col}$2"))
        serie.cat = categories
        serie.graphicalProperties.solidFill = color
        serie.graphicalProperties.line.solidFill = color
    chart.gapWidth = 60
    chart.x_axis.delete = False
    chart.y_axis.delete = False

    ws.add_chart(chart, f"A{total_row + 2}")

    ws.freeze_panes = "D4"
    ws.sheet_view.zoomScale = 90
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    wb.save(OUTPUT)
    print(f"Fichier créé : {OUTPUT}")


if __name__ == "__main__":
    build()
