var express = require("express");
var fetch = require('node-fetch');
var router = express.Router();
var Firestore = require('@google-cloud/firestore');

// setup Firestore
const db = new Firestore({
  projectId: 'unkochan-live-info',
  keyFilename: './key.json',
});

async function getYtKey() {
  var key = "";
  const keysRef = await db.collection('keys');
  const snapshot = await keysRef.orderBy('latest_used', 'asc').limit(1).get();
  await snapshot.forEach(async function (doc) {

    // get api key
    const keyData = doc.data();
    key = keyData.key;

    // update latest used time
    const id = doc.id;
    const transRef = await db.collection('keys').doc(id);
    db.runTransaction(async (transaction) => {
      transaction.update(transRef, {
        latest_used: Firestore.Timestamp.fromDate(new Date())
      })
    })
  });
  return key;
}

async function pollYoutube() {
  const liveStatusRef = await db.collection('liveStatus').doc('liveStatus');
  const liveStatusDoc = await liveStatusRef.get();
  const key = await getYtKey();

  try {

    // send request to Youtube Data API
    const request = 'https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UCx1nAvtVDIsaGmCMSe8ofsQ&type=video&order=date&maxResults=1&key=' + key;
    const liveRes = await fetch(request);
    const liveJson = await liveRes.json();
    const snippet = liveJson.items[0].snippet;
    if (snippet.liveBroadcastContent == 'live') {
      if (liveStatusDoc.data().Youtube == false) {

        // update live sttus
        db.runTransaction(async (transaction) => {
          transaction.update(liveStatusRef, {
            Youtube: true
          });
        });

        // add stream to DB
        const data = {
          platform: 'Youtube',
          publishTime: Firestore.Timestamp.fromDate(new Date(snippet.publishTime)),
          thumbnail: snippet.thumbnails.medium.url,
          title: snippet.title,
          url: 'https://www.youtube.com/watch?v=' + params.id.videoId
        };
        db.collection('videoes').add(data);
      }
    } else {

      // update live status
      db.runTransaction(async (transaction) => {
        transaction.update(liveStatusRef, {
          Youtube: false
        });
      });
      return true;
    }
  } catch (error) {
    return false;
  }
}

async function pollTwitch() {
  const liveStatusRef = await db.collection('liveStatus').doc('liveStatus');
  const liveStatusDoc = await liveStatusRef.get();
  try {
    const videoRes = await fetch('https://api.twitch.tv/helix/videos?user_id=545050196&first=1', {
      headers: {
        'client-id': '5s36fvb8xzlkxyoab9v24nc4iqtv38',
        'authorization': 'Bearer a38j0sfozk34i37fdgpnula9omwo2s'
      }
    });
    const videoJson = await videoRes.json();
    const videoData = videoJson.data[0];
    if (videoData.thumbnail_url == "") {
      if (liveStatusDoc.data().Twitch == false) {

        // update live status
        db.runTransaction(async (transaction) => {
          transaction.update(liveStatusRef, {
            Twitch: true
          });
        });

        // get thumbnail url
        const streamRes = await fetch('https://api.twitch.tv/helix/streams?user_id=545050196&first=1', {
          headers: {
            'client-id': '5s36fvb8xzlkxyoab9v24nc4iqtv38',
            'authorization': 'Bearer a38j0sfozk34i37fdgpnula9omwo2s'
          }
        });
        const streamJson = await streamRes.json();
        const streamThumbnail = streamJson.data[0].thumbnail_url.replace('{width}x{height}', '320x180');

        // add stream to DB
        const docData = {
          platform: 'Twitch',
          publishTime: Firestore.Timestamp.fromDate(new Date(videoData.published_at)),
          thumbnail: streamThumbnail,
          title: videoData.title,
          url: videoData.url
        };
        db.collection('videoes').add(docData);
      }
    } else {

      // update live status
      db.runTransaction(async (transaction) => {
        transaction.update(liveStatusRef, {
          Twitch: false
        });
      });
    }
    return true;
  } catch (error) {
    return false;
  }
}

// POST DB update
router.post('/', async function (req, res, next) {
  const ytRes = await pollYoutube();
  const twiRes = await pollTwitch();
  if (ytRes * twiRes) {
    res.sendStatus(200);
  } else {
    res.sendStatus(500);
  }
});

module.exports = router;