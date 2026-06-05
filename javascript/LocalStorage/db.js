const DB = {
    KEYS:{
        CATALOGO:'catalogo_itens_v6',
        MOVIMENTACOES:'hist_movimentos_v6',
        CONTAGENS:'contagens_corte_v6'
    },

    getCatalogo(){return JSON.parse(localStorage.getItem(this.KEYS.CATALOGO))||[];},
    saveCatalogoItem(item){const c=this.getCatalogo();c.push(item);localStorage.setItem(this.KEYS.CATALOGO,JSON.stringify(c));},
    deleteCatalogoItem(codigo){let c=this.getCatalogo();c=c.filter(i=>i.codigo!==codigo);localStorage.setItem(this.KEYS.CATALOGO,JSON.stringify(c));},

    getMovimentacoes(){return JSON.parse(localStorage.getItem(this.KEYS.MOVIMENTACOES))||[];},
    saveMovimentacao(mov){const d=this.getMovimentacoes();d.push(mov);localStorage.setItem(this.KEYS.MOVIMENTACOES,JSON.stringify(d));},

    getContagens(){return JSON.parse(localStorage.getItem(this.KEYS.CONTAGENS))||{};},
    saveCorte(insumo,payload){const c=this.getContagens();c[insumo]=payload;localStorage.setItem(this.KEYS.CONTAGENS,JSON.stringify(c));},

    clearCatalogo(){localStorage.removeItem(this.KEYS.CATALOGO);},
    clearContagens(){localStorage.removeItem(this.KEYS.CONTAGENS);}
};