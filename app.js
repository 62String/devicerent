const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('안녕!'));
app.listen(3003, () => console.log('켜짐'));