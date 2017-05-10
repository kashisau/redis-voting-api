var express = require('express');
var router = express.Router();
var redis = require('redis');
var availableCountries = ['italy', 'spain'];
var client = redis.createClient();

client.on("error", function(err) {
  console.log("Error ", err);
  return;
});

/* GET total votes. */
router.get('/total', function(req, res, next) {
  var success = false,
    country = req.query['country'],
    posVotesTotal = 1,
    negVotesTotal = 2,
    multi;

  if (country === undefined) {
    res.status(400);
    res.json({success: success, error: "Country not specified"});
    return;
  }
  if (availableCountries.indexOf(country.toLowerCase()) === -1) {
    res.status(400);
    res.json({success: success, error: "Country not listed"});
    return;
  }

  multi = client.multi();

  multi.get(country + "_pos");
  multi.get(country + "_neg");

  multi.exec(function(err, replies) {
    if (err) throw err;
    var posVotesTotal = replies[0],
      negVotesTotal = replies[1];

    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');

    res.json(
      {
        country: country,
        percent: posVotesTotal / (posVotesTotal + negVotesTotal)
      }
    );
  });
});

router.post('/cast', function(req, res, next) {
  var success = false,
    data = req.body,
    country = data.country,
    votesPos = +data.positive,
    votesNeg = +data.negative,
    multi;

  if (availableCountries.indexOf(country.toLowerCase()) === -1) {
    res.status(400);
    res.json({success: success, error: "Country not listed"});
    return;
  }

  multi = client.multi();

  multi.incrby(country + "_pos", votesPos);
  multi.incrby(country + "_neg", votesNeg);

  multi.exec(function(err, replies) {
    if (err) throw err;
    var posVotesTotal = replies[0],
      negVotesTotal = replies[1];

    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');

    res.json(
      {
        country: country,
        percent: posVotesTotal / (posVotesTotal + negVotesTotal)
      }
    );
  });
});

module.exports = router;
