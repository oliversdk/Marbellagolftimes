import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

interface PostBookingSignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export function PostBookingSignupDialog({
  open,
  onOpenChange,
  customerName,
  customerEmail,
  customerPhone,
}: PostBookingSignupDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Split name into first and last
  const nameParts = customerName.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      email: customerEmail,
      firstName: firstName,
      lastName: lastName,
      phoneNumber: customerPhone,
      password: "",
    },
  });

  // Reset form when dialog opens with new customer data
  useEffect(() => {
    if (open) {
      form.reset({
        email: customerEmail,
        firstName: firstName,
        lastName: lastName,
        phoneNumber: customerPhone,
        password: "",
      });
    }
  }, [open, customerEmail, firstName, lastName, customerPhone, form]);

  const onSubmit = async (data: InsertUser) => {
    try {
      await apiRequest("/api/auth/signup", "POST", data);
      toast({
        title: t('common.success'),
        description: t('auth.signupSuccess'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests"] });
      onOpenChange(false);
      window.location.reload(); // Reload to update auth state
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('auth.emailTaken'),
      });
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-post-booking-signup">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">
            {t('auth.createAccount')}
          </DialogTitle>
          <DialogDescription>
            {t('auth.postBookingSignupDescription')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.firstName')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('auth.firstNamePlaceholder')}
                      data-testid="input-post-booking-first-name"
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
                  <FormLabel>{t('auth.lastName')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('auth.lastNamePlaceholder')}
                      data-testid="input-post-booking-last-name"
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
                  <FormLabel>{t('auth.phoneNumber')}</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder={t('auth.phoneNumberPlaceholder')}
                      data-testid="input-post-booking-phone"
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
                  <FormLabel>{t('auth.email')}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      data-testid="input-post-booking-email"
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
                  <FormLabel>{t('auth.password')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={t('auth.passwordPlaceholder')}
                      data-testid="input-post-booking-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
                data-testid="button-post-booking-signup"
              >
                {form.formState.isSubmitting ? t('common.loading') : t('auth.signupButton')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleSkip}
                data-testid="button-post-booking-skip"
              >
                {t('common.skip')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
