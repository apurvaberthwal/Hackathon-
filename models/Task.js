// models/Task.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Task = sequelize.define('Task', {
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
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    task_type: {
      type: DataTypes.ENUM('work', 'personal', 'health'),
      defaultValue: 'work'
    },
    priority: {
      type: DataTypes.TINYINT,
      defaultValue: 3, // 1 = highest, 5 = lowest
      validate: {
        min: 1,
        max: 5
      }
    },
    duration: {
      type: DataTypes.INTEGER, // Duration in minutes
      defaultValue: 30
    },
    scheduled_time: {
      type: DataTypes.DATE
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'postponed'),
      defaultValue: 'pending'
    },
    ai_metadata: {
      type: DataTypes.JSON,
      defaultValue: {
        optimal_score: 0,
        energy_level: 'medium',
        focus_requirement: 'medium'
      }
    }
  }, {
    timestamps: true,
    underscored: true
  });
  module.exports = Task;