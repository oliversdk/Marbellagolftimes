import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mail, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailRecipient {
  email: string;
  name?: string;
}

interface EmailConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  recipients: EmailRecipient[];
  subject?: string;
  emailType: "affiliate" | "review_request" | "booking_notification" | "general";
  isLoading?: boolean;
}

export function EmailConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  recipients,
  subject,
  emailType,
  isLoading = false,
}: EmailConfirmDialogProps) {
  const getEmailTypeLabel = () => {
    switch (emailType) {
      case "affiliate":
        return "Partnership/Affiliate Email";
      case "review_request":
        return "Review Request Email";
      case "booking_notification":
        return "Booking Notification";
      default:
        return "Email";
    }
  };

  const hasTestRecipients = recipients.some(
    (r) => r.email.includes("test") || r.email.includes("freeway") || r.email.includes("example")
  );
  
  const hasProductionRecipients = recipients.some(
    (r) => !r.email.includes("test") && !r.email.includes("freeway") && !r.email.includes("example")
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Bekræft Email Afsendelse
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Du er ved at sende <strong>{getEmailTypeLabel()}</strong> til følgende modtagere:
              </p>
              
              {hasProductionRecipients && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Advarsel:</strong> Nogle modtagere er rigtige email-adresser (ikke test).
                    Bekræft at dette er korrekt!
                  </p>
                </div>
              )}

              <div className="border rounded-md">
                <div className="px-3 py-2 bg-muted/50 border-b text-sm font-medium">
                  {recipients.length} modtager{recipients.length !== 1 ? "e" : ""}
                </div>
                <ScrollArea className="max-h-48">
                  <div className="p-2 space-y-1">
                    {recipients.map((recipient, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-sm bg-muted/30"
                        data-testid={`email-recipient-${index}`}
                      >
                        <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-mono text-xs break-all">
                          {recipient.email}
                        </span>
                        {recipient.name && (
                          <span className="text-muted-foreground text-xs">
                            ({recipient.name})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {subject && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Emne: </span>
                  <span className="font-medium">{subject}</span>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} data-testid="button-cancel-email">
            Annuller
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-primary"
            data-testid="button-confirm-email"
          >
            {isLoading ? "Sender..." : `Send ${recipients.length} email${recipients.length !== 1 ? "s" : ""}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
