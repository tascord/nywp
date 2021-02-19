const Client = require("./Client");
const Channel = require('./Channel');
const User = require("nywp/lib/User");

module.exports = class Message {

    /**
     * Message constructor
     * @param {Object} data API Response 
     * @param {Client} client Client
     * @param {Object} author_data Data about the message's author
     */
    constructor(data, client, author_data) {

        if(!author_data) author_data = {
            id: data.user_id
        }

        this.client = client;
        this.id = data.id;
        
        this.content = (data.content || '').replace(/<(\/|)(p|b)>/g, '').replace(/<br>/g, '\n');
        this.raw_content = data.content || '';
        
        this.channel = new Channel(data.channel_id, client);
        
        this.author = new User(author_data, this.client);

        this.sticky = data.sticky;
        this.emphasized = data.emphasized;

        this.created_at = new Date(data.created_at);

        this.reply = message => this.channel.__raw(message, this.id);

    }

}