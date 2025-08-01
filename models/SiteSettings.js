const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
  appearance: {
    announcementBar: {
      enabled: {
        type: Boolean,
        default: false
      },
      text: {
        type: String,
        default: 'Welcome to Cinema.fo - Your premium streaming destination!'
      },
      backgroundColor: {
        type: String,
        default: 'linear-gradient(135deg, #1e40af, #1e3a8a)'
      },
      textColor: {
        type: String,
        default: '#ffffff'
      },
      height: {
        type: Number,
        default: 48
      },
      textSize: {
        type: String,
        default: 'text-sm md:text-base'
      },
      textWeight: {
        type: String,
        default: 'font-medium'
      },
      textStyle: {
        type: String,
        default: 'normal'
      }
    },
    floatingSocialButtons: {
      enabled: {
        type: Boolean,
        default: false
      },
      discordEnabled: {
        type: Boolean,
        default: false
      },
      telegramEnabled: {
        type: Boolean,
        default: false
      },
      discordUrl: {
        type: String,
        default: 'https://discord.gg/cinema-fo'
      },
      telegramUrl: {
        type: String,
        default: 'https://t.me/cinema-fo'
      }
    },
    customCSS: {
      type: String,
      default: ''
    }
  },
  content: {
    disclaimer: {
      type: String,
      default: 'This is a streaming platform for entertainment purposes only.'
    },
    aboutUs: {
      type: String,
      default: 'Cinema.fo is your premier destination for streaming movies and TV shows.'
    },
    socialLinks: {
      discord: {
        type: String,
        default: 'https://discord.gg/cinema-fo'
      },
      telegram: {
        type: String,
        default: 'https://t.me/cinema-fo'
      }
    }
  },
  ads: {
    mainPageAd1: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: '' },
      clickUrl: { type: String, default: '' }
    },
    mainPageAd2: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: '' },
      clickUrl: { type: String, default: '' }
    },
    mainPageAd3: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: '' },
      clickUrl: { type: String, default: '' }
    },
    mainPageAd4: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: '' },
      clickUrl: { type: String, default: '' }
    },
    searchTopAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: '' },
      clickUrl: { type: String, default: '' }
    },
    searchBottomAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: '' },
      clickUrl: { type: String, default: '' }
    },
    moviesPageAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: '' },
      clickUrl: { type: String, default: '' }
    },
    moviesPageBottomAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: '' },
      clickUrl: { type: String, default: '' }
    },
    showsPageAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: '' },
      clickUrl: { type: String, default: '' }
    },
    showsPageBottomAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: '' },
      clickUrl: { type: String, default: '' }
    },
    playerPageAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: '' },
      clickUrl: { type: String, default: '' }
    }
  }
}, {
  timestamps: true
});

const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);

module.exports = SiteSettings; 