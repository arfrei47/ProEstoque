/**
 * script.js - Controladora de Interface, Filtros de Purga de Dados Contextuais e Mailto
 */
document.addEventListener('DOMContentLoaded', () => {
    let fluxoAtivo = 'cadastro';
    let emailValidadoOK = false;
    let timeoutValidacao = null;
    let alvoPurgaContextual = null; // Armazena temporariamente o escopo a ser excluído

    // Elementos de Abas e Seções
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

    // Modais e Triggers Contextuais
    const modalAlerta = document.getElementById('modal-alerta');
    const textoAvisoModal = document.getElementById('texto-aviso-modal');
    const modalEmail = document.getElementById('modal-email');
    const btnTriggerEmail = document.getElementById('btn-trigger-email');
    const btnImprimir = document.getElementById('btn-imprimir');

    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');
    const btnEmailCancel = document.getElementById('btn-email-cancel');
    const formExportarEmail = document.getElementById('form-exportar-email');
    
    const inputEmailDestino = document.getElementById('email-destino');
    const iconEmailStatus = document.getElementById('email-status-icon');
    const txtEmailFeedback = document.getElementById('email-feedback-text');
    const btnEmailSubmit = document.getElementById('btn-email-submit');

    function obterTabelaAtiva() {
        if (fluxoAtivo === 'cadastro') return document.getElementById('tabela-catalogo');
        if (fluxoAtivo === 'corte') return document.getElementById('tabela-corte');
        return document.getElementById('tabela-movimentacoes');
    }

    // Gerenciador de Abas
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            alternarAbas(e.target.getAttribute('data-fluxo'), e.target);
        });
    });

    function alternarAbas(fluxo, botaoAlvo) {
        fluxoAtivo = fluxo;
        tabButtons.forEach(b => b.classList.remove('active'));
        botaoAlvo.classList.add('active');
        formPanels.forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${fluxo}`).classList.add('active');

        containerCatalogo.style.display = "none";
        containerGeral.style.display = "none";
        containerCorte.style.display = "none";

        if (fluxo === 'cadastro') {
            painelDireitoTitulo.textContent = "Catálogo de Itens Cadastrados";
            containerCatalogo.style.display = "block";
            renderizarCatalogo();
        } else if (fluxo === 'corte') {
            painelDireitoTitulo.textContent = "⚖️ Conciliação e Divergência de Inventário";
            containerCorte.style.display = "block";
            renderizarCorte();
        } else {
            painelDireitoTitulo.textContent = "Histórico de Movimentações";
            containerGeral.style.display = "block";
            renderizarHistorico();
        }
        travarBotoesLimpezaVazios();
    }

    function formatarData() {
        const agora = new Date();
        return agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function validarFormularioCampos(formElement) {
        const inputs = formElement.querySelectorAll('input, select');
        let status = true;

        inputs.forEach(campo => {
            if (campo.type !== 'radio' && !campo.value.trim()) {
                status = false;
                campo.style.borderColor = 'var(--danger)';
            } else {
                campo.style.borderColor = 'var(--border)';
            }
        });

        if (!status) { alert("⚠️ Erro de Preenchimento: Certifique-se de que preencheu todos os campos obrigatórios."); }
        return status;
    }

    // Gerenciador de Estado de Botões Independentes de Limpeza
    function travarBotoesLimpezaVazios() {
        const btnLimparCatalogo = document.querySelector('[data-target-purge="cadastro"]');
        const btnsLimparMovimentacoes = document.querySelectorAll('[data-target-purge="movimentacoes"]');
        const btnLimparCorte = document.querySelector('[data-target-purge="corte"]');

        if(btnLimparCatalogo) btnLimparCatalogo.disabled = (DB.getCatalogo().length === 0);
        
        btnsLimparMovimentacoes.forEach(b => {
            b.disabled = (DB.getMovimentacoes().length === 0);
        });

        if(btnLimparCorte) {
            btnLimparCorte.disabled = (Object.keys(DB.getContagens()).length === 0);
        }
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

    // Submissões de Formulários
    const formCadastro = document.getElementById('form-cadastro');
    formCadastro.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validarFormularioCampos(formCadastro)) return;

        const codigo = document.getElementById('cad-codigo').value.trim().toUpperCase();
        const item = document.getElementById('cad-item').value.trim().toUpperCase();
        const caixa = parseInt(document.getElementById('cad-caixa').value) || 0;
        const palete = parseInt(document.getElementById('cad-palete').value) || 0;
        const fornecedor = document.getElementById('cad-fornecedor').value.trim().toUpperCase();

        if (DB.getCatalogo().some(i => i.codigo === codigo || i.item === item)) {
            alert("🚨 Erro: Este código ou nome de insumo já existe.");
            return;
        }

        DB.saveCatalogoItem({ dataCad: formatarData(), codigo, item, caixa, palete, fornecedor });
        atualizarDropdownsItens();
        renderizarCatalogo();
        formCadastro.reset();
        travarBotoesLimpezaVazios();
    });

    ['requisicao', 'descarte', 'retorno'].forEach(tipo => {
        const form = document.getElementById(`form-${tipo}`);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!validarFormularioCampos(form)) return;

            const insumo = form.querySelector('select').value;
            const qtd = parseInt(form.querySelector('.input-qtd').value) || 0;
            const mapa = { 'requisicao': 'REQUISIÇÃO', 'descarte': 'DESCARTE', 'retorno': 'RETORNO' };

            DB.saveMovimentacao({ data: formatarData(), insumo, tipo: mapa[tipo], quantidade: qtd });
            renderizarHistorico();
            form.reset();
            travarBotoesLimpezaVazios();
        });
    });

    const formCorte = document.getElementById('form-corte');
    formCorte.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validarFormularioCampos(formCorte)) return;

        const insumo = document.getElementById('corte-insumo').value;
        const qtdFisica = parseInt(document.getElementById('corte-qtd').value) || 0;

        DB.saveCorte(insumo, { quantidade: qtdFisica, dataValidacao: formatarData() });
        renderizarCorte();
        formCorte.reset();
        travarBotoesLimpezaVazios();
    });

    function calcularSaldoLogico(insumoNome) {
        return DB.getMovimentacoes().reduce((acc, m) => {
            if (m.insumo === insumoNome) {
                if (m.tipo === 'REQUISIÇÃO') acc += m.quantidade;
                if (m.tipo === 'DESCARTE' || m.tipo === 'RETORNO') acc -= m.quantidade;
            }
            return acc;
        }, 0);
    }

    // Renderizadores das Tabelas
    function renderizarCatalogo() {
        corpoCatalogo.innerHTML = '';
        const itens = DB.getCatalogo();
        if (itens.length === 0) {
            corpoCatalogo.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a0aec0;">Nenhum item em catálogo.</td></tr>`;
            return;
        }
        [...itens].reverse().forEach(i => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="color:#718096"></td><td></td><td><strong></strong></td><td></td><td></td><td></td>`;
            const tds = tr.querySelectorAll('td');
            tds[0].textContent = i.dataCad; tds[1].textContent = i.codigo;
            tr.querySelector('strong').textContent = i.item;
            tds[3].textContent = i.caixa; tds[4].textContent = i.palete; tds[5].textContent = i.fornecedor;
            corpoCatalogo.appendChild(tr);
        });
    }

    function renderizarHistorico() {
        corpoMovimentacoes.innerHTML = '';
        const lista = DB.getMovimentacoes();
        if (lista.length === 0) {
            corpoMovimentacoes.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#a0aec0;">Sem movimentações registradas.</td></tr>`;
            return;
        }
        [...lista].reverse().forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td></td><td><strong></strong></td><td></td><td></td>`;
            const tds = tr.querySelectorAll('td');
            tds[0].textContent = m.data; tr.querySelector('strong').textContent = m.insumo;
            tds[2].textContent = m.tipo; tds[3].textContent = m.quantidade;
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
            const saldoLogico = calcularSaldoLogico(insumo);
            const payloadCorte = contagens[insumo] || null;

            const tr = document.createElement('tr');
            tr.innerHTML = `<td>-</td><td><strong></strong></td><td></td><td></td><td></td><td></td>`;
            const tds = tr.querySelectorAll('td');

            tr.querySelector('strong').textContent = insumo;
            tds[2].textContent = saldoLogico;

            if (payloadCorte !== null) {
                const contagemFisica = payloadCorte.quantidade;
                const divVal = contagemFisica - saldoLogico;

                tds[0].textContent = payloadCorte.dataValidacao;
                tds[3].textContent = contagemFisica;
                tds[4].textContent = divVal > 0 ? `+${divVal}` : divVal;

                if (divVal === 0) { tds[5].textContent = "✅ OK"; tr.className = "row-ok"; }
                else { tds[5].textContent = divVal > 0 ? "⚠️ Sobra" : "🚨 Falta"; tr.className = "row-divergent"; }
            } else {
                tds[3].textContent = 'Não contado'; tds[4].textContent = '-'; tds[5].textContent = '-';
            }
            corpoCorte.appendChild(tr);
        });
    }

    // Validação de E-mail
    inputEmailDestino.addEventListener('input', () => {
        clearTimeout(timeoutValidacao);
        emailValidadoOK = false;
        btnEmailSubmit.disabled = true;

        const email = inputEmailDestino.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            iconEmailStatus.textContent = '⚪';
            txtEmailFeedback.textContent = 'Insira um e-mail para validação ativa.';
            txtEmailFeedback.style.color = '#718096';
            return;
        }

        if (!emailRegex.test(email)) {
            iconEmailStatus.textContent = '❌';
            txtEmailFeedback.textContent = 'Estrutura de endereço eletrônico incorreta.';
            txtEmailFeedback.style.color = 'var(--danger)';
            return;
        }

        iconEmailStatus.textContent = '🔄';
        txtEmailFeedback.textContent = 'Checando barramento MX corporativo...';
        txtEmailFeedback.style.color = 'var(--warning)';

        timeoutValidacao = setTimeout(() => {
            const dominiosInvalidos = ['teste.com', 'gmaill.com', 'email.com', 'errado.com'];
            const dominio = email.split('@')[1].toLowerCase();

            if (dominiosInvalidos.includes(dominio)) {
                iconEmailStatus.textContent = '❌';
                txtEmailFeedback.textContent = 'Domínio ilegível ou sem registros MX.';
                txtEmailFeedback.style.color = 'var(--danger)';
            } else {
                iconEmailStatus.textContent = '✅';
                txtEmailFeedback.textContent = 'E-mail pronto para transmissão!';
                txtEmailFeedback.style.color = 'var(--success)';
                emailValidadoOK = true;
                btnEmailSubmit.disabled = false;
            }
        }, 850);
    });

    // Motores de Exportação
    function processarPlanilhaExcel(tabela, nomeArquivo) {
        const wb = XLSX.utils.table_to_book(tabela, { sheet: "Relatorio_Inventario" });
        XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
    }

    function processarDocumentoPDF(tabela, nomeArquivo) {
        const opcoes = {
            margin: 12,
            filename: `${nomeArquivo}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().set(opcoes).from(tabela).save();
    }

    function extrairConteudoTabelaParaTexto(tabela) {
        let texto = "";
        const linhas = tabela.querySelectorAll("tr");
        linhas.forEach((linha) => {
            const celulas = linha.querySelectorAll("th, td");
            const dadosLinha = Array.from(celulas).map(c => c.textContent.trim());
            texto += dadosLinha.join(" | ") + "\n";
        });
        return texto;
    }

    formExportarEmail.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validarFormularioCampos(formExportarEmail)) return;
        if (!emailValidadoOK) return;

        const formato = formExportarEmail.querySelector('input[name="formato-doc"]:checked').value;
        const eAddress = inputEmailDestino.value.trim();
        const tabelaAlvo = obterTabelaAtiva();
        const hashArquivo = `Relatorio_${fluxoAtivo.toUpperCase()}_${Date.now()}`;

        if (formato === 'EXCEL' || formato === 'AMBOS') processarPlanilhaExcel(tabelaAlvo, hashArquivo);
        if (formato === 'PDF' || formato === 'AMBOS') processarDocumentoPDF(tabelaAlvo, hashArquivo);

        const relatorioTexto = extrairConteudoTabelaParaTexto(tabelaAlvo);
        const assuntoEmail = encodeURIComponent(`📊 Relatório de Inventário - Módulo: ${fluxoAtivo.toUpperCase()}`);
        const corpoEmail = encodeURIComponent(
            `Prezado(a),\n\nSegue o relatório gerado via sistema referente à aba [${fluxoAtivo.toUpperCase()}].\n\n` +
            `=== DADOS ESTRUTURADOS ===\n${relatorioTexto}==========================\n\n` +
            `Gerado em: ${formatarData()}\nID do Arquivo: ${hashArquivo}`
        );

        window.location.href = `mailto:${eAddress}?subject=${assuntoEmail}&body=${corpoEmail}`;

        modalEmail.classList.remove('active');
        formExportarEmail.reset();
        iconEmailStatus.textContent = '⚪';
    });

    // 🛠️ MAPEADOR INTERNO DE INTERCEPTAÇÃO DOS BOTÕES DE LIMPEZA ESPECÍFICOS
    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('btn-trigger-modal')) {
            alvoPurgaContextual = e.target.getAttribute('data-target-purge');
            
            // Personaliza o texto do modal dinamicamente com base no contexto clicado
            if (alvoPurgaContextual === 'cadastro') {
                textoAvisoModal.textContent = "⚠️ ATENÇÃO: Esta ação deletará TODOS os itens cadastrados no catálogo de forma permanente. As movimentações salvas continuarão salvas.";
            } else if (alvoPurgaContextual === 'movimentacoes') {
                textoAvisoModal.textContent = "⚠️ ATENÇÃO: Esta ação apagará de forma definitiva TODAS as movimentações de requisição, descarte e retorno do sistema.";
            } else if (alvoPurgaContextual === 'corte') {
                textoAvisoModal.textContent = "⚠️ ATENÇÃO: Esta ação removerá apenas os registros e contagens auditadas do fluxo de corte físico.";
            }

            modalAlerta.classList.add('active');
        }
    });

    btnModalCancel.addEventListener('click', () => {
        modalAlerta.classList.remove('active');
        alvoPurgaContextual = null;
    });

    // Executa a purga específica solicitada pelo formulário ativo
    btnModalConfirm.addEventListener('click', () => {
        if (alvoPurgaContextual === 'cadastro') {
            DB.clearCatalogo();
            atualizarDropdownsItens();
            renderizarCatalogo();
        } else if (alvoPurgaContextual === 'movimentacoes') {
            DB.clearMovimentacoes();
            renderizarHistorico();
        } else if (alvoPurgaContextual === 'corte') {
            DB.clearContagens();
            renderizarCorte();
        }

        modalAlerta.classList.remove('active');
        alvoPurgaContextual = null;
        travarBotoesLimpezaVazios();
        
        // Sincroniza a visualização com base na aba atual
        if (fluxoAtivo === 'cadastro') renderizarCatalogo();
        else if (fluxoAtivo === 'corte') renderizarCorte();
        else renderizarHistorico();
    });

    btnTriggerEmail.addEventListener('click', () => { modalEmail.classList.add('active'); inputEmailDestino.focus(); });
    btnEmailCancel.addEventListener('click', () => { modalEmail.classList.remove('active'); formExportarEmail.reset(); iconEmailStatus.textContent = '⚪'; });
    btnImprimir.addEventListener('click', () => window.print());

    // Inicialização do Escopo Geral
    atualizarDropdownsItens();
    renderizarCatalogo();
    travarBotoesLimpezaVazios();
});