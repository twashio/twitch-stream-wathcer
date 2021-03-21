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

function getPublishTime(startAt) {
  const diffSec = Math.floor(new Date().getTime() / 1000) - startAt._seconds;
  var publishTimeStr = "";
  if (diffSec < 60 * 60) {
    publishTimeStr = String(Math.floor(diffSec / 60)) + '分前';
  } else if (diffSec < 60 * 60 * 24) {
    publishTimeStr = String(Math.floor(diffSec / (60 * 60))) + '時間前';
  } else {
    publishTimeStr = String(Math.floor(diffSec / (60 * 60 * 24))) + '日前';
  }
  return publishTimeStr;
}

async function getVideoes() {
  var videoes = [];
  const videoRef = await db.collection('videoes');
  const snapshot = await videoRef.orderBy('publishTime', 'desc').limit(40).get();
  await snapshot.forEach(element => {
    const data = element.data();
    const publishTimeStr = getPublishTime(data.publishTime);
    videoes.push(new videoDataClass(data.platform, publishTimeStr, data.thumbnail, data.title, data.url));
  });
  return videoes;
}

// GET home page
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