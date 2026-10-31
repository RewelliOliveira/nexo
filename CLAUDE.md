# Nexo Assist

Agent de atendimento do service desk de TI da Nexo (~2.000 funcionários). O funcionário conversa num chat; o agent consulta a central de ajuda e os chamados dele, abre/atualiza chamados e transfere para um analista quando precisa. Analistas usam um console para assumir, devolver e encerrar conversas.

Desafio técnico (Beyond the Bytes). Especificação completa: `docs/Desafio_Tecnico_Nexo_Assist_PRD_v5.pdf`. Protótipo visual: `docs/nexo.pen`.

## Stack

- TypeScript com `strict: true` — sem `any`, sem `@ts-ignore`
- Next.js (App Router) + React para interface e API routes
- Mastra para o agent; provedor de LLM configurável via `.env`
- libSQL (compatível com SQLite) via Drizzle ORM para persistência — arquivo local em dev, Turso no deploy; memória do Mastra usa `@mastra/libsql`
- Vitest para testes; Zod para validar entradas e saídas das ferramentas

## Comandos

- `npm install` — instalar dependências
- `npm run dev` — rodar localmente (http://localhost:3000)
- `npm run db:seed` — recriar o banco com os dados de exemplo
- `npm test` — testes unitários e de cenários do agent
- `npm run lint` / `npm run typecheck`

## Arquitetura

Três camadas separadas. Uma camada só fala com a de baixo através da interface pública dela.

- `src/app/` — interface (chat do funcionário, console do analista) e API routes
- `src/agent/` — agent Mastra: instruções, ferramentas e registro de decisões
- `src/services/tickets/` — serviço de chamados simulado (consultar, criar, atualizar, transferir). Não conhece o agent.
- `src/services/kb/` — central de ajuda (artigos)
- `src/db/` — schema, migrations e seed

Persistem no banco: conversas, mensagens, chamados, estado da conversa (`with_agent` | `awaiting_analyst` | `with_analyst` | `closed`) e o log de decisões.

## Regras de domínio (Anexo A do PRD)

As regras críticas são verificadas **no código das ferramentas**, não só no prompt. Se o modelo errar, o sistema bloqueia.

- **Tipos:** INC (algo parou ou não funciona) e REQ (pedido de acesso, equipamento ou software)
- **Categorias:** Acesso, Rede e VPN, Hardware, Software, E-mail, Outros
- **Abertura:** título, descrição, tipo, categoria, prioridade e afetado são obrigatórios. Sempre mostrar rascunho e só criar/atualizar após confirmação explícita.
- **Duplicidade:** se existe chamado aberto sobre o mesmo problema, atualizar em vez de criar. Chamados resolvidos há até 7 dias podem ser reabertos.
- **Prioridade e prazo:** Crítica (equipe/empresa parada) 1h · Alta (uma pessoa impedida ou compromisso no dia) 4h úteis · Média (atrapalha, há alternativa) 3 dias úteis · Baixa (sem urgência) 5 dias úteis. Passado o prazo, o chamado está vencido.
- **Transferência:** quando o funcionário pede, em casos críticos, em chamados vencidos ou quando o agent não tem segurança. Leva resumo do caso. Com a conversa transferida, o agent não responde.
- **Privacidade:** dados de um chamado só para quem o abriu. Toda consulta filtra pelo funcionário logado.
- **Escopo:** apenas TI. RH, financeiro e facilities são redirecionados.
- **Limite:** 30 mensagens por sessão.

## Transparência (parte mais importante do desafio)

Toda ação do agent gera um registro de decisão com: intenção entendida, ação tomada, confiança (0–1) e motivo. A interface mostra as ações acima de cada resposta e permite expandir o detalhe.

## Convenções

- Erros do serviço de chamados (legado, fica fora do ar alguns segundos) são tratados com retry e mensagem clara ao usuário — nunca quebram a conversa
- Chaves e segredos só via `.env`; manter `.env.example` atualizado
- **Idioma:** textos exibidos ao usuário (interface, respostas do agent) em português. Todo o resto em inglês: variáveis, funções, tipos, componentes, nomes de arquivos e pastas, comentários e commits.
- **Nomes:** componentes React em `PascalCase` (`TicketCard.tsx`); demais arquivos em `kebab-case` (`ticket-service.ts`); variáveis e funções em `camelCase`; constantes em `UPPER_SNAKE_CASE`
- **Valores de domínio:** usar identificadores em inglês no código e no banco (`priority: 'critical' | 'high' | 'medium' | 'low'`, `status: 'with_agent' | 'awaiting_analyst' | 'with_analyst' | 'closed'`) e traduzir só na interface

## Commits

Os commits são avaliados ("commits que contem a história do desenvolvimento"). Seguir Conventional Commits.

- **Formato:** `type(scope): description` — descrição em inglês, no imperativo ("add", não "added"), minúscula, sem ponto final, até ~72 caracteres
- **Tipos:** `feat` (funcionalidade) · `fix` (correção) · `test` (testes) · `refactor` (sem mudar comportamento) · `docs` (README, documentação) · `chore` (config, dependências, setup) · `style` (formatação, sem lógica)
- **Escopos:** `agent` · `tickets` · `kb` · `db` · `chat` · `console` · `auth` · `ui`
- **Um commit por passo lógico** — pequeno, que compile e passe nos testes. Nunca misturar funcionalidades não relacionadas.
- **Corpo opcional** (após linha em branco) explicando o _porquê_ quando a decisão não for óbvia

Exemplos:

```
chore: set up next.js with strict typescript
feat(tickets): add simulated ticket service with seed data
feat(agent): check for duplicates before creating a ticket
fix(tickets): retry when legacy ticket service is unavailable
test(agent): add handoff and privacy scenarios
docs: describe architecture and agent decisions in readme
```

## Não fazer

- Não colocar regra crítica apenas no prompt
- Não acessar o banco diretamente a partir do agent — sempre via serviços
- Não adicionar dependências sem necessidade clara
- Next 16 com Cache Components ativo: páginas e rotas que leem o banco ou a sessão são dinâmicas (usar `await connection()` ou envolver em `<Suspense>`); nada de dado de chamado/conversa em cache
