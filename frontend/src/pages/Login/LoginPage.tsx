import { useEffect, useState } from "react";
import { Logo } from "../../components/ui/Logo";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import googleIcon from "../../assets/google.png";
import facebookIcon from "../../assets/facebook.png";
import { isOAuthProviderEnabled, oauthProviderCount } from "../../lib/oauth";
import { useNavigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { ApiError, apiClient } from "../../services/apiClient";
import "../../styles/traveling-brand.css";
import "./LoginPage.css";

const REDIRECT_STORAGE_KEY = "traveling_post_login_redirect";
const LOGIN_LOCK_STORAGE_KEY = "traveling_login_lockout";
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*)*\.[A-Za-z]{2,24}$/;

type StoredLoginLock = {
  email: string;
  lockedUntil: number;
};

function normalizeLoginEmail(value: string): string {
  return value.trim().toLowerCase();
}

type EmailAvailabilityResult = {
  ok: boolean;
  available: boolean;
  code?: string;
  message?: string;
};

async function isEmailAvailableForRegistration(emailValue: string): Promise<boolean | null> {
  try {
    const result = await apiClient.get<EmailAvailabilityResult>(
      `/auth/email-availability?email=${encodeURIComponent(normalizeLoginEmail(emailValue))}`,
    );

    return result.available;
  } catch {
    return null;
  }
}

function readStoredLoginLock(): StoredLoginLock | null {
  try {
    const raw = localStorage.getItem(LOGIN_LOCK_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredLoginLock>;
    if (typeof parsed.email !== "string" || typeof parsed.lockedUntil !== "number") {
      localStorage.removeItem(LOGIN_LOCK_STORAGE_KEY);
      return null;
    }

    if (parsed.lockedUntil <= Date.now()) {
      localStorage.removeItem(LOGIN_LOCK_STORAGE_KEY);
      return null;
    }

    return {
      email: parsed.email,
      lockedUntil: parsed.lockedUntil,
    };
  } catch {
    localStorage.removeItem(LOGIN_LOCK_STORAGE_KEY);
    return null;
  }
}

function persistLoginLock(emailValue: string, lockedUntil: number): void {
  localStorage.setItem(
    LOGIN_LOCK_STORAGE_KEY,
    JSON.stringify({
      email: normalizeLoginEmail(emailValue),
      lockedUntil,
    }),
  );
}

function clearStoredLoginLock(): void {
  localStorage.removeItem(LOGIN_LOCK_STORAGE_KEY);
}

function getSafeRedirect(value: string | null): string {
  if (!value) return "/my-trips";
  if (!value.startsWith("/") || value.startsWith("//")) return "/my-trips";
  return value;
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const rawSessionExpired =
    (location.state as { sessionExpired?: boolean } | null)?.sessionExpired === true;

  const hasPreviousSession =
    typeof window !== "undefined" &&
    Object.keys(localStorage).some((key) =>
      key.toLowerCase().includes("auth") ||
      key.toLowerCase().includes("token") ||
      key.toLowerCase().includes("session"),
    );

  const sessionExpired = rawSessionExpired && hasPreviousSession;
  const { login, loginWithGoogle, loginWithFacebook } = useAuth();

  useEffect(() => {
    const updateNetworkState = () => {
      const offline = !navigator.onLine;
      setIsOffline(offline);

      if (offline) {
        setLoading(false);
        setError("");
        setErrorCode(null);
      }
    };

    updateNetworkState();
    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);

    return () => {
      window.removeEventListener("online", updateNetworkState);
      window.removeEventListener("offline", updateNetworkState);
    };
  }, []);

  const redirect = getSafeRedirect(
    searchParams.get("redirect") ||
      sessionStorage.getItem(REDIRECT_STORAGE_KEY),
  );

  const isLoginLocked = lockRemainingSeconds > 0;
  const lockMinutes = Math.floor(lockRemainingSeconds / 60);
  const lockSeconds = String(lockRemainingSeconds % 60).padStart(2, "0");
  const normalizedEmail = normalizeLoginEmail(email);
  const isEmailFormatValid = EMAIL_REGEX.test(normalizedEmail);
  const isLoginFormReady = isEmailFormatValid && password.trim().length > 0;

  useEffect(() => {
    const storedLock = readStoredLoginLock();
    if (!storedLock) return;

    setEmail((currentEmail) => currentEmail || storedLock.email);
    setLockRemainingSeconds(
      Math.max(Math.ceil((storedLock.lockedUntil - Date.now()) / 1000), 0),
    );
    setError("Por seguridad, tu acceso ha sido pausado por 5 minutos. Inténtalo de nuevo más tarde.");
  }, []);

  useEffect(() => {
    const currentEmail = normalizeLoginEmail(email);
    const storedLock = readStoredLoginLock();

    if (!storedLock) {
      setLockRemainingSeconds((current) => (current > 0 ? 0 : current));
      return;
    }

    if (!currentEmail || currentEmail === storedLock.email) {
      setLockRemainingSeconds(
        Math.max(Math.ceil((storedLock.lockedUntil - Date.now()) / 1000), 0),
      );
      return;
    }

    setLockRemainingSeconds((current) => {
      if (current > 0) {
        setError("");
        return 0;
      }
      return current;
    });
  }, [email]);

  useEffect(() => {
    if (lockRemainingSeconds <= 0) {
      const storedLock = readStoredLoginLock();
      if (!storedLock) clearStoredLoginLock();
      return;
    }

    const timer = window.setInterval(() => {
      setLockRemainingSeconds((current) => {
        const next = Math.max(current - 1, 0);
        if (next === 0) clearStoredLoginLock();
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [lockRemainingSeconds]);

  const showOfflineState = () => {
    setLoading(false);
    setIsOffline(true);
    setError("");
    setErrorCode(null);
  };

  const isNetworkError = (value: unknown): boolean => {
    if (!(value instanceof Error)) return false;
    const message = value.message.toLowerCase();
    return (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network request failed")
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isOffline) {
      showOfflineState();
      return;
    }

    if (isLoginLocked) {
      setError(
        `Por seguridad, tu acceso ha sido pausado por 5 minutos. Inténtalo de nuevo en ${lockMinutes}:${lockSeconds}.`,
      );
      return;
    }

    setError("");
    setErrorCode(null);

    if (!validateEmail(email)) {
      setErrorCode("ERR-14-004");
      return;
    }

    if (!password) {
      setError("Ingresa tu contraseña.");
      setErrorCode(null);
      return;
    }

    try {
      setLoading(true);
      await login(email, password, rememberMe);
      setErrorCode(null);
      clearStoredLoginLock();
      sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
      navigate(redirect, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const payload = err.payload;
        const code = payload?.code ?? null;

        setErrorCode(code);

        if (code?.startsWith("ERR-11-")) {
          setPassword("");
          setShowPassword(false);
        }

        const retryAfterSeconds =
          typeof payload?.retryAfterSeconds === "number"
            ? payload.retryAfterSeconds
            : 0;

        if (code === "ERR-11-003" && retryAfterSeconds > 0) {
          const lockedUntil = payload?.lockedUntil
            ? Date.parse(payload.lockedUntil)
            : Date.now() + retryAfterSeconds * 1000;

          if (!Number.isNaN(lockedUntil)) {
            persistLoginLock(email, lockedUntil);
          }

          setLockRemainingSeconds(retryAfterSeconds);
          setError(err.message);
          return;
        }

        if (code === "ERR-11-001" || code === "ERR-11-002") {
          const emailAvailability = await isEmailAvailableForRegistration(email);

          if (emailAvailability === true || code === "ERR-11-002") {
            setErrorCode("ERR-11-002");
            setError("No encontramos una cuenta activa con ese correo. ¿Deseas registrarte?");
            return;
          }
        }

        setError(err.message);
        return;
      }

      if (isNetworkError(err)) {
        showOfflineState();
        return;
      }

      const message =
        err instanceof Error ? err.message : "No se pudo iniciar sesión";
      setError(message);
      setErrorCode(null);
    } finally {
      setLoading(false);
    }
  };

  const updateCapsLockState = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    setIsCapsLockOn(event.getModifierState("CapsLock"));
  };

  const clearCapsLockState = () => {
    setIsCapsLockOn(false);
  };

  const validateEmail = (value: string) => {
    const normalizedEmail = normalizeLoginEmail(value);

    if (!normalizedEmail) {
      setEmailError("Ingresa tu correo electrónico.");
      return false;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setEmailError("Ingresa un correo electrónico válido (ej. usuario@dominio.com).");
      return false;
    }

    setEmailError("");
    return true;
  };

  const clearLoginError = () => {
    if (!isLoginLocked) {
      setError("");
      setErrorCode(null);
    }
  };

  const isEmailInvalid = Boolean(emailError) || errorCode === "ERR-11-002";
  const inputBase = "login-input w-full px-4 py-3 text-[15px]";

  return (
    <div className="traveling-brand login-page h-dvh overflow-hidden">
      <div className="grid h-full grid-cols-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[45%_55%]">
        {/* ── Left panel ── */}
        <section className="login-promo hidden overflow-y-auto lg:block">
          <div className="flex min-h-full w-full flex-col gap-8 px-12 py-10 xl:px-16 xl:py-12">
            <Link to="/" className="inline-flex w-fit">
              <Logo variant="white" height={48} className="cursor-pointer" />
            </Link>

            <div className="flex flex-1 items-center">
              <div className="w-full max-w-[620px]">
                <div className="login-promo-badge mb-6 inline-flex items-center gap-2 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.16em]">
                  <span className="login-promo-accent h-2 w-2 rounded-full" />
                  Plataforma colaborativa
                </div>
                <h1 className="login-heading text-[clamp(2.75rem,4.1vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.025em]">
                  Registra gastos, repártelos y cierra las cuentas del viaje sin pendientes.
                </h1>

                <p className="login-promo-copy mt-8 max-w-[540px] text-[19px] leading-[1.55]">
                  Itinerarios, presupuesto, decisiones y documentos conectados
                  para que cada integrante sepa qué sigue.
                </p>

                <div className="mt-10 grid max-w-[520px] grid-cols-3 gap-3">
                  {[
                    ["Saldos", "Cuentas claras"],
                    ["Gastos", "Balance visible"],
                    ["Bóveda", "Todo a mano"],
                  ].map(([title, subtitle]) => (
                    <div
                      key={title}
                      className="login-promo-card px-4 py-3"
                    >
                      <p className="text-[13px] font-bold">{title}</p>
                      <p className="login-promo-copy mt-1 text-[12px] leading-tight">
                        {subtitle}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid max-w-[560px] grid-cols-[1fr_0.9fr] gap-3">
              <div className="login-promo-card p-4">
                <p className="login-promo-label text-[12px] font-bold uppercase tracking-[0.16em]">
                  Próximo plan
                </p>
                <p className="mt-2 text-[16px] font-bold">
                  Cena frente al mar
                </p>
                <div className="login-promo-track mt-4 h-2 overflow-hidden rounded-full">
                  <div className="login-promo-accent h-full w-3/4 rounded-full" />
                </div>
              </div>
              <div className="login-promo-card p-4">
                <p className="login-promo-label text-[12px] font-bold uppercase tracking-[0.16em]">
                  Presupuesto
                </p>
                <p className="mt-2 text-[22px] font-extrabold">
                  $50,000
                </p>
                <p className="login-promo-copy mt-1 text-[12px]">
                  28% comprometido
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Right panel ── */}
        <section className="flex min-h-0 min-w-0 items-start justify-center overflow-y-auto px-6 py-10 sm:px-10 lg:px-16 lg:py-12">
          <div className="w-full max-w-[470px]">
            <Link
              to="/"
              className="login-nav-link mb-8 inline-flex items-center gap-1.5 text-[13px]"
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
              Volver al inicio
            </Link>

            {/* Tabs */}
            <div className="mb-7 flex items-center justify-center gap-8 text-[15px]">
              <button
                type="button"
                aria-current="page"
                className="login-current-tab border-b-2 pb-1 font-semibold"
              >
                Iniciar sesión
              </button>

              <Link
                to="/register"
                className="login-nav-link"
              >
                Registrarse
              </Link>
            </div>

            {/* Title */}
            <h2 className="login-heading login-title mb-8 text-center text-[clamp(2.25rem,8vw,3.25rem)] font-semibold leading-none tracking-[-0.025em]">
              Bienvenido de nuevo
            </h2>

            {oauthProviderCount > 0 && (
              <>
                {/* Social buttons */}
                <div className={`mb-8 grid gap-4 ${oauthProviderCount > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {isOAuthProviderEnabled("google") && (
                    <button
                      type="button"
                      disabled={isOffline || loading}
                      onClick={async () => {
                        try {
                          setLoading(true);
                          await loginWithGoogle(redirect);
                        } catch (err) {
                          const message =
                            err instanceof Error
                              ? err.message
                              : "No se pudo iniciar con Google";
                          setError(message);
                          setLoading(false);
                        }
                      }}
                      className="login-provider flex h-[54px] items-center justify-center gap-3 text-[16px] font-semibold"
                    >
                      <img
                        src={googleIcon}
                        alt=""
                        className="h-5 w-5 object-contain"
                      />
                      <span>Google</span>
                    </button>
                  )}

                  {isOAuthProviderEnabled("facebook") && (
                    <button
                      type="button"
                      disabled={isOffline || loading}
                      onClick={async () => {
                        try {
                          setLoading(true);
                          await loginWithFacebook(redirect);
                        } catch (err) {
                          const message =
                            err instanceof Error
                              ? err.message
                              : "No se pudo iniciar con Facebook";
                          setError(message);
                          setLoading(false);
                        }
                      }}
                      className="login-provider flex h-[54px] items-center justify-center gap-3 text-[16px] font-semibold"
                    >
                      <img
                        src={facebookIcon}
                        alt=""
                        className="h-5 w-5 object-contain"
                      />
                      <span>Facebook</span>
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div className="mb-8 flex items-center gap-4">
                  <div className="login-divider h-px flex-1" />
                  <span className="login-muted text-[14px]">
                    o continúa con tu correo
                  </span>
                  <div className="login-divider h-px flex-1" />
                </div>
              </>
            )}

            {/* Session expired banner */}
            {sessionExpired && (
              <div className="login-warning mb-5 px-4 py-3 text-sm">
                Tu sesión expiró. Por favor inicia sesión de nuevo.
              </div>
            )}

            {/* Offline banner */}
            {isOffline && (
              <div
                role="status"
                aria-live="polite"
                className="login-warning mb-5 flex items-start gap-3 px-4 py-3 text-sm font-medium"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="mt-[1px] shrink-0"
                >
                  <path
                    d="M3 3l18 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M2 8.8C7.8 4.2 16.2 4.2 22 8.8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M5.5 12.3a10.4 10.4 0 0113 0"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9 15.8a5 5 0 016 0"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 19h.01"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
                <span>
                  Sin conexión. Verifica tu red e inténtalo de nuevo.
                </span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="login-email" className="mb-2 block text-[15px] font-semibold">
                  Correo electrónico
                </label>
                <Input
                  id="login-email"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val);
                    clearLoginError();
                    // Validación en tiempo real: solo cuando ya escribió algo con @
                    const normalized = normalizeLoginEmail(val);
                    if (normalized.length > 0 && normalized.includes("@")) {
                      if (!EMAIL_REGEX.test(normalized)) {
                        setEmailError("Ingresa un correo electrónico válido (ej. usuario@dominio.com).");
                      } else {
                        setEmailError("");
                      }
                    } else {
                      setEmailError("");
                    }
                  }}
                  onBlur={(e) => validateEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  aria-invalid={isEmailInvalid}
                  aria-describedby={
                    emailError
                      ? "login-email-error"
                      : errorCode === "ERR-11-002" && error && !isOffline
                        ? "login-error"
                        : undefined
                  }
                  className={inputBase}
                />
                {emailError && (
                  <p id="login-email-error" className="login-error-text mt-1 text-[12px] font-semibold">
                    {emailError}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password" className="mb-2 block text-[15px] font-semibold">
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearLoginError();
                    }}
                    onKeyDown={updateCapsLockState}
                    onKeyUp={updateCapsLockState}
                    onFocus={() => setIsCapsLockOn(false)}
                    onBlur={clearCapsLockState}
                    placeholder="••••••••"
                    aria-describedby={
                      isCapsLockOn ? "caps-lock-warning" : undefined
                    }
                    className={`${inputBase} pr-12${error ? " login-input-error" : ""}`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-controls="login-password"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="login-nav-link absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg"
                  >
                    {showPassword ? (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 3l18 18"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10.58 10.58a3 3 0 004.24 4.24"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M9.88 5.08A10.94 10.94 0 0112 5c6 0 10 7 10 7a21.84 21.84 0 01-4.35 5.27"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M6.61 6.61A21.82 21.82 0 002 12s4 7 10 7a10.94 10.94 0 005.27-1.35"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                {isCapsLockOn && (
                  <div
                    id="caps-lock-warning"
                    role="status"
                    aria-live="polite"
                    className="login-warning mt-2 flex items-start gap-2 px-3 py-2 text-[12px] font-medium"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="mt-[1px] shrink-0"
                    >
                      <path
                        d="M12 3l9 9h-5v6H8v-6H3l9-9Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8 21h8"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>
                      Bloq Mayús está activado. Verifica tu contraseña antes de
                      iniciar sesión.
                    </span>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && !isOffline && (
                <div
                  role="alert"
                  className={`${isLoginLocked ? "login-warning" : "login-error"} px-3 py-2 text-[12px] font-semibold`}
                >
                  <p id="login-error">{error}</p>
                  {isLoginLocked && (
                    <p className="mt-1 font-medium">
                      Tiempo restante: {lockMinutes}:{lockSeconds}. El botón se
                      habilitará automáticamente.
                    </p>
                  )}

                  {errorCode === "ERR-11-002" && (
                    <Link
                      to="/register"
                      className="login-action mt-3 inline-flex px-4 py-2 text-[12px] font-bold"
                    >
                      Crear cuenta
                    </Link>
                  )}
                </div>
              )}

              {/* Remember me + Forgot password */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="login-checkbox h-4 w-4"
                  />
                  <span className="text-[14px]">Recordarme</span>
                </label>

                <Link
                  to="/forgot-password"
                  className="login-text-link text-[14px] font-semibold"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                aria-busy={loading}
                disabled={loading || isOffline || isLoginLocked || !isLoginFormReady}
                className="login-action mt-2 h-[54px] w-full text-[18px] font-bold"
              >
                {loading ? "Iniciando sesión..." : isOffline ? "Sin conexión" : isLoginLocked ? `Bloqueado ${lockMinutes}:${lockSeconds}` : "Iniciar sesión"}
              </Button>

              {/* Sign-up link */}
              <p className="login-muted pt-2 text-center text-[14px]">
                ¿No tienes cuenta?{" "}
                <Link
                  to="/register"
                  className="login-text-link font-semibold"
                >
                  Regístrate
                </Link>
              </p>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
