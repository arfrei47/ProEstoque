/**
 * script.js - Inteligência Otimizada e Segura para Todos os Perfis
 */
document.addEventListener('DOMContentLoaded', () => {
    const perfilAtivo = sessionStorage.getItem('perfil_ativo');
    if (!perfilAtivo) { window.location.href = 'index.html'; return; }

    // Mapeamento global de perfis utilizado no cabeçalho, feed e logs de banco
    const mapaNomes = { 
        'administrador': '🔑 Administrador', 
        'apontador': '🎯 Apontador', 
        'operacao': '🔧 Operação' 
    };
    
    document.getElementById('label-perfil').textContent = mapaNomes[perfilAtivo] || 'Usuário';
    if (perfilAtivo === 'administrador') document.body.classList.add('is-admin');

    let fluxoAtivo = 'corte';
    let uidParaExcluir = null; 

    const sanitize = str => String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);

    const tabButtons = document.querySelectorAll('.tab-btn');
    const formPanels = document.querySelectorAll('.form-panel');
    const painelDireitoTitulo = document.getElementById('titulo-painel-direito');
    const views = {
        'corte': document.getElementById('container-tabela-corte'),
        'requisicao': document.getElementById('container-tabela-geral'),
        'descarte': document.getElementById('container-tabela-geral'),
        'retorno': document.getElementById('container-tabela-geral'),
        'cadastro': document.getElementById('container-tabela-catalogo')
    };

    // Monta o feed operacional unificado e suavizado para todos os perfis logados
    function montarFeedOperacional() {
        const pista1 = document.getElementById('feed-pista-1');
        const pista2 = document.getElementById('feed-pista-2');
        if (!pista1 || !pista2) return;

        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        const diaSemana = hoje.getDay(); 

        // Descobre os dias restantes até a próxima Terça (Dia 2 da semana)
        let diasFaltando = (2 - diaSemana + 7) % 7;
        const proximaTerca = new Date(hoje);
        proximaTerca.setDate(hoje.getDate() + diasFaltando);

        let informeContagem = '';
        if (diasFaltando === 0) {
            informeContagem = `🚨 [INVENTÁRIO ROTATIVO]: Ciclo ativo hoje (${proximaTerca.toLocaleDateString('pt-BR')}). Realize a aferição física e lance os dados de corte de estoque.`;
        } else {
            informeContagem = `📢 [PROGRAMAÇÃO DE ROTINA]: Inventário Geral agendado para todas as Terças-feiras. Próxima conferência: ${proximaTerca.toLocaleDateString('pt-BR')} (Faltam ${diasFaltando} dias).`;
        }

        // Nome amigável do perfil atual para contextualizar a mensagem do banner superior
        const nomeExibicaoPerfil = mapaNomes[perfilAtivo] || 'Usuário';

        // Bloco estrutural com dados em formato feed corporativo puro
        const stringEstrutural = `${informeContagem}  •  👤 [PERFIL]: Conectado como ${nomeExibicaoPerfil}  •  📦 [SISTEMA]: Terminais Logísticos Operando em Regime Normal  •  🔒 [SEGURANÇA]: Uso de EPIs obrigatório nas áreas de docas e paletização.  •  `;

        // Repetimos o bloco 3 vezes para garantir extensão massiva horizontal em monitores UltraWide/4K
        const blocoSeguroTotal = stringEstrutural.repeat(3);

        pista1.textContent = blocoSeguroTotal;
        pista2.textContent = blocoSeguroTotal;
    }

    document.getElementById('btn-sair-terminal').addEventListener('click', () => {
        sessionStorage.clear(); window.location.href = 'index.html';
    });

    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            fluxoAtivo = e.target.getAttribute('data-fluxo');
            
            tabButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            formPanels.forEach(p => p.classList.remove('active'));
            document.getElementById(`panel-${fluxoAtivo}`).classList.add('active');

            Object.values(views).forEach(v => v.style.display = 'none');
            views[fluxoAtivo].style.display = "block";

            const titulos = {
                'cadastro': 'Catálogo de Insumos',
                'corte': '⚖️ Conciliação e Divergência',
                'default': 'Histórico de Movimentações (Últimos 10)'
            };
            painelDireitoTitulo.textContent = titulos[fluxoAtivo] || titulos['default'];

            if(fluxoAtivo === 'cadastro') renderizarCatalogo();
            else if(fluxoAtivo === 'corte') renderizarCorte();
            else renderizarHistorico();
        });
    });

    function renderizarDropdowns() {
        const itens = DB.getCatalogo();
        const options = itens.length === 0 
            ? '<option value="" disabled selected>Catálogo Vazio</option>' 
            : '<option value="" disabled selected>Selecione um insumo...</option>' + 
              itens.map(i => `<option value="${sanitize(i.item)}">${sanitize(i.codigo)} - ${sanitize(i.item)}</option>`).join('');
        
        ['req-insumo', 'des-insumo', 'ret-insumo', 'corte-insumo'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.innerHTML = options;
        });
    }

    function renderizarCatalogo() {
        const itens = DB.getCatalogo();
        const html = itens.map(i => `
            <tr>
                <td>${sanitize(i.dataCad)}</td><td>${sanitize(i.codigo)}</td>
                <td><strong>${sanitize(i.item)}</strong></td><td>${i.caixa}</td>
                <td>${i.palete}</td><td>${sanitize(i.fornecedor)}</td>
                <td class="admin-only" data-html2canvas-ignore>
                    <button type="button" class="btn-delete-row" data-uid="${i.uid}" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Excluir este item">🗑️</button>
                </td>
            </tr>`).join('');
        document.getElementById('corpo-catalogo').innerHTML = html || `<tr><td colspan="7" style="text-align:center;">Catálogo vazio.</td></tr>`;
        renderizarDropdowns();
    }

    function renderizarHistorico() {
        const html = [...DB.getMovimentacoes()].reverse().slice(0, 10).map(m => `
            <tr>
                <td>${sanitize(m.data)}</td><td><strong>${sanitize(m.insumo)}</strong></td>
                <td>${sanitize(m.tipo)}</td><td>${m.quantidade}</td>
                <td><span style="color:var(--primary); font-weight:600;">${sanitize(m.perfil)}</span></td>
            </tr>`).join('');
        document.getElementById('corpo-movimentacoes').innerHTML = html || `<tr><td colspan="5" style="text-align:center;">Sem registros de movimentação.</td></tr>`;
    }

    function renderizarCorte() {
        const movimentos = DB.getMovimentacoes();
        const contagens = DB.getContagens();
        const todosInsumos = [...new Set([...DB.getCatalogo().map(i => i.item)])].filter(Boolean);

        const html = todosInsumos.map(insumo => {
            const saldoLogico = movimentos.reduce((acc, m) => {
                if (m.insumo !== insumo) return acc;
                if(m.tipo === 'REQUISIÇÃO') return acc + m.quantidade;
                if(m.tipo === 'RETORNO' || m.tipo === 'DESCARTE') return acc - m.quantidade;
                return acc;
            }, 0);

            const p = contagens[insumo];
            if (p) {
                const divVal = p.quantidade - saldoLogico;
                const statusStr = divVal === 0 ? "✅ OK" : (divVal > 0 ? "⚠️ Sobra" : "🚨 Falta");
                const rowClass = divVal === 0 ? "row-ok" : "row-divergent";
                return `<tr class="${rowClass}">
                    <td>${sanitize(p.dataValidacao)}</td><td><strong>${sanitize(insumo)}</strong></td>
                    <td>${saldoLogico}</td><td>${p.quantidade}</td>
                    <td>${divVal > 0 ? '+' + divVal : divVal}</td><td>${statusStr}</td>
                </tr>`;
            }
            return `<tr><td>-</td><td><strong>${sanitize(insumo)}</strong></td><td>${saldoLogico}</td><td>Pendente</td><td>-</td><td>-</td></tr>`;
        }).join('');

        document.getElementById('corpo-corte').innerHTML = html || `<tr><td colspan="6" style="text-align:center;">Cadastre itens para habilitar a tela de balanço.</td></tr>`;
    }

    function lançar(e, formId, selectId, operacao) {
        e.preventDefault();
        const insumo = document.getElementById(selectId).value;
        const qtd = parseFloat(document.querySelector(`#${formId} .input-qtd`).value);
        if(!insumo) return alert("Selecione o insumo!");

        DB.saveMovimentacao({ data: DB.getFormattedDate(), insumo, tipo: operacao, quantidade: qtd, perfil: mapaNomes[perfilAtivo] });
        e.target.reset(); renderizarHistorico(); renderizarCorte(); alert(`${operacao} registrada com sucesso!`);
    }

    document.getElementById('form-requisicao').addEventListener('submit', e => lançar(e, 'form-requisicao', 'req-insumo', 'REQUISIÇÃO'));
    document.getElementById('form-descarte').addEventListener('submit', e => lançar(e, 'form-descarte', 'des-insumo', 'DESCARTE'));
    document.getElementById('form-retorno').addEventListener('submit', e => lançar(e, 'form-retorno', 'ret-insumo', 'RETORNO'));

    document.getElementById('form-cadastro').addEventListener('submit', (e) => {
        e.preventDefault();
        DB.saveCatalogoItem({
            dataCad: DB.getFormattedDate(),
            codigo: document.getElementById('cad-codigo').value.trim(),
            item: document.getElementById('cad-item').value.trim(),
            caixa: parseInt(document.getElementById('cad-caixa').value),
            palete: parseInt(document.getElementById('cad-palete').value),
            fornecedor: document.getElementById('cad-fornecedor').value.trim()
        });
        e.target.reset(); renderizarCatalogo(); alert('Item adicionado com sucesso!');
    });

    document.getElementById('form-corte').addEventListener('submit', (e) => {
        e.preventDefault();
        const insumo = document.getElementById('corte-insumo').value;
        const qtd = parseFloat(document.getElementById('corte-qtd').value);
        if(!insumo) return alert("Insumo inválido.");
        DB.saveCorte(insumo, { quantidade: qtd, dataValidacao: DB.getFormattedDate(), responsavel: mapaNomes[perfilAtivo] });
        e.target.reset(); renderizarCorte(); alert('Contagem física processada!');
    });

    document.getElementById('form-exportar').addEventListener('submit', (e) => {
        e.preventDefault();
        const formato = document.querySelector('input[name="formato-doc"]:checked').value;
        
        const mapTabelas = {
            'cadastro': document.getElementById('tabela-export-catalogo'),
            'corte': document.getElementById('tabela-export-corte'),
            'default': document.getElementById('tabela-export-geral')
        };
        const tabela = mapTabelas[fluxoAtivo] || mapTabelas['default'];
        const nomeArquivo = `Relatorio_WMS_${fluxoAtivo}_${Date.now()}`;

        if (formato === 'EXCEL') {
            const wb = XLSX.utils.table_to_book(tabela, {sheet: "Dados Consolidados"});
            XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
        } else {
            const opt = {
                margin: 10, filename: `${nomeArquivo}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true }, 
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };
            html2pdf().set(opt).from(tabela).save();
        }
    });

    document.addEventListener('click', (e) => {
        const btnDelete = e.target.closest('.btn-delete-row');
        if (btnDelete) {
            if (perfilAtivo !== 'administrador') return alert('Permissão exclusiva de Administradores.');
            uidParaExcluir = btnDelete.getAttribute('data-uid'); 
            document.getElementById('modal-alerta').classList.add('active');
        }
    });

    document.getElementById('btn-modal-confirm').addEventListener('click', () => {
        if (uidParaExcluir) {
            DB.deleteCatalogoItem(uidParaExcluir);
            renderizarCatalogo();
            renderizarCorte();
        }
        document.getElementById('modal-alerta').classList.remove('active');
        uidParaExcluir = null;
    });
    
    document.getElementById('btn-modal-cancel').addEventListener('click', () => { 
        document.getElementById('modal-alerta').classList.remove('active'); 
        uidParaExcluir = null;
    });

    // Inicialização unificada das Views e do Feed Multi-Perfil
    montarFeedOperacional();
    renderizarCorte();
    renderizarDropdowns();
});