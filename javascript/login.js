/**
 * login.js - Lógica Controladora do Hub de Autenticação baseada em ciclos semanais (Terças)
 */
const ADMIN_HASH = btoa('0448000363'); 

function calcularDiasAteTerca() {
    const el = document.getElementById('banner-contagem-index');
    if (!el) return;

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const diaSemana = hoje.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua...

    // Lógica determinística para próxima terça-feira
    let diasFaltando = (2 - diaSemana + 7) % 7;
    
    const proximaTerca = new Date(hoje);
    proximaTerca.setDate(hoje.getDate() + diasFaltando);
    
    if (diasFaltando === 0) {
        el.innerHTML = `🚨 DIA DE BALANÇO: Terça-feira de inventário rotativo ativo hoje (${proximaTerca.toLocaleDateString('pt-BR')})!`;
        el.classList.add('danger'); 
    } else {
        el.innerHTML = `🗓️ Próximo Inventário Geral: Terça-feira ${proximaTerca.toLocaleDateString('pt-BR')} (Faltam <strong>${diasFaltando} dias</strong>)`;
        el.classList.remove('danger');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    calcularDiasAteTerca();
    
    const select = document.getElementById('perfil-select');
    const pwdArea = document.getElementById('password-area');
    const senhaInput = document.getElementById('input-senha');

    select.addEventListener('change', () => {
        if(select.value === 'administrador') {
            pwdArea.style.display = 'block';
            senhaInput.setAttribute('required', 'required');
        } else {
            pwdArea.style.display = 'none';
            senhaInput.removeAttribute('required');
            senhaInput.value = '';
        }
    });

    document.getElementById('form-auth').addEventListener('submit', (e) => {
        e.preventDefault();
        if(select.value === 'administrador' && btoa(senhaInput.value) !== ADMIN_HASH) {
            alert('❌ Senha de Administrador Incorreta!');
            return;
        }
        sessionStorage.setItem('perfil_ativo', select.value);
        window.location.href = 'dashboard.html';
    });
});