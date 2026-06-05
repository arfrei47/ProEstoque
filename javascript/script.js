/**
 * script.js - Lógica com validação manual de brancos e Menu Suspenso Sincronizado
 */
document.addEventListener('DOMContentLoaded', () => {
    let fluxoAtivo = 'cadastro';

    // Seletores de Interface das Tabelas e Títulos
    const tabButtons = document.querySelectorAll('.tab-btn');
    const formPanels = document.querySelectorAll('.form-panel');
    const painelDireitoTitulo = document.getElementById('titulo-painel-direito');
    const containerCatalogo = document.getElementById('container-tabela-catalogo');
    const containerGeral = document.getElementById('container-tabela-geral');
    const containerCorte = document.getElementById('container-tabela-corte');
    
    // Seletores dos Corpos de Tabelas
    const corpoCatalogo = document.getElementById('corpo-catalogo');
    const corpoMovimentacoes = document.getElementById('corpo-movimentacoes');
    const corpoCorte = document.getElementById('corpo-corte');
    const dropdownsInsumos = document.querySelectorAll('select[id$="-insumo"], .select-insumo');

    // Seletores dos Modais
    const modalAlerta = document.getElementById('modal-alerta');
    const btnTriggerModal = document.getElementById('btn-trigger-modal');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');

    // Inicialização e gerenciamento das abas
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const alvo = e.target.getAttribute('data-fluxo');
            alternarAbas(alvo, e.target);
        });
    });

    function alternarAbas(fluxo, botaoAlvo) {
        fluxoAtivo = fluxo;

        tabButtons.forEach(b => b.classList.remove('active'));
        botaoAlvo.classList.add('active');

        formPanels.forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${fluxo}`).classList.add('active');

        // Esconde todas as tabelas antes de mostrar a correta
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
    }

    function formatarData() {
        const agora = new Date();
        return agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    // Função de validação customizada exigida pela regra de negócio
    function validarFormularioCampos(formElement) {
        const inputs = formElement.querySelectorAll('input, select');
        let formValido = true;

        inputs.forEach(campo => {
            if (!campo.value.trim()) {
                formValido = false;
                campo.style.borderColor = 'var(--danger)';
            } else {
                campo.style.borderColor = 'var(--border)';
            }
        });

        if (!formValido) {
            alert("⚠️ Ação Interrompida: Existem espaços em branco no formulário. Por favor, preencha todos os campos.");
        }
        return formValido;
    }

    // Atualiza todos os dropdowns (selects) com os itens do catálogo
    function atualizarDropdownsItens() {
        const itens = DB.getCatalogo();
        
        dropdownsInsumos.forEach(select => {
            // Preserva a primeira opção informativa padrão
            select.innerHTML = '<option value="">-- Selecione um Item --</option>';
            
            itens.forEach(it => {
                const opt = document.createElement('option');
                opt.value = it.item;
                opt.textContent = `${it.codigo} - ${it.item}`;
                select.appendChild(opt);
            });
        });
    }

    // Evento do Formulário de Cadastro de Itens
    const formCadastro = document.getElementById('form-cadastro');
    formCadastro.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validarFormularioCampos(formCadastro)) return;

        const codigo = document.getElementById('cad-codigo').value.trim().toUpperCase();
        const item = document.getElementById('cad-item').value.trim().toUpperCase();
        const caixa = parseInt(document.getElementById('cad-caixa').value) || 0;
        const palete = parseInt(document.getElementById('cad-palete').value) || 0;
        const fornecedor = document.getElementById('cad-fornecedor').value.trim().toUpperCase();

        // Evita duplicidade de código ou nome no catálogo
        const catalogoAtual = DB.getCatalogo();
        if (catalogoAtual.some(i => i.codigo === codigo || i.item === item)) {
            alert("🚨 Erro: Já existe um item cadastrado com este código ou nome.");
            return;
        }

        DB.saveCatalogoItem({
            dataCad: formatarData(),
            codigo,
            item,
            caixa,
            palete,
            fornecedor
        });

        atualizarDropdownsItens();
        renderizarCatalogo();
        formCadastro.reset();
        document.getElementById('cad-codigo').focus();
    });

    // Eventos de Movimentações (Formulários 1, 2 e 3)
    ['requisicao', 'descarte', 'retorno'].forEach(tipo => {
        const form = document.getElementById(`form-${tipo}`);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!validarFormularioCampos(form)) return;

            const select = form.querySelector('select');
            const insumo = select.value;
            const qtd = parseInt(form.querySelector('.input-qtd').value) || 0;
            
            const mapeamentoTipos = {
                'requisicao': 'REQUISIÇÃO',
                'descarte': 'DESCARTE',
                'retorno': 'RETORNO'
            };

            DB.saveMovimentacao({
                data: formatarData(),
                insumo,
                tipo: mapeamentoTipos[tipo],
                quantidade: qtd
            });

            renderizarHistorico();
            form.reset();
        });
    });

    // Evento do Formulário de Corte (4)
    const formCorte = document.getElementById('form-corte');
    formCorte.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validarFormularioCampos(formCorte)) return;

        const insumo = document.getElementById('corte-insumo').value;
        const qtdFisica = parseInt(document.getElementById('corte-qtd').value) || 0;

        // Salva a quantidade física E registra a data/hora exata do cruzamento exigida
        DB.saveCorte(insumo, {
            quantidade: qtdFisica,
            dataValidacao: formatarData()
        });

        renderizarCorte();
        formCorte.reset();
    });

    function calcularSaldoLogico(insumoNome) {
        const movimentos = DB.getMovimentacoes();
        return movimentos.reduce((acc, m) => {
            if (m.insumo === insumoNome) {
                if (m.tipo === 'REQUISIÇÃO') acc += m.quantidade;
                if (m.tipo === 'DESCARTE') acc -= m.quantidade;
                if (m.tipo === 'RETORNO') acc -= m.quantidade;
            }
            return acc;
        }, 0);
    }

    // Renderizações Seguras (Proteção XSS)
    function renderizarCatalogo() {
        corpoCatalogo.innerHTML = '';
        const itens = DB.getCatalogo();

        if (itens.length === 0) {
            corpoCatalogo.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a0aec0;">Nenhum item cadastrado no catálogo.</td></tr>`;
            return;
        }

        [...itens].reverse().forEach(i => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color:#718096; font-size:0.85rem"></td>
                <td></td>
                <td><strong></strong></td>
                <td></td>
                <td></td>
                <td></td>
            `;
            const tds = tr.querySelectorAll('td');
            tds[0].textContent = i.dataCad;
            tds[1].textContent = i.codigo;
            tr.querySelector('strong').textContent = i.item;
            tds[3].textContent = i.caixa;
            tds[4].textContent = i.palete;
            tds[5].textContent = i.fornecedor;
            corpoCatalogo.appendChild(tr);
        });
    }

    function renderizarHistorico() {
        corpoMovimentacoes.innerHTML = '';
        const lista = DB.getMovimentacoes();

        if (lista.length === 0) {
            corpoMovimentacoes.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#a0aec0;">Nenhum registro de movimentação encontrado.</td></tr>`;
            return;
        }

        [...lista].reverse().forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="font-size:0.85rem; color:#718096"></td><td><strong></strong></td><td></td><td></td>`;
            const tds = tr.querySelectorAll('td');
            
            tds[0].textContent = m.data;
            tr.querySelector('strong').textContent = m.insumo;
            tds[2].textContent = m.tipo;
            tds[3].textContent = m.quantidade;

            if (m.tipo === 'REQUISIÇÃO') tds[2].className = 'badge-success';
            if (m.tipo === 'DESCARTE') tds[2].className = 'badge-danger';
            if (m.tipo === 'RETORNO') tds[2].style.cssText = 'color: var(--primary); font-weight:600;';

            corpoMovimentacoes.appendChild(tr);
        });
    }

    function renderizarCorte() {
        corpoCorte.innerHTML = '';
        const movimentos = DB.getMovimentacoes();
        const contagens = DB.getContagens();

        const todosInsumos = new Set([
            ...movimentos.map(m => m.insumo),
            ...Object.keys(contagens)
        ]);

        if (todosInsumos.size === 0) {
            corpoCorte.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a0aec0;">Nenhum dado cruzado disponível.</td></tr>`;
            return;
        }

        todosInsumos.forEach(insumo => {
            const saldoLogico = calcularSaldoLogico(insumo);
            const payloadCorte = contagens[insumo] || null;

            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="font-size:0.85rem; color:#718096">-</td><td><strong></strong></td><td></td><td></td><td></td><td></td>`;
            const tds = tr.querySelectorAll('td');

            tr.querySelector('strong').textContent = insumo;
            tds[2].textContent = saldoLogico;

            if (payloadCorte !== null) {
                const contagemFisica = payloadCorte.quantidade;
                const divVal = contagemFisica - saldoLogico;

                tds[0].textContent = payloadCorte.dataValidacao; // Inclusão de Data e Hora exigida no Corte
                tds[3].textContent = contagemFisica;
                tds[4].textContent = divVal > 0 ? `+${divVal}` : divVal;

                if (divVal === 0) {
                    tds[5].textContent = "✅ OK";
                    tr.className = "row-ok";
                } else {
                    tds[5].textContent = divVal > 0 ? "⚠️ Sobra Física" : "🚨 Falta Física";
                    tr.className = "row-divergent";
                }
            } else {
                tds[3].textContent = 'Não contado';
                tds[3].style.color = '#cbd5e0';
                tds[4].textContent = '-';
                tds[5].textContent = '-';
            }

            corpoCorte.appendChild(tr);
        });
    }

    // Modais e Exclusão Segura
    btnTriggerModal.addEventListener('click', () => {
        modalAlerta.classList.add('active');
        btnModalCancel.focus();
    });

    const fecharModal = () => modalAlerta.classList.remove('active');
    btnModalCancel.addEventListener('click', fecharModal);

    btnModalConfirm.addEventListener('click', () => {
        DB.clearAll();
        fecharModal();
        atualizarDropdownsItens();
        
        if (fluxoAtivo === 'cadastro') renderizarCatalogo();
        else if (fluxoAtivo === 'corte') renderizarCorte();
        else renderizarHistorico();
    });

    // Boot Inicial do Sistema
    atualizarDropdownsItens();
    renderizarCatalogo();
});