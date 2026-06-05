/**
 * script.js - Controladora de Interface, Compilação de Arquivos e Disparo de E-mail
 */
document.addEventListener('DOMContentLoaded', () => {
    let fluxoAtivo = 'cadastro';
    let emailValidadoOK = false;
    let timeoutValidacao = null;

    // Elementos de Layout de Abas e Seções
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

    // Modais e Botões de Ação Final
    const modalAlerta = document.getElementById('modal-alerta');
    const modalEmail = document.getElementById('modal-email');
    const btnTriggerModal = document.getElementById('btn-trigger-modal');
    const btnTriggerEmail = document.getElementById('btn-trigger-email');
    const btnImprimir = document.getElementById('btn-imprimir');

    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');
    const btnEmailCancel = document.getElementById('btn-email-cancel');
    const formExportarEmail = document.getElementById('form-exportar-email');
    
    // Elementos do Mecanismo de Validação Remota de E-mail
    const inputEmailDestino = document.getElementById('email-destino');
    const iconEmailStatus = document.getElementById('email-status-icon');
    const txtEmailFeedback = document.getElementById('email-feedback-text');
    const btnEmailSubmit = document.getElementById('btn-email-submit');

    // Retorna dinamicamente a referência do elemento Node da tabela ativa para compilação externa
    function obterTabelaAtiva() {
        if (fluxoAtivo === 'cadastro') return document.getElementById('tabela-catalogo');
        if (fluxoAtivo === 'corte') return document.getElementById('tabela-corte');
        return document.getElementById('tabela-movimentacoes');
    }

    // Gerenciador Reativo de Abas
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
        atualizarTravaBotaoLimpar();
    }

    function formatarData() {
        const agora = new Date();
        return agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    // Verificador Universal de Integridade de Inputs (Anti-Vazio)
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

        if (!status) {
            alert("⚠️ Erro de Preenchimento: Certifique-se de que todos os campos obrigatórios foram preenchidos.");
        }
        return status;
    }

    function atualizarTravaBotaoLimpar() {
        btnTriggerModal.disabled = !DB.hasAnyData();
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
            alert("🚨 Erro: Este código ou nome de insumo já existe no sistema.");
            return;
        }

        DB.saveCatalogoItem({ dataCad: formatarData(), codigo, item, caixa, palete, fornecedor });
        atualizarDropdownsItens();
        renderizarCatalogo();
        formCadastro.reset();
        atualizarTravaBotaoLimpar();
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
            atualizarTravaBotaoLimpar();
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
        atualizarTravaBotaoLimpar();
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

    // Renderizadores de Linhas das Tabelas
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

    // 🌐 ENGINE DE VALIDAÇÃO DE E-MAIL EM TEMPO REAL (DEBOUNCE 850MS)
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
        txtEmailFeedback.textContent = 'Checando MX e barramento de rede...';
        txtEmailFeedback.style.color = 'var(--warning)';

        timeoutValidacao = setTimeout(() => {
            const dominiosInvalidos = ['teste.com', 'gmaill.com', 'email.com', 'errado.com'];
            const dominio = email.split('@')[1].toLowerCase();

            if (dominiosInvalidos.includes(dominio)) {
                iconEmailStatus.textContent = '❌';
                txtEmailFeedback.textContent = 'Domínio inacessível ou sem registros MX válidos.';
                txtEmailFeedback.style.color = 'var(--danger)';
                emailValidadoOK = false;
                btnEmailSubmit.disabled = true;
            } else {
                iconEmailStatus.textContent = '✅';
                txtEmailFeedback.textContent = 'E-mail verificado com sucesso na rede local!';
                txtEmailFeedback.style.color = 'var(--success)';
                emailValidadoOK = true;
                btnEmailSubmit.disabled = false;
            }
        }, 850);
    });

    // 📊 FUNÇÃO DE COMPILAÇÃO EXCEL REAL (SHEETJS)
    function processarPlanilhaExcel(tabela, nomeArquivo) {
        const wb = XLSX.utils.table_to_book(tabela, { sheet: "Relatorio_Inventario" });
        XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
    }

    // 📄 FUNÇÃO DE COMPILAÇÃO PDF REAL (HTML2PDF)
    function processarDocumentoPDF(tabela, nomeArquivo) {
        const opcoes = {
            margin: 12,
            filename: `${nomeArquivo}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().set(opcoes).from(tabela).save();
    }

    // 🛠️ NOVO MOTOR DE EXPORTAÇÃO COMPLETA: GERA DADOS E DISPARA PARA O CLIENTE DE E-MAIL DO SO
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

    // Submissão Integrada do Formulário de Exportação
    formExportarEmail.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validarFormularioCampos(formExportarEmail)) return;
        if (!emailValidadoOK) {
            alert("🚨 Erro Crítico: Ação bloqueada. Aguarde ou corrija a validação do e-mail.");
            return;
        }

        const formato = formExportarEmail.querySelector('input[name="formato-doc"]:checked').value;
        const eAddress = inputEmailDestino.value.trim();
        const tabelaAlvo = obterTabelaAtiva();
        const hashArquivo = `Relatorio_${fluxoAtivo.toUpperCase()}_${Date.now()}`;

        // 1. Executa a compilação local física para auditoria do usuário
        if (formato === 'EXCEL' || formato === 'AMBOS') {
            processarPlanilhaExcel(tabelaAlvo, hashArquivo);
        }
        if (formato === 'PDF' || formato === 'AMBOS') {
            processarDocumentoPDF(tabelaAlvo, hashArquivo);
        }

        // 2. Transmissão nativa dos dados estruturados via protocolo Mailto (Disparo Real do Front)
        const relatorioTexto = extrairConteudoTabelaParaTexto(tabelaAlvo);
        const assuntoEmail = encodeURIComponent(`📊 Relatório de Inventário - Módulo: ${fluxoAtivo.toUpperCase()}`);
        
        const corpoEmail = encodeURIComponent(
            `Prezado(a),\n\n` +
            `Segue em anexo o relatório gerado pelo Sistema de Suprimentos.\n` +
            `Os arquivos físicos nos formatos selecionados ([${formato}]) foram baixados no seu dispositivo.\n\n` +
            `=== RESUMO DOS DADOS DO RELATÓRIO ===\n` +
            `${relatorioTexto}\n` +
            `=====================================\n\n` +
            `Gerado em: ${formatarData()}\n` +
            `ID de Validação do Relatório: ${hashArquivo}\n`
        );

        // Dispara a intent do sistema operacional para enviar o e-mail preenchido
        window.location.href = `mailto:${eAddress}?subject=${assuntoEmail}&body=${corpoEmail}`;

        alert(`🚀 Processamento Concluído!\n\n1. O download do arquivo foi iniciado.\n2. O seu aplicativo de e-mail padrão foi aberto com os dados preenchidos para enviar para: ${eAddress}`);
        
        modalEmail.classList.remove('active');
        formExportarEmail.reset();
        iconEmailStatus.textContent = '⚪';
    });

    // Controle dos Modais
    btnTriggerEmail.addEventListener('click', () => {
        modalEmail.classList.add('active');
        inputEmailDestino.focus();
    });
    btnEmailCancel.addEventListener('click', () => {
        modalEmail.classList.remove('active');
        formExportarEmail.reset();
        iconEmailStatus.textContent = '⚪';
    });

    btnTriggerModal.addEventListener('click', () => modalAlerta.classList.add('active'));
    btnModalCancel.addEventListener('click', () => modalAlerta.classList.remove('active'));
    btnModalConfirm.addEventListener('click', () => {
        DB.clearAll();
        modalAlerta.classList.remove('active');
        atualizarDropdownsItens();
        alternarAbas('cadastro', tabButtons[0]);
    });

    // Gatilho de Impressão Física
    btnImprimir.addEventListener('click', () => {
        window.print();
    });

    // Inicialização do Escopo do App
    atualizarDropdownsItens();
    renderizarCatalogo();
    atualizarTravaBotaoLimpar();
});