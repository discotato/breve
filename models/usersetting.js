var mongoose = require('mongoose');

//Keeps track of user settings
var userSettingSchema = new mongoose.Schema({
	user: { type: String, required: false },
	name: { type: String, required: false },
	value: { type: String, required: false },
	created: { type: Date, default: Date.now },
});

module.exports = mongoose.model('UserSetting', userSettingSchema);