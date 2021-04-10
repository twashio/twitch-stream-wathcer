const express = require("express");
const fetch = require('node-fetch');
const router = express.Router();
const Firestore = require('@google-cloud/firestore');
const iso8601_duration = require('iso8601-duration');

// setup Firestore
const db = new Firestore({
  projectId: 'unkochan-live-info',
  keyFilename: './key.json',
});

// get youtube api key from DB
async function getApiKey() {
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

// search youtube live
async function searchYoutube() {
  const liveStatusRef = await db.collection('liveStatus').doc('liveStatus');
  const liveStatusDoc = await liveStatusRef.get();
  const key = await getYtKey();
  let internalLiveStatus = false;

  // send request to Youtube Data API
  const liveRes = await fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UCx1nAvtVDIsaGmCMSe8ofsQtype=video&order=date&maxResults=5&key=' + key);
  const liveResJson = await liveRes.json();

  // use forEach beacuse Youtube live publish time can be earlier or later
  liveResJson.items.forEach(async item => {
    const snippet = item.snippet;
    if (snippet.liveBroadcastContent == 'live') {

      // update internal live status
      internalLiveStatus = true;

      if (liveStatusDoc.data().Youtube == false) {

        // update live sttus
        db.runTransaction(async transaction => {
          transaction.update(liveStatusRef, {
            Youtube: true
          });
        });

        // add stream to DB
        const data = {
          title: snippet.title,
          thumbnailUrl: snippet.thumbnails.medium.url,
          id: item.id.videoId,
          url: 'https://www.youtube.com/watch?v=' + item.id.videoId,
          startedAt: Firestore.Timestamp.fromDate(new Date(snippet.publishTime)),
          endedAt: null,
          platform: 'Youtube'
        }
        db.collection('videoes').add(data);
      }
    }
  });

  // when streams goes offline
  if (internalLiveStatus == false && liveStatusDoc.data().Youtube == true) {

    // get a reference of latest stocked stream
    const videoesRef = await db.collection('videoes');
    const snapshot = await videoesRef.orderBy('startedAt', 'desc').limit(1).get();
    let doneStreamRef;
    await snapshot.forEach(async element => {
      doneStreamRef = await db.collection('videoes').doc(element.id);
    });
    const doneStreamDoc = await doneStreamRef.get();
    // Yout can access to data with colon (e.g doneStreamData.hoge)
    const doneStreamData = await doneStreamDoc.data();

    // get youtube video duration
    const ytVideoRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=contentDetails&key=AIzaSyBWBvqdDNzVxF44dXxBWvN8yv2RLeTXKxw&id=' + doneStreamData.id);
    const ytVideoResJson = await ytVideoRes.json();
    const duration = ytVideoResJson.items[0].contentDetails.duration;

    // convert ending time from duration to seconds
    const durationSec = iso8601_duration.toSeconds(iso8601_duration.parse(duration));
    const endedDate = new Date((doneStreamData.startedAt._seconds + durationSec) * 1000);

    // add ending time
    db.runTransaction(async transaction => {
      transaction.update(doneStreamRef, {
        endedAt: Firestore.Timestamp.fromDate(endedDate)
      });
    });

    // update live status
    db.runTransaction(async transaction => {
      transaction.update(liveStatusRef, {
        Youtube: false
      });
    });
  }
}

// set routing
router.get('/', async (req, res, next) => {
  await searchYoutube();
  res.sendStatus(200);
});

module.exports = router;