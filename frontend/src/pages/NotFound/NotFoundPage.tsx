import { useNavigate } from 'react-router-dom'
import { Logo } from '../../components/ui/Logo'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f4f9fa] flex flex-col items-center justify-center px-6 text-center">
      {/* Logo */}
      <a href="/" className="mb-10 shrink-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#005aaf]" aria-label="Traveling">
        <Logo variant="color" height={52} />
      </a>

      {/* 404 number */}
      <div className="relative mb-6 select-none">
        <span
          className="font-heading font-bold text-[120px] sm:text-[180px] leading-none"
          style={{
            background: 'linear-gradient(135deg, #073b52 0%, #0878cf 60%, #16b9d0 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          404
        </span>
      </div>

      {/* Message */}
      <h1 className="font-heading font-bold text-[#073b52] text-2xl sm:text-3xl mb-3">
        Página no encontrada
      </h1>
      <p className="font-body text-[#526c79] text-sm sm:text-base max-w-sm mb-8 leading-relaxed">
        La ruta que buscas no existe o fue movida. Verifica la URL o regresa al inicio.
      </p>

      {/* CTA */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 bg-[#0878cf] text-white font-body font-semibold text-sm rounded-xl px-6 py-3 hover:bg-[#075eaa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#005aaf] transition-colors shadow-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Volver al inicio
      </button>

      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#16b9d0]/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-[#0878cf]/10 blur-3xl" />
      </div>
    </div>
  )
}
