const core = require('@actions/core')
// const github = require('@actions/github')
const {Octokit} = require("@octokit/rest")
const {graphql} = require("@octokit/graphql")

const QUERY = `
        query($owner:String! $repo:String!) { 
            repository(owner:$owner, name:$repo) { 
                projects(first:100 states:OPEN) { totalCount, 
                    pageInfo { hasNextPage endCursor } 
                    nodes { columns(first:40) { totalCount 
                        nodes { databaseId name cards(first:100 archivedStates:NOT_ARCHIVED) { totalCount 
                            nodes { content { __typename ... on Issue{ title } ... on PullRequest{ title }
        }}}}}}}}}`


// const payload = JSON.stringify(github.context.payload, undefined, 2)
//console.log(`The event payload: ${payload}`)

new Promise(async (resolve,reject) => {

    try {
        const token = core.getInput('token')
        const owner = core.getInput('owner')
        const repo = core.getInput('repo')

        const octokit = new Octokit({
            auth: token,
            previews: ["inertia-preview"]
        })

        const response = await graphql({
            query: QUERY,
            owner: owner,
            repo: repo,
            headers: {
                authorization: `token ${token}`
            }
        })

        for (const project of response.repository.projects.nodes) {
            for (const column of project.columns.nodes) {
                let {databaseId: column_id, name, cards: {nodes: cards}} = column
                let sum = cards.map((card) => {
                    let title = card.content ? card.content.title : false
                    let estimate = title ? card.content.title.match(/^\[(\d+)]/) : false
                    return estimate ? parseInt(estimate[1]) || 0 : 0
                }).reduce((a, b) => a + b, 0)

                console.log(name, sum)
                const regex = /\[[0-9]+]/gi
                name = (name.search(regex) === -1)
                    ? `${name} [${sum}]`
                    : name.replace(regex, `[${sum}]`)

                octokit.projects.updateColumn({column_id, name}).catch(reject)
            }
        }

        resolve()
    } catch (e) {
        reject(e)
    }
}).catch((err) => {
    core.setFailed(err.message)
})
