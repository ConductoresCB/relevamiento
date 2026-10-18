"""Arma una sola página HTML del tablero (con datos ficticios) para publicarla como demostración.
Uso: python3 herramientas/construir_tablero_artifact.py salida.html
La versión para GitHub es la carpeta app/tablero/ (no hace falta este paso)."""
import os, re, sys
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
def leer(r): return open(os.path.join(RAIZ, r), encoding='utf-8').read()
html = leer('tablero/index.html')
css = leer('tablero/css/tablero.css')
cuerpo = re.search(r'<body>([\s\S]*?)<script', html).group(1)
cuerpo = cuerpo.replace('<a class="btn sec" href="../">Ir a la app de campo</a>', '')
scripts = ['js/cuestionario.js', 'js/calculos.js', 'tablero/js/estadistica.js', 'tablero/js/datos.js', 'tablero/js/graficos.js', 'tablero/js/ejemplo.js', 'tablero/js/tablero.js']
js = '\n'.join('<script>\n' + leer(s).replace('</script', '<\\/script') + '\n</script>' for s in scripts)
pagina = ('<title>Tablero del Relevamiento</title>\n'
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@500&display=swap">\n'
  '<style>\n' + css + '\n</style>\n' + cuerpo +
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>\n' + js + '\n')
open(sys.argv[1], 'w', encoding='utf-8').write(pagina)
print(sys.argv[1], len(pagina) // 1024, 'KB')
