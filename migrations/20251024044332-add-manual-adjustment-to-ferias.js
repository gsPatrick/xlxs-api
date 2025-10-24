'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * A migration precisa ser transacional para garantir a integridade.
     * Se qualquer uma das operações falhar, todas serão revertidas.
     */
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Adiciona a nova coluna 'ajuste_manual' à tabela 'ferias'.
      await queryInterface.addColumn('ferias', 'ajuste_manual', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indica se este registro foi criado ou alterado manualmente pelo usuário.'
      }, { transaction });

      // Altera a coluna 'necessidade_substituicao' para mudar seu valor padrão.
      await queryInterface.changeColumn('ferias', 'necessidade_substituicao', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true, // O novo valor padrão
        comment: 'Indica se o funcionário precisa de um substituto durante as férias.'
      }, { transaction });

      // Finaliza a transação com sucesso.
      await transaction.commit();
    } catch (err) {
      // Se ocorrer um erro, reverte todas as alterações.
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * A função 'down' reverte as alterações feitas pela 'up'.
     * É importante para poder desfazer uma migração caso seja necessário.
     */
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Remove a coluna 'ajuste_manual' que foi adicionada.
      await queryInterface.removeColumn('ferias', 'ajuste_manual', { transaction });

      // Reverte a alteração na coluna 'necessidade_substituicao', voltando o padrão para 'false'.
      await queryInterface.changeColumn('ferias', 'necessidade_substituicao', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false, // O valor padrão original
        comment: 'Indica se o funcionário precisa de um substituto durante as férias.'
      }, { transaction });

      // Finaliza a transação com sucesso.
      await transaction.commit();
    } catch (err) {
      // Se ocorrer um erro, reverte todas as alterações.
      await transaction.rollback();
      throw err;
    }
  }
};