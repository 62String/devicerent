const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/devicerent', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("AdminPass123", salt);
  await mongoose.connection.db.collection('users').updateOne(
    { username: "admin1" },
    { $set: { password: hashedPassword } }
  );
  console.log('Password hashed for admin1');
  mongoose.connection.close();
}).catch(err => console.error('Error:', err));