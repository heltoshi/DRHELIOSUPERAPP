# GITHUB + CLOUDFLARE PAGES — publicar sem arrastar pasta

Objetivo: depois deste passo a passo, **você nunca mais mexe em arquivo para
atualizar o app**. Eu envio a alteração, o GitHub guarda o histórico, o Cloudflare
publica sozinho em ~1 minuto.

Testado em 24/11/2026 23:40: um clone limpo da pasta `repo/`, com `npm ci` e
`npm run build`, gerou o app completo em 3,7 s, com `config.js` e caminhos
relativos corretos.

---

## Antes de começar

Você vai precisar de:
- uma conta no **GitHub** (grátis) — github.com
- a conta do **Cloudflare** (a mesma do Pages, grátis)
- a pasta **`repo/`** que está dentro do zip — é ela que vai para o GitHub

O que **não** vai para o GitHub: `node_modules/`, `dist/` e qualquer arquivo
`.env`. Já estão bloqueados no `.gitignore`.

O que **vai** e é público: o `config.js`, que tem a chave **publishable** do
Supabase. Isso é normal — essa chave é pública por projeto, e quem protege o dado
é a política RLS no banco. **Nunca** coloque a `service_role` key no repositório.

---

## PARTE 1 — Subir o código no GitHub (10 minutos, uma vez só)

### Opção A — pelo site, sem instalar nada (recomendada)

1. Entre em `github.com` e crie a conta (ou faça login).
2. Clique em **+** (canto superior direito) → **New repository**.
3. Preencha:
   - **Repository name**: `app-cemep` (ou `painel-cemep`)
   - **Visibility**: **Private** ← importante, é código seu
   - **NÃO** marque "Add a README"
4. Clique **Create repository**.
5. Na página que aparece, clique em **"uploading an existing file"**.
6. Abra a pasta `repo/` no seu computador e **arraste tudo de dentro dela**
   (`src`, `public`, `index.html`, `package.json`, `package-lock.json`,
   `vite.config.js`, `.github`, `.gitignore`) para a área de upload.
7. Em "Commit changes", escreva `primeira versão` e clique **Commit changes**.

> O `.github` começa com ponto e pode ficar oculto no Mac (Cmd+Shift+.) e no
> Windows (Exibir → Itens ocultos). Se não conseguir arrastar a pasta, não tem
> problema: publique sem ela e eu configuro o deploy automático depois.

### Opção B — com Git instalado (se preferir terminal)

```bash
cd repo
git init
git add .
git commit -m "primeira versão"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/app-cemep.git
git push -u origin main
```

---

## PARTE 2 — Conectar o Cloudflare ao GitHub (5 minutos)

1. `dash.cloudflare.com` → **Workers & Pages** → **Create**.
2. Aba **Pages** → **Connect to Git**.
3. Autorize o Cloudflare a ver seu GitHub e escolha o repositório
   `app-cemep`.
4. Configuração de build — copie exatamente:
   - **Framework preset**: `None` (ou Vite, se aparecer)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: deixe vazio
5. **Save and Deploy**.
6. Em ~1 minuto o app está em `app-cemep.pages.dev`.

A partir daqui, **todo commit na branch `main` republica sozinho**. Você pode
acompanhar em **Deployments**.

---

## PARTE 3 — Seu endereço próprio

No painel do projeto no Cloudflare: **Custom domains** → **Set up a domain** →
digite `app.seudominio.com.br`.

Se o domínio está no Registro.br, o Cloudflare mostra um registro CNAME para
colar na zona DNS. Se o domínio já está no Cloudflare, ele configura sozinho.

---

## PARTE 4 — Deploy automático por GitHub Actions (opcional)

Só faz sentido se você quiser publicar **sem** depender da integração do
Cloudflare (por exemplo, para ter controle do passo a passo). O arquivo já está
pronto em `.github/workflows/deploy.yml`.

Para ativar, crie três secrets em **Settings → Secrets and variables → Actions**:

| Secret | Onde achar |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token → template "Edit Cloudflare Workers" |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages → lado direito, "Account ID" |
| `CLOUDFLARE_PROJECT_NAME` | o nome do projeto Pages (ex.: `app-cemep`) |

**Sem os secrets, o arquivo não quebra nada** — o passo de publicação é ignorado e
o build continua rodando como teste.

Se você já fez a Parte 2 (integração direta), pode **ignorar esta parte**: as duas
fazem a mesma coisa e a da Parte 2 é mais simples.

---

## PARTE 5 — O fluxo depois disso

### Quando eu altero o app
1. Eu te entrego os arquivos alterados (ou o zip).
2. Você arrasta na pasta do repositório no GitHub (**Add file → Upload files**,
   sobrescrevendo).
3. O Cloudflare publica sozinho. Nada de arrastar `dist`.

### Se algo quebrar depois de uma publicação
1. No GitHub, abra o commit anterior → **Revert**.
2. O Cloudflare republica a versão que funcionava.

É por isso que vale ter histórico: hoje, se uma alteração minha quebrar a tela do
paciente, não existe "voltar". Com o repositório, existe em dois cliques.

---

## Checklist de conferência

- [ ] Repositório criado como **Private**
- [ ] Todos os arquivos subiram (conferir se `src/` tem 20+ arquivos)
- [ ] Cloudflare conectado ao repositório
- [ ] Build command = `npm run build` · output = `dist`
- [ ] Primeiro deploy concluído (status "Success")
- [ ] Site abre em `*.pages.dev`
- [ ] Login de equipe funciona
- [ ] Um treino salvo aparece depois de recarregar
- [ ] (Opcional) Domínio próprio configurado com HTTPS

---

## Se der erro

| Mensagem | Causa | Solução |
|---|---|---|
| `npm ci` falha: "lockfile not found" | `package-lock.json` não subiu | envie o arquivo e rode de novo |
| Build "Success" mas tela branca | output errado | confirme `dist` em Build output directory |
| 404 ao abrir o site | arquivo `index.html` fora da raiz | ele precisa estar na raiz do repositório, não dentro de `src/` |
| Login não funciona | `config.js` não subiu | confirme que existe `public/config.js` no repositório |
| "Project not found" no Actions | nome do projeto diferente | ajuste o secret `CLOUDFLARE_PROJECT_NAME` |
