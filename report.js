
const { google } = require('googleapis')
const config = require('./config.js')
const fs = require('fs')
const debug = require('debug')('report.js')
let markdownText = ''
const gameWeek = process.argv[2]

// console.log(`GAME WEEK: `, gameWeek)
debug(`GAME WEEK: ${gameWeek}`)
/**
 * List GameWeek results
 * @param {*} auth
 */
function listGameWeek (auth) {
    var sheets = google.sheets('v4')
    sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: config.spreadsheetId,
        range: 'Raw Results!A2:T'
    }, function (err, response) {
        if (err) {
            debug('The API returned an error: ' + err)
            return
        }
        var rows = response.data.values
        if (rows.length === 0) {
            debug('No data found.')
        } else {
            let mvp = []

            debug('|Player|Team|Time played|Result |Points |Notes|')
            debug('|---|---|---|---|---|---|')

            markdownText += '|Player|Team|Time played|Result |Points |Notes|\n'
            markdownText += '|---|---|---|---|---|---|\n'

            for (var i = 0; i < rows.length; i++) {
                var row = rows[i]
                const _gw = row[18]

                if (gameWeek && gameWeek !== _gw) {
                    continue
                }

                const gwMVP = parseInt(row[19])
                const playerName = row[0]
                const team = row[1]
                const gameResult = row[7]
                const GWPoints = gwMVP === 1 ? `**${row[16]}**` : row[16]
                const goals = parseInt(row[5])
                const assists = parseInt(row[6])
                const yellowCards = parseInt(row[13])
                const redCard = parseInt(row[14])
                const notes = row[17]

                let time = row[4]

                if (parseInt(time) === 0 && notes.startsWith('NC')) {
                    time = '-'
                }

                let computedNotes = ''

                if (goals > 0) {
                    computedNotes = `${goals} Goal${goals > 1 ? 's' : ''}`
                }

                if (assists > 0) {
                    if (computedNotes) {
                        computedNotes += ', '
                    }

                    computedNotes += `${assists} Assist${goals > 1 ? 's' : ''}`
                }

                if (yellowCards > 0) {
                    if (computedNotes) {
                        computedNotes += ', '
                    }

                    computedNotes += `${yellowCards} YC${yellowCards > 1 ? 's' : ''}`
                }

                if (redCard > 0) {
                    if (computedNotes) {
                        computedNotes += ', '
                    }

                    computedNotes += `${redCard} RC`
                }

                if (!notes.startsWith('NA') && !notes.startsWith('NC') && notes.startsWith('http')) {
                    if (computedNotes === '') {
                        computedNotes = 'link'
                    }
                    computedNotes = `[${computedNotes}](${notes})`
                } else if (computedNotes === '') {
                    computedNotes = notes
                }

                if (gwMVP === 1) {
                    mvp.push(playerName)
                }

                markdownText += `| ${playerName} | ${team} | ${time} | ${gameResult} | ${GWPoints} | ${computedNotes} |\n`
            }
            markdownText += '\n_NA: Not Available;NC: Not in squad;YC: Yellow Card,RC: Red Card_\n\n&nbsp;\n\n'
            markdownText += '\n\n# Fantasy League\n\n&nbsp;\n\n'
            markdownText += `## MVP\n${mvp.join(', ')}\n`
        }

        getStandings(auth)
    })
}

/**
 *
 * @param {*} auth
 */
function getStandings (auth) {
    var sheets = google.sheets('v4')
    sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: config.spreadsheetId,
        range: 'Resumo!A2:T25'
    }, function (err, response) {
        if (err) {
            debug('The API returned an error: ' + err)
            return
        }
        var rows = response.data.values
        if (rows.length === 0) {
            debug('No data found.')
        } else {
            console.info(`${rows.length} players`)

            let avg = []
            let tot = []

            for (var i = 0; i < rows.length; i++) {
                var row = rows[i]
                var totalPoints = isNaN(parseInt(row[14])) ? 0 : parseInt(row[14])
                var AVGPoints = isNaN(parseFloat(row[15])) ? 0 : parseFloat(row[15])

                avg.push({ player: row[0], points: AVGPoints })
                tot.push({ player: row[0], points: totalPoints })
            }

            avg.sort(sortPlayers)
            tot.sort(sortPlayers)

            markdownText += '\n\n## Rankings\n&nbsp;\n\n'
            markdownText += '|Player|Total Points|\n'
            markdownText += '|---|---|\n'

            tot.splice(0, 5).forEach(function (element) {
                markdownText += toMKD(element)
            })

            markdownText += '\n\n&nbsp;\n\n'
            markdownText += '|Player|AVG PPG|\n'
            markdownText += '|---|---|\n'

            avg.splice(0, 5).forEach(function (element) {
                markdownText += toMKD(element)
            })
        }

        writeMarkdownFile(markdownText)
    })
}

function toMKD (o) {
    return `|${o.player}|${o.points}|\n`
}

function sortPlayers (pa, pb) {
    return pb.points - pa.points
}

function writeMarkdownFile (content) {
    debug(content)

    fs.writeFile(`GameWeek${gameWeek || ''}.md`, content, (err) => {
        if (err) throw err
        debug('The file has been saved!')
    })
}

module.exports = { listGameWeek }
