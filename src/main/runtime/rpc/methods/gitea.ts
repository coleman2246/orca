import { z } from 'zod'
import { defineMethod, type RpcMethod } from '../core'
import { requiredString } from '../schemas'

const RepoIssue = z.object({
  repo: requiredString('Missing repo selector'),
  number: z.number().int().positive()
})

export const GITEA_METHODS: RpcMethod[] = [
  defineMethod({
    name: 'gitea.issue',
    params: RepoIssue,
    handler: async (params, { runtime }) => runtime.getGiteaRepoIssue(params.repo, params.number)
  })
]
