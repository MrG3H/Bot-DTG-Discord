# Bot DTG Discord (Bot-DTG-Discord)

Este é um bot multifuncional para Discord, focado em gerenciamento de comunidade. Ele é projetado para automatizar a publicação de jogos e softwares, gerenciar um sistema de anúncios e processar pedidos de usuários de forma eficiente.

Um dos seus principais recursos é a capacidade de tradução automática, quebrando barreiras de idioma dentro da comunidade.

## ✨ Funcionalidades Principais

* **Publicação de Conteúdo:** Comandos fáceis para administradores publicarem novos jogos e softwares no servidor, mantendo tudo organizado.
* **Sistema de Anúncios:** Permite que a moderação crie e envie anúncios formatados para canais específicos.
* **Tradução Automática (PT-BR -> EN):** Ao criar um anúncio em Português (PT-BR), o bot automaticamente gera e anexa uma versão em Inglês (EN), garantindo que a mensagem alcance todos os membros da comunidade.
* **Sistema de Pedidos:** Um fluxo dedicado (provavelmente com modals/botões) para que os usuários possam fazer pedidos de jogos ou softwares de forma estruturada.

## 🚀 Instalação e Configuração

Para hospedar e rodar sua própria instância deste bot, siga os passos abaixo.

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/MrG3H/Bot-DTG-Discord.git](https://github.com/MrG3H/Bot-DTG-Discord.git)
    cd Bot-DTG-Discord
    ```

2.  **Instale as dependências:**
    * `[npm install]`

3.  **Configure as variáveis de ambiente:**
    Crie um arquivo `.env` na raiz do projeto e adicione suas chaves de API:
    ```env
    # Token do seu Bot no Portal de Desenvolvedores do Discord
    DISCORD_TOKEN=SEU_TOKEN_DO_BOT_AQUI

    # ID do canal para onde os pedidos serão enviados
    OWNER_ID=ID_DO_CANAL_AQUI
    
    # ID do canal de anúncios
    DISCORD_CLIENT_ID=ID_DO_CANAL_AQUI

    # NO GUILD ID VOCÊ DEVE ADICIONARO O ID DO SER SERVIDOR DISCORD
    GUILD_ID=ID_DO_SEU_SERVER_DISCORD
    ```

4.  **Inicie o bot:**
    * `[node . ou pode ser usado o node index.js]`

## 🎮 Comandos Principais

Aqui estão alguns dos comandos que os usuários e administradores podem usar:

* `/anuncio [mensagem]` - Cria um novo anúncio. O bot traduz e envia em PT-BR e EN.
* `/pedido` - Abre um formulário para o usuário fazer um novo pedido de jogo ou software.
* `/publicar [tipo] [nome] [link]` - Adiciona um novo jogo ou software ao catálogo do servidor.

*(**Nota:** Altere os comandos acima para refletir os comandos reais do seu bot.)*

## 💻 Tecnologias Utilizadas

Este projeto foi construído com **Node.js** e utiliza as seguintes bibliotecas principais:

* **[Discord.js v14](https://discord.js.org/)**: A principal biblioteca para interagir com a API do Discord.
* **[@vitalets/google-translate-api](https://github.com/vitalets/google-translate-api)**: A biblioteca responsável pela funcionalidade de tradução automática (PT-BR -> EN).
* **[Dotenv](https://github.com/motdotla/dotenv)**: Para carregar variáveis de ambiente (como tokens e IDs) de um arquivo `.env` de forma segura.
* **[Node-Fetch v2](https://github.com/node-fetch/node-fetch)**: Uma biblioteca para fazer requisições HTTP, necessária para a API de tradução funcionar corretamente no Node.js.
* **[@discordjs/builders](https://discord.js.org/#/docs/builders/main/general/welcome)**: Para construir facilmente os comandos (slash commands), embeds e outros componentes da API.
* **[@discordjs/rest](https://discord.js.org/#/docs/rest/main/general/welcome)**: Usado para registrar os comandos (slash commands) do bot na API do Discord.

---
<div align="center">
  Feito com ❤️ por <a href="https://github.com/MrG3H">MrG3H</a>
</div>