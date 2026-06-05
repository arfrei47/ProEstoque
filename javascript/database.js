/**
 * database.js - Abstração estável do LocalStorage
 */
const DB = {
    getCatalogo: () => JSON.parse(localStorage.getItem('wms_catalogo') || '[]'),
    saveCatalogoItem: (item) => {
        const cat = DB.getCatalogo();
        cat.push(item);
        localStorage.setItem('wms_catalogo', JSON.stringify(cat));
    },
    deleteCatalogoItem: (codigo) => {
        const cat = DB.getCatalogo().filter(i => i.codigo !== codigo);
        localStorage.setItem('wms_catalogo', JSON.stringify(cat));
    },
    clearCatalogo: () => localStorage.removeItem('wms_catalogo'),

    getMovimentacoes: () => JSON.parse(localStorage.getItem('wms_movimentacoes') || '[]'),
    saveMovimentacao: (mov) => {
        const movs = DB.getMovimentacoes();
        movs.push(mov);
        localStorage.setItem('wms_movimentacoes', JSON.stringify(movs));
    },

    getContagens: () => JSON.parse(localStorage.getItem('wms_contagens') || '{}'),
    saveCorte: (insumo, payload) => {
        const c = DB.getContagens();
        c[insumo] = payload;
        localStorage.setItem('wms_contagens', JSON.stringify(c));
    },
    clearContagens: () => localStorage.removeItem('wms_contagens')
};