'use strict';

const restify = require('restify');
const builder = require('botbuilder');
const request = require('request');

// ============================================================================
// Bot Setup
// ============================================================================

// Setup Restify Server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978,
    () => console.log('%s listening to %s', server.name, server.url)
);

// Create chat bot
const connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
const bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=============================================================================
// Bots Middleware
//=============================================================================

// Anytime the major version is incremented any existing conversations will be restarted.
bot.use(builder.Middleware.dialogVersion({ version: 1.0, resetCommand: /^reset/i }));

//=============================================================================
// Google Maps Geocoding API
//=============================================================================

const baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=';

// ============================================================================
// Bot Dialogs
// ============================================================================

// Welcome Dialog
bot.dialog('/', [
    (session) => {
        // Send a card
        let card = new builder.HeroCard(session)
            .title(`Hi ${session.message.user.name}, I am Coconut`)
            .text('Your friendly neighbourhood food hunting bot')
            .images([
                builder.CardImage.create(session, 'https://s21.postimg.org/i8h4uu0if/logo_cropped.png')
            ]);
        let msg = new builder.Message(session).attachments([card]);
        session.send(msg);
        session.beginDialog('getLocation:/', {shareText: 'If you would like me to recommend something nearby, please send me your location.'});
    },
    (session, results) => {
        if (typeof results.response === 'undefined') {
            console.log('Failure: Invalid Location');
            session.endConversation('You entered an invalid location. Let\'s start over.');
        };
        console.log('Success: Received User Location');

        // Persist user location
        session.userData.location = results.response;

        // Reverse geocoding
        let url = `${baseUrl}${session.userData.location.latitude},${session.userData.location.longitude}&key=${process.env.GOOGLE_GEOCODE_KEY}`;
        request(url, (err, res, body) => {
            if (!err && res.statusCode === 200) {
                console.log('Success: Location reverse geocoded');
                let userAddress = JSON.parse(body).results[0].formatted_address;
                session.send(`Finding places near ${userAddress}...`);
            } else {
                console.log(err);
            }
        });
        // Pass user location as args to nearbyRestaurants dialog
        setTimeout(() => session.beginDialog('nearbyRestaurants:/', session.userData.location), 1000);
    },
    (session) => {
        setTimeout(() => builder.Prompts.choice(session, 'What would you like to do next?', ['More Results', 'Bye']), 5000);
    },
    (session, results) => {
        if (results.response.entity === 'More Results') {
            console.log('Ending conversation...');
            session.endConversation('WIP. Ending conversation...');
        };
        if (results.response.entity === 'Bye') {
            console.log('Ending conversation...');
            session.endConversation('Have a good day (:');
        };
    }
]);

// Sub-Dialogs
bot.library(require('./dialogs/getLocation'));
bot.library(require('./dialogs/nearbyRestaurants'));
//bot.library(require('./dialogs/getIntent')); TODO: handle free form queries
