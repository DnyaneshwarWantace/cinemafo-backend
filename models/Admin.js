const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  recoveryCodes: [{
    code: {
      type: String,
      required: true
    },
    used: {
      type: Boolean,
      default: false
    },
    usedAt: {
      type: Date
    }
  }],
  lastPasswordChange: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Method to generate recovery codes
adminSchema.methods.generateRecoveryCodes = function(count = 5) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push({
      code: code,
      used: false
    });
  }
  this.recoveryCodes = codes;
  return codes.map(c => c.code);
};

// Method to verify recovery code
adminSchema.methods.verifyRecoveryCode = function(code) {
  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const codeObj = this.recoveryCodes.find(c => 
    c.code === normalizedCode && !c.used
  );
  
  if (codeObj) {
    codeObj.used = true;
    codeObj.usedAt = new Date();
    return true;
  }
  return false;
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin; 