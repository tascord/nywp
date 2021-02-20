const Message = require("./Message");
const Client = require("./Client");
module.exports = class Channel {

    /**
     * Channel constructor
     * @param {Number} ID Channel ID
     * @param {Client} Client Client 
     */
    constructor(ID, Client) {

        this.id = ID;
        this.client = Client;
        this.messages = [];
        this.users = [];

    }

    /**
     * Raw method for sending message requests
     * @param {String} Content Message content
     * @param {Number} Reply_ID Message ID to reply to (Zero is no reply) 
     * @returns {Promise} Message promise
     */
    __raw = (Content, Reply_ID = 0) => new Promise(async (resolve, reject) => {

        // Get token
        let token = await this.client.__get_token('forums/first-timers/sandbox');

        let data = {
            'message[channel_id]': this.id,
            'message[sendee_id]': 0,
            'message[content]': Content.replace(/^(.+)$(\n|)/gm, '<p>$1</p><br>').slice(0, -4),
            'message[reply_to]': Reply_ID,
        }

        this.client.__raw('messages.json', this.client.__compile_object(data), { 'X-CSRF-Token': token }, true, 'POST')

            .then(m => {

                this.client.__update_cookie(m.headers);
                m.json().then(j => {

                    if (j.error) reject(j.error);
                    else resolve(new (require('./Message'))(j, this, this.client));

                });

            })

            .catch(e => { throw new Error("Error sending message:\n" + e.error); });

    });

    /**
     * Send a message to the channel
     * @param {String} Content Message content
     */
    send = Content => this.__raw(Content);

    /**
     * Join (or 'watch') the channel
     */
    join = () => {

        if (this.client.joined_channels.indexOf(this) > -1) throw new Error('Already joined channel');
        else this.client.joined_channels.push(this);

    }

}