<script>
  import Icon from './Icon.svelte';
  import { sidebarOpen } from '$lib/stores/sidebar.js';
  let { title, eyebrow = 'Workspace', description, next = 'Product definition' } = $props();
</script>

<header class="preview-header">
  <button class="menu-button" onclick={() => sidebarOpen.set(true)} aria-label="Open menu"><Icon name="menu" size={19} /></button>
  <div><span>{eyebrow}</span><h1>{title}</h1></div>
</header>
<main class="preview-content">
  <section class="preview-card g-card">
    <span class="preview-icon"><Icon name="flask" size={23} /></span>
    <span class="status">Planned workspace</span>
    <h2>{title} is the next product pass</h2>
    <p>{description}</p>
    <div class="next"><span>Next milestone</span><strong>{next}</strong></div>
  </section>
</main>

<style>
.preview-header, .preview-content {
  width: min(1120px,100%);
  margin: 0 auto;
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 24px 28px 18px;
}
.preview-header span {
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .09em;
  text-transform: uppercase;
}
.preview-header h1 {
  margin: 2px 0 0;
  font-size: 24px;
}
.menu-button {
  display: none;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  align-items: center;
  justify-content: center;
}
.preview-content {
  padding: 0 28px 50px;
}
.preview-card {
  max-width: 620px;
  padding: 30px;
}
.preview-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 15px;
  background: var(--accent-soft);
  color: var(--accent);
}
.status {
  display: inline-block;
  margin-top: 22px;
  padding: 4px 8px;
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 9px;
  font-weight: 900;
  text-transform: uppercase;
}
.preview-card h2 {
  margin: 10px 0 7px;
  font-size: 21px;
}
.preview-card p {
  max-width: 500px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
.next {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-soft);
}
.next span, .next strong {
  display: block;
}
.next span {
  color: var(--muted);
  font-size: 9px;
  text-transform: uppercase;
}
.next strong {
  margin-top: 3px;
  font-size: 12px;
}
@media(max-width:900px) {
  .menu-button {
    display: flex;
  }
  .preview-header {
    padding: 18px 16px 12px;
  }
  .preview-header h1 {
    font-size: 20px;
  }
  .preview-content {
    padding: 0 8px 30px;
  }
  .preview-card {
    padding: 22px;
  }
}
</style>
