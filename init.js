const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

mongoose.connect('mongodb://localhost:27017/devicerent')
  .then(() => console.log('MongoDB connected for initialization'))
  .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

async function createUser() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('pass123', salt);
    const user = new User({ username: 'user1', password: hashedPassword });
    await user.save();
    console.log('User created successfully');
  } catch (error) {
    console.error('Error creating user:', error);
  }
}

createUser().then(() => mongoose.connection.close());