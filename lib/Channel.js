const Client = require("./Client");

module.exports = class Channel {

    /**
     * Channel constructor
     * @param {Number} id Channel ID
     * @param {Client} client Client 
     */
    constructor(id, client) {

        this.id = id;
        this.client = client;
        this.messages = [];

    }

    __raw = (message, reply_to = 0) => new Promise(async (resolve, reject) => {

        // Get token
        let token = await this.client.__get_token('forums/first-timers/sandbox');

        let data = {
            'message[channel_id]': this.id,
            'message[sendee_id]': 0,
            'message[content]': message.replace(/^(.+)$(\n|)/gm, '<p>$1</p><br>').slice(0, -4),
            'message[reply_to]': reply_to,
        }

        this.client.__raw('messages.json', this.client.__compile_object(data), {'X-CSRF-Token': token}, true, 'POST')

            .then(m => {

                this.client.__update_cookie(m.headers);
                m.json().then(j => resolve(new (require('./Message'))(j, this.client)));

            })

            .catch(e => { throw new Error("Error sending message: " + e.error); });

    });

    send = message => this.__raw(message);

    join = () => {

        if(this.client.joined_channels.indexOf(this) > -1) throw new Error('Already joined channel');
        else this.client.joined_channels.push(this);

    }

}