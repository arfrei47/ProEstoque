/**
 * script.js - Arquivo Controlador de Renderização, Proteção de Rotas e Mailto
 */
document.addEventListener('DOMContentLoaded', () => {
    // Sistema Segura de Rota Local baseada na Sessão
    const perfilAtivo = sessionStorage.getItem('perfil_ativo');
    if (!perfilAtivo) {
        window.location.href = 'index.html';
        return;
    }

    // Identifica visualmente o nível do usuário no cabeçalho
    const labelPerfil = document.getElementById('label-perfil');
    if(labelPerfil) {
        labelPerfil.textContent = perfilAtivo === 'operador' ? '🔧 Operador Logístico' : '🎯 Apontador';
    }

    let fluxoAtivo = 'cadastro';
    let emailValidadoOK = false;
    let timeoutValidacao = null;
    let alvoPurgaContextual = null; 
    let itemCodigoParaExcluir = null; // Armazena contexto de exclusão unitária

    // Seletores DOM
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

    // Botão de Logout
    document.getElementById('btn-sair-terminal').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'index.html';
    });

    function obterTabelaAtiva() {
        if (fluxoAtivo === 'cadastro') return document.getElementById('tabela-catalogo');
        if (fluxoAtivo === 'corte') return document.getElementById('tabela-corte');
        return document.getElementById('tabela-movimentacoes');
    }

    // Gerenciador de Abas Navegacionais
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
            travarBotoesLimpezaVazios();
        });
    });

    function formatarData() {
        const agora = new Date();
        return agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function validarFormularioCampos(formElement) {
        const inputs = formElement.querySelectorAll('input, select');
        let status = true;
        inputs.forEach(campo => {
            if (campo.type !== 'radio' && !campo.value.trim()) { status = false; campo.style.borderColor = 'var(--danger)'; }
            else { campo.style.borderColor = 'var(--border)'; }
        });
        return status;
    }

    function travarBotoesLimpezaVazios() {
        const btnLimparCatalogo = document.querySelector('[data-target-purge="cadastro"]');
        const btnLimparCorte = document.querySelector('[data-target-purge="corte"]');
        if(btnLimparCatalogo) btnLimparCatalogo.disabled = (DB.getCatalogo().length === 0);
        if(btnLimparCorte) btnLimparCorte.disabled = (Object.keys(DB.getContagens()).length === 0);
    }

    function atualizarDropdownsItens() {
        const itens = DB.getCatalogo();
        dropdownsInsumos.forEach(select => {
            select.innerHTML = '<option value="">-- Selecione um Item --</option>';
            itens.forEach(it => {
                const opt = document.createElement('option');
                opt.value = it.item; opt.textContent = `${it.codigo} - ${it.item}`;
                select.appendChild(opt);
            });
        });
    }

    // Manipuladores de Cadastro e Lançamento
    document.getElementById('form-cadastro').addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        if (!validarFormularioCampos(form)) return;

        const codigo = document.getElementById('cad-codigo').value.trim().toUpperCase();
        const item = document.getElementById('cad-item').value.trim().toUpperCase();
        const caixa = parseInt(document.getElementById('cad-caixa').value) || 0;
        const palete = parseInt(document.getElementById('cad-palete').value) || 0;
        const fornecedor = document.getElementById('cad-fornecedor').value.trim().toUpperCase();

        if (DB.getCatalogo().some(i => i.codigo === codigo || i.item === item)) {
            alert("🚨 Código ou nome de insumo já cadastrado."); return;
        }

        DB.saveCatalogoItem({ dataCad: formatarData(), codigo, item, caixa, palete, fornecedor });
        atualizarDropdownsItens(); renderizarCatalogo(); form.reset(); travarBotoesLimpezaVazios();
    });

    ['requisicao', 'descarte', 'retorno'].forEach(tipo => {
        document.getElementById(`form-${tipo}`).addEventListener('submit', (e) => {
            e.preventDefault(); const form = e.target;
            if (!validarFormularioCampos(form)) return;

            const insumo = form.querySelector('select').value;
            const qtd = parseInt(form.querySelector('.input-qtd').value) || 0;
            const mapa = { 'requisicao': 'REQUISIÇÃO', 'descarte': 'DESCARTE', 'retorno': 'RETORNO' };

            DB.saveMovimentacao({ data: formatarData(), insumo, tipo: mapa[tipo], quantidade: qtd });
            if(fluxoAtivo !== 'cadastro' && fluxoAtivo !== 'corte') renderizarHistorico();
            form.reset();
        });
    });

    document.getElementById('form-corte').addEventListener('submit', (e) => {
        e.preventDefault(); const form = e.target;
        if (!validarFormularioCampos(form)) return;
        const insumo = document.getElementById('corte-insumo').value;
        const qtdFisica = parseInt(document.getElementById('corte-qtd').value) || 0;

        DB.saveCorte(insumo, { quantidade: qtdFisica, dataValidacao: formatarData() });
        renderizarCorte(); form.reset(); travarBotoesLimpezaVazios();
    });

    // Renderizadores Dinâmicos das Tabelas do Painel
    function renderizarCatalogo() {
        corpoCatalogo.innerHTML = '';
        const itens = DB.getCatalogo();
        if (itens.length === 0) {
            corpoCatalogo.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#a0aec0;">Nenhum item em catálogo.</td></tr>`;
            return;
        }
        [...itens].reverse().forEach(i => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${i.dataCad}</td><td>${i.codigo}</td><td><strong>${i.item}</strong></td><td>${i.caixa}</td><td>${i.palete}</td><td>${i.fornecedor}</td><td class="no-print"><button type="button" class="btn-delete-row" data-codigo="${i.codigo}">🗑️</button></td>`;
            corpoCatalogo.appendChild(tr);
        });
    </div>

    // Algoritmo de Corte: Filtra e exibe na tela EXCLUSIVAMENTE os 5 registros mais novos baseados na cronologia reversa
    function renderizarHistorico() {
        corpoMovimentacoes.innerHTML = '';
        const listaFull = DB.getMovimentacoes();
        if (listaFull.length === 0) {
            corpoMovimentacoes.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#a0aec0;">Sem movimentações registradas.</td></tr>`;
            return;
        }
        // Clona e inverte a lista (do mais recente ao mais antigo) e extrai apenas os 5 primeiros elementos
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
            corpoCorte.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a0aec0;">Aguardando lançamento de dados.</td></tr>`;
            return;
        }

        todosInsumos.forEach(insumo => {
            if(!insumo) return;
            // O saldo lógico processa a soma de todas as movimentações existentes no banco
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
                tds[3].textContent = 'Não contado';
            }
            corpoCorte.appendChild(tr);
        });
    }

    // Engine Avançada de Captura e Configuração de Modais Contextuais (Purga e Remoção Unitária)
    document.addEventListener('click', (e) => {
        // Caso A: Clique no botão de deletar um item específico do catálogo
        if (e.target && e.target.classList.contains('btn-delete-row')) {
            itemCodigoParaExcluir = e.target.getAttribute('data-codigo');
            alvoPurgaContextual = 'UNITARIO';
            textoAvisoModal.textContent = `⚠️ CONFIRMAÇÃO: Deseja realmente remover o item com o código [${itemCodigoParaExcluir}] do catálogo? Esta ação não afetará movimentações passadas.`;
            modalAlerta.classList.add('active');
        }
        
        // Caso B: Clique em botão de purga em massa do formulário ativo
        if (e.target && e.target.classList.contains('btn-trigger-modal')) {
            alvoPurgaContextual = e.target.getAttribute('data-target-purge');
            if (alvoPurgaContextual === 'cadastro') {
                textoAvisoModal.textContent = "⚠️ ATENÇÃO CRÍTICA: Você irá apagar permanentemente TODOS os itens contidos no catálogo do sistema.";
            } else if (alvoPurgaContextual === 'corte') {
                textoAvisoModal.textContent = "⚠️ ATENÇÃO: Deseja redefinir e apagar todos os lançamentos de contagens físicas auditadas?";
            }
            modalAlerta.classList.add('active');
        }
    });

    document.getElementById('btn-modal-cancel').addEventListener('click', () => {
        modalAlerta.classList.remove('active');
        alvoPurgaContextual = null; itemCodigoParaExcluir = null;
    });

    document.getElementById('btn-modal-confirm').addEventListener('click', () => {
        if (alvoPurgaContextual === 'UNITARIO' && itemCodigoParaExcluir) {
            DB.deleteCatalogoItem(itemCodigoParaExcluir);
        } else if (alvoPurgaContextual === 'cadastro') {
            DB.clearCatalogo();
        } else if (alvoPurgaContextual === 'corte') {
            DB.clearContagens();
        }

        modalAlerta.classList.remove('active');
        alvoPurgaContextual = null; itemCodigoParaExcluir = null;
        
        atualizarDropdownsItens();
        travarBotoesLimpezaVazios();
        
        if (fluxoAtivo === 'cadastro') renderizarCatalogo();
        else if (fluxoAtivo === 'corte') renderizarCorte();
        else renderizarHistorico();
    });

    // Mecanismo de Validação Remota de E-mail
    inputEmailDestino.addEventListener('input', () => {
        clearTimeout(timeoutValidacao); emailValidadoOK = false; btnEmailSubmit.disabled = true;
        const email = inputEmailDestino.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) { iconEmailStatus.textContent = '⚪'; txtEmailFeedback.textContent = 'Aguardando endereço...'; return; }
        if (!emailRegex.test(email)) { iconEmailStatus.textContent = '❌'; txtEmailFeedback.textContent = 'E-mail em formato inválido.'; txtEmailFeedback.style.color = 'var(--danger)'; return; }

        iconEmailStatus.textContent = '🔄'; txtEmailFeedback.textContent = 'Verificando MX...'; txtEmailFeedback.style.color = 'var(--warning)';

        timeoutValidacao = setTimeout(() => {
            const dominiosInvalidos = ['teste.com', 'gmaill.com', 'email.com', 'errado.com'];
            if (dominiosInvalidos.includes(email.split('@')[1].toLowerCase())) {
                iconEmailStatus.textContent = '❌'; txtEmailFeedback.textContent = 'Domínio inacessível.'; txtEmailFeedback.style.color = 'var(--danger)';
            } else {
                iconEmailStatus.textContent = '✅'; txtEmailFeedback.textContent = 'Endereço validado com sucesso!'; txtEmailFeedback.style.color = 'var(--success)';
                emailValidadoOK = true; btnEmailSubmit.disabled = false;
            }
        }, 850);
    });

    // Compilação Nativa e Envio Seguro com Mailto Corporativo
    document.getElementById('form-exportar-email').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validarFormularioCampos(e.target) || !emailValidadoOK) return;

        const formato = e.target.querySelector('input[name="formato-doc"]:checked').value;
        const eAddress = inputEmailDestino.value.trim();
        const tabelaAlvo = obterTabelaAtiva();
        const hashArquivo = `Relatorio_${fluxoAtivo.toUpperCase()}_${Date.now()}`;

        // Executa geração física no lado do cliente para auditoria local do usuário
        if (formato === 'EXCEL' || formato === 'AMBOS') {
            const wb = XLSX.utils.table_to_book(tabelaAlvo, { sheet: "Inventario" });
            XLSX.writeFile(wb, `${hashArquivo}.xlsx`);
        }
        if (formato === 'PDF' || formato === 'AMBOS') {
            const opcoes = { margin: 12, filename: `${hashArquivo}.pdf`, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } };
            html2pdf().set(opcoes).from(tabelaAlvo).save();
        }

        // Extrai dados textuais estruturados completos (no histórico, gera todo o banco, mitigando a trava visual de 5 itens)
        let textoRelatorio = "";
        const linhas = tabelaAlvo.querySelectorAll("tr");
        linhas.forEach(l => {
            const celulas = l.querySelectorAll("th, td");
            textoRelatorio += Array.from(celulas).map(c => c.textContent.trim()).filter(t => t !== "🗑️").join(" | ") + "\n";
        });

        const assuntoEmail = encodeURIComponent(`📊 Relatório Consolidado - Módulo: ${fluxoAtivo.toUpperCase()}`);
        const corpoEmail = encodeURIComponent(
            `Prezado(a),\n\nSegue em anexo o relatório extraído do painel de suprimentos corporativo.\n\n` +
            `=== DADOS DA TABELA ATIVA ===\n${textoRelatorio}=============================\n\n` +
            `Extraído em: ${formatarData()}\nChave Única do Relatório: ${hashArquivo}`
        );

        window.location.href = `mailto:${eAddress}?subject=${assuntoEmail}&body=${corpoEmail}`;
        modalEmail.classList.remove('active'); e.target.reset(); iconEmailStatus.textContent = '⚪';
    });

    document.getElementById('btn-trigger-email').addEventListener('click', () => { modalEmail.classList.add('active'); inputEmailDestino.focus(); });
    document.getElementById('btn-email-cancel').addEventListener('click', () => { modalEmail.classList.remove('active'); document.getElementById('form-exportar-email').reset(); iconEmailStatus.textContent = '⚪'; });
    document.getElementById('btn-imprimir').addEventListener('click', () => window.print());

    // Execuções Iniciais Obrigatórias de Escopo
    atualizarDropdownsItens();
    renderizarCatalogo();
    travarBotoesLimpezaVazios();
});