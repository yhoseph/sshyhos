import type { Snippet } from './types'

const builtin = (
  id: string,
  name: string,
  command: string,
  description: string
): Snippet => ({
  id: `builtin:${id}`,
  name,
  command,
  description,
  builtin: true,
  createdAt: 0
})

/**
 * Recetas de comandos que se ofrecen junto al historial local.
 * Son solo texto: nada se ejecuta automáticamente.
 */
export const BUILTIN_SNIPPETS: Snippet[] = [
  // Archivos y discos
  builtin('ls', 'Listar archivos', 'ls -lah --color=auto', 'Listado detallado con tamaños legibles'),
  builtin('disk-usage', 'Uso de disco', 'df -h', 'Espacio libre por sistema de archivos'),
  builtin('top-dirs', 'Carpetas más pesadas', 'du -sh * 2>/dev/null | sort -rh | head -20', 'Encuentra qué ocupa espacio'),
  builtin('big-files', 'Archivos grandes', 'find . -type f -size +100M -exec ls -lh {} \\; 2>/dev/null', 'Archivos de más de 100 MB'),
  builtin('tree', 'Árbol de carpetas', 'find . -maxdepth 2 -type d | sort | head -80', 'Vista rápida de la estructura'),
  builtin('tail-log', 'Seguir un log', 'tail -f /var/log/syslog', 'Cambia la ruta según tu sistema'),
  builtin('grep-recursive', 'Buscar texto en archivos', 'grep -RIn --exclude-dir=.git --exclude-dir=node_modules "texto" .', 'Búsqueda recursiva con número de línea'),
  builtin('tar-backup', 'Comprimir carpeta', 'tar -czf backup-$(date +%F-%H%M).tar.gz carpeta/', 'Crea un .tar.gz con fecha'),

  // Procesos y memoria
  builtin('ps-mem', 'Procesos por memoria', 'ps aux --sort=-%mem | head -15', 'Los 15 procesos que más RAM usan'),
  builtin('ps-cpu', 'Procesos por CPU', 'ps aux --sort=-%cpu | head -15', 'Los 15 procesos que más CPU usan'),
  builtin('free', 'Memoria disponible', 'free -h', 'RAM y swap en formato legible'),
  builtin('uptime', 'Carga del sistema', 'uptime', 'Tiempo encendido y load average'),
  builtin('who', 'Usuarios conectados', 'w', 'Sesiones activas y qué ejecutan'),

  // Red
  builtin('ports', 'Puertos escuchando', 'ss -tulpn', 'Servicios y puertos abiertos'),
  builtin('ip', 'Interfaces de red', 'ip -br address', 'Direcciones IP de cada interfaz'),
  builtin('ping', 'Probar conectividad', 'ping -c 4 1.1.1.1', 'Cuatro paquetes ICMP'),
  builtin('curl-head', 'Comprobar un sitio', 'curl -sSI https://example.com | head -20', 'Cabeceras HTTP de la URL'),
  builtin('dns', 'Consultar DNS', 'dig +short example.com', 'Resolución DNS rápida'),
  builtin('trace', 'Ruta de red', 'traceroute -n example.com', 'Saltos hasta el destino'),

  // systemd
  builtin('systemctl-status', 'Estado de un servicio', 'systemctl status --no-pager servicio', 'Reemplaza "servicio"'),
  builtin('systemctl-restart', 'Reiniciar un servicio', 'sudo systemctl restart servicio', 'Requiere sudo'),
  builtin('systemctl-list', 'Servicios fallando', 'systemctl --failed --no-pager', 'Unidades en estado failed'),
  builtin('journal', 'Logs de un servicio', 'journalctl -u servicio -n 200 --no-pager', 'Últimas 200 líneas'),
  builtin('journal-follow', 'Seguir logs de un servicio', 'journalctl -u servicio -f --no-pager', 'En vivo con Ctrl+C para salir'),

  // Docker
  builtin('docker-ps', 'Contenedores activos', 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"', 'Tabla compacta'),
  builtin('docker-all', 'Todos los contenedores', 'docker ps -a', 'Incluye detenidos'),
  builtin('docker-logs', 'Logs de un contenedor', 'docker logs -f --tail 200 contenedor', 'Cambia "contenedor"'),
  builtin('docker-stats', 'Consumo de contenedores', 'docker stats --no-stream', 'CPU, RAM y red'),
  builtin('compose-ps', 'Estado de Compose', 'docker compose ps', 'Servicios del proyecto actual'),
  builtin('compose-up', 'Levantar Compose', 'docker compose up -d --build', 'Reconstruye y levanta en segundo plano'),
  builtin('docker-clean', 'Limpiar Docker', 'docker system df && docker system prune', 'Revisa y elimina recursos sin usar'),

  // Git
  builtin('git-status', 'Estado de Git', 'git status -sb', 'Rama actual y cambios'),
  builtin('git-log', 'Historial Git', 'git log --oneline --graph --decorate -20', 'Últimos 20 commits'),
  builtin('git-pull', 'Actualizar con rebase', 'git pull --rebase --autostash', 'Conserva cambios locales'),
  builtin('git-diff', 'Resumen de cambios', 'git diff --stat', 'Archivos modificados'),
  builtin('git-branches', 'Ramas recientes', 'git branch -vv --sort=-committerdate | head -15', 'Ramas y su seguimiento'),

  // Paquetes
  builtin('apt-update', 'Actualizar Debian/Ubuntu', 'sudo apt update && sudo apt upgrade -y', 'Aplica actualizaciones'),
  builtin('dnf-update', 'Actualizar Fedora/RHEL', 'sudo dnf upgrade -y', 'Aplica actualizaciones'),
  builtin('reboot-required', '¿Hace falta reiniciar?', '[ -f /var/run/reboot-required ] && cat /var/run/reboot-required || echo "No hace falta reiniciar"', 'Comprueba Debian/Ubuntu'),

  // SSH y seguridad
  builtin('ssh-keygen', 'Crear clave ed25519', 'ssh-keygen -t ed25519 -C "tu@correo.com"', 'Clave moderna y rápida'),
  builtin('ssh-copy-id', 'Copiar clave al servidor', 'ssh-copy-id usuario@host', 'Instala tu clave pública'),
  builtin('scp', 'Copiar archivo por SSH', 'scp archivo.txt usuario@host:/ruta/', 'Sube un archivo'),
  builtin('ufw', 'Estado del cortafuegos', 'sudo ufw status verbose', 'Reglas de UFW'),
  builtin('auth-log', 'Intentos de acceso', 'sudo tail -n 100 /var/log/auth.log', 'Revisa logins recientes'),
  builtin('last', 'Últimos accesos', 'last -n 20', 'Inicios de sesión recientes')
]
