const PAYMENT_API = 'https://ec0301-globalskillscert-backend.onrender.com';

const payment = {
    startCheckout: async (email, nombre, telefono) => {
        try {
            Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
            
            const response = await fetch(`${PAYMENT_API}/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, nombre, telefono, courseName: 'Certificación EC0301' })
            });
            
            const data = await response.json();
            
            if (data.url) window.location.href = data.url;
            else throw new Error(data.error || 'Error al crear pago');
            
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'No se pudo conectar con el servidor de pagos', 'error');
        }
    }
};
window.payment = payment;
