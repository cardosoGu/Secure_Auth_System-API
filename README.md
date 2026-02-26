# 🔐 Auth Service

API de autenticação robusta construída com **Node.js**, **Fastify** e **TypeScript**, com foco em segurança, arquitetura limpa e boas práticas de mercado.

---

## 🚀 Funcionalidades

- **Autenticação Local** — Registro, verificação por email e login com código de 6 dígitos (fluxo similar a 2FA)
- **JWT** — Access token de curta duração (15min) + refresh token de longa duração (7d)
- **Rotação de Refresh Token** — Cada uso gera um novo token, invalidando o anterior
- **Cookies HTTPOnly** — Tokens armazenados em cookies seguros, inacessíveis ao JavaScript
- **Gerenciamento de Sessões** — Rastreamento completo com IP e User-Agent
- **Log de Atividades** — Todo login e registro é registrado com status e metadados
- **Rate Limiting** — Limitação por rota e por IP, armazenada no PostgreSQL
- **Verificação por Email** — Integração SMTP com templates HTML customizados
- **Validação de Inputs** — Todos os dados validados com schemas Zod
- **Headers de Segurança** — Helmet.js para proteção HTTP
- **OAuth** — Login e registro com GitHub e Google

---

## 🛠️ Stack

| Camada          | Tecnologia              |
| --------------- | ----------------------- |
| Runtime         | Node.js v22             |
| Linguagem       | TypeScript 5            |
| Framework       | Fastify 5               |
| ORM             | Prisma 7                |
| Banco de Dados  | PostgreSQL 18 (Docker)  |
| Validação       | Zod                     |
| Autenticação    | JWT (jsonwebtoken)      |
| Email           | Nodemailer + Gmail SMTP |
| Hash de Senha   | bcrypt                  |
| Containerização | Docker                  |

---

## 📁 Estrutura do Projeto

```
src/
├── config/
│   └── env.ts                  # Variáveis de ambiente validadas com Zod
├── lib/
│   ├── prisma.ts               # Singleton do Prisma Client
│   ├── mailer.ts               # Transporter do Nodemailer
│   ├── token.ts                # Utilitários de geração/verificação JWT
│   ├── hash.ts                 # Utilitários de hash com bcrypt
│   └── emailTemplate.ts        # Templates HTML de email
├── middlewares/
│   ├── auth.middleware.ts       # Verifica access token e injeta req.user
│   ├── notLogged.middleware.ts  # Bloqueia usuários autenticados nas rotas de auth
│   └── rateLimit.middleware.ts  # Rate limiting por IP e por rota
└── modules/
    └── auth/
        ├── schemas/
        │   └── auth.schema.ts          # Schemas Zod para validação
        ├── repositories/
        │   └── auth.repository.ts      # Todas as operações no banco
        ├── services/
        │   ├── auth.createVerificationCode.ts
        │   └── auth.validateVerificationCode.ts
        ├── controllers/
        │   ├── registerController.ts
        │   ├── verifyController.ts
        │   ├── loginController.ts
        │   ├── refreshController.ts
        │   └── logoutController.ts
        └── routes/
            └── auth.routes.ts

prisma/
├── schema.prisma
└── auth/
    ├── user.prisma
    ├── session.prisma
    ├── pendingAuth.prisma
    ├── activeLog.prisma
    ├── oauthAccount.prisma
    └── rateLimit.prisma
```

---

## 🔄 Fluxo de Autenticação

### Registro

```
POST /api/auth/register
  → Valida input com Zod
  → Verifica se email já existe
  → Cria PendingAuth com hash do código + hash da senha
  → Envia código de verificação por email
  → Retorna 201
```

### Verificação (Register e Login)

```
POST /api/auth/verify
  → Valida código contra o hash no banco
  → Verifica expiração e se já foi utilizado
  → Se usuário não existe → cria User (Register)
  → Se usuário existe → apenas autentica (Login)
  → Cria Session com refreshToken
  → Registra no ActiveLog
  → Seta cookies HTTPOnly (accessToken + refreshToken)
  → Retorna 200
```

### Login

```
POST /api/auth/login
  → Verifica se usuário existe
  → Compara senha com hash
  → Gera novo código de verificação
  → Envia por email
  → Retorna 200 (aguarda verificação)
```

### Refresh Token

```
POST /api/auth/refresh
  → Lê refreshToken do cookie
  → Valida e busca sessão no banco
  → Rotaciona o refreshToken (gera novo, invalida o anterior)
  → Gera novo accessToken
  → Atualiza cookies
  → Retorna 200
```

### Rota visualizacao de usuario logado

```
GET /api/auth/me
  → Rota destinada para fins de desenvolvimento
```

### Logout

```
POST /api/auth/logout
  → Verifica se está autenticado (authMiddleware)
  → Deleta sessão do banco
  → Limpa cookies
  → Retorna 200
```

### OAuth (GitHub / Google)

```
GET /api/auth/oauth/github
GET /api/auth/oauth/google
  → Redireciona para o provider

GET /api/auth/oauth/github/callback
GET /api/auth/oauth/google/callback
  → Recebe dados do provider
  → Se OAuthAccount não existe → cria User + OAuthAccount
  → Se OAuthAccount existe → apenas autentica
  → Cria Session
  → Registra no ActiveLog
  → Seta cookies HTTPOnly
  → Retorna 200
```

```
User           → dados do usuário
Session        → sessões ativas com refreshToken
PendingAuth    → códigos de verificação temporários
ActiveLog      → histórico de logins e registros
OAuthAccount   → vinculação com provedores OAuth
RateLimit      → controle de requisições por IP/rota
```

---

## 🔒 Decisões de Segurança

- **Tokens em cookies HTTPOnly** — inacessíveis ao JavaScript, protege contra XSS
- **Rotação total de refresh token** — cada uso invalida o anterior, protege contra roubo de token
- **Detecção de reuso** — código de verificação marcado como usado após validação
- **Mensagem genérica no login** — `Invalid credentials` para qualquer falha, sem revelar se o email existe
- **Hash de senha e código** — bcrypt com 10 salt rounds, nunca armazenados em texto puro
- **Expiração de código** — PendingAuth expira em 15 minutos
- **Rate limiting** — proteção contra brute force nas rotas sensíveis

---

## ⚙️ Como Rodar

### Pré-requisitos

- Node.js v22+
- Docker

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/auth-service.git
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente igual ao .env.example

### 4. Suba o banco com Docker

```bash
docker run --name authdb \
  -e POSTGRES_USER=usuario \
  -e POSTGRES_PASSWORD=senha \
  -e POSTGRES_DB=authdb \
  -p 5433:5432 \
  -d postgres
```

### 5. Rode as migrations

```bash
npx prisma migrate dev
```

### 6. Inicie o servidor

```bash
npm run dev
```

---

## 📡 Rotas da API

| Método | Rota                              | Descrição                          | Auth |
| ------ | --------------------------------- | ---------------------------------- | ---- |
| POST   | `/api/auth/register`              | Cadastro com verificação por email | ❌   |
| POST   | `/api/auth/verify`                | Verificação do código              | ❌   |
| POST   | `/api/auth/login`                 | Login com verificação por email    | ❌   |
| POST   | `/api/auth/refresh`               | Renovação do access token          | ✅   |
| POST   | `/api/auth/logout`                | Encerrar sessão                    | ✅   |
| GET    | `/api/auth/oauth/github`          | Login com GitHub                   | ❌   |
| GET    | `/api/auth/oauth/github/callback` | Callback GitHub                    | ❌   |
| GET    | `/api/auth/oauth/google`          | Login com Google                   | ❌   |
| GET    | `/api/auth/oauth/google/callback` | Callback Google                    | ❌   |
| GET    | `/api/auth/me`                    | Info do user logado                | ✅   |

---

## 👨‍💻 Autor

**Gustavo Cardoso**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://linkedin.com/in/seu-perfil)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white)](https://github.com/seu-usuario)
