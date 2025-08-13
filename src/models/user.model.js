// src/models/user.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize-instance');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  // ===================================
  // NOVO CAMPO ADICIONADO
  // ===================================
  nome: {
    type: DataTypes.STRING,
    allowNull: false, // Tornamos o nome obrigatório
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'admin',
  }
}, {
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
        if (user.changed('password')) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
        }
    }
  }
});

User.prototype.isValidPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
}

module.exports = User;