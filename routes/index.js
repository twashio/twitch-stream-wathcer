var express = require('express');
var router = express.Router();
var Firestore = require('@google-cloud/firestore');

// setup Firestore
const db = new Firestore({
  projectId: 'unkochan-live-info',
  keyFilename: './key.json',
});

class videoDataClass {
  constructor(platform, publishTime, thumbnail, title, url) {
    this.platform = platform;
    this.publishTime = publishTime;
    this.thumbnail = thumbnail;
    this.title = title;
    this.url = url;
  }
}

async function getVideoes() {
  var videoes = [];
  const ref = await db.collection('videoes');
  const snapshot = await ref.orderBy('publishTime', 'desc').limit(9).get();
  await snapshot.forEach(element => {
    const data = element.data();
    videoes.push(new videoDataClass(data.platform, data.publishTime, data.thumbnail, data.title, data.url));
  });
  return videoes;
}

// get home page
router.get('/', async function (req, res, next) {
  const videoes = await getVideoes();
  const ref = await db.collection('liveStatus').doc('liveStatus');
  const doc = await ref.get();
  res.render('index', {
    isLive: doc.data().isLive,
    videoes: videoes
  });
});

module.exports = router;