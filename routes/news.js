var express = require('express');
var router = express.Router();
var Firestore = require('@google-cloud/firestore');

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
    const publishTime = new Date(data.publishTime._seconds).toLocaleString();
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