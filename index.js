var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
const config = require('./config.js');

const gameWeek = process.argv[2];

console.log(`GAME WEEK: `, gameWeek)

let markdownText = "";

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {

    if (err) {
        console.log('Error loading client secret file: ' + err);
        return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Google Sheets API.
    authorize(JSON.parse(content), listGameWeek);

});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function (err, token) {
        if (err) {
            getNewToken(oauth2Client, callback);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function (code) {
        rl.close();
        oauth2Client.getToken(code, function (err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * List GameWeek results
 * @param {*} auth
 */
function listGameWeek(auth) {
    var sheets = google.sheets('v4');
    sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: config.spreadsheetId,
        range: 'Raw Results!A2:T',
    }, function (err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var rows = response.values;
        if (rows.length == 0) {
            console.log('No data found.');
        } else {

            let mvp = [];

            console.log('|Player|Team|Time played|Result |Points |Notes|');
            console.log('|---|---|---|---|---|---|');

            markdownText += '|Player|Team|Time played|Result |Points |Notes|\n';
            markdownText += '|---|---|---|---|---|---|\n';

            for (var i = 0; i < rows.length; i++) {

                var row = rows[i];
                const _gw = row[18];

                if (gameWeek && gameWeek != _gw) {
                    continue;
                }

                const gwMVP = parseInt(row[19]);
                const playerName = row[0];
                const team = row[1];
                const gameResult = row[6];
                const GWPoints = gwMVP == 1 ? `**${row[16]}**` : row[16];
                const goals = parseInt(row[5]);
                const assists = parseInt(row[10]);
                const yellowCards = parseInt(row[13]);
                const redCard = parseInt(row[14]);
                const notes = row[17];

                let time = row[4];

                if (parseInt(time) == 0 && notes.startsWith('NC')) {
                    time = '-';
                }

                let computedNotes = '';

                if (goals > 0) {
                    computedNotes = `${goals} Goal${ goals > 1 ? 's' : '' }`;
                }

                if (assists > 0) {

                    if (computedNotes) {
                        computedNotes += ', ';
                    }

                    computedNotes += `${assists} Assist${ goals > 1 ? 's' : '' }`;
                }

                if (yellowCards > 0) {

                    if (computedNotes) {
                        computedNotes += ', ';
                    }

                    computedNotes += `${yellowCards} YC${ yellowCards > 1 ? 's' : '' }`;
                }

                if (redCard > 0) {

                    if (computedNotes) {
                        computedNotes += ', ';
                    }

                    computedNotes += `${redCard} RC`;
                }

                if (!notes.startsWith('NA') && !notes.startsWith('NC') ) {

                    if (computedNotes == '') {
                        computedNotes = 'link';
                    }

                    computedNotes = `[${computedNotes}](${notes})`

                } else if (computedNotes == '') {
                    computedNotes = notes;
                }

                if (gwMVP == 1) {
                    mvp.push(playerName);
                }

                markdownText += `| ${playerName} | ${team} | ${time} | ${gameResult} | ${GWPoints} | ${computedNotes} |\n`;
            }
            markdownText += '\n_NA: Not Available;NC: Not in squad;YC: Yellow Card,RC: Red Card_\n\n&nbsp;\n\n';
            markdownText += '\n\n#Fantasy League\n\n&nbsp;\n\n';
            markdownText += `##MVP\n${mvp.join(', ')}\n`;

        }

        getStandings(auth)
    });
}

/**
 *
 * @param {*} auth
 */
function getStandings(auth) {
    var sheets = google.sheets('v4');
    sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: config.spreadsheetId,
        range: 'Resumo!A2:T25',
    }, function (err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var rows = response.values;
        if (rows.length == 0) {
            console.log('No data found.');
        } else {

            let data = [];

            console.info(`${rows.length} players`);

            let avg = [];
            let tot = [];

            for (var i = 0; i < rows.length; i++) {

                var row = rows[i];
                var dataRow = {};
                var totalPoints = isNaN(parseInt(row[14])) ? 0 : parseInt(row[14]);
                var AVGPoints =  isNaN(parseFloat(row[15])) ? 0 : parseFloat(row[15]);

                avg.push({ player: row[0], points: AVGPoints});
                tot.push({ player: row[0], points: totalPoints});

            }

            avg.sort(sortPlayers);
            tot.sort(sortPlayers);

            markdownText += '\n\n##Rankings\n&nbsp;\n\n';
            markdownText += '|Player|Total Points|\n';
            markdownText += '|---|---|\n';

            tot.splice(0,5).forEach(function(element) {

                markdownText += toMKD(element);
            });


            markdownText += '\n\n&nbsp;\n\n';
            markdownText += '|Player|AVG PPG|\n';
            markdownText += '|---|---|\n';

            avg.splice(0,5).forEach(function(element) {

                markdownText += toMKD(element);
            });

        }


        writeMarkdownFile(markdownText)
    });
}



function toMKD(o) {
    return `|${o.player}|${o.points}|\n`;
}

function sortPlayers(pa, pb) {
    return pb.points - pa.points;
}

function writeMarkdownFile(content) {

    console.log(content);

    fs.writeFile(`GameWeek${gameWeek || ''}.md`, content, (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
    });
}