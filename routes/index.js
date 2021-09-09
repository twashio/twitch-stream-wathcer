const express = require('express');
const router = express.Router();
const Firestore = require('@google-cloud/firestore');
const moment = require('moment-timezone');

// setup Firestore
const db = new Firestore({
  projectId: '$PROJECTID',
  keyFilename: '$KEY',
});

class videoClass {
  constructor(title, thumbnailUrl, id, url, startedAt, endedAt) {
    this.title = title;
    this.thumbnailUrl = thumbnailUrl;
    this.id = id;
    this.url = url;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
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
  const snapshot = await videoRef.orderBy('startedAt', 'desc').limit(12).get();
  await snapshot.forEach(element => {
    const data = element.data();
    const startedAt = getStartedAt(data.startedAt);
    const endedAt = getEndedAt(data.endedAt);
    videoes.push(new videoClass(data.title, data.thumbnailUrl, data.id, data.url, startedAt, endedAt));
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
    isLive: doc.data().isLive,
    videoes: videoes
  });
});

module.exports = router;