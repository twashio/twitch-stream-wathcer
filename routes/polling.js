var express = require("express");
var fetch = require('node-fetch');
var router = express.Router();
var Firestore = require('@google-cloud/firestore');

// setup Firestore
const db = new Firestore({
  projectId: 'unkochan-live-info',
  keyFilename: './key.json',
});

function pollYoutube() {
  fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&key=AIzaSyDGQRS9YmrXRIhOmPoljDWxkG5G90Dpk6A&channelId=UCx1nAvtVDIsaGmCMSe8ofsQ&type=video&order=date&maxResults=1', {
      method: "GET"
    })
    .then(res => res.json())
    .then(body => {
      body.items.forEach(async function (params) {

        // data extraction
        const snippet = params.snippet;

        // get live status and update isLive field
        const liveStatusRef = await db.collection('liveStatus').doc('liveStatus');
        try {
          await db.runTransaction(async (transaction) => {
            if (snippet.liveBroadcastContent == 'live') {
              transaction.update(liveStatusRef, {
                isLive: true
              });
            } else {
              transaction.update(liveStatusRef, {
                isLive: false
              });
            }
          });
        } catch (error) {}

        // update videoes
        if (snippet.liveBroadcastContent == 'none') {
          const data = {
            platform: 'Youtube',
            publishTime: Firestore.Timestamp.fromDate(new Date(snippet.publishTime)),
            thumbnail: snippet.thumbnails.medium.url,
            title: snippet.title,
            url: 'https://www.youtube.com/watch?v=' + params.id.videoId
          };
          const videoesRef = await db.collection('videoes');
          const snapshot = await videoesRef.orderBy('publishTime', 'desc').limit(1).get();
          snapshot.forEach(element => {
            if (data.publishTime._seconds > element.data().publishTime._seconds) {
              db.collection('videoes').doc(snippet.title).set(data);
            }
          });
        }
      });
    });
}

function pollTwitch() {
  fetch('https://api.twitch.tv/helix/videos?user_id=545050196&first=1', {
      headers: {
        'client-id': '5s36fvb8xzlkxyoab9v24nc4iqtv38',
        'authorization': 'Bearer a38j0sfozk34i37fdgpnula9omwo2s'
      }
    })
    .then(res => res.json())
    .then(body => {
      body.data.forEach(async function (params) {

        // when live, thumbnail_url is empty
        if (params.thumbnail_url.length == 0) {

          // update live status
          const liveStatusRef = await db.collection('liveStatus').doc('liveStatus');
          try {
            await db.runTransaction(async (transaction) => {
              transaction.update(liveStatusRef, {
                isLive: true
              });
            });
          } catch (error) {}

          // get thumbnial url and update videoes
          fetch('https://api.twitch.tv/helix/streams?user_id=545050196&first=1', {
              headers: {
                'client-id': '5s36fvb8xzlkxyoab9v24nc4iqtv38',
                'authorization': 'Bearer a38j0sfozk34i37fdgpnula9omwo2s'
              }
            })
            .then(res => res.json())
            .then(async function (body) {
              const thumbnail = body.data[0].thumbnail_url.replace('{width}x{height}', '320x180');
              const data = {
                platform: 'Twitch',
                publishTime: Firestore.Timestamp.fromDate(new Date(params.published_at)),
                thumbnail: thumbnail,
                title: params.title,
                url: params.url
              };
              const videoesRef = await db.collection('videoes');
              const snapshot = await videoesRef.orderBy('publishTime', 'desc').limit(1).get();
              snapshot.forEach(element => {
                if (data.publishTime._seconds > element.data().publishTime._seconds) {
                  db.collection('videoes').doc(data.title).set(data);
                }
              });
            });
        } else {

          // update live status
          const liveStatusRef = await db.collection('liveStatus').doc('liveStatus');
          try {
            await db.runTransaction(async (transaction) => {
              transaction.update(liveStatusRef, {
                isLive: false
              });
            });
          } catch (error) {}

          // update videoes
          const data = {
            platform: 'Twitch',
            publishTime: Firestore.Timestamp.fromDate(new Date(params.published_at)),
            thumbnail: params.thumbnail_url.replace('%{width}x%{height}', '320x180'),
            title: params.title,
            url: params.url
          };
          const videoesRef = await db.collection('videoes');
          const snapshot = await videoesRef.orderBy('publishTime', 'desc').limit(1).get();
          snapshot.forEach(element => {
            if (data.publishTime._seconds > element.data().publishTime._seconds) {
              db.collection('videoes').doc(data.title).set(data);
            }
          });
        }
      });
    });
}

function checkLive() {}

// update db
router.post('/', async function (req, res, next) {
  await pollYoutube();
  await pollTwitch();
  checkLive();
  res.send('ok');
});

module.exports = router;