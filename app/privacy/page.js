export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#030303] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-violet-400">Política de Privacidad</h1>
        <p className="text-gray-400 mb-4">Última actualización: Enero 2025</p>
        
        <div className="space-y-6 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">1. Información que Recopilamos</h2>
            <p>NL VIP CLUB recopila la siguiente información:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Información de registro: nombre, correo electrónico, teléfono</li>
              <li>Datos de perfil: foto, fecha de nacimiento</li>
              <li>Datos de actividad: rutinas, progreso, fotos de progreso</li>
              <li>Datos de nutrición: registro de comidas, recetas guardadas</li>
              <li>Datos de actividad física: contador de pasos (si se activa)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">2. Uso de la Información</h2>
            <p>Utilizamos tu información para:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Proporcionar y personalizar nuestros servicios de fitness</li>
              <li>Permitir la comunicación entre socios y entrenadores</li>
              <li>Hacer seguimiento de tu progreso físico</li>
              <li>Mejorar nuestros servicios y experiencia de usuario</li>
              <li>Enviar notificaciones relacionadas con tu entrenamiento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">3. Compartir Información</h2>
            <p>Tu información puede ser compartida con:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Tu entrenador asignado (para personalizar tu plan)</li>
              <li>Administradores del gimnasio (para gestión del servicio)</li>
              <li>Otros socios (solo contenido que publiques en el feed social)</li>
            </ul>
            <p className="mt-2">No vendemos ni compartimos tu información personal con terceros para fines publicitarios.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">4. Almacenamiento y Seguridad</h2>
            <p>Tus datos se almacenan de forma segura utilizando:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Cifrado en tránsito (HTTPS/TLS)</li>
              <li>Bases de datos seguras con acceso restringido</li>
              <li>Autenticación segura para acceder a tu cuenta</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">5. Tus Derechos</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Acceder a tus datos personales</li>
              <li>Modificar tu información de perfil</li>
              <li>Eliminar tu cuenta y todos tus datos</li>
              <li>Exportar tus datos</li>
            </ul>
            <p className="mt-2">Puedes ejercer estos derechos desde la sección de perfil en la app o contactándonos directamente.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">6. Cookies y Tecnologías Similares</h2>
            <p>Utilizamos cookies y almacenamiento local para:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Mantener tu sesión iniciada</li>
              <li>Recordar tus preferencias</li>
              <li>Mejorar el rendimiento de la aplicación</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">7. Menores de Edad</h2>
            <p>NL VIP CLUB no está dirigido a menores de 16 años. No recopilamos intencionalmente información de menores sin el consentimiento de sus padres o tutores.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">8. Cambios en esta Política</h2>
            <p>Podemos actualizar esta política ocasionalmente. Te notificaremos de cambios significativos a través de la aplicación o por correo electrónico.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">9. Contacto</h2>
            <p>Si tienes preguntas sobre esta política de privacidad, puedes contactarnos en:</p>
            <p className="mt-2 text-violet-400">contacto@nlvipclub.com</p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10">
          <p className="text-gray-500 text-sm">© 2025 NL VIP CLUB. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  )
}
