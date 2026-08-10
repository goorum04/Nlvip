export const metadata = {
  title: 'Soporte — NL VIP Team',
  description: 'Centro de ayuda y contacto de la aplicación NL VIP Team',
}

const faqs = [
  {
    q: '¿Cómo registro mi peso o medidas?',
    a: 'Ve a la pestaña "Progreso" dentro de la app y rellena el formulario de medidas.',
  },
  {
    q: '¿Cómo veo mi dieta o rutina?',
    a: 'En las pestañas "Dieta" y "Rutina" encontrarás el plan actual que te ha asignado tu entrenador.',
  },
  {
    q: '¿Olvidé mi contraseña, qué hago?',
    a: 'En la pantalla de inicio de sesión pulsa "¿Olvidaste tu contraseña?" e introduce tu email. Te enviaremos un enlace para crear una nueva.',
  },
  {
    q: '¿Cómo canjeo mi código de invitación?',
    a: 'Puedes introducirlo al registrarte, en el campo "Código de Invitación" (opcional). Si ya tienes cuenta, contacta con soporte para activarlo.',
  },
  {
    q: '¿Cómo elimino mi cuenta y mis datos?',
    a: 'Escríbenos a soporte indicando el email de tu cuenta y eliminaremos tus datos en un plazo máximo de 30 días.',
  },
]

export default function Support() {
  return (
    <div className="min-h-screen bg-[#030303] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-violet-400">Soporte</h1>
        <p className="text-gray-400 mb-8">¿En qué podemos ayudarte con NL VIP Team?</p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-white mb-3">Contacto directo</h2>
          <div className="space-y-2 text-gray-300">
            <p>
              Email:{' '}
              <a href="mailto:support@nlvipnutrition.com" className="text-violet-400 hover:text-violet-300">
                support@nlvipnutrition.com
              </a>
            </p>
            <p>
              Instagram:{' '}
              <a
                href="https://instagram.com/nlvipteam"
                target="_blank"
                rel="noreferrer"
                className="text-violet-400 hover:text-violet-300"
              >
                @nlvipteam
              </a>
            </p>
          </div>
          <p className="text-gray-500 text-sm mt-3">
            Respondemos por email en un plazo máximo de 48 horas laborables.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl">
                <p className="font-semibold text-violet-300 mb-1">{faq.q}</p>
                <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 pt-6 border-t border-white/10">
          <p className="text-gray-500 text-sm">© 2025 NL VIP TEAM. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  )
}
