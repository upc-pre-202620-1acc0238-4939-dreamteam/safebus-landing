# SafeBus landing

Implementación de las secciones 3.1.1–3.1.3 del informe de DreamTeam y de los cuatro diseños finales de `dreamteam-report/docs/ui-design`. Inglés inicial y español latinoamericano, con contenido HTML generado por idioma, estilos propios y JavaScript progresivo. El repositorio original contenía únicamente este README; no existía un framework previo.

## Ejecutar

Requiere Node.js **24.14 o posterior** y npm. No requiere un servidor de base de datos externo.

```powershell
npm ci
npm run dev
```

Abra http://127.0.0.1:3000. La raíz redirige a `/en/`; la traducción está en `/es/`. Los cambios dentro de `src` recompilan automáticamente; actualice el navegador para verlos.

Para ejecutar la compilación final:

```powershell
npm run build
npm start
```

## Arquitectura

- `src/content.mjs`: textos EN/ES, dominio y localización.
- `src/render.mjs`: HTML semántico y componentes reutilizables; las vistas de la app son ilustraciones con datos ficticios.
- `src/styles.css`: tokens del informe, tipografía, grillas, responsive y estados accesibles.
- `src/app.js`: menú, teclado, validación, envío y confirmación de contacto.
- `scripts/build.mjs`: genera las páginas, términos, recursos y metadatos en `dist`.
- `server.mjs`: servidor HTTP, recepción de contacto y persistencia SQLite.
- `tests`: pruebas API y navegador, independientes de la base de datos del proyecto.

Inter y Material Symbols Rounded se sirven localmente desde los paquetes instalados; la página no depende de fuentes remotas. Se usan HTML/CSS/JavaScript estándar para mantener una landing ligera, sin hidratación ni framework innecesario.

## Fidelidad al informe

Orden: Hero → How it works → Benefits → Fleet ilustrativa → Tools → Pricing → Contact → Footer. Encabezado fijo con anclas, CTA visible en móvil, selector EN/ES y pie con términos/contacto.

Paleta, escala tipográfica, contenedor de 1200 px, separación de columnas de 24 px, márgenes móviles de 16 px, radios y espaciado base siguen 3.1.1. Las grillas de dos y tres columnas ocupan respectivamente seis y cuatro columnas de la estructura desktop de doce columnas. En teléfono el contenido ocupa las cuatro columnas.

Se preservan los tres pasajeros distintos en cinco minutos, la aprobación empresarial antes de crear una emergencia de pasajeros y el envío pendiente sin conexión. Se incluyen S/ 99 por bus/mes, instalación y descuento de 20 % desde tres buses. No se promete intervención policial ni se exponen operaciones de empresas.

Ajustes funcionales respecto de las imágenes: consentimiento obligatorio según US15; botón de envío con altura accesible; texto azul de marca sobre fondos azules claros para cumplir contraste; redes sociales como aviso de disponibilidad, sin enlaces ficticios. Las ilustraciones se reconstruyeron como SVG y HTML, no como capturas de la página.

## Formulario real — US15

`POST /api/contact` recibe `company`, `name`, `email`, `consent: true` y `submissionId` (UUID v4). Valida también en el servidor. Almacena la solicitud, consentimiento, fecha UTC y referencia de recepción en `data/contacts.sqlite`.

- Respuesta 201: `{ reference, receivedAt }`.
- Reintento con el mismo identificador y datos: 200 y el mismo recibo, incluso después de reiniciar el servidor.
- Datos inválidos: 422 con nombres de campos; no se guarda la solicitud.
- Mismo identificador con datos distintos: 409.
- El navegador conserva los campos ante fallos y reutiliza el identificador al reintentar.
- No hay endpoint público para leer solicitudes; la carpeta de datos no se sirve por HTTP y está excluida de Git.
- Se limita el tamaño de petición y se aceptan como máximo diez solicitudes nuevas por minuto y dirección de conexión. Los reintentos válidos mantienen acceso a su recibo.

**La recepción almacena solicitudes; no envía correos ni notificaciones al equipo.** No se ha inventado una dirección comercial ni una integración SMTP. El equipo puede administrar el archivo SQLite privado o conectar posteriormente su sistema de atención.

## Configuración de publicación

Variables de entorno (PowerShell):

```powershell
$env:SITE_URL = 'https://su-dominio-real.example'
$env:HOST = '0.0.0.0'
$env:PORT = '3000'
$env:DATA_FILE = 'D:/datos-safebus/contacts.sqlite'
npm run build
npm start
```

Use el dominio real en `SITE_URL` antes de compilar: genera canonical y sitemap absolutos. Sin esta variable no se publica un dominio ficticio. El servidor Node es necesario para recibir solicitudes; subir solo `dist` a un hosting estático no habilita el formulario.

Configure HTTPS en el proxy del despliegue, mantenga el encabezado Host original, y guarde SQLite en un volumen persistente privado con copias de respaldo. La limitación de frecuencia usa la dirección de conexión directa; detrás de un proxy, configure además el límite en ese proxy. Node 24 muestra un aviso de que `node:sqlite` es experimental; no es un error de compilación ni de ejecución.

Las páginas de términos resumen únicamente el alcance y uso de datos del informe. Las condiciones contractuales finales, el dominio y los perfiles sociales oficiales deben ser completados por el equipo antes del lanzamiento comercial.

## Verificación

```powershell
npm test
npx playwright install chromium
npm run test:ui
```

Las pruebas API usan una base temporal y verifican validación, persistencia tras reinicio, idempotencia, privacidad de rutas y límite de solicitudes. Las pruebas Chromium usan una base en memoria y verifican EN/ES, 320/390/768/1440 px, menú y Escape, enlaces, errores de formulario, reintento tras fallo de red, referencia, términos y texto ampliado. Axe revisa criterios automáticos WCAG A/AA en desktop y móvil; estas comprobaciones no sustituyen una auditoría manual integral con lectores de pantalla. Las capturas quedan en `test-results/`.

Documentación de la API SQLite usada: https://nodejs.org/api/sqlite.html
