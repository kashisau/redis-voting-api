var express = require('express');
var router = express.Router();
var redis = require('redis');
var availableCountries = ['italy', 'spain'];
var client = redis.createClient();

const VOTES_MAX = 100;

client.on("error", function(err) {
  console.log("Error ", err);
  return;
});

/**
 * GET /total?country=[country]
 *
 * This method takes a `country` parameter as a query string and uses it to
 * fetch the positive and negative votes for that country from the Redis server.
 * The result is fetched as a JSON object, with properties `country`
 * (lowercase) and `percent`.
 */
router.get('/total', function(req, res, next) {
  var success = false,
    country = req.query['country'],
    posVotesTotal = 1,
    negVotesTotal = 1,
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

  multi.exec((err, results) => reportVotes(err, results, country, res));
});

/**
 * POST /cast
 *
 * Handles a POST request with the urlencoded body parameters `country`,
 * `positive` and `negative`. This will be used to increment the positive and
 * negative vote counters for the specified country.
 */
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

  // Enforce a valid range for our votes.
  if (votesPos < 0) votesPos = 0;
  if (votesNeg < 0) votesNeg = 0;
  votesPos = Math.min(votesPos, VOTES_MAX);
  votesNeg = Math.min(votesNeg, VOTES_MAX);

  multi = client.multi();

  multi.incrby(country + "_pos", votesPos);
  multi.incrby(country + "_neg", votesNeg);

  multi.exec((err, results) => reportVotes(err, results, country, res));
});

/**
 * This method is used by both the vote casting and vote lookup methods to
 * determine the current status of the votes.
 * @param err {Error} An error object containing the error message if such an
 *                    error exists.
 * @param results {Number[]}  The `positive` and `negative` votes for the
 *                            country (as supplied by the Redis connector).
 * @param country {String}  The name of the country for which we're reporting.
 * @param res {express.Router.res}  The Express.js response object to call the
 *                                  response to.
 */
var reportVotes = function(err, results, country, res) {
  if (err) throw err;
  var posVotesTotal = +results[0],
    negVotesTotal = +results[1];

  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');

  res.json(
    {
      country: country,
      percent: posVotesTotal / (posVotesTotal + negVotesTotal)
    }
  );
};

module.exports = router;
