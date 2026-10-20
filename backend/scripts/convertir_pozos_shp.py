# Convierte el shapefile de pozos de Choluteca (UTM 16N) al JSON que sirve /api/pozos.
#   "C:\Program Files\QGIS 4.2.2\bin\python-qgis.bat" backend/scripts/convertir_pozos_shp.py <pozos.shp> backend/data/pozos-choluteca.json
# Un 0 en profundidad, temperatura o mediciones quiere decir "no medido" y se guarda como null.
import json
import re
import sys
from collections import Counter

from qgis.core import QgsApplication, QgsCoordinateReferenceSystem, QgsCoordinateTransform, QgsPointXY, QgsProject, QgsVectorLayer

shp, salida = sys.argv[1:3]
app = QgsApplication([], False)
app.initQgis()
capa = QgsVectorLayer(shp, "pozos", "ogr")
assert capa.isValid(), shp
a_wgs = QgsCoordinateTransform(capa.crs(), QgsCoordinateReferenceSystem("EPSG:4326"), QgsProject.instance())


def texto(v):
    if v is None or str(v).strip() in ("", "NULL"):
        return None
    return re.sub(r"\s+", " ", str(v)).strip()


def medida(v):
    try:
        n = float(v)
    except (TypeError, ValueError):
        n = None
    if n is None:
        m = re.search(r"-?\d+(?:[.,]\d+)?", str(v or ""))
        n = float(m.group(0).replace(",", ".")) if m else None
    return None if n is None or n == 0 else round(n, 3)


filas = list(capa.getFeatures())
repetidos = {c for c, n in Counter(texto(f["Codigo_Con"]) for f in filas).items() if c and n > 1}
pozos = []
for f in filas:
    p = f.geometry().asPoint()
    valida = 1_400_000 < p.y() < 1_500_000 and 400_000 < p.x() < 600_000
    ll = a_wgs.transform(QgsPointXY(p.x(), p.y())) if valida else None
    codigo = texto(f["Codigo_Con"])
    en_uso = texto(f["Pozo_en_us"])
    pozos.append({
        "id": f.id() + 1,
        "codigo": codigo,
        "nombre": texto(f["Nombre_del"]),
        "colonia": texto(f["Colonia"]),
        "municipio": texto(f["Municipio"]),
        "utm_x": round(p.x(), 1),
        "utm_y": round(p.y(), 1),
        "elevacion_m": medida(f["Z"]),
        "latitud": round(ll.y(), 7) if ll else None,
        "longitud": round(ll.x(), 7) if ll else None,
        "coordenada_valida": valida,
        "codigo_repetido": codigo in repetidos,
        "en_uso": True if en_uso and en_uso.lower() == "x" else None,
        "profundidad_m": medida(f["Prof__m_"]),
        "nivel_freatico_m": medida(f["NF_m"]),
        "diametro_pulg": medida(f["Diametro__"]),
        "tipo_bomba": texto(f["Tipo_Bomba"]),
        "temperatura_c": medida(f["Temp__C°_"]),
        "ph": medida(f["PH"]),
        "tds_g_l": medida(f["TDS___g_L_"]),
        "salinidad": medida(f["Salinidad"]),
        "oxigeno_disuelto": medida(f["OD_"]),
        "conductividad": texto(f["Conductivi"]),
        "cloro_residual": medida(f["Cloro_Resi"]),
        "observaciones": texto(f["Observacio"]),
    })
pozos.sort(key=lambda r: (int(re.sub(r"\D", "", r["codigo"] or "0") or 0), r["id"]))
datos = {
    "fuente": "pozos_choluteca.shp (Pozos Choluteca Part1)",
    "src": "EPSG:32616",
    "total": len(pozos),
    "pozos": pozos,
}
with open(salida, "w", encoding="utf-8") as fh:
    json.dump(datos, fh, ensure_ascii=False, indent=1)
print(f"{len(pozos)} pozos · coordenada inválida: {[r['codigo'] for r in pozos if not r['coordenada_valida']]} · códigos repetidos: {len(repetidos)}")
print("Con pH medido:", sum(1 for r in pozos if r["ph"]), "· en uso:", sum(1 for r in pozos if r["en_uso"]))
app.exitQgis()
