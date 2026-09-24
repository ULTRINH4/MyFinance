<script>
  import { page } from '$app/stores';
  import Icon from './Icon.svelte';
  import { sidebarSections } from '$lib/data/mock.js';
  import { sidebarOpen } from '$lib/stores/sidebar.js';

  const COLLAPSED_KEY = 'myfinance-sidebar-collapsed';
  let collapsed = $state(false);

  function toggleCollapsed() {
    collapsed = !collapsed;
    try { localStorage.setItem(COLLAPSED_KEY, String(collapsed)); } catch {}
  }

  $effect(() => {
    document.body.classList.toggle('sidebar-open', $sidebarOpen);
    return () => document.body.classList.remove('sidebar-open');
  });

  $effect(() => {
    try { collapsed = localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch {}
  });

  $effect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && $sidebarOpen) sidebarOpen.set(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  });
</script>

{#if $sidebarOpen}<button class="scrim" onclick={() => sidebarOpen.set(false)} aria-label="Close menu"></button>{/if}

<aside class="sidebar" class:open={$sidebarOpen} class:collapsed>
  <div class="sidebar-user">
    <div class="user-chip">
      <div class="user-avatar">{#if $page.data.user?.avatarUrl}<img src={$page.data.user.avatarUrl} alt="" />{:else}{($page.data.user?.email?.[0] ?? "?").toUpperCase()}{/if}</div>
      <div class="user-info"><div class="user-name">{($page.data.user?.email ?? "").split("@")[0] || "Account"}</div><div class="user-tag"><i></i> {$page.data.user?.email ?? 'Signed in'}</div></div>
    </div>
    <button class="collapse-btn" onclick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={15} /></button>
    <button class="close-btn" onclick={() => sidebarOpen.set(false)} aria-label="Close menu"><Icon name="close" size={17} /></button>
  </div>

  <nav aria-label="Main navigation" data-sveltekit-preload-code="viewport">
    {#each sidebarSections as section}
      <div class="section">
        <div class="section-title">{section.title}</div>
        {#each section.items as item}
          <a href={item.href} class="nav-item" class:active={$page.url.pathname === item.href} onclick={() => sidebarOpen.set(false)} title={collapsed ? item.label : undefined}>
            <span class="nav-icon"><Icon name={item.icon} size={17} /></span>
            <span class="nav-label">{item.label}</span>
            {#if item.soon}<span class="soon">Soon</span>{/if}
          </a>
        {/each}
      </div>
    {/each}
  </nav>
</aside>

<style>
.scrim {
  position: fixed;
  inset: 0;
  display: none;
  border: 0;
  background: rgba(4,5,10,.6);
  backdrop-filter: blur(2px);
  z-index: 40;
}
.sidebar {
  position: sticky;
  top: 0;
  width: var(--sidebar-width);
  height: 100vh;
  height: 100dvh;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border-right: 1px solid var(--border);
  backdrop-filter: blur(var(--card-blur)) saturate(var(--card-saturation));
  transition: width var(--motion-duration),transform var(--motion-duration);
}
.sidebar.collapsed {
  width: 72px;
}
.collapse-btn, .close-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.collapse-btn:hover, .close-btn:hover {
  border-color: var(--border-soft);
  background: var(--panel-strong);
  color: var(--text);
}
.close-btn {
  display: none;
}
nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 11px;
}
.section {
  margin-bottom: 12px;
}
.section-title {
  padding: 10px 9px 6px;
  color: var(--faint);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
  white-space: nowrap;
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 39px;
  margin-bottom: 3px;
  padding: 8px 9px;
  border-radius: 10px;
  color: var(--muted);
  text-decoration: none;
  font-size: 13px;
  font-weight: 650;
  transition: background var(--motion-duration),color var(--motion-duration);
}
.nav-item::before {
  content: '';
  position: absolute;
  left: 0;
  width: 3px;
  height: 18px;
  border-radius: 0 4px 4px 0;
  background: var(--accent-solid);
  opacity: 0;
  transform: scaleY(.4);
  transition: opacity var(--motion-duration),transform var(--motion-duration);
}
.nav-item:hover {
  background: var(--panel-strong);
  color: var(--text);
}
.nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
}
.nav-item.active::before {
  opacity: 1;
  transform: scaleY(1);
}
.nav-icon {
  width: 21px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nav-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.soon {
  margin-left: auto;
  padding: 3px 6px;
  border: 1px solid var(--border-soft);
  border-radius: 99px;
  color: var(--faint);
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
}
.collapsed nav {
  padding-inline: 10px;
}
.collapsed .section {
  padding-top: 7px;
  margin-bottom: 5px;
  border-top: 1px solid var(--border-soft);
}
.collapsed .section:first-child {
  border-top: 0;
}
.collapsed .section-title, .collapsed .nav-label, .collapsed .soon {
  display: none;
}
.collapsed .nav-item {
  justify-content: center;
  padding: 8px;
}
.collapsed .nav-item::before {
  left: -10px;
}
.sidebar-user {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 11px;
  border-bottom: 1px solid var(--border-soft);
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding: 7px;
  border-radius: 10px;
  overflow: hidden;
}
.user-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel-strong);
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
}
.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.user-info {
  min-width: 0;
}
.user-name {
  font-size: 12px;
  font-weight: 800;
}
.user-tag {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-top: 2px;
  color: var(--faint);
  font-size: 9px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-tag i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--positive);
}
.collapsed .sidebar-user {
  flex-direction: column;
  gap: 8px;
  padding: 10px 6px;
}
.collapsed .user-chip {
  justify-content: center;
  flex: 0 1 auto;
  padding: 4px;
}
.collapsed .user-info {
  display: none;
}
@media(max-width:900px) {
  .scrim {
    display: block;
  }
  .sidebar, .sidebar.collapsed {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 41;
    width: min(300px,86vw);
    max-height: 100dvh;
    overflow: hidden;
    transform: translateX(-100%);
    box-shadow: 20px 0 60px rgba(0,0,0,.5);
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .collapse-btn {
    display: none;
  }
  .close-btn {
    display: flex;
  }
  nav {
    padding-bottom: max(4px,env(safe-area-inset-bottom));
  }
  .collapsed nav {
    padding: 4px 11px;
    padding-bottom: max(4px,env(safe-area-inset-bottom));
  }
  .collapsed .section {
    padding: 0;
    margin-bottom: 12px;
    border: 0;
  }
  .collapsed .section-title {
    display: block;
  }
  .collapsed .nav-item {
    justify-content: flex-start;
    padding: 8px 9px;
  }
  .collapsed .nav-label {
    display: block;
  }
  .collapsed .soon {
    display: inline-block;
  }
  .collapsed .nav-item::before {
    left: 0;
  }
  .sidebar-user, .collapsed .sidebar-user {
    flex-direction: row;
    padding: 11px;
  }
  .collapsed .user-chip {
    justify-content: flex-start;
    flex: 1;
    padding: 7px;
  }
  .collapsed .user-info {
    display: block;
  }
}
</style>
