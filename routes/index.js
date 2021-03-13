var express = require('express');
var router = express.Router();
var Firestore = require('@google-cloud/firestore');

// setup Firestore
const db = new Firestore({
  projectId: 'jk-live-info',
  keyFilename: './key.json',
});

class videoDataClass {
  constructor(isLive, platform, publishTime, thumbnail, title) {
    this.isLive = isLive;
    this.platform = platform;
    this.publishTime = publishTime;
    this.thumbnail = thumbnail;
    this.title = title;
  }
}

async function getVideoes() {
  var videoes = [];
  const ref = await db.collection('videoes');
  const snapshot = await ref.limit(10).get();
  await snapshot.forEach(element => {
    const data = element.data();
    videoes.push(new videoDataClass(data.isLive, data.platform, data.publishTime, data.thumbnail, data.title));
  });
  return videoes;
}

/* GET home page. */
router.get('/', async function (req, res, next) {
  const videoes = await getVideoes();
  const isLive = videoes[0].isLive;
  res.render('index', {
    isLive: isLive,
    videoes: videoes
  });
});

module.exports = router;