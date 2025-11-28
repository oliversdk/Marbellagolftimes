import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { MapPin } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { t } = useI18n();
  const { toast } = useToast();
  const searchString = useSearch();
  
  // Parse returnTo from URL query params
  const searchParams = new URLSearchParams(searchString);
  let returnTo = searchParams.get("returnTo") || "/";
  
  // Security: Only allow same-origin paths (prevent open redirect attacks)
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
    returnTo = "/";
  }

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await apiRequest("/api/auth/login", "POST", data);
      toast({
        title: t('common.success'),
        description: t('auth.loginSuccess'),
      });
      // Redirect to returnTo URL after successful login
      window.location.href = returnTo;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('auth.invalidCredentials'),
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
      <div className="w-full max-w-[95vw] sm:max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6 sm:mb-8">
          <MapPin className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
          <div className="flex flex-col">
            <span className="font-serif font-semibold text-xl sm:text-2xl leading-none">
              {t('header.title')}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">{t('header.subtitle')}</span>
          </div>
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl" data-testid="text-login-title">{t('auth.login')}</CardTitle>
            <CardDescription className="text-sm">
              {t('auth.noAccount')}{' '}
              <Link href="/signup" data-testid="link-signup">
                <span className="text-primary hover:underline cursor-pointer inline-block py-1 min-h-[44px] leading-relaxed">{t('auth.signup')}</span>
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm sm:text-sm">{t('auth.email')}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          inputMode="email"
                          className="min-h-[44px] text-base"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm sm:text-sm">{t('auth.password')}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="min-h-[44px] text-base"
                          data-testid="input-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full min-h-[44px] text-base"
                  disabled={form.formState.isSubmitting}
                  data-testid="button-login"
                >
                  {form.formState.isSubmitting ? t('common.loading') : t('auth.loginButton')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
