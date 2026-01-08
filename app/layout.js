import './globals.css'

export const metadata = {
  title: 'NL VIP CLUB',
  description: 'Tu gimnasio premium de alto nivel',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  )
}