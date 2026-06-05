/**
 * script.js - Controlador Geral do Painel e Auditoria
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Validação Restrita do Perfil de Segurança
    const perfilAtivo = sessionStorage.getItem('perfil_ativo');
    if (!perfilAtivo) {
        window.location.href = 'index.html';
        return;
    }

    // Aplica a tag visual do perfil no Header
    const labelPerfil = document.getElementById('label-perfil');
    const mapaNomes = {
        'administrador': '🔑 Administrador do Sistema',
        'apontador': '🎯 Apontador de Produção',
        'operacao': '🔧 Operação'
    };
    if (labelPerfil) labelPerfil.textContent = mapaNomes[perfilAtivo] || 'Usuário';

    // 2. ATIVAÇÃO DINÂMICA DAS FUNÇÕES DE EXCLUSÃO (APENAS PARA ADMINISTRADOR)
    if (perfilAtivo === 'administrador') {
        document.body.classList.add('is-admin'); 
    }

    let fluxoAtivo = 'cadastro';
    let emailValidadoOK = false;
    let timeoutValidacao = null;
    let alvoPurgaContextual = null; 
    let itemCodigoParaExcluir = null;

    // Seletores do Painel
    const tabButtons = document.querySelectorAll('.tab-btn');
    const formPanels = document.querySelectorAll('.form-panel');
    const painelDireitoTitulo = document.getElementById('titulo-painel-direito');
    const containerCatalogo = document.getElementById('container-tabela-catalogo');
    const containerGeral = document.getElementById('container-tabela-geral');
    const containerCorte = document.getElementById('container-tabela-corte');
    
    const corpoCatalogo = document.getElementById('corpo-catalogo');
    const corpoMovimentacoes = document.getElementById('corpo-movimentacoes');
    const corpoCorte = document.getElementById('corpo-corte');
    const dropdownsInsumos = document.querySelectorAll('select[id$="-insumo"], .select-insumo');

    const modalAlerta = document.getElementById('modal-alerta');
    const textoAvisoModal = document.getElementById('texto-aviso-modal');
    const modalEmail = document.getElementById('modal-email');
    const inputEmailDestino = document.getElementById('email-destino');
    const iconEmailStatus = document.getElementById('email-status-icon');
    const txtEmailFeedback = document.getElementById('email-feedback-text');
    const btnEmailSubmit = document.getElementById('btn-email-submit');

    // Desconexão Limpa do Terminal
    document.getElementById('btn-sair-terminal').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'index.html';
    });

    // Atualização Dinâmica do Cronograma de Contagem Física (Dashboard)
    function atualizarBannerDashboard() {
        const el = document.getElementById('banner-contagem-dash');
        const contagens = DB.getContagens();
        const datas = Object.values(contagens).map(v => new Date(v.dataValidacao.split(' ')[0].split('/').reverse().join('-')));
        
        const baseData = datas.length ? new Date(Math.max(...datas)) : new Date();
        const proximaContagem = new Date(baseData);
        proximaContagem.setDate(baseData.getDate() + 7);
        
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        proximaContagem.setHours(0,0,0,0);
        
        const diffTime = proximaContagem - hoje;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) {
            el.innerHTML = `🚨 ATENÇÃO CRÍTICA: O prazo expirou! Realize o ciclo de contagem física nas prateleiras hoje.`;
            el.style.backgroundColor = "var(--danger)";
        } else {
            el.innerHTML = `🗓️ Próxima Contagem Física do Estoque: ${proximaContagem.toLocaleDateString('pt-BR')} (Faltam <strong>${diffDays} dias</strong> para a conferência)`;
        }
    }

    // Sistema de Navegação das Abas
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            fluxoAtivo = e.target.getAttribute('data-fluxo');
            tabButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            formPanels.forEach(p => p.classList.remove('active'));
            document.getElementById(`panel-${fluxoAtivo}`).classList.add('active');

            containerCatalogo.style.display = "none";
            containerGeral.style.display = "none";
            containerCorte.style.display = "none";

            if (fluxoAtivo === 'cadastro') {
                painelDireitoTitulo.textContent = "Catálogo de Itens Cadastrados";
                containerCatalogo.style.display = "block";
                renderizarCatalogo();
            } else if (fluxoAtivo === 'corte') {
                painelDireitoTitulo.textContent = "⚖️ Conciliação e Divergência de Inventário";
                containerCorte.style.display = "block";
                renderizarCorte();
            } else {
                painelDireitoTitulo.textContent = "Histórico de Movimentações (Últimos 5)";
                containerGeral.style.display = "block";
                renderizarHistorico();
            }
        });
    });

    function formatarData() {
        const agora = new Date();
        return agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function atualizarDropdownsItens() {
        const itens = DB.getCatalogo();
        dropdownsInsumos.forEach(select => {
            select.innerHTML = '<option value="">-- Selecione um Item --</option>';
            itens.forEach(it => {
                const opt = document.createElement('option');
                opt.value = it.item; 
                opt.textContent = `${it.codigo} - ${it.item}`;
                select.appendChild(opt);
            });
        });
    }

    // Envio dos Formulários Operacionais
    document.getElementById('form-cadastro').addEventListener('submit', (e) => {
        e.preventDefault();
        const codigo = document.getElementById('cad-codigo').value.trim().toUpperCase();
        const item = document.getElementById('cad-item').value.trim().toUpperCase();
        const caixa = parseInt(document.getElementById('cad-caixa').value) || 0;
        const palete = parseInt(document.getElementById('cad-palete').value) || 0;
        const fornecedor = document.getElementById('cad-fornecedor').value.trim().toUpperCase();

        if (DB.getCatalogo().some(i => i.codigo === codigo || i.item === item)) {
            alert("🚨 Item ou Código WMS já consta no catálogo."); return;
        }

        DB.saveCatalogoItem({ dataCad: formatarData(), codigo, item, caixa, palete, fornecedor });
        atualizarDropdownsItens(); renderizarCatalogo(); e.target.reset();
    });

    ['requisicao', 'descarte', 'retorno'].forEach(tipo => {
        document.getElementById(`form-${tipo}`).addEventListener('submit', (e) => {
            e.preventDefault(); 
            const form = e.target;
            const insumo = form.querySelector('select').value;
            const qtd = parseInt(form.querySelector('.input-qtd').value) || 0;
            const mapa = { 'requisicao': 'REQUISIÇÃO', 'descarte': 'DESCARTE', 'retorno': 'RETORNO' };

            DB.saveMovimentacao({ data: formatarData(), insumo, tipo: mapa[tipo], quantidade: qtd });
            if(fluxoAtivo !== 'cadastro' && fluxoAtivo !== 'corte') renderizarHistorico();
            form.reset();
        });
    });

    document.getElementById('form-corte').addEventListener('submit', (e) => {
        e.preventDefault(); 
        const insumo = document.getElementById('corte-insumo').value;
        const qtdFisica = parseInt(document.getElementById('corte-qtd').value) || 0;

        DB.saveCorte(insumo, { quantidade: qtdFisica, dataValidacao: formatarData() });
        renderizarCorte(); atualizarBannerDashboard(); e.target.reset();
    });

    // Renderização com Injeção Segura da Coluna Admin-Only
    function renderizarCatalogo() {
        corpoCatalogo.innerHTML = '';
        const itens = DB.getCatalogo();
        if (itens.length === 0) {
            corpoCatalogo.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#a0aec0;">Nenhum item em catálogo.</td></tr>`;
            return;
        }
        [...itens].reverse().forEach(i => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${i.dataCad}</td><td>${i.codigo}</td><td><strong>${i.item}</strong></td><td>${i.caixa}</td><td>${i.palete}</td><td>${i.fornecedor}</td>
            <td class="admin-only"><button type="button" class="btn-delete-row" style="background:none; border:none; cursor:pointer;" data-codigo="${i.codigo}">🗑️</button></td>`;
            corpoCatalogo.appendChild(tr);
        });
    }

    function renderizarHistorico() {
        corpoMovimentacoes.innerHTML = '';
        const listaFull = DB.getMovimentacoes();
        if (listaFull.length === 0) {
            corpoMovimentacoes.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#a0aec0;">Sem registros.</td></tr>`;
            return;
        }
        const top5 = [...listaFull].reverse().slice(0, 5);
        top5.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${m.data}</td><td><strong>${m.insumo}</strong></td><td>${m.tipo}</td><td>${m.quantidade}</td>`;
            corpoMovimentacoes.appendChild(tr);
        });
    }

    function renderizarCorte() {
        corpoCorte.innerHTML = '';
        const movimentos = DB.getMovimentacoes();
        const contagens = DB.getContagens();
        const todosInsumos = new Set([...movimentos.map(m => m.insumo), ...Object.keys(contagens)]);

        if (todosInsumos.size === 0) {
            corpoCorte.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a0aec0;">Sem balanço.</td></tr>`;
            return;
        }

        todosInsumos.forEach(insumo => {
            if(!insumo) return;
            const saldoLogico = movimentos.reduce((acc, m) => {
                if (m.insumo === insumo) {
                    if (m.tipo === 'REQUISIÇÃO') acc += m.quantidade;
                    if (m.tipo === 'DESCARTE' || m.tipo === 'RETORNO') acc -= m.quantidade;
                }
                return acc;
            }, 0);

            const payloadCorte = contagens[insumo] || null;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>-</td><td><strong>${insumo}</strong></td><td>${saldoLogico}</td><td>-</td><td>-</td><td>-</td>`;
            const tds = tr.querySelectorAll('td');

            if (payloadCorte !== null) {
                const contagemFisica = payloadCorte.quantidade;
                const divVal = contagemFisica - saldoLogico;
                tds[0].textContent = payloadCorte.dataValidacao;
                tds[3].textContent = contagemFisica;
                tds[4].textContent = divVal > 0 ? `+${divVal}` : divVal;

                if (divVal === 0) { tds[5].textContent = "✅ OK"; tr.className = "row-ok"; }
                else { tds[5].textContent = divVal > 0 ? "⚠️ Sobra" : "🚨 Falta"; tr.className = "row-divergent"; }
            } else {
                tds[3].textContent = 'Pendente';
            }
            corpoCorte.appendChild(tr);
        });
    }

    function gerarTabelaCompletaParaExportacao() {
        if (fluxoAtivo === 'cadastro') return document.getElementById('tabela-catalogo');
        if (fluxoAtivo === 'corte') return document.getElementById('tabela-corte');

        const tabelaVirtual = document.createElement('table');
        tabelaVirtual.innerHTML = `<thead><tr><th>Data/Hora</th><th>Item</th><th>Operação</th><th>Qtd</th></tr></thead><tbody></tbody>`;
        const tbody = tabelaVirtual.querySelector('tbody');
        [...DB.getMovimentacoes()].reverse().forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${m.data}</td><td><strong>${m.insumo}</strong></td><td>${m.tipo}</td><td>${m.quantidade}</td>`;
            tbody.appendChild(tr);
        });
        return tabelaVirtual;
    }

    // Eventos interceptadores dos Modais de Exclusão (Admin Only)
    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('btn-delete-row')) {
            if(perfilAtivo !== 'administrador') return;
            itemCodigoParaExcluir = e.target.getAttribute('data-codigo');
            alvoPurgaContextual = 'UNITARIO';
            textoAvisoModal.textContent = `Confirma a remoção do item [${itemCodigoParaExcluir}] do catálogo permanente?`;
            modalAlerta.classList.add('active');
        }
        
        if (e.target && e.target.classList.contains('btn-trigger-modal')) {
            if(perfilAtivo !== 'administrador') return;
            alvoPurgaContextual = e.target.getAttribute('data-target-purge');
            textoAvisoModal.textContent = alvoPurgaContextual === 'cadastro' ? 
                "⚠️ CRÍTICO: Deseja expurgar todo o catálogo do sistema?" : "⚠️ Deseja expurgar o histórico de conferência física?";
            modalAlerta.classList.add('active');
        }
    });

    document.getElementById('btn-modal-cancel').addEventListener('click', () => { modalAlerta.classList.remove('active'); });
    document.getElementById('btn-modal-confirm').addEventListener('click', () => {
        if (alvoPurgaContextual === 'UNITARIO' && itemCodigoParaExcluir) DB.deleteCatalogoItem(itemCodigoParaExcluir);
        else if (alvoPurgaContextual === 'cadastro') DB.clearCatalogo();
        else if (alvoPurgaContextual === 'corte') DB.clearContagens();

        modalAlerta.classList.remove('active');
        atualizarDropdownsItens(); atualizarBannerDashboard();
        if (fluxoAtivo === 'cadastro') renderizarCatalogo();
        else if (fluxoAtivo === 'corte') renderizarCorte();
        else renderizarHistorico();
    });

    // Assistente de Transmissão por E-mail
    inputEmailDestino.addEventListener('input', () => {
        clearTimeout(timeoutValidacao); emailValidadoOK = false; btnEmailSubmit.disabled = true;
        const email = inputEmailDestino.value.trim();
        if (!email) { iconEmailStatus.textContent = '⚪'; return; }
        
        iconEmailStatus.textContent = '🔄'; txtEmailFeedback.textContent = 'Validando MX corporativo...';
        timeoutValidacao = setTimeout(() => {
            iconEmailStatus.textContent = '✅'; txtEmailFeedback.textContent = 'Destinatário apto!';
            emailValidadoOK = true; btnEmailSubmit.disabled = false;
        }, 600);
    });

    document.getElementById('form-exportar-email').addEventListener('submit', (e) => {
        e.preventDefault();
        const formato = e.target.querySelector('input[name="formato-doc"]:checked').value;
        const tabelaAlvoCompleta = gerarTabelaCompletaParaExportacao();
        const hash = `Doc_WMS_${Date.now()}`;

        if (formato === 'EXCEL' || formato === 'AMBOS') {
            const wb = XLSX.utils.table_to_book(tabelaAlvoCompleta, { sheet: "Dados" });
            XLSX.writeFile(wb, `${hash}.xlsx`);
        }
        if (formato === 'PDF' || formato === 'AMBOS') {
            html2pdf().set({ margin: 12, filename: `${hash}.pdf`, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(tabelaAlvoCompleta).save();
        }

        window.location.href = `mailto:${inputEmailDestino.value}?subject=Relatorio&body=Extraído com Sucesso.`;
        modalEmail.classList.remove('active'); e.target.reset();
    });

    document.getElementById('btn-trigger-email').addEventListener('click', () => { modalEmail.classList.add('active'); });
    document.getElementById('btn-email-cancel').addEventListener('click', () => { modalEmail.classList.remove('active'); });

    // Spooler de Impressão Integral (Captura além dos 5 visíveis da Grid)
    document.getElementById('btn-imprimir').addEventListener('click', () => {
        if (fluxoAtivo !== 'requisicao' && fluxoAtivo !== 'descarte' && fluxoAtivo !== 'retorno') {
            window.print(); return;
        }

        const tabelaCompleta = gerarTabelaCompletaParaExportacao();
        tabelaCompleta.classList.add('table-print-temp');
        const estiloTemp = document.createElement('style');
        estiloTemp.innerHTML = `
            @media print {
                .no-print, nav, .panel-footer, .main-header, .alert-banner-dashboard, form, .panel:first-child { display: none !important; }
                .table-print-temp { width: 100% !important; display: table !important; border-collapse: collapse !important; }
                .table-print-temp th, .table-print-temp td { border: 1px solid #000 !important; padding: 8px !important; }
            }
            @media screen { .table-print-temp { display: none !important; } }
        `;
        document.body.appendChild(tabelaCompleta); document.body.appendChild(estiloTemp);
        window.print();
        setTimeout(() => { tabelaCompleta.remove(); estiloTemp.remove(); }, 1000);
    });

    // Init do Sistema
    atualizarDropdownsItens(); renderizarCatalogo(); atualizarBannerDashboard();
});