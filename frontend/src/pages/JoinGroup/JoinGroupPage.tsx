import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "../../components/layout/AppLayout/AppLayout";
import { useAuth } from "../../context/useAuth";
import { groupsService, saveCurrentGroup } from "../../services/groups";
import type { InvitePreview } from "../../types/groups";


function StandardInlineAlert({
  title,
  message,
  tone = "error",
}: {
  title: string;
  message: string;
  tone?: "error" | "warning" | "info";
}) {
  const toneClasses = {
    error: "border-[#EAC8C0] bg-[#FAEDE7] text-[#8D4034]",
    warning: "border-[#FDE68A] bg-[#FFF2D1] text-[#92400E]",
    info: "border-[#91DEF0] bg-[#E8F4FA] text-[#075B85]",
  } satisfies Record<string, string>;

  return (
    <div
      role="alert"
      className={`rounded-xl border px-4 py-3 font-body ${toneClasses[tone]}`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed">{message}</p>
    </div>
  );
}

function getJoinGroupErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "No se pudo aceptar la invitación. Inténtalo de nuevo.";
}

export function JoinGroupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get("code")?.trim().toUpperCase() ?? "";
  const invitationToken = params.get("token")?.trim() ?? "";

  const { accessToken, localUser, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [requestPending, setRequestPending] = useState(false);

  useEffect(() => {
    async function loadPreview() {
      if (!code) {
        setError("El enlace de invitación no contiene un código válido.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setJoinError("");

        const response = await groupsService.getInvitePreview(code, invitationToken || undefined);
        setPreview(response.preview);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la invitación.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadPreview();
  }, [code, invitationToken]);

  const handleJoin = async () => {
    if (!accessToken) {
      const redirectTo = `/join-group?code=${encodeURIComponent(code)}${invitationToken ? `&token=${encodeURIComponent(invitationToken)}` : ""}`;
      sessionStorage.setItem("traveling_post_login_redirect", redirectTo);
      navigate(`/login?redirect=${encodeURIComponent(redirectTo)}`);
      return;
    }

    try {
      setJoining(true);
      setJoinError("");

      const response = await groupsService.joinGroup(code, accessToken, invitationToken || undefined);

      if (response.group.requiresApproval) {
        setRequestPending(true);
        return;
      }

      saveCurrentGroup(response.group);

      navigate(`/grouppanel?groupId=${encodeURIComponent(response.group.id)}`);
    } catch (err) {
      setJoinError(getJoinGroupErrorMessage(err));
    } finally {
      setJoining(false);
    }
  };

  const inviteIsFull = preview?.canJoin === false;

  const userName = localUser?.nombre || localUser?.email || "Usuario";
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navUser = {
    name: authLoading ? "Cargando..." : userName,
    role: localUser ? "Usuario" : "",
    initials: authLoading ? "--" : initials,
  };

  return (
    <AppLayout showTripSelector={false} user={navUser}>
      <main className="min-h-[calc(100vh-80px)] bg-[#F4F9FA] px-6 py-10">
        <section className="mx-auto max-w-2xl rounded-3xl border border-[#CBDDE3] bg-white p-8 shadow-sm">
          {loading ? (
            <p className="text-center font-body text-sm text-[#526C79]">
              Cargando invitación...
            </p>
          ) : error ? (
            <div className="text-center">
              <h1 className="font-heading text-2xl font-bold text-[#073B52]">
                No se pudo abrir la invitación
              </h1>
              <p className="mt-3 font-body text-sm text-red-500">{error}</p>

              <button
                onClick={() => navigate("/my-trips")}
                className="mt-6 rounded-xl bg-[#075EAA] px-5 py-3 text-sm font-semibold text-white"
              >
                Volver a mis viajes
              </button>
            </div>
          ) : requestPending ? (
            <div className="text-center">
              <p className="mb-3 inline-flex rounded-full bg-[#FFF2D1] px-3 py-1 text-xs font-semibold text-[#765000]">
                Solicitud enviada
              </p>
              <h1 className="font-heading text-2xl font-bold text-[#073B52]">
                Tu solicitud está pendiente de aprobación
              </h1>
              <p className="mt-3 font-body text-sm text-[#526C79]">
                Tu solicitud fue enviada al organizador. Espera a que sea
                aprobada; te avisaremos por notificación cuando puedas entrar al
                itinerario del grupo.
              </p>
              <button
                onClick={() => navigate("/my-trips")}
                className="mt-6 rounded-xl bg-[#075EAA] px-5 py-3 text-sm font-semibold text-white"
              >
                Volver a mis viajes
              </button>
            </div>
          ) : preview ? (
            <div>
              <p className="mb-3 inline-flex rounded-full bg-[#E8F4FA] px-3 py-1 text-xs font-semibold text-[#075EAA]">
                Invitación a grupo
              </p>

              <h1 className="font-heading text-3xl font-bold text-[#073B52]">
                {preview.nombre}
              </h1>

              {preview.descripcion && (
                <p className="mt-2 font-body text-sm text-[#526C79]">
                  {preview.descripcion}
                </p>
              )}

              <div className="mt-6 grid gap-3 rounded-2xl bg-[#F4F9FA] p-4">
                {preview.destino && (
                  <p className="font-body text-sm text-[#183F51]">
                    <span className="font-semibold text-[#073B52]">
                      Destino:
                    </span>{" "}
                    {preview.destino}
                  </p>
                )}

                {!inviteIsFull && (
                  <p className="font-body text-sm text-[#183F51]">
                    <span className="font-semibold text-[#073B52]">
                      Código:
                    </span>{" "}
                    {preview.codigo}
                  </p>
                )}

                <p className="font-body text-sm text-[#183F51]">
                  <span className="font-semibold text-[#073B52]">
                    Miembros:
                  </span>{" "}
                  {preview.memberCount}
                  {preview.maximo_miembros
                    ? ` / ${preview.maximo_miembros}`
                    : ""}
                </p>

                {(preview.fecha_inicio || preview.fecha_fin) && (
                  <p className="font-body text-sm text-[#183F51]">
                    <span className="font-semibold text-[#073B52]">
                      Fechas:
                    </span>{" "}
                    {preview.fecha_inicio ?? "Por definir"} →{" "}
                    {preview.fecha_fin ?? "Por definir"}
                  </p>
                )}
              </div>

              {inviteIsFull && (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-600">
                    Capacidad máxima alcanzada
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-red-500">
                    Este grupo ya alcanzó el límite de miembros configurado.
                    Solicita al organizador que aumente la capacidad o genere
                    una nueva invitación cuando haya cupo disponible.
                  </p>
                </div>
              )}

              {preview.emailInvitation && preview.canJoin && (
                <p className="mt-4 rounded-xl bg-[#E8F4FA] px-4 py-3 text-sm text-[#075B85]">
                  Esta es una invitación personal enviada por el organizador. Al aceptarla entrarás directamente al grupo sin solicitar acceso. Solo puede usarse una vez y debe coincidir con el correo invitado{preview.invitedEmail ? ` (${preview.invitedEmail})` : ""}.
                </p>
              )}

              {!preview.emailInvitation && preview.requiresApproval && preview.canJoin && (
                <p className="mt-4 rounded-xl bg-[#FFF2D1] px-4 py-3 text-sm text-[#765000]">
                  Este grupo es privado. Al aceptar, se enviará una solicitud al
                  administrador para aprobación.
                </p>
              )}

              {!localUser && preview.canJoin && (
                <p className="mt-4 rounded-xl bg-[#FFF2D1] px-4 py-3 text-sm text-[#765000]">
                  Para aceptar la invitación necesitas iniciar sesión.
                </p>
              )}

              {joinError && (
                <div className="mt-4">
                  <StandardInlineAlert
                    title="No se puede completar la unión"
                    message={joinError}
                  />
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {preview.canJoin && (
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="flex-1 rounded-xl bg-[#075EAA] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {joining
                      ? "Procesando..."
                      : localUser
                        ? preview.emailInvitation
                          ? "Aceptar invitación directa"
                          : preview.requiresApproval
                            ? "Solicitar acceso"
                            : "Aceptar invitación"
                        : "Iniciar sesión para aceptar"}
                  </button>
                )}

                <button
                  onClick={() => navigate("/my-trips")}
                  className="flex-1 rounded-xl border border-[#CBDDE3] px-5 py-3 text-sm font-semibold text-[#073B52]"
                >
                  {preview.canJoin ? "Cancelar" : "Volver a mis viajes"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </AppLayout>
  );
}
