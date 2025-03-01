const { Sequelize } = require('sequelize');
const User = require('./User');
const Task = require('./Task');
const Roadmap = require('./Roadmap');

// Define associations
User.hasMany(Task, { foreignKey: 'user_id' });
Task.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Roadmap, { foreignKey: 'user_id' });
Roadmap.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  User,
  Task,
  Roadmap
};