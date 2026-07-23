import { useNavigate } from 'react-router-dom';
import { CalendarPlus, Megaphone, Plus, RadioTower, ReceiptText, Scissors, ShoppingCart, UserPlus, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type QuickAction = {
  key: string;
  labelKey: string;
  path: string;
  icon: typeof CalendarPlus;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'appointment',
    labelKey: 'navigation.quick_actions.appointment',
    path: '/dashboard/calendar?action=new',
    icon: CalendarPlus,
  },
  {
    key: 'sale',
    labelKey: 'navigation.quick_actions.sale',
    path: '/dashboard/sales?action=new',
    icon: ShoppingCart,
  },
  {
    key: 'expense',
    labelKey: 'navigation.quick_actions.expense',
    path: '/dashboard/finance?action=new',
    icon: ReceiptText,
  },
  {
    key: 'customer',
    labelKey: 'navigation.quick_actions.customer',
    path: '/dashboard/customers',
    icon: UserPlus,
  },
  {
    key: 'staff',
    labelKey: 'navigation.quick_actions.staff',
    path: '/dashboard/staff',
    icon: UsersRound,
  },
  {
    key: 'service',
    labelKey: 'navigation.quick_actions.service',
    path: '/dashboard/services',
    icon: Scissors,
  },
  {
    key: 'campaign',
    labelKey: 'navigation.quick_actions.campaign',
    path: '/dashboard/marketing?action=new',
    icon: RadioTower,
  },
  {
    key: 'post',
    labelKey: 'navigation.quick_actions.post',
    path: '/dashboard/posts',
    icon: Megaphone,
  },
];

export default function OwnerQuickAdd() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          className="h-10 w-10 rounded-xl shadow-sm xl:w-auto xl:px-4"
          aria-label={t('navigation.quick_add')}
        >
          <Plus className="h-4 w-4 xl:mr-1" />
          <span className="hidden xl:inline">{t('navigation.quick_add')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-2xl p-2 shadow-xl">
        <DropdownMenuLabel className="px-2.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t('navigation.quick_add')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {QUICK_ACTIONS.map((action) => (
          <DropdownMenuItem
            key={action.key}
            className="min-h-11 cursor-pointer rounded-xl px-3"
            onSelect={() => navigate(action.path)}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <action.icon className="h-4 w-4" />
            </span>
            <span className="font-semibold">{t(action.labelKey)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
