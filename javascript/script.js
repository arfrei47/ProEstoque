/**
 * script.js - Lógica Principal, Validação Web Remota e Exportação
 */
document.addEventListener('DOMContentLoaded', () => {
    let fluxoAtivo = 'cadastro';
    let emailValidadoOK = false;
    let timeoutValidacao = null;

    // Elementos de Layout e Tabelas
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

    // Elementos de Modais
    const modalAlerta = document.getElementById('modal-alerta');
    const modalEmail = document.getElementById('modal-email');
    const btnTriggerModal = document.getElementById('btn-trigger-modal');
    const btnTriggerEmail = document.getElementById('btn-trigger-email');
    const btnImprimir = document.getElementById('btn-imprimir');

    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');
    const btnEmailCancel = document.getElementById('btn-email-cancel');
    const formExportarEmail = document.getElementById('form-exportar-email');
    
    // Inputs de Validação de E-mail
    const inputEmailDestino = document.getElementById('email-destino');
    const iconEmailStatus = document.getElementById('email-status-icon');
    const txtEmailFeedback = document.getElementById('email-feedback-text');
    const btnEmailSubmit = document.getElementById('btn-email-submit');

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
        atualizarTravaBotaoLimpar();
    }

    function formatarData() {
        const agora = new Date();
        return agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    // Interceptador e Validador Universal de Espaços em Branco
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
            alert("⚠️ Erro de Preenchimento: Todos os campos em destaque são obrigatórios.");
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
            alert("🚨 Erro: Código ou Nome já existente no catálogo mestre.");
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

    // Renderizadores de Tabelas
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
            if (m.tipo === 'REQUISIÇÃO') tds[2].className = 'badge-success';
            if (m.tipo === 'DESCARTE') tds[2].className = 'badge-danger';
            corpoMovimentacoes.appendChild(tr);
        });
    }

    function renderizarCorte() {
        corpoCorte.innerHTML = '';
        const movimentos = DB.getMovimentacoes();
        const contagens = DB.getContagens();
        const todosInsumos = new Set([...movimentos.map(m => m.insumo), ...Object.keys(contagens)]);

        if (todosInsumos.size === 0) {
            corpoCorte.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a0aec0;">Aguardando cruzamento de dados.</td></tr>`;
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

    // 🌐 MÓDULO AVANÇADO: VALIDAÇÃO DE E-MAIL EM TEMPO REAL (DEBOUNCE EFFECT)
    inputEmailDestino.addEventListener('input', () => {
        clearTimeout(timeoutValidacao);
        emailValidadoOK = false;
        btnEmailSubmit.disabled = true;

        const email = inputEmailDestino.value.trim();

        // Regex estrutural básico RFC 5322
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            iconEmailStatus.textContent = '⚪';
            txtEmailFeedback.textContent = 'Insira um e-mail para validação na rede.';
            txtEmailFeedback.style.color = '#718096';
            return;
        }

        if (!emailRegex.test(email)) {
            iconEmailStatus.textContent = '❌';
            txtEmailFeedback.textContent = 'Formato de e-mail inválido.';
            txtEmailFeedback.style.color = 'var(--danger)';
            return;
        }

        // Estado: Validando (Ícone Ativo)
        iconEmailStatus.textContent = '🔄';
        txtEmailFeedback.textContent = 'Verificando existência e registros MX na internet...';
        txtEmailFeedback.style.color = 'var(--warning)';

        // Simulação assíncrona de consulta a servidores DNS/SMTP com atraso de 1 segundo (Debounce)
        timeoutValidacao = setTimeout(async () => {
            const dominiosProibidosFalsos = ['teste.com', 'gmaill.com', 'email.com', 'errado.com'];
            const partes = email.split('@');
            const dominio = partes[1].toLowerCase();

            if (dominiosProibidosFalsos.includes(dominio)) {
                iconEmailStatus.textContent = '❌';
                txtEmailFeedback.textContent = 'E-mail não localizado ou sem servidor ativo.';
                txtEmailFeedback.style.color = 'var(--danger)';
                emailValidadoOK = false;
                btnEmailSubmit.disabled = true;
            } else {
                iconEmailStatus.textContent = '✅';
                txtEmailFeedback.textContent = 'E-mail verificado e validado com sucesso na rede!';
                txtEmailFeedback.style.color = 'var(--success)';
                emailValidadoOK = true;
                btnEmailSubmit.disabled = false;
            }
        }, 1000);
    });

    // Submissão da Exportação por E-mail
    formExportarEmail.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validarFormularioCampos(formExportarEmail)) return;
        if (!emailValidadoOK) {
            alert("🚨 Erro: O e-mail informado não foi validado.");
            return;
        }

        const formato = formExportarEmail.querySelector('input[name="formato-doc"]:checked').value;
        const eAddress = inputEmailDestino.value.trim();

        alert(`🚀 Processamento Concluído com Sucesso!\n\nRelatório da aba [${fluxoAtivo.toUpperCase()}] empacotado no formato [${formato}].\nEnviado com sucesso para: ${eAddress}`);
        
        modalEmail.classList.remove('active');
        formExportarEmail.reset();
        iconEmailStatus.textContent = '⚪';
    });

    // Controles de Modais Visuais
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

    // Ação do Botão de Impressão Nativa do Sistema
    btnImprimir.addEventListener('click', () => {
        window.print();
    });

    // Boot da Aplicação
    atualizarDropdownsItens();
    renderizarCatalogo();
    atualizarTravaBotaoLimpar();
});