import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Building2, MapPin, Receipt, Users, Phone, Mail, User } from "lucide-react";
import { GolfLoader } from "@/components/GolfLoader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CompanyProfile } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const companyProfileFormSchema = z.object({
  commercialName: z.string().min(1, "Commercial name is required"),
  tradingName: z.string().optional(),
  cifVat: z.string().min(1, "CIF/VAT is required"),
  website: z.string().optional(),
  businessStreet: z.string().optional(),
  businessPostalCode: z.string().optional(),
  businessCity: z.string().optional(),
  businessCountry: z.string().optional(),
  invoiceStreet: z.string().optional(),
  invoicePostalCode: z.string().optional(),
  invoiceCity: z.string().optional(),
  invoiceCountry: z.string().optional(),
  invoiceSameAsBusiness: z.boolean().default(true),
  reservationsName: z.string().optional(),
  reservationsEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  reservationsPhone: z.string().optional(),
  contractsName: z.string().optional(),
  contractsEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  contractsPhone: z.string().optional(),
  invoicingName: z.string().optional(),
  invoicingEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  invoicingPhone: z.string().optional(),
});

type CompanyProfileFormValues = z.infer<typeof companyProfileFormSchema>;

export default function AdminCompanyProfile() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery<CompanyProfile>({
    queryKey: ["/api/admin/company-profile"],
    enabled: isAuthenticated && isAdmin,
  });

  const form = useForm<CompanyProfileFormValues>({
    resolver: zodResolver(companyProfileFormSchema),
    defaultValues: {
      commercialName: "",
      tradingName: "",
      cifVat: "",
      website: "",
      businessStreet: "",
      businessPostalCode: "",
      businessCity: "",
      businessCountry: "Spain",
      invoiceStreet: "",
      invoicePostalCode: "",
      invoiceCity: "",
      invoiceCountry: "Spain",
      invoiceSameAsBusiness: true,
      reservationsName: "",
      reservationsEmail: "",
      reservationsPhone: "",
      contractsName: "",
      contractsEmail: "",
      contractsPhone: "",
      invoicingName: "",
      invoicingEmail: "",
      invoicingPhone: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        commercialName: profile.commercialName || "",
        tradingName: profile.tradingName || "",
        cifVat: profile.cifVat || "",
        website: profile.website || "",
        businessStreet: profile.businessStreet || "",
        businessPostalCode: profile.businessPostalCode || "",
        businessCity: profile.businessCity || "",
        businessCountry: profile.businessCountry || "Spain",
        invoiceStreet: profile.invoiceStreet || "",
        invoicePostalCode: profile.invoicePostalCode || "",
        invoiceCity: profile.invoiceCity || "",
        invoiceCountry: profile.invoiceCountry || "Spain",
        invoiceSameAsBusiness: profile.invoiceSameAsBusiness === "true",
        reservationsName: profile.reservationsName || "",
        reservationsEmail: profile.reservationsEmail || "",
        reservationsPhone: profile.reservationsPhone || "",
        contractsName: profile.contractsName || "",
        contractsEmail: profile.contractsEmail || "",
        contractsPhone: profile.contractsPhone || "",
        invoicingName: profile.invoicingName || "",
        invoicingEmail: profile.invoicingEmail || "",
        invoicingPhone: profile.invoicingPhone || "",
      });
    }
  }, [profile, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: CompanyProfileFormValues) => {
      const payload = {
        ...data,
        invoiceSameAsBusiness: data.invoiceSameAsBusiness ? "true" : "false",
      };
      return await apiRequest("/api/admin/company-profile", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/company-profile"] });
      toast({
        title: "Company profile saved",
        description: "Your company details have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to save",
        description: "An error occurred while saving the company profile.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanyProfileFormValues) => {
    saveMutation.mutate(data);
  };

  const invoiceSameAsBusiness = form.watch("invoiceSameAsBusiness");

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <GolfLoader />
        </main>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>You must be an admin to access this page.</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin?tab=analytics">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Company Profile</h1>
            <p className="text-muted-foreground">Manage your business details for partnership forms</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Details
                </CardTitle>
                <CardDescription>Basic company identification information</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="commercialName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commercial Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Marbella Golf Times" data-testid="input-commercial-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tradingName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trading Name (Razón Social)</FormLabel>
                      <FormControl>
                        <Input placeholder="Company legal name" data-testid="input-trading-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cifVat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CIF / VAT Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="B12345678" data-testid="input-cif-vat" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://marbellagolftimes.com" data-testid="input-website" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Business Address
                </CardTitle>
                <CardDescription>Domicilio social / Registered business address</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="businessStreet"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Calle Example 123" data-testid="input-business-street" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="businessPostalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="29600" data-testid="input-business-postal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="businessCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Marbella" data-testid="input-business-city" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="businessCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Spain" data-testid="input-business-country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Invoice Address
                </CardTitle>
                <CardDescription>Dirección de facturación / Billing address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="invoiceSameAsBusiness"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-same-address"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Same as business address</FormLabel>
                        <FormDescription>Use the registered business address for invoicing</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                {!invoiceSameAsBusiness && (
                  <div className="grid gap-4 sm:grid-cols-2 pt-4">
                    <FormField
                      control={form.control}
                      name="invoiceStreet"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Calle Facturación 456" data-testid="input-invoice-street" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="invoicePostalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="29600" data-testid="input-invoice-postal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="invoiceCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Marbella" data-testid="input-invoice-city" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="invoiceCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="Spain" data-testid="input-invoice-country" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Contact Persons
                </CardTitle>
                <CardDescription>Department contacts for course partnerships</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Reservations Contact
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="reservationsName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" data-testid="input-reservations-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="reservationsEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="reservations@example.com" data-testid="input-reservations-email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="reservationsPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+34 600 000 000" data-testid="input-reservations-phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Contracts Contact
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="contractsName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Smith" data-testid="input-contracts-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contractsEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="contracts@example.com" data-testid="input-contracts-email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contractsPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+34 600 000 000" data-testid="input-contracts-phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Invoicing Contact
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="invoicingName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Bob Wilson" data-testid="input-invoicing-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="invoicingEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="invoicing@example.com" data-testid="input-invoicing-email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="invoicingPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+34 600 000 000" data-testid="input-invoicing-phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={saveMutation.isPending}
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : "Save Company Profile"}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
