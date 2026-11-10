# SSH Yhos

Cliente SSH de escritorio con interfaz en español, credenciales **solo locales** y sugerencias de comandos al estilo Warp. Escrito en TypeScript con Electron, React y xterm.js.

> Sin cuentas, sin nube, sin telemetría. Los perfiles, el historial y las huellas se guardan en tu equipo; los secretos se cifran con el llavero del sistema operativo.

## Características

- **Conexiones SSH** con contraseña, clave privada (OpenSSH/PEM/PuTTY) o agente SSH.
- **Credenciales cifradas** con DPAPI (Windows), Keychain (macOS) o libsecret/KWallet (Linux) mediante `safeStorage` de Electron. Si el llavero no está disponible, no se guarda ningún secreto y se pide al conectar.
- **Verificación de huellas TOFU**: la primera conexión muestra la huella `SHA256:` y la guarda; si cambia, avisa antes de enviar credenciales.
- **Sugerencias mientras escribes** a partir del historial local por servidor y de recetas integradas. El texto fantasma se acepta con `→`.
- **Paleta de comandos** con `Ctrl + Espacio` para buscar historial y recetas, insertar con `Enter` o insertar y ejecutar con `Ctrl + Enter`.
- **Pestañas** con sesiones simultáneas, reconexión y estados visibles.
- **Tema oscuro/claro/sistema**, tipografía y tamaño de terminal ajustables.
- **Portapapeles** con `Ctrl + Shift + C` / `Ctrl + Shift + V` (en macOS también `⌘ C` / `⌘ V`).

## Requisitos

- Node.js 20.19 o superior.
- Windows 10/11, macOS 11+ o una distribución Linux con entorno gráfico.

## Desarrollo

```bash
npm install
npm run dev
```

Comprobaciones:

```bash
npm run typecheck   # TypeScript estricto (main, preload y renderer)
npm run build       # typecheck + build de producción en out/
```

## Generar instaladores

```bash
npm run dist:win     # NSIS (.exe)
npm run dist:mac     # DMG (x64 y arm64)
npm run dist:linux   # AppImage y .deb
```

Los artefactos se escriben en `release/`. Los iconos (`build/icon.png`, `.ico`, `.icns`) se generan automáticamente antes de compilar con `npm run icons`, sin dependencias externas.

> Los instaladores no están firmados por defecto. Windows SmartScreen y Gatekeeper pueden mostrar advertencias; para distribución pública conviene firmar la aplicación.

## Uso rápido

1. Pulsa **Nueva conexión** (`Ctrl + Shift + N`).
2. Rellena host, puerto, usuario y método de autenticación.
3. Usa **Probar** para comprobar las credenciales y ver la huella del servidor.
4. Guarda y conecta: la primera vez se pedirá confiar en la huella.
5. Dentro de la terminal escribe al menos dos caracteres; si hay una coincidencia en tu historial aparecerá el resto en gris. Pulsa `→` para aceptarlo.
6. Pulsa `Ctrl + Espacio` para abrir la paleta completa de sugerencias.

### Atajos

| Acción | Atajo |
| --- | --- |
| Nueva conexión | `Ctrl + Shift + N` |
| Ajustes | `Ctrl + ,` |
| Cerrar pestaña | `Ctrl + Shift + W` |
| Pestaña siguiente / anterior | `Ctrl + Alt + →` / `Ctrl + Alt + ←` |
| Sugerencias dentro de la terminal | `Ctrl + Espacio` |
| Copiar / pegar | `Ctrl + C` (con selección) / `Ctrl + V` (o `Ctrl + Shift + C/V`) |
| Aumentar / reducir letra | `Ctrl + +` / `Ctrl + −` |
| Tamaño normal | `Ctrl + 0` |

En macOS los atajos equivalentes usan `⌘` cuando corresponde.

## Dónde se guardan los datos

Todo vive en la carpeta de datos de Electron (`app.getPath('userData')`), que puedes abrir desde **Ajustes → Acerca de → Abrir carpeta de datos**:

| Sistema | Ruta habitual |
| --- | --- |
| Windows | `%APPDATA%\SSH Yhos` |
| macOS | `~/Library/Application Support/SSH Yhos` |
| Linux | `~/.config/SSH Yhos` |

Archivos:

- `profiles.json` — conexiones guardadas (sin secretos).
- `secrets.json` — contraseñas y passphrases cifradas con el llavero del sistema.
- `history.json` — historial local de comandos.
- `snippets.json` — recetas propias.
- `known-hosts.json` — huellas de servidores verificadas.
- `settings.json` — preferencias de la interfaz.

Los secretos **nunca** se incluyen en los perfiles ni se envían a ningún servicio de sincronización. El proceso de renderer no recibe las contraseñas guardadas: solo el proceso principal las descifra en el momento de autenticar.

## Seguridad

- `contextIsolation` y `sandbox` activos, `nodeIntegration` desactivado, sin `webview`.
- El preload expone una API mínima y validada; el renderer no tiene acceso a Node.js.
- Los canales IPC comprueban que el remitente sea la ventana principal.
- Los enlaces externos solo se abren en el navegador si usan `http` o `https`.
- La ventana no puede navegar fuera de la aplicación.
- Las peticiones de permisos de Electron se limitan al portapapeles.

### Qué no se guarda

Para evitar capturar contraseñas escritas en prompts ocultos (`sudo`, `ssh`, `passphrase`), el historial solo registra un comando si el terminal confirma que el servidor devolvió su eco en pantalla. Los comandos que empiezan por espacio tampoco se guardan.

## Estructura del proyecto

```text
src/
  main/            Proceso principal: ventana, IPC, SSH, almacenamiento cifrado
    ssh/           Gestor de sesiones ssh2
    storage/       JSON atómico, bóveda safeStorage, perfiles, historial…
  preload/         Puente contextBridge con la API tipada
  renderer/        Interfaz React + xterm.js
    src/components Terminal, barra lateral, diálogos, ajustes…
    src/lib        Sugerencias, búsqueda difusa, temas
  shared/          Tipos, canales IPC, colores y recetas integradas
scripts/           Generador de iconos
build/             Recursos de empaquetado (iconos generados)
```

## Limitaciones conocidas

- No incluye SFTP, túneles ni reenvío de puertos.
- No hay sincronización entre dispositivos (por diseño).
- El historial se aprende de lo que escribes en la terminal; no inspecciona el shell remoto.
- Las recetas integradas son texto de referencia: revisa el comando antes de ejecutarlo.

## Licencia

MIT.
