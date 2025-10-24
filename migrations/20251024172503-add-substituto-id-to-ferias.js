'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ferias', 'substituto_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'substitutos', // Nome da tabela de substitutos
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL', // Se o substituto for removido, a vaga fica "em aberto"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ferias', 'substituto_id');
  }
};