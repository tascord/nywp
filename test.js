
// Require Module
const nywp = require('./');

// Instantiate Client
const client = new nywp.Client();

// Login Client
client.login('', '');

// Await ready
client.once('ready', () => {

    // Log
    console.log('Bot ready!');

    // Join sandbox thread
    client.fetch_channel(111458)
        .then(channel => channel.join());

})

// Await Messages
client.on('message', message => {

    // Log
    console.log('[+] ' + (message.author.username || message.author.id) + ' says: ' + message.content);

    if(message.content === 'abc')
        message.reply('def')
            .then(message => setTimeout(() => message.delete(), 10000))

});

// Await Edits
client.on('messageEdited', (previous, current) => {

    console.log(`[~] ${previous.content} >> ${current.content}`);

});