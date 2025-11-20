import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    profileImageUrl: string | null;
    isAdmin: string | boolean;
  }>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Handle both string "true"/"false" and boolean true/false
  const isAdmin = user?.isAdmin === "true" || user?.isAdmin === true;

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
  };
}
