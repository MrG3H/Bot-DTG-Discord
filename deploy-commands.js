require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder, ChannelType } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
    console.error("Erro: As variáveis DISCORD_TOKEN e DISCORD_CLIENT_ID precisam ser definidas no arquivo .env");
    process.exit(1);
}

const commands = [
    new SlashCommandBuilder()
        .setName('dtg')
        .setDescription('Comandos DownTorrentsGames.')
        // --- COMANDOS PÚBLICOS ---
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
        // --- COMANDOS ADMINISTRATIVOS (OWNER) ---
        .addSubcommand(subcommand =>
            subcommand.setName('chat')
                .setDescription('(Owner) Abre um chat manual com um usuário específico.')
                .addUserOption(option => 
                    option.setName('usuario')
                        .setDescription('O usuário com quem você quer abrir o chat.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('config_boasvindas')
                .setDescription('(Owner) Define em qual canal as mensagens de boas-vindas aparecerão.')
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('Selecione o canal de entrada.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('aviso')
                .setDescription('(Owner) Inicia o processo de criação de um novo aviso.')
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('O canal onde o aviso será publicado (Opcional).')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement) 
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('setup_faq')
                .setDescription('(Owner) Cria o menu fixo de Dúvidas Frequentes (FAQ).')
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
                .addIntegerOption(option =>
                    option.setName('quantidade')
                        .setDescription('Número de mensagens para apagar (1 a 100).')
                        .setRequired(true)
                )
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
        // Limpa comandos globais e de guilda para evitar duplicatas
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        if (GUILD_ID) await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });

        if (GUILD_ID) {
            console.log(`Registrando na guilda ${GUILD_ID}...`);
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
            console.log('Sucesso (Guilda)!');
        } else {
            console.warn('Registrando GLOBALMENTE (pode demorar 1h).');
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
            console.log('Sucesso (Global)!');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
})();