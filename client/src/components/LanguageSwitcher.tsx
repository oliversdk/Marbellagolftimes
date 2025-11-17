import { useI18n, type Language } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';

const languages = [
  { code: 'en' as Language, name: 'English', shortName: 'EN' },
  { code: 'es' as Language, name: 'Español', shortName: 'ES' },
  { code: 'da' as Language, name: 'Dansk', shortName: 'DA' },
  { code: 'sv' as Language, name: 'Svenska', shortName: 'SV' },
  { code: 'ru' as Language, name: 'Русский', shortName: 'RU' },
];

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();

  const currentLanguage = languages.find((l) => l.code === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="button-language-toggle"
          aria-label="Change language"
          className="gap-1"
        >
          <Globe className="h-4 w-4" />
          <span className="text-sm font-medium">
            {currentLanguage?.shortName || 'EN'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid="menu-language-options">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className="cursor-pointer"
            data-testid={`menu-item-language-${lang.code}`}
          >
            <span>{lang.name}</span>
            {language === lang.code && (
              <Check className="ml-auto h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
