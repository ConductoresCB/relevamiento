# Prueba del tablero en un navegador: python3 tests/tablero_e2e.py [carpeta_capturas]
# Abre el tablero con los datos de ejemplo, recorre las vistas, filtra, carga una planilla .xlsx y un CSV,
# lee una planilla de Google simulada, arma un informe y descarga imagen, tabla e informe.
import json, os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright, expect

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
SALIDA = sys.argv[1] if len(sys.argv) > 1 else '/tmp/capturas_tablero'
os.makedirs(SALIDA, exist_ok=True)
PREVIA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'previo', 'Tablero_previo_entrevistas.xlsx')
URL = 'http://localhost:8766/tablero/'
URL_SCRIPT = 'https://script.google.com/macros/s/PRUEBA/exec'

if not os.path.exists(PREVIA):
    sys.exit('Esta prueba usa previo/Tablero_previo_entrevistas.xlsx (no viaja en el zip por privacidad): copialo a esa carpeta y volvé a correrla.')
servidor = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '--directory', RAIZ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errores = []
try:
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        ctx = nav.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True)
        p = ctx.new_page()
        p.on('console', lambda m: errores.append(m.text) if m.type == 'error' and 'fonts' not in (m.location or {}).get('url', '') and 'ERR_TUNNEL' not in m.text else None)
        p.on('pageerror', lambda e: errores.append(str(e)))

        def planilla_google(route):
            cuerpo = json.loads(route.request.post_data or '{}')
            if cuerpo.get('token') != 'clave-prueba':
                return route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': False, 'error': 'Clave del equipo incorrecta'}))
            filas = [{'id': 'g-1', 'participante_id': 'P1-0014', 'edad': 53, 'fecha': '2026-10-20', 'puesto': 'AXION', 'equipo': 'B',
                      'b_sexo': 'Varón', 'b_peso_kg': 80, 'b_altura_m': 1.75, 'b_perimetro_cm': 96, 'b_pas_mmhg': 132, 'b_dbt_dx': 'No',
                      'b_act_fisica': 'No', 'b_fyv_diario': 'No', 'b_med_antihta': 'No', 'b_glucosa_previa': 'No',
                      'b_antec_fam_dbt': 'No', 'b_fuma': 'No', 'g_resultado_mgdl': 101}]
            route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'filas': filas}))
        ctx.route(URL_SCRIPT, planilla_google)

        p.goto(URL)
        expect(p.get_by_text('Datos ficticios de ejemplo')).to_be_visible()
        expect(p.locator('.kpi').first).to_contain_text('130')
        expect(p.locator('#g-fr svg')).to_be_visible()
        p.screenshot(path=f'{SALIDA}/01_resumen.png', full_page=True)

        # Filtro por punto
        p.locator('details[data-filtro="puesto"] > summary').click()
        p.locator('input[data-filtro-cat="puesto"][value="AXION"]').check()
        expect(p.locator('.resumen-filtros')).to_contain_text('52 de 130 participantes')
        p.locator('details[data-filtro="puesto"] [data-accion="cerrar-menu"]').click()
        p.get_by_role('button', name='Quitar filtros').click()
        expect(p.locator('.resumen-filtros')).to_contain_text('130 de 130')

        # Unidad: relevamientos
        p.locator('[data-unidad="relevamientos"]').click()
        expect(p.locator('.resumen-filtros')).to_contain_text('148 de 148 relevamientos')
        p.locator('[data-unidad="participantes"]').click()

        # Explorar con comparación
        p.locator('.nav button[data-vista="explorar"]').click()
        p.locator('select[data-campo="explorar.v"]').select_option('p34_actividad_fisica')
        p.locator('select[data-campo="explorar.por"]').select_option('puesto')
        expect(p.locator('#g-exp svg')).to_be_visible()
        expect(p.locator('#g-exp')).to_contain_text('Chi cuadrado')
        p.locator('select[data-campo="explorar.v"]').select_option('b_imc')
        expect(p.locator('#g-exp')).to_contain_text('Media')
        p.screenshot(path=f'{SALIDA}/02_explorar.png', full_page=True)

        # Cruces: sugerencia + tabla dinámica + descarga de imagen y tabla
        p.locator('.nav button[data-vista="cruces"]').click()
        p.get_by_role('button', name='Frutas y verduras × FINDRISK').click()
        expect(p.locator('#g-cruce h3')).to_contain_text('Frutas y verduras en ruta × Riesgo FINDRISK')
        expect(p.get_by_role('heading', name='Tabla dinámica')).to_be_visible()
        p.locator('select[data-campo="cruce.mostrar"]').select_option('media')
        expect(p.locator('select[data-campo="cruce.num"]')).to_be_visible()
        with p.expect_download() as d:
            p.locator('#g-cruce [data-accion="png"]').click()
        assert d.value.suggested_filename.endswith('.png'), d.value.suggested_filename
        d.value.save_as(f'{SALIDA}/cruce.png')
        with p.expect_download() as d:
            p.locator('#g-cruce [data-accion="csv"]').click()
        d.value.save_as(f'{SALIDA}/cruce.csv')
        assert 'Total' in open(f'{SALIDA}/cruce.csv', encoding='utf-8-sig').read()
        p.locator('#g-cruce [data-accion="informe"]').click()
        p.screenshot(path=f'{SALIDA}/03_cruces.png', full_page=True)

        # Relaciones
        p.locator('.nav button[data-vista="relaciones"]').click()
        expect(p.locator('#g-rel')).to_contain_text('r de Pearson')
        p.locator('select[data-campo="relacion.color"]').select_option('b_sexo')
        expect(p.locator('#g-rel svg circle').first).to_be_visible()
        p.locator('#g-rel [data-accion="informe"]').click()
        p.screenshot(path=f'{SALIDA}/04_relaciones.png', full_page=True)

        # Informe
        p.locator('.nav button[data-vista="informe"]').click()
        expect(p.locator('.item-informe')).to_have_count(2)
        p.locator('textarea[data-nota="0"]').fill('Nota de prueba para el equipo.')
        with p.expect_download() as d:
            p.get_by_role('button', name='Descargar informe (HTML)').click()
        d.value.save_as(f'{SALIDA}/informe.html')
        inf = open(f'{SALIDA}/informe.html', encoding='utf-8').read()
        assert 'Nota de prueba para el equipo.' in inf and 'DATOS FICTICIOS' in inf and inf.count('<svg') >= 2
        p.screenshot(path=f'{SALIDA}/05_informe.png', full_page=True)

        # Fuentes: cargar la planilla previa reemplaza los datos de ejemplo
        p.locator('.nav button[data-vista="fuentes"]').click()
        p.locator('#archivo').first.set_input_files(PREVIA)
        expect(p.locator('#pildora-datos')).to_contain_text('38 relevamientos')
        expect(p.get_by_text('Datos ficticios de ejemplo')).to_have_count(0)
        expect(p.locator('input[data-etiqueta="0"]')).to_have_value('Previa')
        # CSV de la app (punto y coma, coma decimal)
        csv = ('id;participante_id;codigo;edad;fecha;equipo;puesto;b_sexo;b_peso_kg;b_altura_m;b_pas_mmhg;b_pad_mmhg;p01_nac_pais\r\n'
               'x-1;A1-0001;001-44-4600;44;2026-10-21;A;AXION;Varón;86,4;1,72;138;88;Argentina\r\n'
               'x-2;B1-0091;001-44-4600;44;2026-10-22;B;AXION;Varón;86,0;1,72;140;90;Argentina\r\n')
        open(f'{SALIDA}/app.csv', 'w', encoding='utf-8-sig').write(csv)
        p.locator('#archivo').first.set_input_files(f'{SALIDA}/app.csv')
        expect(p.locator('#pildora-datos')).to_contain_text('40 relevamientos')
        # 1.4: el mismo código en dos relevamientos distintos se marca para revisar
        expect(p.get_by_text(re.compile('1 código aparece en más de un relevamiento'))).to_be_visible()
        expect(p.locator('.nota-privacidad', has_text='Revisar')).to_contain_text('001-44-4600 (2)')
        assert p.evaluate("Datos.diccionario().some(v => v.id === 'b_pad_mmhg' && v.tipo === 'numerica')")
        # 1.4: un paquete cifrado de la app no se carga acá: se explica que va en la app
        open(f'{SALIDA}/paquete_A1.txt', 'w', encoding='utf-8').write('{"tipo":"paquete-relevamiento","version":2,"cifrado":true}')
        p.locator('#archivo').first.set_input_files(f'{SALIDA}/paquete_A1.txt')
        expect(p.get_by_text(re.compile('es un paquete cifrado de la app'))).to_be_visible()
        expect(p.locator('#pildora-datos')).to_contain_text('40 relevamientos')
        # Planilla de Google simulada (visita de control de P1-0014: se une con la previa)
        p.locator('input[data-campo="conexion.url"]').fill(URL_SCRIPT)
        p.locator('input[data-campo="conexion.clave"]').fill('clave-prueba')
        p.get_by_role('button', name='Leer la planilla').click()
        expect(p.locator('#pildora-datos')).to_contain_text('41 relevamientos')
        p.screenshot(path=f'{SALIDA}/06_fuentes.png', full_page=True)

        p.locator('.nav button[data-vista="participantes"]').click()
        fila = p.locator('table.datos tbody tr', has_text='P1-0014')
        expect(fila).to_contain_text('2')            # dos visitas
        expect(fila).to_contain_text('Ligeramente elevado')  # FINDRISK con datos unidos
        p.screenshot(path=f'{SALIDA}/07_participantes.png', full_page=True)
        p.locator('.nav button[data-vista="resumen"]').click()
        expect(p.locator('#g-fr svg')).to_be_visible()
        p.screenshot(path=f'{SALIDA}/08_resumen_previa.png', full_page=True)

        # Celular: sin desplazamiento horizontal
        m = nav.new_page(viewport={'width': 390, 'height': 844})
        m.on('pageerror', lambda e: errores.append('móvil: ' + str(e)))
        m.goto(URL)
        expect(m.locator('.kpi').first).to_be_visible()
        for v in ['resumen', 'cruces', 'participantes']:
            m.locator(f'.nav button[data-vista="{v}"]').click()
            assert m.evaluate('document.documentElement.scrollWidth') <= 390, v
        m.locator('.nav button[data-vista="resumen"]').click()
        m.screenshot(path=f'{SALIDA}/09_celular.png', full_page=True)

        # Tema oscuro
        o = nav.new_page(viewport={'width': 1366, 'height': 900}, color_scheme='dark')
        o.goto(URL + '#')
        o.locator('.nav button[data-vista="cruces"]').click()
        o.screenshot(path=f'{SALIDA}/10_oscuro.png', full_page=True)
        nav.close()
finally:
    servidor.terminate()

print('Errores de consola:', errores or 'ninguno')
assert not errores, errores
print('TABLERO OK')
