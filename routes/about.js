const express = require('express');
const router = express.Router();

// GET about page
router.get('/', async function (req, res, next) {
  res.render('about');
});

module.exports = router;