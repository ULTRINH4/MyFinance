# MyFinance — Sistema de Gestão Financeira e Investimentos

<div align="center">

![SvelteKit](https://img.shields.io/badge/SvelteKit_2-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte_5-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)
![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

<p align="center">
  Plataforma web de alta performance para controle financeiro pessoal, conciliação de cartões e acompanhamento de carteira de investimentos.
</p>

</div>

---

## Visão Geral

O **MyFinance** é uma aplicação completa para planejamento e controle financeiro pessoal. Desenvolvido com foco em consistência contábil, segurança e performance, o sistema oferece gestão multi-contas, controle avançado de faturas de cartão de crédito, projeção de despesas recorrentes e acompanhamento de rentabilidade de investimentos.

---

## Módulos do Sistema

### Gestão Multi-contas
- Cadastro e consolidação de contas correntes, contas de investimento e contas em corretoras.
- Definição de conta padrão, saldos de abertura e opção para desconsiderar contas específicas no totalizador patrimonial.

### Cartões de Crédito e Faturas
- Controle de limites, datas de fechamento e datas de vencimento por cartão.
- Identificação visual customizada (cores, bandeiras e badges).
- Conciliação e liquidação de faturas integrada às movimentações de conta corrente.

### Lançamentos e Recorrências
- Registro de receitas, despesas e transferências entre contas (aportes, resgates e quitação de cartões).
- Parcelamentos inteligentes com cálculo dinâmico de parcelas futuras.
- Gestão de despesas e receitas fixas com projeção mensal automática.

### Acompanhamento de Investimentos
- Registro periódico de saldos patrimoniais por ativo/instituição.
- Fluxo de aportes e resgates com atualização automática do saldo da conta vinculada.
- Cálculo de rentabilidade e métricas de alocação de ativos.

### Calendário Financeiro e Relatórios
- Visualização em calendário com projeção de vencimentos de despesas e faturas.
- Relatórios analíticos com agregação por categoria, subcategoria e períodos personalizados.

### Segurança e Privacidade
- Autenticação e proteção de credenciais com hash seguro **Argon2**.
- *Modo Privacidade (Private Mode)*: Ocultação imediata de valores em tela para uso em ambientes públicos.
- Trilha de auditoria e registro de atividades de usuários.
- Suporte a instalação como Progressive Web App (PWA).

---

## Arquitetura e Tecnologias

- **Front-End & SSR**: SvelteKit 2 e Svelte 5
- **ORM & Banco de Dados**: Drizzle ORM com PostgreSQL 16
- **Criptografia & Autenticação**: `@node-rs/argon2`
- **Infraestrutura**: Docker e Docker Compose com separação em contêineres de banco (`db`), migrações/seed (`setup`) e aplicação (`app`)
- **Testes**: Vitest

---

## Execução Local

### Pré-requisitos
- Docker e Docker Compose instalados (recomendado), **ou** Node.js 18+ com PostgreSQL local.

---

### Opção 1: Execução com Docker (Recomendado)

1. Clone o repositório e acesse a pasta:
```bash
git clone https://github.com/ULTRINH4/MyFinance.git
cd MyFinance
```

2. Crie o arquivo de variáveis de ambiente a partir do exemplo:
```bash
cp .env.example .env
```

3. Defina no arquivo `.env` uma senha segura para o banco e as credenciais do usuário inicial:
```env
DB_PASSWORD=sua_senha_segura
ADMIN_EMAIL=admin@exemplo.com
ADMIN_PASSWORD=sua_senha_login
APP_PORT=3000
ORIGIN=http://localhost:3000
```

4. Suba o ambiente completo:
```bash
docker compose up -d --build
```

A aplicação inicializará o banco de dados, aplicará as migrações/seed e estará disponível em `http://localhost:3000`.

---

### Opção 2: Desenvolvimento Local sem Docker

1. Acesse o diretório da aplicação:
```bash
cd MyFinance/app
```

2. Instale as dependências:
```bash
npm install
```

3. Configure a variável de conexão `DATABASE_URL` no `.env` do diretório `app`:
```env
DATABASE_URL=postgres://usuario:senha@localhost:5432/myfinance
```

4. Execute os scripts de inicialização de schema e banco:
```bash
npx drizzle-kit push
node scripts/seed-taxonomy.js
```

5. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

---

## Testes Automatizados

Para executar os testes de lógica de negócios (recorrências, parcelamentos e regras de investimentos):

```bash
cd app
npm test
```

---

## Autor

Desenvolvido por **Gustavo** ([@ULTRINH4](https://github.com/ULTRINH4)).

---

## Licença

Este projeto está sob a licença [MIT](LICENSE).
