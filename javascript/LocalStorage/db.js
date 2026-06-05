/**
 * db.js - Camada Estrita de Persistência no LocalStorage
 */
const DB = {
    KEYS: {
        CATALOGO: 'catalogo_itens_v6',
        MOVIMENTACOES: 'hist_movimentos_v6',
        CONTAGENS: 'contagens_corte_v6'
    },

    getCatalogo() {
        return JSON.parse(localStorage.getItem(this.KEYS.CATALOGO)) || [];
    },

    saveCatalogoItem(item) {
        const catalogo = this.getCatalogo();
        catalogo.push(item);
        localStorage.setItem(this.KEYS.CATALOGO, JSON.stringify(catalogo));
    },

    deleteCatalogoItem(codigo) {
        let catalogo = this.getCatalogo();
        catalogo = catalogo.filter(i => i.codigo !== codigo);
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

    clearCatalogo() { localStorage.removeItem(this.KEYS.CATALOGO); },
    clearContagens() { localStorage.removeItem(this.KEYS.CONTAGENS); }
};