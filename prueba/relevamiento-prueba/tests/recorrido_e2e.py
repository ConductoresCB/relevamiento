"""
Prueba de punta a punta en un navegador con tamaño de celular.
Uso: python3 tests/recorrido_e2e.py  (levanta un servidor local en el puerto 8765)
"""
import json, os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright, expect

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
SALIDA = sys.argv[1] if len(sys.argv) > 1 else '/tmp/capturas'
os.makedirs(SALIDA, exist_ok=True)
URL = 'http://localhost:8765/'
URL_SCRIPT = 'https://script.google.com/macros/s/PRUEBA/exec'

servidor = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=RAIZ,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errores, enviados = [], []

def captura(p, nombre):
    p.screenshot(path=os.path.join(SALIDA, nombre + '.png'), full_page=True)

def opcion(p, texto, dentro=None):
    zona = p.locator('fieldset', has_text=dentro) if dentro else p
    zona.get_by_role('button', name=texto, exact=True).first.click()

try:
    with sync_playwright() as pw:
        nav = pw.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        ctx = nav.new_context(permissions=['microphone'], viewport={'width': 393, 'height': 851}, device_scale_factor=2, is_mobile=True, has_touch=True,
                              accept_downloads=True, locale='es-AR')
        def responder(route):
            cuerpo = json.loads(route.request.post_data)
            enviados.append(cuerpo)
            if cuerpo.get('accion') == 'probar':
                route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'planilla': 'Base de prueba'}))
            else:
                ids = [r['fila']['id'] for r in cuerpo['registros']]
                route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'recibidos': ids}))
        ctx.route(re.compile(r'https://script\.google\.com/.*'), responder)
        p = ctx.new_page()
        p.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
        p.on('pageerror', lambda e: errores.append(str(e)))
        dialogos = []
        def dialogo(d):
            dialogos.append(d.message)
            d.accept('BORRAR') if d.type == 'prompt' else d.accept()
        p.on('dialog', dialogo)

        def consentir(pag, graba=True):
            expect(pag.get_by_role('heading', level=1)).to_have_text('Consentimiento')
            opcion(pag, 'Sí', 'participar'); opcion(pag, 'Sí', 'punción'); opcion(pag, 'Sí' if graba else 'No', 'grabe')
            pag.get_by_label('Firmó en papel (firma o impresión dactiloscópica).').check()
            pag.get_by_role('button', name='Iniciar grabación y continuar' if graba else 'Continuar').click()
            expect(pag.locator('#reg-orden')).to_be_visible()

        p.goto(URL)
        expect(p.get_by_role('heading', level=1)).to_contain_text('Jornada del')
        p.wait_for_timeout(800)
        captura(p, '01_jornada_vacia')

        # Ajustes
        p.get_by_role('link', name='Ajustes del dispositivo').click()
        p.get_by_label('Encuestador/a habitual').fill('MB')
        p.get_by_label('Puesto o lugar de relevamiento').fill('Puesto 1')
        p.get_by_label('Dirección de la aplicación web (Apps Script)').fill(URL_SCRIPT)
        p.get_by_label('Clave del equipo').fill('clave-equipo-prueba')
        p.get_by_role('button', name='Probar conexión').click()
        expect(p.get_by_text('Conexión correcta')).to_be_visible()
        captura(p, '02_ajustes')
        p.get_by_role('link', name='Volver').click()

        # Nuevo relevamiento: primero el consentimiento (con grabación)
        p.get_by_role('button', name='Nuevo relevamiento').click()
        expect(p.get_by_role('button', name='Continuar')).to_be_disabled()
        captura(p, '03a_consentimiento')
        consentir(p)
        expect(p.locator('.barra-grabacion')).to_contain_text('Grabando')
        expect(p.locator('#reg-orden')).to_have_value('1')
        p.locator('#reg-orden').fill('10')
        p.locator('#reg-edad').fill('44')
        p.locator('#reg-cp').fill('4600')
        expect(p.locator('.placa .valor')).to_have_text('010-44-4600')
        expect(p.get_by_text('¿Participó en un relevamiento anterior?')).to_have_count(0)
        p.get_by_label('Celular').fill('3884000012')
        expect(p.get_by_label('Encuestador/es de esta entrevista')).to_have_value('MB')
        p.get_by_label('Encuestador/es de esta entrevista').fill('MB y JP')
        p.get_by_label('Acepta que sus resultados se vean en la app de camioneros.').check()
        captura(p, '03_participante')
        p.get_by_role('button', name='Continuar con sociodemográfica').click()

        # Sección 1
        expect(p.get_by_role('heading', level=1)).to_have_text('Origen y educación')
        opcion(p, 'Argentina'); p.get_by_label('Provincia').fill('Jujuy')
        opcion(p, 'Secundaria completa')
        captura(p, '04_socio_s1')
        p.get_by_role('link', name='Siguiente').click()
        # Sección 2
        opcion(p, 'Sí', 'pareja'); opcion(p, '3', 'convive'); opcion(p, 'Ninguna', 'a cargo')
        # Recuadro «Para profundizar»: cerrado, se abre, se tilda y se cierra
        expect(p.locator('.prof-fila')).to_have_count(0)
        p.get_by_role('button', name=re.compile('Para profundizar · Familia')).click()
        expect(p.locator('.prof-fila')).to_have_count(4)
        p.get_by_role('button', name='¿Quiénes conforman su familia?').click()
        expect(p.locator('.prof-cuenta').first).to_contain_text('1 de 4')
        captura(p, '04c_profundizar')
        p.get_by_role('button', name='Cerrar').click()
        expect(p.locator('.prof-fila')).to_have_count(0)
        expect(p.get_by_role('button', name='Ninguna (vive solo)', exact=True)).to_be_visible()
        captura(p, '04b_socio_s2')
        p.get_by_role('link', name='Siguiente').click()
        # Sección 3
        opcion(p, 'Español', 'entiende'); opcion(p, 'Portugués', 'entiende')
        opcion(p, 'Español', 'habla')
        opcion(p, 'Argentina', 'licencia')
        expect(p.get_by_text('Categoría (Argentina)')).to_have_count(0)
        opcion(p, 'Otro', 'licencia'); p.get_by_label('¿En qué país?').fill('Bolivia')
        p.get_by_role('link', name='Siguiente').click()
        # Sección 4
        opcion(p, 'Regular'); p.get_by_label('¿Hace cuántos años trabaja como chofer de camión?').fill('18')
        opcion(p, 'Viaje internacional')
        p.get_by_label('Otros tramos del corredor + Jujuy').select_option('Una vez a la semana')
        p.get_by_label('Tramo Jujuy').select_option('2 veces por semana')
        opcion(p, 'Otro', 'relación laboral'); p.get_by_label('Especificar').fill('Cooperativa')
        opcion(p, 'Conforme'); opcion(p, 'Duda')
        p.get_by_label('Por lo general, ¿cuántas horas conduce sin hacer paradas?').fill('4,5')
        opcion(p, 'Sí', 'paradas')
        captura(p, '05_socio_s4')
        p.get_by_role('link', name='Siguiente').click()
        # Sección 5
        opcion(p, 'Paradores'); opcion(p, 'Estaciones de servicio')
        p.get_by_label('¿Cuántas horas duerme por día?').fill('6')
        opcion(p, 'Casi nunca', 'frutas'); opcion(p, 'Agua'); opcion(p, 'Mate')
        opcion(p, 'A veces', 'sanitarios'); opcion(p, 'Rara vez')
        p.get_by_role('link', name='Siguiente').click()
        # Sección 6
        opcion(p, 'No', 'siniestro'); opcion(p, 'Parcialmente'); opcion(p, 'Obra social')
        opcion(p, 'Sistema público', 'control médico'); opcion(p, 'Solo cuando me siento mal')
        opcion(p, 'Sistema público', 'dolencias')
        opcion(p, 'Sí', 'dolores'); p.get_by_label('¿Qué dolores corporales presenta?').fill('Lumbar')
        opcion(p, 'Ninguno', 'suele tomar')
        expect(p.get_by_text('¿Qué medicamentos o hierbas toma?')).to_have_count(0)
        opcion(p, 'Musculoesqueléticos')
        captura(p, '06_socio_s6')
        p.get_by_role('link', name='Siguiente').click()
        # Sección 7
        opcion(p, 'Rara vez'); opcion(p, 'Café', 'energéticas'); opcion(p, 'Sí', 'coquea'); opcion(p, 'No', 'alcohólicas')
        opcion(p, 'A veces', 'colegas'); opcion(p, 'No', 'compartir trayectos')
        expect(p.get_by_text('38 de 38 respondidas')).to_be_visible()
        p.get_by_role('link', name='Ir a biológica').click()

        # Biológica 1
        opcion(p, 'No', 'diabetes'); opcion(p, 'Varón')
        p.get_by_label('Peso').fill('86,4'); p.get_by_label('Altura').fill('1,72')
        p.get_by_label('Perímetro abdominal').fill('101'); p.get_by_label('Presión sistólica').fill('138')
        p.get_by_label('Presión diastólica').fill('140')
        expect(p.get_by_text('la diastólica es igual o mayor que la sistólica')).to_be_visible()
        p.get_by_label('Presión diastólica').fill('88')
        expect(p.get_by_text('la diastólica es igual o mayor que la sistólica')).to_have_count(0)
        expect(p.locator('.calc')).to_contain_text('PAD 88')
        expect(p.locator('.calc')).to_contain_text('29,2')
        expect(p.locator('.resumen-pie')).to_contain_text('4 pts')
        captura(p, '07_bio_mediciones')
        p.get_by_label('Altura').fill('3'); expect(p.get_by_text('Fuera de rango (1,2–2,2)')).to_be_visible()
        p.get_by_label('Altura').fill('1,72')
        p.get_by_role('link', name='Siguiente').click()
        # Biológica 2
        opcion(p, 'No', 'actividad física'); opcion(p, 'No', 'frutas'); opcion(p, 'No', 'hipertensión')
        opcion(p, 'No', 'antihipertensiva'); opcion(p, 'No', 'glucosa elevada'); opcion(p, 'Sí, primer grado'); opcion(p, 'Sí', 'tabaco')
        expect(p.locator('.resumen-pie')).to_contain_text('12 pts')
        captura(p, '08_bio_antecedentes')
        p.get_by_role('link', name='Siguiente').click()
        # Biológica 3
        opcion(p, 'Sí', 'azúcar')
        p.get_by_label('Hora de la última ingesta').fill('08:15')
        p.get_by_label('Hora de la medición').fill('11:20')
        p.get_by_label('¿Qué comió o bebió?').fill('Mate y pan')
        p.get_by_label('Resultado de glucometría periférica').fill('112')
        expect(p.get_by_text('Ayuno de 3 h 05 min')).to_be_visible()
        captura(p, '09_bio_glucometria')
        p.get_by_role('link', name='Antes de terminar').click()
        expect(p.get_by_role('heading', level=1)).to_have_text('Antes de terminar')
        p.get_by_role('button', name='¿Qué conoce del corredor bioceánico? ¿Cómo se enteró?').click()
        expect(p.get_by_text('Quedaron sin tocar (si da el tiempo)')).to_be_visible()
        captura(p, '09b_antes_de_terminar')
        p.wait_for_timeout(5500)  # al menos un trozo de audio guardado
        p.get_by_role('button', name='Detener grabación y ver resultados').click()
        expect(p.locator('.ok-linea', has_text='Audio guardado')).to_be_visible()

        # Resultados
        expect(p.locator('main')).to_contain_text('Moderado')
        expect(p.locator('main')).to_contain_text('3 % a 10 años')
        expect(p.get_by_text('ID del participante')).to_have_count(0)
        expect(p.locator('main')).not_to_contain_text('A1-0010')
        expect(p.locator('.placa-chica')).to_have_text('010-44-4600')
        captura(p, '10_resultados')
        p.get_by_role('button', name='Guardar y volver a la jornada').click()
        expect(p.get_by_role('heading', level=1)).to_contain_text('Jornada del')
        expect(p.locator('.registro').first).to_contain_text('010-44-4600')
        expect(p.locator('.registro').first).not_to_contain_text('A1-')
        # Buscador de la jornada: por partes del código o por los últimos números del celular
        for consulta in ['44-4600', '4600', '010', '0012']:
            p.get_by_placeholder('Buscar por código o celular').fill(consulta)
            expect(p.locator('.registro')).to_have_count(1)
        p.get_by_placeholder('Buscar por código o celular').fill('4400')
        expect(p.get_by_text('No hay coincidencias en este dispositivo.')).to_be_visible()
        p.get_by_placeholder('Buscar por código o celular').fill('')
        captura(p, '11_jornada_con_registro')

        # Segundo relevamiento solo biológico (control), sin grabación: el N° de orden no se puede repetir
        p.get_by_role('button', name='Nuevo relevamiento').click()
        consentir(p, graba=False)
        expect(p.locator('#reg-orden')).to_have_value('11')
        p.locator('#reg-orden').fill('10')
        p.locator('#reg-edad').fill('52'); p.locator('#reg-cp').fill('4400')
        expect(p.get_by_text(re.compile('Ese N° de orden ya se usó en este dispositivo'))).to_be_visible()
        p.get_by_role('button', name='Ir directo a la biológica').click()
        expect(p.get_by_text(re.compile('El N° de orden 10 ya se usó'))).to_be_visible()
        p.locator('#reg-orden').fill('11')
        expect(p.get_by_label('Encuestador/es de esta entrevista')).to_have_value('MB')
        captura(p, '11b_identificacion')
        p.get_by_role('button', name='Ir directo a la biológica').click()
        expect(p.get_by_role('heading', level=1)).to_have_text('Mediciones')
        p.get_by_role('link', name='Volver').click()  # vuelve a la sección 7 de socio
        p.goto(URL + '#/jornada')

        # Cierre y sincronización
        p.get_by_role('link', name='Cerrar jornada y sincronizar').click()
        captura(p, '12_cierre')
        p.get_by_role('button', name='Sincronizar ahora').click()
        expect(p.get_by_text(re.compile('Listo: 2 relevamientos'))).to_be_visible()
        fila = [r for c in enviados if c.get('accion') == 'guardar' for r in c['registros'] if r['fila']['codigo'] == '010-44-4600'][0]
        f = fila['fila']
        assert f['fr_puntos'] == 12 and f['fr_categoria'] == 'Moderado', f
        assert f['fh_puntos'] == 7 and f['fh_riesgo'] == '3', f
        assert f['b_imc'] == 29.2 and f['g_ayuno_min'] == 185 and f['p16_horas_sin_parar'] == 4.5, f
        assert f['p32_cuales_med'] == '' and f['socio_completo'] == 'Sí' and 'celular' not in f, f
        assert f['encuestador'] == 'MB y JP', f['encuestador']
        assert f['p05_a_cargo'] == 'Ninguna' and f['p08_licencia'] == 'Argentina; Otro' and f['p08_lic_otro'] == 'Bolivia', f
        assert 'p08_lic_ar' not in f, 'ya no se pide la categoría'
        assert f['consent_grabacion'] == 'Sí' and f['consent_firma'] == 'Sí' and f['audio_archivos'].startswith('010-44-4600_'), f
        assert f['ent_familia'] == '1/4' and f['ent_bioceanico'] == '1/5' and 'Socio 2 Hogar' in f['ent_marcas'], f
        assert f['participante_id'] == 'A1-0010' and f['b_pad_mmhg'] == 88 and f['version_instrumento'] == '2026-10-v3-prueba', f
        f2 = [r for c in enviados if c.get('accion') == 'guardar' for r in c['registros'] if r['fila']['codigo'] == '011-52-4400'][0]['fila']
        assert f2['participante_id'] == 'A1-0011', f2['participante_id']
        expect(p.get_by_text(re.compile('La administradora lo importa'))).to_be_visible()
        assert fila['contacto']['celular'] == '3884000012'
        assert all(c.get('token') == 'clave-equipo-prueba' for c in enviados)
        captura(p, '13_cierre_sincronizado')

        # Paquete del día (en la prueba se descarga): cifrado, con huella; el CSV sin cifrar ya no está en el cierre
        expect(p.get_by_role('button', name='Descargar CSV para Excel')).to_have_count(0)
        with p.expect_download() as d:
            p.get_by_role('button', name='Compartir paquete del día').click()
        ruta_paquete = os.path.join(SALIDA, d.value.suggested_filename); d.value.save_as(ruta_paquete)
        expect(p.get_by_text(re.compile(r'huella [0-9A-F]{4}-[0-9A-F]{4}')).first).to_be_visible()
        huella = re.search(r'[0-9A-F]{4}-[0-9A-F]{4}', p.locator('.tarjeta.discontinua').inner_text()).group(0)
        paquete = json.load(open(ruta_paquete, encoding='utf-8'))
        assert paquete['cifrado'] is True and paquete['cantidad'] == 2 and paquete['version'] == 2, paquete.keys()
        assert '3884000012' not in open(ruta_paquete, encoding='utf-8').read()
        # Un paquete alterado (para probar que se rechaza)
        alterado = dict(paquete); alterado['cantidad'] = 1
        ruta_alterado = os.path.join(SALIDA, 'paquete_alterado.txt'); json.dump(alterado, open(ruta_alterado, 'w', encoding='utf-8'))

        # Sin señal: la app abre igual desde el dispositivo
        ctx.set_offline(True)
        p.reload()
        expect(p.get_by_role('heading', level=1)).to_be_visible()
        expect(p.get_by_text('Sin señal')).to_be_visible()
        captura(p, '14_sin_senal')
        ctx.set_offline(False)

        # Administradora: otra "computadora" importa el paquete
        ctx2 = nav.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
        q = ctx2.new_page()
        q.on('pageerror', lambda e: errores.append(str(e)))
        q.goto(URL + '#/ajustes')
        q.get_by_label('Clave del equipo').fill('clave-equipo-prueba')
        q.get_by_role('link', name='Importar paquetes de otros dispositivos').click()
        q.locator('#archivos-paquete').set_input_files(ruta_paquete)
        expect(q.get_by_text(re.compile('2 nuevos, 0 actualizados'))).to_be_visible()
        expect(q.get_by_text(re.compile('huella ' + huella))).to_be_visible()  # la misma huella que vio el encuestador
        captura(q, '15_importar_pc')
        q.locator('#archivos-paquete').set_input_files(ruta_paquete)
        expect(q.get_by_text(re.compile('0 nuevos, 0 actualizados, 2 ya estaban'))).to_be_visible()
        q.locator('#archivos-paquete').set_input_files(ruta_alterado)
        expect(q.get_by_text(re.compile('el archivo fue modificado'))).to_be_visible()
        expect(q.get_by_text(re.compile('NO están cifrados'))).to_be_visible()
        with q.expect_download() as d2:
            q.get_by_role('button', name='Descargar CSV consolidado').click()
        ruta_csv = os.path.join(SALIDA, d2.value.suggested_filename); d2.value.save_as(ruta_csv)
        assert 'b_pad_mmhg' in open(ruta_csv, encoding='utf-8-sig').read().splitlines()[0]
        q.goto(URL + '#/ajustes')
        q.get_by_text('Registro de operaciones de este dispositivo').click()
        expect(q.locator('.bitacora')).to_contain_text('Paquete importado')
        expect(q.locator('.bitacora')).to_contain_text('Paquete rechazado')

        # Celular: registro de operaciones y borrado (Ajustes > Zona de cuidado)
        p.goto(URL + '#/ajustes')
        expect(p.get_by_text(re.compile(r'App 1\.5\.0-prueba'))).to_be_visible()
        expect(p.get_by_role('heading', name='Administración y respaldo')).to_be_visible()
        p.get_by_text('Registro de operaciones de este dispositivo').click()
        bit = p.locator('.bitacora')
        for ev in ['Relevamiento iniciado', 'Relevamiento finalizado', 'Envío a la planilla', 'Paquete generado']:
            expect(bit).to_contain_text(ev)
        assert '3884000012' not in bit.inner_text() and '010-44-4600' not in bit.inner_text()
        captura(p, '16_ajustes_registro')
        # Audios del día: pasar a la computadora (en la prueba se descarga), confirmar y liberar espacio
        p.goto(URL + '#/cierre')
        p.get_by_role('link', name=re.compile(r'Audios del día \(1\)')).click()
        expect(p.locator('.registro')).to_contain_text('010-44-4600_')
        captura(p, '16b_audios')
        with p.expect_download() as da:
            p.get_by_role('button', name='Pasar 1 audio a la computadora').click()
        assert da.value.suggested_filename.startswith('010-44-4600_') and da.value.suggested_filename.endswith('.webm'), da.value.suggested_filename
        ruta_audio = os.path.join(SALIDA, da.value.suggested_filename); da.value.save_as(ruta_audio)
        assert os.path.getsize(ruta_audio) > 1000, os.path.getsize(ruta_audio)
        expect(p.get_by_text('Copiado a la PC')).to_be_visible()
        p.get_by_role('button', name=re.compile('Liberar espacio')).click()
        expect(p.get_by_text('Todavía no hay grabaciones.')).to_be_visible()
        expect(p.get_by_role('link', name='Volver a la jornada')).to_be_visible()
        # Un relevamiento sin enviar: un solo botón, pide BORRAR, avisa y antes descarga un respaldo cifrado
        p.goto(URL + '#/jornada')
        p.get_by_role('button', name='Nuevo relevamiento').click()
        consentir(p, graba=False)
        p.locator('#reg-orden').fill('20'); p.locator('#reg-edad').fill('30'); p.locator('#reg-cp').fill('4600')
        p.get_by_role('button', name='Ir directo a la biológica').click()
        p.goto(URL + '#/ajustes')
        expect(p.get_by_text('Hay 1 sin enviar')).to_be_visible()
        with p.expect_download() as d3:
            p.get_by_role('button', name='Borrar los datos de este celular').click()
        assert d3.value.suggested_filename.startswith('respaldo_A1_'), d3.value.suggested_filename
        assert any('NO se enviaron' in m for m in dialogos)
        expect(p.get_by_role('heading', level=1)).to_contain_text('Jornada del')
        expect(p.get_by_text('Todavía no hay relevamientos')).to_be_visible()
        p.get_by_role('button', name='Nuevo relevamiento').click()
        consentir(p, graba=False)
        expect(p.locator('#reg-orden')).to_have_value('1')
        nav.close()

    # Etapa 2 de la guía: abrir index.html con doble clic (file://), sin servidor
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        f = nav.new_page(viewport={'width': 393, 'height': 851})
        f.on('pageerror', lambda e: errores.append('file:// ' + str(e)))
        f.goto('file://' + os.path.abspath(os.path.join(RAIZ, 'index.html')))
        expect(f.get_by_role('heading', level=1)).to_contain_text('Jornada del')
        f.get_by_role('button', name='Nuevo relevamiento').click()
        consentir(f, graba=False)
        f.locator('#reg-edad').fill('44'); f.locator('#reg-cp').fill('4600')
        f.get_by_role('button', name='Ir directo a la biológica').click()
        expect(f.get_by_role('heading', level=1)).to_have_text('Mediciones')
        f.goto('file://' + os.path.abspath(os.path.join(RAIZ, 'index.html')) + '#/jornada')
        expect(f.locator('.registro').first).to_contain_text('001-44-4600')
        assert f.evaluate('window.isSecureContext and !!crypto.subtle'.replace(' and ', ' && ')), 'cifrado no disponible en file://'
        captura(f, '16_file_local')
        nav.close()
finally:
    servidor.terminate()

print('Errores de consola:', errores or 'ninguno')
print('CSV:', open(ruta_csv, encoding='utf-8-sig').read().splitlines()[0][:160], '…')
print('RECORRIDO COMPLETO OK')
