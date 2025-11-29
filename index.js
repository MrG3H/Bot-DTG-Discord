// BY: MrGeH - Versão Final

require('dotenv').config();
const fs = require('fs');
const fetch = require('node-fetch');

const {
    Client, GatewayIntentBits, EmbedBuilder, ActivityType, ModalBuilder,
    TextInputBuilder, TextInputStyle, ActionRowBuilder, Collection,
    PermissionFlagsBits, MessageFlags, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ComponentType,
    ChannelType
} = require('discord.js');

const { translate } = require('@vitalets/google-translate-api');

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const PREFIX = '!dtg';

if (!TOKEN || !OWNER_ID || !process.env.DISCORD_CLIENT_ID) {
    console.error("Erro: As variáveis DISCORD_TOKEN, OWNER_ID e DISCORD_CLIENT_ID precisam ser definidas no arquivo .env");
    process.exit(1);
}

const configPath = './config.json';

function loadConfig() {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (error) {
            console.error("Erro ao ler config.json. Criando um novo arquivo.", error);
            const defaultConfig = { presentationChannelId: null, logChannelId: null };
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
    }
    const defaultConfig = { presentationChannelId: null, logChannelId: null };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
}

let config = loadConfig();

function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const embedColors = ['#5865F2', '#0099ff', '#41B454', '#E67E22', '#E91E63', '#9B59B6', '#F1C40F', '#1ABC9C', '#2ECC71', '#3498DB', '#E74C3C'];
function getRandomColor() { return embedColors[Math.floor(Math.random() * embedColors.length)]; }

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

const cooldowns = new Collection();
const prefixCooldowns = new Collection();
client.tempPedidoData = new Collection();
client.tempAvisoData = new Collection();
client.tempAddJogoData = new Collection(); // Coleção para dados de addjogo/addsoft aguardando imagem

client.on('clientReady', () => { // CORREÇÃO: Usando 'clientReady' em vez de 'ready'
    console.log(`Bot ${client.user.tag} está online!`);
    const activities = ['Melhor Discord de Jogos e Software', 'Criado por MrGeH!', 'Siga as Regras!', 'Ainda sendo desenvolvido!', 'Best Discord for Games and Software', 'Created by MrGeH!', 'Follow the Rules!', 'Still under development!'];
    let i = 0;
    setInterval(() => {
        client.user.setActivity(activities[i], { type: ActivityType.Playing });
        i = ++i % activities.length;
    }, 15000);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return; // Não processar mensagens de bots

    // LÓGICA PARA COLETAR IMAGEM APÓS MODAL DE ADDJOGO/ADDSOFT
    if (client.tempAddJogoData.has(message.author.id)) {
        const data = client.tempAddJogoData.get(message.author.id);
        if (data.status === 'awaiting_image') {
            const attachment = message.attachments.first();
            if (attachment && attachment.contentType.startsWith('image')) {
                // Imagem recebida! Processar o jogo/software.
                client.tempAddJogoData.delete(message.author.id); // Remover dados temporários

                // Envia a mensagem com a imagem e os dados do jogo
                await sendGameOrSoftwareEmbed(
                    data.interaction, // A interação original deferida que vamos editar
                    data.primaryChannelId,
                    data.notificationChannelId,
                    data.title,
                    data.obs, // obs pode ser null para software
                    data.link,
                    attachment.url, // URL da imagem
                    data.type // 'jogo' ou 'software'
                );

                // Apagar a mensagem temporária de "aguardando imagem"
                if (data.waitingMessageId) {
                    try {
                        const originalInteractionMessage = await message.channel.messages.fetch(data.waitingMessageId);
                        await originalInteractionMessage.delete().catch(console.error);
                    } catch (error) {
                        console.error('Erro ao deletar mensagem de espera da imagem:', error);
                    }
                }

                // Reage com um checkmark na mensagem do usuário que enviou a imagem
                await message.react('✅').catch(console.error);
                return; // Importante para não continuar processando como comando de prefixo
            } else {
                // Não é uma imagem, mas o bot está esperando uma.
                // Pode optar por notificar o usuário ou ignorar.
                await message.reply({ content: '❌ Por favor, envie apenas a imagem do jogo/software.', flags: [MessageFlags.Ephemeral] }).catch(console.error); // CORREÇÃO: ephemeral
                // Não retorna aqui para que o usuário possa tentar enviar a imagem novamente sem repetir o comando
            }
        }
    }

    // LÓGICA PARA COMANDOS DE PREFIXO (SE A MENSAGEM NÃO FOI UMA IMAGEM PARA ADDJOGO)
    if (!message.content.startsWith(PREFIX)) return;
    if (!message.guild) return message.reply('Este comando só pode ser usado em um servidor.').catch(console.error);

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const ownerOnlyPrefixCommands = ['ajogo'];
    if (ownerOnlyPrefixCommands.includes(command)) {
        if (message.author.id !== OWNER_ID) {
            return message.reply({ content: '❌ Apenas o dono do servidor pode usar este comando.' });
        }
    }

    const cooldownAmount = 15 * 1000;
    const now = Date.now();
    const userId = message.author.id;

    if (prefixCooldowns.has(userId)) {
        const expirationTime = prefixCooldowns.get(userId);
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`Calma aí! Por favor, aguarde **${timeLeft.toFixed(1)} segundos** antes de usar este comando novamente.`).then(msg => {
                setTimeout(() => msg.delete().catch(console.error), 5000);
            }).catch(console.error);
        }
    }
    prefixCooldowns.set(userId, now + cooldownAmount);
    setTimeout(() => prefixCooldowns.delete(userId), cooldownAmount);

    if (command === 'ajuda') {
        await handleAjudaPrefix(message);
    } else if (command === 'ajogo') {
        // Para comandos de prefixo que deveriam usar modais, redirecionamos para slash command
        await message.reply({ content: 'Este comando (`!dtg ajogo`) foi movido para os comandos de barra para melhor experiência. Por favor, use `/dtg addjogo`.', flags: [MessageFlags.Ephemeral] }).catch(console.error); // CORREÇÃO: ephemeral
    } else {
        message.reply(`O comando \`!dtg ${command}\` foi movido para os comandos de barra. Por favor, use \`/dtg ${command}\` para uma melhor experiência.`).catch(console.error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.guild) {
        if (interaction.isRepliable()) {
            return interaction.reply({ content: 'Este comando só pode ser usado em um servidor.', flags: [MessageFlags.Ephemeral] });
        }
        return;
    }

    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;

        if (commandName === 'dtg') {
            const subcommand = options.getSubcommand();

            const ownerOnlySubcommands = ['aviso', 'addsoft', 'addjogo', 'limpar', 'addpedido'];
            if (ownerOnlySubcommands.includes(subcommand) && interaction.user.id !== OWNER_ID) {
                return interaction.reply({ content: '❌ Apenas o dono do servidor pode usar este comando.', flags: [MessageFlags.Ephemeral] });
            }

            if (subcommand === 'ajuda') {
                await handleAjudaSlash(interaction);
            }
            else if (subcommand === 'convite') {
                const cooldownAmount = 30 * 1000;
                const now = Date.now();
                const userId = interaction.user.id;

                if (cooldowns.has(userId)) {
                    const expirationTime = cooldowns.get(userId);
                    if (now < expirationTime) {
                        const timeLeft = (expirationTime - now) / 1000;
                        return interaction.reply({ content: `Calma aí! Por favor, aguarde **${timeLeft.toFixed(1)} segundos** antes de usar este comando novamente.`, flags: [MessageFlags.Ephemeral] });
                    }
                }
                cooldowns.set(userId, now + cooldownAmount);
                setTimeout(() => cooldowns.delete(userId), cooldownAmount);

                const gifUrl = 'https://media.discordapp.net/attachments/1132735302163779725/1425212324100309084/DTG.gif';

                const inviteMessage = `**🇧🇷 Quer convidar um amigo?** ❤️\nEntre na nossa comunidade! Vários jogos e softwares para baixar e você também pode fazer o seu pedido!\n**Entre na DownTorrentsGames!!!**\n\n**🇺🇸 Want to invite a friend?** ❤️\nJoin our community! Several games e software to download and you can also place your order!\n**Join DownTorrentsGames!!!**\n\nhttps://discord.gg/uKCrBCNqCT`;

                await interaction.reply({ content: `${gifUrl}\n\n${inviteMessage}`, ephemeral: false });
            }
            else if (subcommand === 'aviso') {
                await handleAvisoChat(interaction);
            }
            else if (subcommand === 'addsoft') {
                const primaryChannel = options.getChannel('canal_principal');
                const notificationChannel = options.getChannel('canal_notificacao');

                const modal = new ModalBuilder().setCustomId(`addsoft_modal_${primaryChannel.id}_${notificationChannel.id}`).setTitle('Adicionar Novo Software');
                const titleInput = new TextInputBuilder().setCustomId('addsoft_titulo').setLabel("Título do Software").setStyle(TextInputStyle.Short).setRequired(true);
                const linkInput = new TextInputBuilder().setCustomId('addsoft_link').setLabel("Link para o 'Clique Aqui!'").setStyle(TextInputStyle.Short).setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(linkInput));
                await interaction.showModal(modal);
            }
            else if (subcommand === 'addjogo') {
                const primaryChannel = options.getChannel('canal_principal');
                const notificationChannel = options.getChannel('canal_notificacao');

                const modal = new ModalBuilder().setCustomId(`addjogo_modal_${primaryChannel.id}_${notificationChannel.id}`).setTitle('Adicionar Novo Jogo');
                const titleInput = new TextInputBuilder().setCustomId('addjogo_titulo').setLabel("Título do Jogo").setStyle(TextInputStyle.Short).setRequired(true);
                const obsInput = new TextInputBuilder().setCustomId('addjogo_obs').setLabel("Observação (Opcional)").setStyle(TextInputStyle.Paragraph).setRequired(false);
                const linkInput = new TextInputBuilder().setCustomId('addjogo_link').setLabel("Link para o 'Clique Aqui!'").setStyle(TextInputStyle.Short).setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(obsInput),
                    new ActionRowBuilder().addComponents(linkInput)
                );
                await interaction.showModal(modal);
            }
            else if (subcommand === 'limpar') {
                await handleLimparSlash(interaction);
            }
            else if (subcommand === 'addpedido') {
                // Defer a resposta imediatamente para estender o tempo limite da interação
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral

                const presentationChannel = options.getChannel('canal_apresentacao');
                const logChannel = options.getChannel('canal_logs');

                // Valida os canais
                if (!presentationChannel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(presentationChannel.type)) {
                    return interaction.editReply({ content: '❌ O canal de apresentação não é um canal de texto ou anúncio válido.' });
                }
                if (!logChannel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(logChannel.type)) {
                    return interaction.editReply({ content: '❌ O canal de logs não é um canal de texto ou anúncio válido.' });
                }

                config.presentationChannelId = presentationChannel.id;
                config.logChannelId = logChannel.id;
                saveConfig();

                const presentationMessagePT = `**🇧🇷 Faça o Pedido do seu JOGO ou SOFTWARE clicando no botão abaixo:**`;
                const presentationMessageEN = `**🇺🇸 Make your GAME or SOFTWARE request by clicking the button below:**`;
                const gifUrl = 'https://media.discordapp.net/attachments/1132735302163779725/1425212324100309084/DTG.gif';

                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('iniciar_pedido_pt')
                            .setLabel('Fazer Pedido!')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('🇧🇷'),
                        new ButtonBuilder()
                            .setCustomId('iniciar_pedido_en')
                            .setLabel('Make Request!')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🇺🇸')
                    );

                // Envia a mensagem no canal de apresentação
                await presentationChannel.send({ content: `${presentationMessagePT}\n\n${presentationMessageEN}\n\n${gifUrl}`, components: [buttons] });

                // Edita a resposta deferida para a mensagem final de sucesso
                await interaction.editReply({ content: `✅ Sistema de pedidos configurado! A mensagem de apresentação com botões foi enviada em ${presentationChannel}.` });
            }
            else if (subcommand === 'pedido' || subcommand === 'order') {
                // Comando de barra deve iniciar um novo pedido efêmero
                await sendPedidoInitialEphemeralMessage(interaction, subcommand === 'order');
            }
        }
    }
    else if (interaction.isButton()) {
        if (interaction.customId === 'iniciar_pedido_pt' || interaction.customId === 'iniciar_pedido_en') {
            const isEnglish = interaction.customId === 'iniciar_pedido_en';
            // Quando o botão inicial é clicado, cria uma *nova* mensagem efêmera com os selects
            await sendPedidoInitialEphemeralMessage(interaction, isEnglish);
            return;
        }

        if (interaction.customId.startsWith('pedido_continue_button_')) {
            const parts = interaction.customId.split('_');
            const userId = parts[3]; // O ID do usuário que iniciou o pedido
            const lang = parts[4];
            const isEnglish = lang === 'en';

            // Verifica se o usuário que clicou é o mesmo que iniciou o pedido
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: isEnglish ? '❌ You cannot continue another user\'s request form.' : '❌ Você não pode continuar o formulário de pedido de outro usuário.', flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
            }

            const userData = client.tempPedidoData.get(userId);
            if (!userData || !userData.platform || !userData.online) {
                return interaction.reply({ content: isEnglish ? '❌ Please select both platform and online options first.' : '❌ Por favor, selecione a plataforma e a opção online primeiro.', flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
            }
            
            await handlePedidoModalFinal(interaction, userData.platform, userData.online, isEnglish);

            // A deleção da mensagem efêmera é feita *depois* do modal ser submetido com sucesso.
            // A função handlePedidoModalFinal (agora alterada) será responsável por isso.
            // Não precisamos deletar aqui, pois a submissão do modal terá a responsabilidade.
        }
        else if (interaction.customId.startsWith('pedido_added_') || interaction.customId.startsWith('pedido_rejected_')) { // Tratamento dos botões de aprovação/rejeição
            if (interaction.user.id !== OWNER_ID) {
                return interaction.reply({ content: '❌ Apenas o dono do servidor pode interagir com estes botões.', flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
            }

            const parts = interaction.customId.split('_');
            // Os parts[0] e parts[1] já foram usados para 'pedido' e 'added'/'rejected'
            const userId = parts[2]; // Ajustado para pegar o userId na posição correta
            const gameSoftwareName = parts[3].replace(/_/g, ' '); // Ajustado o índice
            const platform = parts[4].replace(/_/g, ' '); // Ajustado o índice
            const onlineStatus = parts[5].replace(/_/g, ' '); // Ajustado o índice
            const lang = parts[6]; // Ajustado o índice

            const isEnglish = lang === 'en'; // CORREÇÃO: Definindo isEnglish com base no customId

            await interaction.deferUpdate(); // Deferimos a atualização para desabilitar os botões

            let dmTitle, dmBodyFn, responseStatus;

            if (parts[1] === 'added') { // Usamos parts[1] para verificar 'added' ou 'rejected'
                dmTitle = isEnglish ? `CONGRATULATIONS - YOUR GAME HAS BEEN ADDED!` : `PARABÉNS - SEU JOGO FOI ADICIONADO!`;
                dmBodyFn = (gameName, platform, onlineStatus, isEnglish) => {
                    let body = isEnglish ? `Your request for **${gameName} / ${platform}** has been fulfilled!\n\n` : `Seu pedido para **${gameName} / ${platform}** foi atendido!\n\n`;

                    if (platform.toLowerCase().includes('pc') || platform.toLowerCase().includes('outros (software)')) { // Verificação também para Software
                        body += isEnglish
                            ? `If the platform you chose was "PC" or "Others (Software)", the item will be in the text channel with the first letter of its name. Example: you requested "Minecraft", it will be under the letter "M".\n\n`
                            : `Caso a Plataforma que escolheu foi "PC" ou "Outros (Software)" o item vai estar no chat de texto com a letra do primeiro nome do item. Exemplo: você pediu "Minecraft" o item estara adicionado a Letra "M".\n\n`;
                        if (onlineStatus === 'Sim' || onlineStatus.toLowerCase() === 'yes') {
                            body += isEnglish
                                ? `If you requested "Online Playability", it will be in the CO-OP / ONLINE category. If you don't find it there, it means the item does not have online play available for this version, so follow the example above!\n\n`
                                : `Caso você tenha pedido para verificar a possibilidade de Jogado ONLINE ele estará na categoria CO-OP / ONLINE - OBSERVAÇÃO: CASO PROCUROU NO COOP E NÃO ACHOU O JOGO, ENTÃO SIGNIFICA QUE O JOGO NÃO TEM PARA ONLINE ENTÃO SENDO ASSIM SIGA O EXEMPLO DE CIMA!\n\n`;
                        }
                    } else {
                        body += isEnglish
                            ? `If the chosen platform is an emulator/console, go to the game list for the console you chose. Example: if it's PS1, go to the PS1 games.\n\n`
                            : `Caso a Plataforma escolhida for de emulador/Vídeo game, vá na lista de jogos referente o vídeo game que escolheu. Exemplo: se for PS1, vá nos jogos de PS1.\n\n`;
                    }
                    body += isEnglish ? `**THANK YOU - MrGeH.**` : `**MUITO OBRIGADO - MrGeH.**`;
                    return body;
                };
                responseStatus = isEnglish ? 'Added' : 'Adicionado';

            } else if (parts[1] === 'rejected') { // Usamos parts[1] para verificar 'added' ou 'rejected'
                dmTitle = isEnglish ? `NOTICE ABOUT YOUR REQUEST` : `AVISO SOBRE SEU PEDIDO`;
                dmBodyFn = (gameName, platform, onlineStatus, isEnglish) => isEnglish
                    ? `Unfortunately, your request for **${gameName} / ${platform}** could not be fulfilled at this time (Reason: No Crack/Unavailable).\n\n**THANK YOU - MrGeH.**`
                    : `Infelizmente, seu pedido para **${gameName} / ${platform}** não pôde ser atendido no momento (Motivo: Sem Crack/Indisponível).\n\n**MUITO OBRIGADO - MrGeH.**`;
                responseStatus = isEnglish ? 'No Crack' : 'Sem Crack';
            }

            try {
                const user = await client.users.fetch(userId);
                await user.send(`**${dmTitle}**\n\n${dmBodyFn(gameSoftwareName, platform, onlineStatus, isEnglish)}`);

                const disabledButtons = new ActionRowBuilder()
                    .addComponents(
                        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
                    );
                await interaction.message.edit({ components: [disabledButtons] });

                // CORREÇÃO: Tradução da mensagem no canal de logs
                await interaction.channel.send(`*${isEnglish ? 'Response sent to user' : 'Resposta enviada ao usuário'} (${user.tag}) ${isEnglish ? 'for request of' : 'para o pedido de'} "${gameSoftwareName}": **${responseStatus}**`);

            } catch (dmError) {
                console.error('Falha ao enviar DM:', dmError);
                // CORREÇÃO: Tradução da mensagem de erro de DM
                await interaction.followUp({ content: `❌ ${isEnglish ? 'Failed to send DM to user (they might have DMs disabled?). Action logged.' : 'Falha ao enviar DM para o usuário (talvez ele tenha DMs desabilitadas?). Ação registrada.'}`, flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
            }
        }
    }
    else if (interaction.isModalSubmit()) {
        const { customId, fields } = interaction;

        if (customId.startsWith('pedido_modal_final_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); // Deferir para pedido_modal_final // CORREÇÃO: ephemeral

            // CORREÇÃO: Ajuste na desestruturação para pegar o userId no índice correto (3)
            const [, , , userId, platform, onlineStatus, lang] = customId.split('_');
            const isEnglish = lang === 'en';

            const requestInfo = fields.getTextInputValue('pedido_info_msg');
            const gameSoftwareName = fields.getTextInputValue('pedido_game_software_name');
            const originalLink = fields.getTextInputValue('pedido_original_link');

            const logChannel = await client.channels.fetch(config.logChannelId);
            if (!logChannel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(logChannel.type)) {
                console.error(`Canal de logs inválido ou não é canal de texto/anúncio: ${config.logChannelId}`);
                return interaction.editReply({ content: isEnglish ? '❌ Log channel is not configured correctly.' : '❌ O canal de logs não está configurado corretamente.', flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
            }

            const embedPedido = new EmbedBuilder()
                .setTitle(`Pedido de Jogo/Software`)
                .setColor(getRandomColor())
                .setDescription(
                    `**Usuário:** ${interaction.user.tag} / ID: ${interaction.user.id}\n` +
                    `**Nome do Jogo/Software:** ${gameSoftwareName}\n` +
                    `**Plataforma:** ${platform.replace(/_/g, ' ')}\n` +
                    `**Possibilidade de ser Jogável ONLINE:** ${onlineStatus.replace(/_/g, ' ')}\n` +
                    `**Link do Jogo Original:** [Link](${originalLink})\n` +
                    (requestInfo ? `**Informações Adicionais:**\n\`\`\`${requestInfo}\`\`\`` : '')
                );

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`pedido_added_${userId}_${gameSoftwareName.replace(/ /g, '_')}_${platform.replace(/ /g, '_')}_${onlineStatus.replace(/ /g, '_')}_${lang}`)
                        .setLabel(isEnglish ? 'Mark as Added' : 'Marcar como Adicionado')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`pedido_rejected_${userId}_${gameSoftwareName.replace(/ /g, '_')}_${platform.replace(/ /g, '_')}_${onlineStatus.replace(/ /g, '_')}_${lang}`)
                        .setLabel(isEnglish ? 'Mark as No Crack' : 'Marcar como Sem Crack')
                        .setStyle(ButtonStyle.Danger),
                );
            await logChannel.send({ embeds: [embedPedido], components: [buttons] });
            await interaction.editReply({ content: isEnglish ? '✅ Your request has been successfully submitted!' : '✅ Seu pedido foi enviado com sucesso!', flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral

            const userData = client.tempPedidoData.get(userId);
            if (userData && userData.ephemeralMessageId) {
                try {
                    const channel = await client.channels.fetch(interaction.channelId);
                    const messageToDelete = await channel.messages.fetch(userData.ephemeralMessageId);
                    await messageToDelete.delete().catch(console.error);
                    console.log(`[DEBUG] Ephemeral message ${userData.ephemeralMessageId} deleted after modal submission.`);
                } catch (error) {
                    console.log(`[DEBUG] Could not delete ephemeral message ${userData.ephemeralMessageId} after modal submission.`, error.message);
                }
            }
            client.tempPedidoData.delete(userId);
        }
        else if (customId.startsWith('addsoft_modal_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); // Deferir aqui para addsoft // CORREÇÃO: ephemeral
            const [, , primaryChannelId, notificationChannelId] = customId.split('_');
            const title = fields.getTextInputValue('addsoft_titulo');
            const link = fields.getTextInputValue('addsoft_link');

            // Armazena os dados do software temporariamente e aguarda a imagem
            client.tempAddJogoData.set(interaction.user.id, {
                status: 'awaiting_image',
                interaction: interaction, // Passa a interação para poder editar a resposta depois
                primaryChannelId,
                notificationChannelId,
                title,
                obs: null, // Software não tem observação por padrão
                link,
                type: 'software' // Indica que é um software
            });

            // Avisa o usuário para enviar a imagem
            const waitingMessage = await interaction.editReply({
                content: '✅ Informações do software recebidas. **Por favor, envie a imagem/capa do software para este chat AGORA.**',
                flags: [MessageFlags.Ephemeral] // CORREÇÃO: ephemeral
            });
            const data = client.tempAddJogoData.get(interaction.user.id);
            data.waitingMessageId = waitingMessage.id;
            client.tempAddJogoData.set(interaction.user.id, data);
            
            return; // Não faz mais nada aqui, o resto será tratado no messageCreate
        }
        else if (customId.startsWith('addjogo_modal_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); // Deferir aqui para addjogo // CORREÇÃO: ephemeral
            const [, , primaryChannelId, notificationChannelId] = customId.split('_');
            const title = fields.getTextInputValue('addjogo_titulo');
            const obs = fields.getTextInputValue('addjogo_obs');
            const link = fields.getTextInputValue('addjogo_link');

            // Armazena os dados do jogo temporariamente e aguarda a imagem
            client.tempAddJogoData.set(interaction.user.id, {
                status: 'awaiting_image',
                interaction: interaction, // Passa a interação para poder editar a resposta depois
                primaryChannelId,
                notificationChannelId,
                title,
                obs,
                link,
                type: 'jogo' // Indica que é um jogo
            });

            // Avisa o usuário para enviar a imagem
            const waitingMessage = await interaction.editReply({
                content: '✅ Informações do jogo recebidas. **Por favor, envie a imagem do jogo/capa para este chat AGORA.**',
                flags: [MessageFlags.Ephemeral] // CORREÇÃO: ephemeral
            });
            // Salva o ID da mensagem de espera para poder deletá-la depois
            const data = client.tempAddJogoData.get(interaction.user.id);
            data.waitingMessageId = waitingMessage.id;
            client.tempAddJogoData.set(interaction.user.id, data);
            
            return; // Não faz mais nada aqui, o resto será tratado no messageCreate
        }
        else if (customId.startsWith('aviso_modal_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); // Deferir aqui para aviso // CORREÇÃO: ephemeral
            const [, , userId, lang] = customId.split('_');
            const isEnglish = lang === 'en';

            const avisoTitulo = fields.getTextInputValue('aviso_titulo');
            const avisoCorpo = fields.getTextInputValue('aviso_corpo');

            const avisoData = client.tempAvisoData.get(userId);
            if (!avisoData || !avisoData.channels || avisoData.channels.length === 0) {
                return interaction.editReply({ content: isEnglish ? '❌ No channels selected for the announcement.' : '❌ Nenhum canal selecionado para o aviso.', flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
            }

            const embedAviso = new EmbedBuilder()
                .setTitle(avisoTitulo)
                .setDescription(avisoCorpo)
                .setColor(getRandomColor())
                .setTimestamp()
                .setFooter({ text: isEnglish ? `Announcement by ${interaction.user.tag}` : `Aviso por ${interaction.user.tag}` });

            for (const channelId of avisoData.channels) {
                try {
                    const channel = await client.channels.fetch(channelId);
                    if (channel && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
                        await channel.send({ content: '@here', embeds: [embedAviso] });
                    }
                } catch (error) {
                    console.error(`Erro ao enviar aviso para o canal ${channelId}:`, error);
                }
            }

            await interaction.editReply({ content: isEnglish ? '✅ Announcement sent to selected channels!' : '✅ Aviso enviado para os canais selecionados!', flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
            client.tempAvisoData.delete(userId); // Limpa os dados temporários do aviso
        }
    }
    else if (interaction.isStringSelectMenu()) {
        const { customId } = interaction;

        if (customId.startsWith('pedido_platform_select_') || customId.startsWith('pedido_online_select_')) {
            const parts = customId.split('_');
            const expectedUserId = parts[3];
            const lang = parts[4];
            const isEnglish = lang === 'en';

            if (interaction.user.id !== expectedUserId) {
                // Se não for o usuário esperado, deferir e depois responder, para evitar "Interaction Failed"
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
                return interaction.editReply({ content: isEnglish ? '❌ You cannot interact with another user\'s request.' : '❌ Você não pode interagir com o pedido de outro usuário.' });
            }

            let userData = client.tempPedidoData.get(expectedUserId) || { platform: null, online: null, ephemeralMessageId: null };
            console.log(`[DEBUG] Initial userData for ${expectedUserId}: `, userData);

            if (customId.startsWith('pedido_platform_select_')) {
                userData.platform = interaction.values[0];
                console.log(`[DEBUG] Platform selected: ${userData.platform}`);
            } else { // pedido_online_select_
                userData.online = interaction.values[0];
                console.log(`[DEBUG] Online selected: ${userData.online}`);
            }
            client.tempPedidoData.set(expectedUserId, userData);
            console.log(`[DEBUG] Updated userData for ${expectedUserId}: `, client.tempPedidoData.get(expectedUserId));


            const selectedPlatform = userData.platform || (isEnglish ? 'Not selected' : 'Não selecionado');
            const selectedOnline = userData.online || (isEnglish ? 'Not selected' : 'Não selecionado');

            const canContinue = !!userData.platform && !!userData.online;
            console.log(`[DEBUG] userData.platform: "${userData.platform}" (is truthy: ${!!userData.platform})`);
            console.log(`[DEBUG] userData.online: "${userData.online}" (is truthy: ${!!userData.online})`);
            console.log(`[DEBUG] Condition canContinue (platform && online): ${canContinue}`);


            const continueButton = new ButtonBuilder()
                .setCustomId(`pedido_continue_button_${expectedUserId}_${lang}`)
                .setLabel(isEnglish ? 'Continue Request' : 'Continuar Pedido')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!canContinue);

            const actionRowButton = new ActionRowBuilder().addComponents(continueButton);

            try {
                await interaction.update({
                    content: `**${isEnglish ? 'Selected Platform' : 'Plataforma Selecionada'}:** \`${selectedPlatform}\`\n` +
                                 `**${isEnglish ? 'Online Playability' : 'Jogável Online'}:** \`${selectedOnline}\`\n\n` +
                                 (isEnglish ? 'Please select both options to continue your request.' : 'Por favor, selecione ambas as opções para continuar seu pedido.'),
                    components: [
                        getPedidoPlatformSelectMenu(expectedUserId, lang, userData.platform),
                        getPedidoOnlineSelectMenu(expectedUserId, lang, userData.online),
                        actionRowButton
                    ]
                });
            } catch (error) {
                console.error(`[ERROR] Failed to update ephemeral message ${interaction.message?.id}:`, error);
                await interaction.followUp({ content: '❌ Ocorreu um erro ao atualizar o formulário. Por favor, tente o comando novamente.', flags: [MessageFlags.Ephemeral] }).catch(console.error); // CORREÇÃO: ephemeral
            }
        }
    }
});

// --- FUNÇÕES DE HANDLER ---
async function handleAjudaPrefix(message) {
    const embed = new EmbedBuilder()
        .setTitle('Comandos de Ajuda')
        .setDescription(`**Prefix:** \`${PREFIX}\`\n\n` +
                        `**\`${PREFIX} ajuda\`**: Mostra esta mensagem de ajuda.\n` +
                        `**\`${PREFIX} ajogo\`**: Comando para anunciar jogo no servidor (Dono do bot).`)
        .setColor(getRandomColor());
    await message.reply({ embeds: [embed] }).catch(console.error);
}

async function handleAjudaSlash(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('Comandos de Ajuda')
        .setDescription('**Comandos de Barra (/)**\n\n' +
                        '**/dtg ajuda**: Mostra esta mensagem de ajuda.\n' +
                        '**/dtg convite**: Envia um convite para o servidor.\n' +
                        '**/dtg pedido / /dtg order**: Inicia o formulário de pedido de jogo/software.\n' +
                        '**/dtg addsoft [canal_principal] [canal_notificacao]**: Adiciona um novo software (Dono do bot).\n' +
                        '**/dtg addjogo [canal_principal] [canal_notificacao]**: Adiciona um novo jogo (Dono do bot).\n' +
                        '**/dtg aviso**: Envia um aviso para os canais selecionados (Dono do bot).\n' +
                        '**/dtg limpar [quantidade]**: Limpa mensagens do chat (Dono do bot).\n' +
                        '**/dtg addpedido [canal_apresentacao] [canal_logs]**: Configura o sistema de pedidos (Dono do bot).')
        .setColor(getRandomColor());
    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] }).catch(console.error); // CORREÇÃO: ephemeral
}

async function handleAvisoChat(interaction) {
    const isEnglish = interaction.options.getSubcommand() === 'order'; // Pode ser usado se 'aviso' tiver uma opção de idioma ou basear no comando pai

    // Defer a resposta efêmera inicial
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    // Crie o seletor de canais
    const channelSelect = new StringSelectMenuBuilder()
        .setCustomId(`aviso_channel_select_${interaction.user.id}`)
        .setPlaceholder(isEnglish ? 'Select channels for the announcement' : 'Selecione os canais para o aviso')
        .setMinValues(1)
        .setMaxValues(10) // Permite selecionar até 10 canais
        .addOptions(
            interaction.guild.channels.cache
                .filter(channel => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type) && channel.permissionsFor(client.user).has(PermissionFlagsBits.SendMessages))
                .map(channel =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(channel.name)
                        .setValue(channel.id)
                )
        );

    const actionRow = new ActionRowBuilder().addComponents(channelSelect);

    await interaction.editReply({
        content: isEnglish ? 'Please select the channels where the announcement will be sent:' : 'Por favor, selecione os canais onde o aviso será enviado:',
        components: [actionRow],
        flags: [MessageFlags.Ephemeral]
    });

    // Aguarda a seleção do canal pelo usuário
    const filter = i => i.customId === `aviso_channel_select_${interaction.user.id}` && i.user.id === interaction.user.id;
    try {
        const response = await interaction.channel.awaitMessageComponent({ filter, componentType: ComponentType.StringSelect, time: 60000 });

        const selectedChannels = response.values;
        client.tempAvisoData.set(interaction.user.id, { channels: selectedChannels });

        // Agora, mostre o modal para o título e corpo do aviso
        const modal = new ModalBuilder()
            .setCustomId(`aviso_modal_${interaction.user.id}_${isEnglish ? 'en' : 'pt'}`)
            .setTitle(isEnglish ? 'Create New Announcement' : 'Criar Novo Aviso');

        const tituloInput = new TextInputBuilder()
            .setCustomId('aviso_titulo')
            .setLabel(isEnglish ? 'Announcement Title' : 'Título do Aviso')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const corpoInput = new TextInputBuilder()
            .setCustomId('aviso_corpo')
            .setLabel(isEnglish ? 'Announcement Body' : 'Corpo do Aviso')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(tituloInput), new ActionRowBuilder().addComponents(corpoInput));

        await response.showModal(modal); // Mostra o modal na interação de seleção
        // A resposta final para o usuário será tratada no modalSubmit
    } catch (error) {
        console.error('Erro ou tempo limite na seleção de canais para aviso:', error);
        await interaction.editReply({ content: isEnglish ? '❌ Channel selection timed out or an error occurred.' : '❌ Seleção de canais expirou ou ocorreu um erro.', components: [], flags: [MessageFlags.Ephemeral] });
        client.tempAvisoData.delete(interaction.user.id); // Limpa os dados temporários
    }
}


async function handleLimparSlash(interaction) {
    const amount = interaction.options.getInteger('quantidade');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
    }

    if (amount <= 0 || amount > 100) {
        return interaction.reply({ content: '❌ A quantidade deve ser entre 1 e 100.', flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
    }

    try {
        await interaction.channel.bulkDelete(amount, true);
        await interaction.reply({ content: `✅ ${amount} mensagens foram limpas.`, flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
    } catch (error) {
        console.error('Erro ao limpar mensagens:', error);
        await interaction.reply({ content: '❌ Ocorreu um erro ao tentar limpar as mensagens.', flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
    }
}

// --- FUNÇÕES AUXILIARES PARA PEDIDO (AGORA INCLUÍDAS) ---

async function sendPedidoInitialEphemeralMessage(interaction, isEnglish) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const userId = interaction.user.id;
    const currentLang = isEnglish ? 'en' : 'pt';

    const platformSelectMenu = getPedidoPlatformSelectMenu(userId, currentLang);
    const onlineSelectMenu = getPedidoOnlineSelectMenu(userId, currentLang);

    const initialReply = await interaction.editReply({
        content: isEnglish ?
            'Please select the game/software platform and online playability:' :
            'Por favor, selecione a plataforma do jogo/software e a possibilidade de ser jogável online:',
        components: [platformSelectMenu, onlineSelectMenu],
        flags: [MessageFlags.Ephemeral]
    });

    // Armazena o ID da mensagem efêmera para poder deletá-la depois
    client.tempPedidoData.set(userId, { platform: null, online: null, ephemeralMessageId: initialReply.id });
}

function getPedidoPlatformSelectMenu(userId, lang, selectedValue = null) {
    const isEnglish = lang === 'en';
    const options = [
        new StringSelectMenuOptionBuilder().setLabel(isEnglish ? 'Others (Software)' : 'Outros (Software)').setValue('Outros_Software'),
        new StringSelectMenuOptionBuilder().setLabel('PC').setValue('PC'),
        new StringSelectMenuOptionBuilder().setLabel('PS1').setValue('PS1'),
        new StringSelectMenuOptionBuilder().setLabel('PS2').setValue('PS2'),
        new StringSelectMenuOptionBuilder().setLabel('PS3').setValue('PS3'),
        new StringSelectMenuOptionBuilder().setLabel('PS4').setValue('PS4'),
        new StringSelectMenuOptionBuilder().setLabel('PS5').setValue('PS5'),
        new StringSelectMenuOptionBuilder().setLabel('XBOX 360').setValue('XBOX_360'),
        new StringSelectMenuOptionBuilder().setLabel('XBOX ONE').setValue('XBOX_ONE'),
        new StringSelectMenuOptionBuilder().setLabel('XBOX Series X/S').setValue('XBOX_Series_X_S'),
        new StringSelectMenuOptionBuilder().setLabel('Wii').setValue('Wii'),
        new StringSelectMenuOptionBuilder().setLabel('Wii U').setValue('Wii_U'),
        new StringSelectMenuOptionBuilder().setLabel('Nintendo Switch').setValue('Nintendo_Switch'),
        new StringSelectMenuOptionBuilder().setLabel('Nintendo 3DS').setValue('Nintendo_3DS'),
        new StringSelectMenuOptionBuilder().setLabel('Outros (Emulador)').setValue('Outros_Emulador'),
    ];

    if (selectedValue) {
        options.forEach(option => {
            if (option.data.value === selectedValue) {
                option.setDefault(true);
            }
        });
    }

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pedido_platform_select_${userId}_${lang}`)
            .setPlaceholder(isEnglish ? 'Select Platform' : 'Selecione a Plataforma')
            .addOptions(options)
    );
}

function getPedidoOnlineSelectMenu(userId, lang, selectedValue = null) {
    const isEnglish = lang === 'en';
    const options = [
        new StringSelectMenuOptionBuilder().setLabel(isEnglish ? 'Yes' : 'Sim').setValue('Sim'),
        new StringSelectMenuOptionBuilder().setLabel(isEnglish ? 'No' : 'Não').setValue('Não'),
        new StringSelectMenuOptionBuilder().setLabel(isEnglish ? 'Irrelevant (Software)' : 'Irrelevante (Software)').setValue('Irrelevante_Software'),
    ];

    if (selectedValue) {
        options.forEach(option => {
            if (option.data.value === selectedValue) {
                option.setDefault(true);
            }
        });
    }

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`pedido_online_select_${userId}_${lang}`)
            .setPlaceholder(isEnglish ? 'Online Playability?' : 'Jogável Online?')
            .addOptions(options)
    );
}

async function handlePedidoModalFinal(interaction, platform, onlineStatus, isEnglish) {
    const userId = interaction.user.id;

    const modal = new ModalBuilder()
        .setCustomId(`pedido_modal_final_${userId}_${platform.replace(/ /g, '_')}_${onlineStatus.replace(/ /g, '_')}_${isEnglish ? 'en' : 'pt'}`)
        .setTitle(isEnglish ? 'Finalize Your Request' : 'Finalize Seu Pedido');

    const gameSoftwareNameInput = new TextInputBuilder()
        .setCustomId('pedido_game_software_name')
        .setLabel(isEnglish ? 'Game/Software Name' : 'Nome do Jogo/Software') // Manteve, pois deve ser curto
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const originalLinkInput = new TextInputBuilder()
        .setCustomId('pedido_original_link')
        .setLabel(isEnglish ? "Link Page (Ex: Steam, Official Site)" : "Link da Página (Ex: Steam, Site Oficial)") // ENCURTADO!
        .setPlaceholder(isEnglish ? "Ex: steam.com/game, siteoficial.com" : "Ex: steam.com/jogo, siteoficial.com") // Adicionado Placeholder para mais detalhes
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const requestInfoInput = new TextInputBuilder()
        .setCustomId('pedido_info_msg')
        .setLabel(isEnglish ? 'Additional Information (Optional)' : 'Informações Adicionais (Opcional)') // ENCURTADO!
        .setPlaceholder(isEnglish ? "Ex: Needs specific version, etc." : "Ex: Precisa de versão específica, etc.") // Adicionado Placeholder
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(gameSoftwareNameInput),
        new ActionRowBuilder().addComponents(originalLinkInput),
        new ActionRowBuilder().addComponents(requestInfoInput)
    );

    // Mostra o modal
    await interaction.showModal(modal);

    // A interação com o modal (submit) será tratada na parte isModalSubmit
}


// *** FUNÇÃO AUXILIAR PARA ADDJOGO/ADDSOFT (GRANDES MUDANÇAS AQUI) ***
async function sendGameOrSoftwareEmbed(originalInteraction, primaryChannelId, notificationChannelId, title, obs, link, imageUrl, type) {
    const isJogo = type === 'jogo';
    const mainChannel = await originalInteraction.guild.channels.fetch(primaryChannelId);
    const notifChannel = await originalInteraction.guild.channels.fetch(notificationChannelId);

    if (!mainChannel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(mainChannel.type)) {
        console.error(`Canal principal inválido: ${primaryChannelId}`);
        return originalInteraction.editReply({ content: `❌ Erro: O canal principal configurado para ${isJogo ? 'jogo' : 'software'} é inválido.`, flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
    }
    if (!notifChannel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(notifChannel.type)) {
        console.error(`Canal de notificação inválido: ${notificationChannelId}`);
        return originalInteraction.editReply({ content: `❌ Erro: O canal de notificação configurado para ${isJogo ? 'jogo' : 'software'} é inválido.`, flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
    }

    // --- 1. POSTAGEM PRINCIPAL (no canal_principal) como na Imagem 1 ---
    let mainContent = `**${title}**\n\n**Link:** [Clique Aqui! | Click Here!](${link})`;
    if (obs) {
        mainContent += `\n\nObservação: ${obs}`;
    }

    let mainMessageOptions = { content: mainContent };
    if (imageUrl) {
        mainMessageOptions.files = [{ attachment: imageUrl, name: 'image.png' }];
    }

    const sentMainMessage = await mainChannel.send(mainMessageOptions);

    // --- 2. MENSAGEM DE AVISO (no canal_notificacao) como na Imagem 2 com @everyone ---
    const embedNotification = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle(`🎉 Novo ${isJogo ? 'Jogo' : 'Software'} Disponível!`)
        .setDescription(
            `🇧🇷 Confira o novo ${isJogo ? 'jogo' : 'software'}: **${title}**\n` +
            `🇺🇸 Check out the new ${isJogo ? 'game' : 'software'}: **${title}**`
        );
    
    // Adicionar thumbnail da imagem, se houver
    if (imageUrl) {
        embedNotification.setThumbnail(imageUrl);
    }

    const detailsButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('Clique Aqui para Mais Detalhes! | Click Here for More Details!')
                .setURL(sentMainMessage.url) // Linka para a mensagem principal
        );
    
    await notifChannel.send({ content: '@everyone', embeds: [embedNotification], components: [detailsButton] });

    // --- 3. Confirmação ao usuário que usou o comando ---
    await originalInteraction.editReply({ content: `✅ ${isJogo ? 'Jogo' : 'Software'} "${title}" adicionado com sucesso e notificação enviada.`, flags: [MessageFlags.Ephemeral] }); // CORREÇÃO: ephemeral
}


client.login(TOKEN);