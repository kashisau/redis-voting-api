var express = require('express');
var router = express.Router();
var redis = require('redis');
var availableCountries = ['italy', 'spain'];

/* GET total votes. */
router.get('/total', function(req, res, next) {
  var success = false,
    country = req.param('country'),
    posVotesTotal = 1,
    negVotesTotal = 2;

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

  var client = redis.createClient();
  client.get(country + "_pos", function(err, posVotes) {
    if (err) throw err;
    posVotesTotal = +posVotes;
    client.get(country + "_neg", function(err, negVotes) {
      if (err) throw err;
      negVotesTotal = +negVotes;

      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.header('Expires', '-1');
      res.header('Pragma', 'no-cache');

      res.json(
        {
          country: country,
          percent: posVotesTotal / (posVotesTotal + negVotesTotal)
        }
      );
      client.quit();
    });
  });
});

router.post('/cast', function(req, res, next) {
  var success = false,
    data = req.body,
    country = data.country,
    votesPos = +data.positive,
    votesNeg = +data.negative;

  if (availableCountries.indexOf(country.toLowerCase()) === -1) {
    res.status(400);
    res.json({success: success, error: "Country not listed"});
    return;
  }

  var client = redis.createClient();
  client.on("error", function(err) {
    console.log("Error ", err);
    client.quit();
    return;
  })
  client.incrby(country + "_pos", votesPos, function(err, posVotes) {
    if (err) throw err;
    client.incrby(country + "_neg", votesNeg, function(err, negVotes) {
      if (err) throw err;

      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.header('Expires', '-1');
      res.header('Pragma', 'no-cache');

      res.json(
        {
          country: country,
          percent: posVotes / (posVotes + negVotes)
        }
      );
      client.quit();
    });
  });
});

module.exports = router;
