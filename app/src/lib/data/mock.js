// Dados fictícios pra desenvolvimento do front (fase 1, sem backend).
// Formato pensado pra já bater com o schema.md quando o backend existir.

// Ícone padrão por categoria (bate com o nome usado no Icon.svelte) — mantém
// consistência visual entre o donut, a lista de transações e futuras telas.
export const categoryIcon = {
  Food: 'utensils',
  Grocery: 'cart',
  Leisure: 'ticket',
  Car: 'car',
  Clothing: 'shirt',
  Services: 'wrench',
  Taxes: 'percent',
  Bills: 'bolt',
  Subscriptions: 'repeat',
  Payments: 'user',
  Others: 'shapes'
};

export const sidebarSections = [
  {
    title: 'Workspace',
    items: [{ label: 'Summary', href: '/', icon: 'dashboard' }]
  },
  {
    title: 'Manage',
    items: [
      { label: 'Accounts', href: '/accounts', icon: 'wallet' },
      { label: 'Transactions', href: '/transactions', icon: 'list' },
      { label: 'Fixed monthly', href: '/fixed-monthly', icon: 'repeat' },
      { label: 'Credit cards', href: '/credit-cards', icon: 'card' },
      { label: 'Investments', href: '/investments', icon: 'trending' }
    ]
  },
  {
    title: 'Analyze',
    items: [
      { label: 'Reports', href: '/reports', icon: 'search' },
      { label: 'Categories', href: '/categories', icon: 'tag' },
      { label: 'Calendar', href: '/calendar', icon: 'calendar' }
    ]
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', href: '/settings', icon: 'gear' },
      ...(import.meta.env.DEV ? [
        { label: 'Activity', href: '/activity', icon: 'clock' }
      ] : [])
    ]
  }
];
