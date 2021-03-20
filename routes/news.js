var express = require('express');
var router = express.Router();
var Firestore = require('@google-cloud/firestore');
var moment = require('moment');

// setup Firestore
const db = new Firestore({
  projectId: 'unkochan-live-info',
  keyFilename: './key.json',
});

class articleClass {
  constructor(header, publishTime) {
    this.header = header;
    this.publishTime = publishTime;
  }
}

async function getNews() {
  var news = [];
  const newsRef = await db.collection('news');
  const snapshot = await newsRef.orderBy('publishTime', 'desc').get();
  await snapshot.forEach(article => {
    const data = article.data();
    const date = new Date(data.publishTime._seconds * 1000  + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));
    const publishTime = moment(date).format("YYYY/MM/DD HH:mm");
    news.push(new articleClass(data.header, publishTime));
  });
  return news;
}
// GET news page
router.get('/', async function (req, res, next) {
  const news = await getNews();
  res.render('news', {
    news: news
  });
});

module.exports = router;