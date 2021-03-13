var express = require("express");
var fetch = require('node-fetch');
var router = express.Router();
var Firestore = require('@google-cloud/firestore');

// setup Firestore
const db = new Firestore({
  projectId: 'jk-live-info',
  keyFilename: '/key.json',
});

function pollYoutube() {
  fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&key=AIzaSyAiNMNazsWyfbElhKBBv-p2O_gWjvtpP_c&channelId=UCx1nAvtVDIsaGmCMSe8ofsQ&type=video&order=date&maxResults=1', {
      method: "GET"
    })
    .then(res => res.json())
    .then(body => {
      body.items.forEach(async function (element) {
        const snippet = element.snippet;
        const data = {
          isLive: snippet.liveBroadcastContent == 'live',
          platform: 'youtube',
          publishTime: snippet.publishTime,
          thumbnail: snippet.thumbnails.medium.url,
          title: snippet.title
        };
        const ref = await db.collection('videoes');
        const snapshot = await ref.limit(1).get(); // snapshot: doc
        snapshot.forEach(element => {
          if (new Date(data.publishTime).getTime() > new Date(element.data().publishTime).getTime()) {
            db.collection('videoes').doc(snippet.title).set(data);
          }
        });
      });
    });
}

function pollTwitch() {
  fetch('https://api.twitch.tv/helix/videos?user_id=545050196&first=1', {
      headers: {
        'Client-Id': '5s36fvb8xzlkxyoab9v24nc4iqtv38',
        'Authorization': 'Bearer a38j0sfozk34i37fdgpnula9omwo2s'
      }
    })
    .then(res => res.json())
    .then(body => {
      body.data.forEach(async function (element) {
        const url = element.thumbnail_url.replace('%{width}x%{height}', '320x180');
        const data = {
          isLive: element.thumbnail_url.length == 0,
          platform: 'twitch',
          publishTime: element.published_at,
          thumbnail: url,
          title: element.title
        };
        const ref = await db.collection('videoes');
        const snapshot = await ref.limit(1).get(); // snapshot: doc
        snapshot.forEach(element => {
          if (new Date(data.publishTime).getTime() > new Date(element.data().publishTime).getTime()) {
            db.collection('videoes').doc(snippet.title).set(data);
          }
        });
      });
    });
}

function checkLive() {}

/* Update DB. */
router.put('/', async function (req, res, next) {
  await pollYoutube();
  await pollTwitc();
  checkLive();
  res.send('hello');
});

module.exports = router;