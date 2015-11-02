# breve
breve node.js messaging

HOW TO:
----------
- create package.json and server.js files
- package.json is required for npm to know what to install

- Packages we will use are:
	- node-restful (used for our REST API)
	- express (npm install express --save)
	- mongoose (for the mongodb)
	- body-parser (needed for express 4)
	- mocha (you can install all using: npm install --save mongoose express mocha)
	- chai (node assertion library > npm install --save chai)
	- keep node running in the background using nodemon (sudo npm install -g nodemon) g for global
		- ensure you run you server.js as nodemon server.js
	

- Get the packages
	- run npm init to create the package.json file
	- run npm install --save(grabs dependencies and downloads them to node_modules)

Coding
----------
- open server.js and set up your server code.
	- the server will require express and mongoose and other modules. These are imported using the "require" syntax
	- you will also import some file contents using the "app.use" syntax
- models are contained in the "models" folder where we will be creating the mongodb schema
- set up your tests in the tests folder.
	- run the tests using mocha tests
		> mocha tests
	- install chai, an insertion library
		- use expect(err).to.not.exist;

Database
----------
- we are using mongodb to store data.
- commect to mongo and view the breve database
	> mongo
	> show dbs
	> use breve
	> db.chats.find().pretty()
	> show collections
	
Running
----------
- finally, run your node server with node server.js
- use chrome extension called POSTMAN to test your api (chrome://apps/) in your web browser
	- set body: raw, JSON (application/json)
		- enter the following in the raw body: {"user":"joseph","message":"hi","time":"2015-07-23T21:34:28.861Z"}
	- url: http://209.135.132.117:3000/breve/chats
	- set Headers: Content-Type, Value: application/json
	- Authorization: NoAuth

GIT
----------
- create project in git and use >git clone git@github.com..
