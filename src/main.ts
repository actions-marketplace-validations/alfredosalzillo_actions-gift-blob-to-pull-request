import * as github from '@actions/github';
import * as core from '@actions/core';
import outdent from 'outdent';
import * as blobs from './blobs';

async function run() {
  try {
    const context = github.context;
    if (!context.payload.pull_request) {
      core.setFailed('No pull request provided');
      return;
    }
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      core.setFailed('No github token provided');
      return;
    }
    const blobWidth = Number(core.getInput('blob_width'));
    const blobHeight = Number(core.getInput('blob_height'));
    const tag = core.getInput('tag');
    const tagPattern = `<!-- alfredosalzillo/actions-gift-blob-to-pull-request "${tag}" -->`
    const issueNumber = context.payload.pull_request.number;
    const octokit = github.getOctokit(githubToken);
    const haveAlreadyBeenCommented = async () => {
      for await (const { data: comments } of octokit.paginate.iterator(octokit.rest.issues.listComments, {
        ...context.repo,
        issue_number: issueNumber,
      })) {
        if (comments.some((comment) => comment?.body?.includes(tagPattern))) {
          return true
        }
      }
      return false
    }
    if (await haveAlreadyBeenCommented()) {
      core.info(`PR #${issueNumber} has already been commented`);
      return;
    }
    const pr = await octokit.rest.issues.get({
      ...context.repo,
      issue_number: issueNumber,
    })
    if (!pr.data.user) {
      core.setFailed(`PR #${issueNumber} has no user`);
      return;
    }
    const blob = blobs.createDescriptor(blobWidth, blobHeight);
    const blobDataUri = blobs.toBase64(blob);
    const opener = pr.data.user.login;
    const body = outdent`
      Thanks @${opener} for contributing opening this pull request!
      
      A special blob has been generated for you:
      [![Blob](${blobDataUri})](${blobDataUri})
    `
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: issueNumber,
      body,
    });
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();