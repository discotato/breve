var mongoose = require('mongoose');

//this a buddy list
var remoteUserSchema = new mongoose.Schema({
	user: { type: String, required: false },
	remoteUser: { type: String, required: false },
	nick: { type: String, required: false },
	created: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RemoteUser', remoteUserSchema);