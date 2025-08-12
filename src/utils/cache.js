// src/utils/cache.js
const cache = new Map();

/**
 * Define um valor no cache com um tempo de expiração.
 * @param {string} key - A chave para o item do cache.
 * @param {*} value - O valor a ser armazenado.
 * @param {number} ttl - Tempo de vida em milissegundos.
 */
function set(key, value, ttl) {
    const expires = Date.now() + ttl;
    cache.set(key, { value, expires });
}

/**
 * Obtém um valor do cache. Retorna null se expirado ou não encontrado.
 * @param {string} key - A chave do item.
 * @returns {*} O valor armazenado ou null.
 */
function get(key) {
    const item = cache.get(key);
    if (!item) {
        return null;
    }
    if (Date.now() > item.expires) {
        cache.delete(key); // Limpa o item expirado
        return null;
    }
    return item.value;
}

/**
 * Limpa o cache inteiro ou uma chave específica.
 * @param {string} [key] - A chave a ser invalidada. Se omitida, limpa todo o cache.
 */
function clear(key) {
    if (key) {
        cache.delete(key);
    } else {
        cache.clear();
    }
}

module.exports = { set, get, clear };