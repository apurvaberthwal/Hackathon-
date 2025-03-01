// models/User.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  google_id: {
    type: DataTypes.STRING,
    unique: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  access_token: {
    type: DataTypes.TEXT
  },
  refresh_token: {
    type: DataTypes.TEXT
  },
  preferences: {
    type: DataTypes.JSON,
    defaultValue: {
      theme: 'dark',
      timezone: 'UTC',
      chronotype: 'intermediate',
      workStartHour: 9,
      workEndHour: 17,
      focusHours: [10, 11, 14, 15]
    }
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
  underscored: true
});
module.exports = User;