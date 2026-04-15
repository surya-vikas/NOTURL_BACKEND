const express = require('express');
const { redirectToOriginalUrl } = require('../controllers/urlController');

const router = express.Router();

router.get('/:shortId', (req, res, next) => {
  const shortId = String(req.params.shortId || '').trim();
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(shortId)) {
    return next();
  }

  return redirectToOriginalUrl(req, res, next);
});

module.exports = router;
