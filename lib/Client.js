const $ = require('node-fetch');
const base_headers = require('../Headers.json');

const Message = require('./Message');
const Channel = require('./Channel');
const User = require('nywp/lib/User');
const chalk = require('chalk');

module.exports = class Client extends require('events') {

    constructor() {

        super();
        this.cookie = base_headers['Cookie'];
        this.joined_channels = [];

        setInterval(this.__poll_channels, 5000);

    }

    __compile_object = (data) => {

        let string = '';

        for (let key of Object.keys(data)) {
            string += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
        }

        string = string.slice(1);
        return string;

    };

    __raw = (path, data, headers = {}, raw = false, method = 'POST', exempt_cookie = false) => new Promise((resolve, reject) => {

        if (!headers['Cookie']) headers['Cookie'] = this.cookie;
        if (data) headers['Content-Length'] = data.length;

        for (let key of Object.keys(base_headers)) {
            if (!headers[key]) headers[key] = base_headers[key];
        }

        if (exempt_cookie) delete headers['Cookie'];

        // console.log(`[~] Requesting from 'https://ywp.nanowrimo.org/${path}'`, headers)

        $('https://ywp.nanowrimo.org/' + path, {
            method,
            body: method != 'GET' ? data : undefined,
            headers
        })
            .then(res => {

                this.__update_cookie(res.headers);

                if (raw) resolve(res);
                else res.json().then(resolve);

            })

            .catch(reject);

    });

    __parse_cookie = (cookie) => {

        let cookie_obj = {};

        let name = '';
        let value = '';
        let in_name = false;
        let in_value = false;
        let index = 0;

        for (let char of cookie) {

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

            if (index == cookie.length) {

                cookie_obj[name] = value + cookie[cookie.length - 1];

            }

            if (in_name) name += char;
            if (in_value) value += char;

        }

        return cookie_obj;

    }

    __stringify_cookie_object = (cookie) => {

        let string = '';
        for (let key of Object.keys(cookie)) {
            string += `${key}=${cookie[key]}; `
        }

        return string;

    }

    __update_cookie = (headers) => {

        let current = this.__parse_cookie(this.cookie);
        let update = this.__parse_cookie(headers.get('set-cookie') || '');

        current['_ywp_session'] = update['_ywp_session'] || current['_ywp_session'];
        this.cookie = this.__stringify_cookie_object(current);

    }

    __get_token = path => new Promise(async (resolve, reject) => {

        let home = await this.__raw(path, null, {}, true, 'GET');
        let text = await home.text()
        let token = /<meta name="csrf-token" content="(.+)" \/>/.exec(text)[1];

        if (!token) throw new Error("Unable to find CSRF-TOKEN during login.");
        resolve(token);

    });

    __poll_channels = () => {

        let index = 0;
        const try_channel = async () => {

            let channel = this.joined_channels[index++];
            if (!channel) return;

            let _channel = await this.fetch_channel(channel.id).catch();

            // Messages
            for (let message of _channel.messages) {

                // Add message to main channel's message cache
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

    login = async (username, password) => {

        let data = {
            'utf8': '✓',
            'user[login]': username,
            'user[password]': password,
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

    fetch_channel = id => new Promise((resolve, reject) => {

        this.__raw(`messages.json?type=channel&channel_id=${id}&all=0`, null, {}, false, 'GET')

            .then(json => {

                if (json.error) reject(json.error);
                else {

                    let channel = new Channel(id, this);
                    channel.messages = json.messages.map(m => new Message(m, this, json.users.find(u => u.id == m.user_id) || {id: m.user_id}));

                    resolve(channel);

                }

            })

            .catch(reject)

    });

    fetch_group = (count = 25, id = 2125) => new Promise(async (resolve, reject) => {

        return reject("Fetch_Group function currently malfunctional.");

        let token = await this.__get_token('/');

        this.__raw(`channels.json?type=group&id=${id}&count=${count}`, null, { 'X-CSRF-Token': token }, true, 'GET', true)
            .then(json => {

                if (json.error) reject(json.error);
                else {

                    let data = json.map(c => {

                        return {
                            id: c.id,
                            name: c.name,
                            post_count: c.num_posts,
                            updated_at: c.updated_at,
                            channel: new Channel(c.id, this)
                        }

                    })

                    resolve(data);

                }

            })

            .catch(reject)

    });
}