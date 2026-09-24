
<script>
  import { enhance } from '$app/forms';

  let { form } = $props();
  let loading = $state(false);
</script>

<svelte:head><title>Log in · MyFinance</title></svelte:head>

<div class="login-screen">
  <form class="g-card login-card" method="POST" use:enhance={() => {
    loading = true;
    return async ({ update }) => { await update(); loading = false; };
  }}>
    <div class="login-brand">
      <div class="login-mark">M</div>
      <div>
        <strong>MyFinance</strong>
        <span>Sign in to continue</span>
      </div>
    </div>

    {#if form?.error}
      <div class="login-error">{form.error}</div>
    {/if}

    <label class="login-field" for="login-email">
      <span>Email</span>
      <input id="login-email" type="email" name="email" autocomplete="username" inputmode="email" required value={form?.email ?? ''} />
    </label>

    <label class="login-field" for="login-password">
      <span>Password</span>
      <input id="login-password" type="password" name="password" autocomplete="current-password" required />
    </label>

    <button type="submit" class="login-submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
  </form>
</div>

<style>
  .login-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    width: 100%;
    padding: 24px;
  }
  .login-card {
    width: min(360px, 100%);
    padding: 28px 26px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    box-shadow: var(--glow);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .login-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;
  }
  .login-mark {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 11px;
    background: var(--accent-panel);
    color: var(--accent);
    font-weight: 800;
    font-size: 17px;
  }
  .login-brand strong {
    display: block;
    font-size: 15px;
  }
  .login-brand span {
    display: block;
    color: var(--muted);
    font-size: 11.5px;
    margin-top: 1px;
  }
  .login-error {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 11px;
    border-radius: 10px;
    background: var(--negative-soft);
    color: var(--negative);
    font-size: 12.5px;
    font-weight: 600;
  }
  .login-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .login-field span {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--muted);
  }
  .login-field input {
    height: 40px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel);
    color: var(--text);
    font: inherit;
    font-size: 13.5px;
  }
  .login-field input:focus {
    outline: none;
    border-color: var(--border-hover);
  }
  .login-submit {
    height: 42px;
    margin-top: 4px;
    border: 0;
    border-radius: 10px;
    background: var(--accent-solid);
    color: var(--bg);
    font: inherit;
    font-size: 13.5px;
    font-weight: 800;
    cursor: pointer;
  }
  .login-submit:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
