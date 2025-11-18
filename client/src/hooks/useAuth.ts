import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    profileImageUrl: string | null;
    isAdmin: string;
  }>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin === "true",
  };
}
