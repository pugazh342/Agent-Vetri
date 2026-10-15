import { describe, expect, it } from 'vitest'

import {
  normalizeVetriOpenString,
  pathFromVetriDeepLink,
  pathFromOpenDeepLink,
  resolveVetriOpenPath
} from './vetri-open-target'

describe('normalizeVetriOpenString', () => {
  it('accepts hash-router paths and strips a leading hash', () => {
    expect(normalizeVetriOpenString('/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeVetriOpenString('#/index-network/intent/1')).toBe('/index-network/intent/1')
  })

  it('maps plugin-scoped vetri:// deep links to the same path', () => {
    expect(normalizeVetriOpenString('vetri://index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeVetriOpenString('vetri://index-network/intent/1?focus=true')).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('maps vetri://open/… deep links by stripping the open host', () => {
    expect(normalizeVetriOpenString('vetri://open/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeVetriOpenString('vetri://open/settings/plugins')).toBe('/settings/plugins')
  })

  it('rejects reserved vetri kinds and unsafe paths', () => {
    expect(normalizeVetriOpenString('vetri://blueprint/morning-brief')).toBeNull()
    expect(normalizeVetriOpenString('vetri://plugin/install')).toBeNull()
    expect(normalizeVetriOpenString('https://example.com/x')).toBeNull()
    expect(normalizeVetriOpenString('/../etc/passwd')).toBeNull()
    expect(normalizeVetriOpenString('index-network')).toBeNull()
  })
})

describe('resolveVetriOpenPath', () => {
  it('merges structured path + params', () => {
    expect(resolveVetriOpenPath({ path: '/index-network/intent/1', params: { focus: 'true' } })).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('resolves href the same as a bare string', () => {
    expect(resolveVetriOpenPath({ href: 'vetri://index-network/intent/1' })).toBe('/index-network/intent/1')
  })
})

describe('pathFromVetriDeepLink', () => {
  it('builds the navigate path from a plugin-scoped deep-link payload', () => {
    expect(pathFromVetriDeepLink('index-network', 'intent/1')).toBe('/index-network/intent/1')
  })

  it('builds the navigate path from vetri://open/… payloads', () => {
    expect(pathFromOpenDeepLink('index-network/intent/1')).toBe('/index-network/intent/1')
    expect(pathFromVetriDeepLink('open', 'agent/42')).toBe('/agent/42')
  })

  it('ignores reserved kinds', () => {
    expect(pathFromVetriDeepLink('blueprint', 'morning-brief')).toBeNull()
    expect(pathFromVetriDeepLink('plugin', 'install')).toBeNull()
  })
})
