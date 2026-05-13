import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#030303] text-white px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl font-bold text-[#7c3aed]">404</div>
        <h1 className="text-2xl font-semibold">Página no encontrada</h1>
        <p className="text-white/70 text-sm">
          La ruta que buscas no existe o ha sido movida.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] transition"
        >
          Ir al inicio
        </Link>
      </div>
    </main>
  )
}
