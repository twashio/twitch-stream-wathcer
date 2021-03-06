const express = require("express");
const fetch = require('node-fetch');
const router = express.Router();
const Firestore = require('@google-cloud/firestore');
const iso8601_duration = require('iso8601-duration');

// setup Firestore
const db = new Firestore({
  projectId: '$PROJECTID',
  keyFilename: '$KEY',
});

// check twitch stream
async function searchTwitch() {
  const liveStatusRef = await db.collection('liveStatus').doc('liveStatus');
  const liveStatusDoc = await liveStatusRef.get();
  const videoRes = await fetch('https://api.twitch.tv/helix/videos?user_id=$USERID&first=1', {
    headers: {
      'client-id': '$CLIENTID',
      'authorization': '$TOKEN'
    }
  });
  const videoJson = await videoRes.json();
  const videoData = videoJson.data[0];

  if (videoData.thumbnail_url == "") {
    if (liveStatusDoc.data().isLive == false) {

      // update live status
      db.runTransaction(async transaction => {
        transaction.update(liveStatusRef, {
          isLive: true
        });
      });

      // get thumbnail url from search endpoint
      const streamRes = await fetch('https://api.twitch.tv/helix/streams?user_id=$USERID&first=1', {
        headers: {
          'client-id': '$CLIENTID',
          'authorization': '$TOKEN'
        }
      });
      const streamResJson = await streamRes.json();
      console.log(streamResJson);
      const streamThumbnail = streamResJson.data[0].thumbnail_url.replace('{width}x{height}', '320x180');

      // add stream to DB
      const data = {
        title: videoData.title,
        thumbnailUrl: streamThumbnail,
        id: videoData.id,
        url: videoData.url,
        startedAt: Firestore.Timestamp.fromDate(new Date(videoData.published_at)),
        endedAt: null,
      }
      db.collection('videoes').add(data);
    }

    // when stream goes offline
  } else if (liveStatusDoc.data().isLive == true) {

    // get latest video document reference from videoes collection
    const videoesRef = await db.collection('videoes');
    const snapshot = await videoesRef.orderBy('startedAt', 'desc').limit(1).get();
    let doneStreamRef;
    await snapshot.forEach(async element => {
      doneStreamRef = await db.collection('videoes').doc(element.id);
    });

    // convert ending time from duration to seconds
    let duration = videoData.duration;
    duration = 'PT' + duration;
    duration = duration.replace('h', 'H');
    duration = duration.replace('m', 'M');
    duration = duration.replace('s', 'S');
    const durationSec = iso8601_duration.toSeconds(iso8601_duration.parse(duration));
    const startingDate = new Date(videoData.published_at);
    const endedDate = new Date(startingDate.getTime() + (durationSec * 1000));

    // replace thumbnail url and ending time
    db.runTransaction(async transaction => {
      transaction.update(doneStreamRef, {
        endedAt: Firestore.Timestamp.fromDate(endedDate),
        thumbnailUrl: videoData.thumbnail_url.replace('%{width}x%{height}', '320x180')
      });
    });

    // update live status
    db.runTransaction(async transaction => {
      transaction.update(liveStatusRef, {
        isLive: false
      });
    });
  }
}

// set routing
router.get('/', async (req, res, next) => {
  await searchTwitch();
  res.sendStatus(200);
});

module.exports = router;