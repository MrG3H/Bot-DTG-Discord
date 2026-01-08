require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder, ChannelType } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // O ID da sua guilda de testes (opcional, mas recomendado)

if (!TOKEN || !CLIENT_ID) {
    console.error("Erro: As variáveis DISCORD_TOKEN e DISCORD_CLIENT_ID precisam ser definidas no arquivo .env");
    process.exit(1);
}

// Definição dos comandos de barra 
const commands = [
    new SlashCommandBuilder()
        .setName('dtg')
        .setDescription('Comandos DownTorrentsGames.')
        .addSubcommand(subcommand =>
            subcommand.setName('ajuda')
                .setDescription('Exibe a lista de comandos disponíveis.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('convite')
                .setDescription('Gera um convite para o servidor DownTorrentsGames.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('pedido')
                .setDescription('🇧🇷 Abre um formulário para solicitar um jogo ou software.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('order')
                .setDescription('🇺🇸 Opens a form to request a game or software.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('aviso')
                .setDescription('(Owner) Inicia o processo de criação de um novo aviso.')
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('O canal onde o aviso será publicado.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement) 
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('addsoft')
                .setDescription('(Owner) Adiciona um novo software e notifica os membros.')
                .addChannelOption(option =>
                    option.setName('canal_principal')
                        .setDescription('Canal onde o embed principal do software será enviado.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement) 
                )
                .addChannelOption(option =>
                    option.setName('canal_notificacao')
                        .setDescription('Canal onde a notificação @everyone do software será enviada.') 
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement) 
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('addjogo')
                .setDescription('(Owner) Adiciona um novo jogo e notifica os membros.')
                .addChannelOption(option =>
                    option.setName('canal_principal')
                        .setDescription('Canal onde o embed principal do jogo será enviado.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement) 
                )
                .addChannelOption(option =>
                    option.setName('canal_notificacao')
                        .setDescription('Canal onde a notificação @everyone do jogo será enviada.') 
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement) 
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('limpar')
                .setDescription('(Owner) Limpa mensagens no canal atual.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('addpedido')
                .setDescription('(Owner) Configura os canais para o sistema de pedidos.')
                .addChannelOption(option =>
                    option.setName('canal_apresentacao')
                        .setDescription('Canal onde a mensagem de apresentação do pedido será enviada.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
                .addChannelOption(option =>
                    option.setName('canal_logs')
                        .setDescription('Canal onde os logs de pedidos serão enviados para moderação.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        ),
].map(command => command.toJSON());


const rest = new REST({ version: '9' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Iniciando o processo de limpeza e registro de comandos...');

        // === ETAPA DE LIMPEZA ===
        // 1. Tentar limpar comandos globais (caso algum tenha sido registrado globalmente por engano)
        console.log('Tentando limpar comandos de barra globais existentes...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: [] },
        );
        console.log('Comandos de barra globais limpos (se houver).');

        // 2. Se GUILD_ID estiver definido, tentar limpar comandos da guilda
        if (GUILD_ID) {
            console.log(`Tentando limpar comandos de barra existentes na guilda ${GUILD_ID}...`);
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: [] },
            );
            console.log(`Comandos de barra limpos na guilda ${GUILD_ID} (se houver).`);
        }


        // === ETAPA DE REGISTRO ===
        if (GUILD_ID) {
            console.log(`Registrando novos comandos de barra na guilda ${GUILD_ID}...`);
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: commands },
            );
            console.log(`Comandos de barra registrados com sucesso na guilda ${GUILD_ID}.`);
            console.log('Verifique no Discord em alguns segundos.');
        } else {
            console.warn('AVISO: GUILD_ID NÃO está definido no .env. Comandos serão registrados GLOBALMENTE. Isso pode levar até 1 hora para propagar em todos os servidores.');
            console.log('Registrando novos comandos de barra globalmente...');
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands },
            );
            console.log('Comandos de barra registrados globalmente com sucesso.');
            console.log('Aguarde até 1 hora para que os comandos apareçam em todos os servidores.');
        }

    } catch (error) {
        console.error('Erro ao limpar ou registrar comandos de barra:', error);
    }
})();