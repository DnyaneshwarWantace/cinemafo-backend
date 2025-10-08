require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const Admin = require('../models/Admin');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB');
    console.log('');

    // Get username from user
    const username = await question('Enter admin username: ');
    
    if (!username || username.trim().length < 3) {
      console.log('❌ Username must be at least 3 characters long');
      await mongoose.connection.close();
      rl.close();
      process.exit(1);
    }

    // Check if username already exists
    const existingAdmin = await Admin.findOne({ username: username.trim() });
    if (existingAdmin) {
      console.log('❌ Admin user with username "' + username.trim() + '" already exists!');
      console.log('');
      console.log('💡 Tips:');
      console.log('   - Choose a different username');
      console.log('   - Or delete the existing admin from database first');
      console.log('   - Or use the Account Settings in admin panel to change credentials');
      await mongoose.connection.close();
      rl.close();
      process.exit(0);
    }

    // Get password from user
    const password = await question('Enter admin password (min 6 characters): ');
    
    if (!password || password.length < 6) {
      console.log('❌ Password must be at least 6 characters long');
      await mongoose.connection.close();
      rl.close();
      process.exit(1);
    }

    // Confirm password
    const confirmPassword = await question('Confirm admin password: ');
    
    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match!');
      await mongoose.connection.close();
      rl.close();
      process.exit(1);
    }

    console.log('');
    console.log('Creating admin user...');

    // Create admin user
    const admin = new Admin({
      username: username.trim(),
      password: password
    });

    await admin.save();
    
    console.log('');
    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📋 Your credentials:');
    console.log('   Username: ' + username.trim());
    console.log('   Password: ' + password);
    console.log('');
    console.log('⚠️  IMPORTANT - Save these credentials securely!');
    console.log('');
    console.log('🔐 Next steps:');
    console.log('   1. Login to admin panel with these credentials');
    console.log('   2. Go to Account tab');
    console.log('   3. Setup security questions');
    console.log('   4. Generate recovery codes');
    console.log('   5. Save recovery codes in a safe place');
    console.log('');

    // Close connection
    await mongoose.connection.close();
    rl.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    rl.close();
    process.exit(1);
  }
};

createAdmin(); 