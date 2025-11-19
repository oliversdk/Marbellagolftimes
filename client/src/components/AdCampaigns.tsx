import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Calendar as CalendarIcon, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertAdCampaignSchema, type AdCampaign } from "@shared/schema";
import { cn } from "@/lib/utils";
import { z } from "zod";

const PLATFORMS = [
  "Google Ads",
  "Facebook",
  "Instagram",
  "LinkedIn",
  "Twitter",
  "TikTok",
  "Other",
] as const;

export function AdCampaigns() {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<AdCampaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<AdCampaign | null>(null);
  const { toast } = useToast();

  // Fetch campaigns
  const { data: campaigns, isLoading } = useQuery<AdCampaign[]>({
    queryKey: ["/api/admin/campaigns"],
  });

  // Form setup
  const form = useForm<z.infer<typeof insertAdCampaignSchema>>({
    resolver: zodResolver(insertAdCampaignSchema),
    defaultValues: {
      name: "",
      platform: "",
      startDate: "",
      endDate: "",
      totalSpend: 0,
      notes: "",
    },
  });

  // Create campaign mutation
  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertAdCampaignSchema>) => {
      return await apiRequest("/api/admin/campaigns", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      toast({
        title: "Campaign created",
        description: "The campaign has been created successfully",
      });
      setIsFormDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create campaign",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  // Update campaign mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof insertAdCampaignSchema> }) => {
      return await apiRequest(`/api/admin/campaigns/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      toast({
        title: "Campaign updated",
        description: "The campaign has been updated successfully",
      });
      setIsFormDialogOpen(false);
      setEditingCampaign(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update campaign",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  // Delete campaign mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/campaigns/${id}`, "DELETE", undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      toast({
        title: "Campaign deleted",
        description: "The campaign has been deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setDeletingCampaign(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete campaign",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  // Handle create campaign
  const handleCreate = () => {
    setEditingCampaign(null);
    form.reset({
      name: "",
      platform: "",
      startDate: "",
      endDate: "",
      totalSpend: 0,
      notes: "",
    });
    setIsFormDialogOpen(true);
  };

  // Handle edit campaign
  const handleEdit = (campaign: AdCampaign) => {
    setEditingCampaign(campaign);
    form.reset({
      name: campaign.name,
      platform: campaign.platform,
      startDate: typeof campaign.startDate === 'string' ? campaign.startDate : new Date(campaign.startDate).toISOString(),
      endDate: campaign.endDate ? (typeof campaign.endDate === 'string' ? campaign.endDate : new Date(campaign.endDate).toISOString()) : "",
      totalSpend: campaign.totalSpend,
      notes: campaign.notes ?? "",
    });
    setIsFormDialogOpen(true);
  };

  // Handle delete campaign
  const handleDelete = (campaign: AdCampaign) => {
    setDeletingCampaign(campaign);
    setIsDeleteDialogOpen(true);
  };

  // Handle form submit
  const handleSubmit = (data: z.infer<typeof insertAdCampaignSchema>) => {
    if (editingCampaign) {
      updateMutation.mutate({ id: editingCampaign.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Handle confirm delete
  const handleConfirmDelete = () => {
    if (deletingCampaign) {
      deleteMutation.mutate(deletingCampaign.id);
    }
  };

  // Sort campaigns by startDate (newest first)
  const sortedCampaigns = campaigns
    ? [...campaigns].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    : [];

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Ad Campaigns</h2>
          <p className="text-muted-foreground">
            Manage your advertising campaigns and track spending
          </p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-campaign">
          <Plus className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table data-testid="table-campaigns">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead className="text-right">Total Spend (€)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : sortedCampaigns.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No campaigns yet. Create one to start tracking ad spend.
                </TableCell>
              </TableRow>
            ) : (
              // Campaign rows
              sortedCampaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{campaign.platform}</Badge>
                  </TableCell>
                  <TableCell>{format(new Date(campaign.startDate), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    {campaign.endDate ? (
                      format(new Date(campaign.endDate), "MMM d, yyyy")
                    ) : (
                      <span className="text-muted-foreground italic">Ongoing</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    €{campaign.totalSpend.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(campaign)}
                        data-testid={`button-edit-campaign-${campaign.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(campaign)}
                        data-testid={`button-delete-campaign-${campaign.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent data-testid="dialog-campaign-form">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? "Edit Campaign" : "Create Campaign"}
            </DialogTitle>
            <DialogDescription>
              {editingCampaign
                ? "Update the campaign details below"
                : "Add a new advertising campaign to track spending"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Summer 2025 Campaign"
                        data-testid="input-campaign-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Platform */}
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-campaign-platform">
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PLATFORMS.map((platform) => (
                          <SelectItem key={platform} value={platform}>
                            {platform}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Start Date */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="input-campaign-start-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(new Date(field.value), "MMM d, yyyy")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => field.onChange(date?.toISOString())}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date */}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="input-campaign-end-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(new Date(field.value), "MMM d, yyyy")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => field.onChange(date?.toISOString() || "")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Total Spend */}
              <FormField
                control={form.control}
                name="totalSpend"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Spend (€)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-9"
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          data-testid="input-campaign-total-spend"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Additional campaign details..."
                        rows={3}
                        data-testid="input-campaign-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFormDialogOpen(false);
                    setEditingCampaign(null);
                    form.reset();
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : editingCampaign ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-campaign">
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this campaign?
            </DialogDescription>
          </DialogHeader>

          {deletingCampaign && (
            <div className="space-y-3 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Campaign Details:</p>
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Name:</span>
                    <span className="text-sm font-medium">{deletingCampaign.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Platform:</span>
                    <Badge variant="outline">{deletingCampaign.platform}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Spend:</span>
                    <span className="text-sm font-medium">€{deletingCampaign.totalSpend.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">Warning: This action cannot be undone.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingCampaign(null);
              }}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
