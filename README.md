# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário conversa com o Nexo Assist num chat. O agent consulta a central de ajuda e os chamados dele, abre e complementa chamados com confirmação e transfere o caso para um analista quando precisa. No console, o analista vê as conversas, entende o que o agent fez e por quê, assume o atendimento, conversa com o funcionário e devolve a conversa ao agent ou a encerra.

Desafio técnico do processo seletivo Beyond the Bytes. Especificação em [`docs/Desafio_Tecnico_Nexo_Assist_PRD_v5.pdf`](docs/Desafio_Tecnico_Nexo_Assist_PRD_v5.pdf) e protótipo em [`docs/nexo.pen`](docs/nexo.pen).

## Como rodar

Pré-requisitos: Node.js 20.9 ou mais novo e uma chave da API da OpenAI ([gere aqui](https://platform.openai.com/api-keys)).

```bash
npm install
cp .env.example .env      # preencha OPENAI_API_KEY e SESSION_SECRET
npm run db:seed           # cria o banco local com os dados de exemplo
npm run dev               # http://localhost:3000
```

Para gerar o `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Usuários de exemplo

O login aceita qualquer senha não vazia, já que o protótipo não tem diretório de senhas.

| E-mail | Pessoa | Papel | O que tem nos dados |
| --- | --- | --- | --- |
| `ana.souza@nexo.com.br` | Ana Souza | Funcionária | Chamado vencido (INC-20311), requisição aprovada, chamado resolvido há 4 dias (reabrível) e outro resolvido há mais tempo |
| `bruno.lima@nexo.com.br` | Bruno Lima | Funcionário | VPN com erro 809 no Windows 11 em andamento e um chamado aberto |
| `carla.mendes@nexo.com.br` | Carla Mendes | Funcionária | Uma requisição de acesso aberta |
| `diego.rocha@nexo.com.br` | Diego Rocha | Funcionário | Nenhum chamado |
| `marina.alves@nexo.com.br` | Marina Alves | **Analista** | Entra no console |

### Roteiro rápido

1. Como **Ana**, pergunte "como está meu chamado do notebook?". O agent lista os chamados, aponta que o INC-20311 passou do prazo e oferece chamar um analista. Aceite.
2. Como **Marina**, em outra janela anônima, abra o console. A conversa da Ana aparece como transferida, com o resumo do caso, o motivo, a confiança do agent e cada decisão dele. Assuma e responda.
3. De volta à Ana, a resposta da Marina aparece no chat e Ana responde. Depois Marina devolve a conversa ao agent ou a encerra.
4. Outros casos: "minha VPN dá erro 809" (artigo da central de ajuda, que vale só para Windows 10), "preciso de acesso ao Figma" (rascunho de REQ para confirmar), "o sistema de vendas caiu para toda a equipe" (chamado crítico, transferido na hora) e "quero ver meu saldo de férias" (fora do escopo, redirecionado ao RH).

### Outros comandos

| Comando | O que faz |
| --- | --- |
| `npm test` | Testes unitários, de serviços e de cenários do agent (Vitest, sem chamar o LLM) |
| `npm run typecheck` / `npm run lint` | TypeScript estrito e ESLint |
| `npm run db:seed` | Recria o banco do zero com os dados de exemplo e aplica as migrations |
| `npm run db:migrate` | Aplica as migrations pendentes sem apagar os dados |
| `npm run db:generate` | Gera uma migration a partir de `src/db/schema.ts` |
| `npm run studio` | Mastra Studio para conversar com o agent fora da interface, com presets de funcionário logado |

`TICKET_SERVICE_FAILURE_RATE` (padrão `0.1`) controla com que frequência o sistema de chamados simulado "cai". Use `0.5` para ver o tratamento de indisponibilidade e `0` para desligar.

## Arquitetura

```
src/app/            Interface e API: chat, console, login, perfil, rotas e server actions
  │ fala só com ↓
src/agent/          Agent Mastra: instruções, ferramentas, retry e registro de decisões
  │ fala só com ↓
src/services/       Regras de domínio, sem saber que existe um agent
  tickets/          Sistema de chamados "legado" simulado: consulta, cria, atualiza,
                    reabre, transfere, calcula prazo, detecta duplicidade, cai às vezes
  kb/               Central de ajuda (busca por palavras-chave)
  conversations/    Conversas, mensagens, estado, registro de decisões e console
  employees/        Diretório de funcionários (login)
src/db/             Schema Drizzle, migrations e dados de exemplo
```

- **Next.js 16 (App Router).** As páginas leem o banco e a sessão a cada requisição (Cache Components com `<Suspense>`), e nenhum dado de conversa ou chamado vai para o cache.
- **Mastra** roda o agent. A memória fica numa thread por conversa, em libSQL (`mastra.db` em desenvolvimento, um segundo banco Turso no deploy), e o `resourceId` é o funcionário logado. Assim o Mastra recusa uma thread que não pertence a ele. Os traces do Mastra Studio ficam num arquivo DuckDB só em desenvolvimento, porque as funções serverless não têm disco gravável. Em produção, o registro de decisões continua no banco.
- **libSQL + Drizzle** guardam os dados do sistema (`nexo.db`): funcionários, artigos, chamados e o histórico deles, conversas com estado (`with_agent`, `awaiting_analyst`, `with_analyst`, `closed`), mensagens e o log de decisões. Em desenvolvimento é um arquivo local; no deploy, Turso.
- **Streaming:** o chat usa `useChat` do AI SDK e a rota `/api/chat` repassa o stream do Mastra. Do cliente só se aceita a última mensagem, e o histórico vem da memória do servidor.
- **Atualização sem WebSocket:** console e chat consultam o estado periodicamente (5 s com analista, 15 s com o agent) e pausam quando a aba não está visível. É simples, funciona em qualquer hospedagem e basta para o volume de um service desk.
- **Mensagens do analista.** O que o analista escreve, e o que o funcionário responde enquanto o agent está pausado, não entra na memória do agent: fica só no banco, marcado com `outside_agent`. O chat junta as duas fontes pela hora em que cada mensagem foi escrita (`src/app/chat/_lib/chat-timeline.ts`).

## Como o agent decide

A cada mensagem o modelo recebe as instruções (`src/agent/instructions.ts`, com as regras do Anexo A, a data e o horário de atendimento), as últimas 20 mensagens da conversa e as ferramentas:

| Ferramenta | Para quê |
| --- | --- |
| `searchKnowledgeBase` | Dúvidas que o funcionário resolve sozinho |
| `listMyTickets` / `getTicket` | Status e prazo, sem precisar lembrar o número |
| `findSimilarTickets` | Checar se já existe chamado sobre o mesmo problema |
| `draftTicket` | Montar o rascunho completo e calcular o prazo, sem criar nada |
| `createTicket` / `updateTicket` / `reopenTicket` | Alterar dados, sempre com confirmação |
| `handoffToAnalyst` | Transferir com resumo e motivo |
| `suggestReplies` | Oferecer respostas rápidas e encerrar o turno |

O prompt orienta a conversa: uma pergunta por vez, classificação de tipo, categoria e prioridade, quando transferir e o que está fora do escopo. **As regras críticas não dependem do modelo obedecer.** Elas são verificadas no código das ferramentas e no serviço de chamados:

| Regra (Anexo A) | Onde é garantida |
| --- | --- |
| Rascunho antes e confirmação explícita | `createTicket` só aceita um `draftId` gerado por `draftTicket` **num turno anterior**, ou seja, o funcionário escreveu depois de ver o rascunho. Os dados vêm do rascunho, não do que o modelo repetir. Toda ação que altera dados exige `confirmed=true`. |
| Campos obrigatórios | Schemas Zod nas ferramentas e no serviço: título, descrição, tipo, categoria, prioridade e afetados |
| Sem duplicidade | O serviço recusa criar chamado se há um aberto do mesmo funcionário, na mesma categoria, sobre o mesmo problema, e devolve o existente para o agent oferecer a atualização. Chamados resolvidos há até 7 dias podem ser reabertos; depois disso, não. |
| Prioridade e prazo | O prazo é calculado pelo serviço, nunca pelo modelo: 1 h corrida para Crítica (plantão 24 h) e horas úteis de seg. a sex., das 8h às 18h, para as demais. `isOverdue` sai do serviço. |
| Transferência em caso crítico | Todo chamado crítico criado é transferido automaticamente, e isso fica registrado como uma decisão ligada à criação |
| Agent calado com analista | A rota do chat não chama o modelo se a conversa não está `with_agent`. A mensagem do funcionário é guardada para o analista. |
| Pouca segurança | Criar, atualizar ou reabrir chamado com `confidence < 0.5` é bloqueado. A transferência não, porque é o caminho certo quando falta segurança. |
| Privacidade | O id do funcionário vem da sessão (cookie assinado com HMAC), nunca do modelo. Toda consulta do serviço filtra por ele, e chamado de outra pessoa responde "não encontrado", sem confirmar que existe. |
| Limite de 30 mensagens | Contado no servidor antes de chamar o modelo, junto com o limite diário por funcionário |

O escopo (só TI) é a única regra que fica no prompt. Não há ação a bloquear, o agent apenas responde e redireciona.

### Transparência

Toda ferramenta exige do modelo `intent` (o que entendeu), `confidence` (0 a 1) e `reason` (por que escolheu a ação). Cada chamada grava um registro de decisão com esses campos, mais a ação, o resultado (sucesso, recusada ou falhou) e os detalhes. Decisões tomadas pelo sistema, como a transferência automática de um chamado crítico, ficam ligadas à decisão que as causou.

- **No chat:** acima de cada resposta aparecem as ações ("Consultou seus chamados", "Montou um rascunho"…). Ao expandir, aparecem intenção, confiança, motivo e resultado.
- **No console:** a mesma trilha ao lado de cada resposta do agent, mais o resumo da transferência com motivo e confiança. O analista entende o caso sem perguntar tudo de novo.

## Modelo e custo

O padrão é **GPT-5.4 mini** (`openai/gpt-5.4-mini`), configurável por `AGENT_MODEL` com qualquer id do Mastra (`google/gemini-2.5-flash`, `anthropic/claude-haiku-4-5`…), com a chave do provedor correspondente no `.env`. O caso pede raciocínio curto com ferramentas e respostas rápidas, e um modelo pequeno e barato dá conta porque as regras que importam estão no código, não na esperteza do modelo.

O que segura o custo por conversa:

- só as últimas 20 mensagens vão ao modelo, e chamados e decisões vivem nos serviços, não no contexto;
- as ferramentas devolvem visões enxutas dos chamados, não o registro completo;
- `suggestReplies` encerra o turno, sem uma chamada extra ao modelo depois de mostrar os botões;
- cada turno tem no máximo 8 passos do modelo, e cada mensagem, no máximo 4.000 caracteres;
- o agent não roda com a conversa transferida ou encerrada, nem passado o limite de 30 mensagens por conversa ou de 100 por funcionário em 24 horas.

## Erros e resiliência

- **Sistema de chamados fora do ar.** O serviço simulado entra em "queda" de cerca de 3 s com a probabilidade configurada. As ferramentas tentam de novo com backoff exponencial (3 tentativas, respeitando o `retryAfter` do serviço). Se continuar fora, o agent recebe um erro estruturado e explica ao funcionário que nada foi perdido. A conversa nunca quebra. O console mostra os chamados do funcionário como indisponíveis em vez de falhar.
- **Falha do modelo ou da rede.** O chat diferencia sessão expirada, servidor indisponível e conexão perdida, e oferece "Tentar novamente" sem perder a mensagem.
- **Corridas no console.** Assumir, devolver, encerrar e responder são atualizações condicionais no banco, então dois analistas não assumem a mesma conversa e só quem assumiu responde. Quem perde a corrida vê uma mensagem clara e a lista atualizada.

## Testes

`npm test` roda os testes com Vitest e bancos libSQL em memória:

- **Serviços:** prazos em horas úteis, duplicidade, reabertura, privacidade, quedas do sistema legado, transições do console e mensagens com o analista.
- **Ferramentas:** confirmação, rascunho de turno anterior, confiança mínima, duplicidade forçada pelo modelo, transferência automática, privacidade e registro de decisões.
- **Agent no loop** (`src/agent/nexo-assist.scenarios.test.ts`): o agent Mastra de verdade com um modelo roteirizado. Verifica que não cria o chamado no mesmo turno do rascunho, cria após a confirmação, ignora outro funcionário indicado pelo modelo e encerra o turno nas respostas rápidas. Os testes não chamam o LLM: são determinísticos e grátis.
- **Interface:** montagem da linha do tempo, ordenação das mensagens do analista entre as do agent, tradução de erros e rotas.

## Decisões e trade-offs

- **Regras no código, prompt para conduzir.** O prompt explica as regras para o modelo conduzir bem a conversa, e o código garante que, se o modelo errar, nada errado acontece. Isso custa ferramentas um pouco mais rígidas, como a de criar chamado, que só aceita um rascunho já mostrado.
- **Dois bancos.** A memória do agent fica no armazenamento do Mastra, e os dados do negócio ficam num banco próprio, acessado só pelos serviços. O agent pode ser trocado sem mexer nos chamados. O preço é juntar as duas fontes no chat quando um analista participa.
- **Duplicidade por palavras-chave**, na mesma categoria e do mesmo funcionário. É previsível e testável, mas não pega sinônimos distantes. Embeddings resolveriam, ao custo de mais infraestrutura.
- **Atualização periódica em vez de WebSocket ou SSE.** É simples e roda em hospedagem serverless, com um atraso de alguns segundos.
- **Login de protótipo.** E-mail corporativo do diretório e qualquer senha, com sessão em cookie `httpOnly` assinado. Não há senhas reais para validar. Pelo mesmo motivo, "Redefinir senha", na tela Meu perfil, é simulado: não envia e-mail e avisa isso na tela. A data da última alteração vem dos dados de exemplo.

## O que faria com mais tempo

- Passar ao agent um resumo do que o analista conversou quando a conversa volta para ele. Hoje ele não vê essas mensagens.
- Avaliações (evals) com o modelo real para classificação de prioridade, escopo e decisão de transferir, com um conjunto de casos e acompanhamento de regressão.
- Busca semântica na central de ajuda e na detecção de duplicidade.
- Notificar o analista em tempo real (SSE) e mostrar o prazo de primeira resposta da transferência.
- Login real e limite por IP. Com a senha simulada, o limite diário por funcionário é o que segura o custo do deploy.
- Testes de ponta a ponta da interface (Playwright).

## Deploy

A aplicação roda na **Vercel** com dois bancos **Turso**: `nexo` para os dados do sistema e `nexo-memory` para a memória do agent. São separados porque `npm run db:seed` apaga todas as tabelas do banco que recebe.

1. Crie os dois bancos no Turso e gere um token de leitura e escrita para cada um.
2. Com `DATABASE_URL` e `DATABASE_AUTH_TOKEN` apontando para `nexo` no `.env`, rode `npm run db:seed` para criar as tabelas e os dados de exemplo.
3. Importe o repositório na Vercel, que detecta o Next.js sozinha, e cadastre as variáveis de ambiente:

| Variável | Valor |
| --- | --- |
| `OPENAI_API_KEY` | Chave do provedor de LLM |
| `SESSION_SECRET` | Pelo menos 32 caracteres, gerado como em [Como rodar](#como-rodar) |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | Banco `nexo` |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Banco `nexo-memory` |

Ao publicar uma versão com migration nova, rode `npm run db:migrate` no banco `nexo` antes do deploy.

`AGENT_MODEL` e `TICKET_SERVICE_FAILURE_RATE` são opcionais. O prazo dos dados de exemplo é relativo à data do seed, então vale rodá-lo de novo perto de uma demonstração: passados 3 dias, por exemplo, o INC-20150 sai da janela de reabertura.

**Proteção contra abuso e custo.** As chaves ficam só nas variáveis de ambiente, e o cookie de sessão é assinado. O login aceita qualquer senha, então o limite vale por funcionário: 100 mensagens em 24 horas, contadas no banco para valerem em todas as instâncias serverless. Como são 5 usuários de exemplo, o teto é de 500 mensagens por dia, somado aos limites de tamanho e de passos em [Modelo e custo](#modelo-e-custo). Um limite de gasto na conta do provedor de LLM cobre o que escapar disso.
