const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');
const router = express.Router();
const port = 3000;
const readline = require('readline');
const { google } = require('googleapis');
const fs = require('fs');

app.use(express.static(path.join(__dirname, 'calendar_resources')));

app.use(bodyParser.urlencoded({ extended: false }))

// if there's no token.json then one will be created with the associated authentication
// until authentication is integrated using firebase it can be reset by deleting the token.json then rerunning the app

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'token.json';

function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}


function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

var eventsList = [];

// for simplicity while testing only the summary/event id is sent via ajax, to change the times do so here

var event = {
    'summary': 'preset test event',
    'start': {
        'dateTime': '2020-09-09T09:00:00-07:00',
        'timeZone': 'America/Los_Angeles',
    },
    'end': {
        'dateTime': '2020-09-10T17:00:00-07:00',
        'timeZone': 'America/Los_Angeles',
    }
};

function createEvent(auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    calendar.events.insert({
        auth: auth,
        calendarId: 'primary',
        resource: event,
    }, function (err, event) {
        if (err) {
            console.log('There was an error contacting the Calendar service: ' + err);
            return;
        }
        console.log('Event created: %s', event.htmlLink);
    });
}

// this isn't being used at the moment but is called in the same way as createEvent

function listEvents(auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const events = res.data.items;
        if (events.length) {
            console.log('Events found');
            events.map((event, i) => {
                const start = event.start.dateTime || event.start.date;
                eventsList.push(`${start} - ${event.summary}`);
            });
        } else {
            console.log('No upcoming events found.');
        }
    });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/GreekLifeTestPage.html'));
})

app.post('/newevent', (req, res) => {
    var create_event_id = req.body.new_event_id;
    event.summary = create_event_id;
    fs.readFile('credentials.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        authorize(JSON.parse(content), createEvent);
    });
    res.redirect('/');
});


fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content), listEvents);
});

app.get('/events', (req, res) => {
    res.json({'events': eventsList});
})

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
})








