# Bot DownTorrents Games Discord 🏴‍☠️

Este é um bot robusto e multifuncional para Discord, desenvolvido especificamente para a comunidade **DownTorrentsGames**. Ele atua como o núcleo de gerenciamento do servidor, automatizando a publicação de jogos/softwares, gerenciando suporte, anúncios bilíngues e mantendo uma biblioteca pesquisável via Banco de Dados.

> **Versão Atual:** v30 (PostgreSQL Edition)

## ✨ Funcionalidades Principais

### 📚 Biblioteca e Busca Inteligente
* **Banco de Dados PostgreSQL:** Todos os jogos e softwares são salvos em um banco de dados robusto, garantindo segurança e performance.
* **Busca Inteligente (`/dtg buscar`):** Usuários podem pesquisar jogos instantaneamente. O sistema gera **tags automáticas** (siglas, nomes limpos) para facilitar a localização (ex: buscar "gta" encontra "Grand Theft Auto").
* **Importação de Histórico:** Scripts dedicados para ler o histórico do Discord e popular o banco de dados.

### 🚨 Sistema de Reporte e Suporte
* **Link Quebrado (`/dtg linkquebrado`):** Usuários reportam links off através de um formulário. A Staff recebe um painel organizado para corrigir.
* **Feedback Automático:** Ao corrigir um link, o bot avisa o usuário no privado (DM) automaticamente em Português e Inglês.
* **Chat Manual (`/dtg chat`):** A Staff pode abrir um canal de texto privado temporário com qualquer membro para suporte direto.

### 🌐 Internacionalização
* **Tradução Automática (PT-BR 🇧🇷 ↔️ EN 🇺🇸):**
    * Anúncios e observações de jogos são traduzidos automaticamente.
    * Modais e respostas detectam o idioma do Discord do usuário.

### ⚙️ Automação e Moderação
* **Boas-vindas Dinâmicas:** Recebe novos membros mostrando os 5 últimos lançamentos do banco de dados.
* **Anti-Crash:** Sistema blindado contra quedas de conexão do banco de dados ou erros de rede.
* **Auto-Moderação:** Bloqueio básico de links não autorizados e convites.

---

## 🚀 Instalação e Configuração

### Pré-requisitos
* **Node.js** (v16 ou superior)
* **PostgreSQL** (Banco de dados local ou na nuvem, ex: Neon, Railway, AWS RDS)

### Passo a Passo

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/MrG3H/Bot-DTG-Discord.git
    cd Bot-DTG-Discord
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure as variáveis de ambiente:**
    Renomeie o arquivo `.env.example` para `.env` (ou crie um novo) e preencha:

    ```env
    # Token do Bot (Discord Developer Portal)
    DISCORD_TOKEN=SEU_TOKEN_AQUI

    # ID do Usuário Dono (Para comandos administrativos)
    OWNER_ID=SEU_ID_DE_USUARIO

    # ID da Aplicação (Client ID)
    DISCORD_CLIENT_ID=SEU_CLIENT_ID

    # ID do Servidor (Guild ID) - Opcional se for registrar globalmente
    GUILD_ID=ID_DO_SEU_SERVER

    # URL de Conexão do PostgreSQL
    DATABASE_URL=postgres://usuario:senha@host:porta/nome_banco
    ```

4.  **Registre os comandos (Slash Commands):**
    ```bash
    node deploy-commands.js
    ```

5.  **Inicie o bot:**
    ```bash
    node index.js
    ```

---

## 🎮 Lista de Comandos (/dtg)

### 🌍 Comandos Públicos (Para Membros)
| Comando | Descrição |
| :--- | :--- |
| `/dtg buscar [nome]` | 🔍 Pesquisa um jogo ou software na biblioteca do banco de dados. |
| `/dtg linkquebrado` | ⚠️ Abre um formulário para reportar links offline. |
| `/dtg pedido` | 🇧🇷 Abre formulário para pedir jogos (PT-BR). |
| `/dtg order` | 🇺🇸 Abre formulário para pedir jogos (EN). |
| `/dtg convite` | 📩 Gera o convite oficial da comunidade. |
| `/dtg ajuda` | ❓ Mostra informações de ajuda. |

### 🛡️ Comandos Administrativos (Apenas Owner)
| Comando | Descrição |
| :--- | :--- |
| `/dtg addjogo` | Adiciona um jogo ao banco de dados e publica no canal. |
| `/dtg addsoft` | Adiciona um software ao banco de dados e publica no canal. |
| `/dtg aviso` | Cria um anúncio com tradução automática e envia para um canal. |
| `/dtg chat [usuario]` | Cria um canal de texto privado com um usuário específico. |
| `/dtg configquebrado` | Define o canal onde os reports de links quebrados chegarão. |
| `/dtg config_boasvindas`| Define o canal de boas-vindas. |
| `/dtg addpedido` | Configura o painel fixo de pedidos. |
| `/dtg setup_faq` | Cria o menu fixo de Dúvidas Frequentes (FAQ). |
| `/dtg limpar [qtd]` | Limpa mensagens do chat. |

---

## 💻 Tecnologias Utilizadas

* **[Node.js](https://nodejs.org/)**: Ambiente de execução.
* **[Discord.js v14](https://discord.js.org/)**: Interação com a API do Discord.
* **[PostgreSQL (pg)](https://node-postgres.com/)**: Banco de dados relacional para armazenamento de jogos e logs.
* **[@vitalets/google-translate-api](https://github.com/vitalets/google-translate-api)**: Tradução automática de conteúdo.
* **[Dotenv](https://github.com/motdotla/dotenv)**: Gerenciamento de variáveis de ambiente.

---

<div align="center">
  <b>Bot Privado desenvolvido para a comunidade DownTorrentsGames</b><br>
  Feito com ❤️ e Código por <a href="https://github.com/MrGeeH">MrGeeH</a>
</div>