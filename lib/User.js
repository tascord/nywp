module.exports = class User {

    /**
     * User constructor
     * @param {Channel} Data API Response 
     * @param {Client} Client Client
     */
    constructor(Data, Client) {

        this.client = Client;
        this.id = Data.id;

        this.username = Data.username;
        this.role = Data.role;
        this.admin = Data.admin;

        this.avatar = Data.avatar;

    }

}