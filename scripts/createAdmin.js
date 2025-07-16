require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DATABASE_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username: 'cinemafo' });
    if (existingAdmin) {
      console.log('Admin user already exists!');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Create admin user
    const admin = new Admin({
      username: 'cinemafo',
      password: 'cinemafo'
    });

    await admin.save();
    console.log('Admin user created successfully!');
    console.log('Username: cinemafo');
    console.log('Password: cinemafo');

    // Close connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin(); 