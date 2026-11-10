export const IPC = {
  profilesList: 'profiles:list',
  profilesSave: 'profiles:save',
  profilesRemove: 'profiles:remove',
  profilesSaveSecret: 'profiles:save-secret',
  profilesTouch: 'profiles:touch',

  sshConnect: 'ssh:connect',
  sshWrite: 'ssh:write',
  sshResize: 'ssh:resize',
  sshDisconnect: 'ssh:disconnect',
  sshTest: 'ssh:test',
  sshEvent: 'ssh:event',

  historyList: 'history:list',
  historyAdd: 'history:add',
  historyClear: 'history:clear',

  snippetsList: 'snippets:list',
  snippetsSave: 'snippets:save',
  snippetsRemove: 'snippets:remove',

  settingsGet: 'settings:get',
  settingsSave: 'settings:save',

  knownHostsList: 'known-hosts:list',
  knownHostsTrust: 'known-hosts:trust',
  knownHostsRemove: 'known-hosts:remove',

  dialogPickKey: 'dialog:pick-key',
  dialogConfirm: 'dialog:confirm',
  dialogOpenDataDir: 'dialog:open-data-dir',

  clipboardRead: 'clipboard:read',
  clipboardWrite: 'clipboard:write',

  appInfo: 'app:info',
  appOpenExternal: 'app:open-external'
} as const
