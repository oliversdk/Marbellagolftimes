import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { MapPin } from "lucide-react";

export default function Signup() {
  const { t } = useI18n();
  const { toast } = useToast();

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phoneNumber: "",
      password: "",
    },
  });

  const onSubmit = async (data: InsertUser) => {
    try {
      await apiRequest("/api/auth/signup", "POST", data);
      toast({
        title: t('common.success'),
        description: t('auth.signupSuccess'),
      });
      window.location.href = "/";
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('auth.emailTaken'),
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4 py-6 sm:py-4">
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
            <CardTitle className="text-xl sm:text-2xl" data-testid="text-signup-title">{t('auth.signup')}</CardTitle>
            <CardDescription className="text-sm">
              {t('auth.haveAccount')}{' '}
              <Link href="/login" data-testid="link-login">
                <span className="text-primary hover:underline cursor-pointer inline-block py-1 min-h-[44px] leading-relaxed">{t('auth.login')}</span>
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm sm:text-sm">{t('auth.firstName')}</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="John"
                          autoComplete="given-name"
                          className="min-h-[44px] text-base"
                          data-testid="input-first-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm sm:text-sm">{t('auth.lastName')}</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Doe"
                          autoComplete="family-name"
                          className="min-h-[44px] text-base"
                          data-testid="input-last-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm sm:text-sm">{t('auth.phoneNumber')}</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+45 12 34 56 78"
                          autoComplete="tel"
                          inputMode="tel"
                          className="min-h-[44px] text-base"
                          data-testid="input-phone-number"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          autoComplete="new-password"
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
                  data-testid="button-signup"
                >
                  {form.formState.isSubmitting ? t('common.loading') : t('auth.signupButton')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
