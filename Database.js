const Datastore = require('nedb');

/************************************************
 *				DATABASE CLASS 					*
/************************************************/

const DB_PREFIX = 'db';

global.VIBRATION_PATTERN_COLLECTION = 'vibration_patterns';

module.exports = function()
{
	var db;

	constructor()
	{
	   db = new Datastore({ filename: './datastore/' + DB_PREFIX + '.js', autoload: true });
	}

	this.insert = function(collection, docs, callback)
	{
		for (var i = docs.length - 1; i >= 0; i--)
		{
			docs[i].collection = collection;
		}

		db.insert(docs, function (err, newDoc)
		{
			if(callback !== undefined)
				callback(err, newDoc);
		});
	};

	this.find = function(where, callback)
	{
		db.find(where, function (err, docs)
		{
			callback(docs);
		});
	};

	// this.remove = function (collection, id, where, callback)
	// {
	// 	if(id)
	// 		where._id = id;

	// 	db.remove(where, {}, function (err, numRemoved)
	// 	{
	// 		callback(err, numRemoved);
	// 	})
	// };
};