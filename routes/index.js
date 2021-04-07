const express = require('express');
const router = express.Router();
const Firestore = require('@google-cloud/firestore');
const moment = require('moment-timezone');

// setup Firestore
const db = new Firestore({
  projectId: 'unkochan-live-info',
  keyFilename: './key.json',
});

class videoClass {
  constructor(title, thumbnailUrl, id, url, startedAt, endedAt, platform) {
    this.title = title;
    this.thumbnailUrl = thumbnailUrl;
    this.id = id;
    this.url = url;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
    this.platform = platform;
  }
}

// get starting time
function getStartedAt(startedAt) {
  const startingTime = moment(new Date(startedAt._seconds * 1000)).tz('Asia/Tokyo').format('YYYY/MM/DD HH:mm');
  return startingTime;
}

// get ending time
function getEndedAt(endedAt) {
  if (endedAt == null) {
    return null;
  } else {
    const endingTime = moment(new Date(endedAt._seconds * 1000)).tz('Asia/Tokyo').format('YYYY/MM/DD HH:mm');
    return endingTime;
  }
}

// get streams and videoes form DB
async function getVideoes() {
  var videoes = [];
  const videoRef = await db.collection('videoes');
  const snapshot = await videoRef.orderBy('startedAt', 'desc').limit(10).get();
  await snapshot.forEach(element => {
    const data = element.data();
    const startedAt = getStartedAt(data.startedAt);
    const endedAt = getEndedAt(data.endedAt);
    videoes.push(new videoClass(data.title, data.thumbnailUrl, data.id, data.url, startedAt, endedAt, data.platform));
  });
  return videoes;
}

// GET home page
router.get('/', async function (req, res, next) {

  // get videos
  const videoes = await getVideoes();

  // get live status
  const ref = await db.collection('liveStatus').doc('liveStatus');
  const doc = await ref.get();

  // rendering
  res.render('index', {
    isLive: doc.data().Youtube || doc.data().Twitch || doc.data().niconico,
    videoes: videoes
  });
});

module.exports = router;