
module.exports = class User {

    /**
     * User constructor
     * @param {Channel} data API Response 
     * @param {Client} client Client
     */
    constructor(data, client) {
        
        this.client = client;
        this.id = data.id;

        this.username = data.username;
        this.role = data.role;
        this.admin = data.admin;

        this.avatar = data.avatar;

        this.partial = (this.username !== undefined && this.role !== undefined && this.admin !== undefined);

    }

}