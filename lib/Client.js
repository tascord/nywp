const $ = require('node-fetch');
const base_headers = require('../Headers.json');

const Message = require('./Message');
const Channel = require('./Channel');
const User = require('./User');

module.exports = class Client extends require('events') {

    /**
     * Client Constructor
     */
    constructor() {

        super();
        this.cookie = base_headers['Cookie'];
        this.joined_channels = [];

        setInterval(this.__poll_channels, 5000);

    }

    /**
     * Compile an object into a URL-encoded Key-value string
     * @param {Object} Data Object
     * @returns {String} Compiled string
     */
    __compile_object = (Data) => {

        let string = '';

        for (let key of Object.keys(Data)) {
            string += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(Data[key]);
        }

        string = string.slice(1);
        return string;

    };

    /**
     * Raw method for sending a request to ywp
     * @param {String} Endpoint API endpoint
     * @param {String|null} Data Data to send (must be compiled string)
     * @param {Object} Headers Acompanying default headers, overwritting any with same name
     * @param {Boolean} Raw Whether to return the raw node-fetch response, or whether to return response.json() 
     * @param {String} Method The HTTP method for sending the request
     * @param {Boolean} Exempt_cookie Whether to remove cookies from the headers
     */
    __raw = (Endpoint, Data, Headers = {}, Raw = false, Method = 'POST', Exempt_cookie = false) => new Promise((resolve, reject) => {

        if (!Headers['Cookie']) Headers['Cookie'] = this.cookie;
        if (Data) Headers['Content-Length'] = Data.length;

        for (let key of Object.keys(base_headers)) {
            if (!Headers[key]) Headers[key] = base_headers[key];
        }

        if (Exempt_cookie) delete Headers['Cookie'];

        // console.log(`[~] Requesting from 'https://ywp.nanowrimo.org/${path}'`, headers)

        $('https://ywp.nanowrimo.org/' + Endpoint, {
            method: Method,
            body: Method != 'GET' ? Data : undefined,
            headers: Headers
        })
            .then(res => {

                this.__update_cookie(res.headers);

                if (Raw) resolve(res);
                else res.json().then(resolve);

            })

            .catch(reject);

    });

    /**
     * Converts cookie string to object
     * @param {String} Cookie Cookie string 
     * @returns {Object} JSON cookie object
     */
    __parse_cookie = (Cookie) => {

        let cookie_obj = {};

        let name = '';
        let value = '';
        let in_name = false;
        let in_value = false;
        let index = 0;

        for (let char of Cookie) {

            index++;

            if (char == '_' && !in_value && !in_name) in_name = true;

            if (char == '=' && !in_value) {
                in_value = true;
                in_name = false;
                continue;
            }

            if (char == ';') {
                in_name = false;
                in_value = false;

                if (name) cookie_obj[name] = value;

                name = '';
                value = '';

                continue;
            }

            if (index == Cookie.length) {

                cookie_obj[name] = value + Cookie[Cookie.length - 1];

            }

            if (in_name) name += char;
            if (in_value) value += char;

        }

        return cookie_obj;

    }

    /**
     * Compiles cookie object to string
     * @param {Object} Cookie Cookie object
     * @returns {String} Compiled cookie string
     */
    __stringify_cookie_object = (Cookie) => {

        let string = '';
        for (let key of Object.keys(Cookie)) {
            string += `${key}=${Cookie[key]}; `
        }

        return string;

    }

    /**
     * Handles Set-Cookie header from responses
     * @param {Object} Headers Raw response headers
     */
    __update_cookie = (Headers) => {

        let current = this.__parse_cookie(this.cookie);
        let update = this.__parse_cookie(Headers.get('set-cookie') || '');

        current['_ywp_session'] = update['_ywp_session'] || current['_ywp_session'];
        this.cookie = this.__stringify_cookie_object(current);

    }

    /**
     * Get CSRF token for X-CSRF requests
     * @param {String} Endpoint Optional specific endpoint
     * @returns {Promise} Token promise
     */
    __get_token = (Endpoint = '/') => new Promise(async (resolve, reject) => {

        let home = await this.__raw(Endpoint, null, {}, true, 'GET');
        let text = await home.text()
        let token = /<meta name="csrf-token" content="(.+)" \/>/.exec(text)[1];

        if (!token) throw new Error("Unable to find CSRF-TOKEN during login.");
        resolve(token);

    });

    /**
     * Poll watched channels for new messages
     */
    __poll_channels = () => {

        let index = 0;
        const try_channel = async () => {

            let channel = this.joined_channels[index++];
            if (!channel) return;

            // Get 'current' channel
            let _channel = await this.fetch_channel(channel.id).catch(console.log);

            // Update channel participants
            for (let user of _channel.users) {

                // Append all new to old channel
                if (!channel.users.find(u => u.id == user.id)) channel.users.push(user);

            }

            // Messages
            for (let message of _channel.messages) {

                // Handled edited messages
                if(message.edited) {

                    let previous = null;
                    channel.messages.forEach((m, i) => {
                        
                        if(m.id === message.id) {
                            previous = m;
                            channel.messages[i] = message;
                        }

                    });

                    if(previous === null) channel.messages.push(message);
                    else this.emit('messageEdited', previous, message);

                    continue;

                }

                // Append all new messages to old channel
                channel.messages.push(message);

                // Override temporary channel
                message.channel = channel;

                // Emit event
                this.emit('message', message);

            }

            setTimeout(try_channel, 1000);

        }

        try_channel();

    }

    /**
     * Client login method
     * @param {String} Username Account username
     * @param {String} Password Account password
     */
    login = async (Username, Password) => {

        let data = {
            'utf8': '✓',
            'user[login]': Username,
            'user[password]': Password,
            'commit': 'Sign in'
        }

        let token = await this.__get_token('/')

        this.__raw('users/sign_in.json', this.__compile_object(data), { 'X-CSRF-Token': token }, true)

            .then(m => {

                m.json().then((json) => {

                    if (json.error) throw new Error("Error Logging In: " + json.error);

                    this.user = new User(json, this);
                    this.emit('ready');

                })

            })

            .catch(e => {
                throw new Error("Unable to log in. Check your connection.\n" + e);
            })

    }

    /**
     * Requests channel by ID from YWP
     * @param {Number} ID Channel ID
     * @returns {Promise} Channel promise
     */
    fetch_channel = ID => new Promise((resolve, reject) => {

        this.__raw(`messages.json?type=channel&channel_id=${ID}&all=0`, null, {}, false, 'GET')

            .then(json => {

                if (json.error) reject(json.error);
                else {

                    let channel = new Channel(ID, this);

                    channel.users = json.users.map(u => new User(u, this));
                    channel.messages = json.messages.map(m => new Message(m, channel, this));

                    resolve(channel);

                }

            })

            .catch(reject)

    });

}