var express = require("express");
var fetch = require('node-fetch');
var router = express.Router();
var Firestore = require('@google-cloud/firestore');

// setup Firestore
const db = new Firestore({
  projectId: 'jk-live-info',
  keyFilename: './key.json',
});

function pollYoutube() {
  fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&key=AIzaSyBkr-SejepuFqxmahrKAeAjuuXu-FVRPYk&channelId=UCx1nAvtVDIsaGmCMSe8ofsQ&type=video&order=date&maxResults=1', {
      method: "GET"
    })
    .then(res => res.json())
    .then(body => {
      body.items.forEach(async function (params) {
        const snippet = params.snippet;
        const data = {
          isLive: snippet.liveBroadcastContent == 'live',
          platform: 'youtube',
          publishTime: Firestore.Timestamp.fromDate(new Date(snippet.publishTime)),
          thumbnail: snippet.thumbnails.medium.url,
          title: snippet.title
        };
        const ref = await db.collection('videoes');
        const snapshot = await ref.orderBy('publishTime', 'desc').limit(1).get(); 
        snapshot.forEach(element => {
          if (data.publishTime._seconds > element.data().publishTime._seconds) {
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
      body.data.forEach(async function (params) {
        const url = params.thumbnail_url.replace('%{width}x%{height}', '320x180');
        const data = {
          isLive: params.thumbnail_url.length == 0,
          platform: 'twitch',
          publishTime: Firestore.Timestamp.fromDate(new Date(params.published_at)),
          thumbnail: url,
          title: params.title
        };
        const ref = await db.collection('videoes');
        const snapshot = await ref.orderBy('publishTime', 'desc').limit(1).get();
        snapshot.forEach(element => {
          if (data.publishTime._seconds > element.data().publishTime._seconds) {
            db.collection('videoes').doc(data.title).set(data);
          }
        });
      });
    });
}

function checkLive() {}

/* Update DB. */
router.put('/', async function (req, res, next) {
  await pollYoutube();
  await pollTwitch();
  checkLive();
});

module.exports = router;