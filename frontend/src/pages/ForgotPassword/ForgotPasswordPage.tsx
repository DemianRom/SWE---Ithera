import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import "../../styles/traveling-brand.css";
import "./ForgotPasswordPage.css";
import { Link } from "react-router-dom";
import { Logo } from "../../components/ui/Logo";
import { useAuth } from '../../context/useAuth';

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*)*\.[A-Za-z]{2,24}$/;

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const toSpanishForgotPasswordError = (message: string): string => {
  const trimmed = message.trim();
  const rateLimitMatch = trimmed.match(
    /For security purposes, you can only request this after (\d+) seconds\.?/i,
  );
  if (rateLimitMatch) {
    const seconds = rateLimitMatch[1];
    return `Por seguridad, solo puedes solicitarlo de nuevo en ${seconds} segundos.`;
  }
  return message;
};

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const normalizedEmail = normalizeEmail(email);
  const isEmailValid = EMAIL_REGEX.test(normalizedEmail);
  const canSubmit = isEmailValid && !loading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    setMessage("");

    if (!normalizedEmail) {
      setError("Ingresa tu correo electrónico.");
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Ingresa un correo electrónico válido (ej. usuario@dominio.com).");
      return;
    }

    submitting.current = true;
    try {
      setLoading(true);
      await forgotPassword(normalizedEmail);
      setMessage(
        "Si el correo existe, te enviaremos un enlace para restablecer tu contraseña."
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudo procesar la solicitud.";
      setError(toSpanishForgotPasswordError(msg));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="traveling-brand forgot-page min-h-screen font-body">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[45%_55%]">
        {/* Panel izquierdo */}
        <section
          className="forgot-promo relative hidden overflow-hidden lg:flex"
        >
          <div className="absolute inset-0 opacity-[0.15]">
            <div className="h-full w-full bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
          </div>

          <div className="relative z-10 flex h-full w-full flex-col px-16 py-12">
            <div>
              <Link to="/">
                <Logo variant="white" height={48} className="cursor-pointer" />
              </Link>
            </div>

            <div className="flex flex-1 items-center">
              <div className="max-w-[560px]">
                <div className="mb-5 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[13px] font-medium text-white/85 backdrop-blur-sm">
                  Seguridad de acceso
                </div>

                <h1 className="forgot-heading text-[64px] font-extrabold leading-[0.96] tracking-[-0.04em] text-white">
                  Recupera tu acceso de forma segura.
                </h1>

                <p className="mt-8 max-w-[500px] text-[19px] leading-[1.65] text-white/80">
                  Te enviaremos un enlace para restablecer tu contraseña y volver
                  a entrar a las cuentas de tus viajes en Traveling.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Panel derecho */}
        <section className="flex items-center justify-center forgot-surface px-6 py-10 sm:px-10 lg:px-16">
          <div className="w-full max-w-[470px]">
            <Link
              to="/login"
              className="mb-8 inline-flex items-center gap-1.5 text-[13px] forgot-link transition"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M19 12H5M5 12l7-7M5 12l7 7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Volver al inicio de sesión
            </Link>

            <div className="forgot-card rounded-[28px] p-8 sm:p-10">
              <div className="mb-8">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl forgot-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 8.4C4 7.56 4 7.14 4.16 6.82C4.3 6.54 4.54 6.3 4.82 6.16C5.14 6 5.56 6 6.4 6H17.6C18.44 6 18.86 6 19.18 6.16C19.46 6.3 19.7 6.54 19.84 6.82C20 7.14 20 7.56 20 8.4V15.6C20 16.44 20 16.86 19.84 17.18C19.7 17.46 19.46 17.7 19.18 17.84C18.86 18 18.44 18 17.6 18H6.4C5.56 18 5.14 18 4.82 17.84C4.54 17.7 4.3 17.46 4.16 17.18C4 16.86 4 16.44 4 15.6V8.4Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M4.5 7L10.94 11.83C11.32 12.11 11.51 12.25 11.72 12.31C11.9 12.37 12.1 12.37 12.28 12.31C12.49 12.25 12.68 12.11 13.06 11.83L19.5 7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <h1 className="forgot-heading text-[42px] font-extrabold leading-none tracking-[-0.04em] text-[var(--text-strong)]">
                  ¿Olvidaste tu contraseña?
                </h1>

                <p className="mt-4 text-[15px] leading-[1.7] text-[var(--text-muted)]">
                  Ingresa el correo asociado a tu cuenta y te enviaremos un
                  enlace para recuperar el acceso.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div>
                  <Input
                    label="Correo electrónico"
                    id="forgot-email"
                    autoComplete="email"
                    aria-invalid={!!error}
                    aria-describedby={error ? "forgot-error" : undefined}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEmail(value);
                      setMessage("");

                      const normalized = normalizeEmail(value);
                      if (normalized.length > 0 && normalized.includes("@")) {
                        if (!EMAIL_REGEX.test(normalized)) {
                          setError("Ingresa un correo electrónico válido (ej. usuario@dominio.com).");
                        } else {
                          setError("");
                        }
                      } else {
                        setError("");
                      }
                    }}
                    onBlur={(e) => {
                      const value = normalizeEmail(e.target.value);
                      setEmail(value);

                      if (!value) {
                        setError("Ingresa tu correo electrónico.");
                        return;
                      }

                      if (!EMAIL_REGEX.test(value)) {
                        setError("Ingresa un correo electrónico válido (ej. usuario@dominio.com).");
                      }
                    }}
                    placeholder="correo@ejemplo.com"
                    size="lg"
                  />
                </div>

                {error && (
                  <div id="forgot-error" role="alert" className="forgot-error rounded-2xl px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                {message && (
                  <div role="status" className="forgot-success rounded-2xl px-4 py-3 text-sm">
                    {message}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  isLoading={loading}
                  fullWidth
                  size="lg"
                >
                  {loading ? "Enviando enlace..." : "Enviar enlace de recuperación"}
                </Button>

                <p className="pt-1 text-center text-[14px] text-[var(--text-muted)]">
                  ¿Recordaste tu contraseña?{" "}
                  <Link
                    to="/login"
                    className="font-semibold forgot-link transition"
                  >
                    Inicia sesión
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
