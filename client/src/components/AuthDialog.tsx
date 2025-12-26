import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "login" | "signup";
}

export function AuthDialog({ open, onOpenChange, initialMode = "login" }: AuthDialogProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const { t } = useI18n();
  const { toast } = useToast();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phoneNumber: "",
      password: "",
    },
  });

  // Sync mode with initialMode when dialog opens
  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [open, initialMode]);

  const onLoginSubmit = async (data: LoginForm) => {
    try {
      await apiRequest("/api/auth/login", "POST", data);
      toast({
        title: t('common.success'),
        description: t('auth.loginSuccess'),
      });
      onOpenChange(false);
      window.location.href = "/";
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('auth.invalidCredentials'),
      });
    }
  };

  const onSignupSubmit = async (data: InsertUser) => {
    try {
      await apiRequest("/api/auth/signup", "POST", data);
      toast({
        title: t('common.success'),
        description: t('auth.signupSuccess'),
      });
      onOpenChange(false);
      window.location.href = "/";
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('auth.emailTaken'),
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      loginForm.reset();
      signupForm.reset();
      setMode(initialMode);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-auth">
        <DialogHeader>
          <DialogTitle data-testid={mode === "login" ? "text-login-title" : "text-signup-title"}>
            {mode === "login" ? t('auth.login') : t('auth.signup')}
          </DialogTitle>
          <DialogDescription>
            {mode === "login" ? (
              <>
                {t('auth.noAccount')}{' '}
                <button
                  onClick={() => setMode("signup")}
                  className="text-primary hover:underline cursor-pointer"
                  data-testid="link-signup"
                >
                  {t('auth.signup')}
                </button>
              </>
            ) : (
              <>
                {t('auth.haveAccount')}{' '}
                <button
                  onClick={() => setMode("login")}
                  className="text-primary hover:underline cursor-pointer"
                  data-testid="link-login"
                >
                  {t('auth.login')}
                </button>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: mode === "login" ? "block" : "none" }}>
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.email')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        data-testid="input-login-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.password')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showLoginPassword ? "text" : "password"}
                          placeholder="••••••••"
                          data-testid="input-login-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 focus-visible:ring-2"
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                        >
                          {showLoginPassword ? (
                            <EyeOff className="h-5 w-5 text-gray-500" />
                          ) : (
                            <Eye className="h-5 w-5 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={loginForm.formState.isSubmitting}
                data-testid="button-login"
              >
                {loginForm.formState.isSubmitting ? t('common.loading') : t('auth.loginButton')}
              </Button>
            </form>
          </Form>
        </div>
        
        <div style={{ display: mode === "signup" ? "block" : "none" }}>
          <Form {...signupForm}>
            <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
              <FormField
                control={signupForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.firstName')}</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="John"
                        data-testid="input-signup-first-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.lastName')}</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Doe"
                        data-testid="input-signup-last-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.phoneNumber')}</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+45 12 34 56 78"
                        data-testid="input-signup-phone-number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.email')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        data-testid="input-signup-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.password')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showSignupPassword ? "text" : "password"}
                          placeholder="••••••••"
                          data-testid="input-signup-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 focus-visible:ring-2"
                          aria-label={showSignupPassword ? "Hide password" : "Show password"}
                        >
                          {showSignupPassword ? (
                            <EyeOff className="h-5 w-5 text-gray-500" />
                          ) : (
                            <Eye className="h-5 w-5 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={signupForm.formState.isSubmitting}
                data-testid="button-signup"
              >
                {signupForm.formState.isSubmitting ? t('common.loading') : t('auth.signupButton')}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
