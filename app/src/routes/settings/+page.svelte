<script>
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import DebugPanel from '$lib/components/DebugPanel.svelte';
  import { privateMode } from '$lib/stores/privateMode.js';
  import { showCardTransactions } from '$lib/stores/settings.js';
  import {
    radiusPresets, accentPresets, sidebarPresets, motionPresets, defaultAppearance,
    applyRadius, applyAccent, applySidebar, applyMotion, loadAppearance, saveAppearance
  } from '$lib/data/appearance.js';

  let { form } = $props();
  const email = $derived($page.data.user?.email ?? '');
  const avatarUrl = $derived($page.data.user?.avatarUrl ?? null);
  let debugRef = $state();
  let avatarInput = $state();
  let avatarUploading = $state(false);
  let radiusId = $state(defaultAppearance.radiusId);
  let accentId = $state(defaultAppearance.accentId);
  let sidebarId = $state(defaultAppearance.sidebarId);
  let motionId = $state(defaultAppearance.motionId);

  function persist() {
    const saved = loadAppearance() || { ...defaultAppearance };
    saveAppearance({ ...saved, radiusId, accentId, sidebarId, motionId });
  }

  function setRadius(id) { applyRadius(id); radiusId = id; persist(); }
  function setAccent(id) { applyAccent(id); accentId = id; persist(); }
  function setSidebar(id) { applySidebar(id); sidebarId = id; persist(); }
  function setMotion(id) { applyMotion(id); motionId = id; persist(); }

  $effect(() => {
    const saved = loadAppearance();
    if (!saved) return;
    if (saved.radiusId) radiusId = saved.radiusId;
    if (saved.accentId) accentId = saved.accentId;
    if (saved.sidebarId) sidebarId = saved.sidebarId;
    if (saved.motionId) motionId = saved.motionId;
  });
</script>

<svelte:head><title>Settings · MyFinance</title></svelte:head>

<PageHeader eyebrow="Preferences" title="Settings" maxWidth="760px" />

<main class="page-content">
  <section class="g-card profile-card">
    <form
      class="avatar-form"
      method="POST"
      action="?/uploadAvatar"
      enctype="multipart/form-data"
      use:enhance={() => { avatarUploading = true; return async ({ update }) => { await update(); avatarUploading = false; }; }}
    >
      <button type="button" class="profile-avatar" class:has-image={avatarUrl} onclick={() => avatarInput.click()} aria-label="Change profile picture">
        {#if avatarUrl}<img src={avatarUrl} alt="" />{:else}{(email[0] ?? "?").toUpperCase()}{/if}
        <span class="avatar-edit"><Icon name="camera" size={13} /></span>
      </button>
      <input bind:this={avatarInput} type="file" name="avatar" accept="image/*" hidden onchange={(event) => event.currentTarget.form.requestSubmit()} />
    </form>
    <div class="profile-copy">
      <strong>{email.split("@")[0]}</strong>
      <span><i></i> {email}</span>
      {#if avatarUploading}<small class="avatar-status">Uploading…</small>
      {:else if form?.avatarError}<small class="avatar-status error">{form.avatarError}</small>
      {:else if avatarUrl}<form method="POST" action="?/removeAvatar" use:enhance><button type="submit" class="avatar-remove">Remove picture</button></form>{/if}
    </div>
    <form class="logout-form" method="POST" action="?/logout" use:enhance>
      <button type="submit" class="logout-btn"><Icon name="close" size={14} /> Log out</button>
    </form>
  </section>

  <section class="g-card settings-section">
    <div class="section-title"><h3>Privacy</h3><small>Applies to every page immediately</small></div>
    <div class="setting-row">
      <div class="setting-copy"><strong>Private mode</strong><span>Blurs every amount on screen without hiding labels or categories.</span></div>
      <button class="toggle" class:on={$privateMode} onclick={() => privateMode.update((v) => !v)} aria-pressed={$privateMode}>
        <span class="toggle-thumb"></span>
      </button>
    </div>
    <div class="setting-row static">
      <div class="setting-copy"><strong>Currency</strong><span>Fixed as Brazilian Real for v1.</span></div>
      <span class="static-value">R$ · pt-BR amounts, en-US UI</span>
    </div>
  </section>

  <section class="g-card settings-section">
    <div class="section-title"><h3>Behavior</h3><small>Mostly fixed defaults — see docs/summary.md</small></div>
    <div class="setting-row">
      <div class="setting-copy"><strong>Show card transactions in Transactions</strong><span>When off, Expense and Income only show the invoice line plus non-card purchases — not one row per card purchase.</span></div>
      <button class="toggle" class:on={$showCardTransactions} onclick={() => showCardTransactions.update((v) => !v)} aria-pressed={$showCardTransactions}>
        <span class="toggle-thumb"></span>
      </button>
    </div>
    <div class="setting-row static">
      <div class="setting-copy"><strong>Local / Who suggestions</strong><span>The transaction form suggests names you've already used, so repeat entries take less typing.</span></div>
      <span class="static-value">Always on</span>
    </div>
    <div class="setting-row static">
      <div class="setting-copy"><strong>Accumulate balance across months</strong><span>Each month's opening balance is the previous month's real closing balance.</span></div>
      <span class="static-value">Always on</span>
    </div>
    <div class="setting-row static">
      <div class="setting-copy"><strong>Pending first</strong><span>Transactions lists show pending items before paid ones, newest due date first.</span></div>
      <span class="static-value">Always on</span>
    </div>
    <div class="setting-row static">
      <div class="setting-copy"><strong>Installments follow due date</strong><span>A split purchase creates one record per installment, each counted in its own due month.</span></div>
      <span class="static-value">Always on</span>
    </div>
  </section>

  <section class="g-card settings-section">
    <div class="section-title"><h3>Appearance</h3></div>

    <div class="setting-block">
      <div class="setting-copy"><strong>Accent color</strong><span>Used for highlights, active states and charts.</span></div>
      <div class="swatch-row">
        {#each accentPresets as p}
          <button class="swatch" class:on={accentId === p.id} style="background:{p.solid}" title={p.label} aria-label={p.label} onclick={() => setAccent(p.id)}></button>
        {/each}
      </div>
    </div>

    <div class="setting-block">
      <div class="setting-copy"><strong>Corner radius</strong><span>Card and button roundness.</span></div>
      <div class="chip-row">
        {#each radiusPresets as p}<button class="chip" class:on={radiusId === p.id} onclick={() => setRadius(p.id)}>{p.label}</button>{/each}
      </div>
    </div>

    <div class="setting-block">
      <div class="setting-copy"><strong>Sidebar width</strong><span>Desktop navigation width.</span></div>
      <div class="chip-row">
        {#each sidebarPresets as p}<button class="chip" class:on={sidebarId === p.id} onclick={() => setSidebar(p.id)}>{p.label}</button>{/each}
      </div>
    </div>

    <div class="setting-block">
      <div class="setting-copy"><strong>Motion speed</strong><span>Transition duration across the app.</span></div>
      <div class="chip-row">
        {#each motionPresets as p}<button class="chip" class:on={motionId === p.id} onclick={() => setMotion(p.id)}>{p.label}</button>{/each}
      </div>
    </div>

  </section>

  {#if import.meta.env.DEV}
    <section class="g-card settings-section">
      <div class="section-title"><h3>Developer</h3><small>Dev only — not in production</small></div>
      <div class="setting-row">
        <div class="setting-copy"><strong>Debug tools</strong><span>Switch months, force pending values, create sample transactions, edit card invoices.</span></div>
        <button class="dev-btn" onclick={() => debugRef.openPanel()}><Icon name="flask" size={15} /> Open</button>
      </div>
    </section>
  {/if}
</main>

{#if import.meta.env.DEV}
  <DebugPanel bind:this={debugRef} />
{/if}

<style>
.page-content {
  width: min(760px,100%);
  margin: 0 auto;
  padding: 0 28px 60px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 18px;
}
.avatar-form {
  position: relative;
  flex-shrink: 0;
}
.profile-avatar {
  position: relative;
  width: 46px;
  height: 46px;
  border: 0;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 16px;
  font-weight: 800;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
}
.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-edit {
  position: absolute;
  inset: auto -3px -3px auto;
  display: flex;
  width: 19px;
  height: 19px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-solid);
  color: var(--bg);
  border: 2px solid var(--card);
}
.avatar-status {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 9.5px;
}
.avatar-status.error {
  color: var(--negative);
}
.avatar-remove {
  margin-top: 3px;
  border: 0;
  background: transparent;
  color: var(--faint);
  padding: 0;
  font-size: 9.5px;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}
.avatar-remove:hover {
  color: var(--negative);
}
.profile-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.profile-copy strong {
  font-size: 15px;
}
.profile-copy span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--faint);
  font-size: 10px;
}
.profile-copy span i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--positive);
}
.logout-form {
  margin-left: auto;
}
.logout-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}
.logout-btn:hover {
  border-color: var(--negative);
  color: var(--negative);
}
.section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 18px 4px;
}
.section-title h3 {
  margin: 0;
  font-size: 14.5px;
}
.section-title small {
  color: var(--muted);
  font-size: 10px;
  text-align: right;
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-top: 1px solid var(--border-soft);
}
.setting-block {
  padding: 12px 18px 16px;
  border-top: 1px solid var(--border-soft);
}
.setting-block .setting-copy {
  margin-bottom: 10px;
}
.setting-copy {
  min-width: 0;
}
.setting-copy strong {
  display: block;
  font-size: 12.5px;
}
.setting-copy span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10.5px;
}
.static-value {
  flex-shrink: 0;
  color: var(--faint);
  font-size: 10.5px;
  font-weight: 700;
  text-align: right;
}
.toggle {
  position: relative;
  width: 42px;
  height: 24px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 99px;
  background: var(--panel);
  cursor: pointer;
}
.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--muted);
  transition: transform var(--motion-duration), background var(--motion-duration);
}
.toggle.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.toggle.on .toggle-thumb {
  transform: translateX(18px);
  background: var(--accent);
}
.swatch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.swatch {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  border: 2px solid var(--border-soft);
  cursor: pointer;
}
.swatch.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.chip {
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  background: var(--panel);
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}
.chip.on {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.dev-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 8px 14px;
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: 9px;
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
}
@media(max-width:900px) {
  .page-content {
    padding: 0 10px 40px;
  }
  .setting-row {
    flex-wrap: wrap;
  }
  .static-value {
    text-align: left;
  }
}
</style>
