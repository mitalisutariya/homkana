import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/userModel.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('Connected to DB');
  const user = await User.findOne({ email: 'admin@gmail.com' });
  if (user) {
    console.log('User found:', user.email);
    console.log('Hashed Password:', user.password);
    const isMatch = await user.matchPassword('admin123');
    console.log('Password Match with admin123:', isMatch);
  } else {
    console.log('User admin@gmail.com not found');
  }
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
