//mocha tests
var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/breve');

var Chat = require('../../models/chat');

var expect = require('chai').expect;

describe('Chat model', function(){
	
	beforeEach(function(done){
		Chat.remove(done);
	});
	
	afterEach(function(done){
		Chat.remove(done);
	});
	
	it('Should save a new chat', function(done){
		Chat.create({
			user: 'joseph',
			message: 'hi', 
			time: ''
		}, function(err, chat){
			expect(err).to.not.exist;
			expect(chat._id).to.exist;
			expect(chat.user).to.equal('joseph');
			console.log(err, chat);
			done();
		});
	});
	
	it(('Should require a message', function(done){
		Chat.create({
			user: 'joseph'
		}, function(err, chat){
			expect(err).to.exist;
			expect(String(err)).to.match(/is required/);
			//console.log(err, chat);
			done();
		});
	});
});