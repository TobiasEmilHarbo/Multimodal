const Database = require('./Database');
const DB = new Database();

module.exports = function(app)
{
	app.get('/', function(HTTPRequest, HTTPResponse)
	{
		HTTPResponse.render('index', {
			ACTION : ACTION
		});
	});

	app.get('/analysis', function(HTTPRequest, HTTPResponse)
	{
		DB.find({
			collection : VIBRATION_PATTERN_COLLECTION
		}, function(patterns)
		{
			HTTPResponse.render('analysis', {
				patterns : patterns
			});
		});
	});
};