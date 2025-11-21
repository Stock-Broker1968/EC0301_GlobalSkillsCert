const API_URL = 'https://ec0301-globalskillscert-backend.onrender.com';

const auth = {
    isLoggedIn: () => !!localStorage.getItem('ec0301_token'),
    
    getToken: () => localStorage.getItem('ec0301_token'),

    login: async (accessCode) => {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: accessCode })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                localStorage.setItem('ec0301_token', data.token || accessCode);
                return { success: true };
            }
            return { success: false, message: data.message || 'Código inválido' };
        } catch (e) {
            return { success: false, message: 'Error de conexión' };
        }
    },

    logout: () => {
        localStorage.removeItem('ec0301_token');
        window.location.href = 'index.html';
    }
};
window.auth = auth;
