const admin = require('firebase-admin');
const serviceAccount = require('./firebaseServiceKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://vividchatdatabase-default-rtdb.firebaseio.com'
});

const db = admin.database();

module.exports = db;
