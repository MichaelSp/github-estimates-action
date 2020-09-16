const core = require('@actions/core')
// const github = require('@actions/github')
const { Octokit } = require("@octokit/rest")

try {
    const token = core.getInput('token');
    const owner = core.getInput('owner');
    const repo = core.getInput('repo');
    // THIS IS A COMMENT



    // const payload = JSON.stringify(github.context.payload, undefined, 2)
    //console.log(`The event payload: ${payload}`)

    const octokit = new Octokit({
        auth: token,
        previews: ["inertia-preview"]
    })

    octokit.paginate("GET /repos/:owner/:repo/projects", { owner, repo }).then((projects) => {
        projects.map((project) => (
            octokit.paginate(project['columns_url']).then((columns) => (
                columns.map((column) => {
                    octokit.paginate(column['cards_url']).then((cards) => (
                        Promise.all(cards.map((card) => {
                            console.log(card)
                            return octokit.issues.get({
                                owner,
                                repo,
                                issue_number: /[^/]*$/.exec(card['content_url'])[0]
                            }).then(({data: issue}) => {
                                return (issue)
                                    ? parseInt(issue.title.match(/^\[(\d+)]/)[1]) || 0
                                    : 0;
                            }).catch((e) => core.setFailed(e.message))
                        })).then((estimates) => {
                            const columnTotal = estimates.reduce((a, b) => a + b, 0)
                            const numStringRegex = /\[[0-9]+]/gi

                            let name = (column.name.search(numStringRegex) === -1)
                                ? `${column.name} [${columnTotal}]`
                                : column.name.replace(numStringRegex, `[${columnTotal}]`)

                            console.log({
                                name: name,
                                estimates: estimates,
                                column_name: column.name,
                                regex: numStringRegex,
                                points: columnTotal
                            })

                            // octokit.projects.updateColumn({
                            //     column_id: column.id, name,
                            // }).then(() => {
                            //     console.log(`updated column ${column.id}`)
                            // })
                        }).catch((e) => core.setFailed(e.message))
                    )).catch((e) => core.setFailed(e.message))
                })
            )).catch((e) => core.setFailed(e.message))
        ))
    })
} catch (error) {
    core.setFailed(error.message)
}
