/**
 * database.js - Gerenciamento de Persistência com Proteção Estrita por UID
 */
const DB = {
    getFormattedDate: () => {
        const now = new Date();
        return `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;
    },

    generateUID: () => {
        return typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    _safeParse: (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; } 
        catch (e) { console.error(`Erro BD [${key}]:`, e); return fallback; }
    },
    
    getCatalogo: () => DB._safeParse('wms_catalogo', []),
    saveCatalogoItem: (item) => {
        const cat = DB.getCatalogo();
        item.uid = DB.generateUID(); 
        cat.push(item);
        localStorage.setItem('wms_catalogo', JSON.stringify(cat));
    },
    deleteCatalogoItem: (uid) => {
        const cat = DB.getCatalogo().filter(i => i.uid !== uid);
        localStorage.setItem('wms_catalogo', JSON.stringify(cat));
    },

    getMovimentacoes: () => DB._safeParse('wms_movimentacoes', []),
    saveMovimentacao: (mov) => {
        const movs = DB.getMovimentacoes();
        movs.push(mov);
        localStorage.setItem('wms_movimentacoes', JSON.stringify(movs));
    },

    getContagens: () => DB._safeParse('wms_contagens', {}),
    saveCorte: (insumo, payload) => {
        const c = DB.getContagens();
        c[insumo] = payload;
        localStorage.setItem('wms_contagens', JSON.stringify(c));
    }
};