import * as core from '@actions/core'
import * as github from '@actions/github'
import { DiscussionCommentEditedEvent } from '@octokit/webhooks-types'
import { marked } from 'marked'

const octokit = github.getOctokit(core.getInput('token'))

type CreateCommitState = {
  sha: string
  description: string
  state: 'error' | 'failure' | 'pending' | 'success'
}

export function parseTasksFromComment(body: string) {
  const tokenized_content = marked.lexer(body)
  return tokenized_content
    ?.filter((md_item) => md_item.type === 'list')
    ?.flatMap((list: any) => list.items)
    ?.filter((listItem) => listItem.type === 'list_item' && !!listItem.task)
    ?.map((taskItem) => ({ checked: taskItem.checked, task: taskItem.text }))
}

async function checkMergeStatus() {
  const pull_request = await octokit.rest.pulls.get({
    owner: github.context.repo.owner,
    pull_number: github.context.issue.number,
    repo: github.context.repo.repo,
  })
  const sha = pull_request.data.head.sha
  if (github.context.payload?.action === 'created') {
    return createCommitStatus({
      description: 'It cannot be merged without completing the checklist',
      sha,
      state: 'failure',
    })
  }

  const pushPayload = github.context.payload as DiscussionCommentEditedEvent

  const remaining_task = parseTasksFromComment(pushPayload.comment.body).find(
    (task) => !task?.checked,
  )

  const description = remaining_task
    ? 'It cannot be merged without completing the checklist'
    : 'Checklist items check completed'
  const state = remaining_task ? 'failure' : 'success'
  console.log({ description, state })
  return createCommitStatus({ description, sha, state })
}

async function createCommitStatus({ sha, description, state }: CreateCommitState) {
  state === 'failure' ? core.setFailed(description) : core.setOutput('description', description)
  return octokit.rest.repos.createCommitStatus({
    description,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    sha,
    state,
  })
}

export default async function run() {
  try {
    await checkMergeStatus()
  } catch (error: any) {
    core.error(error)
    core.setFailed(error)
  }
}

run()
