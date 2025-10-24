// src/features/jobs/jobs.service.js

const { Ferias, Afastamento } = require('../../models');
const { Op } = require('sequelize');
const { differenceInDays, addDays, startOfDay } = require('date-fns');

/**
 * Verifica férias futuras que entram em conflito com afastamentos longos
 * e as cancela automaticamente.
 * 
 * Regra de Negócio (PDF, Item 2.b):
 * Exclui automaticamente da programação de férias os colaboradores cujo afastamento
 * coincide com a data inicial do gozo das férias, se o afastamento for superior a 15 dias.
 */
const verificarConflitosDeAfastamento = async () => {
    console.log(`[JOB] Iniciando verificação de conflitos entre férias e afastamentos...`);

    const hoje = startOfDay(new Date());
    const dataLimiteBusca = addDays(hoje, 30); // Analisa férias que começam nos próximos 30 dias

    // 1. Encontrar todas as férias futuras (Planejadas ou Confirmadas)
    const feriasFuturas = await Ferias.findAll({
        where: {
            status: { [Op.in]: ['Planejada', 'Confirmada'] },
            data_inicio: {
                [Op.between]: [hoje, dataLimiteBusca]
            }
        },
        include: [{
            model: Afastamento,
            as: 'Funcionario.historicoAfastamentos', // Inclui o histórico de afastamentos do funcionário associado
            required: false // LEFT JOIN
        }]
    });

    if (feriasFuturas.length === 0) {
        console.log('[JOB] Nenhuma férias futura encontrada para verificação.');
        return { message: 'Nenhuma férias futura encontrada para verificação.', feriasCanceladas: 0 };
    }

    const feriasParaCancelar = [];
    let countConflitos = 0;

    // 2. Iterar sobre cada período de férias encontrado
    for (const ferias of feriasFuturas) {
        const dataInicioFerias = new Date(ferias.data_inicio);
        const afastamentosDoFuncionario = ferias.Funcionario?.historicoAfastamentos || [];

        // 3. Verificar se algum afastamento ativo conflita com o início das férias
        for (const afastamento of afastamentosDoFuncionario) {
            const dataInicioAfastamento = new Date(afastamento.data_inicio);
            // Se a data fim for nula, o afastamento está em aberto
            const dataFimAfastamento = afastamento.data_fim ? new Date(afastamento.data_fim) : new Date('9999-12-31');

            // Verifica se a data de início das férias está DENTRO do período de afastamento
            if (dataInicioFerias >= dataInicioAfastamento && dataInicioFerias <= dataFimAfastamento) {
                
                // Calcula a duração do afastamento
                const duracaoAfastamento = differenceInDays(dataFimAfastamento, dataInicioAfastamento);

                // 4. Se a duração for maior que 15 dias, marca para cancelar
                if (duracaoAfastamento > 15) {
                    feriasParaCancelar.push(ferias.id);
                    countConflitos++;
                    console.log(`[JOB] CONFLITO ENCONTRADO: Férias ID ${ferias.id} do funcionário ${ferias.matricula_funcionario} será cancelada devido a afastamento de ${duracaoAfastamento} dias.`);
                    
                    // Sai do loop interno, pois já encontramos um conflito válido
                    break; 
                }
            }
        }
    }

    // 5. Se houver férias para cancelar, atualiza o status delas no banco
    if (feriasParaCancelar.length > 0) {
        await Ferias.update(
            { 
                status: 'Cancelada',
                observacao: `Cancelado automaticamente em ${new Date().toLocaleDateString('pt-BR')} devido a conflito com afastamento superior a 15 dias.`
            },
            {
                where: {
                    id: { [Op.in]: feriasParaCancelar }
                }
            }
        );
    }
    
    console.log(`[JOB] Verificação concluída. ${countConflitos} férias foram canceladas.`);
    return {
        message: `Verificação concluída. ${countConflitos} férias foram canceladas por conflito com afastamento.`,
        feriasCanceladas: countConflitos,
        idsCancelados: feriasParaCancelar
    };
};

module.exports = {
    verificarConflitosDeAfastamento
};