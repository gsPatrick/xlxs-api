'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('substitutos', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      matricula_funcionario: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        references: {
          model: 'funcionarios', // Nome exato da tabela de funcionários
          key: 'matricula',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', // Se um funcionário for deletado, ele deixa de ser substituto
      },
      cargos_aptos: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        comment: 'Lista de cargos que este substituto está apto a cobrir.',
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'Disponível',
        allowNull: false,
        comment: 'Status atual do substituto (ex: Disponível, Alocado)',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('substitutos');
  }
};