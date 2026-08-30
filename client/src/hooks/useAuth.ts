import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { authApi } from '@/api/services'
import type { CapabilityKey } from '@/api/types'
import { queryKeys } from '@/constants'

export function useAuthMe() {
  return useQuery({
    queryKey: queryKeys.authMe,
    queryFn: authApi.me,
  });
}

export function useCapabilities() {
  const authMe = useAuthMe();
  const capabilitySet = useMemo(
    () => new Set(authMe.data?.capabilities ?? []),
    [authMe.data?.capabilities],
  );

  return {
    authMe,
    can: (capability: CapabilityKey) => capabilitySet.has(capability),
  };
}
