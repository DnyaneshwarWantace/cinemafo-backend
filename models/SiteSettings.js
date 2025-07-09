const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
  appearance: {
    announcementBar: {
      enabled: { type: Boolean, default: true },
      text: { type: String, default: "🎬 Welcome to Cinema.FO - Your Ultimate Streaming Destination! 🍿" },
      backgroundColor: { type: String, default: "#1e40af" },
      textColor: { type: String, default: "#ffffff" }
    },
    floatingSocialButtons: {
      enabled: { type: Boolean, default: true },
      discordUrl: { type: String, default: "https://discord.gg/cinemafo" },
      telegramUrl: { type: String, default: "https://t.me/cinemafo" }
    },
    customCSS: { type: String, default: "" }
  },
  content: {
    disclaimer: { type: String, default: "" },
    aboutUs: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    socialLinks: {
      discord: { type: String, default: "" },
      telegram: { type: String, default: "" }
    }
  },
  ads: {
    mainPageAd1: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    mainPageAd2: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    mainPageAd3: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    mainPageAd4: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    searchTopAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    searchBottomAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    moviesPageAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    moviesPageBottomAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    showsPageAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    showsPageBottomAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    upcomingPageAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    upcomingPageBottomAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    },
    playerPageAd: {
      enabled: { type: Boolean, default: false },
      imageUrl: { type: String, default: "" },
      clickUrl: { type: String, default: "" }
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('SiteSettings', siteSettingsSchema); 