import { Share2, Link as LinkIcon, Mail } from "lucide-react";
import { SiWhatsapp, SiFacebook } from "react-icons/si";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import type { GolfCourse } from "@shared/schema";

interface ShareMenuProps {
  course: GolfCourse;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ShareMenu({ course, variant = "outline", size = "default", className }: ShareMenuProps) {
  const { t } = useI18n();
  const { toast } = useToast();

  const shareUrl = `${window.location.origin}/course/${course.id}`;
  const shareText = t('course.shareDescription', {
    courseName: course.name,
    city: course.city,
    province: course.province,
  });
  const shareTitle = course.name;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    }
  };

  const handleWhatsApp = () => {
    const text = `${shareText} ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleEmail = () => {
    const subject = `${shareTitle} - Marbella Golf Times`;
    const body = `${shareText}\n\n${shareUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: t('course.copied'),
        description: shareUrl,
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  if (typeof navigator.share !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleNativeShare}
        className={className}
        data-testid="button-share-native"
      >
        <Share2 className="h-4 w-4" />
        {size !== "icon" && <span className="ml-2">{t('course.share')}</span>}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          data-testid="button-share-menu"
        >
          <Share2 className="h-4 w-4" />
          {size !== "icon" && <span className="ml-2">{t('course.share')}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid="menu-share-options">
        <DropdownMenuItem onClick={handleWhatsApp} data-testid="menu-item-whatsapp">
          <SiWhatsapp className="h-4 w-4 mr-2" />
          {t('course.shareWhatsApp')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} data-testid="menu-item-email">
          <Mail className="h-4 w-4 mr-2" />
          {t('course.shareEmail')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleFacebook} data-testid="menu-item-facebook">
          <SiFacebook className="h-4 w-4 mr-2" />
          {t('course.shareFacebook')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink} data-testid="menu-item-copy-link">
          <LinkIcon className="h-4 w-4 mr-2" />
          {t('course.copyLink')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
