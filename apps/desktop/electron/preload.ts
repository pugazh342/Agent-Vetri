import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'

import type { DesktopProfileRoute } from './desktop-profile'
import type { HudModifierApi, HudModifierStatus } from './hud-modifier-types'
import { customWindowControlsEnabled } from './window-controls'

// Which translucency the OS can back. Asked synchronously because the renderer
// needs it before its first paint, and answered by main because deciding it
// needs `os.release()` — a sandboxed preload may only require electron, events,
// timers and url, so importing node:os here throws before contextBridge runs
// and takes the ENTIRE bridge down with it (window.vetriDesktop undefined =>
// "Desktop IPC bridge is unavailable"). No reply means no glass, which degrades
// to an ordinary opaque window rather than a page thinned over nothing.
const translucencySupport = ipcRenderer.sendSync('vetri:translucency:support')
const hudWindowing = ipcRenderer.sendSync('vetri:hud:windowing')
const hudNativeDrag = hudWindowing?.nativeDrag === true

const launchFlags: { localModels?: boolean; assumeFreshInstall?: boolean } | undefined =
  ipcRenderer.sendSync('vetri:feature-flags')

// Local, sanitized skin payload for the first renderer theme paint. This does
// not wait on `gateway.ready`, so an unreachable remote primary cannot force
// the built-in palette over the skin configured on this machine.
const localSkin = ipcRenderer.sendSync('vetri:skin:local')

import { unwrapExpectedNotFound } from './api-expected-404'

contextBridge.exposeInMainWorld('vetriDesktop', {
  glassSupported: translucencySupport?.glass === true,
  translucencySupported: translucencySupport?.translucency === true,
  // Launch-flag fact: the app was started with --local, so the renderer may
  // show the local-models surfaces. Static for the window's lifetime.
  localModelsEnabled: launchFlags?.localModels === true,
  // Dev-only launch fact: an unpackaged app started with --fresh-install, so
  // onboarding treats this launch as a fresh install. Always false when packaged.
  assumeFreshInstall: launchFlags?.assumeFreshInstall === true,
  localSkin: localSkin && typeof localSkin === 'object' ? localSkin : null,
  getConnection: (profile, opts) => ipcRenderer.invoke('vetri:connection', profile, opts),
  // Loopback origin that hosts YouTube's player for the file:// renderer.
  getEmbedHostOrigin: () => ipcRenderer.invoke('vetri:embed-host:origin'),
  // Registry-scoped backend resolution: { connectionId, profile } → descriptor.
  getConnectionFor: payload => ipcRenderer.invoke('vetri:connection:for', payload),
  getProfileRoutes: profiles => ipcRenderer.invoke('vetri:plugin-profile-routes', profiles),
  revalidateConnection: () => ipcRenderer.invoke('vetri:connection:revalidate'),
  getGatewayWsUrl: profile => ipcRenderer.invoke('vetri:gateway:ws-url', profile),
  // Registry-scoped fresh WS URL: { connectionId, profile } → result shape of
  // getGatewayWsUrl, minted against that connection's backend.
  getGatewayWsUrlFor: payload => ipcRenderer.invoke('vetri:gateway:ws-url-for', payload),
  // Union agent roster across every registered connection.
  getAgentRoster: () => ipcRenderer.invoke('vetri:agents:roster'),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('vetri:window:openSession', sessionId, opts),
  openSessionInTerminal: (sessionId, opts) => ipcRenderer.invoke('vetri:window:openInTerminal', sessionId, opts),
  openWindow: (options?: DesktopProfileRoute) => ipcRenderer.invoke('vetri:window:openInstance', options),
  openBrowserWindow: tabId => ipcRenderer.invoke('vetri:window:openBrowser', tabId),
  windowRelay: {
    send: payload => ipcRenderer.send('vetri:window:relay', payload),
    onMessage: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('vetri:window:relay', listener)

      return () => ipcRenderer.removeListener('vetri:window:relay', listener)
    }
  },
  onBrowserPopoutClosed: callback => {
    const listener = (_event, tabId) => callback(tabId)
    ipcRenderer.on('vetri:browser-popout:closed', listener)

    return () => ipcRenderer.removeListener('vetri:browser-popout:closed', listener)
  },
  claimAmbientCue: key => ipcRenderer.invoke('vetri:ambient:claim', key),
  windowControls: {
    custom: customWindowControlsEnabled(),
    minimize: () => ipcRenderer.send('vetri:window-control', 'minimize'),
    toggleMaximize: () => ipcRenderer.send('vetri:window-control', 'toggle-maximize'),
    close: () => ipcRenderer.send('vetri:window-control', 'close')
  },
  wakeIndicator: {
    getState: () => ipcRenderer.invoke('vetri:wake-indicator:get'),
    setState: state => ipcRenderer.send('vetri:wake-indicator:set', state),
    onState: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('vetri:wake-indicator:state', listener)

      return () => ipcRenderer.removeListener('vetri:wake-indicator:state', listener)
    }
  },
  chatOnboarding: {
    size: mode => ipcRenderer.send('vetri:window:size', mode)
  },
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('vetri:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('vetri:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('vetri:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('vetri:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('vetri:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('vetri:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('vetri:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('vetri:pet-overlay:state', listener)

      return () => ipcRenderer.removeListener('vetri:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('vetri:pet-overlay:control', listener)

      return () => ipcRenderer.removeListener('vetri:pet-overlay:control', listener)
    }
  },
  // HUD mode: the chrome-free floating chat. A full app renderer (own gateway)
  // sized as a floating bar, so it mounts the real composer. Main owns the
  // window; `onChanged` keeps every window's toggle truthful.
  hud: {
    nativeDrag: hudNativeDrag,
    windowing: {
      clientPlacement: hudWindowing?.clientPlacement !== false,
      controlDrag: hudWindowing?.controlDrag === true,
      nativeDrag: hudNativeDrag,
      solid: hudWindowing?.solid === true,
      workspaceTransfer: hudWindowing?.workspaceTransfer === true
    },
    open: request => ipcRenderer.invoke('vetri:hud:open', request),
    close: () => ipcRenderer.invoke('vetri:hud:close'),
    setIgnoreMouse: ignore => ipcRenderer.send('vetri:hud:ignore-mouse', ignore),
    beginMove: () => ipcRenderer.send('vetri:hud:begin-move'),
    endMove: () => ipcRenderer.send('vetri:hud:end-move'),
    moveBy: delta => ipcRenderer.send('vetri:hud:move-by', delta),
    setWorkspaceTransfer: transferring => ipcRenderer.send('vetri:hud:workspace-transfer', transferring),
    setBounds: bounds => ipcRenderer.send('vetri:hud:set-bounds', bounds),
    resetLayout: () => ipcRenderer.invoke('vetri:hud:reset-layout'),
    // Whether the band covers the window below the bar. Main pairs it with the
    // user's translucency setting to decide the native frost (macOS vibrancy /
    // Windows 11 DWM backdrop) — see hudFrostFor.
    setFrost: showing => ipcRenderer.invoke('vetri:hud:frost', showing),
    // The HUD tells main which session it is on; main hands that back to the
    // app window when the HUD closes, so the app can re-home onto it.
    setSession: sessionId => ipcRenderer.send('vetri:hud:session', sessionId),
    onGoto: callback => {
      const listener = (_event, sessionId) => callback(sessionId)
      ipcRenderer.on('vetri:hud:goto', listener)

      return () => ipcRenderer.removeListener('vetri:hud:goto', listener)
    },
    onChanged: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('vetri:hud:changed', listener)

      return () => ipcRenderer.removeListener('vetri:hud:changed', listener)
    },
    // Linux only, and silent elsewhere: where the cursor is, in page
    // coordinates, or null when it has left the window. Stands in for the
    // mousemove that `setIgnoreMouseEvents(true, { forward: true })` delivers on
    // macOS and Windows but not here.
    onCursor: callback => {
      const listener = (_event, point) => callback(point)
      ipcRenderer.on('vetri:hud:cursor', listener)

      return () => ipcRenderer.removeListener('vetri:hud:cursor', listener)
    },
    // Main's game-overlay watch: whether a fullscreen app (a game) is under
    // the HUD, so the renderer can step back to the low-opacity overlay
    // treatment while one owns the screen.
    onGameOverlay: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('vetri:hud:game-overlay', listener)

      return () => ipcRenderer.removeListener('vetri:hud:game-overlay', listener)
    }
  },
  hudModifier: {
    getSettings: () => ipcRenderer.invoke('vetri:hud-modifier:settings:get'),
    setEnabled: enabled => ipcRenderer.invoke('vetri:hud-modifier:settings:set', enabled),
    openPermissionSettings: () => ipcRenderer.invoke('vetri:hud-modifier:permission'),
    onStatus: callback => {
      const listener = (_event: Electron.IpcRendererEvent, status: HudModifierStatus) => callback(status)
      ipcRenderer.on('vetri:hud-modifier:status', listener)

      return () => ipcRenderer.removeListener('vetri:hud-modifier:status', listener)
    }
  } satisfies HudModifierApi,
  // macOS native screenshot gesture; captures require a main-issued request.
  screenshot:
    process.platform === 'darwin'
      ? {
          getSettings: () => ipcRenderer.invoke('vetri:screenshot:settings:get'),
          setEnabled: enabled => ipcRenderer.invoke('vetri:screenshot:settings:set', enabled),
          openPermissionSettings: kind => ipcRenderer.invoke('vetri:screenshot:permission', kind),
          capture: requestId => ipcRenderer.invoke('vetri:screenshot:capture', requestId),
          onStatus: callback => {
            const listener = (_event, status) => callback(status)
            ipcRenderer.on('vetri:screenshot:status', listener)

            return () => ipcRenderer.removeListener('vetri:screenshot:status', listener)
          },
          onRequest: callback => {
            const channel = 'vetri:screenshot:request'
            const listener = (_event, requestId) => callback(requestId)

            if (ipcRenderer.listenerCount(channel) === 0) {
              ipcRenderer.send('vetri:screenshot:subscribe', true)
            }

            ipcRenderer.on(channel, listener)

            return () => {
              ipcRenderer.removeListener(channel, listener)

              if (ipcRenderer.listenerCount(channel) === 0) {
                ipcRenderer.send('vetri:screenshot:subscribe', false)
              }
            }
          }
        }
      : undefined,
  // Quick Entry: the global-hotkey mini composer window. Main owns the OS
  // shortcut + the persisted preference; the quick window only captures text
  // and hands it back, and the primary renderer submits it through the normal
  // prompt path.
  quickEntry: {
    getSettings: () => ipcRenderer.invoke('vetri:quick-entry:settings:get'),
    setSettings: patch => ipcRenderer.invoke('vetri:quick-entry:settings:set', patch),
    // Invoke returns the delivery result so the draft is not lost (#85590).
    submit: payload => ipcRenderer.invoke('vetri:quick-entry:submit', payload),
    // Main cannot invoke the primary renderer, so it receives this ack (#85590).
    ackSubmit: (correlationId, result) => ipcRenderer.send('vetri:quick-entry:ack', { correlationId, result }),
    dismiss: () => ipcRenderer.send('vetri:quick-entry:dismiss'),
    // Primary renderer → main → quick window: gateway connection state + the
    // recent-session options the target picker offers. Main caches the latest
    // payload so a freshly spawned quick window starts from truth.
    pushState: payload => ipcRenderer.send('vetri:quick-entry:state', payload),
    // Quick window subscribes to those pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('vetri:quick-entry:state', listener)

      return () => ipcRenderer.removeListener('vetri:quick-entry:state', listener)
    },
    // Main → primary renderer: a submit captured by the quick window.
    onSubmit: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('vetri:quick-entry:submit', listener)

      return () => ipcRenderer.removeListener('vetri:quick-entry:submit', listener)
    },
    // Main → quick window: you were just summoned (reset draft + refocus).
    onShown: callback => {
      const listener = () => callback()
      ipcRenderer.on('vetri:quick-entry:shown', listener)

      return () => ipcRenderer.removeListener('vetri:quick-entry:shown', listener)
    },
    // Main → quick window: the outcome of a submit whose relay already timed
    // out. Delivery is now KNOWN — reconcile the unknown state instead of
    // leaving the user to resend a prompt that may already be delivered.
    onLateResult: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('vetri:quick-entry:late-result', listener)

      return () => ipcRenderer.removeListener('vetri:quick-entry:late-result', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('vetri:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('vetri:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('vetri:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('vetri:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('vetri:connection-config:test', payload),
  // Opt-in OS-keychain encryption for stored gateway secrets (default off —
  // see secret-storage-policy.ts). get never touches the OS keychain.
  getSecretStorageEncryption: () => ipcRenderer.invoke('vetri:secret-storage:get'),
  setSecretStorageEncryption: (on: boolean) => ipcRenderer.invoke('vetri:secret-storage:set', on),
  // v2 multi-connection registry: named agent sources (local / remote / cloud / ssh).
  connections: {
    list: () => ipcRenderer.invoke('vetri:connections:list'),
    save: payload => ipcRenderer.invoke('vetri:connections:save', payload),
    remove: id => ipcRenderer.invoke('vetri:connections:remove', id),
    setPrimary: id => ipcRenderer.invoke('vetri:connections:set-primary', id),
    setLaunchMode: mode => ipcRenderer.invoke('vetri:connections:set-launch-mode', mode),
    setLastUsed: id => ipcRenderer.invoke('vetri:connections:set-last-used', id),
    test: id => ipcRenderer.invoke('vetri:connections:test', id),
    updateManaged: id => ipcRenderer.invoke('vetri:connections:update-managed', id),
    // Fan out `vetri update` to every eligible registered connection.
    // Optional excludeIds skips rows the caller updates through another path.
    updateAll: options => ipcRenderer.invoke('vetri:connections:update-all', options),
    // Registry lifecycle push (main → renderer): a connection was removed or
    // materially edited, so secondaries scoped to it must be disposed (and,
    // for edits, re-dialed at the new target).
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('vetri:connections:changed', listener)

      return () => ipcRenderer.removeListener('vetri:connections:changed', listener)
    }
  },
  sshConfigHosts: () => ipcRenderer.invoke('vetri:ssh-config:hosts'),
  sshResolveHost: host => ipcRenderer.invoke('vetri:ssh-config:resolve', host),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('vetri:connection-config:probe', remoteUrl),
  // `options` lets a registry-editor draft sign in BEFORE it is saved: the
  // main process settles the draft's connection id up front so the login
  // window writes into the per-connection cookie jar the saved entry will
  // read (not the legacy shared jar an unsaved URL would fall back to).
  oauthLoginConnectionConfig: (remoteUrl, options) =>
    ipcRenderer.invoke('vetri:connection-config:oauth-login', remoteUrl, options),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('vetri:connection-config:oauth-logout', remoteUrl),
  // Vetri Cloud: one portal login powers discovery + silent per-agent sign-in
  // (cloud-auto-discovery Phase 3).
  cloud: {
    status: () => ipcRenderer.invoke('vetri:cloud:status'),
    login: () => ipcRenderer.invoke('vetri:cloud:login'),
    logout: () => ipcRenderer.invoke('vetri:cloud:logout'),
    discover: org => ipcRenderer.invoke('vetri:cloud:discover', org),
    agentSignIn: dashboardUrl => ipcRenderer.invoke('vetri:cloud:agent-sign-in', dashboardUrl)
  },
  profile: {
    getDefault: () => ipcRenderer.invoke('vetri:profile:default:get'),
    setDefault: (route: DesktopProfileRoute) => ipcRenderer.invoke('vetri:profile:default:set', route),
    onDefaultChanged: (callback: (route: DesktopProfileRoute | null) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, route: DesktopProfileRoute | null) => callback(route)
      ipcRenderer.on('vetri:profile:default:changed', listener)

      return () => ipcRenderer.removeListener('vetri:profile:default:changed', listener)
    },
    get: () => ipcRenderer.invoke('vetri:profile:get'),
    remember: name => ipcRenderer.invoke('vetri:profile:remember', name),
    set: name => ipcRenderer.invoke('vetri:profile:set', name)
  },
  // The handler resolves an expected 404 with a sentinel instead of rejecting
  // (Electron logs a stack for every rejected invoke). Turn it back into the
  // rejection the renderer expects — see electron/api-expected-404.ts.
  api: request => ipcRenderer.invoke('vetri:api', request).then(unwrapExpectedNotFound),
  notify: payload => ipcRenderer.invoke('vetri:notify', payload),
  claimStartupLatency: () => ipcRenderer.invoke('vetri:startup-latency:claim'),
  requestMicrophoneAccess: () => ipcRenderer.invoke('vetri:requestMicrophoneAccess'),
  readWindowBelow: () => ipcRenderer.invoke('vetri:window:readBelow'),
  readFileDataUrl: filePath => ipcRenderer.invoke('vetri:readFileDataUrl', filePath),
  readFileDataUrlForAttach: filePath => ipcRenderer.invoke('vetri:readFileDataUrlForAttach', filePath),
  dataUrlReadMax: {
    get: () => ipcRenderer.invoke('vetri:data-url-read-max:get'),
    set: maxMb => ipcRenderer.invoke('vetri:data-url-read-max:set', maxMb)
  },
  readFileText: filePath => ipcRenderer.invoke('vetri:readFileText', filePath),
  readPluginSource: (filePath: string) => ipcRenderer.invoke('vetri:readPluginSource', filePath),
  selectPaths: options => ipcRenderer.invoke('vetri:selectPaths', options),
  selectSavePath: options => ipcRenderer.invoke('vetri:selectSavePath', options),
  writeClipboard: text => ipcRenderer.invoke('vetri:writeClipboard', text),
  readClipboard: () => ipcRenderer.invoke('vetri:readClipboard'),
  saveGatewayFile: payload => ipcRenderer.invoke('vetri:saveGatewayFile', payload),
  saveImageFromUrl: url => ipcRenderer.invoke('vetri:saveImageFromUrl', url),
  contextMenuEdit: command => ipcRenderer.invoke('vetri:context-menu:edit', command),
  contextMenuCopyImage: () => ipcRenderer.invoke('vetri:context-menu:copy-image'),
  contextMenuSpellcheck: action => ipcRenderer.invoke('vetri:context-menu:spellcheck', action),
  contextMenuGuestAddWord: payload => ipcRenderer.invoke('vetri:context-menu:guest-add-word', payload),
  onContextMenuSpellcheck: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('vetri:context-menu-spellcheck', listener)

    return () => ipcRenderer.removeListener('vetri:context-menu-spellcheck', listener)
  },
  saveImageBuffer: (data, ext, name) => ipcRenderer.invoke('vetri:saveImageBuffer', { data, ext, name }),
  capturePreview: payload => ipcRenderer.invoke('vetri:capturePreview', payload),
  savePastedText: text => ipcRenderer.invoke('vetri:savePastedText', { text }),
  saveClipboardImage: () => ipcRenderer.invoke('vetri:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('vetri:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('vetri:watchPreviewFile', url),
  watchDirectory: dir => ipcRenderer.invoke('vetri:watchDirectory', dir),
  stopPreviewFileWatch: id => ipcRenderer.invoke('vetri:stopPreviewFileWatch', id),
  setActiveWork: payload => ipcRenderer.send('vetri:active-work', payload),
  setTitleBarTheme: payload => ipcRenderer.send('vetri:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('vetri:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('vetri:translucency', payload),
  setKeepAwake: mode => ipcRenderer.send('vetri:keep-awake', mode),
  minimizeToTray: {
    get: () => ipcRenderer.invoke('vetri:minimize-to-tray:get'),
    set: on => ipcRenderer.invoke('vetri:minimize-to-tray:set', on),
    onChanged: callback => {
      const listener = (_event, status) => callback(status)
      ipcRenderer.on('vetri:minimize-to-tray:changed', listener)

      return () => ipcRenderer.removeListener('vetri:minimize-to-tray:changed', listener)
    }
  },
  setDisableF12: blocked => ipcRenderer.send('vetri:devtools:disable-f12', blocked),
  setF12ShortcutActive: active => ipcRenderer.send('vetri:f12ShortcutActive', Boolean(active)),
  onF12Shortcut: callback => {
    const listener = (_event, input) => callback(input)
    ipcRenderer.on('vetri:f12-shortcut', listener)

    return () => ipcRenderer.removeListener('vetri:f12-shortcut', listener)
  },
  setPreviewShortcutActive: active => ipcRenderer.send('vetri:previewShortcutActive', Boolean(active)),
  setPreviewGuestHidden: (webContentsId, hidden) =>
    ipcRenderer.send('vetri:preview-guest-hidden', { webContentsId, hidden: Boolean(hidden) }),
  openExternal: url => ipcRenderer.invoke('vetri:openExternal', url),
  freeTierChallenge: {
    // Load the account service's challenge page in a hidden window (revealed
    // only if the page asks for the human). Resolves with how it ended.
    run: request => ipcRenderer.invoke('vetri:freeTierChallenge:run', request)
  },
  mcpOauth: {
    // One-shot loopback listener for MCP OAuth against remote backends: bind
    // on this machine, hand redirectUri to mcp.servers.oauth.start, then wait
    // for the provider redirect and relay code/state via oauth.callback.
    listen: () => ipcRenderer.invoke('vetri:mcp-oauth:listen'),
    wait: (id, timeoutMs) => ipcRenderer.invoke('vetri:mcp-oauth:wait', id, timeoutMs),
    cancel: id => ipcRenderer.invoke('vetri:mcp-oauth:cancel', id)
  },
  openPreviewInBrowser: url => ipcRenderer.invoke('vetri:openPreviewInBrowser', url),
  reachPreviewUrl: url => ipcRenderer.invoke('vetri:preview:reach', url),
  setActiveConnectionRoute: route => ipcRenderer.send('vetri:connection:active-route', route),
  fetchLinkTitle: url => ipcRenderer.invoke('vetri:fetchLinkTitle', url),
  resolveFavicon: url => ipcRenderer.invoke('vetri:resolveFavicon', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('vetri:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('vetri:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('vetri:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('vetri:setting:defaultProjectDir:pick')
  },
  preparedSubmissions: {
    read: () => ipcRenderer.invoke('vetri:prepared-submissions:read'),
    update: (key, entry) => ipcRenderer.invoke('vetri:prepared-submissions:update', key, entry),
    compareAndSet: (key, expected, entry) =>
      ipcRenderer.invoke('vetri:prepared-submissions:compare-and-set', key, expected, entry)
  },
  zoom: {
    // Current zoom of this window, as { level, percent }.
    get: () => ipcRenderer.invoke('vetri:zoom:get'),
    // Synchronous zoom factor (1 = 100%). Coordinate math needs it in the
    // same tick as the event it converts, so no IPC round-trip here.
    factor: () => webFrame.getZoomFactor(),
    setPercent: percent => ipcRenderer.send('vetri:zoom:set-percent', percent),
    // Fires on every zoom change, including the Ctrl/Cmd +/-/0 shortcuts,
    // so the settings UI can stay in sync with the keyboard.
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('vetri:zoom:changed', listener)

      return () => ipcRenderer.removeListener('vetri:zoom:changed', listener)
    }
  },
  revealLogs: () => ipcRenderer.invoke('vetri:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('vetri:logs:recent'),
  // Fire-and-forget: persists a renderer error-boundary catch (with component
  // stack) to desktop.log so crashes survive the window (#79428).
  reportRendererError: report => ipcRenderer.send('vetri:logs:renderer-error', report),
  logLine: (line: string): void => ipcRenderer.send('vetri:logs:renderer-line', line),
  readDir: dirPath => ipcRenderer.invoke('vetri:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('vetri:fs:gitRoot', startPath),
  revealPath: targetPath => ipcRenderer.invoke('vetri:fs:reveal', targetPath),
  openDir: dirPath => ipcRenderer.invoke('vetri:fs:openDir', dirPath),
  desktopPluginsRoot: () => ipcRenderer.invoke('vetri:fs:desktopPluginsRoot'),
  reconcileDesktopPlugins: () => ipcRenderer.invoke('vetri:fs:reconcileDesktopPlugins'),
  logsRoot: (profile?: string) => ipcRenderer.invoke('vetri:fs:logsRoot', profile),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('vetri:fs:rename', targetPath, newName),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('vetri:fs:writeText', filePath, content),
  trashPath: targetPath => ipcRenderer.invoke('vetri:fs:trash', targetPath),
  git: {
    worktreeList: repoPath => ipcRenderer.invoke('vetri:git:worktreeList', repoPath),
    worktreeAdd: (repoPath, options) => ipcRenderer.invoke('vetri:git:worktreeAdd', repoPath, options),
    worktreeRemove: (repoPath, worktreePath, options) =>
      ipcRenderer.invoke('vetri:git:worktreeRemove', repoPath, worktreePath, options),
    branchSwitch: (repoPath, branch) => ipcRenderer.invoke('vetri:git:branchSwitch', repoPath, branch),
    branchList: repoPath => ipcRenderer.invoke('vetri:git:branchList', repoPath),
    baseBranchList: repoPath => ipcRenderer.invoke('vetri:git:baseBranchList', repoPath),
    repoStatus: repoPath => ipcRenderer.invoke('vetri:git:repoStatus', repoPath),
    fileDiff: (repoPath, filePath) => ipcRenderer.invoke('vetri:git:fileDiff', repoPath, filePath),
    scanRepos: (roots, options) => ipcRenderer.invoke('vetri:git:scanRepos', roots, options),
    review: {
      list: (repoPath, scope, baseRef) => ipcRenderer.invoke('vetri:git:review:list', repoPath, scope, baseRef),
      diff: (repoPath, filePath, scope, baseRef, staged) =>
        ipcRenderer.invoke('vetri:git:review:diff', repoPath, filePath, scope, baseRef, staged),
      stage: (repoPath, filePath) => ipcRenderer.invoke('vetri:git:review:stage', repoPath, filePath),
      unstage: (repoPath, filePath) => ipcRenderer.invoke('vetri:git:review:unstage', repoPath, filePath),
      revert: (repoPath, filePath) => ipcRenderer.invoke('vetri:git:review:revert', repoPath, filePath),
      revParse: (repoPath, ref) => ipcRenderer.invoke('vetri:git:review:revParse', repoPath, ref),
      commit: (repoPath, message, push) => ipcRenderer.invoke('vetri:git:review:commit', repoPath, message, push),
      commitContext: repoPath => ipcRenderer.invoke('vetri:git:review:commitContext', repoPath),
      push: repoPath => ipcRenderer.invoke('vetri:git:review:push', repoPath),
      shipInfo: repoPath => ipcRenderer.invoke('vetri:git:review:shipInfo', repoPath),
      prList: (repoPath, branches, numbers) =>
        ipcRenderer.invoke('vetri:git:review:prList', repoPath, branches, numbers),
      createPr: repoPath => ipcRenderer.invoke('vetri:git:review:createPr', repoPath)
    }
  },
  terminal: {
    attach: id => ipcRenderer.invoke('vetri:terminal:attach', id),
    cwd: id => ipcRenderer.invoke('vetri:terminal:cwd', id),
    dispose: id => ipcRenderer.invoke('vetri:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('vetri:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('vetri:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('vetri:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `vetri:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `vetri:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('vetri:close-preview-requested', listener)

    return () => ipcRenderer.removeListener('vetri:close-preview-requested', listener)
  },
  onPreviewNav: callback => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('vetri:preview-nav', listener)

    return () => ipcRenderer.removeListener('vetri:preview-nav', listener)
  },
  onOpenFolderRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('vetri:open-folder-requested', listener)

    return () => ipcRenderer.removeListener('vetri:open-folder-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('vetri:open-updates', listener)

    return () => ipcRenderer.removeListener('vetri:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('vetri:deep-link', listener)

    return () => ipcRenderer.removeListener('vetri:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('vetri:deep-link-ready'),
  probePluginRepo: payload => ipcRenderer.invoke('vetri:plugin:probe', payload),
  installDesktopPlugin: payload => ipcRenderer.invoke('vetri:plugin:installDesktop', payload),
  removeDesktopPlugin: payload => ipcRenderer.invoke('vetri:plugin:removeDesktop', payload),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('vetri:window-state-changed', listener)

    return () => ipcRenderer.removeListener('vetri:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('vetri:focus-session', listener)

    return () => ipcRenderer.removeListener('vetri:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('vetri:notification-action', listener)

    return () => ipcRenderer.removeListener('vetri:notification-action', listener)
  },
  onNotificationActivate: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('vetri:notification-activate', listener)

    return () => ipcRenderer.removeListener('vetri:notification-activate', listener)
  },
  onExternalOpenFailed: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('vetri:external-open-failed', listener)

    return () => ipcRenderer.removeListener('vetri:external-open-failed', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('vetri:preview-file-changed', listener)

    return () => ipcRenderer.removeListener('vetri:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('vetri:backend-exit', listener)

    return () => ipcRenderer.removeListener('vetri:backend-exit', listener)
  },
  // Soft gateway-mode apply finished tearing down the primary backend. Renderer
  // should wipe session lists + re-dial without a window reload.
  onConnectionApplied: callback => {
    const listener = () => callback()
    ipcRenderer.on('vetri:connection:applied', listener)

    return () => ipcRenderer.removeListener('vetri:connection:applied', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('vetri:power-resume', listener)

    return () => ipcRenderer.removeListener('vetri:power-resume', listener)
  },
  // AC ↔ battery transitions; renderers slow their backstop polls on battery.
  getOnBattery: () => ipcRenderer.invoke('vetri:power-battery:get'),
  onBatteryChanged: callback => {
    const listener = (_event, onBattery) => callback(Boolean(onBattery))
    ipcRenderer.on('vetri:power-battery', listener)

    return () => ipcRenderer.removeListener('vetri:power-battery', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('vetri:boot-progress', listener)

    return () => ipcRenderer.removeListener('vetri:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.ts (apps/desktop/electron/bootstrap-runner.ts).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('vetri:bootstrap:get'),
  probeLocalBackend: () => ipcRenderer.invoke('vetri:local-backend:probe'),
  continueBootstrapLocal: () => ipcRenderer.invoke('vetri:bootstrap:continue-local'),
  recycleBackend: profile => ipcRenderer.invoke('vetri:backend:recycle', profile),
  resetBootstrap: () => ipcRenderer.invoke('vetri:bootstrap:reset'),
  updateHold: {
    recheck: () => ipcRenderer.invoke('vetri:update-hold:recheck'),
    quit: () => ipcRenderer.invoke('vetri:update-hold:quit'),
    startAnyway: (request: { holdId: string; confirmed: true }) =>
      ipcRenderer.invoke('vetri:update-hold:start-anyway', request)
  },
  repairBootstrap: () => ipcRenderer.invoke('vetri:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('vetri:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('vetri:bootstrap:event', listener)

    return () => ipcRenderer.removeListener('vetri:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('vetri:version'),
  relaunchApp: () => ipcRenderer.invoke('vetri:app:relaunch'),
  getMachineProfile: () => ipcRenderer.invoke('vetri:machine:profile'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('vetri:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('vetri:uninstall:summary'),
    run: mode => ipcRenderer.invoke('vetri:uninstall:run', { mode }),
    openAppsSettings: () => ipcRenderer.invoke('vetri:uninstall:openAppsSettings')
  },
  updates: {
    check: opts => ipcRenderer.invoke('vetri:updates:check', opts),
    apply: opts => ipcRenderer.invoke('vetri:updates:apply', opts),
    setChannel: name => ipcRenderer.invoke('vetri:updates:channel:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('vetri:updates:progress', listener)

      return () => ipcRenderer.removeListener('vetri:updates:progress', listener)
    },
    takePendingRun: () => ipcRenderer.invoke('vetri:updates:metric:take'),
    ackPendingRun: sent => ipcRenderer.invoke('vetri:updates:metric:ack', sent),
    onPendingRun: callback => {
      const listener = () => callback()
      ipcRenderer.on('vetri:updates:metric:pending', listener)

      return () => ipcRenderer.removeListener('vetri:updates:metric:pending', listener)
    }
  },
  desktopMetrics: {
    setEnabled: (on, profile) => ipcRenderer.invoke('vetri:desktop-metrics:set-enabled', on, profile),
    takeRendererCrashes: () => ipcRenderer.invoke('vetri:desktop-metrics:crash:take'),
    ackRendererCrashes: sent => ipcRenderer.invoke('vetri:desktop-metrics:crash:ack', sent)
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('vetri:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('vetri:vscode-theme:search', query)
  },
  // Find-in-page (Ctrl/Cmd+F): delegates to Electron's
  // webContents.findInPage on the IPC sender's window so a Cmd+F pressed
  // in a secondary session window searches THAT window, not the primary.
  // `onFoundInPage` returns the unsubscribe fn; the renderer wires it via
  // `initFindInPageListener` in store/find-in-page.ts and tears it down
  // when the FindBar unmounts.
  findInPage: (query, options) => ipcRenderer.invoke('vetri:find-in-page', query, options),
  stopFindInPage: () => ipcRenderer.invoke('vetri:stop-find-in-page'),
  onFoundInPage: callback => {
    const listener = (_event, result) => callback(result)
    ipcRenderer.on('vetri:found-in-page', listener)

    return () => ipcRenderer.removeListener('vetri:found-in-page', listener)
  },
  // Main-process `before-input-event` forwards Ctrl/Cmd+F here so renderer
  // can open the FindBar even when the GTK compositor has already grabbed
  // the chord at the windowing layer (#81727).
  onOpenFindBarRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('vetri:open-find-bar', listener)

    return () => ipcRenderer.removeListener('vetri:open-find-bar', listener)
  }
})
