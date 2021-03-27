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
  await snapshot.forEach(async doc => {

    // get api key
    const keyData = doc.data();
    key = keyData.key;

    // update latest used time
    const id = doc.id;
    const latestUsedKeyRef = await db.collection('keys').doc(id);
    db.runTransaction(async transaction => {
      transaction.update(latestUsedKeyRef, {
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


  // send request to Youtube Data API
  const request = 'https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UCx1nAvtVDIsaGmCMSe8ofsQ&type=video&order=date&maxResults=1&key=' + key;
  const liveRes = await fetch(request);
  const liveJson = await liveRes.json();
  const snippet = liveJson.items[0].snippet;
  if (snippet.liveBroadcastContent == 'live') {
    if (liveStatusDoc.data().Youtube == false) {

      // update live sttus
      db.runTransaction(async transaction => {
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
        url: 'https://www.youtube.com/watch?v=' + liveJson.items[0].id.videoId
      };
      db.collection('videoes').add(data);
    }
  } else {
    if (liveStatusDoc.data().Youtube == true) {

      // update live status
      db.runTransaction(async transaction => {
        transaction.update(liveStatusRef, {
          Youtube: false
        });
      });
    }
  }
  return true;
}

async function pollTwitch() {
  const liveStatusRef = await db.collection('liveStatus').doc('liveStatus');
  const liveStatusDoc = await liveStatusRef.get();
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
      db.runTransaction(async transaction => {
        transaction.update(liveStatusRef, {
          Twitch: true
        });
      });

      // get thumbnail url from search endpoint
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
    if (liveStatusDoc.data().Twitch == true) {

      // get latest video document reference from videoes collection
      const videoesRef = await db.collection('videoes');
      const snapshot = await videoesRef.orderBy('publishTime', 'desc').limit(1).get();
      const doneStreamRef = await db.collection('videoes').doc(snapshot[0].id);

      // get thumbnail url from video endpoint
      const videoRes = await fetch('https://api.twitch.tv/helix/videos?user_id=545050196&first=1', {
        headers: {
          'client-id': '5s36fvb8xzlkxyoab9v24nc4iqtv38',
          'authorization': 'Bearer a38j0sfozk34i37fdgpnula9omwo2s'
        }
      });
      const videoJson = await videoRes.json();
      const videoThumbnail = videoJson.data[0].thumbnail_url.replace('%{width}x%{height}', '320x180');

      // replace thumbnail url
      db.runTransaction(async transaction => {
        transaction.update(doneStreamRef, {
          thumbnail: videoThumbnail
        });
      });

      // update live status
      db.runTransaction(async transaction => {
        transaction.update(liveStatusRef, {
          Twitch: false
        });
      });
    }
  }
  return true;
}

// POST DB update
router.get('/', async (req, res, next) => {
  await pollYoutube();
  await pollTwitch();
  res.sendStatus(200);
});

module.exports = router;