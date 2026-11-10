import { app, Menu, type MenuItemConstructorOptions } from 'electron'

export type MenuAction = 'new-connection' | 'settings' | 'close-tab' | 'next-tab' | 'prev-tab'

export function setupMenu(onAction: (action: MenuAction) => void): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push({ role: 'appMenu' })
  }

  template.push({
    label: 'Archivo',
    submenu: [
      {
        label: 'Nueva conexión',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => onAction('new-connection')
      },
      {
        label: 'Cerrar pestaña',
        accelerator: 'CmdOrCtrl+Shift+W',
        click: () => onAction('close-tab')
      },
      { type: 'separator' },
      ...(isMac
        ? ([{ role: 'close' }] as MenuItemConstructorOptions[])
        : ([{ role: 'quit', label: 'Salir' }] as MenuItemConstructorOptions[]))
    ]
  })

  template.push({ role: 'editMenu', label: 'Editar' })

  template.push({
    label: 'Ver',
    submenu: [
      { label: 'Pestaña siguiente', accelerator: 'CmdOrCtrl+Alt+Right', click: () => onAction('next-tab') },
      { label: 'Pestaña anterior', accelerator: 'CmdOrCtrl+Alt+Left', click: () => onAction('prev-tab') },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Tamaño normal' },
      { role: 'zoomIn', label: 'Ampliar' },
      { role: 'zoomOut', label: 'Reducir' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Pantalla completa' },
      ...(app.isPackaged
        ? []
        : ([
            { type: 'separator' },
            { role: 'reload', label: 'Recargar' },
            { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }
          ] as MenuItemConstructorOptions[]))
    ]
  })

  template.push({ role: 'windowMenu', label: 'Ventana' })

  template.push({
    role: 'help',
    label: 'Ayuda',
    submenu: [
      {
        label: 'Acerca de SSH Yhos',
        click: () => onAction('settings')
      }
    ]
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
