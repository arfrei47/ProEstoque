/**
 * db.js - Camada de Persistência Abstrata LocalStorage
 */
const DB = {
    KEYS: {
        CATALOGO: 'catalogo_itens_v5',
        MOVIMENTACOES: 'hist_movimentos_v5',
        CONTAGENS: 'contagens_corte_v5'
    },

    getCatalogo() {
        return JSON.parse(localStorage.getItem(this.KEYS.CATALOGO)) || [];
    },

    saveCatalogoItem(item) {
        const catalogo = this.getCatalogo();
        catalogo.push(item);
        localStorage.setItem(this.KEYS.CATALOGO, JSON.stringify(catalogo));
    },

    getMovimentacoes() {
        return JSON.parse(localStorage.getItem(this.KEYS.MOVIMENTACOES)) || [];
    },

    saveMovimentacao(movimentacao) {
        const dados = this.getMovimentacoes();
        dados.push(movimentacao);
        localStorage.setItem(this.KEYS.MOVIMENTACOES, JSON.stringify(dados));
    },

    getContagens() {
        return JSON.parse(localStorage.getItem(this.KEYS.CONTAGENS)) || {};
    },

    saveCorte(insumo, payload) {
        const dados = this.getContagens();
        dados[insumo] = payload;
        localStorage.setItem(this.KEYS.CONTAGENS, JSON.stringify(dados));
    },

    hasAnyData() {
        return this.getCatalogo().length > 0 || this.getMovimentacoes().length > 0;
    },

    clearAll() {
        localStorage.removeItem(this.KEYS.CATALOGO);
        localStorage.removeItem(this.KEYS.MOVIMENTACOES);
        localStorage.removeItem(this.KEYS.CONTAGENS);
    }
};