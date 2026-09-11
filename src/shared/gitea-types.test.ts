import { describe, expect, it } from 'vitest'
import { isTaskProvider, TASK_PROVIDERS } from './task-providers'
import { normalizeGiteaSite } from './gitea-types'

describe('gitea provider registry', () => {
  it('registers gitea as a task provider', () => {
    expect(TASK_PROVIDERS).toContain('gitea')
    expect(isTaskProvider('gitea')).toBe(true)
  })

  it('normalizes a site base URL to …/api/v1', () => {
    expect(normalizeGiteaSite({ baseUrl: 'https://git.example.com/' }).baseUrl).toBe(
      'https://git.example.com/api/v1'
    )
  })
})
