const Client = require("./Client");
const Channel = require('./Channel');

module.exports = class Message {

    /**
     * Message constructor
     * @param {Object} Data API Response 
     * @param {Channel} Channel Message's parent channel
     * @param {Client} Client Client
     */
    constructor(Data, Channel, Client) {

        this.client = Client;
        this.id = Data.id;

        this.content = (Data.content || '').replace(/<(\/|)(p|b)>/g, '').replace(/<br>/g, '\n');
        this.raw_content = Data.content || '';

        this.channel = Channel;
        this.author = Channel.users.find(u => u.id == Data.user_id);

        this.sticky = Data.sticky;
        this.emphasized = Data.emphasized;

        this.edited = Data.created_at !== Data.updated_at;

        this.created_at = new Date(Data.created_at);

    }

    /**
     * Reply to the message
     * @param {String} Message Message content
     */
    reply = Message => this.channel.__raw(Message, this.id);

    /**
     * Edit this message
     * @param {String} Content New message content
     * @returns {Promise} Message promise
     */
    edit = Content => new Promise(async (resolve, reject) => {

        // Get token
        let token = await this.client.__get_token('/');

        let data = {
            'message[content]': Message.Sanitize(Content),
            'message[hide_code]': 0
        }

        this.client.__raw(`messages/${this.id}.json`, this.client.__compile_object(data), { 'X-CSRF-Token': token }, true, 'PUT')

            .then(m => {

                this.client.__update_cookie(m.headers);
                m.json().then(j => {

                    if (j.error) reject(j.error);
                    else resolve(new Message(j, this.channel, this));

                })

            })

            .catch(e => { throw new Error("Error editing message:\n" + e); })

    })

    /**
     * Deletes this message
     */
    delete = async () => {

        // Get token
        let token = await this.client.__get_token('/');

        let data = {
            'message[content]': this.content,
            'message[hide_code]': 1
        }

        this.client.__raw(`messages/${this.id}.json`, this.client.__compile_object(data), { 'X-CSRF-Token': token }, true, 'PUT')

            .then(m => this.client.__update_cookie(m.headers))
            .catch(e => { throw new Error("Error deleting message:\n" + e); })

    }

    /**
     * Sanitize outgoing user messages.
     * @param {String} Message 
     * @returns Sanitized string
     */
    static Sanitize = Message => Message.replace(/^(.+)$(\n|)/gm, '<p>$1</p><br>').slice(0, -4);

}