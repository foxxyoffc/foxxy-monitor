import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";

const SESSION_KEY = "foxxy-monitor-session";
const DEVICE_KEY = "foxxy-monitor-device";

export function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = `${crypto.randomUUID()}-${navigator.userAgent.slice(0, 80)}`;
    localStorage.setItem(DEVICE_KEY, deviceId);
  }
  return deviceId;
}

export function useFoxxySession() {
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem(SESSION_KEY));
  const validate = trpc.auth.validate.useQuery(
    { sessionToken: sessionToken ?? "" },
    { enabled: Boolean(sessionToken), retry: false, refetchInterval: 5000, refetchOnWindowFocus: true },
  );
  const revoke = trpc.auth.revokeSession.useMutation();

  useEffect(() => {
    if (!sessionToken) return;
    if (validate.error) {
      localStorage.removeItem(SESSION_KEY);
      setSessionToken(null);
    }
  }, [sessionToken, validate.error]);

  const setSession = (token: string) => {
    localStorage.setItem(SESSION_KEY, token);
    setSessionToken(token);
  };

  const logout = async () => {
    const token = sessionToken;
    localStorage.removeItem(SESSION_KEY);
    setSessionToken(null);
    if (token) {
      try {
        await revoke.mutateAsync({ sessionToken: token });
      } catch {
        // Sesi lokal harus tetap dihapus bila koneksi sedang tidak tersedia.
      }
    }
  };

  return useMemo(() => ({
    sessionToken,
    setSession,
    user: validate.data?.user ?? null,
    isLoading: Boolean(sessionToken) && validate.isLoading,
    logout,
  }), [sessionToken, validate.data, validate.isLoading]);
}
