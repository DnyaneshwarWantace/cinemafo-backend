const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/cinema-fo', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const SiteSettings = require('./models/SiteSettings');

async function migrateSocialLinks() {
  try {
    console.log('Starting social links migration...');
    
    // Find all SiteSettings documents
    const settings = await SiteSettings.find({});
    console.log(`Found ${settings.length} settings documents`);
    
    for (const setting of settings) {
      // Check if socialLinks field exists in content
      if (!setting.content.socialLinks) {
        console.log(`Adding socialLinks to document ${setting._id}`);
        
        // Add socialLinks field with default values
        setting.content.socialLinks = {
          discord: 'https://discord.gg/cinema-fo',
          telegram: 'https://t.me/cinema-fo'
        };
        
        await setting.save();
        console.log(`Updated document ${setting._id}`);
      } else {
        console.log(`Document ${setting._id} already has socialLinks field`);
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

migrateSocialLinks(); 