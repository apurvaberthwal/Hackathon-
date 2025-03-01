// models/Roadmap.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Roadmap = sequelize.define('Roadmap', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    roadmap: {
      type: DataTypes.JSON,
      allowNull: false
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true,
    underscored: true
  });

  
  module.exports = Roadmap;