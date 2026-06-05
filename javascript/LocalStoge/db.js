/**
 * db.js - Camada Estendida de Persistência Abstrata (LocalStorage)
 */
const DB = {
    KEYS: {
        CATALOGO: 'catalogo_itens',
        MOVIMENTACOES: 'hist_movimentos',
        CONTAGENS: 'contagens_corte'
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
        dados[insumo] = payload; // Salva objeto contendo quantidade e data da validação
        localStorage.setItem(this.KEYS.CONTAGENS, JSON.stringify(dados));
    },

    clearAll() {
        localStorage.removeItem(this.KEYS.CATALOGO);
        localStorage.removeItem(this.KEYS.MOVIMENTACOES);
        localStorage.removeItem(this.KEYS.CONTAGENS);
    }
};