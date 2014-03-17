var util = require('util');

var request = require('request'),
    irc = require('irc'),
    async = require('async');

var config = require('./config.json');

var subreddits = config.subreddits;

var latest;

console.log('this is reddit-bot');

var client = new irc.Client(config.irc.server, config.irc.nick, config.irc);

client.on('motd', look);

function look() {
  _look(function (err) {
    if (err) {
      throw err;
    }

    setTimeout(look, 1 * 60 * 1000);
  });
}

function _look(done) {

  var posts = [];

  async.forEachSeries(subreddits, function (subreddit, cb) {
    request({
      uri: util.format('http://www.reddit.com/r/%s/new.json', subreddit),
      json: true,
      qs: {
        sort: 'new',
        latest: latest || null
      }
    }, function (err, res, body) {
      if (err) {
        throw err;
      }

      if (latest) {
        body.data.children.every(function (child, i) {
          var d = child.data,
              id = toInt(d.id),
              isNewEnough = id > latest;

          if (isNewEnough) {
            posts.push(d);
          }

          return isNewEnough;
        });
      }
      else {
        posts.push(body.data.children[0].data);
      }

      cb();
    });
  }, function (err) {
    if (err) {
      throw err;
    }

    posts = posts.sort(sortPosts).reverse();

    if (posts.length) {
      latest = toInt(posts[0].id);
    }
    posts.reverse().forEach(function (p) {
      config.irc.channels.forEach(function (c) {
	var title = convertTags(p.title);
        client.say(c, util.format(
          'promptbot, add prompt %s @(u/%s) @(http://redd.it/%s) @(r/%s)',
            title,
            p.author,
            p.id,
            p.subreddit
        ));
      });
    });

    done(null);
  });
};

function convertTags(title) {
   var posttags = /\[([^\]]*)\]/g;
   while ( tag = posttags.exec(title) ) {
       if ( tag[1] != "OT" && tag[1] != "WP" )
           title = title + " #" + tag[1];
   }
   title = title.replace(/\[([^\]]*)\]/g, "").trim();
   return title;
}


var digits = 'abcdefghijklmnopqrstuvwxyz0123456789'.split(''),
    base = digits.length;

function sortPosts(a, b) {
  return toInt(a.id) - toInt(b.id);
}

function toInt(str) {
  var total = 0;
  str.split('').reverse().forEach(function (d, n) {
    total += (digits.indexOf(d) + 1) * Math.pow(base, n);
  });
  return total;
}
