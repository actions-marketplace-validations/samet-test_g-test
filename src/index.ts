import * as core from '@actions/core'
import * as github from '@actions/github'
import { DiscussionCommentEditedEvent } from '@octokit/webhooks-types'
import { marked } from 'marked'

const octokit = github.getOctokit(core.getInput('token'))

type CreateCommitState = {
  sha: string
  is_failure: boolean
}

function parseTasksFromComment(body: string) {
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
    return createCommitStatus({ is_failure: true, sha })
  }

  const pushPayload = github.context.payload as DiscussionCommentEditedEvent
  const remaining_task = Boolean(
    parseTasksFromComment(pushPayload.comment.body).find((task) => !task?.checked),
  )

  return createCommitStatus({ is_failure: remaining_task, sha })
}

async function createCommitStatus({ sha, is_failure }: CreateCommitState) {
  const description = is_failure
    ? 'It cannot be merged without completing the checklist'
    : 'Checklist items check completed'
  is_failure ? core.setFailed(description) : core.setOutput('description', description)

  return octokit.rest.repos.createCommitStatus({
    description,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    sha,
    state: is_failure ? 'failure' : 'success',
  })
}

export default async function run() {
  try {
    await checkMergeStatus()
  } catch (error: any) {
    core.setFailed(error)
  }
}

run()
