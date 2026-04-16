export const metadata = {
  title: 'Política de Privacidad — NL VIP TEAM',
  title: 'Política de Privacidad — NL VIP Club',
  description: 'Política de privacidad de la aplicación NL VIP Club',
}

export default function Privacy() {
  return (
    <main style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', lineHeight: '1.7', color: '#222' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Política de Privacidad</h1>
      <p><strong>Aplicación:</strong> NL VIP Club</p>
      <p><strong>Fecha de entrada en vigor:</strong> Enero 2025</p>
      <p><strong>Última actualización:</strong> Abril 2025</p>
      <p><strong>Desarrollador:</strong> NL VIP Nutrition S.L.</p>
      <p><strong>Contacto:</strong> <a href="mailto:support@nlvipnutrition.com">support@nlvipnutrition.com</a></p>

      <hr style={{ margin: '2rem 0' }} />

      <h2>1. Información que recopilamos</h2>
      <p>Recopilamos los siguientes tipos de datos con el fin de ofrecer el servicio de gestión de nutrición y entrenamiento personalizado:</p>
      <ul>
        <li><strong>Datos de identificación:</strong> nombre, correo electrónico.</li>
        <li><strong>Datos físicos y de salud:</strong> peso, altura, porcentaje de grasa corporal, medidas corporales (cintura, pecho, caderas, glúteos, gemelos, etc.), objetivo fitness y nivel de actividad.</li>
        <li><strong>Datos de Apple HealthKit:</strong> pasos diarios (solo lectura). Esta información se usa exclusivamente para mostrar tu actividad diaria dentro de la app y ajustar tus objetivos calóricos. <strong>NL VIP TEAM no comparte datos de HealthKit con terceros.</strong></li>
        <li><strong>Datos de audio:</strong> mensajes de voz enviados en el chat con el entrenador, y comandos de voz utilizados con el asistente IA de gestión. El audio se procesa mediante servicios de transcripción de inteligencia artificial (OpenAI **Whisper**) con fines exclusivos de funcionalidad técnica.</li>
        <li><strong>Datos de actividad:</strong> registros de entrenamiento, registros de comida, progreso de medidas y fotos de progreso.</li>
        <li><strong>Datos de notificaciones:</strong> token de dispositivo para el envío de notificaciones push relacionadas con el servicio (recordatorios de entrenamiento, mensajes del entrenador, actualizaciones de plan).</li>
      </ul>

      <h2>2. Inteligencia Artificial y Procesamiento de Datos</h2>
      <p>NL VIP TEAM utiliza modelos de Inteligencia Artificial avanzados para asistir a los entrenadores en la creación de planes personalizados:</p>
      <ul>
        <li><strong>Modelos utilizados:</strong> Utilizamos específicamente los modelos **GPT-4o** y **Whisper** de OpenAI.</li>
        <li><strong>Supervisión Humana (Human-in-the-loop):</strong> Todos los planes de dieta y entrenamiento generados con asistencia de IA son **revisados, editados y aprobados por un entrenador cualificado humano** antes de ser asignados al socio. La IA actúa únicamente como una herramienta de apoyo al profesional.</li>
        <li><strong>Anonimización:</strong> Los datos enviados a los modelos de OpenAI para cálculos nutricionales no incluyen nombres reales, apellidos ni direcciones de correo electrónico. Los datos se envían de forma seudonimizada mediante identificadores internos.</li>
        <li><strong>No Entrenamiento:</strong> Según nuestros acuerdos con proveedores, los datos de los usuarios de NL VIP TEAM **no se utilizan para entrenar los modelos globales** de OpenAI.</li>
      </ul>

      <h2>3. Uso de la información</h2>
      <p>Los datos recopilados se utilizan exclusivamente para:</p>
      <ul>
        <li>Personalizar planes de nutrición y entrenamiento.</li>
        <li>Mostrar el progreso físico y de actividad del usuario.</li>
        <li>Facilitar la comunicación entre el socio y su entrenador asignado.</li>
        <li>Enviar notificaciones relacionadas con el servicio contratado.</li>
        <li>Mejorar la funcionalidad de la aplicación.</li>
      </ul>
      <p><strong>No utilizamos los datos para publicidad, ni los vendemos a terceros.</strong></p>

      <h2>3. Datos de salud (HealthKit)</h2>
      <p>NL VIP TEAM puede leer datos de Apple HealthKit, específicamente el recuento de pasos diarios. El acceso se solicita de forma explícita y el usuario puede revocarlo en cualquier momento desde los ajustes de su iPhone (Ajustes → Privacidad y seguridad → Salud).</p>
      <p>Los datos de HealthKit:</p>
      <ul>
        <li>Se almacenan de forma segura en nuestros servidores (Supabase, ubicados en la UE).</li>
        <li><strong>No se comparten con terceros.</strong></li>
        <li>No se utilizan para publicidad ni para analítica externa.</li>
        <li>Pueden eliminarse en cualquier momento a petición del usuario.</li>
      </ul>

      <h2>4. Micrófono y reconocimiento de voz</h2>
      <p>La app solicita acceso al micrófono para dos funcionalidades específicas:</p>
      <ul>
        <li><strong>Mensajes de voz en el chat:</strong> el usuario puede grabar y enviar mensajes de audio a su entrenador.</li>
        <li><strong>Asistente IA por voz (solo administradores):</strong> el administrador del gimnasio puede dar comandos de voz al asistente de gestión. El audio se transcribe mediante la API de OpenAI (Whisper) y no se almacena de forma permanente una vez procesado.</li>
      </ul>
      <p>El acceso al micrófono puede revocarse en cualquier momento desde Ajustes → Privacidad y seguridad → Micrófono.</p>

      <h2>5. Notificaciones push</h2>
      <p>Con tu consentimiento, enviamos notificaciones push para informarte sobre mensajes de tu entrenador, recordatorios de entrenamiento y actualizaciones de tu plan. Puedes desactivarlas en cualquier momento desde los ajustes de notificaciones de tu iPhone.</p>

      <h2>6. Servicios de terceros</h2>
      <p>Utilizamos los siguientes servicios externos, cada uno con su propia política de privacidad:</p>
      <ul>
        <li><strong>Supabase</strong> (base de datos y autenticación) — <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">supabase.com/privacy</a></li>
        <li><strong>OpenAI</strong> (asistente IA y transcripción de voz) — <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noreferrer">openai.com/policies/privacy-policy</a></li>
        <li><strong>Vercel</strong> (hosting de la aplicación web) — <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">vercel.com/legal/privacy-policy</a></li>
        <li><strong>Apple HealthKit</strong> — <a href="https://www.apple.com/legal/privacy/" target="_blank" rel="noreferrer">apple.com/legal/privacy</a></li>
      </ul>

      <h2>7. Seguridad</h2>
      <p>Aplicamos medidas de seguridad técnicas y organizativas adecuadas, incluyendo cifrado en tránsito (HTTPS/TLS) y en reposo, control de acceso por roles y autenticación segura.</p>

      <h2>8. Retención de datos</h2>
      <p>Los datos se conservan mientras el usuario mantenga su cuenta activa. Tras la cancelación, los datos se eliminan en un plazo máximo de 30 días, salvo obligación legal de conservarlos por más tiempo.</p>

      <h2>9. Derechos del usuario</h2>
      <p>El usuario tiene derecho a:</p>
      <ul>
        <li>Acceder a sus datos personales.</li>
        <li>Solicitar la rectificación o eliminación de sus datos.</li>
        <li>Retirar el consentimiento en cualquier momento.</li>
        <li>Presentar una reclamación ante la autoridad de control competente.</li>
      </ul>
      <p>Para ejercer estos derechos, escribe a: <a href="mailto:support@nlvipnutrition.com">support@nlvipnutrition.com</a></p>

      <h2>10. Menores de edad</h2>
      <p>La aplicación está dirigida a personas mayores de 16 años. No recopilamos conscientemente datos de menores de 16 años.</p>

      <h2>11. Cambios en esta política</h2>
      <p>Podemos actualizar esta política periódicamente. Te notificaremos de cambios significativos a través de la app o por correo electrónico.</p>

      <h2>12. Contacto</h2>
      <p>NL VIP Nutrition S.L.<br />
      Email: <a href="mailto:support@nlvipnutrition.com">support@nlvipnutrition.com</a><br />
      Web: <a href="https://app.nlvipnutrition.com/privacy">app.nlvipnutrition.com/privacy</a></p>
    </main>
  )
}
