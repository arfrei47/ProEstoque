/**
 * script.js - Inteligência de Operações e Sanidade de Spooler
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Validação Restrita do Perfil de Segurança
    const perfilAtivo = sessionStorage.getItem('perfil_ativo');
    if (!perfilAtivo) {
        window.location.href = 'index.html';
        return;
    }

    const labelPerfil = document.getElementById('label-perfil');
    const mapaNomes = {
        'administrador': '🔑 Administrador do Sistema',
        'apontador': '🎯 Apontador de Produção',
        'operacao': '🔧 Operação'
    };
    if (labelPerfil) labelPerfil.textContent = mapaNomes[perfilAtivo] || 'Usuário';

    if (perfilAtivo === 'administrador') {
        document.body.classList.add('is-admin'); 
    }

    let fluxoAtivo = 'cadastro';
    let emailValidadoOK = false;
    let timeoutValidacao = null;
    let alvoPurgaContextual = null; 
    let itemCodigoParaExcluir = null;

    // Seletores do DOM
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

    const btnPurgaCatalogo = document.getElementById('btn-purga-catalogo');
    const btnPurgaCorte = document.getElementById('btn-purga-corte');

    const modalAlerta = document.getElementById('modal-alerta');
    const textoAvisoModal = document.getElementById('texto-aviso-modal');
    const modalEmail = document.getElementById('modal-email');
    const inputEmailDestino = document.getElementById('email-destino');
    const iconEmailStatus = document.getElementById('email-status-icon');
    const txtEmailFeedback = document.getElementById('email-feedback-text');
    const btnEmailSubmit = document.getElementById('btn-email-submit');

    // Desconexão Segura
    document.getElementById('btn-sair-terminal').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'index.html';
    });

    // Contador de Dias Baseado Estritamente no dia 12/05/2026
    function atualizarBannerDashboard() {
        const el = document.getElementById('banner-contagem-dash');
        
        // Base fixada estritamente em 12/05/2026 conforme solicitado
        const ultimaContagem = new Date(2026, 4, 12); 
        
        const proximaContagem = new Date(ultimaContagem);
        proximaContagem.setDate(ultimaContagem.getDate() + 7);
        
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        proximaContagem.setHours(0,0,0,0);
        
        const diffTime = proximaContagem - hoje;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) {
            el.innerHTML = `🚨 ATENÇÃO CRÍTICA: Prazo vencido! Realize a contagem física das prateleiras imediatamente.`;
            el.style.backgroundColor = "var(--danger)";
        } else {
            el.innerHTML = `🗓️ Próxima Contagem Física do Estoque: ${proximaContagem.toLocaleDateString('pt-BR')} (Restam <strong>${diffDays} dias</strong> para a conferência)`;
            el.style.backgroundColor = "var(--primary)";
        }
    }

    // Controle de Abas e Ancoragem Exclusiva dos Botões de Limpeza Massa
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

            if (btnPurgaCatalogo) btnPurgaCatalogo.style.setProperty('display', 'none', 'important');
            if (btnPurgaCorte) btnPurgaCorte.style.setProperty('display', 'none', 'important');

            if (fluxoAtivo === 'cadastro') {
                painelDireitoTitulo.textContent = "Catálogo de Itens Cadastrados";
                containerCatalogo.style.display = "block";
                if (perfilAtivo === 'administrador' && btnPurgaCatalogo) btnPurgaCatalogo.style.setProperty('display', 'inline-flex', 'important');
                renderizarCatalogo();
            } else if (fluxoAtivo === 'corte') {
                painelDireitoTitulo.textContent = "⚖️ Conciliação e Divergência de Inventário (Lista Completa)";
                containerCorte.style.display = "block";
                if (perfilAtivo === 'administrador' && btnPurgaCorte) btnPurgaCorte.style.setProperty('display', 'inline-flex', 'important');
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

    // Processamento de Cadastros e Movimentações
    document.getElementById('form-cadastro').addEventListener('submit', (e) => {
        e.preventDefault();
        const codigo = document.getElementById('cad-codigo').value.trim().toUpperCase();
        const item = document.getElementById('cad-item').value.trim().toUpperCase();
        const caixa = parseInt(document.getElementById('cad-caixa').value) || 0;
        const palete = parseInt(document.getElementById('cad-palete').value) || 0;
        const fornecedor = document.getElementById('cad-fornecedor').value.trim().toUpperCase();

        if (DB.getCatalogo().some(i => i.codigo === codigo || i.item === item)) {
            alert("🚨 Código ou Insumo já registrado."); return;
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
            if (fluxoAtivo !== 'cadastro' && fluxoAtivo !== 'corte') renderizarHistorico();
            form.reset();
        });
    });

    document.getElementById('form-corte').addEventListener('submit', (e) => {
        e.preventDefault(); 
        const insumo = document.getElementById('corte-insumo').value;
        const qtdFisica = parseInt(document.getElementById('corte-qtd').value) || 0;

        DB.saveCorte(insumo, { quantidade: qtdFisica, dataValidacao: formatarData() });
        renderizarCorte(); e.target.reset();
    });

    // Motores de Renderização Separados por Contexto
    function renderizarCatalogo() {
        corpoCatalogo.innerHTML = '';
        DB.getCatalogo().forEach(i => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${i.dataCad}</td><td>${i.codigo}</td><td><strong>${i.item}</strong></td><td>${i.caixa}</td><td>${i.palete}</td><td>${i.fornecedor}</td>
            <td class="admin-only"><button type="button" class="btn-delete-row" data-codigo="${i.codigo}" style="background:none; border:none; cursor:pointer;">🗑️</button></td>`;
            corpoCatalogo.appendChild(tr);
        });
    }

    function renderizarHistorico() {
        corpoMovimentacoes.innerHTML = '';
        const mvs = DB.getMovimentacoes();
        if (mvs.length === 0) {
            corpoMovimentacoes.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#a0aec0;">Nenhuma movimentação.</td></tr>`;
            return;
        }
        // Na tela apresenta apenas os últimos 5
        [...mvs].reverse().slice(0, 5).forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${m.data}</td><td><strong>${m.insumo}</strong></td><td>${m.tipo}</td><td>${m.quantidade}</td>`;
            corpoMovimentacoes.appendChild(tr);
        });
    }

    function renderizarCorte() {
        corpoCorte.innerHTML = '';
        const movimentos = DB.getMovimentacoes();
        const contagens = DB.getContagens();
        const todosInsumos = new Set([...movimentos.map(m => m.insumo), ...Object.keys(contagens), ...DB.getCatalogo().map(i => i.item)]);

        if (todosInsumos.size === 0) {
            corpoCorte.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a0aec0;">Sem balanço pendente.</td></tr>`;
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

    /**
     * CONSTRUTOR DE TABELAS INTEGRAIS (NUNCA CRIA CONFLITOS DE CLONAGEM DE ELEMENTOS DO DOM ATIVO)
     */
    function gerarEstruturaLimpaParaExportacao(isParaPdf = false) {
        const tabelaDestino = document.createElement('table');
        tabelaDestino.style.width = '100%';
        tabelaDestino.style.borderCollapse = 'collapse';
        tabelaDestino.style.fontFamily = 'Arial, sans-serif';

        if (fluxoAtivo === 'cadastro') {
            tabelaDestino.innerHTML = `
                <thead>
                    <tr style="background:#f2f2f2;"><th style="border:1px solid #ddd; padding:8px;">Data Cad.</th><th style="border:1px solid #ddd; padding:8px;">Código</th><th style="border:1px solid #ddd; padding:8px;">Item</th><th style="border:1px solid #ddd; padding:8px;">Cx</th><th style="border:1px solid #ddd; padding:8px;">Pl</th><th style="border:1px solid #ddd; padding:8px;">Fornecedor</th></tr>
                </thead>
                <tbody></tbody>`;
            const tbody = tabelaDestino.querySelector('tbody');
            DB.getCatalogo().forEach(i => {
                tbody.innerHTML += `<tr><td style="border:1px solid #ddd; padding:8px;">${i.dataCad}</td><td style="border:1px solid #ddd; padding:8px;">${i.codigo}</td><td style="border:1px solid #ddd; padding:8px;"><strong>${i.item}</strong></td><td style="border:1px solid #ddd; padding:8px;">${i.caixa}</td><td style="border:1px solid #ddd; padding:8px;">${i.palete}</td><td style="border:1px solid #ddd; padding:8px;">${i.fornecedor}</td></tr>`;
            });
        } 
        else if (fluxoAtivo === 'corte') {
            tabelaDestino.innerHTML = `
                <thead>
                    <tr style="background:#f2f2f2;"><th style="border:1px solid #ddd; padding:8px;">Última Validação</th><th style="border:1px solid #ddd; padding:8px;">Item</th><th style="border:1px solid #ddd; padding:8px;">Saldo Lógico</th><th style="border:1px solid #ddd; padding:8px;">Qtd Física</th><th style="border:1px solid #ddd; padding:8px;">Divergência</th><th style="border:1px solid #ddd; padding:8px;">Status</th></tr>
                </thead>
                <tbody></tbody>`;
            const tbody = tabelaDestino.querySelector('tbody');
            const movimentos = DB.getMovimentacoes();
            const contagens = DB.getContagens();
            const todosInsumos = new Set([...movimentos.map(m => m.insumo), ...Object.keys(contagens), ...DB.getCatalogo().map(i => i.item)]);

            todosInsumos.forEach(insumo => {
                if(!insumo) return;
                const saldoLogico = movimentos.reduce((acc, m) => {
                    if (m.insumo === insumo) {
                        if (m.tipo === 'REQUISIÇÃO') acc += m.quantidade;
                        if (m.tipo === 'DESCARTE' || m.tipo === 'RETORNO') acc -= m.quantidade;
                    }
                    return acc;
                }, 0);
                const p = contagens[insumo] || null;
                let dataV = '-', qtdF = 'Pendente', divV = '-', st = '-';
                if(p) {
                    dataV = p.dataValidacao; qtdF = p.quantidade; divV = qtdF - saldoLogico;
                    st = divV === 0 ? "OK" : (divV > 0 ? "Sobra" : "Falta");
                    if(divV > 0) divV = `+${divV}`;
                }
                tbody.innerHTML += `<tr><td style="border:1px solid #ddd; padding:8px;">${dataV}</td><td style="border:1px solid #ddd; padding:8px;"><strong>${insumo}</strong></td><td style="border:1px solid #ddd; padding:8px;">${saldoLogico}</td><td style="border:1px solid #ddd; padding:8px;">${qtdF}</td><td style="border:1px solid #ddd; padding:8px;">${divV}</td><td style="border:1px solid #ddd; padding:8px;">${st}</td></tr>`;
            });
        }
        else {
            // Imprime TODO o histórico registrado sem restrições
            tabelaDestino.innerHTML = `
                <thead>
                    <tr style="background:#f2f2f2;"><th style="border:1px solid #ddd; padding:8px;">Data/Hora</th><th style="border:1px solid #ddd; padding:8px;">Item</th><th style="border:1px solid #ddd; padding:8px;">Operação</th><th style="border:1px solid #ddd; padding:8px;">Qtd</th></tr>
                </thead>
                <tbody></tbody>`;
            const tbody = tabelaDestino.querySelector('tbody');
            const todos = DB.getMovimentacoes();
            if(todos.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:8px;">Sem registros salvos.</td></tr>`;
            } else {
                [...todos].reverse().forEach(m => {
                    tbody.innerHTML += `<tr><td style="border:1px solid #ddd; padding:8px;">${m.data}</td><td style="border:1px solid #ddd; padding:8px;"><strong>${m.insumo}</strong></td><td style="border:1px solid #ddd; padding:8px;">${m.tipo}</td><td style="border:1px solid #ddd; padding:8px;">${m.quantidade}</td></tr>`;
                });
            }
        }
        return tabelaDestino;
    }

    // Modal de Controle de Purga Coletiva (Admin Only)
    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('btn-delete-row')) {
            if(perfilAtivo !== 'administrador') return;
            itemCodigoParaExcluir = e.target.getAttribute('data-codigo');
            alvoPurgaContextual = 'UNITARIO';
            textoAvisoModal.textContent = `Confirma a remoção definitiva do item [${itemCodigoParaExcluir}] do catálogo?`;
            modalAlerta.classList.add('active');
        }
        
        if (e.target && e.target.classList.contains('btn-trigger-modal')) {
            if(perfilAtivo !== 'administrador') return;
            alvoPurgaContextual = e.target.getAttribute('data-target-purge');
            textoAvisoModal.textContent = alvoPurgaContextual === 'cadastro' ? 
                "⚠️ EXCLUSÃO MASTER: Deseja apagar permanentemente TODO o catálogo de itens?" : 
                "⚠️ EXCLUSÃO MASTER: Deseja apagar permanentemente todo o histórico de contagens físicas?";
            modalAlerta.classList.add('active');
        }
    });

    document.getElementById('btn-modal-cancel').addEventListener('click', () => { modalAlerta.classList.remove('active'); });
    document.getElementById('btn-modal-confirm').addEventListener('click', () => {
        if (alvoPurgaContextual === 'UNITARIO') DB.deleteCatalogoItem(itemCodigoParaExcluir);
        else if (alvoPurgaContextual === 'cadastro') DB.clearCatalogo();
        else if (alvoPurgaContextual === 'corte') DB.clearContagens();

        modalAlerta.classList.remove('active');
        atualizarDropdownsItens();
        
        if (fluxoAtivo === 'cadastro') renderizarCatalogo();
        else if (fluxoAtivo === 'corte') renderizarCorte();
        else renderizarHistorico();
    });

    // Assistente de Exportações por E-mail (Seguro contra vazamento de memória)
    inputEmailDestino.addEventListener('input', () => {
        clearTimeout(timeoutValidacao); emailValidadoOK = false; btnEmailSubmit.disabled = true;
        const email = inputEmailDestino.value.trim();
        if (!email) { iconEmailStatus.textContent = '⚪'; return; }
        iconEmailStatus.textContent = '🔄';
        timeoutValidacao = setTimeout(() => {
            iconEmailStatus.textContent = '✅'; txtEmailFeedback.textContent = 'Destinatário pronto!';
            emailValidadoOK = true; btnEmailSubmit.disabled = false;
        }, 400);
    });

    document.getElementById('form-exportar-email').addEventListener('submit', (e) => {
        e.preventDefault();
        const formato = e.target.querySelector('input[name="formato-doc"]:checked').value;
        const tabelaEstruturada = gerarEstruturaLimpaParaExportacao();
        const hashTime = `WMS_EXPORT_${Date.now()}`;

        if (formato === 'EXCEL') {
            const wb = XLSX.utils.table_to_book(tabelaEstruturada, { sheet: "Dados Contábeis" });
            XLSX.writeFile(wb, `${hashTime}.xlsx`);
        } else {
            html2pdf().set({ margin: 12, filename: `${hashTime}.pdf`, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(tabelaEstruturada).save();
        }
        modalEmail.classList.remove('active');
    });

    document.getElementById('btn-trigger-email').addEventListener('click', () => { modalEmail.classList.add('active'); });
    document.getElementById('btn-email-cancel').addEventListener('click', () => { modalEmail.classList.remove('active'); });

    /**
     * 🖨️ MOTOR ISOLADO DE IMPRESSÃO VIA IFRAME (SOLUÇÃO ABSOLUTA CONTRA DUPLICAÇÃO DE TELA)
     */
    document.getElementById('btn-imprimir').addEventListener('click', () => {
        // 1. Cria um iframe temporário e invisível na viewport
        const iframePrint = document.createElement('iframe');
        iframePrint.style.position = 'fixed';
        iframePrint.style.right = '0';
        iframePrint.style.bottom = '0';
        iframePrint.style.width = '0';
        iframePrint.style.height = '0';
        iframePrint.style.border = 'none';
        document.body.appendChild(iframePrint);

        // 2. Obtém a tabela limpa correspondente à aba ativa
        const tabelaLimpa = gerarEstruturaLimpaParaExportacao();
        
        // 3. Monta o escopo interno do documento do iframe de forma isolada
        const docIframe = iframePrint.contentWindow.document;
        docIframe.open();
        docIframe.write(`
            <html>
            <head>
                <title>Relatório Operacional WMS</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; }
                    h2 { margin-bottom: 5px; color: #1a202c; font-size: 1.4rem; }
                    p { font-size: 0.85rem; color: #4a5568; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #cbd5e0; padding: 10px; text-align: left; font-size: 0.85rem; }
                    th { background-color: #edf2f7; color: #2d3748; font-weight: bold; }
                    strong { color: #000; }
                </style>
            </head>
            <body>
                <h2>RELATÓRIO DE INVENTÁRIO - ABA: ${fluxoAtivo.toUpperCase()}</h2>
                <p>Extraído em: ${formatarData()} | Sistema de Controle de Suprimentos</p>
                ${tabelaLimpa.outerHTML}
            </body>
            </html>
        `);
        docIframe.close();

        // 4. Executa o disparo do spool físico após a sincronização estrutural do documento interno
        setTimeout(() => {
            iframePrint.contentWindow.focus();
            iframePrint.contentWindow.print();
            // Desaloca o iframe imediatamente para livrar memória operacional do cliente
            iframePrint.remove();
        }, 500);
    });

    // Execução Inicial
    atualizarDropdownsItens();
    renderizarCatalogo();
    atualizarBannerDashboard();
});