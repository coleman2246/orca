import { describe, expect, it } from 'vitest'
import { mapGiteaIssue } from './issue-mappers'

describe('mapGiteaIssue', () => {
  it('maps a raw Gitea issue, filtering PRs by caller', () => {
    const info = mapGiteaIssue({
      number: 42,
      title: 'Broken widget',
      body: 'steps…',
      state: 'open',
      labels: [{ name: 'bug' }],
      assignees: [{ login: 'ada' }],
      milestone: null,
      comments: 3,
      html_url: 'https://git.example.com/o/r/issues/42',
      updated_at: '2026-09-01T00:00:00Z'
    })
    expect(info).toMatchObject({
      number: 42,
      state: 'open',
      labels: ['bug'],
      assignees: ['ada'],
      commentsCount: 3
    })
  })
})
