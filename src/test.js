const core = require('@actions/core')
const { marked } = require('marked')

function parseTasksFromComment(body) {
  const tokenized_content = marked.lexer(body)
  return tokenized_content
    ?.filter((md_item) => md_item.type === 'list')
    ?.flatMap((list) => list.items)
    ?.filter((listItem) => listItem.type === 'list_item' && !!listItem.task)
    ?.map((taskItem) => ({ checked: taskItem.checked, task: taskItem.text }))
}

async function checkMergeStatus() {
  const sha = 'pull_request.data.head.sha'

  const str = `\n #### Review Checklist - Review Checklist \n\n<blockquote>Review checklist description</blockquote>\n<p>\n<strong>General</strong>\n</br>\n\n- [ ] title 1 <!-- c9c5f76a-28fc-4da7-b905-178d67be65ea -->\n- [x] q1 <!-- dec4fc0e-9efc-4506-ba5f-2d113a34ec31 -->\n</p>\n\n---`
  const remaining_task = parseTasksFromComment(str).find((task) => !task?.checked)

  const description = remaining_task
    ? 'It cannot be merged without completing the checklist'
    : 'Checklist items check completed'
  const state = remaining_task ? 'failure' : 'success'
  console.log({ description, state })
  return createCommitStatus({ description, sha, state })
}

async function createCommitStatus({ sha, description, state }) {
  console.log({ state })
  state === 'failure' ? core.setFailed(description) : core.setOutput('description', description)
}

async function run() {
  try {
    await checkMergeStatus()
  } catch (error) {
    core.error()
    core.setFailed(error)
  }
}

run()
