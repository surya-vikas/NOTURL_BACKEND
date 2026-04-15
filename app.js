const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const urlRoutes = require('./routes/urlRoutes');
const adminRoutes = require('./routes/adminRoutes');
const redirectRoutes = require('./routes/redirectRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { sendSuccess } = require('./utils/response');

const app = express();

app.disable('x-powered-by');

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.get('/', (req, res) => {
  res.send('🚀 NotURL Backend is Live!');
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'API is working 🚀',
  });
});

app.get('/api/health', (req, res) => {
  sendSuccess(res, {
    statusCode: 200,
    status: 'ok',
    message: 'NotURL authentication service is running',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api/url', urlRoutes);
app.use('/api/admin', adminRoutes);
app.use('/', redirectRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
