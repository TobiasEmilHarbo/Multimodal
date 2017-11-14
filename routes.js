module.exports = function(app)
{
	app.get('/', function(HTTPRequest, HTTPResponse)
	{
		HTTPResponse.render('index', {
			ACTION : ACTION
		});

	});
};