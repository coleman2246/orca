import { describe, expect, it } from 'vitest'
import { parseGiteaIssueOrPullLink } from './gitea-links'

describe('parseGiteaIssueOrPullLink', () => {
  it('parses owner/repo/issues/n on any host', () => {
    expect(parseGiteaIssueOrPullLink('https://git.example.com/acme/app/issues/7')).toMatchObject({
      owner: 'acme',
      repo: 'app',
      number: 7,
      type: 'issue'
    })
  })
  it('parses pulls/n as pr type', () => {
    expect(parseGiteaIssueOrPullLink('https://git.example.com/acme/app/pulls/9')).toMatchObject({
      number: 9,
      type: 'pr'
    })
  })
  it('rejects GitLab /-/ URLs', () => {
    expect(parseGiteaIssueOrPullLink('https://gl.example.com/a/b/-/issues/1')).toBeNull()
  })
})
