<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - SkillsCert EC0301</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .header {
            background: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            flex-wrap: wrap;
            gap: 1rem;
        }
        .logo { display: flex; align-items: center; gap: 1rem; }
        .logo i { font-size: 2rem; color: #6366f1; }
        .logo h1 { font-size: 1.4rem; color: #1e293b; }
        .logo span { display: block; font-size: 0.8rem; color: #64748b; }
        .user-section { display: flex; align-items: center; gap: 1rem; }
        .user-info {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            background: #f1f5f9;
            padding: 0.5rem 1rem;
            border-radius: 30px;
        }
        .user-avatar {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }
        .btn {
            padding: 0.65rem 1.25rem;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        .btn-danger { background: #ef4444; color: white; }
        .btn-danger:hover { background: #dc2626; }
        .container {
            max-width: 1400px;
            margin: 2rem auto;
            padding: 0 2rem;
        }
        .welcome {
            background: white;
            border-radius: 16px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .welcome h2 { font-size: 2rem; color: #6366f1; margin-bottom: 0.5rem; }
        .welcome p { color: #64748b; font-size: 1.1rem; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
        }
        .card {
            background: white;
            border-radius: 16px;
            padding: 1.5rem;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            transition: all 0.3s;
            border: 2px solid transparent;
            text-decoration: none;
            color: inherit;
            display: block;
            cursor: pointer;
        }
        .card:hover {
            transform: translateY(-5px);
            border-color: #6366f1;
            box-shadow: 0 20px 50px rgba(99,102,241,0.2);
        }
        .card.disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .card.disabled:hover {
            transform: none;
            border-color: transparent;
        }
        .card-icon {
            width: 60px;
            height: 60px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1rem;
        }
        .card-icon i { font-size: 1.8rem; color: white; }
        .card-icon.blue { background: linear-gradient(135deg, #6366f1, #4f46e5); }
        .card-icon.green { background: linear-gradient(135deg, #10b981, #059669); }
        .card-icon.orange { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .card-icon.red { background: linear-gradient(135deg, #ef4444, #dc2626); }
        .card-icon.purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
        .card h3 { font-size: 1.2rem; color: #1e293b; margin-bottom: 0.5rem; }
        .card p { color: #64748b; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1rem; }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.4rem 0.8rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-info { background: #dbeafe; color: #1e40af; }
        .footer {
            text-align: center;
            padding: 2rem;
            color: rgba(255,255,255,0.8);
        }
        @media (max-width: 768px) {
            .header { flex-direction: column; text-align: center; }
            .user-section { flex-direction: column; }
            .grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="logo">
            <i class="fas fa-graduation-cap"></i>
            <div>
                <h1>SkillsCert EC0301</h1>
                <span>Panel de Control</span>
            </div>
        </div>
        <div class="user-section">
            <div class="user-info">
                <div class="user-avatar" id="userAvatar">U</div>
                <span id="userName">Usuario</span>
            </div>
            <button class="btn btn-danger" id="btnLogout">
                <i class="fas fa-sign-out-alt"></i>
                Cerrar Sesión
            </button>
        </div>
    </header>

    <main class="container">
        <section class="welcome">
            <h2>¡Bienvenido al Sistema EC0301!</h2>
            <p>Selecciona un módulo para comenzar a diseñar tus cursos de capacitación presencial</p>
        </section>

        <div class="grid">
            <!-- CARTA DESCRIPTIVA -->
            <a href="carta-descriptiva.html" class="card">
                <div class="card-icon blue">
                    <i class="fas fa-file-contract"></i>
                </div>
                <h3>Carta Descriptiva</h3>
                <p>Diseña el documento central con objetivos, tiempos, técnicas, evaluaciones y requerimientos según EC0301.</p>
                <span class="badge badge-success">
                    <i class="fas fa-check-circle"></i>
                    Disponible
                </span>
            </a>

            <!-- MANUAL DEL INSTRUCTOR -->
            <div class="card disabled" onclick="showComingSoon('Manual del Instructor')">
                <div class="card-icon green">
                    <i class="fas fa-chalkboard-teacher"></i>
                </div>
                <h3>Manual del Instructor</h3>
                <p>Genera la guía de conducción del curso con estrategias didácticas y recomendaciones metodológicas.</p>
                <span class="badge badge-warning">
                    <i class="fas fa-clock"></i>
                    Próximamente
                </span>
            </div>

            <!-- MANUAL DEL PARTICIPANTE -->
            <div class="card disabled" onclick="showComingSoon('Manual del Participante')">
                <div class="card-icon orange">
                    <i class="fas fa-user-graduate"></i>
                </div>
                <h3>Manual del Participante</h3>
                <p>Crea la versión pedagógica con ejercicios, glosario y espacios para notas y reflexiones.</p>
                <span class="badge badge-warning">
                    <i class="fas fa-clock"></i>
                    Próximamente
                </span>
            </div>

            <!-- EVALUACIONES -->
            <div class="card disabled" onclick="showComingSoon('Instrumentos de Evaluación')">
                <div class="card-icon red">
                    <i class="fas fa-clipboard-check"></i>
                </div>
                <h3>Instrumentos de Evaluación</h3>
                <p>Genera evaluaciones diagnóstica, formativa, sumativa y de satisfacción basadas en los objetivos.</p>
                <span class="badge badge-warning">
                    <i class="fas fa-clock"></i>
                    Próximamente
                </span>
            </div>

            <!-- CONTRATO -->
            <div class="card disabled" onclick="showComingSoon('Contrato de Aprendizaje')">
                <div class="card-icon purple">
                    <i class="fas fa-handshake"></i>
                </div>
                <h3>Contrato de Aprendizaje</h3>
                <p>Formaliza los compromisos entre participante e instructor con derechos y responsabilidades.</p>
                <span class="badge badge-warning">
                    <i class="fas fa-clock"></i>
                    Próximamente
                </span>
            </div>

            <!-- LISTA DE ASISTENCIA -->
            <div class="card disabled" onclick="showComingSoon('Lista de Asistencia')">
                <div class="card-icon blue">
                    <i class="fas fa-list-check"></i>
                </div>
                <h3>Lista de Asistencia</h3>
                <p>Genera el formato con firmas, horarios y observaciones para evidenciar participación.</p>
                <span class="badge badge-warning">
                    <i class="fas fa-clock"></i>
                    Próximamente
                </span>
            </div>

            <!-- LISTA DE VERIFICACIÓN -->
            <div class="card disabled" onclick="showComingSoon('Lista de Verificación')">
                <div class="card-icon green">
                    <i class="fas fa-tasks"></i>
                </div>
                <h3>Lista de Verificación</h3>
                <p>Verifica disponibilidad de equipo, materiales y espacio antes del inicio del curso.</p>
                <span class="badge badge-warning">
                    <i class="fas fa-clock"></i>
                    Próximamente
                </span>
            </div>

            <!-- PORTAFOLIO -->
            <div class="card disabled" onclick="showComingSoon('Portafolio de Evidencias')">
                <div class="card-icon orange">
                    <i class="fas fa-folder-open"></i>
                </div>
                <h3>Portafolio de Evidencias</h3>
                <p>Integra todos los productos en un portafolio listo para el Evaluador Certificado EC0301.</p>
                <span class="badge badge-warning">
                    <i class="fas fa-clock"></i>
                    Próximamente
                </span>
            </div>
        </div>
    </main>

    <footer class="footer">
        <p>© 2024 SkillsCert EC0301 - Sistema profesional de diseño de cursos de capacitación</p>
        <p style="margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.8;">
            Desarrollado bajo los estándares del CONOCER para certificación de competencias
        </p>
    </footer>

    <script>
        // Verificar autenticación
        document.addEventListener('DOMContentLoaded', function() {
            const isAuth = localStorage.getItem('ec0301_auth');
            
            if (isAuth !== 'true') {
                // No está autenticado, redirigir al login
                window.location.href = 'acceso.html';
                return;
            }
            
            // Cargar datos del usuario
            try {
                const userData = JSON.parse(localStorage.getItem('ec0301_user'));
                if (userData && userData.nombre) {
                    document.getElementById('userName').textContent = userData.nombre;
                    document.getElementById('userAvatar').textContent = userData.nombre.charAt(0).toUpperCase();
                }
            } catch(e) {
                console.log('Error al cargar datos de usuario');
            }
        });
        
        // Cerrar sesión
        document.getElementById('btnLogout').addEventListener('click', function() {
            if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
                localStorage.removeItem('ec0301_auth');
                localStorage.removeItem('ec0301_user');
                window.location.href = 'acceso.html';
            }
        });
        
        // Mostrar mensaje de próximamente
        function showComingSoon(moduleName) {
            alert('🔒 ' + moduleName + '\n\nEste módulo estará disponible próximamente.\n\nPor ahora, utiliza la Carta Descriptiva para comenzar tu diseño instruccional.');
        }
    </script>
</body>
</html>
